# UNMAP/TRIM Hyper-V volumes backed by NetApp SolidFire

Some notes on rethinning Windows NTFS host filesystems that reside on SolidFire iSCSI storage

- [Introduction](#introduction)
- [General notes on NTFS rehinning and SolidFire](#general-notes-on-ntfs-rehinning-and-solidfire)
- [QoS-related tips](#qos-related-tips)
- [Prepare Windows host volume](#prepare-windows-host-volume)
- [SDelete](#sdelete)
  - [SDelete with Windows guests on Hyper-V](#sdelete-with-windows-guests-on-hyper-v)
- [TRIM/UMAP enabled vs SDelete](#trimumap-enabled-vs-sdelete)
  - [Normal behavior (TRIM/UMAP enabled)](#normal-behavior-trimumap-enabled)
  - [TRIM/UNMAP disabled](#trimunmap-disabled)
  - [TRIM/UNMAP disabled and enabled mid-way](#trimunmap-disabled-and-enabled-mid-way)
- [Conclusion](#conclusion)

## Introduction

Hyper-V users sometimes wonder about various details of rethinning NTFS volumes backed by SolidFire storage.

From SolidFire side, there's no difference between OS - if the iSCSI client that sends UNMAP commands, SolidFire releases those blocks. 

As Microsoft Hyper-V was never officially supported by NetApp HCI, and there are SolidFire users who run Hyper-V on 3rd party servers, I decided to revisit this topic and create some notes on it.

## General notes on NTFS rehinning and SolidFire 

Windows supports UNAMP and we can use [fsutil](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/fsutil-behavior) to check: it shows unmap on NTFS filesystems is On (enabled). In other words, `disableDeleteNotify` is 0 (not disabled).

On Hyper-V, same as with other hypervisors, there are two general situations:

- Deleted disks or entire guests (VMs) - entire disks are removed, so OS just needs to mark released space deleted and issue UNMAP to iSCSI target
- Disks in guests (VMs) need unmap - [here](https://learn.microsoft.com/en-us/windows-hardware/drivers/storage/thin-provisioning#unmap-requests-from-the-hyper-v-guest-operating-system) you can find how that works

> When a large file is deleted from the file system of a VM guest operating system, the guest operating system sends a file delete request to the virtual machine’s virtual hard disk (VHD) or VHD file (or VHDX file). The VM’s VHD or VHDX file tunnels the SCSI UNMAP request to the class driver stack of the Windows Hyper-V host

If the guest supports UNMAP and has it enabled, nothing needs to be done. It should just work.

There's also a way to manually allocate empty filesystem space by filling it up with zeros, which SolidFire can deduplicate. From the same Microsoft page above:

> End users or system administrators can use the Optimize Drives utility to reclaim space either by creating a manual request or by optimizing the schedule configuration.

[Optimize-VHD](https://learn.microsoft.com/en-us/powershell/module/hyper-v/optimize-vhd?view=windowsserver2022-ps#example-2) can be used to retrim (rethin) VHD files.

> The Optimize-VHD cmdlet optimizes the allocation of space in one or more virtual hard disk files, except for fixed virtual hard disks. The Compact operation is used to optimize the files. This operation reclaims unused blocks as well as rearranges the blocks to be more efficiently packed, which reduces the size of a virtual hard disk file.

> To use Optimize-VHD, the virtual hard disk must not be attached or must be attached in read-only mode.

A generic way to zero out free space when OS doesn't do it is to run Microsoft's utility [SDelete](https://learn.microsoft.com/en-us/sysinternals/downloads/sdelete).

Why not just run SDelete all the time, regardless of the situation?

Because SDelete set to zero out empty filesystem space will ... well - zero out all the empty filesystem space.

That may not be necessary if your filesystem supports rethinning. And when it comes to non-fixed VMs disks that support rethinning and have it enabled, Optimize-VHD can be used to rethin those.

A "workaround" approach to rethinning would be to use Live Migration and "Move only the virtual machine’s virtual hard disks" to move disks to another NTFS filesystem and then back. I haven't tried this recently and the reason I don't try it is SolidFire doesn't support ODX, so Live Migration actually copies entire disks around using host OS, and is therefore quite "expensive".

## QoS-related tips

Running SDelete on host while guests are active on the same filesystem will impact guest performance.

Limiting process or I/O priority of SDelete seems risky, so I'd just let it run as it does.

If you run SDelete on a regular basis, you could [set QoS to a higher Max IOPS value](/2020/11/28/powershell-set-sfqosexception.html) before running SDelete, and revert it after you're done.

## Prepare Windows host volume

I tested this on Windows 11 (guest) connected directly to SolidFire 12.5. 

I couldn't make it run Hyper-V (lack of RAM), so I couldn't try Optimize-VHD or anything with guest VMs, but I could try to see whether mere deleting of files on NTFS results in UNMAP sent to SolidFire SCSI device.

Prepare IQN:

![](/assets/images/windows-unmap-hyper-v-00-prepare-iqn.png)

Prepare to initialize new volume:

![](/assets/images/windows-unmap-hyper-v-01-prepare-to-initialize.png)

Initialize:

![](/assets/images/windows-unmap-hyper-v-02-initialize.png)

Format using default options:

![](/assets/images/windows-unmap-hyper-v-03-format.png)

List of volumes:

![](/assets/images/windows-unmap-hyper-v-04-volume-list.png)

Test run with SDelete (note that "`-c`" isn't what we'd use for rethining - more on that below).

SolidFire garbage collection runs at top of the hour so before I could see what happens with space released by deleting files, I ran SDelete once on a filesystem which did not have any files deleted.

![](/assets/images/windows-unmap-hyper-v-05-sdelete-test-run.png)

I annotated the performance chart to remind that SDelete workload is real. (Actual I/O in the screenshot is tiny because this is a SolidFire demo VM.)

## SDelete

Download the latest (the most stable?) version and check available switches/options. 

"`-c`" cleans free space, and "`-z`" zeros it out. We should use "`-z`", as "`-c`" seems to cryptographically overwrite empty space with crap, which can't be deduplicated. 

I'm not sure what happens when "`-c -z`" are used together. We could find out experimentally but I wasn't curious enough to wait another hour until next SolidFire Garbage Collection.

Unfortunately, SDelete doesn't report how much capacity was released, if any, which is why I rely on the SolidFire volume fullness indicator, although it's time consuming to use that approach - every time I need to wait until the top of the hour, and only then I can do the next step.

Understand that if your NTFS disk is 1 TB large and only 30% full, `SDelete64.exe -z` will actually write 700 GB of zeros to it. So comparatively speaking it's not an inexpensive operation. 

If your Hyper-V has 4 NTFS disks of 8 TB, running SDelete sequentially (one filesystem at a time) once every weekend could be uneventful. But I wouldn't run it inside of all VMs at once.

### SDelete with Windows guests on Hyper-V

In VMs (guests), volumes may be thin-provisioned, so running SDelete will fill thin-provisioned disks to their full size, but since `-z` fills them with zeros rather than garbage, modern Hyper-V should recognize this and grow this virtual disk only slightly - it should not grow it to make underlying SolidFire-backed NTFS volume full. 

Still, if you plan to run SDelete in older OS (Windows 2012 or whatnot), better create a small test volume and try this out. 

Recent Windows OS should just work as rethinning is enabled by default, so no SDelete would be required. We could use Hyper-V tools when possible and necessary.

Recent Linux OS can work with supported filesystems, but the OS must have a fstrim schedule or mount disks with "`-o discard`".

## TRIM/UMAP enabled vs SDelete

### Normal behavior (TRIM/UMAP enabled)

I started with TRIM/UMMAP enabled (OS default on Windows 11).

![](/assets/images/windows-unmap-hyper-v-06-trim-unmap-status.png)

I unzipped SDelete files to NTFS (633 KB), ran SDelete (which wasn't supposed to free any space, as nothing was deleted since I created it), then copied a 2 GiB ISO to it, deleted the ISO and emptied Recycle Bin for all volumes.

![](/assets/images/windows-unmap-hyper-v-07-filesystem-space-allocation.png)

Then I waited until next top of the hour to see if used capacity remained low. Here we can see API calls to create a volume and a VAG were followed by a GC run later on.

![](/assets/images/windows-unmap-hyper-v-08-first-gc-run-after-filesystem-created.png)

It appears this worked as expected. SolidFire claimed FS fullness was only 0.21% (5 GiB * 0.21% or some 1 MB) - which roughly corresponds to the size of SDelete files plus the size of a basic NTFS data structure.

"`fsutil volume diskfree g:`" shown earlier indicated Used Bytes was 18.5 MB and Total Reserved was 4 MB, but if those were merely reserved they wouldn't take any physical capacity, so it's not surprising that SolidFire reported just 1 MB was really used.

![](/assets/images/windows-unmap-hyper-v-09-rethinned-unmapped-ntfs.png)

Additionally, account storage efficiency showed 6.53x indicating that filesystem structures and SDelete executables were very compressible, and there wasn't as much duplicate 0's (in filesystem structures) as I expected (deduplication was 1x, indicating very little duplicate data).

![](/assets/images/windows-unmap-hyper-v-10-rethinned-unmapped-ntfs-storage-efficiency.png)

So, in this scenario TRIM/UMAP works on host (as it would on Windows 11 guests in Hyper-V) and SDelete is not necessary.

### TRIM/UNMAP disabled

To see what we're supposed to see when TRIM/UNMAP does not work, I disabled it.

```sh
fsutil behavior set disabledeletenotify 1
```

Then I copied the same big ISO back to G:\. At this time TRIM/UNMAP was already disabled.

![](/assets/images/windows-unmap-hyper-v-11-copy-and-delete-big-file.png)

I waited until next GC. Boom - SolidFire shows volume fullness of 39.92% with just 633 KB in Windows Explorer!

![](/assets/images/windows-unmap-hyper-v-12-rethin-unmap-disabled.png)

And the big, compressed ISO - deleted but with data still on disk - ruined compression by dragging the compression factor down to 1x.

![](/assets/images/windows-unmap-hyper-v-13-rethin-unmap-disabled-efficiency-destroyed.png)

So, this worked as expected:

- after next GC SolidFire showed disk fullness 39.92% although NTFS displayed the same 633 KB utilization as before - disk space was NOT freed
- deduplication & compression ratios dropped to 1x, as the compressed ISO file completely destroyed storage efficiency (even though we already deleted it in Windows Explorer)

### TRIM/UNMAP disabled and enabled mid-way

Then I re-enabled TRIM/UNMAP and waited:

```sh
fsutil behavior set disabledeletenotify 0
```

After the next GC, the disk was **NOT** thin again. This surprised me. 

After re-reading TFM, I found this:

- Trim (setting) is effective when the next unmap command is issued
- Existing inflight IO are not impacted by the registry change

So the behavior is correct: I deleted the 2 GiB ISO while UNMAP commands weren't being sent to device. Since then I've enabled TRIM/UMAP, but I haven't deleted anything, so no UNMAP commands have been issued. Deallocated blocks from the ISO file had remained on the disk.

Consequently, my next test was to run "`SDelete -z G:`" to see if SDelete is a good way to fix this for "pre-existing" deallocated blocks. 

I expected space to be reclaimed: I suppose using SDelete to zero out empty space on G: would not just zero the space out, but also UNMAP it, since SDelete actually writes data (zeros) to disk and then deletes it, triggering UNMAP.

This did work and NTFS on disk G: was rethinned to 0.21% fullness.

## Conclusion

On modern Hyper-V hosts, default behavior should work fine both on host and guest level, as Hyper-V passes through UNMAP commands from enabled guests to disks.

If TRIM/UNMAP is for some reason disabled on the host, enabling it will not rethin previously deallocated space on filesystems. In that case you may run SDelete on the filesystem to recover capacity deallocated when UNMAP was disabled.

In modern guests such as Windows Server 2019, SDelete should not be required if UNMAP is enabled (which it is). Modern Linux (Ubuntu 22.04, Rocky Linux 9, etc.) needs to mount filesystems with the discard option, or periodically run fstrim . 

SDelete creates real I/O, so best do not run it in parallel when performance-sensitive guests are active.

You may take a snapshot before you try SDelete, and consider trying it out on a test filesystems (host) or test VM (guest) before you use it on production volumes/VMs.
