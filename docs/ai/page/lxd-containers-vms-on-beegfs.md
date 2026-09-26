# LXD containers and VMs on BeeGFS with NetApp E-Series

Use BeeGFS on E-Series as storage pools for LXD containers and VMs

- [Introduction](#introduction)
- [Why LXD on BeeGFS (with or without NetApp E-Series)](#why-lxd-on-beegfs-with-or-without-netapp-e-series)
- [Get started](#get-started)
- [Optimal BeeGFS settings](#optimal-beegfs-settings)
- [HA](#ha)
- [BeeGFS client in LXD VMs on LXD server accessing BeeGFS on E-Series](#beegfs-client-in-lxd-vms-on-lxd-server-accessing-beegfs-on-e-series)
- [Storage-related rant](#storage-related-rant)
- [Issues and workarounds](#issues-and-workarounds)
- [Conclusion](#conclusion)

## Introduction

LXD is a handy virtualization platform for containers and virtual machines. It also supports Windows VMs, and doesn't prevent you from using Docker containers if that's what you like - some users run Docker containers in LXD VMs.

I think it's fair to say it's a niche approach if you consider it for enterprise use, but it's popular enough among non-enterprise users (especially Ubuntu users) and has its advantages.

Because LXD is self-quarantined into that niche, its storage integrations are also - in my opinion - not of enterprise quality. You can read about storage options [here](https://linuxcontainers.org/lxd/docs/master/storage/).

While this may sound too critical, I think it's true and despite that, not a reason to not use LXD. If you want a virtualization management tool that does a lot of basic things very well, check it out! 

Personally, I've been meaning to check it on BeeGFS, because that's one of my frequent topics here, and secondly, the docs (link above) are limited to those several options so the LXD and BeeGFS communities may benefit from experiments of this kind.

## Why LXD on BeeGFS (with or without NetApp E-Series)

I don't have good reasons to share, and I even won't say you *should* try this.

BeeGFS - even with the features included in enterprise license support that NetApp sells - is also not an "enterprise file system for virtualization". Its main characteristics are scalability and performance, and because of that it's very popular in HPC.

The goal of this post is not to encourage you to move your VMs from ESXi and VMFS to LXD and BeeGFS, but to show how to get started, after which you can explore it, and identify workloads and use cases where this combination makes sense. 

Suitable workloads are probably workloads that read/write in large requests. If you already have BeeGFS, you can run such workloads from containers or hosts, you don't need to deploy VMs for that, but there may be situations where data doesn't have to be shared among multiple users.

One such example may be running Dev/Test/Lab workloads with Big Data/Analytics installed with Docker or Docker Compose. LXD VMs might be good for that:

- Each VM is stand-alone, either pre-deployed or bare, to allow installation from scratch (for testing or learning)
- IO is sequential
- IO can burst to hundreds of MBs or several GB/s

## Get started

What I used:

- Ubuntu Linux 20.04 LTS
- ThinkParQ BeeGFS 7.3.0
- Ubuntu LXD 5.5 (snapd)

We'll use a "directory" based LXD storage pool. How does that compare to ... something else? At this time a comparison can be found [here](https://linuxcontainers.org/lxd/docs/master/reference/storage_drivers/#feature-comparison). It doesn't have many advantages, but it works inside an LXD container (although LXD container doesn't seem to work with BeeGFS - more on that later). If you want to LXD with other drivers, you can - just create a volume on E-Series and present it directly to LXD server; once you have that block device, you can use BTRFS, LVM, etc. But this posts focuses only on `dir` driver.

With that:

- Create a directory on existing BeeGFS mount point, or a dedicated BeeGFS filesystem
- Create a directory-type storage pool (`dir`) and give it a name such as `beegfs`
- Review

```sh
$ mkdir /mnt/beegfs/lxd-pool

$ lxc storage create beegfs dir source=/mnt/beegfs/lxd-pool

$ lxc storage list
+----------+--------+----------------------+-------------+---------+---------+
|   NAME   | DRIVER |        SOURCE        | DESCRIPTION | USED BY |  STATE  |
+----------+--------+----------------------+-------------+---------+---------+
| beegfs   | dir    | /mnt/beegfs/lxd-pool |             | 0       | CREATED |
+----------+--------+----------------------+-------------+---------+---------+
```

- If you look at the path you'll see LXD created an empty directory structure for VMs, containers, plain "volumes" that can be attached to those.

```sh
$ sudo dir -lat /mnt/beegfs/lxd-pool
total 2
drwx--x--x  3 root    root     1 Sep  1 15:18 virtual-machines
drwxrwxr-x  9 sean    sean     7 Sep  1 15:16 .
drwx--x--x  2 root    root     0 Sep  1 15:16 containers
drwx--x--x  2 root    root     0 Sep  1 15:16 containers-snapshots
drwx--x--x  2 root    root     0 Sep  1 15:16 custom
drwx--x--x  2 root    root     0 Sep  1 15:16 custom-snapshots
drwx--x--x  2 root    root     0 Sep  1 15:16 images
drwx--x--x  2 root    root     0 Sep  1 15:16 virtual-machines-snapshots
drwxrwxrwx 15 root    root    15 Sep  1 15:16 ..
```

- Create a VM that uses this pool you've just created

```sh
sudo lxc launch ubuntu:22.04 --vm --storage beegfs
```

- This will download OS image and deploy a randomly named VM (e.g. smelly-sink). Get help for `lxc launch` if you want to customize. Use list to list all VMs, start and stop to start named VMs.

```sh
$ sudo lxc (list|start|stop) $MY_VM_NAME

$ sudo lxc info smelly-sink
Name: smelly-sink
Status: RUNNING
Type: virtual-machine
Architecture: x86_64
PID: 53378
Created: 2022/09/01 15:18 UTC
Last Used: 2022/09/02 04:21 UTC

Resources:
  Processes: 21
  CPU usage:
    CPU usage (in seconds): 54
  Memory usage:
    Memory (current): 795.90MiB
  Network usage:
    enp5s0:
      Type: broadcast
      State: UP
      Host interface: tapeb7fc4f8
      MAC address: 00:16:3e:20:e0:72
      MTU: 1500
      Bytes received: 133.30MB
      Bytes sent: 845.63kB
      Packets received: 32995
      Packets sent: 12256
      IP addresses:
        inet:  10.63.129.177/24 (global)
        inet6: fe80::216:3eff:fe20:e072/64 (link)
    lo:
      Type: loopback
      State: UP
      MTU: 65536
      Bytes received: 11.98kB
      Bytes sent: 11.98kB
      Packets received: 142
      Packets sent: 142
      IP addresses:
        inet:  127.0.0.1/8 (local)
        inet6: ::1/128 (local)
```

- Enter the VM with `sudo lxc shell $MY_VM_NAME` 

- What LXD volumes does my VM use? We need two variables here, one is pool name (beegfs) and another is VM name which we add as suffix to resource type (virtual-machine)

```sh
$ lxc storage volume list beegfs --all-projects
+---------+-----------------+----------------+-------------+--------------+---------+
| PROJECT |      TYPE       |      NAME      | DESCRIPTION | CONTENT-TYPE | USED BY |
+---------+-----------------+----------------+-------------+--------------+---------+
| default | virtual-machine |   smelly-sink  |             | block        | 1       |
+---------+-----------------+----------------+-------------+--------------+---------+

$ lxc storage volume show beegfs virtual-machine/smelly-sink
config: {}
description: ""
name: smelly-sink
type: virtual-machine
used_by:
- /1.0/instances/smelly-sink
location: none
content_type: block
project: default
```

- Storage-wise, data will be stored in the virtual-machines sub-directory of your "directory" style pool. On BeeGFS, these files may be all over the place, or on just one storage device - that depends on settings you use

```
$ sudo dir -lat /mnt/beegfs/lxd-pool/virtual-machines/smelly-sink
total 3058532
-rw-r--r-- 1 root root 10737418240 Sep  2 06:48 root.img
-rw------- 1 lxd  root      131072 Sep  2 04:21 qemu.nvram
-r-------- 1 root root        2199 Sep  2 04:21 backup.yaml
dr-x------ 6 lxd  root          10 Sep  2 04:21 config
d--x------ 4 root root          10 Sep  1 15:18 .
-rw-r--r-- 1 root root         692 Sep  1 15:18 agent-client.crt
-rw------- 1 root root         288 Sep  1 15:18 agent-client.key
-rw-r--r-- 1 root root         721 Sep  1 15:18 agent.crt
-rw------- 1 root root         288 Sep  1 15:18 agent.key
drwx--x--x 3 root root           1 Sep  1 15:18 ..
-rw-r--r-- 1 root root         295 Aug 10 07:29 metadata.yaml
drwxr-xr-x 2 root root           1 Aug 10 07:29 templates
```

- Directory type pools don't have many options, but one that works is the maximum volume size limit, e.g.:

```sh
lxc storage set beegfs volume.size 2000000000000000000
```

- With fully open source BeeGFS, quotas are disabled so that won't have effect. For example, while trying to launch a LXD container, syslog tells us the FS doesn't support quotas

```sh
Sep  2 08:51:52 b5 lxd.daemon[1733]: time="2022-09-02T08:51:52Z" level=warning msg="The backing filesystem doesn't support quotas, skipping set quota" driver=dir path=/var/snap/lxd/common/lxd/storage-pools/beegfs/containers/c1 pool=beegfs size=2000000000000000000 volID=2
```

## Optimal BeeGFS settings

I don't know what they are. Generally speaking:

- Use a small `chunksize` value and a low `numtargets` figure for VMs with small I/O requests. With BeeGFS on NetApp E-Series, because it uses protected storage, you can even use `numtargets 1`. A target can go down - temporary during BeeGFS server fail-over, or maybe even longer, but underlying volume will be there even if the server has to be replaced, and this will work without any BeeGFS software replication (which should help a lot in terms of write performance, but also cost). 
- Use larger chunk sizes and multiple storage targets for VMs with sequential I/O (e.g. 1MB or 100MB files)

For a Web server, I may go with `chunksize 128KB` and `numtargets 1` (or 2, in the case there are large images). 

For MySQL, `chunksize 128KB` and `numtargets=1`.

For MinIO we may decide based on workload characteristics - say for 4MB I/O requests we could use `chunksize 256KB` and `numtargets 4`(assuming you have that many disks) - it's impossible to say what would be "best" without knowing more about the entire stack.

These settings could be applied:

- on FS level, for all data on a filesystem
- on BeeGFS pool level, for all pool data
- on VM/Container directory level (*before* a VM or container has been created), to make exceptions for unusual workloads

## HA

How do we do HA here? For BeeGFS with E-Series, storage HA is taken care of with HA functionality on [BeeGFS storage servers connected to E-Series storage](/2022/08/28/configuring-netapp-e-series-solution-for-beegfs.html) - BeeGFS clients (LXD servers) connect to one or more BeeGFS servers to get to their shared storage.

For LXD and VM/container services, you'd have to to use [LXD clustering](https://linuxcontainers.org/lxd/docs/master/clustering/) which is more like a loose federation and less like VMware vSphere clusters with shared storage. I've clustered LXD before, but not with shared storage such as BeeGFS, so I can only assume that failing over VMs and containers should work just as it would with directories on NFS mount points. Dump container or VM config onto BeeGFS, and recreate it from another LXD host/BeeGFS client if you need to.

The tricky part is disabling autostart on a dead host, or removing a stale VM configuration if we've resurrected the VM elsewhere. In other words, handling *unplanned* failures is the challenging part with LXD clusters backed by shared storage.

For *planned* failover that involves persistent data we could also use the LXD volume copy and move features, although they are ineffective (more on that below).

## BeeGFS client in LXD VMs on LXD server accessing BeeGFS on E-Series

That's a deliberate attempt to confuse, but a real-live question might be: can I run BeeGFS client in LXD VMs (which run on LXD hosts which themselves may or may not be BeeGFS clients)? 

I think that scenario is covered [in this post](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html) where I used BeeGFS in VMware VMs running on hosts that did not run BeeGFS (why, because those hosts were ESXi servers).

However, while running LXD VM on GPU-enabled hosts, I did notice VMs behaved similar to Docker containers in the sense that certain h/w device modules had to be installed on the host to be accessible from a guest (VM). If you try BeeGFS on LXD VMs, you may want to install BeeGFS on the host.

## Storage-related rant

At the top I mentioned about non-enterprise mindset - to see what I mean, read [this](https://linuxcontainers.org/lxd/docs/master/howto/storage_move_volume/).

You can copy a volume from one LXD host to another. You can also move a volume (by copying it and then deleting the original file).

While good, these features assume that storage is stupid, which is an assumption some users may not mind - especially if they have exactly such storage - but others, who could use LXD much better if they could simply migrate a *VM or container configuration file* from one LXD host to another and restart it there, have no choice but to use their feature-full storage in a stupid way. LXD's Ceph integration attempts to improve on that, but with Ceph you still don't have enterprise storage.

I'm not ranting against the inability to better leverage BeeGFS here, or the fact that LXD has integration with Ceph, but against these storage "features" that were difficult to develop, are hard to use (how do you copy a VM if the LXD server is down?), and seem unreliable outside of simple demo scenarios.

Had Ubuntu invested **a fraction of the time and effort** in creating integrations with NFS or SAN storage, they'd actually have something that works correctly and reliably 99.999% of time, and get a shot at becoming a Tier 2 virtualization platform (something [Proxmox](/2022/04/05/proxmox-solidfire.html) and [XCP-NG](/2022/07/10/xcp-ng-with-netapp-solidfire-iscsi.html) have both done). Without that, LXD is probably a Tier 3 choice for anyone with non-trivial clustering or storage requirements.

I've been waiting for LXD (before LXD) to come up with something sensible in this area for half a decade now so the above amounts to approximately one ranting paragraph per year - I hope that's not too bad, Ubuntu!

## Issues and workarounds

- I had to uninstall open-vm-tools from Ubuntu 20.04 and reboot to be able to run the first lxc launch command (for VM). Then I reinstalled open-vm-tools and did not have any problems.
- When `lxc` commands are executed from a BeeGFS path (e.g. normally that means somewhere in /mnt/beegfs/), they hang and after 9 minutes time out. Execute them from a non-BeeGFS path.
- LXD container creation hangs, still trying to figure out why. It may be related to lack of hard link support and/or the need to enable ACLs (not available in non-licensed version of BeeGFS I use)
- BeeGFS has no snapshots; E-Series does, but with BeeGFS snapshots should be taken on filesystem level. Backups can be taken by using application- or host-side tools or by simply copying (closed) files to another location. LXD also can [backup volumes](https://linuxcontainers.org/lxd/docs/master/howto/storage_backup_volume/) (i.e. what we see as VM or container files on BeeGFS).

## Conclusion

If you're looking for a "KVM Lite that doesn't suck", LXD is great. Once it gets to LXD with persistent storage, or HA LXD, it depends.

But I still recommend to evaluate it because LXD VMs are really good and single-host LXD is so much easier to use than KVM.

If you don't have any important container or VM workload that is IO-heavy and tends to work with 64kB requests or higher, there may be no value in adding BeeGFS to your LXD environment - you'd have extra software to manage and additional considerations to think about. As illustrated [here](https://scaleoutsean.github.io/2022/04/09/beegfs-csi-introduction.html#options-in-a-mixed-environment), LXD servers can consume E-Series storage (block devices) directly from LXD hosts using LXD's [LVM driver](https://linuxcontainers.org/lxd/docs/master/reference/storage_lvm/#storage-lvm), and BeeGFS can be using other E-Series storage for suitable workloads.

On the other hand, IO-heavy containers and VMs with mixed or sequential workload could benefit from directory-style pools on BeeGFS storage.
