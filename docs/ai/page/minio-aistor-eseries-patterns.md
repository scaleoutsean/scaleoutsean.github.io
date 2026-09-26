# E-Series and MinIO AIStor Enterprise Lite patterns

Single node clusters are now an Enterprise approach.

## Introduction

I've written about the MinIO rug pull ([at first gradually](/2025/06/06/whats-minio-up-to.html), then (maintenance mode and AIStor announcement) suddenly) and also on MinIO with E-Series.

So, why again?

After what looks like the final cripplening, formerly freeloading customers are left with the following options:
- Non-commercial registration-ware also known as MinIO AIStor Free
  - Sales lead generator for MinIO
- Single-node Enterprise Lite (currently up to 400TB)
  - Compromise-ware for the less extreme MinIO freeloaders and MinIO users who can't be bothered with MinIO's architectural brainwashing
- Enterprise 
  - For the extreme freeloaders who can't migrate away, and everyone who's happy with MinIO

Why write about MinIO again?

It's mostly to re-frame the previous recipes for "MinIO" along these new product editions.

The old "enterprise" pattern (wide EC) is still there unchanged, but the "don't do this" patterns I have suggested for years have now become "enterprisey" so I'll focus mostly on these "graduated to enterprise" single-host and multi-host patterns that take advantage of protected storage.

## NetApp E-Series architecture patterns

We've seen it many times in recent decades starting with HDFS which was supposedly going to eliminate the need for shared storage. Or something that was specifically not recommended for production use is now considered "enteprise-ready".

In this case the MinIO visionaries have done both:
- claimed for years protected storage was unnecessary
- now they call their *single-host, single-disk* deployment mode "Enterprise Lite" (despite the fact that you can't use EC with just one disk, so clearly more than 99% of those "enterprise" users will be using protected storage)

And now they're happy to sell you an "enterprise license" for this exact use case.

This blog has been consistent over years and what I've always said is if you say single host deployment is enough for you, it's enough for you.

ScaleoutSean 1, MinIO 0.

### AIStor Enterprise Lite

Check it out [here](https://docs.min.io/enterprise/aistor-object-store/installation/linux/install/deploy-aistor-on-ubuntu-server/?tab=973e351b-single-node-multi-drive#retrieve-your-license-file) - apparently all these are now "enterprise" deployment patterns:

- Single node, single drive
- Single node, multiple drives
- Multiple nodes, with one or more drives per each node (this was always the case even before AIStor)

### AIStor Enterprise

This is where deployments gets big and more unwieldy, and they push their own concepts because it's easier to do that than create custom solutions for every individual customer.

While it's absolutely fine to use the same "lite" patterns with E-Series, advantages gradually diminish (although they never completely disappear). 

But even in the "gray area", as you get exposed to MinIO's brainwashing and they push you to buy MinIO-ready nodes and pretend they don't know how to configure EC 4+1 on protected 3rd party storage, you are at risk of becoming a JBOD administrator for no good reason.

Do you need JBODs and EC:4 for 1 PB of slow S3 storage? No, but they'll push you to buy that anyway.

### Advantages and disadvantages of three AIStor patterns with NetApp E-Series

I'll just summarize the previous technical posts on Minio, as nothing has changed.

#### Single node, single drive

- Think single bare metal server directly attached to E-Series. Or a 2-node, single-active bare metal cluster with CoroSync and Pacemaker-enabled HA (like BeeGFS with E-Series, just replace the BeeGFS packages with MinIO)
- This mode requires external HA (Pacemaker, VMware, Hyper-V, etc.). MinIO likes to remind us there's no protection against corruption or data loss, but you're not running this on unprotected storage - your data is on protected E-Series
- The main disadvantage is failover may take a minute to be detected and executed. Most S3 applications can retry and recover. If you have such applicaations and just few tens of TBs, you may not need anything more

#### Single node, multiple drives

- Compared to "single node, single disk" pattern, you can use MinIO's EC to better protect your data, but with E-Series that would hardly buy you anyting. With DDP, for example, your data is already well-protected.
- Another advantage is you can have 6 x 64TB LUNs rather than one 256 TB LUN and shorten time required to `fsck` a volume in the case an unplanned shutdown damages a filesystem
- You could apply no erasure coding (EC:0) and just stripe across RAID-protected LUNs of E-Series. On some arrays, that would give you better performance as a single host can deliver more than you can get from a LUN. With E-Series if you need multiple GB/s (and have enough disks) that also makes sense. You can also use some "greater than 0" EC (EC:1, for example) on top of E-Series protected volumes, but that seems unnecesary unless you want to satisfy MinIO Support and tell them "yes, I do use EC". For the sake of an argument, let's say you have 5 LUNs and configure EC 4+1. Good? Sure, you may be able to get 10 GB/s if your host is good, but your [smaller objects may perform poorly](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html). EC:1 may be slightly more resilient, but this seems negligible.

We [know](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html#appendix-a) we can get multiple GB/s from a single server connected to E-Series. For more than that, use multiple servers.

This shows a MinIO server with multiple disks on top of the same DDP pool. EC:0 or EC N:M will both work. EC 2:1 seems excessive and you don't have to carve LUNs based on physical disk sizes, so rather than 3 LUNs (for EC 2:1), create five, for example, and use 4:1.

![MinIO with multiple disks on single DDP pool](/assets/images/minio-ec-with-eseries-server-02.png)

The question of disk growth: you could resize all LUNs on stoage, rescan, grow file system (ext4 or XFS) to fill the new volume size, and do all this online without stopping service.

On the point of pleasing MinIO Support, I wouldn't worry about it.

> Optional add-on: Enterprise Lite Support with <5 day SLA

Yes, [that's right](https://www.min.io/pricing). If you upgrade Enterprise Lite with support (on top of the license), they'll get back to you within a week. By then you'll either restore your data from a backup in AWS Glacier or be fired.

If your workload has a lot of small (less than 64KB) objects, you may be better off with EC:0.

I'm not sure if it's correct to say that with MinIO's EC:1 (or better) you can't lose a single object due to unplanned JBOD-based cluster shutdown. If that's true, you wouldn't lose it on protected storage either and may be enough to justify non-null EC if you can't afford to lose any objects. On the other hand, I am not sure if such S3 users would buy AIStor anyway - there are better options for that.

#### Multiple nodes, with one or more drives

- This is where you end up in MinIO's JBOD paradise and become a JBOD storage admin
- You could repeat the same pattern from my examples above and use protected storage - especially if you don't want to buy a bunch of servers just to get what you can get much more efficiently from E-Series in fewer RU, but if you also *need* dozens of servers for 00's of GB/s of performance, then the use of MinIO's approach to AIStor storage makes more sense compared to protected storage: you'll buy more than 10 servers in any case
- Let's say you want a 3 node MinIO cluster with EC 2+1. This gives you HA, erasure coding and to do it you need deploy just three physical servers with one or more LUNs shared to each. Now you can survive node reboot without downtime and even overcome node's connectivity issues (on front-end to user or back-end to storage). On E-Series, you could have three RAID 5 volume groups (with EC 2+1 on top of three volumes), a large DDP group and put EC 2+1 on volumes (equivalent of R5-on-R6).
  - Three volumes on three RAID 5 groups give you redundancy and physical disk segregation, so you can surive multiple disk failures. But you need at least 3x(2+1)=9 disks for three minimal R5 volume groups and you should also have a global hot spare. And then you'd have three weird RAID 5 groups and a difficult path forward to expand RAID 5 (the least clumsy way would be to grow in 3-disk increments i.e. add a new R5 group)
  - Or you could get 11 disks, create a DDP and RAID 6-style volumes each of which can surive double concurrent disk failure in DDP. Much better, in my opinion. You can also grow this DDP in single disk increments and it all fits best practices with E-Series 
  - No matter which of these two approaches you take, you can use or not use EC. It's "better" to use it, but it's also pricier with fewer MinIO servers. For example, can you do EC:4 with 4 servers? Not really. With 4 MinIO servers you can do EC:0. Or EC:1 (3+1 or 6+3, i.e. EC:1). I've blogged about this in my older "MinIO-with-E-Series" posts

## Conclusion

After years of talking nonsense, MinIO's formerly "not suggested for production" deployment patterns have now become enterprise-worthy.

Now it's apparently OK to run a stand-alone MinIO AIStor Enterprise Lite node backed by a single 128TB LUN if that's exactly what you need. Which this blog and its readers knew years ago.

MinIO's EC is of course very useful for several situations and use cases including those they focus on.

But you have to match those in order to be able to justify such a deployment cost-wise. If all you need is 5-10 GB/s for backup to S3 and have just 1PB of storage, why on earth would you buy half a dozen servers for that? That's doable in storage *and* the same storage system still can run your VMware and other workloads.

Only the largest MinIO users need Erasure Coding and don't need protected storage.

With "Enterprise Lite" I guess 50% of their "enterprise" customers will be running single host clusters and some will run multi-node clusters with EC:0 or EC:1 to take advantage of existing protected storage they already have. Very few busineses want to manage JBOD storage for one application, especially when that's even more expensive than throwing the same workload on existing storage that has sufficient protection, performance and capacity.
