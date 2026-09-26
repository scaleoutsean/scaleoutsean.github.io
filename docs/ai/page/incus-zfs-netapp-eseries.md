# ZFS with NetApp E-Series

Practical use of NetApp E-Series-backed ZFS from Incus/LXD

- [Introduction](#introduction)
- [What is E-Series anyway](#what-is-e-series-anyway)
- [Easy storage management](#easy-storage-management)
- [Conclusion](#conclusion)

## Introduction

This posts is for Incus (or LXD) or ZFS users interested in offloading some of the work to NetApp E-Series.

I've written about the reasons why one may want to do that in the post on [ZFS deduplication](/2024/02/26/zfs-deduplication-netapp-eseries.html).

This posts gives an example of a setup with Incus or LXD hosting VMs or containers on a ZFS pool that resides on a E-Series disk array.

## What is E-Series anyway

It's a NetApp product line of classic dual-controller storage arrays.

The [deduplication post](/2024/02/26/zfs-deduplication-netapp-eseries.html) explains some benefits of not using JBOD with ZFS, so I'll skip that part.

We are using a 2U shelf with dual controllers and 24 disks.
- Some disks are allocated to a "pool" ([DDP](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html) which is similar to a multi-disk zpool). These can be very wide (e.g. 100s of disks) and on top of a DDP we create RAID 1 or 6-type LUNs for ZFS or other hosts
- Some disks are grouped in traditional RAID (0/1/10/5/6). RAID0 is not protected, so it doesn't make sense to stripe it - single-disk RAID0 would usually have just 1 LUN on top of each and be presented to ZFS hosts verbatim. Protected RAID always has more than one disk, so it makes sense to create multiple LUNs for one or more ZFS hosts
- This screenshot shows 1 DDP (pool), 6 volume groups, with a total of 11 volumes (LUNs)

![](/assets/images/incus-zfs-eseries-01-controller-pool-groups-volumes-hosts.png)

The DDP has 16 disks an can be grown in small increments of a single disk. On it, stripes in RAID10 LUNs are written to random 10 disks at once (128kB each strip) and the same goes for RAID6 LUNs.

The first RAID 0 (sean_raid0) made of two disks is unusual (we'd commonly create RAID 1 out of two disks), but the point is RAID 1 or 10 can be used as the base for a any number of LUNs for whatever purposes (cache, etc.) without having to dedicate a physical disk to each LUN.

RAID 0 named `Z(number)` are individual disks as RAID 0 - same as JBOD. You can present them to hosts that are happy with that granularity (1 SSD) and protection (none).

![](/assets/images/incus-zfs-eseries-02-pools.png)

On this array I've created a bunch of LUNs (11), most of them on the pool (sean_ddp). We'll use just one protected LUN (ddp_r1_04) which is a RAID 1-style volume on sean_ddp.

![](/assets/images/incus-zfs-eseries-03-ddp-lun.png)

Incus (or LXD) can create a protected single volume zpool on that disk. We see it in action here. Normally - with JBOD - you'd use a bunch of disks but here we use just one LUN of arbitrary size (here: 200 GiB), stored in hundreds of RAID 10-style stripes on the first DDP. If you move from another platform or want to allocate LUNs, rather than a lot of physical disks, to different hosts or groups of hosts, this is very convenient.

![](/assets/images/incus-zfs-eseries-04-zfs-pool.png)

As you create instances - whether it's VMs or containers - ZFS works as it normally does. But you don't have to deal with physical media protection, rebuilds, and security - E-Series does that for you.

![](/assets/images/incus-zfs-eseries-05-zfs-instance-create.png)

ZFS snapshots work fine, of course, and take a fraction of a second. By the way - when you're upgrading Incus (or LXD) you can take a short-lived snapshot of the E-Series volume ddp_r1_04, just in the case upgrade fails. If you have multiple disks in your Incus pool, you can snapshot them as a group using group snapshots. Anyway, most of the time you'd use ZFS snapshots that are accessible to Incus users, rather than storage administrators.

![](/assets/images/incus-zfs-eseries-06-zfs-snapshot-create.png)

A snapshot has been created.

![](/assets/images/incus-zfs-eseries-07-zfs-snapshot-restore.png)

ZFS volumes also look as usual, with one snapshot visible in the column Snapshots.

![](/assets/images/incus-zfs-eseries-08-zfs-pool-overview.png)

Host view is as you might expect from Linux - DevMapper multi-pathing has been configured, but ddp_r1_04 is "missing". Why? It's created and used by Incus, not by the host. When initializing zpool for Incus we told Incus to use that device (/dev/mapper/DEVID) and that was it.

![](/assets/images/incus-zfs-eseries-09-zfs-overview.png)

Above you can see that other LUNs from sean_ddp (ddp_r1_01 and ddp_r1_02, for example) are exposed to host and used for other filesystems (XFS, for example). (There's another "host-side" zpool created on this system - it's called `default` and mounted at `/default`, but it's not used by Incus). 

This particular host is connected to E-Series with direct-attach Infiniband (and uses iSER), but iSCSI, FC and other protocols are available. With iSCSI, as there are 4 x 25GigE ports per controller, so you can connect up to 4 ZFS hosts (2 HA pairs) to an array without having dedicated storage switches.

Compression, when enabled and used on ZFS with compressible data, can save capacity and lower flash disk wear.

![](/assets/images/incus-zfs-eseries-10-zfs-compression.png)

If you're also interested in deduplication, please see the ZFS deduplication post linked at the top. 

For general VMs with non-compressed data, you may save 30-60% that way (that is, 1.50x to 2.00x is common).

## Easy storage management

From Incus, all you need to "know" about storage is you can set quotas, create or restore snapshots. 

If Incus pool starts running low on capacity, we'd simply create another zpool from one of other disks exposed to the host and add it to Incus.

Because you can create LUNs of arbitrary sizes, you can granularly provision zpools to different Incus projects, so that each team or department has own zpool or zpools. 

Because zpool is already protected by RAID 10 or RAID 6 on E-Series LUNs that live on DDP pools, there's no need to create complex configurations on Incus. While one could certainly create volumes on traditional RAID disk groups or even give LUNs made of an entire single-disk RAID 0 to Incus, but those seem like niche use cases as ZFS administrator would have to protect them by host-side replication or ZRAID. 

My primary choices would be:
- general use LUNs for ZFS: RAID 6 LUNs on DDP
- faster general use LUNs for ZFS: RAID 10 LUNs on DDP
- fastest, specialty LUNs for ZFS (ARC, etc): LUNs on classic RAID 10 disk groups

## Conclusion

If you use multiple filesystems or don't want to create large ZFS configurations, using protected storage saves you effort and time. 

Whereas experimenting with production-grade storage may take you multiple servers with 10-20 internal disks each, E-Series lets you start with mere gigabytes and offload the hard part of data protection from ZFS to E-Series while at the same time other filesystems and applications (Windows, VMware, etc.) can keep running fine using the same E-Series array.
