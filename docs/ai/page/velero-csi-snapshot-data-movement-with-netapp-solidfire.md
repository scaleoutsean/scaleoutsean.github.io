# Velero 1.12 and CSI Snapshot Data Movement with NetApp SolidFire

What the heck is CSI Snapshot Data Movement and how do I use it with NetApp SolidFire

- [Introduction](#introduction)
- [WTF is CSI Snapshot Data Movement (CSI SDM)](#wtf-is-csi-snapshot-data-movement-csi-sdm)
  - [Why is that a Good Thing](#why-is-that-a-good-thing)
- [Get ready to use CSI SDM with NetApp Astra Trident CSI and SolidFire](#get-ready-to-use-csi-sdm-with-netapp-astra-trident-csi-and-solidfire)
  - [Software stack](#software-stack)
- [Backup workflow](#backup-workflow)
- [Conclusion](#conclusion)
- [Appendix A - Demo](#appendix-a---demo)
- [Appendix B - CSI SDM backup job details](#appendix-b---csi-sdm-backup-job-details)

## Introduction

I've written a bunch of posts about Velero with NetApp Astra Trident and SolidFire, so I'll skip all that. 

You can use search bar at the top to find older posts (Velero SolidFire CSI).

## WTF is CSI Snapshot Data Movement (CSI SDM)

According to Velero, [CSI Snapshot Data Movement](https://velero.io/docs/v1.12/csi-snapshot-data-movement/) is a feature designed to move CSI snapshot data to a backup storage location.

How is that different from CSI snapshots?

The difference - as the feature name suggests - is that CSI Snapshot Data Movement doesn't stop at creating and retaining CSI snapshots. 

If you read some of my earliest posts related to CSI (I have a few about non-CSI as well) you'll see that Velero takes a snapshot and in its backup "catalog" it only records its existence. Data remains on the snapshot itself.

Then, what happens is if the SolidFire cluster gets destroyed, all you have is a nice reference to snapshots that you once had. 

In other words, a snapshot is not a backup. Which I hope you knew.

CSI SDM, on the other hand, *moves* snapshot data to another place, which is to say, it makes a copy also known as a "backup".

> it tries to access the snapshot data through various data movers and back up the data to a backup storage connected to the data movers.

### Why is that a Good Thing

If you completely lose a site, you may still be able to recover your snapshot data from the cloud or some other S3 storage (I used Backblaze for this PoC).

This also makes it easier to restore data from one cluster to another, similar to the way Kasten K10 has been doing it for a while now: you can have it all in S3, not just backups "exported" to S3.
As you can see [here](/2023/09/03/solidbackup-with-kopia.html#steps-related-to-kopia), subsequent backups can be tiny (although we need to remember Velero's Kopia [doesn't](https://velero.io/docs/v1.12/csi-snapshot-data-movement/) work exactly the same way as stand-alone Kopia does), so it may not be a big burden to "backup to S3" once or thrice a day, except for large volumes.

Restore can also be migration; if you want to move data from SolidFire to the cloud, you could sure use VolSync or other tools I blogged about, but you can use Velero or Kasten to backup to S3 and then restore to destination. (I wouldn't do it for SolidFire-to-SolidFire because it's easy enough to replicate volumes between using SolidFire's features, but if network didn't permit storage array-based replication, then I'd consider backup and restore.)

When you think of it, Kopia's data movement of snapshot to S3 means you may (or may not, of course) not need a dedicated disk for "disk-to-S3" preparation: data flows from SolidFire directly to S3. If you need to restore TBs of data quickly, then of course one has to have a replica or on-prem S3 storage. Kopia and Restic *can* bacup TB-sized volumes but when that happens on *live* volumes it creates potential data inconsistencies in backups, which snapshot copies do not suffer from because they are point-in-time copies.

And finally - I wrote about this in the context of Velero CSI backups - you don't have to "allocate" snapshot quotas between people and Velero. Because SolidFire can have up to 32 snapshots per each volume, I used to recommend to create schedules that would give 24-ish to Velero and leave 8 for human consumption (on-demand snapshots, daily snapshots retained for 1 week, etc). Since CSI SDM deletes the snapshot after running, you don't need to reserve that many slots for Velero - one per schedule per volume should be enough.

## Get ready to use CSI SDM with NetApp Astra Trident CSI and SolidFire

I could create a detailed how-to, but I've no idea if anyone needs that, so I won't. Instead I'll just remind:

- you need to install the Kubernetes CSI snapshot stuff (it's in the Trident documentation) and a Volume Snapshot Class for your SolidFire Storage Class
- then, make sure you can manually create snapshots in Kubernetes from YAML files
- if that works, read the Velero docs carefully on how to enable CSI and CSI SDM

### Software stack

- Debian 12.1 ARM64
- NetApp SolidFire 12.5
- NetApp Astra Trident v23.07
- Kubernetes v1.25 (K3s)
- Velero v1.12 RC1 with latest (as of Sep 15, 2023) Velero plugins for S3 and CSI

```sh
$ cat /etc/debian_version 
11.7

$ uname -a
Linux k1 6.1.11-meson64 #23.02.2 SMP PREEMPT Sat Feb 18 00:07:55 UTC 2023 aarch64 GNU/Linux

$ k3s --version
k3s version v1.25.14-rc1+k3s1 (c20a6195)
go version go1.20.8

$ # my custom Trident build for ARM64

$ ./tridentctl -n kube-system version
+---------------------------------------------------------+---------------------------------------------------------+
|                     SERVER VERSION                      |                     CLIENT VERSION                      |
+---------------------------------------------------------+---------------------------------------------------------+
| 23.07.0-custom+e2344922b27d1aec8c2574153962ef7ea49e390d | 23.07.0-custom+e2344922b27d1aec8c2574153962ef7ea49e390d |
+---------------------------------------------------------+---------------------------------------------------------+

$ kubectl version -o yaml
clientVersion:
  buildDate: "2023-09-14T00:42:50Z"
  compiler: gc
  gitCommit: c20a619525fb64465e50253d2c559f75cf4736de
  gitTreeState: clean
  gitVersion: v1.25.14-rc1+k3s1
  goVersion: go1.20.8
  major: "1"
  minor: "25"
  platform: linux/arm64
kustomizeVersion: v4.5.7
serverVersion:
  buildDate: "2023-09-14T00:42:50Z"
  compiler: gc
  gitCommit: c20a619525fb64465e50253d2c559f75cf4736de
  gitTreeState: clean
  gitVersion: v1.25.14-rc1+k3s1
  goVersion: go1.20.8
  major: "1"
  minor: "25"
  platform: linux/arm64

$ velero version
Client:
	Version: v1.12.0-rc.1
	Git commit: 0c0ccf949bed87c2a8f773270ca0d79779283a4e
Server:
	Version: v1.12.0-rc.1

```

## Backup workflow

I'll show how I backed up an app using CSI SDM. I won't even try to restore as that should work the same as in all other posts with Velero and SolidFire.

My resources:

- Namespace: minio
- Pod: minio-deployment-68c69c6d55-qn45l (/data is using 2GiB iSCSI volume on SolidFire)
- PVC: pvc-ba3213cd-01bc-4920-b1c7-708ed89e5730 (2GiB volume on SolidFire)

With this, I created a Velero CSI backup job:

```sh
$ velero backup create minio-backup \
  --snapshot-volumes=true \
  --snapshot-move-data \
  --include-namespaces minio
Backup request "minio-backup" submitted successfully.
Run `velero backup describe minio-backup` or `velero backup logs minio-backup` for more details.

```

This initially looked promising because I hadn't seen this before - I thought it was waiting for Trident CSI to do something on the back end.

```sh
$ velero backup get
NAME           STATUS                       ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
minio-backup   WaitingForPluginOperations   0        0          2023-09-15 08:18:07 +0000 UTC   29d       default            <none>

```

Darn, it completed too quickly!

```sh
$ velero backup get
NAME           STATUS      ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
minio-backup   Completed   0        0          2023-09-15 08:18:07 +0000 UTC   29d       default            <none>

```

I was suspicious. On the one hand, SolidFire logs looked promising (I noticed a clone was created), but I didn't know how to tell if it worked the way I expected. 

On the other hand `velero backup describe` had "Velero-Native Snapshots: none included" at the very bottom (see in Appendix A), which scared me. But the messages near the top (this screenshot below) looked good.

![](/assets/images/velero-csi-sdm-07-velero-status-backup-completed.png)

Completed! (Notice "Snapshot Move Data: true".)

Here are a few selected screenshots. The first is the app (pod and PVC).

![MinIO Pod and PVC](/assets/images/velero-csi-sdm-01-minio-pod-pvc.png)

Show all Velero backups:

![](/assets/images/velero-csi-sdm-02-velero-csi-backup.png)

SolidFire PV (pvc-ba3213cd-01bc-4920-b1c7-708ed89e5730) is storage used by MinIO pod:

![](/assets/images/velero-csi-sdm-03-solidfire-pvc.png)

This is one of **key** screenshots! Mind the clone volume!

![](/assets/images/velero-csi-sdm-04-solidfire-csi-snap-clone-for-velero.png)

I feel obliged to remind every time: notice how the clone has the same QoS as the source? 

It should be possible to use a [hook](https://velero.io/docs/v1.12/backup-hooks/) to increase a storage QoS setting (MaxIOPS, mostly) of the clone to increase its backup performance. 

Backup data was sucked in by Velero and shipped off to my Backblaze bucket.

![](/assets/images/velero-csi-sdm-05-backblaze-backup-bucket.png)

And finally, **the key** screenshot. You may want to right-click and open it in another tab if you're interested in this post.

![](/assets/images/velero-csi-sdm-06-velero-csi-sdm-workflow.png)

What's this? Looking from the bottom:

| Event        | Message   | Note       |
|--------------|:----------|:-----------|
| 14368 | Snapshot succeeded | Velero kicks off Trident CSI volume snapshot |
| 14370 | Clone volume started | SolidFire snapshots must be cloned to become accessible. Velero CSI SDM creates clone from a CSI snapshot |
| 14373 | API Call (DeleteSnapshot) | Snapshot is no longer needed |
| 14374 | API Call (DeleteVolume) | Cloned volume is no longer needed |

Let's nicely format JSON from event ID 14371 (part of clone volume operation) above:

```json
{
  "context": {
    "authMethod": "Cluster",
    "ip": "192.168.1.18",
    "user": "admin"
  },
  "method": "CloneVolume",
  "params": {
    "attributes": {
      "docker-name": "pvc-b6b350ba-7e3a-4195-b31e-084c14f0ebe8",
      "fstype": "xfs",
      "provisioning": "",
      "trident": "{\"version\":\"23.07.0-custom+e2344922b27d1aec8c2574153962ef7ea49e390d\",\"backendUUID\":\"f069f7c4-759a-4758-9b90-564d290e76a4\",\"platform\":\"kubernetes\",\"platformVersion\":\"v1.25.14-rc1+k3s1\",\"plugin\":\"solidfire-san\"}"
    },
    "name": "pvc-b6b350ba-7e3a-4195-b31e-084c14f0ebe8",
    "requestAPIVersion": "12.2",
    "snapshotID": 132,
    "volumeID": 59
  },
  "success": true
}
```

This clones our original PVC - of course - but how? By using Snapshot ID 132 as the source!

Snapshot ID 132 (snapshot-2eaf2311-e284-44be-8afb-190b32c7d5bb) is the snapshot that was created when Velero executed backup. The whole thing happened too quickly so by the time I realized what happened, the snapshot was already deleted. (I captured another one in the demo video shared further below, but not this particular snapshot).

The resulting clone (pvc-b6b350ba-7e3a-4195-b31e-084c14f0ebe8) also briefly appeared in the SolidFire Web UI, and was deleted as soon as Velero was done with it.

## Conclusion

CSI SDM is looking very promising and seems to work as expected (I'm sure there are bugs, of course, as it's a new feature). 

It could be especially helpful to NetApp HCI and SolidFire users who felt (or really have been) constrained in terms of snapshots. 

Once you set it up, CSI SDM is not more complicated to use than regular Velero CSI snapshots. (Most of the time I wasted in the process of doing this posts was the time spent on getting the damn Kubernetes snapshot add-ons YAML files deployed into Kubernetes.)

As an aside: with CSI SDM it becomes even easier to backup non-partitioned Linux volumes using Kubernetes (which is one of my [old obsessions](/2022/03/15/velero-18-with-restic-and-trident-2201.html#using-velero-and-restic-to-backup-regular-solidfire-volumes)).

## Appendix A - Demo

This was done after the first run in which screenshots were captured, so clone volume and snapshot IDs may be different.

- [Velero CSI Snapshot Data Mover with NetApp Trident and SolidFire](https://rumble.com/v3i2nua-velero-csi-snapshot-data-mover-with-netapp-trident-and-solidfire.html) - 4m0s

## Appendix B - CSI SDM backup job details

Detailed backup job log:

```sh
$ velero backup describe minio-backup --details
Name:         minio-backup
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/resource-timeout=10m0s
              velero.io/source-cluster-k8s-gitversion=v1.25.14-rc1+k3s1
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=25

Phase:  Completed

Namespaces:
  Included:  minio
  Excluded:  <none>

Resources:
  Included:        *
  Excluded:        <none>
  Cluster-scoped:  auto

Label selector:  <none>

Storage Location:  default

Velero-Native Snapshot PVs:  true
Snapshot Move Data:          true
Data Mover:                  velero

TTL:  720h0m0s

CSISnapshotTimeout:    10m0s
ItemOperationTimeout:  4h0m0s

Hooks:  <none>

Backup Format Version:  1.1.0

Started:    2023-09-15 08:18:07 +0000 UTC
Completed:  2023-09-15 08:19:18 +0000 UTC

Expiration:  2023-10-15 08:18:07 +0000 UTC

Total items to be backed up:  27
Items backed up:              27

Backup Item Operations:
  Operation for persistentvolumeclaims minio/minio-storage:
    Backup Item Action Plugin:  velero.io/csi-pvc-backupper
    Operation ID:               du-35ec57e3-2c01-4ec5-bbb0-1ecb9d6cc7f9.ba3213cd-01bc-49262cbd2
    Items to Update:
                           datauploads.velero.io velero/minio-backup-p5r87
    Phase:                 Completed
    Progress:              19281 of 19281 complete (Bytes)
    Progress description:  Completed
    Created:               2023-09-15 08:18:17 +0000 UTC
    Started:               2023-09-15 08:18:17 +0000 UTC
    Updated:               2023-09-15 08:19:08 +0000 UTC
Resource List:
  apps/v1/Deployment:
    - minio/minio-deployment
  apps/v1/ReplicaSet:
    - minio/minio-deployment-68c69c6d55
  discovery.k8s.io/v1/EndpointSlice:
    - minio/minio-service-7swv6
  v1/ConfigMap:
    - minio/kube-root-ca.crt
  v1/Endpoints:
    - minio/minio-service
  v1/Event:
    - minio/minio-deployment-68c69c6d55-qn45l.1785039f5fce2cdb
    - minio/minio-deployment-68c69c6d55-qn45l.1785039fb4443860
    - minio/minio-deployment-68c69c6d55-qn45l.1785039fd934c55b
    - minio/minio-deployment-68c69c6d55-qn45l.178503a23ea405cd
    - minio/minio-deployment-68c69c6d55-qn45l.178503a29c304d7e
    - minio/minio-deployment-68c69c6d55-qn45l.178503a2a0db93c1
    - minio/minio-deployment-68c69c6d55-qn45l.178503a2ad412d99
    - minio/minio-deployment-68c69c6d55.1785039f5f425f2d
    - minio/minio-deployment.1785039f5b0b851d
    - minio/minio-storage.1785039f4f52d692
    - minio/minio-storage.1785039f4fb59b04
    - minio/minio-storage.1785039f756e6646
    - minio/minio-storage.1785039f7727e39a
    - minio/velero-minio-storage-c72ck.178503fcc1dec71e
    - minio/velero-minio-storage-c72ck.178503fcebd6bfb3
    - minio/velero-minio-storage-c72ck.178503fcebd7890b
  v1/Namespace:
    - minio
  v1/PersistentVolume:
    - pvc-ba3213cd-01bc-4920-b1c7-708ed89e5730
  v1/PersistentVolumeClaim:
    - minio/minio-storage
  v1/Pod:
    - minio/minio-deployment-68c69c6d55-qn45l
  v1/Service:
    - minio/minio-service
  v1/ServiceAccount:
    - minio/default

Velero-Native Snapshots: <none included>

CSI Volume Snapshots: <none included>
```
