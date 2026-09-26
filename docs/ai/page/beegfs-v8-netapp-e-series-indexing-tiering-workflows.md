# ThinkParQ BeeGFS v8 with NetApp E-Series

How to get most out of BeeGFS v8 with NetApp E-Series

- [Introduction](#introduction)
- [Data tiering with pools](#data-tiering-with-pools)
- [ZFS](#zfs)
  - [BeeGFS snapshots](#beegfs-snapshots)
  - [Role of snapshots](#role-of-snapshots)
  - [Cognitive overhead of ZFS](#cognitive-overhead-of-zfs)
- [BeeGFS copy tool](#beegfs-copy-tool)
- [Remote storage](#remote-storage)
- [File-system events](#file-system-events)
- [File index](#file-index)
- [Monitoring](#monitoring)
- [Conclusion](#conclusion)

## Introduction

BeeGFS version 8 recently came out and I wanted to celebrate that with a post that goes through new and underappreciated features of BeeGFS, especially in the context of NetApp E-Series.

Some of the "underappreciated" features came out in version 7, but were improved in version 8.

## Data tiering with pools

This isn't a new feature in version 8, but even if I've mentioned it before, it must have been briefly.

So, what's the big deal?

- A BeeGFS pool is one or more storage target (aka LUN) tagged for specific property (cost, performance, location, etc.)
- One can have a BeeGFS file-system with more than one pool
- Furthermore, one can easily move data (files or entire directory trees) between any two pools without stubs, shortcuts or other major inconveniences for users

As you guess, that allows us to mix different disk types or even arrays in the same BeeGFS file-system.

As an example, we could use high performance arrays (or media) in with R10 (for metadata) or R6 (for data) volumes and lower-cost QLC-based DDP-based LUNs in the same BeeGFS file-system.

Tiering is performed with a simple command that moves files from source-tagged LUNs to target-tagged LUNs (copy data from source to destination, redirect metadata to destination, delete source data when done).

![BeeGFS pools with EF600 and EF600C](/assets/images/beegfs-8-pools.svg)

BeeGFS file-system is literally (and in the schematic) a black box; file (chunk) location is obfuscated from the user. Lateral movement (tiering) moves files from one pool to another, but their file-system path remains the same.

We can get as fancy as we want - we could use one hybrid array (e.g. EF300) for everything (R10 TLC NVMe for MD, R6 TLC NVMe for Hot Data, R6 HDD for Cold Data), for example.

Just remember to watch pool and target fullness in order to avoid blowing up a pool. You also don't want to be too stingy and having to waste IO on moving data back and forth all day long.

This example below shows a BeeGFS file-system with 2 data disks: target_0-6826D866-1 (Tier 1) and target_1-6826D866-1 (Tier 2). When creating pools (`beegfs pool create`), target_1-6826D866-1 was assigned to `archive` tier. (I should have aliased the targets better...)

![BeeGFS and E-Series Pools](/assets/images/beegfs-8-pools-01-storage.png)

After giving the storage targets better aliases:

```sh
$ sudo beegfs target list
ID     TYPE     ALIAS           NODE  STORAGE_POOL  
s:101  storage  s101_default_0  s:1   s:1           
s:102  storage  s102_archive_0  s:1   s:2           
m:1    meta     target_meta_1   m:1   (n/a)         

$ sudo beegfs pool list
ID   ALIAS                 TARGETS  MIRRORS  
s:1  storage_pool_default  s:101             
s:2  archive               s:102  
```

By default, new files land on `storage_pool_default` constituents (before target_0-6826D866-1 and now s101_default_0, as I have just one storage target in the default pool, but normally we'd have 4 or more). 

If I examine this new file, I can see its location is as expected.

```sh
$ sudo beegfs entry info /mnt/beegfs/archive/flights-1m_v2.csv 
PATH                        ENTRY_ID      TYPE  META_NODE  META_MIRROR   STORAGE_POOL              STRIPE_PATTERN  STORAGE_TARGETS  STORAGE_MIRRORS  REMOTE_TARGETS  
/archive/flights-1m_v2.csv  4-68289A9B-1  file  m:1        (unmirrored)  storage_pool_default (1)  RAID0 (4x512K)  s:101            (unmirrored)     (none)          
```

When the file is no longer actively used (more on that later), I can move it to archive tier.

```sh
$ sudo beegfs entry migrate --from-pools=storage_pool_default --pool=archive /mnt/beegfs/archive/flights-1m_v3.csv 
Summary: {MigrationStatusUnknown:0 MigrationErrors:0 MigrationNotSupported:0 MigrationSkippedDirs:0 MigrationNotNeeded:0 MigrationNeeded:0 MigratedFiles:1 MigrationUpdatedDirs:0}
```

Don't be confused by its path (/mnt/beegfs/archive/), which doesn't change throughout. I could have had the file in /mnt/beegfs/, and later move it to /mnt/beegfs/archive/ - that *still* wouldn't move it to the archive tier. What moves it to another tier (pool) is the `entry migrate` command.

If it'd be less confusing this way, imagine having a workflow like this (recursive options are possible as well):

```sh
#!/usr/bin/bash
# Gets relative path of a file, moves it to /mnt/beegfs/archive/ and tiers to archive pool
read myfile
mv /mnt/beegfs/${myfile} /mnt/beegfs/archive/${myfile}
sudo beegfs entry migrate \
    --from-pools=storage_pool_default \
    --pool=archive \
    /mnt/beegfs/archive/${myfile}
```

Of course, you wouldn't *really* have scripts like these; you'd have this in your workflows, job scripts or some other place that runs them automatically.

One of the reasons for that is tiered files aren't supposed to be open (modified) during migration, so the best time to run them is right after jobs or workflow steps so that tiering doesn't become a burden. (Tiering up - to a higher tier - could be done *before* jobs or workflows start, of course.)

After entry migration, we can see that STORAGE_POOL is now `archive`.

```sh
$ sudo beegfs entry info /mnt/beegfs/archive/flights-1m_v3.csv 
PATH                        ENTRY_ID      TYPE  META_NODE  META_MIRROR   STORAGE_POOL  STRIPE_PATTERN  STORAGE_TARGETS  STORAGE_MIRRORS  REMOTE_TARGETS  
/archive/flights-1m_v3.csv  1-68289D0B-1  file  m:1        (unmirrored)  archive (2)   RAID0 (4x512K)  s:102            (unmirrored)     (none)    
```

Related to this, I'd also like to say a thing or two about ZFS.

## ZFS

BeeGFS supports ZFS (as well as other file systems) on Data disks and I've mentioned this on several occasions. I've also blogged about ZFS on E-Series in the context of LXD and Incus, so if you're interested in ZFS deduplication, compression, and such, check blog archives or use the search feature to find those posts.

Here I'll just point out that the screenshot above uses BeeGFS with ZFS metadata and data disks. 

It's important to remember that you won't get this from NetApp, as the BeeGFS solution from NetApp deploys vanilla file-systems (ext4, XFS), so you'd have to modify the Ansible deployment scripts to get this done. 

ThinkParQ does support ZFS and the pools feature requires Enterprise Edition features, which means you'd have this covered anyway. Just make sure you RTFM (BeeGFS v8) related to ZFS.

Back to the screnshot: 

- I used Ubuntu 24.04 with self-built OpenZFS 2.3.0 which is the version with smart(er) deduplication (I blogged about it with E-Series before it was released, so I won't repeat any of that)
- `storage_pool_default` pool: as this is my Tier 1 I have no compression, no dedupe set
- `archive` pool: this is Tier 2 and both compression and dedupe are enabled

Is ZFS dedupe super-smart? Not really, but it's good enough for Tier 3. Identical files will be deduplicated. Partial matches should be as well, but "it depends". The compression was and is legitimate, and you can pick any of several methods. I used ZSTD and LZ4 with BeeGFS but didn't compare (savings shouldn't be BeeGFS-specific).

We could have several archives with different (combinations of) settings, but it's better to not fragment your storage pools unless your data is very predictable in terms of data types and capacity.

### BeeGFS snapshots

Snapshots with ZFS are possible, but likely impractical. There's no way to "quiesce" a live BeeGFS file-system, so the only sure way would be to stop services (mostly `beegfs-client`, but preferrably all others as well) and then take a snapshot. This is how E-Series (SANtricity) snapshots could work as well, of course.

It's usually not possible to stop services, which is why I say snapshots without BeeGFS cooperation aren't practical, but you may be able to do that on some file-systems (e.g. file-system used for home directories at 6am). Once snapshots are taken, they can be restored when BeeGFS is stopped.

![BeeGFS with ZFS snapshots](/assets/images/beegfs-8-zfs-01-snapshot.png)

- (1) we delete files to simulate damage
- (2) stop BeeGFS services (at least beegfs-client, beegfs-meta, beegfs-storage, beegfs-sync)
- (3) we rollback all constituent volumes to latest ZFS snapshot 
- (4) BeeGFS services can now be started and all files from the third snapshot are back

The entire process can take less than a minute.

Following these steps I executed BeeGFS `fsck` which found 0 errors on the restored BeeGFS file-system.

The snapshot "third" is the one that was restored. (In the case you're wondering where's "second"; it was disappeared earlier when, having taken the snapshot "second", I rolled the pools back to "first" thereby destroying the second set of snapshots.)

```sh
$ zfs list -t snapshot
NAME        USED  AVAIL  REFER  MOUNTPOINT
md1@first   230K      -  5.10M  -
md1@third   210K      -  5.10M  -
zd1@first    20K      -  38.7M  -
zd1@third  20.5K      -  38.7M  -
zd2@first    19K      -  22.6M  -
zd2@third    19K      -  22.6M  -

```

Note that stopping services in order to snapshot and/or rollback snapshots may have unpredictable consequences, e.g. on Hive indexes and file-system notifications. Some of these potential issues aren't even necessarily related to snapshots (e.g. some notifications may fail to be delivered).

If these compromises and risks are acceptable, ZFS replication can also be used once we have snapshots to work with. Note that - unlike in regular stand-alone ZFS pools, here each metadata and storage target are stand-alone, practically "single disk" zpools and at the same time mutually dependent because they need to be "re-assembled" and imported into a BeeGFS cluster on destination BeeGFS cluster. Because that's not trivial and because I don't think many people would want to do this, I won't attempt to do that in this post.

### Role of snapshots

How many administrators are capable of understanding what rolling back a snapshot on a 10 PB file-system means and how that impacts various Hive indexes, external databases and downstream data consumers?

My guess would be: not many. In very insular, "data island" style environments with one or two applications it may be possible to understand what's going on. In an environment with many applications or where events and data cross cluster boundaries, it may not. If you roll a snapshot here, what happens to data that left the cluster but has been rolled back on your own cluster?

If I needed to design a snapshottable BeeGFS file-system attached to E-Series, I'd create a file-system from single array LUNs, so that I can take (and restore) snapshots using SANtricty Consistency Groups. In that way, snapshots of small (few TB) to medium sized (up to a few hundred TB) file-systems could be created regardless of file-system type on data targets. They would be limited by the performance of single E-Series array, but given their size and nature (prototyping, etc.), that could suffice for most basic rollbacks.

BeeGFS snapshots can be useful, but like SANtricity snapshots, they're unlikely to be viable cluster-wide. If you have the need for snapshots, consider one of these workarounds:

- Create smaller BeeGFS filesystems which can be taken offline and snapshot. As long as the restart cycles can be done faster than copying or rsync-ing data from a golden copy, this can be a good approach.
- Create temporary file-systems for experimentation and prototyping and copy data to those with BeeGFS copy (see [BeeOND](https://doc.beegfs.io/latest/advanced_topics/beeond.html)). These can be made of R0 disks for lowest cost and highest performance. Although copying is inefficient, in a fast environment copying 5 or 10 TBs can take just several minutes. Even if done 10 times a day, it's only 30 minutes of copying.
- Periodic BeeGFS sync to S3 with S3 versioning may sometimes be a better choice: there's no need for file-system and storage administrator intervention, and all uploaded versions are accessible to the user. (BeeGFS sync in v8.0 doesn't have the ability to use object versions, but if they bucket has them enabled, they should be available.)
- If rapid prototyping can be done better on a non-BeeGFS ZFS (or non-ZFS) NAS system in the same environment, NFS and ZFS can be HA-clustered with Pacemaker and Corosync (note: the NetApp BeeGFS solution with E-Series also uses Pacemaker and Corosync for HA of BeeGFS server pairs) to give you ZFS features in a compact environment that's easier to manage.

### Cognitive overhead of ZFS

I say this only half-jokingly because unlike the default storage and file-system configuration in the NetApp BeeGFS solution for E-Series, ZFS isn't trivial to get right, especially if deduplication is enabled. 

I won't deep-dive into this since my first-hand experience isn't deep enough, but you can find about it on the Internet. Some notes:

- Deduplication
  - Deduplication complicates things a lot, so don't even try unless you have plenty (2/3 or more) duplicate data.
  - Deduplication needs a lot of RAM (anywhere between 0.5-2 % of usable "dedupe pool" (sum of storage targets) capacity), so a dedupe pool with 1PB usable may need ~10TB of RAM (which, spread over several servers may cost more in extra software, servers, and RAM than deduplication can save).
  - Deduplication tables require lots of tiny reads and writes. That means that in the cluster depicted at the top we'd want to use special deduplication vdevs on the leftmost E-Series used for metadata. To physically segregate dedupe tables from regular MD disks used for BeeGFS, consider using dedicated R10 devices for that. That could still cause some interference on the controller level depending on situation (workload).
  - Because deduplication overheads are so significant, tiering data back and forth should be minimized. If unsure, implement 3 pools (Tier 1 with no dedupe, Tier 2 with compression, Tier 3 with compression and dedupe, for example).
  - Deduplication effectiveness with BeeGFS on ZFS will be lower than deduplication on individual ZFS systems because many duplicate blocks may land each on a different ZFS target, resulting in less (or no) deduplication.
  - Deduplication cannot be disabled without destroying a pool, so don't enable it without testing and making sure it's worth the trouble and extra resources.
- Compression
  - Compression is easy. Test some or all of the available algorithms and pick one for each filesystem (or device, if you are willing to break filesystem into several archive pools)
  - CPU is the main concern here. Don't use ridiculous GZIP compression levels for data that doesn't compress well, for example. Data is either compressible or not. Use lowest levels of LZ4 or ZSDT for starters, or get some sample data to pick an optimal algo and setting.
- E-Series-related notes
  - ZIL - intent log which must be protected - LUNs should be created on a R10 group based on NVMe SSDs
  - L2ARC ("L2" read cache) - I suspect we mostly don't need it too large for truly archived data. I think we'd want to have one device per one NL-SAS LUN, so that a Tier 3 pool has N L2ARC (~5% of storage capacity) and N storage vdevs. For example, a 1PB Tier 3 pool could have 16 x 64 TB NL-SAS storage vdevs and 16 x 3.2 TB SSDs (R0 or R10 on E-Series TLC). If archive data is expected to be slow or access to data is very random, you don't need almost any L2ARC for it (we may want to allocate ~1% for metadata read cache, though).
  - Special dedupe vdev - as mentioned earlier, R10 (2, 4, 8 NVMe SSDs for example) can be sliced into N LUNs for N stand-alone ZFS targets. Capacity requirement can be cut by using larger record sizes in ZFS
  - BeeGFS metadata - several LUNs on R10 group of NVMe SSDs as a RAID group completely separate from ZFS-related special vdevs. Note that in an all-ZFS BeeGFS these would still be used for ZFS, but as single-device zpools (1 LUN = 1 metadata target). Or we could use ext4 for MD targets and avoid ZFS on these LUNs. 
  - EF600 (NVMe) can provide ~1 million 4kB IOPS. Not knowing the precise breakdown between each use case for R10 LUNs makes the option of using a single big R10 group for everything interesting, but I'd consider this only if I could populate EF600 with at least 20 disks, to max out IOPS
  - For "all in one" R10 group consider underprivisioning NVMe LUN capacity by 30% (i.e. leave >=30% of usable unused) to leave space for garbage collection and accommodate >3 DWPD. I've blogged about DWPD before, so I won't repeat that. E-Series documentation refers to this as under-provisioning (of LUN capacity). I call it over-provisioning (of raw disk capacity, related to used LUN capacity).

To illustrate these comments about E-Series: after requirements analysis and storage design, the leftmost array (MD) might look like this: LUNs easier to size can be on smaller R1(0) disk groups while those with uncertain sizing or capacity requirements could be pooled on a larger R10 group.

![E-Series device and LUN layout](/assets/images/beegfs-8-e-series-ssd.png)

But if we weren't sure, we could just build a 24-wide R10. If lucky, we'd have enough IOPS and bandwidth for everything without squeezing any particular workload - it would be Kumbaya all day long. Another easy scenario is a simple low-cost, low-performance data dump area where we could use a single EF600 Hybrid (controller shelf full of NVMe flash in R10, expansion shelves with NL-SAS) and it'd all just work: 2.7 PB in NL-SAS (post RAID6) could be helped by 135 TB (5%) in R10 capacity for BeeGFS metadata and special ZFS disks. Need 10 PB? Add three more "pods".

Among the bad scenarios, one or two particularly busy SSD storage targets (e.g. dedupe vdev(s)) could slow down the other SSD-based LUNs and you'd be in trouble.

Using those flash storage-based LUNs on the first E-Series array and R6-based NL-SAS or SSD devices on other arrays, we'd assemble larger BeeGFS file-systems.

For the sake of simplicity, this image shows a single-tier BeeGFS-on-ZFS filesystem that has metadata on a R10 LUN and data spread across four ZFS pools - each single storage dev pool with its own ZIL, L2ARC, Dedupe devices.

![BeeGFS, ZFS and E-Series SSD layout](/assets/images/beegfs-8-e-series-on-zfs.png)

This isn't a recipe, but a starting point for further investigation. (In the easy "all in one" scenario this could be an entire BeeGFS cluster on a single EF600 Hybrid array.)

Because of large discrepancies in "real life" data and the many options throughout the entire stack (BeeGFS, ZFS, OS, storage), actual "optimal" configuration would probably differ from cases to case (but hopefully within an order of magnitude).

Unless you want to spend some time figuring all this out, it's best to enable compression on Tier 2 and Tier 3, and enable deduplication only if justified. If you want to prototype on a small scale BeeGFS cluster, consider using VMs on [ESXi](/2023/12/02/containerized-beegfs-with-netapp-eseries.html) or KVM (it's much easier than containers!).

## BeeGFS copy tool

Earlier I've mentioned BeeOND and the ability to resync-on-demand with `beegfs copy`. The command works on regular BeeGFS as well. 

Let's say we build a smaller, temporary system for job processing and our job needs data from `inbound` and `logs` to this new file-system. Our machine file has a list of BeeGFS cluster members we'll use. A total of 32 threads will copy files in 4 MB chunks. You may set up passwordless SSH among the machines involved in copying if you don't want to authenticate in console.

```sh
# start beeond on machinese in beeond-file.txt, use /zd3 on each, and mount filesystem at /mnt/beeond
beeond start -n /mnt/beegfs/config/beeond-file.txt \
    -d /zd3 \
    -c /mnt/beeond
# copy two source directories to /mnt/beeond
beegfs copy -m /mnt/beegfs/config/machine-file.txt \
    /mnt/beegfs1/archive/inbound /mnt/beegfs2/archive/logs \
    /mnt/beeond \
    -t 32 -c 4
# run compute job(s)
# stop and optionally (-d) delete beeond filesystem
# beeond stop -n /mnt/beegfs/config/beeond-file.txt -L -d
```

Source (and especially target) directories shouldn't be modified during copying, but as we said at 10 GB/s it'd take only 90 seconds to copy 1TB of data, so in many cases it will happen in a minutes at most - usually a fraction of the time required to run compute jobs.

If you plan to run multiple jobs on same source data, use beegfs copy to re-sync instead of starting over. One use case for this would be data cleansing or ETL prototyping. At the end of a successful run, we could use `beegfs copy` to copy data to the "main" BeeGFS file-system before deleting the temporary filesystem.

Since our sources above come from /mnt/beegfs1/archive/, one has to wonder: could we use `beegfs copy`to copy data from a deduplicated archive to BeeOND? Or should we use `beegfs entry migrate` and work on Tier 1 (without `beeond`)? Or work directly on Tier 2 (also without `beeond`)? 

As almost always, "it depends". But `beegfs copy` (with or without `beeond`) should often be the right answer. If data sets are too large to copy (not enough destination capacity or time to copy) then copying is out of question, but it usually won't be. You could also copy from a deduplicated pool to Tier 1 on the same BeeGFS file-system (rather than to a new temporary file-system), of course.

This 90 second animation shows the entire process from this and previous section:

- `beeond start|stop` (previous section) - create and destroy a temporary BeeGFS file-system
- `beegfs copy` - copy data from "main" BeeGFS file-system to temporary file-system for processing

![Beeond and beegfs copy animated demo](/assets/images/beegfs-beeond-setup-teardown.gif)

Beeond doesn't *have to* use shared storage. Compute nodes with fast internal media could use `beeond` to copy inputs to fast local storage for faster or lower-latency access. Whether `beeond` uses shared or local storage, `beegfs copy` is the recommended way to copy data from one BeeGFS file-system to another.

## Remote storage

This feature allows us to define Remote Storage Targets (RSTs) which are generally S3 buckets. 

Then we can configure push and pull to/from those RSTs.

I've been having problems configuring these, so I don't have much to say about them except that earlier I assumed pushing to an RST would evacuate data from BeeGFS. That doesn't seem to be the case. It merely *copies* data to an RST. Think of it as a tool for push/pull data exchange.

Originally I had hoped one would be able to delete pushed data from the source and pull it back if and when needed, but that doesn't seem to be a use case here. It's more like pull/push in [NetApp DataOps Toolkit](https://github.com/NetApp/netapp-dataops-toolkit/tree/main/netapp_dataops_traditional#cli-push-to-s3-directory) except that it should be much faster. 

In terms of RST support, NetApp StorageGRID and other S3-like services (MinIO, Versity S3 Gateway) can use E-Series storage (I've blogged about them in several [posts](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html)). MinIO and Versity can run in Kubernetes with E-Series as well. I think [Apache Ozone](/2022/07/06/apache-ozone-netapp-eseries.html) should work just fine. You could have any of these on a server (or three, especially with K8s and/or EC) attached to EF600 with NL-SAS. PBs of S3 at a low cost and headache-free management.

Note that for ZFS, `beegfs entry refresh` must be executed before `beegfs remote push`, so that ZFS updates sizes of new and modified files.

## File-system events

This also isn't a new feature, but it's been reworked for v8.

Why should we care?

You may have heard of AI. Or ransomware. Or workflows. These are some situations where file-system events can be useful. For the ONTAP people, FPolicy may come to mind. Or inotify, in the world of Linux.

In essence, BeeGFS can send them to two places: a gRPC listener (new) and UNIX socket (legacy).

Using the legacy approach, run beegfs-event-listener on the socket "file" `beegfs-watch` service sends data to. Example:

```sh
/opt/beegfs/sbin/beegfs-event-listener /run/beegfs/eventlog
```

Then, as stuff happens on file-system, event listener spits out FS events it reads from the socket.

![Legacy file-system events ](/assets/images/beegfs-8-events-01-legacy.png)

Now we just need to decide what we want to do with this.

For example, `LastWriterClosed` on `/mnt/beegfs/incoming/*.mp4` may be the thing we're looking for. Then we kick off `ffmpeg` and let it do its thing on the file and use RST to push processed videos out to an S3 bucket.

The BeeGFS 8 documentation gives an example of piping those events to a user script:

![Legacy file-system events piped to a script](/assets/images/beegfs-8-events-02-legacy-pipe.png)

This is a basic example, though. Normally we'd filter by event type and do things with that:

- Run anti-virus scanner (ClamAV, for example) 
- Run various data processing

For media, a data processing step could be format conversion (I [blogged about that](/2022/04/05/nomad-beegfs-eseries.html) in 2022).

For AI, data processing steps could be frame-by-frame analysis and tagging. Or you could automatically create file embeddings in a (vector) database.

For SIEM, data processing steps could be parsing and ingress of `.log` files to Elasticsearch.

For anti-ransomware and anti-virus, we could run a scanner, but we could also build own detection of suspicious file-system activity. More on that in the next section. Here I'll just say [I blogged](/2024/01/29/antivirus-scanning-for-on-premises-s3.html) about AV scanning and getting an up-to-date list of objects required external services (Elasticsearch, Kafka, etc). 

The watcher example from the documentation can be easily adjusted to initiate data pipeline processing along the lines of what I mentioned above: depending on document extension (and/or additional criteria such as path matching, owner and similar), new files can be processed as soon as last writer is done writing to the file.

![Legacy file-system events for data pipeline processing](/assets/images/beegfs-8-events-03-decider.gif)

While the modern (gRPC) BeeGFS file-system event listener service is robust, even this basic event processor would suffice for many use cases and can be created in minutes. 

You may wonder where are these tasks and steps scheduled. Unlike on some highly-integrated storage systems (e.g. Vast Data), there's no built-in generic message queue so we'd need to run our own service on BeeGFS or non-BeeGFS volumes - some extra work is required in exchange for flexibility and openness. Such services could run [on BeeGFS](/2022/08/11/nomad-pack-influxdb-beegfs.html) or elsewhere (e.g. services in [Kubernetes on non-BeeGFS volumes](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html)).

Supported BeeGFS file-system events are: flush, close, trunc, setattr, link-op, open-read, open-write, open-readwrite.

## File index

You can [read about it in TFM](https://doc.beegfs.io/8.0/hive/hive_index.html#beegfs-hive-index). My `tldr`:

- Scans MD and stores file metadata into a database file
- BeeGFS Hive Index can be stored in-tree or out-of-tree (i.e. you can keep it on some NFS share or a non-BeeGFS FS on R10)
- SQL qeueries can be issued against this DB. They're much faster than doing the same thing against file-system.

BeeGFS Hive database(s) are SQLite3 databases and the index path and other details are configured in /etc/beegfs/index/config. For example, my BeeGFS file-system has just one directory (/mnt/beegfs/archive) and accordingly there are only 2 index databases (one for file-system "root" and another for the archive directory).

```sh
$ dir -laR /work/index
/work/index:
total 60
drwxrwxrwx 3 root root    4096 May 17 14:43 .
drwxr-xr-x 3 root root    4096 May 17 07:29 ..
drwxrwxr-x 2 sean sean    4096 May 17 14:43 archive
-rw-r--r-- 1 root root   16384 May 17 14:43 .bdm.db
-rw-r--r-- 1 sean beegfs 32768 May 17 14:44 .bdm.db-shm
-rw-r--r-- 1 sean beegfs     0 May 17 14:43 .bdm.db-wal

/work/index/archive:
total 20
drwxrwxr-x 2 sean sean  4096 May 17 14:43 .
drwxrwxrwx 3 root root  4096 May 17 14:43 ..
-rw-r--r-- 1 sean sean 12288 May 17 14:43 .bdm.db
```

You may wonder if these are populated on-the-fly by BeeGFS Watch service. Not yet. It's planned, though.

Because there may be billions of files and directories, that could represent a significant burden for the file-system. Currently you need to create (or refresh) an index. Refreshes can be done overnight, for example. 

This screenshot shows index creation and a way to query entries.

![Query BeeGFS Hive index](/assets/images/beegfs-8-events-01-index.png)

- (1) create index
- (2) query index (there's a lot of flexibility in how this can be done)
- (3) use query results for other steps in your data processing pipeline

Unfortunately, `index query` does not yet support JSON output, so unlike with FS events (which we saw are native JSONLDs) we have to create a wrapper for CSV-to-JSON conversion, or store output to CSV and import that CSV in another step.

When watch and when Hive? I guess "it depends". If I can, I'd always prefer to have as much as possible done in Hive because that's "cheaper" in terms of resources. 

For example, let's say we want to index content of text files to be able to perform full text and vector similarity search:
- For SIEM use cases, we'd want it done with Watch service because it's important to spot problems quickly
- For RAG, maybe it's not essential to have content indexed in near real-time and so overnight (or hourly) recursive refresh of a bunch of directories followed by a SQL query may be a better approach

One popular use case for Hive index is deletion of files not accessed for more than X days from Tier 1 when Tier 1 is used exclusively for scratch space.

## Monitoring

This isn't new, but it's been improved. InfluxDB version 1.x is one of two supported InfluxDB editions and - as I said [here](/2025/01/24/influxdb-3-core-alpha.html) - that means version 3 is supported as well.

My advice would be to use InfluxDB 3 OSS and configure BeeGFS v8 for InfluxDB version 1.x as per [TFM](https://doc.beegfs.io/8.0/advanced_topics/mon.html#configuration). I haven't tried this myself (it's on my TODO list), but there's no reason this wouldn't work.

## Conclusion

BeeGFS version 8 contains some great improvements that I haven't even covered in this blog post. Some other features, added in recent years, have been integrated and improved, and yet others (monitoring) practically resurrected due to the appearance of InfluxDB 3 OSS.

BeeGFS Watch (file-system event monitoring) and Hive Index are very relevant in the world of AI and analytics, so I gave more space to these features. From the examples you can see there are multiple ways to process new data using these two features. Support for out-of-tree indexes, an open DB format and RST means BeeGFS name spaces are fully open to integrations *across file-systems, storage environments and locations*:

- place indexes on non-BeeGFS file-systems or NFS shares
- send file-system modifications updates to external gRPC listeners or process updates in own scripts/services
- push BeeGFS files or directory trees to any standard S3-like RST
- process files on BeeGFS or on S3 (on-premises or in the cloud)

Note that files **do not** necessarily need to be uploaded or copied to S3 for processing via S3. You may use [Versity S3 Gateway](/2023/09/20/versity-gw-s3-posix-gateway-beegfs-eseries.html) to access BeeGFS files via S3 as soon as they're written.

ZFS - after [improved deduplication](/2024/02/26/zfs-deduplication-netapp-eseries.html) that I blogged about in early 2024 - deserves another look, especially since E-Series arrays have recently (finally) added QLC flash media support (if only in EF300C and EF600C), so ZFS and non-ZFS pools have become an attractive option for anyone with compressible, duplicate or other data suitable for special handling (e.g. placement based on file age or access time).

Keep in mind that the license for pools require Enterprise Edition. Support for ACLs was considered an enterprise feature in version 7, but thankfully it's been moved to Community Edition in version 8.
