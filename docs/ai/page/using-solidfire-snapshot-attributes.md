# Using snapshot attributes in SolidFire

Improve SolidFire snapshot workflows with snapshot attributes

- [Snapshot attributes in SolidFire](#snapshot-attributes-in-solidfire)
- [Hashtable example](#hashtable-example)
- [Snapshot with attributes](#snapshot-with-attributes)
- [Using snapshot attributes](#using-snapshot-attributes)
- [Conclusion](#conclusion)

## Snapshot attributes in SolidFire

When we create a SolidFire snapshot from the Web UI, we see something like this:

![SolidFire create Snapshot dialog](/assets/images/solidfire-snapshot-create-01.png)

That's not all there is to it. The API allows us to tag snapshots with a hashtable. 

If we use a CLI or the API, we can take advantage of that to improve storage management workflows such as backup.

## Hashtable example

Let's say we always have 10-20 "general use" snapshots lying around, but we have one specific workflow that replicates certain volumes to the cloud (say, Digital Ocean, which works [very well](/2021/11/30/digital-ocean-volume-to-solidfire-volume-and-back.html)). 

Or perhaps once a week we backup certain volumes to Wasabi.

We can assign snapshot attributes to that "special use" snapshot.

```powershell
$hashtable = @{ Backup2S3 = ‘Y’; CG = ‘2’}
```
- Mark the snapshot for backup to S3
- Indicate that snapshot is part of Consistency Group 2 (so that, having a database that uses volume ID 14 for database tables, and volume ID 15 for transaction log), we take both at the exact same time

Group snapshots are taken like this

```powershell
New-SFGroupSnapshot -VolumeID 14,15 -Attributes $hashtable

GroupSnapshotID         : 4
GroupSnapshotUUID       : d2962b6c-56c7-46f9-8549-8f0903374fd3
Members                 : {2023-04-01T05:29:11Z, 2023-04-01T05:29:11Z}
Name                    : 2023-04-01T05:29:11Z
CreateTime              : 2023-04-01T05:29:11Z
Status                  : done
EnableRemoteReplication : False
RemoteStatuses          : 
Attributes              : {[CG, 2], [Backup2S3, Y]}
```

We have two member snapshots, named 2023-04-01T05:29:11Z and 2023-04-01T05:29:11Z, respectively. Why? See the screenshot above.

Because we didn't give them a name and the default name is UTC time. 

And because it's a group snapshot, they are taken at the same time so the names are identical. Just for fun, let's take another:

```powershell
New-SFGroupSnapshot -VolumeID 14,15 -Attributes $hashtable -Name jff

GroupSnapshotID         : 5
GroupSnapshotUUID       : ab69a95f-eef1-492f-b863-0ae33e26a56b
Members                 : {jff, jff}
Name                    : jff
CreateTime              : 2023-04-01T05:30:43Z
Status                  : done
EnableRemoteReplication : False
RemoteStatuses          : 
Attributes              : {[CG, 2], [Backup2S3, Y]}
```

We can distinguish them by GroupSnapshotID. 

In a second case, it's 5:

```powershell
Get-SFGroupSnapshot -GroupSnapshotID 5

GroupSnapshotID         : 5
GroupSnapshotUUID       : ab69a95f-eef1-492f-b863-0ae33e26a56b
Members                 : {jff, jff}
Name                    : jff
CreateTime              : 2023-04-01T05:30:43Z
Status                  : done
EnableRemoteReplication : False
RemoteStatuses          : 
Attributes              : {[CG, 2], [Backup2S3, Y]}
```

In the case of a single volume, we use `New-SFSnapshot`:

```powershell
New-SFSnapshot -VolumeID 14 -Attributes $hashtable
```

Normally we'd also set retention. Add `-Retention 48:00:00` to retain a snapshot for two days.

## Snapshot with attributes

As we've already seen, snapshot attributes are stored with the snapshot.

```powershell
SnapshotID              : 333
VolumeID                : 14
Name                    : 2023-04-01T04:56:03Z
Checksum                : 0x0
EnableRemoteReplication : False
ExpirationReason        : None
ExpirationTime          : 
RemoteStatuses          : 
Status                  : done
SnapshotUUID            : d4971a0a-60ba-46ae-8543-a5c94add8195
TotalSize               : 3001024512
GroupID                 : 0
GroupSnapshotUUID       : 00000000-0000-0000-0000-000000000000
CreateTime              : 2023-04-01T04:56:03Z
InstanceCreateTime      : 2023-04-01T04:56:03Z
VolumeName              : best
InstanceSnapshotUUID    : d4971a0a-60ba-46ae-8543-a5c94add8195
VirtualVolumeID         : 
Attributes              : {[CG, 2], [Backup2S3, Y]}
SnapMirrorLabel         : 
```

## Using snapshot attributes

In order to use these attributes, we can query snapshots for a volume, and do something with those that match our criteria.

```powershell
$snaps = Get-SFSnapshot -VolumeID 14
foreach ($snap in $snaps) {
    if (($snap.Attributes).count -gt 0) {
        Write-Host "Snap", $snap.SnapshotID, ":", $snap.Attributes
        # do something - or not - based on snapshot attribute values
        } 
    else { 
        Write-Host "Snap", $snap.SnapshotID, ": no attributes, skipping"}
    }
Snap 331 : no attributes, skipping
Snap 333 : [CG, 2] [Backup2S3, Y]
```

If, for example, key "Backup2S3" has the value of "Y", we back it up to S3.

Sample "backup to S3" scripts I wrote before (posted on Github in `awesome-solidfire`) can run backup in parallel but aren't smart about the ordering of backup jobs.

While the second script can optionally backup the most recent snapshot with a fixed name pattern, that's still not very fexible.

Snapshot attributes can fix both of these problems:

- using CG values, mark backup-to-S3 job as failed unless all backup jobs with Consistency Group 2 have succeeded
- process snapshots with the same CG at the same time so that all volumes where CG=2 are backed up to S3 at approximately the same time which improves the ods of the entire Consistency Group succeding

While we could use snapshot names - for instance, name a snapshot `backup2s3` and look for a snapshot of VolumeID 14 with that name - to similar effect, attributes use KV pairs and provide much more flexibility and hence power.

In addition to improving workflows, another area of improvement would be better logging and reporting which could include not just OK/FAIL, but also snapshot attributes so that we can create events and send them to Slack, [Elasticsearch](/2023/02/06/cloud-sync-elasticsearch.html) or wherever.

Event like this would make it easy to create a "backup to S3" dashboard:

```powershell
$body = @{
    cg     = $CG
    volid  = $volId
    snapid = $snapId
    start  = $startDate
    end    = $endDate
    result = $res
}
```

We could group such events by date and Consistency Group, and easily find which Consistency Groups have failed.

I've blogged about the topic of backup to S3 several times, see [this](/2021/04/21/solidfire-backup-to-s3.html#demo-script) and archive for other posts.

## Conclusion

SolidFire snapshot names can be set in the UI, but attributes cannot.

SolidFire snapshot attributes are a neat way to improve data management workflows that involve snapshots.

I don't know how SolidFire users use backup to S3 and whether anyone needs that feature, so I'm not going to try and write another backup script. But folks who already automate their SolidFire snapshots and haven't been aware of snapshot attributes should be able to easily make use of this feature on their own.
