# Calculate snapshot capacity utilization on NetApp SolidFire

How to calculate snapshot capacity for a storage account on NetApp SolidFire

- [Introduction](#introduction)
- [Clone and analyze](#clone-and-analyze)
- [Example with Postgres](#example-with-postgres)
- [writeBytes metric](#writebytes-metric)
- [Cost issue](#cost-issue)
- [Do we still need to clone those snapshots?](#do-we-still-need-to-clone-those-snapshots)
- [How to minimize storage utilization by snapshots](#how-to-minimize-storage-utilization-by-snapshots)
- [Conclusion](#conclusion)

## Introduction

Today I came up with an idea on how to calculate snapshot capacity utilization for a storage account on SolidFire.

As a reminder: each SolidFire storage account may have one or more volumes, and each volume may have one or more snapshots.

Problem is, there's no per-account accounting for capacity occupied by snapshot data. 

At most, one can call `GetClusterCapacity` and get something like this (this is a demo VM, so "cluster" capacity is small):

```json
{
    "id": 1,
    "result": {
        "clusterCapacity": {
            "activeBlockSpace": 12273615988,
            "activeSessions": 4,
            "averageIOPS": 0,
            "clusterRecentIOSize": 0,
            "currentIOPS": 0,
            "maxIOPS": 3000,
            "maxOverProvisionableSpace": 18554258718720,
            "maxProvisionedSpace": 3710851743744,
            "maxUsedMetadataSpace": 14495514624,
            "maxUsedSpace": 161061273600,
            "nonZeroBlocks": 2277952,
            "peakActiveSessions": 4,
            "peakIOPS": 6,
            "provisionedSpace": 27183284224,
            "snapshotNonZeroBlocks": 0,
            "timestamp": "2023-11-20T11:30:20Z",
            "totalOps": 922097,
            "uniqueBlocks": 1594454,
            "uniqueBlocksUsedSpace": 5202512500,
            "usedMetadataSpace": 39579648,
            "usedMetadataSpaceInSnapshots": 38637568,
            "usedSpace": 5248927378,
            "zeroBlocks": 2404800
        }
    }
}
```

We can see `snapshotNonZeroBlocks=0`. `usedMetadataSpaceInSnapshots` refers to data in metadata tables, which is not of concern to us now (except the general idea that we don't want to run out of metadata capacity in the cluster).

According to [SolidFire documentation](https://docs.netapp.com/us-en/element-software/api/reference_element_api_getclustercapacity.html), it appears snapshotNonZeroBlocks are logical blocks, i.e. "before efficiency":

```raw
deDuplicationFactor = (nonZeroBlocks + snapshotNonZeroBlocks) / uniqueBlocks
``````

If I had any snapshots at this time and left them in place, the next time Garbage Collection runs it'd come up with a positive integer number.

But the moment you have different accounts, or even different users (say, several departments using one VMware cluster), you're stuck. There's no way to easily tell who's using how much capacity for their snapshots.

SolidFire didn't implement that either before or after the acquisition.

We can't come up with something out of nothing, so if the method isn't there, I have no way to make it appear.

But today - after so many years of using SolidFire - I came up with not just one, but two related ideas - maybe it's because I've been using the SolidFire API in recent days.

## Clone and analyze

This is the first idea, which involves a workaround that's more practical (because, unlike `snapshotNonZeroBlocks`, it works with many accounts), but also more "expensive".

Let's say we're interested in the account s198. This guy happens to have one volume called "data". It's 2 GB large and there are 4 snapshots of it.

![Storage account of interest](/assets/images/solidfire-snapshot-capacity-utilization-00.png)

I create a utility storage account, say "accountant", and note its account ID (in my case, 9).

I create clones of s198's four snapshots and assign them to this new account.

Now I can use `GetAccountEfficiency` on the account ID of "accountant". Here we can see the four snapshots which we'll clone for accountant. 

![Storage account of interest](/assets/images/solidfire-snapshot-capacity-utilization-01.png)

If we want to automate, we'd use `ListAccounts` to see volume IDs resulting from creating clones from snapshots.

```json
{
    "accountID": 9,
    "attributes": {},
    "enableChap": true,
    "initiatorSecret": "testtesttest",
    "status": "active",
    "storageContainerID": "00000000-0000-0000-0000-000000000000",
    "targetSecret": "d3adB33F",
    "username": "accountant",
    "volumes": [
        65,
        66,
        67,
        69
    ]
}
```

I sit tight until top of the hour for Garbage Collection.

How the snapshots were created:
- Snapshot 1 was taken after 50 MB was written to a file on the original volume belonging to s198
- Snapshot 2 was taken after 50 MB was appended to the first file (making it 100 MB large)
- Snapshot 3 was taken after 3 identical 50 MB files were copied to the filesystem
- Snapshot 4 was taken after the 100 MB file was deleted, and discard allowed to run

The same thing in a chart. All files were "storage-efficient" with both dedupe and compression factors greater than 1.

| State        | Delta (MB) | Comment |
|--------------|-------------------:|:-------------|
| Create 50 MB |  -  | Snapshot 1 (Clone 1) - 1st file, 50 MB|
| Append 50 MB |  +50 | Snapshot 2 (Clone 2) - enlarged first file now 100 MB|
| Create 3 x 50 MB | +150  | Snapshot 3 (Clone 3) - 3 identical 50 MB files added|
| Delete 100 MB file | -100  | Snapshot 4 (Clone 4) - 100 MB file deleted, 3 50MB files left|

After GC is done running, we do two things: re-check cluster capacity, and check account efficiency for "accountant". Again, all files were storage-efficient.

First, `GetClusterCapacity` now says `snapshotNonZeroBlocks=27693`. That is 110 MB occupied by snapshots (before SolidFire efficiencies). 

Second, let's check `GetAccountEfficiency` for account ID 9 ("accountant").

```json
{
    "id": 1,
    "result": {
        "compression": 1.952278156703324,
        "deduplication": 7.432667245873154,
        "missingVolumes": [],
        "thinProvisioning": 14.27334093100728,
        "timestamp": "2023-11-20T12:00:01Z"
    }
}
```

14.27x (1.95 x 7.43) is a lot, but we have 4 snapshot-derived volumes with overlapping data. Logical data sizes of clone volumes is:
  - 50 MB (first file)
  - 100 MB (50 MB appended)
  - 250 MB (3 50MB files added, one 100 MB file already present)
  - 150 MB (the 100 MB file was deleted)
  - TOTAL: 50+100+250+150 = 550 MB

Time progression with a total that reflects clones' size (excluding the original volume that belongs to the user s198):

| File    | t0 (orig) |  snap1 | snap2 | snap3| snap4 |
|---------|----------:|-------:|------:|-----:|------:|
| data    |      50   |   50   |   100 | 100  |   0   |
| data-3  |     -     |  -     |       |  50  |  50   |
| data-4  |     -     |  -     |       |  50  |  50   |
| data-5  |     -     |  -     |       |  50  |  50   |
| EACH CLONE   |       -   |   50   |   100 | 250  | 150   |

Total fulness of all 4 clones added together is 28% of 2 GB which is 560 MB, which matches our notes (550 MB plus some filesystem overheads).

Efficiency based on account efficiency report from the SolidFire API and UI is **14.27x**. That's credible, because the original volume also has a high efficiency and we know files are storage-efficient. Four clones with overlapping contents could be reduced to 1/14-th of its original size.

I *think* we can say that the four clone volumes use (560 MB / 14.27x = 38.5 MB) on disk before SolidFire's RF2.

I'm not 100% sure of that. I should have used a more deterministic approach and my three files (the first 50 MB file, the appended 50 MB file and the one I copied three times) weren't uniform in their data efficiency.

## Example with Postgres

I tried another scenario and approach, with a workload that's easier to relate to.

- Create a 2 GB volume for s198, format it with XFS, initialize a PostgreSQL database on it (around 70 MB of data after initialization)

![](/assets/images/solidfire-snapshot-capacity-utilization-03-postgres-initial-72mb.png)

- Start a low-intensity PostgreSQL workload (3tps, ~64 kB/s), with data and log on the same 2 GB volume. Take the first snapshot after a GC run
- Create a discard loop for the volume shortly before each snapshot and GC run
- Create an hourly snapshot schedule to run until after workload stops 3 hours later

![](/assets/images/solidfire-snapshot-capacity-utilization-04-postgres-snapshots.png)

- Then repeat the earlier comparison - create 3 more clones and check data efficiency for the account "accountant"

![](/assets/images/solidfire-snapshot-capacity-utilization-05-postgres-clones.png)

This screenshot above shows that initially - right after the first snapshot was taken, but the first discard hadn't executed until just before snapshot #2 was taken - fulness was 6.27% because of that. Later discard was executed each time so snapshot #2 and the subsequent two (and clones created from these three snapshots) closely resembled the size of original volume.

Data efficiency of the original volume:

![](/assets/images/solidfire-snapshot-capacity-utilization-07-original-efficency.png)

Data efficiency of the clones:

![](/assets/images/solidfire-snapshot-capacity-utilization-06-accountant-efficency.png)

To check if the original volume impacts data efficiency of clone volumes, I deleted all snapshots and the original volume (from the user s198).

Data efficiency of the clones after the original volume was gone and GC executed was unchanged, so we know it's not impacted by presence or absence of the original data. Note, however, that we couldn't delete the original volume *and* leave snapshots in place - the snapshots were deleted as well. This "test" is possible only because the snapshots were cloned before we deleted original volume and its snapshots.

![](/assets/images/solidfire-snapshot-capacity-utilization-08-clones-only-efficency.png)

Summary:

- Efficiency of snapshot-derived clones was (4.92 x 1.63 = 8.01x), closely resembling the efficiency of the source volume (4.51 x 1.30 = 5.86x)
- The source volume had 72 MB of data after database was initialized (measured with `du -sh /mnt/data`) and 95 MB at the end, so only 23 MB was added over 3-4 hours (as tables and log files were overwritten)
- The four snapshots reportedly (snapshotNonZeroBlocks) occupied 68976 4kB blocks, or 269 MB 

If each of the four clones was almost completely overwritten (70 MB x 4 = 280 MB), each clone would have very different data. But internally since DB rows were mostly integers, SolidFire was quite successful deduplicating their blocks, resulting in a high efficiency ratio of 8x. 

The fulness of all clones is (4.58 + 4.5 + 4.43 + 6.27 = 19.78%) of 2000 MB, i.e. 395 MB.

If we assume that snapshotNonZeroBlocks are pre-efficiency, they would occupy (269 MB / 8.01 = 33 MB) on disk (pre-RF2).

The part that doesn't make complete sense is that the total size of the clones (derived from snapshots) is 395 MB, except if they had some 30% of blocks in common. But snapshotNonZeroBlocks are 269 MB and supposed to be pre-efficiency, so that shouldn't matter.

So, I don't think I fully understand how the maths works here, but whether we take 395 MB or 269 MB before dividing it by 8.01x, disk space utilization (before RF2) would be between 38 and 49 MB.

We need to remember that the 269 MB figure (snapshotNonZeroBlocks) is the total for all accounts, so we wouldn't even know it for any individual account in a situation where there are multiple storage accounts with snapshots. Hence our only choice is to use the 395 MB figure by adding up fulness of each snapshot-derived clone.

Given that total data size before and after were 72 MB and 95 MB (23 MB added), 40-50 MB in (usable) snapshot capacity is a lot.

At scale (suppose 230 GB data growth with 400 GB occupied by snapshots) that would definitively be worth knowing.

## writeBytes metric

The second idea I got wasn't another way to estimate capacity used by snapshots, but something that can help us identify write-intensive volumes.

As mentioned earlier, one way is to look at a performance chart with volumes and see which volume has a relatively (considering its size and fulness) "high" write workload.

If we want to automate this, we can look at some average or mean, but we can also use the API to compare two points in time:

```json
{"method": "GetVolumeStats", "id": 7, "params": {"volumeID": 63}}
```

Response:

```json
{
    "id": 7,
    "result": {
        "volumeStats": {
            "accountID": 7,
            "actualIOPS": 0,
            "asyncDelay": null,
            "averageIOPSize": 5074,
            "burstIOPSCredit": 12000,
            "clientQueueDepth": 0,
            "desiredMetadataHosts": null,
            "latencyUSec": 0,
            "metadataHosts": {
                "deadSecondaries": [],
                "liveSecondaries": [],
                "primary": 5
            },
            "nonZeroBlocks": 22414,
            "normalizedIOPS": 0,
            "readBytes": 5825024,
            "readBytesLastSample": 0,
            "readLatencyUSec": 0,
            "readLatencyUSecTotal": 43202,
            "readOps": 416,
            "readOpsLastSample": 0,
            "samplePeriodMSec": 500,
            "throttle": 0,
            "timestamp": "2023-11-21T03:55:16.102916Z",
            "unalignedReads": 90,
            "unalignedWrites": 0,
            "volumeAccessGroups": [],
            "volumeID": 63,
            "volumeSize": 2000683008,
            "volumeUtilization": 0,
            "writeBytes": 2249699328,
            "writeBytesLastSample": 0,
            "writeLatencyUSec": 0,
            "writeLatencyUSecTotal": 111588013,
            "writeOps": 115090,
            "writeOpsLastSample": 0,
            "zeroBlocks": 466034
        }
    }
}

```

See those `writeBytes` and `writeOps`?

I ran the same workload for 60 seconds and writeBytes jumped to 2253455360 (917 kB) while writeOps went up to 115298 (208 additional write requests); from that we know the average throughput was 15.28kB/s and the average IO request size 4.4 kB (clearly no DB log rotation happened during that minute).

Those are very low figures, but these metrics can be used to determine whether we should inspect the volume's snapshots or not.

Let's say we gather these metrics with HCI Collector or SolidFire Exporter, and realize the following:

- There's a 10 GB volume with fullness between 49-50%
- It has 10 daily snapshots 
- Over 10 days, writeBytes add up to what amounts to 4 GB
- Volume efficiency for this volume is 3x

That means 4 GB of IO on 5 GB of data, which is 80% rate of change over just 10 days, or some 7-8% a day. That's considered high as many backup applications default to 2-3%, which means even after deduplication and compression this volume *could* still use quite a lot of capacity for snapshots.

We can't know for sure unless we take external backups (which is the same idea as making clones from snapshots): *if* these writes are repeated updates of one small SQL table, snapshots may not consume a lot of capacity. But if they involve other patterns, then they may.

These indicators may help us eliminate suspects and save resources. Even if if a volume is big and has old snapshots, a low number of writeBytes since the oldest snapshot until now would mean this volume's snapshots don't use a lot of space.

In other words, it seems to me that a high ratio of writes divided by fulness is not a sure sign of a high snapshot capacity consumption, but a low ratio is likely a sign of low snapshot capacity consumption.

## Cost issue

The approach is said to be "expensive" because it involves creating clones out of potentially hundreds (but hopefully only dozens) of snapshots that a user may have.

SolidFire does that [quickly and efficiently](/2023/08/30/monitoring-solidfire-clone-and-backup-jobs.html#opportunities-for-improvements-and-integrations), so it's not absolutely prohibitive.

For example, let's say a user has 60 snapshots of 10 volumes.

- If most snapshots are mere hours or days old *and* using [HCI Collector](https://github.com/scaleoutsean/hcicollector/) (see [this](https://github.com/scaleoutsean/hcicollector/tree/master/sfcollector-kubernetes) for a K8s/container version) or [SolidFire Exporter](https://github.com/mjavier2k/solidfire-exporter) we observe volume write rate isn't excessive, that means snapshots likely take a small capacity and there's no reason to do anything about them
- If the volumes are large and/or snapshots old (days, or weeks), that may require periodic evaluation. Let's consider this case.

Since these snapshots stay around for days or weeks, we don't have to check them every day. Once a week is enough.

We can use SolidFire PowerShell tools or Python SDK to completely automate this process:

- Pick a random account ID
- Check the account's volumes and decide whether to check. We'd use own logic here, such as: if the product of volumes bigger than 1 TB with at least one snapshot older than 1 week is greater than 10, run the check
- Clone those volumes' snapshots and assign them to your "utility" account. You could also create clones from the largest volume's snapshots.
- Wait until next Garbage Collection, report account efficiency (send metrics to your monitoring solution such as Elasticsearch, Splunk, or some TSDB)
- Delete and purge cloned volumes

That can be done in 200 lines of code.

We'd have to be careful to not hit the maximum number of volumes per node/cluster, or run out of metadata capacity, which could be addressed with a cluster fullness check between cloning of each snapshot.

With one storage account, we could do one examination per hour, or dozens of checks during a weekend.

Other opportunities for controlling disk consumption by snapshots are related to snapshots' number and age. We could gather output of `ListSnapshots` (collected by HCI Collector or SolidFire Exporter) and create alerts for cases where snapshots are older than X days and such. It's best to create [snapshot schedules](/2022/02/14/middle-class-rbac-solidfire-ansible.html) for users so that they don't have to remember to delete them. Kubernetes admin can create snapshot quotas (in number, not capacity terms), but I'm not sure if that can be done on Docker. Still, volumes with a high number of Docker snapshots can be identified with a monitoring solution.

In fact I've been working on updating SF Collector and one new thing I plan to do is gather metadata from volumes managed by NetApp Trident. The idea is to provide exactly this insight, and also help with backup, replication and other scenarios in which we'd like to watch Trident-tagged volumes. More on that in a future post!

## Do we still need to clone those snapshots?

Now that we've seen how this *roughly* works, it just ocurred to me that in most cases it should be enough to simply analyze SolidFire metrics, identify "suspect volumes" and send a reminder to the owner(s) to delete unnecessary snapshots.

SolidFire clusters with centrally managed "snapshot SLAs" in place wouldn't even have this problem, but if it was suspected we could create clones to get a better estimate as described in this post.

For mainstream applications (SQL Server, PostgreSQL, NodeJS, etc.) we would quickly get an idea how each behaves in terms of change rate. 

## How to minimize storage utilization by snapshots

- Configure unmap/discard on your hosts (you saw what happened with the first PostgreSQL clone)
- Institute "storage SLAs" or "snapshot SLAs" as illustrated in that linked post
- For databases, encrypt & dump them to S3 rather than keeping snapshots for weeks or months, and create 10-line scripts that occasionally test these backups in temporary containers or VMs
- For containers, send logs application *out* to syslog servers, don't save them inside the container

## Conclusion

The good thing about SolidFire snapshots is you don't need to reserve (and thereby strand) capacity for them, which allows you to maximize the use of the single pool of storage that a cluster offers. The bad thing is you can't reserve (and thereby can't limit either) the capacity of snapshots, although in some cases it can be done at the virtualization management layer.

SolidFire failed to implement per-account snapshot capacity reporting, but it is possible to work around this if your cluster capacity report indicates `snapshotNonZeroBlocks` occupy many TBs of capacity which may justify the "cost" of cloning for the purpose of finding snapshots that use a lot of storage capacity.

Although the approach is not very straight-froward, it is not terribly complex or "expensive" either. 

If you gather SolidFire storage metrics, that task becomes even easier as metrics can help you identify and prioritize the right volumes for examination. An SLA-driven approach to snapshot schedules would almost completely eliminate the need to use of this snapshot-cloning approach.
