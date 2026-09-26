# Storage monitoring in Proxmox PVE and NetApp E-Series environments

Monitor free space of datastores, VMs and CTs

## Introduction

E-Series (SANtricity) systems are commonly referred to as block storage. Which they are, except there's nothing that prevents you from deploying Linux [NFS servers](/2026/03/11/proxmox-pve-nfs-rdma-netapp-eseries.html), S3 and other storage services **backed by** SANtricity block storage. I blogged about that [here](/2026/03/01/proxmox-pve-with-netapp-eseries.html), so I won't repeat the same points.

Deploying does require some extra effort and time, so I wouldn't call those approaches "free". Deploying additional services based on open source software is certainly inexpensive. But it is because each may be differently managed and monitored, that I won't discuss those options. Ultimately, if each is backed by E-Series, we need to monitor that first and foremost.

## What to monitor

Starting from the bottom, a storage pool (either "classic" RAID, or DDP) needs to accommodate the capacity of all volumes (shared LVM volumes) on it. This information can be obtained from SANtricity easily (usually available capacity on storage pool, although we could calculate unused capacity by deducting the sum of all volumes on a storage pool from total usable pool capacity). Storage pools can be grown by adding physical disks, as long as they're within the SANtricity maximum disk count for the pool (which, for DDP, is hundreds).

![Monitoring datastores, VMs, CTs](/assets/images/pve_storage_monitoring_03_what_to_monitor.png)

Above that, we have shared LVM - to take the common case - which can be grown online in two steps: extend the volume on SANtricity (UI, API, CLI), then extend LVM on the PVE node (UI, API, CLI).

Finally, we need visibility into individual VMs and CTs, to make sure available filesystem space is sufficient. "Sufficient" may mean anywhere between 5% on very large and relatively static volumes to 40% on database server's log devices where you don't want to see over 90% capacity utilization (risk and performance impact). "It depends", as they say.

### Capacity

What's common to all PVE resources - whether VMs, CTs or SDS running in them, is they consume capacity on shared LVM or (non-shared) thin LVM SANtricity disks. That's what we need to monitor and optionally, collect additional usage *within* that tool (VM, CT, etc).

Consider a PostgreSQL VM on a shared LVM block device. Shared LVM provisions *thick* volumes. On the one hand, this prevents us from over-provisioning LVM capacity and risking filesystem corruption in the VMs and CTs that use it. On the other, we may provision too much out of fear of running out of capacity.

The same logic applies to what we can call "secondary" storage services backed by shared LVM datastores, such as Linux NFS VMs, S3 SDS and more.

Ideally, we want to provision just enough disk capacity to VMs and CTs, and keep filesystems not more than 70-80% full (adjust for your needs depending on service and requirements).

PVE lets us view LVM datastore utilization, but getting the capacity utilization of VMs and CTs may require several extra steps.

### Performance

This is easier, I suppose, because PVE has IOPS- and bandwidth-limiting controls that can manage performance. 

From a SANtricity perspective, there's no granular per-volume performance management as such. There's performance monitoring both in the UI and API (as well as tools that consume that API), so combined with PVE's monitoring we can add up all VMs and CTs that share a shared LVM device and the sum of their IOPS and bandwidth is expected to be similar to the SANtricity volume performance. For performance management, we need to rely on the PVE performance management features.

How to tell if a shared LVM disk is being maxed out? Watch read and write latency as well as queue depth on the volume using PVE node (using the volume) or SANtricity tools.

The maximum queue depth possible on a SANtricity volume is large, but it's ultimately constrained by actual disk performance (which, in the case of HDDs, is directly proportional to the number of disks in the storage pool backing the volume used for shared LVM). The queue may be "only" 200, but if you have 5 HDDs in a RAID 5 group ("storage pool"), 200 would be a lot and a sign of "piled up" IO requests that can't be processed due to the limited IOPS available on the storage pool backing the shared LVM disk.

When creating a VM, optionally set these to limit throughput or IO/s for the VM and adjust them later as necessary.

![PVE bandwidth and IOPS control](/assets/images/pve_storage_monitoring_08_pve_vm_performance_limits.png)

## Qemu guest agent

You *must* have it working in order to get internal filesystem fullness information from VMs.

Something semi-surprising is that:

- You *must* install QEMU guest agent (for Linux or Windows), and
- You *must* enable it in PVE, and
- You *must* shutdown (not reboot) and start the VM for it to kick-in

The first item is expected, but the other two less so.

Even [PBS 4.2.0](/2026/05/10/proxmox-backup-server-versity-s3-netapp-eseries.html) doesn't have the first two items covered out-of-box.

PVE's "create VM" wizard does let you complete the second item, but it's still up to you to install the package and power-cycle the VM.

TLDR for Debian-style *guests*:

```sh
apt install qemu-guest-agent -y ; poweroff
```

On Windows guests, install VirtIO from the usual [ISO](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso), power-cycle the VM and make sure related services are running after you power it on.

## Tools

On the one hand, PVE does provide PVE-side of the story: you can see the fullness of shared LVMs, for example. On the other, PVE doesn't easily provide VM- and CT-side view. I think that must be on their radar, so to speak, and so I wouldn't spend much time over-engineering something that may become available within months.

If you want all-in-one and don't want some "standard" approach, Pulse (below) is easy and works. If you want a standard approach, then a PVE Prometheus Exporter plus something to collect and report on the collected.

### End-to-end approaches

There are feature-full suites that can monitor a lot more than just capacity utilization. [Pulse](https://github.com/rcourtman/Pulse/) is one of them.

It's an open-source stack that can monitor PVE, Docker, and Kubernetes out of box.

I'll just show two relevant screenshots: the first shows storage utilization on all PVE hosts.

![Pulse 6 storage view](/assets/images/pve_storage_monitoring_00_pulse_storage.png)

You may also focus on datastores that seem critical. Clicking on a line highlights it and makes it easy to learn more about the datastore.

![Pulse 5 per-VM metrics](/assets/images/pve_storage_monitoring_01_pulse_storage_focus.png)

It's also possible to check disk utilization on individual VMs and CTs (LXCs).

Shared LVM datastores are monitored on PVE servers, it's just that you can't (for example) see whether some shared LVM device *can* be extended because you don't know if the underlying SANtricity storage pool has the spare capacity to do it - you'd have to look that up separately.

Like with all all-in-one tools, whatever is not in there may maybe hard to add by yourself. Pluse is OSS, but even so - it's not trivial to add another target such as E-Series arrays.

Pulse looks good to me - it does what it's supposed to do. The only extra pieces that EPA (or self-built tool, or SANtricity UI) can give you are performance and capacity metrics on the storage pool for additional information that you can't get from Pulse.

### Standard approaches

This is the usual - get a PVE Prometheus exporter, get an E-Series Prometheus exporter. Scrape and visualize where you want.

![EPA and PVE monitoring](/assets/images/epa-v4-pve-diagram.svg)

[EPA](https://github.com/scaleoutsean/eseries-perf-analyzer) is one such exporter for E-Series. There may be others.

### Simple approaches

This problem - visibility into VMs and CTs - is important and universal enough so I expect PVE will address it in v10. 

Those who prefer to use vendor's tools (that is, whatever is built into Proxmox) as opposed to adding 3rd party ones can easily create CLI or API scripts that get this information and set alerts when a filesystem gets nearly full. Get filesystem information from all VMs, divide "used" by "total" and alert via email or message if the ratio is larger than 0.85. Not hard.

If you have multiple datastores or VM/CT disks and use scripts, remember to check each individually, not calculate some "average" value per VM.

I may add a simple reporting tool for this to [SANmox](https://github.com/scaleoutsean/santricity-powershell/tree/master/sanmox), although I don't know if anyone actually uses that thing. That would be an example of a minimum effort, a "good enough" script that lets you check filesystem utilization once a week without logging into PVE servers or clicking around the PVE UI.

SANmox already reports storage pool utilization, which is the SANtricity side of the equation.

![SANmox Pool Monitoring](/assets/images/proxmox-plugin-santricity-05-tui-sanmox-storage.png)

In addition to that, we would want to add a breakdown of shared LVM disks by VM/CT and disk, possibly with some simple filtering (say, top 10 VMs/CTs by descending capacity utilization).

### Monitoring LUKS-encrypted VM/CT disks

I don't have an answer to that, in part because PVE doesn't support LUKS yet, and in part because I'm not interested enough to try a DIY approach for PVE (several of which exist, but is laborious and not officially supported).

This isn't of immediate concern, but if filesystem usage isn't available from LUKS-encrypted disks, that information would have to be obtained by a scheduled script (10 line-script to send `df` output to some internal service) or a service/agent such as [Telegraf](https://docs.influxdata.com/telegraf/v1/install/#download-and-install-telegraf) client.

When LUKS becomes supported, physical disk utilization won't change for SANtricity-backed datastore, but may change for storage systemsf that thinly provisions VM/CT disks because of encryption. Last time I checked (using SolidFire), I recall LUKS destroyed storage efficiency, but I don't recall if it was completely or partially (which would be the case when savings from thin provisioning remained, but from compression and dedupe did not). Because SANtricity won't be impacted in either case, I won't try to find out. If you plan to use LUKS on flash storage at scale (not just for your CEO's desktop VM), you may want to find out.

## Enlarge shared LVM, VM and CT disk space

Reference for resizing CT, VM, (PVE) LVM:

- CT [CLI](https://pve.proxmox.com/wiki/Command_Line_Tools#Container_(LXC))
- [Resize LVMs, VMs and PVE disks](https://pve.proxmox.com/wiki/Resize_disks)

Shared LVM datastores are easily observable from the Proxmox UI.

![PVE - shared LVM datastore](/assets/images/pve_storage_monitoring_06_datastore_ui.png)

LVM-to-disk mapping may be viewed on PVE host level:

![LVM-to-disk mapping](/assets/images/pve_storage_monitoring_02_node_storage.png)

Go to the active PVE Node's `Disks > LVM` to view VG-to-disk mapping. Assuming you maintain consistency between VG and LVM names, you may be in luck.

![PVE node - VG view](/assets/images/pve_storage_monitoring_07_vg_to_disk.png)

Shared LVM disks use the usual `pvresize` and `lvresize` commands mentioned at the second reference link.

CTs are less common than VMs, so let's see an example. Create a CT with a 3 GB disk:

![CT with 3GB image](/assets/images/pve_storage_monitoring_04_resize_ct.png)

We may check disk fullness from the CLI like so:

```sh
root@h3:~# pct list
VMID       Status     Lock         Name
102        running                 ct2604

root@h3:~# pct df 102
MP     Volume                   Size   Used Avail Use% Path
rootfs lvm_sanmox:vm-102-disk-0 2.9G 582.9M  2.1G 19.8 /
```

We can then grow the disk with `Disk Action` in the UI (visible in the screenshots) or from the CLI. "Add X" (`+<size>G`) syntax is available to add X GB instead of specifying the final size. 

Let's add 0.1G to this 3G disk. Here, I could use `+0.1G` or `3.1G` to get to 3.1G.

```sh
# pct resize 102 rootfs 3.1G
  Rounding size to boundary between physical extents: 3.10 GiB.
  Size of logical volume vg_sanmox/vm-102-disk-0 changed from 3.00 GiB (768 extents) to 3.10 GiB (794 extents).
  Logical volume vg_sanmox/vm-102-disk-0 successfully resized.
resize2fs 1.47.2 (1-Jan-2025)
Filesystem at /dev/vg_sanmox/vm-102-disk-0 is mounted on /tmp; on-line resizing required
old_desc_blocks = 1, new_desc_blocks = 1
The filesystem on /dev/vg_sanmox/vm-102-disk-0 is now 813056 (4k) blocks long.

# pct df 102
MP     Volume                   Size   Used Avail Use% Path
rootfs lvm_sanmox:vm-102-disk-0 3.0G 582.9M  2.2G 19.1 /
```

The same UI after resizing shows the new size as well as the logged resize action at the bottom.

![PVE CT with resized image](/assets/images/pve_storage_monitoring_05_resized_ct.png)

That's easy enough even in in PVE - it's literally a single command in the CLI, and also easily accessible from the PVE Web UI.

```sh
qm resize <vmid> <disk> <size> 
```

In the UI, pick a disk and choose `Resize` in `Disk Action` commands.

![PVE VM disk action - Resize](/assets/images/pve_storage_monitoring_10_pve_vm_disk_action.png)

Linux VMs should see the new capacity right away. See the reference link for the Windows steps.

The main requirement is we need to be able to learn that resizing may be needed. With ample space available on shared LVM disks, one could easily auto-grow disks that are running out of capacity. But in the worst case we could make shared LVM volumes "auto-run-out-capacity" this way.

It is much better to enlarge VM and CT disks when it's justified and necessary and not simply because it's possible. While doing that we may want to consider balancing capacity and performance (especially on HDD-based shared LVM disks) as well. Sometimes it's appropriate to simply expand a volume, and sometimes it's better to move the VM/CT to another datastore and expand it there.

The same `Volume Action` (for CTs; it's `Disk Action` for VMs) button has the `Move Storage` feature that lets you move a disk to another (block) datastore.

![PVE - Move CT or VM disk to another datastore](/assets/images/pve_storage_monitoring_09_pve_vm_storage_move.png)

This is sequential IO and E-Series handles it well. The need to do this offline is the main inconvenience and "cost" of these operations. Other than that, many TBs can be easily shuffled around in an afternoon even without storage-side offload.

To kick tires on that, I moved a standard (default options) 8GB VM disk from shared LVM to local (SSD) and then back to shared LVM (on SANtricity). VM disks can be storage-moved online (while VM is running) from one block device to another.

The blue line shows the movement of the 8GB disk to local datastore. The pink-ish line is the movement back to shared LVM. That IO peaked around 800 MB/s and was done in seconds (10 seconds at 800 MB/s).

![PVE VM disk move storage peak](/assets/images/pve_storage_monitoring_11_pve_vm_disk_move_peak.png)

The task itself took two minutes, due to some processing on PVE node. That may have been discard-on-move (to re-thin upon migration?) but I haven't investigated because it wasn't significant enough.

![PVE VM disk move storage duration](/assets/images/pve_storage_monitoring_12_pve_vm_disk_move_task.png)

This low-rate write churn was also obvious in SANtricity performance monitor, but it's almost negligible and we could move dozens of disks in parallel on SSD-based LVMs without this causing major impact. (I do have write cache disabled on the array to avoid getting cache-assisted performance results.)

![PVE VM disk move storage throughput](/assets/images/pve_storage_monitoring_13_pve_vm_disk_move_duration.png)

When moving the same disk to, and then from, local disk on a live VM, there was no churn. 6 seconds was all it took.

![PVE VM live disk move storage task](/assets/images/pve_storage_monitoring_14_pve_vm_disk_live_move_duration.png)

A move *from* shared LVM to local datastore (read on shared LVM, in blue) followed by a move *to* shared LVM (write, in pink) completed quickly without any post-movement churn, so I'm not sure if "re-thin" guess (`fstrim` as a built-in post-movement step) is correct or not. 

![PVE VM live disk move storage throughput](/assets/images/pve_storage_monitoring_15_pve_vm_disk_live_move_throughput.png)

Maybe it always happens but, because I moved the disk several times within minutes, there was nothing to discard after this last move.

## Conclusion

Shared LVMs have several advantages over other possible approaches (such as single-host filesystem datastores that can be backed by SANtricity volumes):

- HA out of box because of shared storage
- Snapshots (still a technology preview, but may graduate to fully supported in 9.2)

But they use thick provisioning, which means that giving arbitrarily large disks to all VMs and CTs isn't "free" or a great idea. SANtricity users have to economize. In order to do that, we need to monitor capacity on SANtricity, shared LVM disks as well as within VMs and LXC CTs. The last part is not possible out-of-box, but after enabling VM/CT filesystem utilization reporting, we have many tools at our disposal - from simple, to sophisticated.

Once we get capacity monitoring in place, the rest is easy. VM/CT disks can be grown online and the same is possible for shared LVM disks (SANtricity LUNs) and SANtricity storage pools which - in the case of the recommended approach with DDP - is possible in single physical disk increments.

Performance can be managed on PVE and end-to-end monitoring is available on both PVE and SANtricity. Since PVE both manages and monitors performance, SANtricity here plays a "sanity-check" role - while all information you need is available from PVE, SANtricity performance monitoring adds extra context and can help you optimize further.

## Appendix A: `get-fsinfo`

`qm agent 100 get-fsinfo` will get filesystem utilization information for "regular" filesystems, including XFS, in VM 100. It doesn't fetch ZFS information which would require the querying of Zpools which doesn't seem possible with that command. I mention this as an example of where using ZFS where there's no use case for it may require extra management steps that ext4 or XFS wouldn't need.

An XFS entry example in the list of returned filesystems:

```json
{
  "disk": [
    {
      "bus": 0,
      "bus-type": "scsi",
      "dev": "/dev/sdc",
      "pci-controller": {
        "bus": 1,
        "domain": 0,
        "function": 0,
        "slot": 3
      },
      "serial": "0QEMU_QEMU_HARDDISK_drive-scsi2",
      "target": 0,
      "unit": 2
    }
  ],
  "mountpoint": "/xfs",
  "name": "sdc",
  "total-bytes": 2080374784,
  "total-bytes-privileged": 2080374784,
  "type": "xfs",
  "used-bytes": 109461504
}
```
