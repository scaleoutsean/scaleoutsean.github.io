# Hadoop Multi-Tiered Read-Write S3 cache Alluxio and NetApp StorageGRID

Eliminate legacy storage approach without compromises by using multi-tiered read-write cache with StorageGRID

<!-- TOC -->

- [Introduction](#introduction)
- [Setup](#setup)
  - [Underlay Storage (S3)](#underlay-storage-s3)
  - [Multi-tiered S3 Cache](#multi-tiered-s3-cache)
  - [Hadoop (MapReduce) Compute Layer Configuration](#hadoop-mapreduce-compute-layer-configuration)
- [Results](#results)
  - [Hot Read Cache (including pinned and pre-loaded content)](#hot-read-cache-including-pinned-and-pre-loaded-content)
  - [Cold Cache (including free'd and evicted)](#cold-cache-including-freed-and-evicted)
  - [Observations Related to SSD Cache](#observations-related-to-ssd-cache)
- [Benefits and Conclusion](#benefits-and-conclusion)
- [Demo](#demo)

<!-- /TOC -->

**NOTICE**: all credentials and tokens on this page are samples, not leaked.

## Introduction

If you are interested in "problem statement" and details related to each approach, you can refer to these:

- [Alluxio and StorageGRID](/2021/11/12/alluxio-storagegrid-s3.html) - in-RAM cache for StorageGRID S3
- [Alluxio and ONTAP NFS](/2021/11/21/alluxio-ontap.html) - in-RAM cache for ONTAP NFS

The purpose of this post is to show how both can be used together in the Hadoop compute (MapReduce) context.

Note that we will *not* be using two back-end storages (NFS and S3); we'll use just one - StorageGRID (S3) - but we'll set up Alluxio to use a *two-tiered* cache: in-RAM and NFS. With this approach we can take advantage of SSD-based NFS shares (or block storage devices, as ONTAP supports multiple block protocols) to augment RAM-based Alluxio cache.

So while ONTAP NFS will be used, it won't be used as underlay file system (for that, see the post above). It's not that it can't be used at the same time - it can, and nested Alluxio mounts are possible - but that we chose to make our cache larger than the amount of RAM we have at our disposal.

## Setup

- Local
  - Ubuntu 20.04 LTS
    - Alluxio 2.7.1
    - Hadoop 3.3.0
  - ONTAP 9.10.1 (NFS v4)  
- Remote
  - NetApp StorageGRID 11.5

The following screenshots can be opened in new tab or separate window for better clarity.

vSphere testbed with Hadoop and ONTAP:

![Compute-side resources](/assets/images/alluxio-hadoop-multitier-01-vmware.png)

ONTAP NFS share:

![ONTAP Select NFS v4 share](/assets/images/alluxio-hadoop-multitier-02-ontap.png)

Remote StorageGRID bucket used as sole underlay:

![StorageGRID S3 underlay](/assets/images/alluxio-hadoop-multitier-03-storagegrid.png)

In-memory tier (can be sized differently on each worker node):

![Alluxio MEM caching tier](/assets/images/alluxio-hadoop-multitier-04-alluxio-mem-tier.png)

Alluxio on-disk tier (ONTAP NFS, framed blue at the bottom of this screenshot):

![Alluxio NFS caching tier](/assets/images/alluxio-hadoop-multitier-04-alluxio-nfs-tier.png)

Alluxio overview (Web UI running on singleton master/worker node): we can see faster tiers (here MEM) are prioritized and therefore fuller.

![Alluxio overview](/assets/images/alluxio-hadoop-multitier-05-alluxio-overview.png)

Cached objects: see the green rectangle, not pinned, as we just let them load and get evicted naturally based on the default settings. The red rectangle shows that the default Alluxio block size can be wasteful for tiny objects. Normally you wouldn't have tiny objects in Hadoop but if you did, you could adjust block size downwards, so it's not a problem.

![Alluxio cache](/assets/images/alluxio-hadoop-multitier-06-alluxio-in-memory.png)

In-Alluxio cache objects can be browsed and files/objects downloaded. Notice how there's just one Location in the screenshot because (a) there *is* just one location (one worker) and (b) I didn't instruct Alluxio to make two (or more) copies, which I could have done (if I had more workers) for even faster cache sharing *within* Alluxio cluster.

![Browseable cache](/assets/images/alluxio-hadoop-multitier-07-alluxio-browser.png)

Alluxio MountTable:

![StorageGRID bucket in Alluxio MounTable](/assets/images/alluxio-hadoop-multitier-08-alluxio-mounttable.png)

I'll skip the configuration details of configuration files because I had them in the previous Alluxio-related posts, and also Hadoop and Java in general are a PITA and depending on your version of OS, or Java, or Alluxio, you'd have to adjust them anyway. (Did I mention that I don't like Java?)

Alluxio is latest version released and while Hadoop 3.3.1 is available, Alluxio's recommended Hadoop version (with Alluxio 2.7.1) is Hadoop 3.3.0, so that's what I used. If you use a newer version of Alluxio, just check their docs (Hadoop compute integration section) to see what version is safest to use.

On the ONTAP side, we could use iSCSI or NVMe/TCP or other block storage protocol, but NFS is easier to manage and we can create NFS shares that can be shared among multiple compute nodes (e.g. `ipv4:/share/node[1,2,3,4]-cache`) which is certainly easier than creating one or more dedicated block device(s) for each worker node.

### Underlay Storage (S3)

We create a bucket (`hahdupe`) on a StorageGRID system that's 10,000 km away and mount it from Alluxio overlay at the root:

`/ => s3://hahdupe`

Next, we set up our caching devices.

### Multi-tiered S3 Cache

By default, and I used that approach in the StorageGRID post, you have an underlay storage such as S3, in-worker RAM is used for caching. But you can also set it up so that Alluxio uses other devices - ONTAP NFS shares, EF600 IB block devices, etc. Note that we could have a multi-device SSD pool as well (example: `/share1/worker1cache`, `/share2/worker1cache` configured for `worker1` at the same time).

We can guess what `MEM` (below)  means. Alluxio calls the next fast tier `SSD`, and the one below that would be `HDD`. Faster cache is preferred so Used Capacity on MEM tier is more, everything else (such as cache tiers' capacity, in this case) being the same.

```
Alluxio cluster summary: 
    Master Address: localhost:19998
    Web Port: 19999
    Rpc Port: 19998
    Started: 12-15-2021 08:59:33:596
    Uptime: 0 day(s), 18 hour(s), 18 minute(s), and 50 second(s)
    Version: 2.7.1
    Safe Mode: false
    Zookeeper Enabled: false
    Live Workers: 1
    Lost Workers: 0
    Total Capacity: 2048.00MB
        Tier: MEM  Size: 1024.00MB
        Tier: SSD  Size: 1024.00MB
    Used Capacity: 1119.98MB
        Tier: MEM  Size: 799.98MB
        Tier: SSD  Size: 320.00MB
    Free Capacity: 928.02MB
```

What we see above is one Alluxio worker with two-tiered Alluxio cache (RAM and SSD-based NFS).

By default Alluxio fills up faster cache first and it has a gazillion knobs and switches that influence how it behaves, in the case you need to override default behavior.

### Hadoop (MapReduce) Compute Layer Configuration

Alluxio (RTFM) makes it very easy to integrate Hadoop. You'd just tell Hadoop to use Alluxio. In site properties:

```xml
<configuration>
  <property>
    <name>fs.alluxio.impl</name>
    <value>alluxio.hadoop.FileSystem</value>
    <description>The Alluxio FileSystem</description>
  </property>
</configuration>
```

## Results

### Hot Read Cache (including pinned and pre-loaded content)

Now we can run MapReduce jobs that have Alluxio overlay as both their source and target:

```sh
./bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.0.jar wordcount \
  -libjars $ALLUXIO_HOME/client/alluxio-2.7.1-client.jar \
  alluxio://localhost:19998/people_data01.csv \
  alluxio://localhost:19998/wordcount/output/pd1
```

That's it!

```raw
...
2021-12-15 09:21:04,516 INFO output.FileOutputCommitter: Saved output of task 'attempt_local1274528484_0001_r_000000_0' to alluxio://localhost:19998/wordcount/output/pd1
2021-12-15 09:21:04,516 INFO mapred.LocalJobRunner: reduce > reduce
2021-12-15 09:21:04,517 INFO mapred.Task: Task 'attempt_local1274528484_0001_r_000000_0' done.
2021-12-15 09:21:04,517 INFO mapred.Task: Final Counters for attempt_local1274528484_0001_r_000000_0: Counters: 29
        File System Counters
                ALLUXIO: Number of bytes read=22904321
                ALLUXIO: Number of bytes written=20252426
                ALLUXIO: Number of read operations=10
                ALLUXIO: Number of large read operations=0
                ALLUXIO: Number of write operations=3
                FILE: Number of bytes read=44673716
                FILE: Number of bytes written=45291627
                FILE: Number of read operations=0
                FILE: Number of large read operations=0
                FILE: Number of write operations=0
        Map-Reduce Framework
                Combine input records=0
                Combine output records=0
                Reduce input groups=487339
                Reduce shuffle bytes=22196121
                Reduce input records=487339
                Reduce output records=487339
                Spilled Records=487339
                Shuffled Maps =1
                Failed Shuffles=0
                Merged Map outputs=1
                GC time elapsed (ms)=3
                Total committed heap usage (bytes)=892338176
        Shuffle Errors
                BAD_ID=0
                CONNECTION=0
                IO_ERROR=0
                WRONG_LENGTH=0
                WRONG_MAP=0
                WRONG_REDUCE=0
        File Output Format Counters 
                Bytes Written=20252426
2021-12-15 09:21:04,522 INFO mapred.LocalJobRunner: Finishing task: attempt_local1274528484_0001_r_000000_0
2021-12-15 09:21:04,522 INFO mapred.LocalJobRunner: reduce task executor complete.
2021-12-15 09:21:04,801 INFO mapreduce.Job:  map 100% reduce 100%
2021-12-15 09:21:04,802 INFO mapreduce.Job: Job job_local1274528484_0001 completed successfully
2021-12-15 09:21:04,807 INFO mapreduce.Job: Counters: 35
        File System Counters
                ALLUXIO: Number of bytes read=45808642
                ALLUXIO: Number of bytes written=20252426
                ALLUXIO: Number of read operations=15
                ALLUXIO: Number of large read operations=0
                ALLUXIO: Number of write operations=4
                FILE: Number of bytes read=44955158
                FILE: Number of bytes written=68387133
                FILE: Number of read operations=0
                FILE: Number of large read operations=0
                FILE: Number of write operations=0
        Map-Reduce Framework
                Map input records=200001
                Map output records=1066379
                Map output bytes=27069836
                Map output materialized bytes=22196121
                Input split bytes=108
                Combine input records=1066379
                Combine output records=487339
                Reduce input groups=487339
                Reduce shuffle bytes=22196121
                Reduce input records=487339
                Reduce output records=487339
                Spilled Records=974678
                Shuffled Maps =1
                Failed Shuffles=0
                Merged Map outputs=1
                GC time elapsed (ms)=110
                Total committed heap usage (bytes)=1680343040
        Shuffle Errors
                BAD_ID=0
                CONNECTION=0
                IO_ERROR=0
                WRONG_LENGTH=0
                WRONG_MAP=0
                WRONG_REDUCE=0
        File Input Format Counters 
                Bytes Read=22904321
        File Output Format Counters 
                Bytes Written=20252426
```

### Cold Cache (including free'd and evicted)

Let's see what happens when Alluxio starts with an empty cache. Doing a wordcount on a non-cached input file (22 MB) which takes 45 or so seconds to download from StorageGRID in my case. These details vary and change the equation for every situation, so while this doesn't apply to any other use case, I need to describe my situation.

First (un-cached) MapReduce run took 55s. For a comparison, regular S3 client takes 45-47s to download this file.

- 04:05:46: wordcount job started
- 04:05:48: map 0%, reduce 0%
- 04:06:30: map 55%, reduce 0%
- 04:06:38: starting flush of map output
- 04:06:39: map task complete
- 04:06:41: task done

Log:

```raw
...
2021-12-17 04:05:46,166 INFO hadoop.AbstractFileSystem: Creating Alluxio configuration from Hadoop configuration {}, uri configuration {alluxio.zookeeper.address=null, alluxio.zookeeper.enabled=false, alluxio.master.hostname=localhost, alluxio.master.rpc.addresses=null, alluxio.master.embedded.journal.addresses=null, alluxio.master.rpc.port=19998}
2021-12-17 04:05:46,246 INFO hadoop.AbstractFileSystem: Initializing filesystem with connect details localhost:19998
2021-12-17 04:05:46,320 INFO metrics.MetricsSystem: Starting sinks with config: {}.
...
2021-12-17 04:05:48,046 INFO mapred.MapTask: Map output collector class = org.apache.hadoop.mapred.MapTask$MapOutputBuffer
2021-12-17 04:05:48,938 INFO mapreduce.Job: Job job_local1773778307_0001 running in uber mode : false
2021-12-17 04:05:48,938 INFO mapreduce.Job:  map 0% reduce 0%
...
2021-12-17 04:06:36,025 INFO mapred.LocalJobRunner: map > map
2021-12-17 04:06:36,953 INFO mapreduce.Job:  map 58% reduce 0%
2021-12-17 04:06:38,315 INFO mapred.LocalJobRunner: map > map
2021-12-17 04:06:38,315 INFO mapred.MapTask: Starting flush of map output
2021-12-17 04:06:38,315 INFO mapred.MapTask: Spilling map output
...
2021-12-17 04:06:39,834 INFO mapred.LocalJobRunner: map
2021-12-17 04:06:39,836 INFO mapred.Task: Task 'attempt_local1773778307_0001_m_000000_0' done.
...
2021-12-17 04:06:39,917 INFO mapred.Merger: Merging 1 sorted segments
2021-12-17 04:06:39,917 INFO mapred.Merger: Down to the last merge-pass, with 1 segments left of total size: 22189014 bytes
2021-12-17 04:06:39,954 INFO mapreduce.Job:  map 100% reduce 0%
...
2021-12-17 04:06:41,027 INFO mapred.LocalJobRunner: reduce task executor complete.
2021-12-17 04:06:41,955 INFO mapreduce.Job:  map 100% reduce 100%
2021-12-17 04:06:41,955 INFO mapreduce.Job: Job job_local1773778307_0001 completed successfully
2021-12-17 04:06:41,961 INFO mapreduce.Job: Counters: 35
```

Observations related to this run with a cold read cache:

- The Map phase makes progress as data is being downloaded - there's no need to wait for download to complete. But because this phase normally (local data or hot Alluxio cache) takes just 2-3 seconds, it doesn't seem to help us. In some other situations, though, that would make a big difference (imagine if it took 3 hours to download and 3 hours to Map, and if you could have both done in 3 hours and 5 minutes)
- If the result is output to S3 it is by default transparently cached (this is adjustable) and uploaded in the background, so there's no need to upload it separately or rely on other tools and workflows
- There's nothing that prevents you from doing one-off adjustments that match different requirements; for example you can pre-load the file(s) before you run jobs, or let Alluxio load on demand (as in this example). You can also write-through, and then evict results from the cache if you no longer have use for them - you managed to avoid writing them 3x to HDFS - good on you!

If you want to see how this works in real life, see the third video at the bottom of this post (the first two videos don't have that part).

The next run (with hot cache) using the same input file was in line with what we saw earlier with other cached files (5s for a 22MB file on this 2 vCPU worker):

- 04:06:52: Alluxio-proxied Hadoop starts wordcount job
- 04:06:54: map 0%, reduce 0%
- 04:06:56: map 100%, reduce 0%
- 04:06:57: map 100%, reduce 100%
- 04:06:57: task done

### Observations Related to SSD Cache

One caching feature that is a bit harder to demonstrate is how cached blocks go up and down the tiers (MEM and SSD in this post).

When you evict a file from Alluxio, it doesn't seem to go to SSD or HDD tier it's simply gone, so we can't demonstrate the use of SSD and HDD tiers that way.

I didn't want to try harder because there's not much point in doing that: we saw that SSD tier does get utilized, and we know the idea is to maximize the use of faster tiers, so as long as that tier isn't full Alluxio will prefer to populate it.

We can see in one of the screenshots and various CLI output samples above that SSD tier does get used when necessary, that thin provisioning makes it save empty space in less-than-full 64MB (by default) Alluxio blocks, and that slower than RAM but much faster than a remote non-cached S3.

It is very likely that multiple NFS shares would be better for the performance of SSD tier used with Alluxio, but because I didn't have any issues with performance in the simple tests I performed, I can't say at what point and with what workload that would become helpful.

## Benefits and Conclusion

In the video you will see that just reading a very remote 20 MB S3 object takes tens of seconds, and writes aren't any faster.

Alluxio writes to remote (underlay) layer transparently and quickly - the result of job above was written from in-Alluxio cache to StorageGRID.

Alluxio must download objects (we can't avoid that if objects are uploaded from other locations, bypassing Alluxio cache), but it downloads them faster and it's transparent to the user and application. We don't have to download data until we need it and we also don't need to know what we need. And - given cache that's big enough for working set - we can avoid waiting for local storage both when we write and read.

In summary:

- Alluxio needs one read per object, multiple in-RAM or on-disk copies may be created if necessary; we can flexibly decide how much copies. While shared filesystems like Hadoop also need one read, there may be less flexibility in terms of controlling its behavior and writes usually land on NL-SAS HDDs, thrice
- Data can be pinned in advance (e.g. for scheduled analytics jobs this afternoon, pin IoT files generated by 10am this morning (`s3://hahdupe/iot*2021-12-16-0*.csv`)) or otherwise fetched before jobs run
- You don't have to manually manage local cache, neither read nor write. That includes deciding where and when to save data, and remembering to delete it
- You can cache writes as well, if you want/need to do that. If you don't, you can write-through and bypass Alluxio
- You can take advantage of not just RAM, but also fast nearby storage tiers that don't consume 3x the capacity and anything they do consume can be thin-provisioned
- Data is persisted (or not - you can fine tune this behavior, too) to S3 while your compute and storage resources (as well as any software licenses or subscriptions) are better utilized
- Alluxio supports various underlays with various compute integrations at the same time. This allows you to use the same underlay (StorageGRID S3 storage) with different compute integrations at the same time. S3 overlay from this post can be used outside of Hadoop - from the shell, from Python scripts and in various other ways (see previous Alluxio-StorageGRID post) - it's not an island!

There's more, but you get the idea.

As a result, Hadoop and other analytics applications can make full use of S3 in ways that optimize both compute and data management.

As far StorageGRID is concerned, this approach also lets customers run on-demand analytics jobs in the public cloud: as an example, we could deploy Alluxio in hyperscaler compute nodes and use in-worker RAM for the `MEM` tier, and NetApp CVO or CVS as `SSD` tier for cloud-based StorageGRID cache. That would give us the same architecture and same benefits when using StorageGRID from the public cloud.

## Demo

- Shorter version: [Multi-tiered read-write cache for Hadoop with Alluxio and StorageGRID](https://youtu.be/EiU0cLzD-2U) - 2m06s
  - Longer version: [Multi-tiered read-write cache for Hadoop with Alluxio and StorageGRID](https://youtu.be/riRuotCOb9c) - 4m32s
- Additional segment about loading data to Alluxio cache by preloading or on-demand: [Starting with Cold Cache](https://youtu.be/w9wW416s1Po) - 2m47s
