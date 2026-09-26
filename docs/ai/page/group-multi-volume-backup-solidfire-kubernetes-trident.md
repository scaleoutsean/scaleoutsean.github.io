# Protect multi-PVC Kubernetes apps with NetApp Trident, SolidFire

Snapshot, backup and restore multi-volume Kubernetes applications on NetApp SolidFire

- [Introduction](#introduction)
- [Cold multi-volume backup without snapshots](#cold-multi-volume-backup-without-snapshots)
- [Group Snapshot-assisted multi-volume backup](#group-snapshot-assisted-multi-volume-backup)
  - [Backup multi-volume snapshot to S3 with built-in backup-to-S3](#backup-multi-volume-snapshot-to-s3-with-built-in-backup-to-s3)
  - [Using other methods to backup data from storage snapshots](#using-other-methods-to-backup-data-from-storage-snapshots)
- [Application-integrated backups](#application-integrated-backups)
- [Application-consistent snapshots vs. multi-volume storage snapshots](#application-consistent-snapshots-vs-multi-volume-storage-snapshots)
  - [Injecting storage snapshot into application-aware workflows](#injecting-storage-snapshot-into-application-aware-workflows)
- [Sub-volume partitioning and other tricks](#sub-volume-partitioning-and-other-tricks)
- [Conclusion](#conclusion)

## Introduction

Recently I [wrote](/2023/02/10/backup-epa-data-on-kubernetes.html) about the challenge of backing up multi-volume databases: in enterprise SAN environments that's usually addressed by "consistency group" snapshots: 

- Freeze/suspend or stop application I/O
- Take a snapshot of all volumes involved (e.g. data volume, log volume)

Then such snapshots can be mounted and backed up, or replicated to another location.

SolidFire supports consistency groups, but NetApp Trident (and maybe even Kubernetes CSI) doesn't have a way of interacting with them. 

We can't, for example, tell Kubernetes "volumes 121, 122 and 125 belong to consistency group SQL01".

We also can't tell Kubernetes "backup volumes 121, 122 and 125 at the same time". If snapshots are executed sequentially, or maybe not in a guaranteed order, results may be unpredictable. 

And of course, because Kubernetes has no idea about the concept of volume consistency groups, even if we created one manually after volumes 121, 122 and 125 have been created, we couldn't directly access it from Kubernetes.

## Cold multi-volume backup without snapshots

This isn't specific to SolidFire - it should work the same way with other CSI storage when snapshots are taken without CSI - but one basic approach is to scale our deployment down to 0, i.e. stop the application, and then backup a single set of volumes.

That means a short downtime, of course.

To make that downtime shorter, we could [temporarily adjust](/2020/11/28/powershell-set-sfqosexception.html) the volumes' QoS setting to a high value such as 50,000 IOPS, and restore the original QoS setting or policy after backup is complete. A higher QoS limit would allow backup to work faster, making backup time shorter.

As far as backup utilities and applications are concerned, most of them support custom before/after actions. 

Kanister - I've blogged about it before - has [functions](https://docs.kanister.io/functions.html#preparedata) that can create such simple workflows.

> The typical sequence is to stop the application using ScaleWorkload, perform the data manipulation using PrepareData, and then restart the application using ScaleWorkload.

```raw
- func: ScaleWorkload
  name: ShutdownApplication
  args:
    namespace: ""
    name: ""
    kind: deployment
    replicas: 0
- func: PrepareData
  name: ManipulateData
  args:
    namespace: ""
    image: busybox
    volumes:
      application-pvc-1: "/data"
      application-pvc-2: "/logs"
      application-pvc-3: "/backup"
    command:
      - sh
      - -c
      - |
        rsync -av /data/ /backup/data
        rsync -av /logs/ /backup/logs
# Now backup PVC-3 (not shown) and scale up to 1
- func: ScaleWorkload
  name: StartApplication
  args:
    namespace: ""
    name: ""
    kind: deployment
    replicas: 1
```

We scale the deployment to zero, copy data and logs to the third volume and backup that third volume (mounted at /backup).

At (say) 500 MB/s, a 100 GB database could be backed up in under 5 minutes of scheduled downtime. That's not too bad for small applications that don't need to run 24x7.

After backup is done, we could delete all files in /backup/ because we use overwrite that directory every time we run that backup, and we don't want to waste capacity. But:

- in the case the rsync command is modified to overwrite only changed files, we'd save time that way and then it'd be useful to leave that data there
- some DBAs like to have a copy of their data handy (DB dump, not necessarily mounted)
- having a second copy of all DB data may deduplicate reasonably well and end up consuming very little data capacity

So there are situations where we could leave that data there. And on this topic, I found [this](https://docs.kasten.io/5.5.6/kanister/mssql/install.html#known-limitations) detail related to Kanister's MS SQL blueprint: 

> the backup process in the Kanister Blueprint creates the temporary database backup files in the same volume as the database. Due to this, it is necessary to use a PVC at least twice the size of the database.

So it wouldn't be just your DIY backup that doesn't make wasteful backups - others do it, too! At least an uncompressed rsync copy would't take much extra space (whereas real dumps to disk don't dedupe well against database data.)

## Group Snapshot-assisted multi-volume backup

Now that we know how to use that function, we can sneak into it anything we want. Such as taking a snapshot of the entire volume group.

We could build an image with SolidFire CLI (or PowerShell, etc.) to do that. A spartan version could use curl. To use SolidFire CLI (sfcli), we'd need a Python container with `solidfire-cli` module and its dependencies.

```raw
- func: PrepareData
  name: ManipulateData
  args:
    namespace: ""
    # you'd have to create your own
    image: docker.io/scaleoutsean/solidfire-cli:latest
    volumes:
      application-pvc-1: "/data"
      application-pvc-2: "/logs"
    command:
      - sh
      - -c
      - |
        sfcli snapshot creategroup --volumes 121,122 -name sql01 --retention 02:00:00
```

That calls `CreateGroupSnapshot` method which creates a (consistency) group snapshot of volumes with IDs 121 and 122, and retains it for two hours.

We can scale a deployment down to zero (or just enter a hot backup mode in the application), take a snapshot of the volumes, and scale back to the original value. Now our downtime is very short - probably less than 30 seconds. 

Downsides? The first is Kasten or Velero don't know anything about SolidFire snapshots taken without Kubernetes' **CSI** snapshotter. We'd have to make use of that storage snapshot on our own.

### Backup multi-volume snapshot to S3 with built-in backup-to-S3

We know this group snapshot's name is `sql01`, but SolidFire may have several such group snapshots with different group snapshot IDs. But given that we keep such snapshots for 2 hours and users tend to give applications unique names, it's unlikely that we'd actually find multiple snapshots with the same name.

To be on the safe side we'd use the most recent one. An even safer approach - maybe not necessary - would be to record the snapshot ID returned to `sfcli` and send a Web hook request to a scheduler to schedule a backup - maybe SolidFire's built-in backup to S3 - with volume and snapshot IDs.

Thinking about this I realized I didn't recall that SolidFire's backup to S3 feature could refer to group snapshot IDs. Hmmm, that's something we should check.

First I checked the backup-to-S3 API method - only snapshot IDs, not group snapshot IDs, were supported. Ouch.

Then I poked around the Web UI and realized - it took me only six or so years to figure this out - that a group snapshot's "member snapshots" can be referenced by their ID. Wow!

As a reminder, this is how they can be created from the Web UI ("archive" screenshot taken some time ago):

![Create SolidFire group snapshot](/assets/images/solidfire-group-snapshot.png)

What this returns is a group snapshot ID. If we look for the constituent volume snapshots, they're not there.

![List SolidFire volume snapshots](/assets/images/solidfire-group-snapshots-01.png)

Instead, group snapshots are listed in here, without any individual snapshot IDs:

![List SolidFire group snapshots](/assets/images/solidfire-group-snapshots-02.png)

I hadn't noticed - since 2016 until now - that the constituent snapshots are listed here and that snapshot IDs are available. 

![List group group member snapshots](/assets/images/solidfire-group-snapshots-03.png)

I mean, I did click on the link below `"# of volumes"` on that page, but didn't notice that snapshot volume IDs were there. So, we can use the usual method to Backup to S3, after all! 

```python
from solidfire.factory import ElementFactory
sfe = ElementFactory.create('192.168.105.32', 'admin', '*****************', verify_ssl=False, print_ascii_art=False)
# prepare params and run backup to S3 in the native format for volume ID 201, snapshot ID 324
sfe.start_bulk_volume_read(201,"native", snapshot_id=324, script="bv_internal.py", script_parameters=params)
# prepare params for volume ID 202, Snapshot ID 325
# ...
```

I tried to back-up these to S3 [using the SolidFire API](/2021/04/21/solidfire-backup-to-s3.html#backup-using-the-api-powershell-or-python), and it worked as one would expect from a "stand-alone" volume snapshot being backed up to S3. 

If executed from a script, `"start_bulk_volume_read"` returns an async handle, key, and management IP of the SolidFire *node* (not cluster's virtual management IP) running this backup job, like so:

```python
StartBulkVolumeReadResult(async_handle=134, key='b26292dc52425ac93c7f5d84a7c6fae3', url='https://192.168.1.31:8443/')
```

We'd just need to watch for failures and retry (or alert) if any. For large backups (say, TiB-sized volumes) we'd need to retain group snapshots longer than one hour. If you want to retry without having to take another snapshot, set longer retention, say twice the time required to backup. 

Each group snapshot can be deleted if backup completes, so that snapshots don't linger longer than necessary. Although - if there are no other snapshots for short term-retention - it's a good idea to keep the most recent one or two, just in case.

The second major downside of doing ad-hoc backups is that some backups are in Velero, Kasten or whatever else you use, and some elsewhere. That's usually a bad idea from a governance and management perspective.

### Using other methods to backup data from storage snapshots

Fortunately, it's not mandatory to use SolidFire's built-in Backup to S3 to transfer snapshot data out.

Once you have a snapshot, you can clone those volumes and do with them whatever you want.

We could create a new namespace (say, `backup`) and:

- Use SolidFire CLI or API to clone those snapshots
- Use `tridentctl` to import cloned volumes and access them from a dummy pod, and 
- Use Kasten or containerized [Kopia](/2023/09/03/solidbackup-with-kopia.html) or Velero to make a backup (which would be consistent, considering there's no application that's using any of the data). You'd just backup one resource, the PV(C) itself. Since all of them can restore data to a different name space, any restore action could work directly to your application namespace.

Because PVC backups *can* be restored to another namespace, this would still work reasonably well for many use cases. And all your snapshots and backups would be managed by the same application.

## Application-integrated backups

It is often forgotten - particularly among the "storage-focused IT people" - that many modern databases have decent CLIs and APIs that not only enable application-side snapshots, but also take care of database consistency, incremental backup and more.

An example of this can be found in [this post about logical backups in Kasten](/2021/09/09/kasten-v4-with-solidfire-logical-and-snapshot-assisted-data-protection.html). These are storage-independent and although they can be less efficient and consume more resources, they have their advantages.

In this case there's no multi-volume storage snapshot, though. You'd simply backup your application to S3, for example. (You could also take a storage-assisted CSI snapshot, but wouldn't backup data from snapshots - such snapshots could be rotated daily and serve as a quick way to recover data without restoring from S3, for example.)

## Application-consistent snapshots vs. multi-volume storage snapshots

Application-side snapshots (MS SQL has them, for example) don't employ storage snapshots. Such snapshots can often be accessed on "hot" database and used to perform a backup (see logical backups just above).

Scripts that put an application in a crash-consistent state (there's a bunch of examples on the Internet, including Kanister, [Verda](https://github.com/NetApp/Verda), etc.) don't deliver application backups, but prepare applications for a storage snapshot - in that sense they are more similar to `fsfreeze` (which freezes a filesystem), only - unlike `fsfreeze` - works on the application layer. Kasten/Kanister users can see the details [here](https://docs.kasten.io/5.5.6/kanister/testing.html#application-consistent-backups).

[Here](/2024/03/23/velero-netapp-verda-scripts-and-trident.html) you can see how NetApp Verda can be used with Velero to create application-consistent snapshots and backups.

### Injecting storage snapshot into application-aware workflows

Let's say we have two volumes, DATA and LOG. Using `fsfreeze` we'd freeze both volumes, and take a storage snapshot which would give us a crash-consistent group snapshot. 

When using a database-aware script, we'd lock the DB to prevent updates, maybe enter full-archive (log) mode (for an online snapshot or backup) or detach a DB (for an offline snapshot or backup), and optionally also run `fsfreeze` to prevent filesystem changes during that time. Then we would take an application-aware multi-volume snapshot, and return to normal online mode.

As `fsfreeze` requires privileged containers, it's less likely that `fsfreeze` will grow in popularity. It may be possible to coordinate this from the worker - freeze from the worker, take a snapshot in Kubernetes - but this is complex and every time we'd need to find out which worker is hosting the pod(s), ensure the workers' OS clocks are very precise, and potentially run jobs on multiple workers. I doubt that would work well!

Using Kanister, Kasten or [Velero snapshot hooks](/2024/03/22/velero-trident-backup-job-details.html) we can take a multi-volume storage snapshot that's independent of logical backup to S3, NFS or elsewhere. [This example](https://docs.kasten.io/5.5.6/kanister/postgresql/install_app_cons.html#application-consistent-postgresql-backup) shows how to perform application-specific backup (with PostgreSQL, in this case). We could add a hook for storage snapshot that runs in addition to classic logical backup. 

What that would do is create backups externally as it normally does, but also SolidFire group snapshots that Kanister/Kasten aren't aware of. But they would still be very useful. Why? We'd know that each such backup has an application-aware backup, but also a hardware-based multi-volume snapshot (with retention of say 24 hours). To restore data, we could use whichever is available and better:

- If our application was deleted by mistake (and with it our storage snapshots as well), we'd restore data from S3/NFS/etc.
- If we mistakenly deleted a table, we'd scale our deployment to zero, use the SolidFire API or CLI or Web UI to revert the group snapshot.

This isn't perfect - we still need to use a separate interface to restore a snapshot, but this step could be [included in pre-restore hooks](https://docs.kasten.io/5.5.6/kanister/hooks.html) - that would make it easier to execute it, but it wouldn't make it easier to switch between approaches (restore from an exported backup, or from a storage multi-volume snapshot).

## Sub-volume partitioning and other tricks

One common trick for the lack of consistency group snapshot support is to partition a volume, so that we have something like this:

- 0 to 512MiB - data
- 512MiB+1byte to 1,024 MiB - logs

In the case of 4kiB blocks (SolidFire LUNs), 0-131072 blocks (512MiB) would be the data partition.

Then you have two filesystems on the same disk (or "LUN"), and a single snapshot would be done without multi-volume considerations.

And we could try to modify the range values in SolidFire's backup to S3 call (262144 x 4KiB = 1GiB).

```json
{
  "id": 1,
  "method": "StartBulkVolumeRead",
  "params": {
    "volumeID": 201,
    "format": "native",
    "snapshotID": 324,
    "script": "bv_internal.py",
    "scriptParameters": {
      "range": {
        "lba": 0,
        "blocks": 262144
        }
        }
    }
}
```

For example, `lba: 0, blocks: 131072` would read the first 512MiB, and (maybe, I haven't tried), `lba: 1, blocks: 131072` would read the last 512 MiB.

But even if that worked for backup, Trident CSI can only use non-partitioned volumes, so that's out of the question and that trick from physical and VM world doesn't look viable with Kubernetes. 

Other CSI drivers - such as [TopoLVM](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) - use LVM so may be able to snapshot multiple volumes allocated on the same worker as a group, but still wouldn't work for volumes allocated from different physical disks (for example, a NOSQL deployment with pods on three workers, each using a different LVM group.)

## Conclusion

When application data spans multiple volumes, snapshots must consider the effect of such data layout and data-to-storage mapping.

Merely hoping that crash-consistent application snapshot will work may not be enough to guarantee a trouble-free restore: yes, data would be crash-consistent, but snapshots may be taken with millisecond delays potentially resulting in inconsistencies among volumes.

Kanister - and by extension Kasten - can be used to create application-consistent cold backups at the cost of some downtime. 

SolidFire group snapshots can be used in pre-backup scripts, but we should check if the application (and potentially the filesystem) can be quiesced/frozen, so that these snapshots and their backups can be restored without a problem.
