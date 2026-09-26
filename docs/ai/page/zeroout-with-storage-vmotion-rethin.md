# Zero-out and rethin VMDKs on NFS

Make your VMDKs skinny again

- [A workaround for rethinning](#a-workaround-for-rethinning)
- [Create multiple NFS shares for ESXi](#create-multiple-nfs-shares-for-esxi)
- [Mount NFS shares in ESXi](#mount-nfs-shares-in-esxi)
- [Create a VM with extra data disk on one of NFS shares](#create-a-vm-with-extra-data-disk-on-one-of-nfs-shares)
- [Ensure VM is running and /dev/sdb is usable](#ensure-vm-is-running-and-devsdb-is-usable)
- [Format data disk in Linux VM](#format-data-disk-in-linux-vm)
- [Fill up data disk](#fill-up-data-disk)
- [Remove 50% of data and confirm no rethinning has happened](#remove-50-of-data-and-confirm-no-rethinning-has-happened)
- [Make sure Thin Provisioning is enabled on NFS storage](#make-sure-thin-provisioning-is-enabled-on-nfs-storage)
- [Review current storage view from ESXi](#review-current-storage-view-from-esxi)
- [Review current VMDK location](#review-current-vmdk-location)
- [Move zeroed-out VMDK to another NFS share](#move-zeroed-out-vmdk-to-another-nfs-share)
- [Observe data movement between NFS shares (or between NFS and VMFS)](#observe-data-movement-between-nfs-shares-or-between-nfs-and-vmfs)
- [Observe capacity utilization on destination growing](#observe-capacity-utilization-on-destination-growing)
- [Confirm zeroed-out VMDK has been relocated](#confirm-zeroed-out-vmdk-has-been-relocated)
- [Review current capacity utilization on vmw2](#review-current-capacity-utilization-on-vmw2)
- [Check storage efficiency with Thin Provisioning, Deduplication and Compression all enabled](#check-storage-efficiency-with-thin-provisioning-deduplication-and-compression-all-enabled)
- [Optionally move VM back to the original NFS share vmw1](#optionally-move-vm-back-to-the-original-nfs-share-vmw1)
- [Observe vmw1 utilization is going up as Linux VM is being migrated back](#observe-vmw1-utilization-is-going-up-as-linux-vm-is-being-migrated-back)
- [Upon completion storage efficiency of vmw1 is expected to remain the same](#upon-completion-storage-efficiency-of-vmw1-is-expected-to-remain-the-same)
- [NFS share vmw1 after VM data was moved and with Thin Provisioning, Deduplication and Compression](#nfs-share-vmw1-after-vm-data-was-moved-and-with-thin-provisioning-deduplication-and-compression)
- [Automate](#automate)

### A workaround for rethinning

vSphere 7.0 requires VMFS to unmap or "rethin" disks on which data has been deleted.

If you have vSphere 6.7 or 7.0, VMDKs on NFS will grow fat.

To rethin them, we can do this for Linux VMs (for Windows, use SDelete):

- Delete empty blocks on device level (not just remove filesystem metadata)
- Move the VMDK to another data store or NFS share (and optionally back)

Let's say  we have this situation in a VM's /dev/sdb mounted at /data:

```sh
$ du -sh
1.0G	.
```

Normally if we delete a 500 MB file with `rm -rf file.bin`, this will only remove filesystem metadata for the file. VMDK will still be 1 GB large, and NFS share will show it occupies 1 GB (or even more).

The first step is therefore to truly remove old data. Assuming this VMDK is 1 GB and contains 500 MB of existing data, we have close to 500 MB that can be zeroed-out:

```sh
$ dd if=/dev/null of=/data/temp-junkfile.tmp bs=1M count=450
$ rm -rf /data/temp-junkfile.tmp 
```

This will fill it up 95% full, and then we can delete the 450 MB temporary file filled with zeroes. 

At this point we can move this VM or just VMDK to another NFS share or VMFS and then optionally back.

Now, since only 500 MB of data are non-0's, if NFS server supports Thin Provisioning, VMDK can be shrunk to 500-600 MB. 

With Deduplication and Compression, it could be even 300 MB.

Let's see this in practice, with ESXi 7.0U3 and NFS v3.

Initially:

- vmw1 - first NFS share, with Thin Provisioning ON, Deduplication & Compression **OFF**
- vmw2 - second NFS share, with Thin Provisioning ON, Deduplication & Compression ON

### Create multiple NFS shares for ESXi

![Create multiple NFS shares for ESXi](/assets/images/vmware-nfs-ontap-01-ontap-nfs-shares-before.png)

vmw1 has a tiny stub file from another app which occupies 4 MB and can be ignored.
vmw2 is empty.

### Mount NFS shares in ESXi

![Mount NFS shares in ESXi](/assets/images/vmware-nfs-ontap-02-esxi-datastores-before.png)

In ESXi, we mount the two NFS v3 shares. Thin Provisioning is shown as supported.

### Create a VM with extra data disk on one of NFS shares

![Create a VM with data disk on one of NFS shares](/assets/images/vmware-nfs-ontap-03-esxi-vm-create-flatcar-linux-w-1g-data-disk-vmw1.png)

I used Kinvolk's [Flatcar Linux](/2021/12/07/flatcar-linux-with-solidfire-iscsi.html) Stable, with one disk for OS, and an other (1 GiB, Thin Provisioned) for application data

### Ensure VM is running and /dev/sdb is usable

![Ensure VM is running and /dev/sdb is usable](/assets/images/vmware-nfs-ontap-05-esxi-vm-create-flatcar-linux-w-1g-data-disk-detected.png)

Everything is looking fine.

### Format data disk in Linux VM

![Format data disk in Linux VM](/assets/images/vmware-nfs-ontap-06-esxi-vm-create-flatcar-linux-w-1g-data-disk-formatted.png)

In Flatcar Linux, format data disk (/dev/sdb) and mount it (/mnt/flatcar1g-tp).

### Fill up data disk

Write 950 GiB to data disk's filesystem mounted at /mnt/flatcar1g-tp to fill it up, and observe capacity utilization of the NFS share vmw1. 

![Fill up data disk](/assets/images/vmware-nfs-ontap-07-ontap-vmw1-with-flatcar-os-and-data-disks-2gb.png)

It's close to 2 GB (~1 GB OS, ~1 GB data).

### Remove 50% of data and confirm no rethinning has happened

Remove part of data (e.g. 475 MiB out of 950 MiB).

![Remove 50% of data and confirm no rethinning has happened](/assets/images/vmware-nfs-ontap-08-ontap-vmw1-with-flatcar-data-disks-475mb-data-removed.png)

Capacity utilization on the NFS share vmw1 should remain unchanged because unmap can't work.

### Make sure Thin Provisioning is enabled on NFS storage

If you haven't, enable Thin Provisioning on both vmw1 and vmw2.

![Make sure Thin Provisioning is enabled](/assets/images/vmware-nfs-ontap-09-ontap-vmw1-vmw-thin-enabled.png)

Optionally enable Deduplication and Compression (under Storage Efficiency).

### Review current storage view from ESXi

![Review current storage view from ESXi](/assets/images/vmware-nfs-ontap-10-esxi-datastores-after-delete-wo-unmap.png)

It should be the same as before, because:
- Inline compression had no effect on existing data
- Background compression hasn't had time to run
- ESXi 7 and 6.7 don't support unmap on NFS 

### Review current VMDK location

![Review current VMDK location](/assets/images/vmware-nfs-ontap-11-esxi-flatcar-vm-after-delete-wo-unmap.png)

They're both on vmw1.

### Move zeroed-out VMDK to another NFS share

![Move zeroed-out VMDK to another NFS share](/assets/images/vmware-nfs-ontap-12-esxi-datastore-storage-vmotion-vm-from-nfs-vmw1-to-vmw2.png)

The OS VMDK hasn't been zeroed out, but it doesn't matter - we'll move both to vmw2.

### Observe data movement between NFS shares (or between NFS and VMFS)

![Observe data movement between NFS shares](/assets/images/vmware-nfs-ontap-13-ontap-datastore-storage-vmotion-nfs-vmw1-to-vmw2.png)

### Observe capacity utilization on destination growing

![Observe capacity utilization on destination growing](/assets/images/vmware-nfs-ontap-14-ontap-datastore-storage-capacity-changing-vmw1-to-vmw2.png)

### Confirm zeroed-out VMDK has been relocated

![Confirm zeroed-out VMDK has been relocated](/assets/images/vmware-nfs-ontap-15-ontap-datastore-storage-vmotion-vmw1-to-vmw2-done.png)

### Review current capacity utilization on vmw2

![Review current capacity utilization on vmw2](/assets/images/vmware-nfs-ontap-16-ontap-datastore-storage-vmotion-with-se-on-vmw2.png)

It's smaller than before? WTF is going on?

- As VMware moved data zeroed-out blocks were compressed to nothing and deduplicated
- Thin Provisioning could provision smaller files
- OS data was unchanged, but both it and data on data disk got deduplicated and compressed

### Check storage efficiency with Thin Provisioning, Deduplication and Compression all enabled

![Check storage efficiency with Thin Provisioning, Deduplication and Compression all enabled](/assets/images/vmware-nfs-ontap-17-ontap-datastore-storage-vmotion-with-se-details-vmw2.png)

This is now good. If multiple copies of Flatcar Linux were installed, it'd be even better.

### Optionally move VM back to the original NFS share vmw1

![Optionally move VM back to the original NFS share vmw1](/assets/images/vmware-nfs-ontap-18-ontap-datastore-storage-vmotion-nfs-back-vmw2-to-vmw1.png)

This is optional, but overall a good idea because you don't have to wonder where your VM normally lives.

If you automate this, you can move back and forth in the same script, so that the VM resides on vmw2 just a few seconds.

### Observe vmw1 utilization is going up as Linux VM is being migrated back

![Observe vmw1 utilization is going up as VM is being migrated](/assets/images/vmware-nfs-ontap-19-ontap-datastore-storage-capacity-changing-vmw2-to-vm1.png)

### Upon completion storage efficiency of vmw1 is expected to remain the same

(The screenshot shows 2.5 GB used because it was taken while VM was being copied.)

![Upon return storage efficiency is expected to remain the same](/assets/images/vmware-nfs-ontap-20-ontap-datastore-storage-vmotion-with-se-details-vmw1.png)

When we started, vmw1 had Deduplication and Compression both disabled, but now - apart from that 4 MB stub file - the settings on vmw2 and vmw1 are identical - Thin Provisioning, Deduplication and Compression are enabled across the board.

### NFS share vmw1 after VM data was moved and with Thin Provisioning, Deduplication and Compression

![NFS share vmw1 after VM data was moved and with Thin Provisioning, Deduplication and Compression](/assets/images/vmware-nfs-ontap-21-ontap-nfs-shares-after.png)

### Automate

This is easy to automate with Power CLI or other tools.

I'd move VMs once a week, maybe over weekend.

If there's hundreds of them, then maybe 100 every night.

Each VM "owner" should zero out their disks with big churn, and be careful to not fill them up. Dynamic determination should be better, e.g. obtain available space in bytes, deduct 10%, then use `dd`:

```sh
$ df | grep '/sqldata' | awk '{ print $4}'
4208640
```

The above is an example of how `/home/brandon/yuge_junk_dir/sqldata` can mess your script up. If you can't do it right, it's best to use a fixed conservative value (20% of volume size) and review it once a month.

Also set up some OS monitoring to watch OS and data disk utilization of these VMs.
