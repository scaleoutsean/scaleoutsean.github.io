# Add NetApp SolidFire iSCSI storage to KVM

Overview of SolidFire-related storage options for KVM

- [Introduction](#introduction)
- [Storage options exposed in Virtual Manager](#storage-options-exposed-in-virtual-manager)
  - [Filesystem directory](#filesystem-directory)
  - [Physical disk device](#physical-disk-device)
  - [Preformatted block device](#preformatted-block-device)
  - [iSCSI target](#iscsi-target)
  - [LVM](#lvm)
  - [mpath](#mpath)
  - [ZFS pool](#zfs-pool)
- [Conclusion](#conclusion)

## Introduction

Continuing from the previous post on [hypervisor OS alternatives for NetApp HCI](/2024/02/07/migrate-netapp-hci-from-vmware.html), this post reviews storage options from KVM with SolidFire.

## Storage options exposed in Virtual Manager

When adding storage to KVM using Virtual Manager, you'll see the following options.

![](/assets/images/kvm-add-storage-solidfire-01.png)

Below you can find my comments on some of them. 

There are no "best practices" for this - in one case one may be better than the rest, in another some other option may be better. 

You may also have a diverse virtualization environment with several different approaches (e.g. one for VDI, another for HA clusters).

### Filesystem directory

![](/assets/images/kvm-add-storage-solidfire-02-fs-directory.png)

Obviously, a SolidFire disk won't be accessible at a directory unless it's already logged in to, formatted, and mounted. 

If you have that and it works for you then it is fine. I generally use that in my "static" non-HA environments, do not partition volumes, and I format them with XFS.

### Physical disk device

![](/assets/images/kvm-add-storage-solidfire-03-physical-disk-device.png)

I've no idea why I would use this. Oracle RAC, perhaps? Who knows!

### Preformatted block device

![](/assets/images/kvm-add-storage-solidfire-04-preformatted-block-device.png)

I guess this is like vRDM in VMware and can be used to expose pass-through block devices to VM for boot from iSCSI and such?

By the way, you can boot KVM VMs from iSCSI (I have a video on YouTube), but it's been a while since I tried or heard about anyone who needs that.

### iSCSI target

![](/assets/images/kvm-add-storage-solidfire-05-iscsi-target.png)

Why bother with this? 

Because an iSCSI device may be specified by one of: device ID, label, partition label, partition UUID, path, UUID.

That also means it's easy to view the SolidFire volume the same way from another KVM host. That may make it easier to manage multiple KVM hosts attached to SolidFire. The same iSCSI device ID will be visible the same way on another KVM host logged into the same SolidFire target. 

Another reason may be if you have a bunch of different on-demand requirements, so you can't pick one in advance: whereas "filesystem directory" works fine, it has pre-determined filesystem and formatting options. If you want to set these on demand, then using iSCSI targets is better.

### LVM

![](/assets/images/kvm-add-storage-solidfire-06-lvm.png)

LVM group requires an OS with LVM2. If you don't have an LVM group, SolidFire devices must be available and then you can provide a list like so:

```xml
  <source>
    <device path="/dev/sdb"/>
    <device path="/dev/sdc"/>
  </source>
```

It's generally better to use stable device names, such as labels (single host) or device IDs (HA clusters). Look under /dev/disk/by-path or /dev/disk/by-id.

If you start with LVM ready to go, you'd first expose SolidFire disks to a KVM host or hosts, and then (one host first) configure LVM groups identically, unmount, disconnect, then [import that configuration on another host](https://access.redhat.com/solutions/4123). So, this is a bit complicated.

You may want to use this if you want to create KVM volumes larger than 16 TiB, or if you expect to need to frequently resize underlying LVM group, for example.

### mpath

![](/assets/images/kvm-add-storage-solidfire-07-mpath.png)

If you prefer to access and directly multi-path devices. And who doesn't, right? 

Well, I don't. 

Because then I have to also manage Device Mapper. Why bother? I prefer to configure iSCSI NICs into an LACP bond and have a single but redundant path to the volume.

### ZFS pool

![](/assets/images/kvm-add-storage-solidfire-08-zfs-pool.png)

ZFS has some nice management features that you cannot get from SolidFire. 

But - just like with multi-path above - I never use it unless I have to. Why, because I don't want to have another thing to manage. 

When would I use ZFS? Maybe for VMs with containers, or certain types of developer workstations.

As I said in the [Proxmox](/2022/04/05/proxmox-solidfire.html) post, using ZFS with compression enabled may result in a *higher* storage consumption on SolidFire because instead of deduplicating ZFS data across all KVM systems, snapshots, clones, you end up scrambling block hashes and diminishing storage efficiency. This isn't to say it's impossible to save SolidFire storage capacity with ZFS compression enabled - probably there are scenarios in which it is possible - but just test your use case before you commit because it may not save capacity while still wasting KVM hosts' CPU and memory resources.

Like with LVM, you can provide a list of constituent disks, it's best to use stable device names. ZFS packages must be available on the host.

## Conclusion

Filesystem directory (with SolidFire volumes formatted and mounted consistently across all KVM systems involved in your configuration) is an okay approach, especially if you configure systems with something like Terraform or Ansible so that your configuration is identical on all hosts. 

Then you can use HA for VMs and that can work as well as any other option.

For DevOps, containers, and >16TiB volumes, I'd also look at LVM (XFS) and ZFS (with compression disabled).

If you're interested in using SolidFire iSCSI devices from KVM in a consistent manner, you can reference [solidbackup](https://github.com/scaleoutsean/solidbackup) for some examples of dealing with SolidFire iSCSI.

I have some additional notes on KVM with SolidFire in the [Proxmox](/2022/04/05/proxmox-solidfire.html) post mentioned above.

You may find more about the KVM storage options and considerations for each [here](https://libvirt.org/storage.html).
