# Stand-alone and Consistency Group snapshots on NetApp E-Series

Understand and use SANtricity snapshots of both stand-alone and snapshot consistency group volume members

- [How does it work?](#how-does-it-work)
- [Limits](#limits)
- [Thin or thick?](#thin-or-thick)
- [How much to reserve for SANtricity snapshots?](#how-much-to-reserve-for-santricity-snapshots)
- [What can we do with SANtricity snapshots and clones](#what-can-we-do-with-santricity-snapshots-and-clones)
  - [Use case 1: plain old snapshots](#use-case-1-plain-old-snapshots)
  - [Use case 2: snapshots with anti-ransomware characteristics](#use-case-2-snapshots-with-anti-ransomware-characteristics)
  - [Use case 3: Dev/Test and backup offload](#use-case-3-devtest-and-backup-offload)
- [Managing reserved capacity](#managing-reserved-capacity)
- [Consistency groups and data consistency](#consistency-groups-and-data-consistency)
- [Other confusing details](#other-confusing-details)
- [Conclusion](#conclusion)
- [Appendix A - SANtricity Snapshot Consistency Groups (CG)](#appendix-a---santricity-snapshot-consistency-groups-cg)
- [Appendix B - Snapshots](#appendix-b---snapshots)
  - [Stand-alone volume snapshot](#stand-alone-volume-snapshot)
  - [Consistency Group snapshot](#consistency-group-snapshot)
  - [Rollback (recovery)](#rollback-recovery)
- [Appendix C - Repository utilization](#appendix-c---repository-utilization)
- [Appendix D - Snapshot schedule](#appendix-d---snapshot-schedule)
- [Appendix E - CG rollback from snapshot with MinIO Single-Node Multi-Drive](#appendix-e---cg-rollback-from-snapshot-with-minio-single-node-multi-drive)

## How does it work?

Something like this:

- No additional license is required
- SANtricity calls snapshots "snapshot images" (a non-writeable Point-in-Time storage object)
- SANtricity calls clones "snapshot volumes" (a read-only or read-write copy volume created from snapshot image(s)). The name is confusing, but I guess the idea is to permanently distinguish clones - always tied to a base volume - from regular volumes. Some other arrays can break the connection with Base Volume, but SANtricity cannot.
- Copy-on-write snapshot capacity isn't taken from some shared free space. It is deducted and fully allocated in the form of "repo" volumes from spare storage capacity when the first snapshot on the volume is created
- Before a volume runs out of reserve capacity, an alert is generated. Admin can choose to add extra capacity or can configure the snapshot group (i.e. per-volume snapshot setting) to automatically purge the oldest snapshot so that a new snapshots can be taken; another choice is to reject writes to the base volume, to keep existing snapshots valid and prevent them from being rotated out.

## Limits 

From the [NetApp TR-4724](https://www.netapp.com/media/17120-tr4724.pdf), page 40:

- Consistency groups (CGs): 64 volumes per group, 32 CGs per system
- Snapshot groups (SGs): 4 SGs per volume, 1024 SGs per system
- Snapshots: 32 per SG, 128 per volume, 2048 per system
- Clones: 4 per volume, 1024 per system

## Thin or thick?

Snapshots consume space from Reserved Capacity which is thick.

If you have a 100 GiB volume and reserve 20% for snapshots, 20G will be thick-reserved; a thick 20 GiB "repo" volume will be created and that capacity "gone".

This volume may have just 3 snapshots that consume 4 GiB of capacity (12 GiB total), but that'd only mean the reserve has 8 GiB of unallocated reserve capacity - it won't make those "unused" 8 GiB available for any other purposes.

Writeable clones are the same.

So, repo capacity occupied by snapshots and clones is "thick", even if it's not fully used. 

When base and snapshot or clone do not differ, almost no reserve capacity is used, so read-only clones and snapshots that don't differ from base volume consume almost no additional capacity.

## How much to reserve for SANtricity snapshots?

[That depends](https://docs.netapp.com/us-en/e-series-santricity/sm-mirroring/why-would-i-change-this-percentage.html), but the default is 40%. 

Maybe you assume daily change is 2% and you want keep 21 days of changes: 42%. 

Or maybe your differential backups grow by 2 GiB per day, and you want to keep around 15 days, so 30-40% could be enough.

If you've created a pair of 100 GiB volumes and, while taking the first snapshot on each, set snapshot reserve to 35%, now 2 * (100 GiB + 35%) is allocated on your pool or volume group (including the base volumes).

It's confusing, in the SANtricity Web UI, that individual clones and snapshots aren't visible under All Capacity, although they do consume capacity. You need to look them up under Reserved Capacity (because that's the capacity they consume). 

But clicking around makes it hard to get the full picture at any point in time, so I strongly recommend building your own dashboard or CLI reporting utility to be able to figure this out. Consider this:

![](/assets/images/eseries-snapshots-23-snapshot-reserved-capacity-by-snapshot.png)

What are we looking at?

It's hard to tell for sure, but it seems this is 16 GiB of (snapshot) reserve capacity in two "reserved" volumes reserved for the snapshot group garbage_SG_01 dedicated to the volume "garbage". 

## What can we do with SANtricity snapshots and clones

Since the API is available and easy to use, it is easy to augment host-side backup scripts with hardware snapshots (application-consistent snapshots), schedule hardware snapshots without the client's awareness (crash-consistent snapshots), or create Dev/Test workflows (snapshot, clone, mount).

### Use case 1: plain old snapshots 

This is about using SANtricity snapshots just you would use any other storage snapshot: stop or suspend IO, create a snapshot. 

A more conservative variant: use crontab or other scheduler to stop service at midnight, flush pending IO, take a snapshot, start service again, and notify via Slack.

Other times you may suspend the application or freeze filesystem activity. Do whatever the application requires, just insert a call to SANtricity "create snapshot" to take a snapshot between stop/quiesce/freeze and thaw.

Snapshot Consistency Groups work the same way. As an example, a PostgreSQL DB may live on two volumes, data and log. Create a CG and snap both at the same time.

If we have the luxury, we want to use different RAID levels for data and logs. That means either R6 and R1 ([both on the same DDP](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html)) or separate R5 and R1 Volume Groups. 

We plan to keep data on a RAID 5 volume group, and logs on RAID 1. Create these volume groups and volumes.

![](/assets/images/eseries-snapshots-01-initial.png)

With multiple volumes, we may want to create a consistency group to be able to snapshot them together at the same time.

![](/assets/images/eseries-snapshots-02-create-consistency-group.png)

The second step here is to reserve capacity for snapshots. 

I ship PostsgreSQL logs to another site and make daily backups to S3, so all I want from SANtricity is to keep 8 recent snapshots taken at a rate of 1 every hour.

I estimate that to be less than 10% of data size, but I'll reserve 15%.

![](/assets/images/eseries-snapshots-03-reserve-snapshot-capacity-for-consistency-group.png)

Reserving extra reserve capacity isn't wrong, but it's "thick-reserved" and may waste capacity. Reservation capacity can be increased later (see about capacity management, below), so there's a way to fix that if you undershoot.

In Step 3, if I don't want to take care of snapshot deletion, I can set snapshots to rotate after 8 have been taken, so that when the 9th is taken, the oldest is immediately deleted. If you want to script snapshot deletion, you can disable automated snapshot deletion and create own script for that.

At the same time, if I run out of reserved snapshot capacity (15% of each volume's size), I want my production volumes to become read-only rather than continue without periodic snapshots.

![](/assets/images/eseries-snapshots-04-snapshot-settings-for-consistency-group.png)

If you want to schedule snapshots, see Appendix D.

And now snapshots for the group can be created at the same time. You can still take snapshots of individual volumes, too.

![](/assets/images/eseries-snapshots-05-snapshot-individual-vs-consistency-group.png)

Here's an example of a CG snapshot taken that way.

![](/assets/images/eseries-snapshots-06-snapshot-consistency-group-members.png)

### Use case 2: snapshots with anti-ransomware characteristics 

I wrote about it in [this post on using E-Series array for DIY backups with Restic](/2022/04/03/restic-server-netapp-eseries.html).

The idea is:

- Do not store credentials on the client (even if it's accessible and can be executed by only a system administrator)
- Configure E-Series snapshots to be "hard" to delete, and finally...
- Buy enough time make a copy of volume data elsewhere because a snapshot is not a backup

The first objective is to execute snapshots on schedule (defined on the array) or "out-of-band" from a trusted server. Schedule-driven snapshots are safe as long as array is not compromised. If SAML is enabled, the CLI, SDK, REST API are all disabled (see [TR-4853](https://www.netapp.com/media/19404-tr-4853.pdf) for more). Once a schedule is set and SAML enabled, no one can remotely override it or remove it.

If you want to use the API, then setup a server with tight security and use it to run scripts against E-Series clients (to freeze and thaw applications) and storage arrays (to take snapshots). For additional security we can insert an API proxy with additional authentication and authorization between your management server and E-Series API endpoint.

How do we configure snapshots to be "hard" to delete? See Step 3 in snapshot workflow above, or consider this list:

- Uncheck "Enable automatic deletion of snapshots when X snapshots have been created"
  - This is recommended in the case you continue using the API, as the attacker could keep taking snapshots to rotate yours out
  - This is not recommended if you use SAML and snapshots are taken only manually or on fixed schedule defined locally in the Web UI
- Unselect "Purge oldest snapshot image (recommended)" and instead select "Reject writes to base volume (keep snapshot images valid)"
  - This removes the risk of snapshot images being purged as the attacker overwrites empty space while snapshots are being taken. This may be okay if snapshots be shipped off-site or a copy made to S3 with Object Lock
  - This increases the risk of your volume becoming read-only, but there's an alert for low reserved capacity (Web UI, email, SNMP, syslog). This may increase your need to manually prune snapshots if there's no API access, but if snapshots are taken daily, it can be a once-a-week activity that takes 2  minutes to execute.

This doesn't quite give you immutable snapshots, but if you enable SAML and create a snapshot schedule, it's pretty safe. You don't need them to be there forever, you just need them to be there long enough to be backed up to an S3 bucket with Object Lock or WORM (append-only) ALCs.

### Use case 3: Dev/Test and backup offload

"Create snapshot volumes" aka clones is what we can do once we have a snapshot.

A common scenario is to create or re-create (update) clones created from snapshots.

If our Dev/Test hosts are fixed, we can refresh their copy of production data daily by recreating the same snapshot volume from a newer snapshot or on-the-fly (on-demand). The difference is if the production application is running, an on-the-fly snapshot creates a crash-consistent temporary snapshot and (from it) a clone volume, whereas your scheduled and orchestrated snapshots may be application consistent as explained earlier. 

Either way, with the API enabled we'd really have just 3-4 curl commands to run in this entire workflow (assuming hosts can be defined beforehand in the Web UI, and fixed).

To recap, a common workflow for this would be:

- Create on-demand or scheduled snapshot image
- Create clone from snapshot image (or on-the-fly/on-demand) and present clone LUNs to Dev/Test hosts
- Rescan storage controllers, mount clone volume(s) and start using clone data (r/w clones need some reserved capacity, r/o clones do not)
- Optionally, to refresh data using  stop Dev/Tev workload, *disable* a clone in SANtricity, *recreate* it from a newer (or on-demand) snapshot (this will refresh the clone and automatically enable it)

In some clusters you may not be able to access cloned volumes in read-only fashion because volume IDs may collide with existing (production) volume IDs. vSphere commonly requires either a separate cluster, or resignaturing the clone volume (which requires read-write access to the LUN). This isn't E-Series-specific.

You can also deploy a backup utility on your Dev/Test client and run scheduled backup jobs to S3. See [this example with Kopia](/2023/09/03/solidbackup-with-kopia.html) and the Restic post. Not many people know that, but SANtricity had a software utility like that called [NetApp SANtricity Cloud Connector](https://www.netapp.com/media/16957-sb-3994.pdf) integrated with SANtricity. Creating your own wouldn't be easier, but it wouldn't be hard either - it's just a matter of scheduling backup-to-S3 to not run while clone volumes are being refreshed.

Let's see how SANtricity clones (aka "Snapshot volumes") work.

In Snapshot Images create a snapshot or two if you don't have any, and then change to Snapshot Volumes.

Click the Create button, of course.

![](/assets/images/eseries-snapshots-08-create-clones.png)

Pick an object (that is snapshot) to use for the clone.

![](/assets/images/eseries-snapshots-09-create-clone-from-snapshot.png)

In the first step of volume clone wizard, pick some or all volumes from the CG snapshot.

![](/assets/images/eseries-snapshots-10-create-clone-from-snapshot-image-review-snapshot-members.png)

If you don't have any hosts ready yet, you can assign them later. 

Read/write creates a write-able clone which also need some reserved space. 

A read-only clone doesn't need any reserved space (obviously, you won't be able to write to a clone that's read-only and some OS won't even let you mount them).

![](/assets/images/eseries-snapshots-11-create-clone-from-snapshot-image-pick-rw-or-ro.png)

If you don't want to write to a volume but need it to be read-write so that they can be mounted, you can reserve a tiny capacity for the clone, say 1% of volume size.

![](/assets/images/eseries-snapshots-12-create-clone-from-snapshot-image-pick-reservation-for-clone.png)

Set a fullness alert level.

![](/assets/images/eseries-snapshots-13-create-clone-from-snapshot-image-pick-name-and-alert-level.png)

And that's it!

![](/assets/images/eseries-snapshots-14-create-clone-from-snapshot-image-finalized.png)

When you want to refresh a clone, stop using clone volumes on clients, and re-create the clone from the same source (by taking a temporary on-demand snapshot) or from any existing snapshot. 

![](/assets/images/eseries-snapshots-18-clone-from-existing-snapshot-image-or-temp-on-demand-snapshot.png)

Then you can resume using the volume. 

If you refresh your DevTest environment daily, you probably refresh from the latest snapshot which should be easy to automate (reverse-order a list all snapshots, pick the first one and use it to recreate the clone volume).

## Managing reserved capacity

Snapshot reserve holds thick-provisioned snapshot reserve capacity for the base volume. This capacity is provisioned when the first snapshot for the base volume is created, or more correctly when the first Snapshot or Clone Group is created. That then creates a snapshot volume, but even after a snapshot or clone is deleted, the group (and repo volume) will remain.

We can view this in Volumes & Pools > Reserved Capacity tab.

![](/assets/images/eseries-snapshots-16-snapshot-group.png)

Here's an example of 140 GiB in reserved capacity - where you see "Snapshot Group" that's a snapshot group, while "Snapshot Volume" is a clone group. 

![](/assets/images/eseries-snapshots-19-reserved-capacity-total-and-available.png)

Why "group"? 

I think it's called that way because it's a collection of repo volumes, although it doesn't seem that way at first sight - usually there's just one repo volume in a "group".

Not going with the suggested reservation percentage can yield considerable capacity savings. Instead of going from 140 to 180 GiB, the next clone made reserved capacity jump to 148 GiB. (You can also see a "repo" volume here.)

![](/assets/images/eseries-snapshots-20-reserved-capacity-savings.png)

If you move to the main/default "All Capacity" tab, you won't see any clone volumes (isn't that weird?), but you'll see how much capacity the snapshots and clones take up: the 100 GiB pgdata volume occupies 240 GiB because 140 GiB (two screenshots ago, above) is allocated as Reserve Capacity!

![](/assets/images/eseries-snapshots-21-total-capacity-consumption.png)

If you undershoot in terms of reserve capacity, you can increase it. In Reserved Capacity tab, select clone, click on Increase Capacity, and add it as necessary.

![](/assets/images/eseries-snapshots-22-increase-clone-reserved-capacity.png)

"Decrease" works the same way, but you need to delete snapshots or clones that may be using those repo volumes.

Even as all snapshots are deleted (see that 0?), the Snapshot Group created to hold them will persist. That's usually fine, as we already configured it the way we want (in terms of reservation, etc.) and may take another snapshot soon.

![](/assets/images/eseries-snapshots-28-empty-snapshot-group.png)

But if you delete all snapshots from a large Snapshot Group, TBs of capacity may remain stranded. 

In that case remember to delete the group itself in order to release the space. That can be done from the API or Web UI using the same Reserved Capacity tab.

## Consistency groups and data consistency

There are multiple layers to consider:

- Application
- OS and filesystem
- Volumes (in a consistency group) 

What SANtricity Snapshot Consistency Group does is guarantees that all member volumes are snapshot at the same point-in-time.  

To avoid corruption, filesystem needs to be able to recover from crashes (i.e. snapshots) which is what most journal-based filesystems do. And the OS must send IOs in the same order.

If, following a snapshot rollback, filesystem can be mounted, the next step is to start the application. Mosts applications have their own logs that they use for recovery. 

So, the point is Consistency Groups can't guarantee any application can recover under any circumstances. Sometimes, some applications won't be. 

One way OS can improve its and filesystems's odds of survival is to freeze or quiesce IO, but that doesn't guarantee the application "checkpoint" will be able to return to that point in time. But the filesystem may. 

Even when filesystems are concerned, we need to remember that OS freezes volumes one by one, so 8 volumes may be quiesced within 1 millisecond, which can be dangerous when data is striped across them (and it often is striped, rather than concatenated).

If the host has a volume manager (such as LVM) that can freeze volumes host-side, then the task of SANtricity is easier because the responsibility of freezing IO at the same time for the entire LVM is on LVM itself - it's not us writing a script that loops over 12 volumes running the freeze command. 

Even if there's a volume manager that can concurrently suspend IO across multiple volumes, that still doesn't guarantee that the application will be able to recover. It's likely it will, but cannot be guaranteed. 

Long story short:

- To quiesce multiple volumes, it is suggested to use a volume manager to do it 
- Even better, stop the application, quiesce the volumes, take a CG snapshot, and start the application again - for most applications this requires 10-30 seconds of downtime which can be scheduled once a day

If you also take CG snapshots without any "cooperation" from the host, that's fine - most filesystems and applications will recover just fine (RTFM and test it to make sure), but I would try to make sure at least one daily CG snapshot is taken when the application is not running and pending write buffer has been flushed to disk.

## Other confusing details

In reality, "snapshot" and "clone" data is stored in stand-alone "differential volumes" (repos) which contain segments that differ between the base volume and snapshot or clone volume called `repo_*`.

For some reason, repo_* volumes don't appear on the Volumes page. Instead, they appear on Volume Groups and Pools (!) page as if they somehow comprise a big pool or group (they don't; each is a stand-alone thing).

![](/assets/images/eseries-snapshots-27-reserved-capacity-detail.png)

Furthermore, each snapshot or writeable clone group can have multiple volumes (`repo_*`), which happens when the user increases size of reserved capacity for a snapshot group.

These repo volumes belonging to the same group (Snapshot or Clone) seem to be concatenated, so that differential snapshot segments can span multiple repo volumes.

They cannot be removed as long as there's a snapshot or clone that uses volumes. But, it is possible to delete the base volume and leave an ["orphaned" repo volume](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/how-reserved-capacity-works.html#orphaned-reserved-capacity-volumes): thankfully "Reclaim unused capacity" exists to reclaim this stranded capacity.

It is also possible to delete a snapshot and leave the clone (snapshot volume that relied on that snapshot) in Disabled state. I don't know why that is allowed, but it is.

It appears possible to use a different volume group or DDP to store snapshot reserve volume (as long as there's enough capacity on it). While this is convenient, it can be dangerous: say you park your clone data on a group normally controlled by another admin; they could delete their volumes and, seeing that it's void of their volumes, the group or pool and with it your data.

Another odd thing which I discovered is that a range of volume names is reserved: you can't directly create `repo_0000` to `repo_9999`, as those are reserved for reserved capacity volumes. (You can indirectly create them by creating read-write clones, of course). I don't see that documented in the product documentation; users who end up failing to create conflicting names and have automation unexpectedly fail would not be amused.

Last but not least, snapshots can't be deleted out of order! Old school, yes. You have to delete them in ascending order by time created.

## Conclusion

The E-Series API and CLI are easy to use, but it's can be a bit hard to figure out how it all fits together. 

The system-managed repo_ volumes are also used in asynchronous replication which we haven't even discussed in this post.

Appendices below contain some examples of snapshot and Consistency Group-related API methods, to give you an idea of how you may get started.

Nowadays many workloads run in containers and VMs, so it's not necessary to frequently clone E-Series volumes: you can use a [CSI driver](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) to snapshot and/or backup your volumes, and vSphere snapshots to backup VMs on VMFS. 

But, storage snapshots and/or clones are still required for protection from human error, for application-integrated backups, and especially so in bare metal server environments and sometimes can augment CSI and application snapshots. For example:
- Snapshot Consistency Groups lets you take a snapshot of multiple, independent NOSQL volumes at once, either independently of workload, or integrated with application, or as part of a restart cycle
- Snapshot Consistency Groups lets you snapshot filesystems and applications that span multiple volumes
- Snapshots can be used with Kubernetes and clones can be integrated with backup utilities to increase your chances against ransomware attacks

Because snapshots and clones reserve space and take it away from the capacity that can be used for regular volumes, it is important to:
- Not go with the defaults and select a low-reserve percentage for snapshots and clones that do not need it
- [Properly monitor array and repository capacity](/2023/10/12/snapshot-clone-repository-monitoring-in-eseries.html) to avoid surprises. I recently also wrote about [E-Series monitoring with SNMP](/2023/09/17/netapp-e-series-snmp-trap-notifications.html).

While hot snapshots combined with host-side quiesce will work as well as they do anywhere else, for multiple volumes it's recommended to take cold CG snapshots (on idle and flushed volumes), or app- and volume-manager-assisted hot CG snapshot (where application and/or volume manager flush and freeze volumes before CG snapshot is taken on E-Series).

## Appendix A - SANtricity Snapshot Consistency Groups (CG)

To create a snapshot, you need to create a new consistency group.

```raw
curl -X POST "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups" -H  "accept: application/json" -H  "Content-Type: application/json" -d "{  \"name\": \"sean\",  \"fullWarnThresholdPercent\": 90,  \"autoDeleteThreshold\": 4,  \"repositoryFullPolicy\": \"purgepit\",  \"rollbackPriority\": \"medium\"}"
```

Request:

```json
{
  "name": "sean",
  "fullWarnThresholdPercent": 90,
  "autoDeleteThreshold": 4,
  "repositoryFullPolicy": "purgepit",
  "rollbackPriority": "medium"
}
```

Volumes can be added to a CG one by one or in a batch:

- Individually: `/storage-systems/{system-id}/consistency-groups/{cg-id}/member-volumes`
- In a batch: `/storage-systems/{system-id}/consistency-groups/{cg-id}/member-volumes/batch`

Get consistency group(s) from the same system:

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups" -H  "accept: application/json"
```

Response:

```json
[
  {
    "cgRef": "3233343536373839303132343300000000000000",
    "label": "CG_PG1",
    "repFullPolicy": "failbasewrites",
    "fullWarnThreshold": 80,
    "autoDeleteLimit": 6,
    "rollbackPriority": "medium",
    "uniqueSequenceNumber": [
      1
    ],
    "creationPendingStatus": "unknown",
    "name": "CG_PG1",
    "id": "3233343536373839303132343300000000000000"
  }
]
```

Get consistency group volume members. That CG ID comes from the response just above.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups/3233343536373839303132343300000000000000/member-volumes" -H  "accept: application/json"
```

Response:

```json
[
  {
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "volumeId": "3233343536373839303132333800000000000000",
    "volumeWwn": "3233343536373839303132333700000000000000",
    "baseVolumeName": "pg1wal",
    "clusterSize": 16,
    "totalRepositoryVolumes": 1,
    "totalRepositoryCapacity": "1610612736",
    "usedRepositoryCapacity": "5",
    "fullWarnThreshold": 80,
    "totalSnapshotImages": 1,
    "totalSnapshotVolumes": 0,
    "autoDeleteSnapshots": true,
    "autoDeleteLimit": 32,
    "pitGroupId": "3233343536373839303132353200000000000000",
    "repositoryVolume": "3233343536373839303132353000000000000000"
  },
  {
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "volumeId": "3233343536373839303132343100000000000000",
    "volumeWwn": "3233343536373839303132343000000000000000",
    "baseVolumeName": "pg1data",
    "clusterSize": 16,
    "totalRepositoryVolumes": 1,
    "totalRepositoryCapacity": "16106127360",
    "usedRepositoryCapacity": "5",
    "fullWarnThreshold": 80,
    "totalSnapshotImages": 1,
    "totalSnapshotVolumes": 0,
    "autoDeleteSnapshots": true,
    "autoDeleteLimit": 32,
    "pitGroupId": "3233343536373839303132353500000000000000",
    "repositoryVolume": "3233343536373839303132353300000000000000"
  }
]
```

Get volume reference details of an individual CG member volume. CG and Volume ID are obtained from the JSONs above.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups/3233343536373839303132343300000000000000/member-volumes/3233343536373839303132333800000000000000" -H  "accept: application/json"
```

Response:

```json
{
  "consistencyGroupId": "3233343536373839303132343300000000000000",
  "volumeId": "3233343536373839303132333800000000000000",
  "volumeWwn": "3233343536373839303132333700000000000000",
  "baseVolumeName": "pg1wal",
  "clusterSize": 16,
  "totalRepositoryVolumes": 1,
  "totalRepositoryCapacity": "1610612736",
  "usedRepositoryCapacity": "5",
  "fullWarnThreshold": 80,
  "totalSnapshotImages": 1,
  "totalSnapshotVolumes": 0,
  "autoDeleteSnapshots": true,
  "autoDeleteLimit": 32,
  "pitGroupId": "3233343536373839303132353200000000000000",
  "repositoryVolume": "3233343536373839303132353000000000000000"
}
```

## Appendix B - Snapshots

### Stand-alone volume snapshot

Get list of snapshot images.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-images" -H  "accept: application/json"
```

This response is deliberately long to illustrate a point: one of the snapshots is tied to a volume that's a CG member, *but* it was taken as stand-alone. Therefore it has consistencyGroupId=null.

```json
[
  {
    "pitRef": "3233343536373839303132383200000000000000",
    "pitGroupRef": "3233343536373839303132353200000000000000",
    "creationMethod": "user",
    "pitTimestamp": "1696332850",
    "pitSequenceNumber": "4",
    "status": "optimal",
    "activeCOW": true,
    "isRollbackSource": false,
    "pitCapacity": "209715200",
    "repositoryCapacityUtilization": "5",
    "baseVol": "3233343536373839303132333800000000000000",
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "id": "3233343536373839303132383200000000000000"
  },
  {
    "pitRef": "3233343536373839303132383100000000000000",
    "pitGroupRef": "3233343536373839303132383000000000000000",
    "creationMethod": "user",
    "pitTimestamp": "1696332717",
    "pitSequenceNumber": "3",
    "status": "optimal",
    "activeCOW": true,
    "isRollbackSource": false,
    "pitCapacity": "209715200",
    "repositoryCapacityUtilization": "5",
    "baseVol": "3233343536373839303132333800000000000000",
    "consistencyGroupId": null,
    "id": "3233343536373839303132383100000000000000"
  },
  {
    "pitRef": "3233343536373839303132383300000000000000",
    "pitGroupRef": "3233343536373839303132353500000000000000",
    "creationMethod": "user",
    "pitTimestamp": "1696332850",
    "pitSequenceNumber": "4",
    "status": "optimal",
    "activeCOW": true,
    "isRollbackSource": false,
    "pitCapacity": "209715200",
    "repositoryCapacityUtilization": "5",
    "baseVol": "3233343536373839303132343100000000000000",
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "id": "3233343536373839303132383300000000000000"
  }
]
```

Get list of "snapshot volumes" (i.e. clones).

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-volumes" -H  "accept: application/json"
```

Response:

```json
[
  {
    "viewRef": "3233343536373839303132363000000000000000",
    "worldWideName": "3233343536373839303132363100000000000000",
    "baseVol": "3233343536373839303132333500000000000000",
    "basePIT": "3233343536373839303132353800000000000000",
    "boundToPIT": true,
    "accessMode": "readWrite",
    "label": "pg_SV_0003",
    "status": "optimal",
    "currentManager": "070000000000000000000002",
    "preferredManager": "070000000000000000000002",
    "repositoryVolume": "3233343536373839303132363500000000000000",
    "fullWarnThreshold": 75,
    "viewTime": "1696347108",
    "viewSequenceNumber": "2",
    "perms": {
      "mapToLUN": true,
      "snapShot": false,
      "format": false,
      "reconfigure": false,
      "mirrorPrimary": false,
      "mirrorSecondary": false,
      "copySource": false,
      "copyTarget": false,
      "readable": true,
      "writable": true,
      "rollback": false,
      "mirrorSync": false,
      "newImage": false,
      "allowDVE": false,
      "allowDSS": false,
      "concatVolumeMember": false,
      "flashReadCache": false,
      "asyncMirrorPrimary": false,
      "asyncMirrorSecondary": false,
      "pitGroup": false,
      "cacheParametersChangeable": false,
      "allowThinManualExpansion": false,
      "allowThinGrowthParametersChange": false,
      "allowImportTarget": false
    },
    "volumeHandle": 12,
    "clusterSize": 0,
    "maxRepositoryCapacity": "0",
    "unusableRepositoryCapacity": "0",
    "membership": {
      "viewType": "individual",
      "cgViewRef": null
    },
    "mgmtClientAttribute": 0,
    "offline": false,
    "extendedUniqueIdentifier": "",
    "volumeFull": false,
    "repositoryCapacity": "42949672960",
    "baseVolumeCapacity": "107374182400",
    "totalSizeInBytes": "209715200",
    "consistencyGroupId": null,
    "volumeCopyTarget": false,
    "cloneCopy": false,
    "volumeCopySource": false,
    "pitBaseVolume": false,
    "asyncMirrorTarget": false,
    "asyncMirrorSource": false,
    "protectionType": "type1Protection",
    "remoteMirrorSource": false,
    "remoteMirrorTarget": false,
    "objectType": "pitView",
    "wwn": "3233343536373839303132363100000000000000",
    "listOfMappings": [],
    "mapped": false,
    "currentControllerId": "070000000000000000000002",
    "preferredControllerId": "070000000000000000000002",
    "onlineVolumeCopy": false,
    "name": "pg_SV_0003",
    "id": "3233343536373839303132363000000000000000"
  },
  {
    "viewRef": "3233343536373839303132363700000000000000",
    "worldWideName": "3233343536373839303132363800000000000000",
    "baseVol": "3233343536373839303132333500000000000000",
    "basePIT": "3233343536373839303132353900000000000000",
    "boundToPIT": true,
    "accessMode": "readOnly",
    "label": "pg_SV_0004",
    "status": "optimal",
    "currentManager": "070000000000000000000002",
    "preferredManager": "070000000000000000000002",
    "repositoryVolume": "0000000000000000000000000000000000000000",
    "fullWarnThreshold": 75,
    "viewTime": "1696347199",
    "viewSequenceNumber": "3",
    "perms": {
      "mapToLUN": true,
      "snapShot": false,
      "format": false,
      "reconfigure": false,
      "mirrorPrimary": false,
      "mirrorSecondary": false,
      "copySource": false,
      "copyTarget": false,
      "readable": true,
      "writable": false,
      "rollback": false,
      "mirrorSync": false,
      "newImage": false,
      "allowDVE": false,
      "allowDSS": false,
      "concatVolumeMember": false,
      "flashReadCache": false,
      "asyncMirrorPrimary": false,
      "asyncMirrorSecondary": false,
      "pitGroup": false,
      "cacheParametersChangeable": false,
      "allowThinManualExpansion": false,
      "allowThinGrowthParametersChange": false,
      "allowImportTarget": false
    },
    "volumeHandle": 12,
    "clusterSize": 0,
    "maxRepositoryCapacity": "0",
    "unusableRepositoryCapacity": "0",
    "membership": {
      "viewType": "individual",
      "cgViewRef": null
    },
    "mgmtClientAttribute": 0,
    "offline": false,
    "extendedUniqueIdentifier": "",
    "volumeFull": false,
    "repositoryCapacity": "0",
    "baseVolumeCapacity": "107374182400",
    "totalSizeInBytes": "209715200",
    "consistencyGroupId": null,
    "volumeCopyTarget": false,
    "cloneCopy": false,
    "volumeCopySource": false,
    "pitBaseVolume": false,
    "asyncMirrorTarget": false,
    "asyncMirrorSource": false,
    "protectionType": "type1Protection",
    "remoteMirrorSource": false,
    "remoteMirrorTarget": false,
    "objectType": "pitView",
    "wwn": "3233343536373839303132363800000000000000",
    "listOfMappings": [],
    "mapped": false,
    "currentControllerId": "070000000000000000000002",
    "preferredControllerId": "070000000000000000000002",
    "onlineVolumeCopy": false,
    "name": "pg_SV_0004",
    "id": "3233343536373839303132363700000000000000"
  }
]
```

The second item, pg_SV_0004, is a read-only clone: accessMode=readOnly, repositoryCapacity=0, and perms.writable=false.

View repository utilization by a clone ("snapshot volume"): get `id` from `GET snapshot-volumes` and query its repository utilization like so:

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-volumes/3233343536373839303132363000000000000000/repository-utilization" -H  "accept: application/json"
```

Response:

```json
{
  "viewBytesUsed": "11166914969",
  "viewBytesAvailable": "31782757991",
  "viewRef": "3233343536373839303132363000000000000000"
}
```

Without any specific clone ID in mind, we could query repository utilization for all clones.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-volumes/repository-utilization" -H  "accept: application/json"
```

There's a full example further below.

### Consistency Group snapshot

This is straightforward and requires just the CG ID to create it.

```raw
curl -X POST "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups/3233343536373839303132343300000000000000/snapshots" -H  "accept: application/json" -d ""
```

Get CG snapshot number aka "sequenceNumber" in Swagger I used was 1 (at the end of URL). 

There are no numbers in the Web UI, we just "know" it's the first i.e. oldest. It seems in the API that is `pitSequenceNumber`.

The other two inputs are System ID and CG ID.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups/3233343536373839303132343300000000000000/snapshots/1" -H  "accept: application/json"
```

Response:

```json
[
  {
    "pitRef": "3233343536373839303132353600000000000000",
    "pitGroupRef": "3233343536373839303132353200000000000000",
    "creationMethod": "user",
    "pitTimestamp": "1696331249",
    "pitSequenceNumber": "1",
    "status": "optimal",
    "activeCOW": true,
    "isRollbackSource": false,
    "pitCapacity": "209715200",
    "repositoryCapacityUtilization": "5",
    "baseVol": "3233343536373839303132333800000000000000",
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "id": "3233343536373839303132353600000000000000"
  },
  {
    "pitRef": "3233343536373839303132353700000000000000",
    "pitGroupRef": "3233343536373839303132353500000000000000",
    "creationMethod": "user",
    "pitTimestamp": "1696331249",
    "pitSequenceNumber": "1",
    "status": "optimal",
    "activeCOW": true,
    "isRollbackSource": false,
    "pitCapacity": "209715200",
    "repositoryCapacityUtilization": "5",
    "baseVol": "3233343536373839303132343100000000000000",
    "consistencyGroupId": "3233343536373839303132343300000000000000",
    "id": "3233343536373839303132353700000000000000"
  }
]

```

### Rollback (recovery)

We need:

- SystemID
- VolumeID or CG ID (if there's a CG that we want to roll back)
- Snapshot ID (1, 2, etc.) - to restore the latest, get all snapshots and pick the first from a list of snapshots descending-sorted by datetime or pitSequenceNumber

On the clients, if the source volume(s) is/are in use, stop the application and unmount the filesystem(s).

Restore snapshot 2 for CG 2A000000600A098000F6371400872B1E651CDD1B:

```raw
curl -X POST "https://127.0.0.1:8443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/consistency-groups/2A000000600A098000F6371400872B1E651CDD1B/snapshots/2/rollback" -H  "accept: application/json" -d ""
```

Response: if rollback successfully starts, you'll get a `204` (Rollback Started).

This should take a short time, but you can time it once or twice to estimate how much to wait, if at all, before you can mount volumes and start using them again.

## Appendix C - Repository utilization

Repository is a global pool which stores snapshot-related data objects.

```raw
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-volumes/repository-utilization" -H  "accept: application/json"
```

Response:

```json
[
  {
    "viewBytesUsed": "7301444403",
    "viewBytesAvailable": "35648228557",
    "viewRef": "3233343536373839303132363000000000000000"
  },
  {
    "viewBytesUsed": "0",
    "viewBytesAvailable": "0",
    "viewRef": "3233343536373839303132363700000000000000"
  },
  {
    "viewBytesUsed": "6871947673",
    "viewBytesAvailable": "1717986919",
    "viewRef": "3233343536373839303134363100000000000000"
  },
  {
    "viewBytesUsed": "4552665333",
    "viewBytesAvailable": "4037269259",
    "viewRef": "3233343536373839303132363900000000000000"
  }
```

Notice a clone volume that uses 0 bytes. That's a read-only clone.

We want to check this from time to time in order to avoid getting "low reserve capacity" alerts or worse.

## Appendix D - Snapshot schedule

If you automate provisioning or run DevOps workflows, you may want to create schedules via the API.

The easiest way to do it is first create it manually.

![](/assets/images/eseries-snapshots-15-create-snapshot-schedule.png)

Then see what it looks like in the JSON format.

```
curl -X GET "https://127.0.0.1:48443/devmgr/v2/storage-systems/7F0000011E1E1E1E1E1E1E1E1E1E1E1E/snapshot-schedules" -H  "accept: application/json"
```

Response with a schedule that runs Mon-Fri with 4 snapshots per day (one every 6 hours). They're scheduled to start Oct 03, 2023, 12:00AM (GMT) and have no end date. There can be only one schedule per volume or CG.

```json
[
  {
    "schedRef": "3233343536373839303133303100000000000000",
    "scheduleStatus": "active",
    "action": "newcgpit",
    "targetObject": "3233343536373839303132383800000000000000",
    "schedule": {
      "calendar": {
        "scheduleMethod": "weekly",
        "daily": null,
        "weekly": {
          "daysOfWeek": [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday"
          ],
          "dailySchedule": {
            "timeOfDay": 0,
            "everyNMinutes": 360,
            "timesPerDay": 4
          }
        },
        "monthlyByDate": null,
        "monthlyByDay": null
      },
      "startDate": "1696291200",
      "recurrence": {
        "recurrenceType": "unlimited",
        "recurrenceCount": 0,
        "recurrenceEndDate": "0"
      },
      "timezone": {
        "tzLabel": "Etc/GMT",
        "tzOffset": 0,
        "dstStart": {
          "time": 0,
          "clockMode": "unknown",
          "month": 0,
          "dayOfMonth": 0,
          "dayOfWeek": 0
        },
        "dstEnd": {
          "time": 0,
          "clockMode": "unknown",
          "month": 0,
          "dayOfMonth": 0,
          "dayOfWeek": 0
        },
        "dstAdjust": 0
      }
    },
    "creationTime": "1696334181",
    "lastRunTime": "0",
    "nextRunTime": "1696348800",
    "stopTime": "0",
    "id": "3233343536373839303133303100000000000000"
  }
]
```

## Appendix E - CG rollback from snapshot with MinIO Single-Node Multi-Drive

This walk-through shows a single MinIO server with multiple E-Series volumes, aka SNMD. 

The same would apply to multi-node multi-drive. I've blogged about MinIO with E-Series several times, so you can see some of those other posts if you're interested.

I have 8 LUNs presented to a MinIO server, so my CG has 8 members. I set the limit of snapshots to 4 as I don't need/want more and don't want to reserve a lot of capacity for this.

![](/assets/images/eseries-snapshots-24-minio-cg.png)

Stop MinIO, flush IO, create a CG snapshot, start MinIO. This takes just several seconds.

![](/assets/images/eseries-snapshots-25-minio-cg-snapshot.png)

To rollback, the same as earlier, I stop MinIO, unmount the 8 disks and rollback in SANtricity. If the amount of data to roll back was in TBs I could have increased the priority to High or more.

![](/assets/images/eseries-snapshots-25-minio-cg-rollback.png)

Depending on the amount of data, this can take between 1s and many seconds.

![](/assets/images/eseries-snapshots-26-minio-cg-rollback.png)

Remount the volumes, start MinIO. 

*If* you nicely shut down MinIO and flushed pending writes, there will be no filesystem "fsck"-style recovery (automatic or manual) required, and no lost objects from MinIO perspective either.

On the other hand, *if* everything was running and clients were uploading objects when the CG snapshot was taken:

- Filesystem would likely have to do some recovery and drop the most recent not fully committed filesystem transactions
- MinIO's erasure coding [chunks objects across all volumes](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html) and would likely lose some objects too (despite EC, as all volumes could potentially lose some transactions - even with EC 6+2, if 3 volumes roll back some filesystem transactions, then MinIO could lose some objects).

As MinIO with E-Series can upload [hundreds of objects per second](/2022/10/21/minio-performance-netapp-e-series.html), and OS write buffer is flushed periodically, hundreds of objects could be lost [1].

Generic S3 vendor's recommendation is to not make backups: replicate objects to another S3 and you'll be fine! But I know people sometimes need to backup S3 volumes.

Or, if you follow that S3 vendor advice, you can use CG with the replica S3 server: maybe you have a cluster of MinIO servers on Production site, but just one MinIO server connected to E-Series on DR site. If you stop S3 service at the DR site, flush IO, and create a CG snapshot, you can have a perfectly consistent multi-volume snapshot with less than 20 seconds of non-production downtime.

--

[1] Losing 500 of the most recently uploaded objects in some generic Web application isn't a big deal, as long as PBs of existing S3 data is properly preserved. Secondly, consider the difference between thees two snapshots:
- Completely consistent, taken at 1:03 pm
- Crash-consistent, taken at 1:05 pm

The former is theoretically "better", but the latter is more complete and in some cases users want the latter. If you want to avoid the risk of filesystem corruption, it's better to use the former. If every minute of lost data costs millions, maybe you want the latter (assuming you know filesystem and application recoverability from crash-consistent snapshots is decent).
