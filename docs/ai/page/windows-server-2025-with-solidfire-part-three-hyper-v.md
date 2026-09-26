# Windows Server 2025 with NetApp SolidFire 12 iSCSI Part Three

Notes on Hyper-V (Windows Server 2025, NetApp SolidFire)

This is the second of the posts posts on Microsoft Windows Server 2025 and NetApp SolidFire.

- [Part One: Windows Server 2025 with NetApp SolidFire](/2024/03/31/windows-server-2025-with-solidfire-part-one.html) - getting started
- [Part Two: SQL Server T-SQL and Snapshots](/2024/04/01/windows-server-2025-with-solidfire-part-two-sql-server-2022.html) - using SolidFire snapshots with SQL Server 2022
- (you're here) **Part Three: Hyper-V** - using Hyper-V with SolidFire iSCSI

In this post you can find the following:

- [Hyper-V (Widows Server 2025) and NetApp SolidFire](#hyper-v-widows-server-2025-and-netapp-solidfire)
- [Checkpoints](#checkpoints)
- [SolidFire snapshots and Hyper-V](#solidfire-snapshots-and-hyper-v)
- [Conclusion](#conclusion)

## Hyper-V (Widows Server 2025) and NetApp SolidFire

There isn't so much to share here, but since some may still wonder "what's new", I'll share what is and isn't new.

To test Hyper-V on Windows Server 2025 Preview, I configured Hyper-V to use a 20GB drive G: (SolidFire Volume ID 135) from Part Two of this series - the only difference is it was 5GB then and I extended it on SolidFire and then on Windows to be sure it can accommodate a VM plus some other stuff.

![](/assets/images/windows-server-2025-hyper-v-00-lets-hyper-v.png)

Install was uneventful, it just worked, with some activity reflected in my SolidFire dashboard.

![](/assets/images/windows-server-2025-hyper-v-01-installing-debian.png)

One thing to note - unrelated to this screenshot - that Hyper-V can optionally inject its integrations package ("vmware-tools") and that's what I noticed in Debian VM after it was installed. 

![](/assets/images/windows-server-2025-hyper-v-02-debian-progress.png)

## Checkpoints

Now, what's new concerning external 3rd party storage integrations? Not much, it seems.

Hyper-V checkpoints are now richer - there's "production" (crash-consistent) checkpoints which may fallback to "standard" (old style, checkpoints RAM as well).

![](/assets/images/windows-server-2025-hyper-v-03-hyper-v-checkpoints.png)

You may create them from the UI or PowerShell, and restore works just as well.

```powershell
PS C:\> (Get-VMCheckpoint -VMName 'Debian').Name
Debian - (4/1/2024 - 7:36:32 PM)
Debian - (4/1/2024 - 7:39:02 PM)

PS C:\> Restore-VMCheckpoint -Name 'Debian - (4/1/2024 - 7:36:32 PM)' -VMName 'Debian'

```

That is completely Hyper-V/Windows-side, so very briefly:

- It's fast
- It works with any Windows-compatible storage
- Windows guests seem to use VSS while Linux seem to use a form of fsfreeze utility contained in the Hyper-V integration package mentioned earlier
- Similar to ESXi, it's [not recommended to go too crazy on these](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/best-practices-analyzer/avoid-using-checkpoints-on-a-virtual-machine-server-workload-production) and these aren't a substitute for backup. The same thing that we know from vSphere, basically 

## SolidFire snapshots and Hyper-V

Related to SolidFire, you can still take SolidFire volume snapshots. For example, I snapshotted volume 135 (Windows drive G:).

![](/assets/images/windows-server-2025-hyper-v-04-storage-hardware-snapshots.png)

Then, to test "recovery from a crash-consistent snapshot", I did the following:

- Stop and delete the VM
- Stop Hyper-V service
- Delete everything on volume G:\

![](/assets/images/windows-server-2025-hyper-v-05-delete-test.png)

You wouldn't want to stop Hyper-V to recover a volume; especially if you had a bunch of volumes maybe dozens of VMs would have to be brought down for a full restore. Preferably you'd want to do it online. But, without any integration where this wizardry can be automated, this is probably as good as it gets for SolidFire. 

If the loss was partial (say, one of the files in G:\debian), we *could* create a clone from that snapshot and just copy the missing file(s) to G:\debian, so it's not that bad - granular restore is possible and not all VMs have to be rolled back in that case.

To test snapshot rollback, though, I deleted all of them.

![](/assets/images/windows-server-2025-hyper-v-06-delete-done.png)

Now we **must offline the disk**. Remember, Hyper-V is already offline by now.

![](/assets/images/windows-server-2025-hyper-v-07-offline-volume.png)

Only then it's okay to rollback the volume to the snapshot.

![](/assets/images/windows-server-2025-hyper-v-08-rollback.png)

The last steps:

- Online the disk
- Start Hyper-V

If you want to take perfectly consistent snapshots, that's also possible if you don't mind to stop and then start your VMs (with a SolidFire snapshot in between - see Part Two of this series about automating those). 

There aren't many applications that cannot tolerate crash-consistent snapshots, but if I had to protect them I'd consider something like this:

- Regular crash-consistent snapshots retained for a few days
- Stop a guest VM, snapshot its underlying Windows volume, start a VM - on weekends that cycle can also be used to backup VMs

## Conclusion

There isn't much new as far as SolidFire users are concerned - it still works well and is easy to use and I don't think anything from [solidfire-windows](https://github.com/scaleoutsean/solidfire-windows) is wrong. 

Of course, because SolidFire was discontinued, VSS integration and ODX (equivalent of ESXi's VAAI) are missing, so we may need a bit of extra care when doing a lot of live migration or considering backup options.

One area where I expected more from Hyper-V on Windows Server 2025 is a better automation. I hoped they'd make it easier to integrate it with storage as one can do on KVM, but that didn't happen.
