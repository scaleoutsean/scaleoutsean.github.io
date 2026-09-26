# Monitor SolidFire clone and backup jobs through API

Use SolidFire ListSyncJobs and ListBulkVolumeJobs to monitor clone and backup jobs

- [Problem](#problem)
- [API methods](#api-methods)
  - [Finding SolidFire API limits](#finding-solidfire-api-limits)
  - [Clone jobs](#clone-jobs)
    - [Slice sync jobs](#slice-sync-jobs)
    - [Clone sync jobs](#clone-sync-jobs)
    - [Remote sync jobs](#remote-sync-jobs)
  - [Bulk (backup, restore) jobs](#bulk-backup-restore-jobs)
- [Opportunities for improvements and integrations](#opportunities-for-improvements-and-integrations)
  - [Faster access to volume clones](#faster-access-to-volume-clones)
  - [Faster multiple clones from a single volume](#faster-multiple-clones-from-a-single-volume)
  - [Auto-adjust QoS on volumes involved in bulk jobs](#auto-adjust-qos-on-volumes-involved-in-bulk-jobs)
  - [Get available bulk job slots](#get-available-bulk-job-slots)
  - [Monitoring and resubmission of bulk jobs](#monitoring-and-resubmission-of-bulk-jobs)
- [Note on async job results](#note-on-async-job-results)
- [Demo](#demo)
- [Conclusion](#conclusion)

## Problem

Not many scripts for the SolidFire API have been published on Github since NetApp acquired SolidFire, but I've always wished there were some clever examples of the use of certain API methods that are reasonably popular, but may be hard for beginners. 

I mean mostly API calls related to backup/restore to S3 and clone.

Over the years I wrote several scripts and even entire (small) workflows that use these - whether it's parallel backup to S3 or volume cloning-based backup - and published them on Github. 

But while the code more or less worked, it wasn't pretty and easy to use. At the same time, I don't get any queries for it, so it's not something that I may necessarily revisit (as far as scripts are concerned). 

Still, I've found some time to revisit the APIs involved, so I'll use some time to summarize that and maybe get to write some code in the future.

## API methods

### Finding SolidFire API limits

As we use the API we need to mind the limits.

When you login with PowerShell you'll see them right there. Or use `Get-SFLimits` (PowerShell). Relevant limits for SolidFire Demo VM:

```powershell
PS /home/sean> Get-SFLimits
...
BulkVolumeJobsPerNodeMax               : 10
BulkVolumeJobsPerVolumeMax             : 10
CloneJobsPerVolumeMax                  : 1
...
```

### Clone jobs

The SolidFire API calls these "sync jobs". As we can see from TFM, [ListSyncJobs](https://docs.netapp.com/us-en/element-software/api/reference_element_api_listsyncjobs.html) can spit out different kinds of sync jobs.

```json
{
    "id":1,
    "result":{
      "syncJobs":[
        {
           "bytesPerSecond":275314.8834458956,
           "currentBytes":178257920,
           "dstServiceID":36,
           "elapsedTime":289.4568382049871,
           "percentComplete":8.900523560209423,
           "remainingTime":2962.675921065957,
           "sliceID":5,
           "srcServiceID":16,
           "stage":"whole",
           "totalBytes":2002780160,
           "type":"slice"
       },
       {
           "bytesPerSecond":305461.3198607744,
           "cloneID":1,
           "currentBytes":81788928,
           "dstServiceID":16,
           "dstVolumeID":6,
           "elapsedTime":291.7847648200743,
           "nodeID":1,
           "percentComplete":8.167539267015707,
           "remainingTime":3280.708270981153,
           "sliceID":6,
           "srcServiceID":16,
           "srcVolumeID":5,
           "stage":"whole",
           "totalBytes":1001390080,
           "type":"clone"
        },
        {
           "blocksPerSecond":0,
           "branchType": "snapshot",
           "dstServiceID":8,
           "dstVolumeID":2,
           "elapsedTime":0,
           "percentComplete":0,
           "remainingTime":0,
           "sliceID":2,
           "stage":"metadata",
           "type":"remote"
       }
     ]
   }
}
```
#### Slice sync jobs

Slice is volume metadata. 

I'm not sure why slice service would be singled out like this. I am not aware of a way to directly initiate a slice sync job.

My guess is this type of sync jobs happen automatically in situations like Disk 0 failure on a node, cluster expansion or reduction, in-cluster workload rebalancing (volume flipping), and such. 

While this may be interesting to some monitoring use cases, it's usually enough to watch for SolidFire alerts which tell you when there's something to do and go away when/if the problem goes away. 

As an example, a slice sync job may be running for a while after a node has been added to the cluster and some volumes are automatically moved to the new node, as well as backup slice data is replicated (synced) to it. But there's nothing we need to do about it - slice data sync will complete and the system alert will automatically disappear.

#### Clone sync jobs

This one is interesting and should help us watch the progress of volume clone jobs. 

Comments on some of the keys:

- bytesPerSecond: can help us estimate time-to-completion, although remainingTime (below) is already calculated for us
- dstVolumeID: new volume ID, can help us set a different QoS on it later or use that volume ID for other purposes
- percentComplete: can be sent to some database for monitoring purposes
- remainingTime: just an estimate, which may be more precise than our own estimate
- `"type":"clone"` - we'd look for this to get a list of all clone job objects

#### Remote sync jobs

Remote sync jobs likely involve volume or snapshot replication to a remote SolidFire cluster, which doesn't interest me that much. 

It is useful, of course, especially in DR scenarios where there's no 3rd party code to do that for you (such as vSphere SRA). But even if you need to failover, you can check a volume's status to see if it's in sync or not - it's not necessary to look at the progress just for that. Then if a volume is in sync, we can break replication, make the destination read-write, and fail over.

### Bulk (backup, restore) jobs

[ListBulkVolumeJobs](https://docs.netapp.com/us-en/element-software/api/reference_element_api_listbulkvolumejobs.html) coughs up information about bulk volume read or write operations.

Those are mainly backup and restore jobs (I don't know of any other kind). bulkVolumeJobs is a list, here with just one element.

```json
{
    "id": 1,
    "result": {
        "bulkVolumeJobs": [
            {
                "attributes": {
                    "blocksPerTransfer": 1024,
                    "firstPendingLba": 0,
                    "nLbas": 244140,
                    "nextLba": 0,
                    "pendingLbas": "[]",
                    "percentComplete": 0,
                    "startLba": 0
                },
                "bulkVolumeID": 25,
                "createTime": "2023-09-02T15:15:32Z",
                "elapsedTime": 11,
                "format": "native",
                "key": "f5075f5a4e23e108484492b0492409e3",
                "percentComplete": 0,
                "remainingTime": 1089,
                "script": "bv_internal.py",
                "srcVolumeID": 27,
                "status": "running",
                "type": "read"
            }
        ]
    }
}
```

What do we have here? 

- bulkVolumeID: auto-incrementing counter for bulk jobs (25th job since this cluster was created)
- `"format": "native"`: compressed and in-volume deduplicated data, rather than "uncompressed" (produced by raw "dd"-like reads which is another option which creates extremely bloated backups of the same size as the volume itself, including zeroed out empty space - this is for maximum portability to any destination)
- key: this is key that returned for async job tracking when we create a job
- percentComplete: self-explanatory
- remainingTime: (estimated) time remaining in seconds 
- snapshotID: when backup is done on a volume snapshot, this will be a non-zero integer of the snapshot ID
- srcVolumeID: source volume ID (could be derived from snapshot ID, but it would take an extra call, so it's sometimes convenient to know if even if we're backing up from snapshot)
- status: running (the [sloppily written documentation doesn't even list that one](https://github.com/NetAppDocs/element-software/issues/206))
- type: read (read means backup, write means restore)

## Opportunities for improvements and integrations

These are some use cases or integrations I couldn't or didn't do myself that I'd like to see made available in permissive open source scripts.

### Faster access to volume clones

One ask I've heard, but not from customers I worked with (otherwise I would have tried to find out more and solve it) is the time gap between cloning a volume and using it. 

Now, SolidFire metadata is in a slice database file, so clones can't be instant. It takes time to copy the slice file and clone jobs are asynchronous. 

As we can see from that second ListSyncJobs item, there may be ways to use that API method to make our workflows smarter. 

Whether that's actually possible or not, it depends. Let's say we have 4 SolidFire nodes and 20 volumes to clone. Lets say the maximum clone jobs per node is two. 

- a naive approach would be to run clone jobs in batches of two: run two, wait until they're done (or worse, "sleep" for a generic amount of time such as 600 seconds), then run next two 
- a smarter approach would be to find the number of jobs running on the node and dispatch the next job - if any - that we know would land on this node (how do we know that? We find where the volume would is Primary; see the source of scripts I mention, or other posts on this topic)
- there's a feature that lets you [clone multiple volumes](https://docs.netapp.com/us-en/element-software/storage/task_data_protection_clone_multiple_volumes.html); not sure how this works - I wonder what the maximum number of volumes that ca be selected is, and whether the scheduler is "smart"
- CopyVolume API method lets you simplify other operations, although it doesn't make volume cloning operation itself faster (see below)
- if we keep an eye on percentComplete of clone jobs, we can minimize generic wait situations ("sleep 600") and chain operations together

By the way, I tried the clone multiple volumes feature: it works fine but only up to 10 volumes at a time!

![SolidFire clone multiple volumes feature](/assets/images/solidfire-clone-volumes-group.png)

Note the error says "snapshots", which I'm sure is a bug because technically yes, temporary snapshots are taken in order to clone volumes, but I wasn't cloning snapshots. Anyway, no more than 10 at a time on my SolidFire Demo VM. The limit may be different on real SolidFire multi-node clusters.

Another weird detail is that [CloneMultipleVolumes](https://docs.netapp.com/us-en/element-software/api/reference_element_api_clonemultiplevolumes.html) is a thing... I had no idea (or maybe I'd forgotten). For the sake of completeness, here's what it returns:

```json
{
  "id": 1,
  "result": {
    "asyncHandle": 12,
    "groupCloneID": 4,
    "members": [
     {
      "srcVolumeID": 5,
      "volumeID": 29
     },
     {
      "srcVolumeID": 18,
      "volumeID": 30
     },
     {
      "srcVolumeID": 20,
      "volumeID": 31
      }
    ]
  }
}
```

Although there's a 10 volume limit (on my Demo VM; it may be higher on actual production clusters), this is less naive than creating clones one by one.

But its benefit is mostly related to saving time required to issue clone requests (as the alternative is to issue multiple individual requests to clone a volume). I wonder if the 10 volume limit is such because that's the worst case for this API method (10 clone jobs could land all on the same storage node). Too bad there's no option to clone one volume 10 times.

### Faster multiple clones from a single volume

Another situation is where there's one volume that needs to be cloned many (e.g. 20) times.

On my Demo VM that limit is very low: CloneJobsPerVolumeMax is 1. It seems it'd take a loop that runs 20 times to get 20 clones from a "gold" volume with source code!

We know that's not true, though. 

- there's [CopyVolume](https://docs.netapp.com/us-en/element-software/api/reference_element_api_copyvolume.html) which I use in SolidBackup: if the 20 clones don't have to be destroyed, then they can be dismounted and copied into from the gold volume. Workload-wise it's still 20 full clone operations, but there's less to do in general, including client-side (no need to rescan iSCSI and login, you can simply mount the clone)
- on production systems the limit is not one concurrent clone, so we can clone 1 to 1, then 2 to 2 (running total 2), then 4 to 4 (running total 8), etc. until we reach 10 clones
- once we get to 10 clones, we can use CloneMultipleVolumes to clone those 10 to 20
- we could use other methods such as client-side copy: create 20 empty volumes, mount all 21, then initiate 20 rsync jobs to copy data from 1 to 20 volumes. These wouldn't be exact byte-for-byte clones, but they'd be sufficiently alike for most software applications
- when volume or host performance isn't a concern, we can use client-side software to clone data without doing anything on SolidFire

Some of these approaches (CopyVolume, for example) would be useful for large volumes with many files, because filesystem-side copying could take longer. Example: Android source code can take [250 GB](https://source.android.com/docs/setup/start/requirements) of disk space (for starters):

> At least 250GB of free disk space to check out the code and an extra 150 GB to build it. 

In other cases - many small volumes with low performance - it may be better to use ZFS because you still get deduplication on SolidFire, but fast volume cloning due to it being a simple local command on the iSCSI client. Example: Web development, containers.

We can't know which approach would be significantly better and whether implementing it would make sense, but it is possible to do a PoC and see for ourselves.

**Update** (2023/09/16)

I found some time to download a recent copy of the Android source code to a 400GB SolidFire volume.

![Directory listing of Android source code](/assets/images/solidfire-clone-01-dir-list.png)

Then I used PoweShell cmdlets to clone it.

![Clone job on volume with 143GiB data](/assets/images/solidfire-clone-02-clone-job.png)

Here's how long it took.

![Clone job details](/assets/images/solidfire-clone-03-clone-job.png)

You may open images in another tab (or see a demo at the bottom), but if you can't see it clearly as-is:
- Begin: 04:30:07
- Finish: 04:30:14 

So, it takes around 10 seconds to clone 150G of in-volume data.

On this (physical) SolidFire system we could expect something like:

- 1 to 1: 8s
- 2 to 2: 8s
- 4 to 4: 8s
- TOTAL: 8 clones in <30s

Also consider that first build jobs could start in 15-20s as several clones would be ready.

### Auto-adjust QoS on volumes involved in bulk jobs

- Implement a higher Max QoS while remembering original QoS values 
- Restore original QoS values after percentComplete for bulk job (backup or restore) hits 100%

The script was written [in 2020](/2020/11/28/powershell-set-sfqosexception.html), but could be included in sophisticated backup/restore scripts.

### Get available bulk job slots

In the "backup to S3" scripts I wrote I watch the total number of bulk jobs per node, which is the main constraint that lets me maximize the use of bulk job slots.

It would be nice to have a way to get "bulk job slots available" per node. With that it would be very easy to write backup jobs in own language or using own tool, and just use the slot information to find out when to fire the next job.

Because a SolidFire volume may or may not be Primary on the node where there's an empty bulk job slot, this API would be called with VolumeID and would determine the node on which the volume is Primary, and then check if the maximum number of job slots minus the number of jobs running is larger than zero.

### Monitoring and resubmission of bulk jobs

When we backup hundreds of volumes every day, some jobs are expected to time out or otherwise fail.

In my "backup-to-S3" scripts I think I only reported failed jobs at the end, but haven't retried any. The reason is it's tricky (how many times, for how long, etc.) and best left to professional software or professional programmers.

We could send job details and status updates to a place where such data could be used. Something like Elasticsearch, for example. Or we could query job status and save output as JSON files, leaving it for pickup to anyone who wants it. Then Operations could create service requests or retry on their own.

Retrying and rescheduling is tricky for many reasons, but also notice that a mere list of volume IDs (17, 28, 128) doesn't have anything about which volume backup jobs should be retried, which should not, and so on. 

We'd need a detailed backup job description format which specifies which volume IDs or groups should be retried, how many times, and for how long. And we'd also need a database to keep that data, and a way to update it without directly editing the file.

It's easy to see how things get complicated quickly - some users would want to retry 3 times before 8am in *their* time zone, other 3 times the same day (local, not UTC, time!), etc. It seems smarter to just give up and let those with simple requirements write their own scripts! 

I know there are open source schedule modules that can "solve" that, but I don't think that solution would be intelligent out of the box: it would still require a lot of work to make it useful.

Job logging and monitoring would be reasonable things to to automate. 

And it's not hard, because I wrote a [how-to](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html) which is 80% of the recipe; we'd just have to create a polled API method based on ListBulkVolumeJobs. [StartBulkVolumeRead](https://docs.netapp.com/us-en/element-software/api/reference_element_api_startbulkvolumeread.html) request - which has job params - would have to be sent to Elasticsearch so that we can correlate jobs with job updates from ListBulkVolumeJobs. [UpdateBulkVolumeStatus](https://docs.netapp.com/us-en/element-software/api/reference_element_api_updatebulkvolumestatus.html) may need to be used to fetch to get final results, although I don't recall I had to use this method.

Another approach would be to use SolidFire syslog (see that ELK how-to) to spot StartBulkVolumeRead requests in API logs, and then kick-off ListBulkVolumeJobs to keep an eye on them. Failed jobs could also be detected from API calls in syslog. An advantage of this approach is we can run our scripts without caring about sending script logs to Elasticsearch, but a disadvantage is we have to forward SolidFire log to Elasticsearch. Having a script that sends logs to Elasticsearch seems a bit more flexible, especially since it's easy to modify it to be sent to another location if need be.

## Note on async job results

I mention this in all API-related posts because it's one of those frustrating gotchas: use `keepResult=true` in [GetAsyncResult](https://docs.netapp.com/us-en/element-software/api/reference_element_api_getasyncresult.html) to keep the asynchronous result.

Otherwise, if a job finishes and you query it by the handle, you may get nothing in return.

I use that option in the first query immediately after the job has started. Then the next time I revisit same async handle, the result will still be available.

```json
{
  "method": "GetAsyncResult",
  "params": {
      "asyncHandle" : 389,
      "keepResult": true,
},
"id" : 1
}
```

## Demo

- [Short demo of creating a clone from a volume with the Android source code](https://rumble.com/v3i2s18-solidfire-volume-clone-demo.html) - 1m27s

## Conclusion

As far as open source scripts that take advantage of clone and backup/restore APIs are concerned, there's still some uncollected "low-hanging fruit" out there.

Rapid 1-to-1 and 1-to-many cloning is interesting, but it's hard to build something random and say it's useful. I'd like to have a concrete problem to solve before I try.

On the other hand, the problem with "backup to S3" in SolidFire is that (as I recently [wrote](/2023/08/26/solidfire-backup-to-ontap-s3.html)) it hasn't been improved, so if you want to backup to S3 it's better to try something like SolidBackup or 3rd party (free or commercial) client-side backup software than the SolidFire backup-to-S3. The appeal of "backup to S3" is that as long as you have SolidFire and largely uniform and simple backup requirements, you're a potential user of the feature.
