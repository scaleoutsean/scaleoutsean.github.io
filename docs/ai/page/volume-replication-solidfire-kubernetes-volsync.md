# Backup and replicate Kubernetes PVs with SolidFire using VolSync

Snapshot, backup, and replicate Kubernetes volumes with NetApp Trident and SolidFire using VolSync

- [Introduction](#introduction)
- [VolSync](#volsync)
- [Use cases](#use-cases)
- [Walk-through](#walk-through)
- [VolSync as generic backup and DR application](#volsync-as-generic-backup-and-dr-application)
- [Closing thoughts](#closing-thoughts)

## Introduction

There are literally hundreds of applications and workflows for data replication and synchronization. 

NetApp alone has several (CloudSync, XCP, plus array-based replication). I've blogged about them here and you can find those posts using the search function.

Do we need to talk about yet another one? Of course!

[VolSync](https://volsync.readthedocs.io/en/stable/index.html) is not old, but it uses data movers that have been around for a while. And in fact I've blogged about all of them before I became aware about VolSync. 

Two years ago I released "poor man's VolSync for Linux VMs and Docker" which I called [SolidBackup](/2021/05/08/revisiting-solidbackup.html), and I used one of the movers used by VolSync (Restic). 

I wasn't aware of VolSync but I had started playing with that approach before VolSync appeared. This is one of animated GIFs from a prototype from 2020, which used Duplicacy for backup and data movement.

![SolidBackup prototype with Duplicacy](/assets/images/solid-backup-prototype.gif)

While SolidBackup is very basic compared to VolSync, my point is its approach made sense to me years ago, even before VolSync came out.

## VolSync

So, what does VolSync do?

The same thing SolidBackup does: it takes a snapshot of a volume (Persistent Volume (PV), in this case) and uploads it elsewhere (say, S3) using one of several supported data movers. It can also run that workflow in reverse which makes it a backup/restore utility as well as a volume/file synchronization utility. 

Rsync over SSH is one of the supported data movers. (I've also [experimented with that](/2021/11/30/digital-ocean-volume-to-solidfire-volume-and-back.html)).

If your Kubernetes environment has a CSI provisioner such as Trident (which can be used with SolidFire) or DirectPV (which we can [use with E-Series](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html)), VolSync lets you snapshot data at the source, back it up to S3, and restore it to the same or new location.

![Cluster-to-Cluster data replication](/assets/images/solidfire-eseries-volsync-volume-backup-and-data-replication.png)

This diagram shows a SolidFire-attached database at the source. Remote backups (in S3) can be restored to the same or different site, and to any CSI-managed storage that can create snapshots.

So, VolSync is hardware-independent. The image depicts different storage arrays to highlight that point.

Technically we don't need snapshot to restore a VolSync backup, but if we want to fail over, write to a recovered data volume and then fail back, we may need the snapshot feature to backup the updated data at the destination before failing back.

## Use cases

- Database backup from many production arrays to a slower, but economical E-Series with HDD
- Database backup for DR (any-to-any array) - for example Cloud-to-Office or between sites
- Faster or cheaper copy of production data for Dev/Test/Analytics - for example Private-Cloud-to-Spot.io or back

Although the name VolSync implies synchronization, its use cases cover backup *and* data replication. 

While it's not a problem to take a Trident snapshot of a SolidFire volume every few minutes and upload it to S3 or another Kubernetes cluster, this approach can also satisfy the 3-2-1 rule and give you automated backups with a low (< 1 hour) RPO, works between same or heterogeneous storage, and it costs nothing.

The thing about replication and synchronization utilities is that there are so many use cases and details that you can never have too many tools at your disposal, so VolSync is a welcome addition to our tool chest.

I think VolSync can be especially interesting to E-Series users because unlike SolidFire (which supports ONTAP SnapMirror and has Trident), E-Series cannot replicate to or from ONTAP and isn't supported by Trident.

To set this up for backup to S3, at the source we deploy VolSync as source pod, pick a synchronization interval, bucket details, and two storage class options (for the clone, and snapshot, respectively).

## Walk-through

I don't want to provide all configuration steps and details because the official documentation has them, so instead I will highlight high level steps.

We create a configuration file for our chosen data mover (Restic or something else).

Then we define our replication source (in my case, it's InfluxDB from E-Series Performance Analyzer running in the `epa` namespace).

```yaml
---
apiVersion: volsync.backube/v1alpha1
kind: ReplicationSource
metadata:
  name: epa-influxdb-pvc
  namespace: epa
spec:
  sourcePVC: influxdb-pvc
  trigger:
    schedule: "*/30 * * * *"
  restic:
    pruneIntervalDays: 2
    repository: restic-config
    retain:
      hourly: 3
      daily: 1
      weekly: 0
      monthly: 0
      yearly: 0
    copyMethod: Clone
    storageClassName: bronze
    volumeSnapshotClassName: trident-snapshotclass 
```

This possibility of using a different storage class for snapshot/clone () is also similar to what I did in SolidBackup, have a higher QoS for the clone volume which makes backup run fast (e.g. Maximum IOPS: 15000) while the source volume can remain as is (e.g. Maximum IOPS: 3000).

To perform synchronization from S3 to PVC at the destination, we configure a restore job with a delay sufficient for backup schedule to clone, backup and upload data to S3. For example:

- Src: runs snapshot and backup (to S3) at 5 and 35 minute mark every hour (takes ~5-7 minutes)
- Dst: restores from S3 at 15 and 45 minute mark

```yaml
spec:
  restic:
    copyMethod: Clone
    pruneIntervalDays: 2
    repository: restic-config
    retain:
      daily: 1
      hourly: 3
      monthly: 0
      weekly: 0
      yearly: 0
    storageClassName: bronze
    volumeSnapshotClassName: trident-snapshotclass
  sourcePVC: influxdb-pvc
  trigger:
    schedule: '*/30 * * * *'
status:
  conditions:
  - lastTransitionTime: "2023-02-16T11:02:01Z"
    message: Synchronization in-progress
    reason: SyncInProgress
    status: "True"
    type: Synchronizing
  lastSyncStartTime: "2023-02-16T10:59:34Z"
  restic: {}

```

With volume copy method set to `Clone`, we may see a temporary clone PVC gets created (and deleted once backup is done):

```yaml
Events:
  Type    Reason                        Age   From                Message
  ----    ------                        ----  ----                -------
  Normal  PersistentVolumeClaimCreated  73s   volsync-controller  created PersistentVolumeClaim/volsync-epa-influxdb-src as a clone of PersistentVolumeClaim/influxdb-pvc
```

At the destination - which in my case is the `epa-restore` namespace (in the same cluster), we configure the same S3 repository, a target PVC (same or larger size), and set up a VolSync replication destination.

```yaml
---
apiVersion: volsync.backube/v1alpha1
kind: ReplicationDestination
metadata:
  name: epa-influxdb-replica
spec:
  trigger:
    manual: restore-once
  restic:
    repository: restic-config
    # Use an existing PVC, don't provision a new one
    destinationPVC: influxdb-pvc
    copyMethod: Direct

```

To restore on-demand VolSync has a manual trigger which is done by simply naming a trigger schedule `manual` and giving it a string value, instead of `schedule` (which requires crontab-like schedule configuration).

Whatever the trigger setting, once the job kicks in, a pod will appear in the source namespace. (Here I'm using Rclone.)

```sh
$ kubectl get pods -n epa
NAME                                    READY   STATUS    RESTARTS   AGE
volsync-rclone-src-epa-influxdb-2q6kd   1/1     Running   0          24s
```

`Last Sync Time` indicates that synchronization completed.

```yaml
Status:
  Conditions:
    Last Transition Time:  2023-02-16T14:44:09Z
    Message:               Waiting for next scheduled synchronization
    Reason:                WaitingForSchedule
    Status:                False
    Type:                  Synchronizing
  Last Sync Duration:      52.600550935s
  Last Sync Time:          2023-02-16T14:44:09Z
  Next Sync Time:          2023-02-16T14:50:00Z
Events:
  Type    Reason                        Age    From                Message
  ----    ------                        ----   ----                -------
  Normal  PersistentVolumeClaimCreated  3m51s  volsync-controller  created PersistentVolumeClaim/volsync-epa-influxdb-src as a clone of PersistentVolumeClaim/influxdb-pvc
```

VolSync's Rclone was configured to use `volsync/epa` on S3 (based on the `BUCKET/NAMESPACE` pattern, which is fine if there's just one PVC in the namespace). Normally it's better to use three PVCs for EPA's InfluxDB, but I simplified InfluxDB PVC configuration to use just one. All three data directories (data, meta, WAL) are visible in this output:

```sh
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/00/0000
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/01/0000
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/02/0000
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/03/0000
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/04/0000
[2023-02-16 22:43:57 CST] 4.0MiB STANDARD data/_internal/_series/05/0000
[2023-02-16 22:43:57 CST] 4.0MiB STANDARD data/_internal/_series/06/0000
[2023-02-16 22:43:41 CST] 4.0MiB STANDARD data/_internal/_series/07/0000
[2023-02-16 22:43:41 CST] 2.4KiB STANDARD data/_internal/monitor/1/fields.idx
[2023-02-16 22:43:41 CST]   146B STANDARD meta/meta.db
[2023-02-16 22:43:41 CST] 2.9KiB STANDARD permissons.facl
[2023-02-16 22:43:42 CST] 2.8MiB STANDARD wal/_internal/monitor/1/_00001.wal
```

The same in S3 explorer:

![VolSync bucket](/assets/images/volsync-replication-kubernetes-solidfire-01.png)

Our destination should indicate that synchronization has completed:

```yaml
Status:
  Conditions:
    Last Transition Time:  2023-02-16T14:45:24Z
    Message:               Waiting for next scheduled synchronization
    Reason:                WaitingForSchedule
    Status:                False
    Type:                  Synchronizing
  Last Sync Duration:      24.59596989s
  Last Sync Time:          2023-02-16T14:45:24Z
  Latest Image:
    API Group:     
    Kind:          PersistentVolumeClaim
    Name:          volsync-influxdb-restore-dest
  Next Sync Time:  2023-02-16T15:00:00Z
Events:
  Type    Reason                        Age   From                Message
  ----    ------                        ----  ----                -------
  Normal  PersistentVolumeClaimCreated  5m7s  volsync-controller  created PersistentVolumeClaim/volsync-influxdb-restore-dest to receive incoming data
```

We've completed the following:

- Source: snapshot and clone a PVC, back it up to S3
- Destination: restore from S3

Our InfluxDB volumes (source and destination, they're in the same cluster):

```sh
$ kubectl get pvc -n epa
NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
influxdb-pvc   Bound    pvc-5ee00ac8-21fd-428b-885e-8ff36a568bd5   1Gi        RWO            bronze         4h19m

$ kubectl get pvc -n epa-restore
NAME                            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
volsync-influxdb-restore-dest   Bound    pvc-076b9589-0396-4708-9c69-e1ebb0ec2173   1Gi        RWO            bronze         12m
```

The same in the SolidFire UI (VolSync's clone operation didn't leave undesired snapshots behind).

![VolSync source and destination volumes on SolidFire](/assets/images/volsync-replication-kubernetes-solidfire-02.png)

It took around two minutes to complete backup & restore with a very small amount of data. 

My environment (everything is running in VMs, including SolidFire) isn't suitable for benchmarking, but from many similar (backup to S3, SolidBackup, etc.) tests on physical hardware, we know that several pods could backup at over 1 GB/s on SolidFire and maybe 5-10 GB/s on E-Series. 

## VolSync as generic backup and DR application

One of the use cases I had in mind for SolidBackup was using SolidBackup as general backup for non-Docker (Linux) volumes.

I blogged about that in detail but the bottom line is that wouldn't work well for non-Linux volumes and multi-partition volumes.

The latter shouldn't be a problem for anyone who follows this blog and does what I do (create filesystems on non-partitioned LUNs).

For regular Linux volumes (KVM, bare metal servers, even Docker), we can use that idea with VolSync:
- Maintain a YAML or JSON file with list of volumes to backup
- Take snapshots the way you normally do
- Run a Kubernetes job that uses the SolidFire API to find the latest (or specially named) snapshot for each of the volumes, clone it and import to Kubernetes using the Trident import feature
- Trigger VolSync backup jobs to copy data to S3

Maybe it'd be easier to use Velero for that, but VolSync would work as well and there's also a [scheduler](https://github.com/backube/snapscheduler).

If SolidFire wasn't going End-of-Sale, I think adding SolidFire's [Backup/Restore to/from S3 API calls](http://scaleoutsean.github.io/2021/04/21/solidfire-backup-to-s3.html) to the list of supported movers would be a great addition to VolSync. By that I don't mean adding SolidFire's APIs, but adding a generic transport plugin to VolSync, and then using it to wrap SolidFire's API calls in it. That backup/restore mover would be slower than several parallel Restic or Rclone backups, but it wouldn't require any clients to run.

## Closing thoughts

It'd be time-consuming to compare VolSync with other utilities so I won't do it.

I wanted to use Restic but I couldn't backup to work in VolSync, although I had it working perfectly fine on the worker node VM... Rclone worked, so that's what I ended up using.

VolSync can be hard to set up the first time one does it because there are options and moving components (unlike in Velero, for example, where data mover is well integrated and almost hidden from the user). 

Those who automate a lot may find it easy to use because typos will be less of a problem and if you do it once, every consecutive time it's only easier because it's after the first time, it's all automated and there's almost nothing to do.

VolSync feels "familiar" and I feel comfortable with all its data movers, so I wouldn't hesitate to consider using it with SolidFire or E-Series as either source or destination.
