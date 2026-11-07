# CetraFS, Proxmox and NetApp EF-Series NVMe/RoCE

Cluster file system CetraFS with Proxmox VE and NetApp EF-Series

## Introduction

[CetraFS](https://github.com/cetrafs/cetrafs) is on Github:

> kernel and userspace code for cetrafs, a clustered, shared-disk filesystem for Linux

[TFM is here](https://cetrafs.com/docs). Disclaimer from the status section:

> Beta software

Okay, that aside, if you run PVE with E-Series and want to kick tires on several LUNs, why the heck not?

## Setup

I didn't have two PVE servers to try shared file system features, but as far as "getting started" is concerned, here's a single node environment I used:

- Proxmox VE 9.2.26
- CetraFS 0.9.4
- NetApp E-Series EF600 with SANtricity 12.1 (NVMe/RoCE)

I started by installing from the source on a different box (this was the idea for trying out CetraFS's shared file system features) - an Ubuntu 26.04 - but that failed with some kernel build errors, likely due to a missing package or an incompatible kernel version. It wasn't likely to work,but I had to try as I didn't have two PVE hosts.

Then I shifted to a slower gear and moved to single host setup on a simpler and well-documented stack: PVE itself.

I used [the steps for PVE installation](https://cetrafs.com/docs/how-tos/install-proxmox/). That failed because my kernel was too old. I upgraded to latest I could get (7.0.14-*-pve) and rebooted. Then it worked fine. 

Next, I found a volume that seemed unused, `/dev/nvme1n7`.

There's a (block device) [compatibility test](https://cetrafs.com/docs/how-tos/check-caw/) for CetraFS, but it's not NVMe-enabled, so that didn't do anything. See the Gotchas section below for more on this.

Next, I `insmod`-ed filesystem module and formatted the disk. Notice the commands are relative to the path from instructions, although - if you installed these things based on the same instructions - you could use the path where install copied these executables to.

```sh
root@h3:~/code/cetrafs# sudo ./userspace/mkfs.cetra  /dev/nvme1n7
cetrafs mkfs completed
  device bytes: 21474836480
  filesystem bytes: 21474836480 (blocks=5242880)
  ZGs: 16, BGs: 19, BG size: 262144 blocks (1024 MiB)
  inode_bmap: LBA 36+1, inode_table: LBA 37+5120
  node_table: LBA 5157+64 (capacity 64 nodes)
  pending-free queues: LBA 5221+4096 (per-ZG 256 blocks)
  journals: LBA 9317+32768 (per-NODE 512 blocks)
  BG table: LBA 17+19
  BG regions start: LBA 42085
  ZG<->BG ownership: round-robin, 1-2 BG per ZG
  SB CRC32C: 0x37D75E8F

```

No issues there. This was the disk, one of the NVMe disks from EF600.

```sh
root@h3:~/code/cetrafs# nvme list | grep nvme1n7
/dev/nvme1n7          /dev/ng1n7            952103002724         NetApp E-Series 6000                     0x7         21.47  GB /  21.47  GB      4 KiB +  0 B   02100100

root@h3:~/code/cetrafs# uname -a
Linux h3 7.0.14-28-pve #2 SMP PREEMPT_DYNAMIC PMX 7.0.14-28 (2026-11-02T11:54Z) x86_64 GNU/Linux
root@h3:~/code/cetrafs# date
Fri Nov  6 03:05:14 PM CST 2026
```

Since that went fine as well, I used that filesystem to create a data store on Proxmox, move a VM from a Shared LVM data store to CetraFS, boot it, update it, and it just worked.

![CetraFS on E-Series](/assets/images/CetraFS-proxmox-eseries-00-cli.png)

## Limits and gotchas

Don't forget to check out the page with [limitations](https://cetrafs.com/docs/reference/limits/) - there it says that, if the test (that doesn't work on NVMe yet) doesn't pass, then filesystem is single-host only. So I was lucky that I couldn't get anything done on the first box (Ubuntu 26.04) as that would have meant the second wouldn't work.

Notice that, even on E-Series EF models, there is [Fibre Channel support](/2026/03/21/netapp-ef-series-ef80-ef50.html), including SCSI variants. E-Series E4000 models are mostly SCSI. So, your E-Series environment may let you run these tests with a different outcome. I don't know what it's going to be, but E-Series supports VMFS, which isn't quite the same compatibility test as with CetraFS, but it's similar enough so the CetraFS check is more likely to pass than not.

The limitations page has some other details worth reading about.

## Conclusion

As the authors say, it's not a mature product, so take it from them.

But, it's a "free VMFS" for Proxmox, sort of, which is very nice. 

As a reminder, when it comes to *shared* storage for PVE (not shared devices with single-host access):
- We can use VM-based [NFS datastores](/2026/03/11/proxmox-pve-nfs-rdma-netapp-eseries.html), but the VM needs to rely on PVE for HA, which means NFS service failover is "cold"
- We can use CetraFS. If this works with SANtricity OS and it behaves similar to VMFS, this would be a very promising alternative - less stability and maturity, but potentially a lot more convenience. 

E-Series users with NVMe storage seem currently limited to "single host CetraFS", until NVMe support is added.

Remember that, with a custom module, you need to `hold` your kernel steady and can't just upgrade without caring for what happens to the CetraFS module.

You may want to read the CetraFS team's [take on Proxmox storage choices](https://cetrafs.com/docs/concepts/proxmox-shared-storage/). It mentions the same point about NFS I made in my NFS post for PVE and just above. I also agree on the point regarding thin vs. thick (Shared LVM) - that's exactly why I wrote about using NFS VM, to work around that for Tier 2 and 3 VMs:
- Thick and important - Shared LVM
- Tier 2 and Tier 3 - NFS VM

I do agree that CetraFS strikes a good balance and solves this dilemma, once it becomes production-ready. 

My longer post on this topic of choices with block can be found [here](/2026/03/01/proxmox-pve-with-netapp-eseries.html). I also have posts on monitoring and several on using E-Series with Proxmox Backup Server.

## Appendix A: Screenshots

Initialize the disk with CetraFS filesystem:

![Initialize disk with CetraFS filesystem](/assets/images/cetrafs-proxmox-eseries-01-pve-add.png)

Create a Thin LVM Pool:

![Create Thin LVM pool](/assets/images/cetrafs-proxmox-eseries-02-pve-thinpool.png)

Move a VM from Shared LVM to CetraFS and boot it:

![Move a VM from Shared LVM to CetraFS](/assets/images/cetrafs-proxmox-eseries-03-pve-move-vm-disk-cetrafs.png)

VM on CetraFS:

![VM on CetraFS](/assets/images/cetrafs-proxmox-eseries-04-pve-vm-disk-on-cetrafs.png)

CetraFS capacity utilization:

![CetraFS capacity utilization](/assets/images/cetrafs-proxmox-eseries-05-cetrafs-utilization.png)
