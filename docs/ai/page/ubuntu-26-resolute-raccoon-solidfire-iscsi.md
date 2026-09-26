# Ubuntu 26.04 LTS with SolidFire iSCSI targets

Ubuntu 26.04 LTS with NetApp SolidFire iSCSI

## Introduction

Ubuntu 26.04 LTS is coming out within weeks, so it's time for another "let's check it out" post for SolidFire iSCSI targets.

## Prepare SolidFire and Ubuntu 26.04

I have SolidFire Demo VM 12.5 which is the last one they released. Newer ones won't work worse, so if you have any currently supported version 12, should be fine.

- Create a tenant (account), assign it an "Initiator Secret" in SolidFire
- Install iSCSI packages on Ubuntu 26.04

```sh
sudo apt-get install -y open-iscsi sg3-utils multipath-tools scsitools sg3-utils scsitools
```

I always recommend using the usual approach: LACP on both iSCSI clients and SolidFire. Then you don't need Device Mapper.

So although `multipath-tools` is included above (sadly, Trident CSI forces you to have it installed), you probably don't have to use it.

## The weird part

The weird part was after editing `/etc/iscsi/iscsid.conf`, I wasn't able to discover two sample LUNs. I tried setting MD5 (which is the default anyway) in iscsid.conf and that didn't make difference.

What worked was the annoying iSCSI configuration steps. First, get your iSCSI interface details:

```sh
3: ens192: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:0c:29:de:4f:a8 brd ff:ff:ff:ff:ff:ff
    altname enp11s0
    altname enx000c29de4fa8
    inet 192.168.105.222/24 brd 192.168.105.255 scope global ens192
       valid_lft forever preferred_lft forever
    inet6 fe80::20c:29ff:fede:4fa8/64 scope link proto kernel_ll 
```
Then configure iSCSI with the iSSI interace and its MAC address and try to discover again.

```sh
$ sudo iscsiadm -m iface -I ens192 --op=new
ens192 updated.
New interface ens192 added

$ sudo iscsiadm -m iface -I ens192 --op=update -n iface.hwaddress -v 00:0c:29:de:4f:a8
ens192 updated.

$ sudo iscsiadm -m discovery -I ens192 --op=new --op=del --type sendtargets --portal 192.168.105.34
192.168.105.34:3260,1 iqn.2010-01.com.solidfire:juut.test.5748
192.168.105.34:3260,1 iqn.2010-01.com.solidfire:juut.test4k.5749

```

I couldn't get discovery working without these two steps when using CHAP authentication.

Maybe just the first step is required while setting the MAC is optional - I haven't tried only one.

I'm not quite sure why this is needed now, but if you get "Could not perform SendTargets discovery: iSCSI login failed due to authorization failure" with Ubuntu Resolute Raccooon (26.04 LTS) and SolidFire >=12.5, try these [full configuration steps](https://ubuntu.com/server/docs/how-to/storage/iscsi-initiator-or-client/) which weren't needed in recent Ubuntu LTS releases.

I've never needed to use them in my environment before, and I've been using Ubuntu with SolidFire since 16.04 LTS.

```sh
$ sudo iscsiadm --mode node --loginall=all
Login to [iface: ens192, target: iqn.2010-01.com.solidfire:juut.test.5748, portal: 192.168.105.34,3260] successful.
Login to [iface: ens192, target: iqn.2010-01.com.solidfire:juut.test4k.5749, portal: 192.168.105.34,3260] successful.

```

Now I see two devices that I can use to create filesystems. The first one was created with 512e, the second 4096, on SolidFire.

```sh
Disk /dev/sdb: 3.73 GiB, 4000317440 bytes, 7813120 sectors
Disk model: SSD SAN         
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 4096 bytes
I/O size (minimum/optimal): 4096 bytes / 4096 bytes

Disk /dev/sdc: 3.73 GiB, 4000317440 bytes, 976640 sectors
Disk model: SSD SAN         
Units: sectors of 1 * 4096 = 4096 bytes
Sector size (logical/physical): 4096 bytes / 4096 bytes
I/O size (minimum/optimal): 4096 bytes / 4096 bytes

```

Initially I discovered them when startup was manual, so I had to update them to automatic logon (to survive reboots):

```sh
$ sudo iscsiadm -m node \ 
  --targetname iqn.2010-01.com.solidfire:juut.test4k.5749 \
  -p 192.168.105.34 \
  -o update -n node.startup -v automatic

$ sudo iscsiadm -m node \ 
  --targetname iqn.2010-01.com.solidfire:juut.test.5748 \
  -p 192.168.105.34 \
  -o update -n node.startup -v automatic

```

## Filesystems

XFS and ext4 are the two usual and recommended choices, but if you're looking for trouble…

```sh
$ sudo mkfs.btrfs /dev/sdb
btrfs-progs v6.17.1
See https://btrfs.readthedocs.io for more information.

Performing full device TRIM /dev/sdb (3.73GiB) ...
Label:              (null)
UUID:               5bdd13cd-7643-4cb1-937e-54f3b1716eb7
Node size:          16384
Sector size:        4096	(CPU page size: 4096)
Filesystem size:    3.73GiB
Block group profiles:
  Data:             single            8.00MiB
  Metadata:         DUP             256.00MiB
  System:           DUP               8.00MiB
SSD detected:       yes
Zoned device:       no
Features:           extref, skinny-metadata, no-holes, free-space-tree
Checksum:           crc32c
Number of devices:  1
Devices:
   ID        SIZE  PATH    
    1     3.73GiB  /dev/sdb

```

If you have developers who like to use Docker in VMs, Btrfs may be a good choice. Choose carefully!

## /etc/fstab

Remember to add `_netdev,nofail` to filesystems in `/etc/fstab` to depend on iSCSI network, and to not block OS from booting if network is gone.

Disk paths:

```sh
$ ls /dev/disk/by-path/*solidfire*
/dev/disk/by-path/ip-192.168.105.34:3260-iscsi-iqn.2010-01.com.solidfire:juut.test.5748-lun-0
/dev/disk/by-path/ip-192.168.105.34:3260-iscsi-iqn.2010-01.com.solidfire:juut.test4k.5749-lun-0
```

Because we default to single storage fabric, we don't need Device Mapper and can reliably use these paths. Mount the first filesystem (see btrfs mount options here):

```sh
$ sudo mount -o defaults,noatime,autodefrag,compress=zstd:2,commit=15 \
  /dev/disk/by-path/ip-192.168.105.34:3260-iscsi-iqn.2010-01.com.solidfire:juut.test.5748-lun-0 \
  /mnt/512e/
```

I mounted the second disk with XFS and added the two paths to /etc/fstab:

```sh
/dev/disk/by-path/ip-192.168.105.34:3260-iscsi-iqn.2010-01.com.solidfire:juut.test.5748-lun-0 /mnt/512e btrfs defaults,noatime,autodefrag,compress=zstd:2,commit=15,_netdev,nofail 0 0
/dev/disk/by-path/ip-192.168.105.34:3260-iscsi-iqn.2010-01.com.solidfire:juut.test4k.5749-lun-0 /mnt/4096 xfs defaults,noatime,_netdev,nofail 0 0
```

After copying some JSON junk (highly compressible) to both filesystems, I've rebooted. Some differences in filesystem behavior were immediately visible.

```sh
$ df -H | grep mnt
/dev/sdb                           4.1G  7.1M  3.5G   1% /mnt/512e
/dev/sdc                           4.0G  123M  3.9G   4% /mnt/4096
```

I sat tight until next garbage collection to see how SolidFire reacted to Btrfs.

- Btrfs volume (512e sector size): 374 non-zero blocks, 976,266 zero blocks (4 GiB device)
- XFS volume (4096 sector size): 3,882 non-zero blocks, 972,758 zero blocks (4 GiB device)

Great savings!

Notice that XFS may be significantly disadvantaged by 4096 byte sector size here, as any JSON file takes at least 4KB on XFS. If it was apple-to-apple with 512e sectors, savings from Btrfs with aforementioned mount options would likely be in 60-70%, not 90%, range.

And, as I wrote in the ZFS-related posts, what you save on Btrfs you may lose on cross-volume deduplication which works on SolidFire cluster level, but doesn't necessarily work across different Btrfs volumes on SolidFire. So, evaluate your situation and confirm assumptions to figure out what's better for you.

Still, this is one of those rare cases - keeping significant number of tiny JSON files on disks (who does that?) - where 512e would be a smarter choice regardless of filesystem.

## Conclusion

Nothing really new, but I was surprised that I couldn't discover devices without going through those silly interface-defining steps.
