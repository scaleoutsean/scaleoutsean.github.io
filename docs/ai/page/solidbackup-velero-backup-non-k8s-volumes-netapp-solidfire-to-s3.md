# Backup NetApp SolidFire's non-Kubernetes volumes with Velero

SolidBackup with Velero - modern backup of SolidFire non-K8s volumes to S3

- [Intro](#intro)
- [Using Kubernetes to backup non-Kubernetes volumes](#using-kubernetes-to-backup-non-kubernetes-volumes)
- [Dealing with alien filesystems](#dealing-with-alien-filesystems)
- [Workflow for backup of non-K8s volumes on SolidFire using Velero](#workflow-for-backup-of-non-k8s-volumes-on-solidfire-using-velero)
- [Original-to-clone volume mapping](#original-to-clone-volume-mapping)
- [Workflow](#workflow)
- [Clone refresh](#clone-refresh)
- [Kubernetes-related tasks](#kubernetes-related-tasks)
  - [Restores](#restores)
- [Automation and auto-scaling](#automation-and-auto-scaling)
- [Summary](#summary)

## Intro

Over the years I've been kind of obsessed with DIY backup. Maybe that's because SolidFire includes free "volume to S3" backup functionality, which acted as a gateway drug, so to speak.

I blogged about this many times (search this blog for SolidFire backup or skim through the archive), but very briefly, here's my current status:

First, I created PowerShell scripts for parallel (native) SolidFire backup of a list of volumes (by volume ID) from SolidFire. This uses native SolidFire backup-to-S3 functionality which is limited (why, read in the archive posts). This works fine - it automatically maxes out backup job slots and keeps them busy until all volumes have been backed up. This seems trivial - in hindsight - but I had to struggle with SolidFire API bugs in this area, MinIO bug (fixed since; other major S3 worked well), etc.

The second idea (from 2020 or so) was to come up with an approach that solves some shortcomings of built-in backup-to-S3. Of course, I inevitably added some new shortcomings at the same time. This approach consists of two steps: create (and maintain) a list of volume pairs (production, clone) and use a container or physical host to periodically backup the clones to S3. 

The [second approach](https://github.com/scaleoutsean/solidbackup) fixes several shortcomings:

- Backup utility can be anything (rsync, rclone, Kopia, etc.)
- Backup utility runs on iSCSI clients, and can run on several clients at once (much faster performance, basically as any SolidFire client workload) while the built-in backup-to-S3 runs on SolidFire nodes, uses Management Network (sometimes 1GigE)
- Backup efficiency can be better than SolidFire's (Restic, Kopia, etc.)
- Incremental backup is available
- Much better manageability and monitoring (because we can rely on any backup utility, including commercial backup software)
- Encrypted backup is supported by most of these utilities

The main new shortcomings compared to built-in backup-to-S3 is that because this approach is a client workload, data from volumes is now accessible to backup operator and iSCSI clients running backup jobs. On SolidFire, backup to S3 runs on SolidFire nodes and data is therefore better protected - only SolidFire administrator has access to it at the source. But the second approach can encrypt data at source whereas SolidFire's backup-to-S3 does not. Therefore, this new shortcoming may or may not be seen as a problem:

- SolidFire backup-to-S3 does not involve the role of backup operator, but backups are not encrypted on S3
- My second approach involves a backup operator ("trusted" iSCSI client VM), but backups can be easily encrypted before they're uploaded to S3

One to-do item was making my second approach - to which I sometimes refer to as "SolidBackup" - more manageable and easier to scale out and in (meaning, make several iSCSI clients capable of running jobs without manually determining how to distribute volume backup workload among them, which SolidFire's backup-to-S3 does on its own based on the proper distribution of volumes around the cluster).

## Using Kubernetes to backup non-Kubernetes volumes

In one of those older posts I used Velero as "data mover" for SolidBackup:

- Copy (clone) source volume (or its snapshot) to clone volume works the same as with Restic, etc.
- Backup to S3 works the same way as well. The lacking part that remained on my to-do list was to import the clone to Kubernetes

Trident CSI can [import](https://docs.netapp.com/us-en/trident/trident-use/vol-import.html) a non-Kubernetes volume to Kubernetes. That's easy, but it has to be automated.

The last step is to enable autoscaling so that Kubernetes can spin up multiple backup jobs. This is still work-in-progress.

## Dealing with alien filesystems 

I mentioned this in SolidBackup README - if your volume has a filesystem that's not supported by Trident, you can't back it up with SolidBackup.

A workaround - widely used by most data movers - is to simply do a binary ("raw device") backup. That's what I used, because the only other alternative I could think of was making sure there are Windows, ESXi (how?) and other "backup workers" that could perform native filesystem level backup.

Trident CSI only supports ext[3,4] and XFS, but [raw block device support is available](https://docs.netapp.com/us-en/trident/trident-use/element.html).

Velero didn't support "raw device backup" until late last year, which is one of the reason why I hadn't made progress with this idea between 2021 and now.

To backup an NTFS volume from Kubernetes, I think we *may* need to use `volumeMode=block` (see [this](/2023/09/01/kubernetes-solidfire-block-volumemode.html)) on the SolidFire PVC, and Velero *must* be installed with a privileged node agent ("`velero install --use-node-agent --privileged-node-agent`"). 

## Workflow for backup of non-K8s volumes on SolidFire using Velero

Assuming we have clones ready (this part is done with the SolidFire API), the new steps related to Velero would be:

- Perform *unmanaged* import of a clone volume using Trident (`tridentctl import volume <backendName> <volumeName> -f <path-to-pvc-file> --no-manage`) - this can be a pre-backup hook on Velero backup job
- Let Velero backup schedule take care of backup job scheduling
- Make sure PVC policy on the imported volume is set to `Retain`, and (maybe, needs investigation) delete volume from Kubernetes to release it for next refresh (post-backup hook?)

## Original-to-clone volume mapping 

I have one or more non-Kubernetes tenants on SolidFire - maybe one SolidFire account for vSphere, two for various Windows, one for KVM HA cluster pair. Account IDs: 1, 2, 3.

These own volumes, say 2 each, with Volume IDs 10, 11, 20, 21, 30, 31.

I create clones using SolidBackup, and now I have:

- Account 1: volumes (10, 40), (11, 41)
- Account 2: volumes (20, 42), (21, 43)
- Account 3: volumes (30, 44), (31, 44)

All clones (40-44) should be assigned to a new tenant, let's call him "velero". I want to run Velero backup in a small, dedicated Kubernetes cluster, so this account will have access to all clones. 

## Workflow 

My Windows account on SolidFire is account ID 136:

```powershell
PS /home/sean> Get-SFVolume -VolumeID 136

VolumeID                    : 136
Name                        : sqldb
AccountID                   : 13

```

The first step is to create a tenant account for "backup operator" (velero), since I want a dedicated cluster just for backup. This cluster should be managed by a trusted user such as SolidFire admin, an actual backup operator or backup-as-a-service team in control of the Kubernetes cluster.

```powershell
PS /home/sean> New-SFAccount -Username velero

AccountID          : 14
Username           : velero
Status             : active
Volumes            : {}
InitiatorSecret    : XXXXXXXXXXXXX
TargetSecret       : YYYYYYYYYYYYY
StorageContainerID : 00000000-0000-0000-0000-000000000000
Attributes         : {}
EnableChap         : False
```

I "masked" the secrets, but that's what we'd use for Trident CSI.

Next, let's consider how that would work for a Windows-based SQL Server (volume ID is 136, as shown above).

I can clone this volume to a new volume (`New-SFClone`) and assign the clone to the user "velero", and that clone would be crash consistent. That is usually fine, but I can also create an application-consistent snapshot (by coordinating SQL freeze and SolidFire hardware snapshot, for example.) 

On Windows, every day at 3am I freeze or stop or detach SQL, and take a snapshot which I name `velero-vol-${VOLUMEID}-${UTCTIME}"` and retain 1 day.

```powershell
PS /home/sean> New-SFSnapshot -VolumeID 136 -Name "velero-vol-136-202404090622Z" -Retention "01:00:00"

SnapshotID              : 443
VolumeID                : 136
Name                    : velero-vol-136-202404090622Z
Checksum                : 0xdb24f1ab640959c4
EnableRemoteReplication : False
ExpirationReason        : None
ExpirationTime          : 2024-04-09T07:22:33Z
RemoteStatuses          : 
Status                  : done
SnapshotUUID            : db0b6b09-7498-4ac8-9d28-2f825ec73f83
TotalSize               : 5000658944
GroupID                 : 0
GroupSnapshotUUID       : 00000000-0000-0000-0000-000000000000
CreateTime              : 2024-04-09T06:22:33Z
InstanceCreateTime      : 2024-04-09T06:22:33Z
VolumeName              : sqldb
InstanceSnapshotUUID    : db0b6b09-7498-4ac8-9d28-2f825ec73f83
VirtualVolumeID         : 
Attributes              : {}
SnapMirrorLabel         : 

```

Now I can clone from that snapshot (snapshot ID: 443) to a new volume assigned to Velero (account ID: 14). 

```powershell
PS /home/sean> New-SFClone -VolumeID 136 -SnapshotID 443 -NewAccountID 14 -Name "velero-vol-136-202404090625Z" 

Volume      : {"VolumeID" = 138, "Name" = "velero-vol-136-202404090625Z", "AccountID" = 14, "CreateTime" = "2024-04-09T06:25:56Z", 
              "EnableSnapMirrorReplication" = False, "Status" = "init", "Access" = "readWrite", "Enable512e" = True, "Iqn" = 
              "iqn.2010-01.com.solidfire:wcwb.velero-vol-136-202404090625z.138", "ScsiEUIDeviceID" = "776377620000008af47acc0100000000", "ScsiNAADeviceID" 
              = "6f47acc100000000776377620000008a", "Qos" = {"MinIOPS" = 100, "MaxIOPS" = 800, "BurstIOPS" = 1000, "BurstTime" = 60}, "DeleteTime" = "", 
              "PurgeTime" = "", "SliceCount" = 0, "TotalSize" = 5000658944, "BlockSize" = 4096, "CurrentProtectionScheme" = "singleHelix"}
CloneID     : 53
VolumeID    : 138
Curve       : {[1048576, 15000], [131072, 1950], [16384, 270], [262144, 3900]…}
AsyncHandle : 147

```

This returns volume ID 138, which is what I will later import from Trident CSI.

In the case of this SQL volume, my mapping would look like:

```powershell
@{
    "accountid": "13",
    "sourcevolumeid": "136",
    "destinationvolumeid": "139",
    "filesystem": "NTFS",
    "application": "windows2025-sqldb-01"
}
```

Clone volume ID can remain fixed so that we don't have to clone and import every day. We could determine it from the snapshot name (template) - on the one hand that would mean less work, but on the other it could potentially be open to abuse if someone were to misname unrelated snapshots and mess up our clone refresh jobs.

## Clone refresh

With that mapping in place, I no longer need to create clones every day, I just refresh the clone with `Copy-SFVolume` using the latest "for Velero" snapshot available.

The next snapshot (ID will be incremented, here to 445):

```powershell
PS /home/sean> New-SFSnapshot -VolumeID 136 -Name "velero-vol-136-202404090637Z" -Retention "01:00:00"        

SnapshotID              : 445
VolumeID                : 136
Name                    : velero-vol-136-202404090637Z
Checksum                : 0xdb24f1ab640959c4
EnableRemoteReplication : False
ExpirationReason        : None
ExpirationTime          : 2024-04-09T07:37:27Z
RemoteStatuses          : 
Status                  : done
SnapshotUUID            : 0b75cf85-3eb8-4043-8325-0b4f1baba408
TotalSize               : 5000658944
GroupID                 : 0
GroupSnapshotUUID       : 00000000-0000-0000-0000-000000000000
CreateTime              : 2024-04-09T06:37:27Z
InstanceCreateTime      : 2024-04-09T06:37:27Z
VolumeName              : sqldb
InstanceSnapshotUUID    : 0b75cf85-3eb8-4043-8325-0b4f1baba408
VirtualVolumeID         : 
Attributes              : {}
SnapMirrorLabel         : 

PS /home/sean> Copy-SFVolume -VolumeID 136 -SnapshotID 445 -DstVolumeID 137 

CloneID AsyncHandle
------- -----------
     54         148

PS /home/sean> Get-SFASyncResult -ASyncResultID 148

Name                           Value
----                           -----
lastUpdateTime                 4/9/2024 6:38:05 AM
status                         complete
createTime                     4/9/2024 6:38:04 AM
resultType                     Clone
result                         {[message, Clone complete.], [cloneID, 54], [volumeID, 136]}

```

How do I know which of potentially several snapshots to use? Based on snapshot `Name` or `CreateTime`. The name would also tell me the source (volume ID 136), which comes from the mapping table and can be dynamically assigned based on a naming template for snapshots and clones.

```powershell
PS /home/sean> Get-SFSnapshot -VolumeID 136 | Select-Object -Property Name,CreateTime

Name                         CreateTime
----                         ----------
velero-vol-136-202404090609Z 2024-04-09T06:09:41Z
velero-vol-136-202404090619Z 2024-04-09T06:19:47Z
velero-vol-136-202404090619Z 2024-04-09T06:22:24Z
velero-vol-136-202404090622Z 2024-04-09T06:22:33Z
velero-vol-136-202404090637Z 2024-04-09T06:37:27Z

```

As you can see I have a mistake (wrong minute value in time string) in the name of the fourth snapshot Name because I named them manually. Normally names should be created automatically, which is something I didn't do in this PoC. 

With that I copied that snapshot into my existing "for velero" clone. As these jobs are asynchronous, it make take seconds to tens of minutes (for TB-sized volumes on busy SolidFire clusters), so you need to leave up to an hour between these daily "refreshes" and Velero backup schedule.

## Kubernetes-related tasks

Setup a small cluster (say, 3 VM nodes) and deploy Trident CSI and Velero CSI. As long as the distribution can deploy CSI plugins for iSCSI, it should work fine.

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: 
  namespace: my_namespace
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: my_storage_class
```

As mentioned earlier, I need to import this clone (volume ID 137) to Kubernetes.

```powershell
PS /home/sean> Get-SFVolume -VolumeID 137          

VolumeID                    : 137
Name                        : velero-vol-136-202404090620Z
AccountID                   : 14
CreateTime                  : 2024-04-09T06:20:48Z
VolumeConsistencyGroupUUID  : 8e441a08-a19a-4a4d-88bd-7a77d7225a08
VolumeUUID                  : 8eae128b-1360-4f2d-a8de-4c9ae1a6ca66
EnableSnapMirrorReplication : False
Status                      : active
Access                      : readWrite
Enable512e                  : True
Iqn                         : iqn.2010-01.com.solidfire:wcwb.velero-vol-136-202404090620z.137
ScsiEUIDeviceID             : 7763776200000089f47acc0100000000
ScsiNAADeviceID             : 6f47acc1000000007763776200000089
Qos                         : {"MinIOPS" = 100, "MaxIOPS" = 800, "BurstIOPS" = 1000, "BurstTime" = 60}
QosPolicyID                 : 1
VolumeAccessGroups          : {}
VolumePairs                 : {}
DeleteTime                  : 
PurgeTime                   : 
LastAccessTime              : 
LastAccessTimeIO            : 
SliceCount                  : 1
TotalSize                   : 5000658944
BlockSize                   : 4096
VirtualVolumeID             : 
Attributes                  : {}
CurrentProtectionScheme     : singleHelix
PreviousProtectionScheme    : 
FifoSize                    : 5
MinFifoSize                 : 0

```

I can create a backup storage class - say, "velero-backup" - with a QoS Policy (Min 500, Max 20000, Burst 50000) to not inconvenience other workloads, but to allow ample bandwidth for backup jobs. Use `reclaimPolicy: Retain` to retain SolidFire volume when it's "deleted" from Kubernetes - that way we can refresh with `Copy-SFVolume` and simply import again.

Then I loop through the mapping table to create a bunch of PVC claims, one per each clone. For volume ID 137:

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: volume-137-src-136
  namespace: src136
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: velero-backup
```

Volume name can be anything, of course, but in my mind it's helpful if we can view the ID the original production volume when looking at a clone or searching Velero backups (IDs of those volumes should be completely irrelevant to us, as they're created and backed up automatically; we just need to find them when wanting to restore the original production volume).

The namespace is arbitrarily made up. We could just use `default`, but there may be reasons why we would use something related to the original source of the clone volume ID (here, 136 is the source, 137 is the clone). 

- With Kubernetes RBAC for per-namespace access, this would make it easier to provide self-service for Backup-as-a-Service access to application owners
- We could customize namespace names to match organizations, teams or something else

Then all PVCs would be imported 

```sh
$ tridentctl import volume velero-vol-136-202404090637Z \
  velero-vol-136-202404090637Z-k8s \
  -f pvc-vol-136-velero-backup.yaml \
  --no-manage -n trident

```

Of course, I hit a bug.

```raw
Error: could not import volume: 
error occurred during PVC creation: PersistentVolumeClaim "velero-vol-136-202404090625Z" is invalid: 
metadata.name: Invalid value: "velero-vol-136-202404090625Z": a lowercase RFC 1123 subdomain must 
consist of lower case alphanumeric characters, '-' or '.', and must start and end with an 
alphanumeric character (e.g. 'example.com', regex used for validation is
'[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*') (400 Bad Request)

```

This is garbage. Note that the regex eliminates uppercase and claims that's based on an RFC.

But there's nothing about lowercase names in that RFC. Related to DNS names, the DOD INTERNET HOST TABLE SPECIFICATION ([RFC 952](https://datatracker.ietf.org/doc/html/rfc952)) says:

> No distinction is made between upper and lower case. 

You can read about that circus here: [https://github.com/kubernetes/kubernetes/issues/94088](https://github.com/kubernetes/kubernetes/issues/94088). 

[The Kubernetes Web site](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/) still claims lowercase names are an RFC 1123 requirement. RFC my ass!

Anyway, because of that nonsense I had to change "Z" at the end of my volume names (velero-vol-136-202404090609**Z**). 

The [trident import](https://docs.netapp.com/us-en/trident/trident-use/vol-import.html) documentation says:

> The reclaim policy is initially set to retain in the PV. After Kubernetes successfully binds the PVC and PV, the reclaim policy is updated to match the reclaim policy of the Storage Class.
> If the reclaim policy of the Storage Class is delete, the storage volume will be deleted when the PV is deleted.

If our Storage Class has `reclaimPolicy: Retain`, we'll be able to delete it with `trident volume delete`.

```yaml
$ cat pvc-vol-136-velero-backup.yaml 
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: velero-vol-136-202404090816z-rfc-1123-my-ass
  namespace: ns136
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: silver
```

Import the sucker:

- Backend name obtained with "`tridentctl -n trident get backends`"
- Volume Name on SolidFire (of the clone created for Velero) without uppercase characters
- PVC file (above)

```sh
$ trident-installer/tridentctl import volume \
  solidfire_192.168.105.30 \
  velero-vol-136-202404090816z \
  -f pvc-vol-136-velero-backup.yaml \
  -n trident --no-manage
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|                   NAME                   |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| pvc-fec78b61-a216-4825-a709-a24069cfadc7 | 4.7 GiB | silver        | block    | b3680925-a9c1-4552-a1b4-1e4a0a273e8e | online | false   |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+

```

Check it out:

```sh
$ kubectl get pv
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS     CLAIM
pvc-fec78b61-a216-4825-a709-a24069cfadc7   4769Mi     RWO            Retain           Bound      ns136/velero-vol-136-202404090816z-rfc-1123-my-ass

```

Create a scheduled backup job in Velero. If our cloning process starts at 2am, it's likely safe to schedule backup for 3am. Mind the potential difference between UTC (SolidFire schedule) and Velero's own (which maybe uses time in local TZ, I haven't looked).

```sh
$ velero schedule create velero-schedule --schedule="0 3 * * *"
$ velero backup create ns136 --include-resources pvc,pv --include-namespaces ns136 --from-schedule velero-schedule

```

Alternatively, we could kick off volume copy (the SolidFire API method behind `Copy-SFVolume`) from Velero pre-hoooks. This would make snapshot-to-Velero-volume refresh painless, but I haven't thought about this yet.

**NOTES:** 

- As mentioned earlier, you can't backup an unsupported filesystem from a generic Linux container that cannot read the filesystem. Use Velero's block volume backup to backup raw devices and/or "non-native" filesystems
  - One workaround for [ZFS](/2024/02/29/ubuntu-2404-lts-with-netapp-solidfire.html#operational-and-data-governance-differences-between-zfs-and-classic-linux-filesystems-xfs-ext4) and BtrFS would be to not use Trident CSI. This sounds interesting because it's just for backup (it wouldn't impact users who use Trident CSI) and I will explore it in the future. A CSI provider that can import volumes and works with ZFS would be ideal for this.
- Velero must use [CSI or CSI Snapshot](https://velero.io/docs/main/csi-snapshot-data-movement/#limitations) to backup block volumes. This unfortunately creates a temporary clone (done by Velero) of a clone (done when we created for Velero), so it effectively results in 3x as many SolidFire volumes as one uses for production. Last I checked SolidFire limit was 400 per node, so with 3 nodes alive, this would still be fine for a few hundred volumes. But, if you run Kubernetes *and* non-Kubernetes, and want to use Velero for non-Kubernetes, you may have 300-400 Kubernetes volumes to begin with, so be careful if you use this approach. I think I added SolidFire volume count per node to SolidFire Collector, but if it's not there, you can create your own monitor and alert for Grafana and such.
  - Example: 100 volumes for VMs and BM nodes, 200 volumes for K8s. SolidBackup results in 300 volumes (due to 3x) and 300 + 200 = 500. Still fine even for 3 node clusters
  - Example: watch metadata utilization as well; when SolidFire volumes are cloned, data utilization will be only slightly impacted, but metadata will grow. If - after cloning - cluster metadata capacity utilization on 4 nodes is below 30%, even losing one storage node would result it in going to 40% or so.

Finally, we *could* delete this PVC/PV using a post-backup hook. But, we need to consider how that impacts Velero. Once the PVC and PV are deleted - even if retained on SolidFire - we need to make sure this doesn't impact Velero. I haven't evaluated this yet.

```sh
$ kubectl delete pv pvc-fec78b61-a216-4825-a709-a24069cfadc7
persistentvolume "pvc-fec78b61-a216-4825-a709-a24069cfadc7" deleted
```

### Restores

Velero backups can be restored to a different namespace, so we could restore them to the original production volume. But it's safer to restore them to a new PV in the Kubernetes namespace where we backed them up - that's better for self-service, enables BaaS, and it's less risky to production data. Then a backup administrator or SolidFire administrator can make a clone from it and assign it to the user of the production application.

Remember that all production volumes are supposed to have snapshots that last 24 hours, so in 99% of situations one would restore from the most recent snapshot created for this Velero workflow (or even other, even more recent), and restoring from an S3 backup would be very rare.

## Automation and auto-scaling

SolidBackup automates volume cloning and subsequent "refresh" (copying). It also creates volume mount templates (for VMs). For a Kubernetes based SolidBackup we'd want to automate the creation of Kubernetes namespaces and volume PVC files for Trident import. 

Velero has schedules, so that's already taken care of. But we may potential need to automate pre- and post-hook templates.

Assuming all that works as expected, I'd want to add progress monitoring of (SolidFire) volume copy and (Velero) backup jobs.

I'm not sure what needs to be done with regard to auto-scaling. I played with ArgoCD but couldn't determine if I'd need something like that, or not. SolidBackup with a single VM could backup quickly, so it's probably unnecessary to complicate things - three workers should be able to backup at > 500 MB/s without a problem.

## Summary

The addition of block volume mode in Velero and this post moves me a bit closer to my goal of having a Kubernetes-based SolidBackup that works with filesystems supported by Trident CSI as well as those often seen in non-Kubernetes environments such as Windows and VMware.

SolidBackup from 2021 was potentially useful for small shops with skilled admins. SolidBackup for Kubernetes could be useful for anyone who already uses Velero as well as to skilled admins who liked the idea of a VM-based SolidBackup, but disliked the hackish nature and security compromises it had.

I plan to make updates to this post as time permits.
