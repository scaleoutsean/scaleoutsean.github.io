# Ubuntu 24.04 LTS with NetApp SolidFire

Ubuntu 22.04 LTS with ZFS and NetApp SolidFire 12

- [Introduction](#introduction)
- [Create, discover, login](#create-discover-login)
- [Efficiency - zpools on SoliFire vs global SolidFire efficiencies](#efficiency---zpools-on-solifire-vs-global-solidfire-efficiencies)
  - [Comparison with XFS and BTRFS](#comparison-with-xfs-and-btrfs)
- [Operational and data governance differences between ZFS and "classic" Linux filesystems (XFS, EXT4)](#operational-and-data-governance-differences-between-zfs-and-classic-linux-filesystems-xfs-ext4)
  - [ZFS in containers](#zfs-in-containers)
- [Conclusion](#conclusion)

**NOTE**: accounts and passwords from this post are given as examples and not used in production.

## Introduction

Ubuntu 24.04 LTS is now in beta and I tried using it with SolidFire demo VM 12.5.0.897.

It's expected to work, and it works, with NetApp SolidFire 12.

In the process I also tried ZFS with compression enabled to compare it with SolidFire's native compression and deduplication savings.

## Create, discover, login

I created a tenant account on SolidFire (using the credentials below) and two volumes. The second one was larger (4GB) and had a 4kB block size, just to try the both.

![SolidFire volumes](/assets/images/ubuntu-2404-lts-with-netapp-solidfire-volumes.png)

Then changed the following lines in /etc/iscsi/iscsid.conf.

```raw
node.startup = automatic
node.session.auth.authmethod = CHAP
node.session.auth.chap_algs = MD5
node.session.auth.username = u2404lts
node.session.auth.password = testtesttest
discovery.sendtargets.auth.authmethod = CHAP
discovery.sendtargets.auth.username = u2404lts
discovery.sendtargets.auth.password = testtesttest
```

MD5 is the default, but I list it as modified because I tried SHA3-256 which didn't work. Later I checked and remembered that SHA3-256 was added in [SolidFire 12.7](https://docs.netapp.com/us-en/element-software/concepts/concept_rn_whats_new_element.html#secure-chap-algorithms) and because SolidFire demo VM 12.7 wasn't released, that's why I don't have the latest version. So, if you're on 12.7 you may elect to choose another supported algorithm.

Install Open iSCSI initiator packages and their dependencies, enable open-iscsi service:

```sh
sudo apt-get install -y open-iscsi sg3-utils multipath-tools scsitools
sudo service open-iscsi start
```

Discover and login:

```sh
sudo iscsiadm -m discovery --op=new --op=del --type sendtargets --portal 192.168.1.32
sudo iscsiadm --mode node --loginall=all
```

## Efficiency - zpools on SoliFire vs global SolidFire efficiencies

For shits & giggles I created three zpools, each on a 4 GB SolidFire volume. 

![zpools on SolidFire](/assets/images/ubuntu-2404-lts-with-netapp-solidfire-pools.png)

I disabled compression on the first volume, enabled ZSTD compression on the second volume (which isn't something I'd recommend doing by default - see the [Proxmox post](/2022/04/05/proxmox-solidfire.html)) and LZ4 on the third, just to see how they fares against SolidFire's built-in LZ4 compression which cannot be disabled.

The way SolidFire works is it first compresses 4kB chunks using LZ4 and then deduplicates them. Deduplication wasn't enabled here (see my post on the improved [ZFS deduplication](/2024/02/26/zfs-deduplication-netapp-eseries.html) here), and I probably wouldn't enable it on SolidFire-based ZFS anyway (see the Proxmox post). 

But if you do, my intuition tells me LZ4 compression could work better when there are other filesystems on SolidFire. ZFS also first compresses and then deduplicates (in my case deduplication was off), so there's some chance that using LZ4 on ZFS may result in some dedupe between ZFS and non-ZFS filesystems. 

Using other compression algorithms, probably not. 

ZSTD is often better than LZ4 but it uses more CPU. ZSTD-compressed syslog got me 7.16x vs. , for example.

I added two larger files:
- 570 MB, a CSV file with lines like `Nicolette,Ward,440 Drivehaven,1967-12-08,R,6iJard,863`
- 524 MB, a reasonably compressable (should be around 50%) and moderately (20-30%) dedupable file

I copied these three on each of filesystem (OFF, ZSTD, LZ4). Each filesystem was on a separate 4 GB zpool. 

```sh
$ dir -lat /first/first01/
total 1078259
-rw-r--r-- 1 sean sean 524288000 Feb 29 13:39 data
drwxr-xr-x 2 sean sean         5 Feb 29 13:38 .
-rw-r--r-- 1 sean sean 576847227 Feb 29 13:38 output.csv
drwxr-xr-x 3 sean sean         3 Feb 29 03:26 ..
-rw-r----- 1 sean sean   2161348 Feb 26 03:22 syslog

$ sudo zpool list
NAME     SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
first   3.50G  1.03G  2.47G        -         -     0%    29%  1.00x    ONLINE  -
second  3.50G   542M  2.97G        -         -     0%    15%  1.00x    ONLINE  -
third   3.50G   680M  2.84G        -         -     0%    18%  1.00x    ONLINE  -

$ df
first/first01                      3.7G  1.2G  2.6G  31% /first/first01
second/second02                    3.7G  569M  3.1G  16% /second/second02
third/third03                      3.7G  713M  3.0G  20% /third/third03
```

Let's see how each approach worked out:

| Setting | ZFS vol ALLOC (GB) | SolidFire vol used % | 
|:--------|:------------------:|:----------------:|
| OFF     | 1.03               | 18.25 |
| ZSTD    | 0.54               | 14.88 |
| LZ4     | 0.68               | 28.21 |

![](/assets/images/ubuntu-2404-lts-with-netapp-solidfire-volumes-compression.png)

Compression-wise ZSTD got 1.94x vs. LZ4's 1.55, 21% better. But the ZSTD-compressed ZFS volume seems to work better on SolidFire. The first volume with uncompressed data was almost as good az ZSTD using only slightly less than ZSTD-compressed volume.

Below we can see that account deduplication rate is 1.05x. I mentioned I used some small deduplication in the file "data", around 25% or so, but even on the first uncompressed volume that doesn't seem to have had much effect. I attribute that to the fact that I didn't create them "correctly" - that is to say, duplication must have ocurred within parts of 4kB blocks, but to SolidFire they still looked different as entire 4kB blocks are checksum-ed and compared.

![](/assets/images/ubuntu-2404-lts-with-netapp-solidfire-account-efficiency.png) 

As I highlighted in the Proxmox post, the same (or similar) files on different non-compressed ZFS volumes would be compressed and deduplicated by SolidFire, but with zpools, all deduplication is "local" to a zpool, which we can see in this example as well - compression on ZSTD and LZ4 compression almost brought deduplication to 1x.

After deleting the two compressed volumes, account efficiency increased to 1.64 (1.46 x 1.10) which is in between what we got with ZSTD and lzr (1.94x, 1.55x, respectively), assuming those other two had SolidFire deduplication of 1x (possible, given that it went up by 4% after those two volumes were removed).

![](/assets/images/ubuntu-2404-lts-with-netapp-solidfire-account-efficiency-uncompressed-zfs.png)

Overall and depending on data, in some cases it's probably better to leave compression to SolidFire and then also realize some deduplication globally across all iSCSI clients regardless of filesystem.

On the other hand, 2x-4x compression may gain us 2x-4x performance on a volume, so if you're willing to trade global storage efficiency for lower iSCSI IOPS and/or bandwidth utilization as data coming in is already compressed it may still be wise to use compression. 

It seems that if we also used deduplication on ZFS then it would become even harder to predict what would happen. A lot of depends on the data, similarity between volumes/pools, etc.

OS, applications and containers dedupe well, so if you have lots of those compared to data and more than 2-3 zpools, I suspect SolidFire efficiency would be better than ZFS even with compression and deduplication enabled. While ZFS users may create a few large zpools to compensate for that, that means granularity of failover and the ability to apply different settings to different zpools goes away.

### Comparison with XFS and BTRFS

Two more experiments using the same 3-file data set above, after 2 hours "at rest" on a single volume per tenant:

- BTRFS: single 4GB filesystem with LZO compression
  - 1.45x compression (BTRFS LZO defaults to compression level 3 (1-9))
  - SolidFire volume 20.50% used 
  - Tenant's storage efficiency: 1.09x compression and 1.00x deduplication on SolidFire - probably a higher-lever back-end LZ4 compression (i.e. the one that does not work inline) manages to squeeze out a bit extra efficiency from BTRFS's pre-compressed blocks
  - On iSCSI volume BTRFS uses 777 MB which is a lower efficiency than ZFS with compression enabled
```raw
Data,single: Size:1.13GiB, Used:777.67MiB (67.04%)
   /dev/sdc	   1.13GiB
```

- XFS: single 4GB filesystem without compression
  - no compression
  - SolidFire volume 27.64% used
  - Tenant's storage efficiency: 1.46x compression and 1.09x deduplication
  - On iSCSI volume XFS uses 1200 MB which is a lot more, but after SolidFire efficiency (1.45 x 1.09 = 1.59x) it occupies 60% less on post-RF2 SolidFire storage
```raw
$ df -H
Filesystem Size  Used Avail Use% Mounted on
/dev/sdc   4.0G  1.2G  2.8G  30% /home/sean/xfs
```

XFS used 27.64% of SolidFire's 4 GB volume, while BTRFS with LZO compression used 20.50%. While BRTFS saved 27% percent on Linux volume, SolidFire saved 50% on XFS (tenant dedupe & compression efficiency 1.59x vs 1.09x). Additionally, cross-filesystem deduplication on SolidFire would likely drop considerably with compressed BRTFS which is a tradeoff similar to what we observed with compression-enabled ZFS.

**Notes**

The compression options on ZFS are many and with some algorithms each version works differently to another, and sometimes the same version may produce a different result depending on several factors.

On SolidFire, I got a different % used and efficiency every time I ran a test. Hours later, Solidfire's volume % used figures settled. It seems ZFS and/or SolidFire run some operations (maybe unmap on ZFS, and advanced LZ4 compression on SolidFire) up to hours later. Data in the the above table was taken 9 hours after running tests. In the first version of this post I did not wait that long and when I discovered that I tested again.

## Operational and data governance differences between ZFS and "classic" Linux filesystems (XFS, EXT4)

ZFS enables different operational approaches to SolidFire. 

Users can manage own storage including volume creation, volume snapshots, volume migration, volume replication, backup - all without access to the SolidFire API.

In some environments that may be a big plus, even if used by only a subset of users. 

At the same time zpools - which I'd recommend to create from single SolidFire volume (as SolidFire applies RF2 by default) - can still be protected and replicated with SolidFire snapshots and replication, so from storage administrator perspective zpool volume can be snapshot and replicated the same way as other SolidFire volumes, and the same data governance processes can work.

For a comparison, SolidFire doesn't have a great RBAC and although [it's possible](/2023/12/07/solidfire-rbac-for-json-rpc-api.html) to solve that in various not very complicated ways, the ability to get access to all those ZFS features eliminates the need for most if not all RBAC workarounds on SolidFire. 

### ZFS in containers

In container environments, NetApp Trident may be used with "classic" filesystems, and CSI snapshots are available. 

Interestingly, Trident CSI allows [only XFS, EXT3, EXT4](https://docs.netapp.com/us-en/trident-2307/trident-use/element.html) at this time. Anyone could patch it to allow ZFS as well, but it's not just a matter of adding a string, but also ZFS create, snapshot commands and possibly other options (compression, deduplication, etc.) so Trident CSI support for ZFS is probably unlikely to happen soon.

Those interested in ZFS in containers with SolidFire may want to look at some other approaches such as [Cinder CSI](/2022/03/02/openstack-solidfire-part-2.html) or static provisioning with replication (the latter would be wasteful for single SolidFire clusters, but may be interesting in environments where ZFS mirroring could be used in place of SolidFire synchronous replication).

## Conclusion

There's nothing special to note about Ubuntu 24.04 LTS - everything works the same way as with 22.04 LTS and 20.04 LTS.

![](/assets/images/ubuntu-2404-lts-with-netapp-solidfire.png)

In some cases enabling ZFS compression may help you get extra performance and/or lower latency on non-precompressed data, especially if you are willing to trade global SolidFire efficiency for that. Because compressing data on hosts may reduce deduplication on SolidFire, perform testing and observe SolidFire deduplication rate before you commit to doing this for a large fraction of your SolidFire data.

Assuming you trust ZFS, you may realize considerable performance gains without losing a lot of SolidFire capacity by applying both compression and the improved deduplication (once the latter becomes available) on selected volumes.
