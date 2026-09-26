# ZFS deduplication with NetApp E-Series

How E-Series users may benefit from improved ZFS deduplication

- [Introduction](#introduction)
- [What's new with ZFS deduplication](#whats-new-with-zfs-deduplication)
- [ZFS and E-Series](#zfs-and-e-series)
  - [Benefits of using ZFS with E-Series](#benefits-of-using-zfs-with-e-series)
  - [Deduplication](#deduplication)
  - [Compression](#compression)
  - [E-Series models for ZFS with modern deduplication](#e-series-models-for-zfs-with-modern-deduplication)
  - [Disk layout and performance sizing](#disk-layout-and-performance-sizing)
- [ZFS hosts](#zfs-hosts)
- [Conclusion](#conclusion)
- [Appendix - Example with multiple ISO copies](#appendix---example-with-multiple-iso-copies)

## Introduction

As we all know, ZFS deduplication *still* sucks (as of v2.0). 

But that's about to change in coming months as they've been fixing it. 

Those improvements aren't yet available (may appear by mid 2024, I suppose?), but may be tested by building with related patches that are available so far.

## What's new with ZFS deduplication

The new approach is the same as the old approach, but it works without the outrageous RAM requirements and it's therefore much faster on the same hardware.

After it's been fixed, deduplication hash tables will work with much less overhead and therefore faster.  When deduplication table can't fit into RAM, things get slow: on-disk dedup table lookups slow things down, IO is randomized and CPU overheads explode.

With improvements in post-2.2 versions we should still get the same deduplication ratio, but with less system resources and less IO overhead and performance impact.

For an example, when deduplication tables don't fit in RAM the existing/old deduplication amplified writes by many times and the new approach will significantly reduce that.

Deduplication ratios are expected to remain the same and in my understanding enabling deduplication will still be advised only for volumes with efficient data (to save RAM and IO resources, including SSD wear).

In this case an ISO is copied to ZFS three times, and all repeating blocks are deduplicated with much less impact on host.

![ZFS deduplication savings](/assets/images/e-series-zfs-dedupe-compression-01.png)

That means most users will be able to turn it on - initially I'd start with simple/stupid pools such as low-traffic S3 storage or dump-to-disk destinations (if not for backup, as we expect those to work flawlessly), and ephemeral DevOps workloads (CI/CD, perhaps). 

## ZFS and E-Series

What does that mean for E-Series?

It means that users can leverage compression and deduplication while taking advantage of other E-Series features. 

### Benefits of using ZFS with E-Series 

Maybe I'll expand this post in the future, but in simple terms:

- With compressible data such as logs, compression may benefit you. I got 5.7x on a syslog sample, for example
- With repeatable data such as S3 service buckets that may store duplicate ISO files from various users, deduplication may save space
- For caching devices, E-Series can present individual disks (not RAID/DDP-based volumes), but that's optional
- E-Series has neither compression nor deduplication, so both of these features are very suitable and do not repeat the work done on ZFS host
- RAIDZ doesn't have much benefit for E-Series users, but may be used as well
- E-Series lets you create any number of protected CACHE, LOG, and SPECIAL devices on top of using any size you need. With dumb JBODs your minimal unit of media presentation to ZFS is a physical disk. With E-Series, if you expect you may need a number of RAID10 devices for ZFS you may create a RAID10 disk group and create LUNs in various sizes you need.

People who learned their storage on community forums for SOHO enthusiasts may tall you that using RAID-capable arrays for ZFS is a bad idea, but in most use cases for enterprises, it's a *great* idea. Here's why:

**1)** With E-Series, you *don't have to use ZFS*. Where it's better to use XFS, or BtrFS, or BeeGFS, or VMFS, or ReFS, use that! For example, for some [critical applications](https://www.theregister.com/2023/11/27/openzfs_2_2_0_data_corruption/) you may prefer the widely trusted XFS over the more novel ZFS.

**2)** With E-Series, you *don't have to use RAIDZ*. These days 7.84 TB NVMe disks are the norm. A ZFS "community person" who needs just 10-20 TB in ZFS capacity (say, for containers) will buy 8-10 smaller SSDs for one type of RAIDZ, and then separately another set of different disks for another kind of RAIDZ. 
 
If you use E-Series, you can buy 11 x 7.8 TB disks, put them in a DDP (pool), and create tens of RAID10 (for containers) and RAID 6 (for other stuff) LUNs for both of your use cases (and still can, but don't have to, use RAIDZ). This situation and benefit applies to great majority of enterprise users who want a balance between cost (of hardware, software, maintenance/operations) and performance. 

You may hear a clueless ZFS user claim one shouldn't use ZFS with another RAID and similar nonsense. If your RAID sucks, yes, you shouldn't. E-Series RAID does not suck and in many/most cases it's perfectly fine to use E-Series volumes for RAIDZ.

**3)** E-Series controllers let you present "raw" (unprotected, JBOD-style) disks to ZFS clients, so it's still possible to use some, or all disks that way. But you *don't have to*. So you can build a RAIDZ out of 5 SSDs, and build a DDP (with 50 LUNs) out the other (say 14) disks and create a number of single volume zpools on that DDP, whereas with RAIDZ you'd be limited to physical disk patterns and have several RAIDZ to maintain.

**4)** If RAID management is offloaded to the array, you can use ZFS without managing RAIDZ. 

**5)** Without RAID protection on storage, RAIDZ has to be managed on every ZFS host. Some of it can be automated, but it's still on every host. E-Series management is centralized atop of redundant hardware controllers and shelves that can manage hundreds of disks.

**6)** E-Series takes care of reconstructing DDP-protected groups similarly to latest zpool. But you can "consolidate" reserve capacity, and often reconstruct faster and without using host resources.

There's more than could be said here, but my point is not all "features" of ZFS save time and money. Some add value, but also add a lot of cost. 

### Deduplication 

Host (where ZFS is used) should not use deduplication if data is unlikely to be deduplicated much.

Unlike with NetApp SolidFire and some other arrays where it's all taken care of (and enabled globally by default), with ZFS all the "costs" of deduplication are transferred to storage clients (iSCSI, FC, etc.) - whether it's E-Series or SolidFire, storage clients with ZFS must do the work. (In the case of SolidFire it's redundant and is almost always harmful, as storage already compresses and deduplicates globally.)

For 100TB of client-visible capacity and 3x (NL-SAS) we may need to reference 33.33TB in dedupe tables using 8kB units. If I'm not mistaken that's 8332500000 in 4kB blocks. Each entry needs 320 bytes in dedupe hash table which would take TBs of RAM. Although the improved deduplication seems to work with larger blocks (8kB) for >10TB volumes it's still likely at least some dedupe table data have to be on a fast low-latency disk.

But with the improvements that will appear in 2024, including fewer bytes per block for entries in the dedupe table not everything deduplication-related will need to be in RAM *and* it will still work better.

Alternatively, for highly efficient data on small size volumes (e.g. 1TB of container space with all containers running Web apps), dedupe may be usable even now. Notice that with E-Series we can easily create a *protected* 1TB LUN and use it to create a single-disk zpool *protected* from disk loss. 

ZFS deduplication is zpool-based and looks likely to remain that way for some time, so if you want to deduplicate data across volumes, keep volumes with repeatable data on the same pool. That means you may want to create large but not too large volumes to avoid impacting recoverability or having a very low RAM-to-data ratio which may hold only a small fraction of dedupe hash tables in RAM. 

Because there's no cross-pool deduplication, if you expect a mix of data sets (i.e. cannot predict dedupe efficiency) it may make sense to have several or even dozens of zpools for one or more ZFS hosts. This is another example where E-Series RAID or DDP make sense - since ZFS volumes are easily transportable using ZFS commands, rather than having a large number of physical (JBOD) disks you may find it a lot more efficient to use a much smaller number of RAID or DDP groups. 

For example:
- Create one or two RAID10 (or even JBOD-style) for various volumes that need highest performance, lowest latency (and overprovision those by 15-20%). Dedup vdev, ARC, etc. could live here
- For Data, create a big DDP with RAID 6- and RAID 10-style volumes (for more on RAID 1 on DDP, see [this post](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html))
- Build all zpools using single-LUN volumes from DDP (again, RAID 6 for slow, RAID 10 for fast), with special disks on classic RAID10 volumes

That way you can have dozens of zpools on an EF300 and yet use 15-24 SSDs (example: 11 for DDP, 4 for RAID10, 1 hot spare for RAID10).

It appears the new deduplication feature will not support migration from old (current) systems with enabled "old style" deduplication. That means users will have to migrate datasets and volumes to new zpools to take advantage of it.

### Compression 

You can use one of lzjb, gzip, zle, lz4, zstd (some have several "levels"). To find out which is best you can create different ZFS pools/filesystems, populate with the same data and compare.

syslog data with LZ4:

```sh
$ sudo zfs get compressratio /dedupe/vol1 
NAME         PROPERTY       VALUE  SOURCE
dedupe/vol1  compressratio  5.74x  -
```

The same syslog data with ZSTD gives me 8.70x at the cost of a higher CPU utilization compared to LZ4.

You can and probably should always use compression (LZ4, which is the default). It may be used independently of deduplication and doesn't have a significantly big performance impact on host (especially LZ4) although it may be visible on <2 vCPU systems.

### E-Series models for ZFS with modern deduplication

I haven't done enough testing to be able to give some recommendations, but E-Series EF (currently EF300 and EF600) with end-to-end NVMe support may be better than the models with SAS SSDs. Of course, that especially applies to ZFS with improved deduplication which takes advantage of on-disk data without ruining the user experience or amplifying SSD wear level.

For deduplication 2.2 and before, it almost invariably sucks so it doesn't matter much which storage model you use.

Among the storage protocols available on EF arrays, assuming IO latency helps deduplication work better, it should be better to use NVMe or iSER rather than non-NVMe (plain iSCSI, for example) since EF arrays give you the ability to use NVMe end-to-end.

I'll update this post if I do some additional testing. Currently isn't easy to do, because new deduplication features are not yet available and ZFS patches with improvements have special requirements which my environment does not meet. 

Users who plan to use SSDs with ZFS (not just them) should pay attention to [media overprovisioning](/2023/01/17/eseries-ssd-overprovisioning.html) and set aside an extra 8%-16% if deduplication is used.

### Disk layout and performance sizing 

"It depends". Also, I haven't tested with E-Series. But here's what I'd try first:

- E-Series with 4 disks with RAID10 for low latency, fastest LUNs. Each ZFS gets a LUN/disk, and in ZFS configuration limit dedupe database table size to certain percentage of this volume (so that dedupe tables don't hoard out other caches). Dedupe table should fit well within ARC, so these LUNs should be sized accordingly
- E-Series with R6-style DDP for other LUNs/disks
- Hosts: depending on requirements, and depending which ones have or don't have volumes with deduplication enabled, can have plenty of RAM, or less tha plenty with dedupe disabled or if you don't mind to look up dedupe tables off your RAID 10 LUN. 

## ZFS hosts

I don't have much to say about this except that because of license limitations you may need to install ZFS on your own. On Ubuntu 22.04 LTS you need to do that with `apt` (I'm talking about "stable" version without the new deduplication enhancements).

It's interesting that Ubuntu 24.04 LTS makes that painless (although we'll have to wait for a version with new dedupe feature). Prior LTS versions couldn't install OS on ZFS, but this one can.

![ZFS built in Ubuntu 24.04 LTS](/assets/images/e-series-zfs-dedupe-compression-03-ubuntu-24.png)

Incidentally, Ubuntu 24.04 make take some time to make it to the E-Series Interoperability Matrix because it's still in beta, and because it may take time anyway. But 22.04 LTS works fine, as far as I can tell, and you can find my notes on using Ubuntu and iSER with E-Series [here](/2023/09/22/ubuntu-lts-netapp-eseries-iser.html).

## Conclusion

ZFS compression has always worked quite well, and deduplication may become more useful in a future ZFS version (whenever the new fast dedupe gets included). 

That doesn't mean that deduplication will become something that's enabled by default like it is in enterprise storage arrays, but it will become easier to use and have less overhead.

That makes ZFS an interesting option for E-Series users. It could be most useful in light-to-medium workloads with repetitive data, such as virtualization, containers, uncompressed logs (and even NOSQL when [deduplication savings](/2022/07/05/kafka-solidfire-efficiency.html) outweigh performance deterioration).

If you don't use ZFS at scale (1,000s of disks for example), it doesn't make sense to specialize in learning low-value ZFS features, especially when you *still* have to manage disks for other (non-ZFS) clients.

Once ZFS with properly working deduplication is released these features should work well with all E-Series with flash media, but EF300 and EF600 with end-to-end NVMe disks should work better than other E-Series models, media and [protocols](https://www.netapp.com/media/17113-tr4766.pdf).

## Appendix - Example with multiple ISO copies

This animated GIF shows the same data as the screenshot above, just in a series of animated commands.

![ZFS with deduplication demo](/assets/images/e-series-zfs-dedupe-compression-02.gif)
