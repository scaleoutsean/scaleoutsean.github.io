# Windows Server 2025 with NetApp SolidFire 12 iSCSI

Notes on using Windows Server 2025 with NetApp SolidFire iSCSI storage

This is the first of possibly several posts on Microsoft Windows Server 2025 and NetApp SolidFire.

- (you're here) **Part One: Windows Server 2025 with NetApp SolidFire** - getting started
- [Part Two: Windows Server 2025 with NetApp SolidFire 12 iSCSI](/2024/04/01/windows-server-2025-with-solidfire-part-two-sql-server-2022.html) - snapshots and SQL Server 2022
- [Part Three: Windows Server 2025 with NetApp SolidFire 12 iSCSI](/2024/04/01/windows-server-2025-with-solidfire-part-three-hyper-v.html) - notes related to Hyper-V

In this post you can find the following:

- [Connect to SolidFire iSCSI targets](#connect-to-solidfire-iscsi-targets)
- [SQL Server T-SQL snapshots and SolidFire volume snapshots](#sql-server-t-sql-snapshots-and-solidfire-volume-snapshots)
  - [SQL Backup and SolidFire](#sql-backup-and-solidfire)
- [Single and multi-site SolidFire clusters and Disaster Recovery](#single-and-multi-site-solidfire-clusters-and-disaster-recovery)
- [Windows-to-Storage mapping approaches](#windows-to-storage-mapping-approaches)
- [Conclusion](#conclusion)
- [Appendix A - cmdlets](#appendix-a---cmdlets)

## Connect to SolidFire iSCSI targets

My [solidfire-windows](https://github.com/scaleoutsean/solidfire-windows/) repository has the details of the workflow I used when setting up Windows with SolidFire iSCSI. Please check out that README for the details.

This post will only add some new or very detailed comments and observations specific to Windows Server 2025 (currently in Preview).

First, I used just one NIC for both services and iSCSI. Of course, that's a bad idea, normally we'd have 4 NICs, and maybe use one pair for front-end services, and another pair (LACP or not) for iSCSI. But this (192.168.1.199 is a route to my iSCSI L2 network) worked for me.

![](/assets/images/windows-server-2025-hyper-v-solidfire-01-iscsi-routing.png)

One of the nice enhancements in Windows Server 2025 is that it now takes a single click (in Local Server Properties) to enable SSH server. That's it!

![](/assets/images/windows-server-2025-hyper-v-solidfire-02-ssh-server.png)

With a *properly configured firewall* and SSH server enabled, it's possible to easily and securely access it remotely from any modern client.

![](/assets/images/windows-server-2025-hyper-v-solidfire-03-iscsi-target-discovery.png)

This also makes it possible to edit your PowerShell or other scripts remotely with VS Code over SSH. (I haven't tried that specifically, though.)

When creating a SolidFire tenant account for Windows, we can use Volume Access Groups (VAG) or CHAP. For Hyper-V clusters, it's easier to use VAG, but iSCSI Control Panel (Configuration tab) allows you to specify a CHAP secret for the initiator - just remember to enter it on all cluster members if dealing with HA clusters.

Once we add our SolidFire target (Storage VIP), we should be able discover disks. This is where fun begins...

At first I created 2 disks on SolidFire:

- 1G volume with 512b emulation
- 2G volume with native 4kB addressing

But the second target got discovered first (Disk 0 - OS; Disk 1 - 2G, Disk 2 - 1G)

![](/assets/images/windows-server-2025-hyper-v-solidfire-04-physical-volumes-list-filter.png)

At this point it becomes clear this won't be simple... Time to use that SSH access and get in!

I installed PowerShell 7. It's weird that this Preview shows it in the menu, but then when you start that PowerShell 7, it's actually version 5.1! 

I wanted to install SolidFire Core (for PS 7) so I downloaded the latest preview release from Github.

![](/assets/images/windows-server-2025-hyper-v-solidfire-05-powershell-solidfire.png)

- Step 1 - start PowerShell 7 from CMD (in SSH session)
- Step 2 - Install SolidFire Core 
- Step 3 - Import SolidFire Core module
- Step 4 - create credential for SolidFire
- Step 5 - connect to SolidFire cluster

Now below my Windows tenant account is 13, and I got a list of volumes for this tenant.

![](/assets/images/windows-server-2025-hyper-v-solidfire-06-powershell-solidfire-account-volumes.png)

I also installed [Vim for Windows](https://www.vim.org/download.php) because I prefer it to fiddling around with VS Code.

## SQL Server T-SQL snapshots and SolidFire volume snapshots

I didn't need to use snapshots, but if you run SQL Server, you may.

I came across this part in the [SQL Server documentation](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/create-a-transact-sql-snapshot-backup?view=sql-server-ver16) related to Transact-SQL snapshot backups.

> Because we must freeze I/O for the duration of the snapshot operation, it is essential that the snapshot happens quickly, so that the workload on the server isn't interrupted for an extended period. 

Quickly? No problem!

![](/assets/images/windows-server-2025-hyper-v-solidfire-07-powershell-solidfire-snapshot-duration-retention.png)

Point 1 shows it takes 0.2 seconds to snapshot a volume.

Admittedly this was on an idle volume, but SQL is idled in the pre-snapshot action with `SUSPEND_FOR_SNAPSHOT_BACKP` executed by SQL Server, and after that we need to take a snapshot quickly on SolidFire. 0.2 seconds ought to be enough for everyone. Why should we care about this niche stuff? See at the link:

> In the past, users have relied on third-party solutions that were built on top of the SQL Writer service to complete snapshot backups. The SQL Writer service depends on Windows VSS (Volume Shadow Service) along with SQL Server VDI (Virtual Device Interface) to perform the orchestration between SQL Server and the disk-level snapshot. Backup clients based on the SQL Writer service tend to be complex, and they only work on Windows. With T-SQL snapshot backups, the SQL Server side of the orchestration can be handled with a series of T-SQL commands.

This means you *no longer need* SolidFire VSS Hardware Provider to take application-consistent SQL Server 2022 backups (as long as this approach works).

Point 2 shows snapshot retention. Notice there's the parameter `Retention` in the SolidFire snapshot cmdlet in the screenshot above. I set that to `"00:01:00"` meaning 1 minute, because I wanted to see how SolidFire clears snapshots with a very short retention.

![](/assets/images/windows-server-2025-hyper-v-solidfire-08-solidfire-snapshot-retention.png)

It turned out it works fine, but garbage collection doesn't seem to run *that* frequently, so snapshots with such short retention usually get deleted a bit later than specified.

They do get deleted within minutes, but beyond the 1 minute we specified (marked with 1). Five minute retention time seems reasonable and those deleted on time (marked with 2). 

![](/assets/images/windows-server-2025-hyper-v-solidfire-09-solidfire-snapshot-retention-5m.png)

That shouldn't matter to you unless you take extremely frequent T-SQL snapshots - given SolidFire snapshot limit of 32 snapshots per volume, if you were to take them once a minute expire in 1 minute, you may hit the limit if the volume already has other snapshots from another schedule. Every five minutes with 5 minute retention could be practical.

On SolidFire itself, (storage) snapshot doesn't have to be retained for a very short time and then deleted. It can be cloned for backup, replicated to another site, or cloned for testing by another tenant. You may want to retain every Nth snapshot for 24 hours, which could be done in various ways, but the simplest is two T-SQL snapshot schedules - for example one every 15 min with 30 min retention (this would use half a dozen) and one every 24 hours with 24 hour retention.

### SQL Backup and SolidFire

Because SolidFire's VSS hardware provider hasn't been developed for a while, that was a problem for some SQL Servers, from what I've heard second-hand. I didn't understand in what business or technical circumstances the lack of a VSS hardware provider present problems when SolidFire is so easy to automate. 

One problem area that I recognized is the lack of proper RBAC, so some users hesitate to make the API accessible to server admins. But even so, there are [ways to mitigate the lack of rich RBAC](https://scaleoutsean.github.io/2023/12/07/solidfire-rbac-for-json-rpc-api.html) which most enterprises know how to securely implement (or better, most already have such infrastructure in place and just need to add a virtual host for SolidFire API endpoint).

Another "recent" (not really) SQL Server feature is the ability to backup SQL Server to [an object store](https://scaleoutsean.github.io/2023/08/28/sql-server-polybase-s3.html#backup-use-case). It takes minutes to configure and for small and medium databases that may be the easiest way to backup SQL Server and achieve ransomware-resistant (if your object store has Object Lock) backups with just a handful of SQL Server CLI commands.

## Single and multi-site SolidFire clusters and Disaster Recovery

A SolidFire cluster can be deployed on one site or across (low latency) sites. For Disaster Recovery, replication (sync and async) are available and is purely storage based.

- Single site, single SolidFire cluster: this worked fine before, including with Hyper-V, 
- Multi-site, single SolidFire cluster: technically one can stretch a SolidFire cluster across 3 racks or low-latency sites. See about [protection domains](/2021/06/08/solidfire-availability-zones.html), but I doubt there will be any official work done on this. Technically there's no difference between 9 1U chassis, 3 2U chassis, 3 racks or 3 data centers - it always works the same way, on a stretched Layer 2 network with properly configured MTU so that packets don't get fragmented or sent out of order.
- Disaster recovery (two SolidFire clusters): just use volume replication which can be setup in 5 minutes. Snapshots can be replicated as well - but need to be tagged on creation to make them available for replication - and snapshot retention on the remote site may be configured differently from the source site.

One note about snapshots replication: [make sure](/2021/04/20/solidfire-12.3.html) they don't expire before they can get replicated. 

To restore data from a remote site, just reverse the direction of replication. You can see [here](/2021/03/20/kubernetes-solidfire-failover-failback.html#video-demo) how a site can be failed over *and back* in less than 10 minutes. Failover and failback work symmetrically and it's trivial to execute.

As I mentioned elsewhere, the difference in IQN targets is the cluster Unique ID, which can be obtained like so:

```powershell
PS C:\Users\Administrator> (Get-SFClusterInfo).UniqueID
wcwb

```

The difference between *two* clusters:

- Management and Storage virtual IP (as well as nodes' IP's)
- Cluster Name (`DC1`, `DC2`) and UniqueID (used in SolidFire IQN)
- Volume names may be different or consistent; in practice I found it hard to ensure consistency because each site may need to do various things like cloning and so on, especially when containers are used
- Volume IDs are unique and not controllable, so there's no way to "guess" them

If you keep track of your configuration or automate it like I did in that demo, it's easy to swap configuration details and reconfigure iSCSI initiators: swap `iqn.2010-01.com.solidfire:wcwb.sqldb.136` for `iqn.2010-01.com.solidfire:aaaa.sqldata.49`, change iSCSI Target Portal to new Storage Virtual IP, re-scan, and that should let you see the replicated volumes. You would have to stop replication from DC1 to DC2, flip DC2 volumes to read-write mode, and then reverse the direction of replication so that DC2 starts replicating to DC1.

## Windows-to-Storage mapping approaches

Earlier we saw how the "second" SolidFire volume for Windows got discovered and accessed first, so one has to watch out for device slippage and mapping consistency. I don't say "worry" but "watch out" because I haven't heard that it's a problem - we just need to be careful.

Consider using disk volume labels that reflect a SolidFire volume's property. If VolumeID changes (say, if we restore it by cloning a snapshot to a different name) perhaps we should configure Windows with the Volume Name.

![](/assets/images/windows-server-2025-hyper-v-solidfire-11-windows-filesystemlabel-solidfire-volume-name.png)

Now the third volume has a volume label that's identical to the SolidFire volume name. Obviously, we should now avoid creating volumes with duplicate names.

![](/assets/images/windows-server-2025-hyper-v-solidfire-12-windows-filesystemlabel-done.png)

With that in place, it is possible to match Windows volume labels with SolidFire volume names and create a report that maps Windows volumes to SolidFire volumes.

![](/assets/images/windows-server-2025-hyper-v-solidfire-13-windows-to-solidfire.png)

Windows Disks are still "out of order" (or rather, in order of discovery), as you can see above. I think it's probably futile trying to ensure consistent ordering of order of Windows Disks and SolidFire Volume IDs.

It could be done like so:

- Create the first SolidFire volume, scan iSCSI, login to Physical Disk 1, create volume mounted at E:
- Create the second SolidFire volume, etc. get volume F:
- etc.

But I don't know if such an ordering could be *preserved*, so I didn't try to do it. Also, what to do if you need to add a new volume "in between" E: and F:?

I didn't notice this before (in older versions of Windows), but iSCSI Control Panel lets you create volume binding to iSCSI devices, which adds E:, F: and G: to the panel when you click on Auto Configure. You can also use Add/Remove, but even as you add a single mount point (e.g. E:\), Windows won't let you specify *which* SolidFire volume would be bound to E:.

![](/assets/images/windows-server-2025-hyper-v-solidfire-14-windows-iscsi-fix-volume-mountpoints.png)

Volume List is merely a "reservation" of letters which perhaps makes Windows skip an enumeration/scan of available mount points. 

It's just a *list* of drive letters, not a map of drive-to-disk pairing, so I wonder if device slippage can still happen if (say) device binding E or F disappear. We'd want fixed device names, but I haven't found a way to do it with Windows Server 2025 Preview.

Another confusing detail is that even iSCSI Report (in Configuration tab) isn't helpful.

![](/assets/images/windows-server-2025-hyper-v-solidfire-15-windows-iscsi-initiator-report-confusion.png)

- SolidFire Volume 134 was created first and 135 immediately after that (before Windows storage scan)
- Windows iSCSI Report says SolidFire volume ID 135 is Target #0 (yay!)
- Windows iSCSI Report also says Target #0 is Disk 2, which is in fact iSCSI Target 1 in Disk Manager (huh?)

Where's Target 0, then? It's SolidFire volume ID 135 which is shown in iSCSI report (green rectangles), as Target #1 (iSCSI Target 0 to Disk Manager).

Imagine having to deal with that for 8 or 16 volumes!!! "iSCSI Target #7 is Target 4 which is Disk 2". 

This seems hard to control as well, so I figure the best one can do is create some sort of a report that relies on unique SolidFire volume names (this volume naming policy administrator must be responsible for) and the consistent consistency of those names with Windows volume labels.

With that - however you get this done - you can reasonably easily confirm this alignment and potentially automate storage replication and BC/DR.

Example below shows I have consistent filesystem labels and SolidFire volume names, as well as respective drive letters (or paths, if you use those).

```powershell
PS C:\> $win2sf

Name                           Value
----                           -----
win1                           {[SfIqn, iqn.2010-01.com.solidfire:wcwb.win1.134], [DriveLetter, F], [SfVolID, 134], [FileSystem, NTFS]…}
win2                           {[SfIqn, iqn.2010-01.com.solidfire:wcwb.win2.135], [DriveLetter, G], [SfVolID, 135], [FileSystem, NTFS]…}
sqldb                          {[SfIqn, iqn.2010-01.com.solidfire:wcwb.sqldb.136], [DriveLetter, E], [SfVolID, 136], [FileSystem, NTFS]…}

PS C:\> $win2sf.win1

Name                           Value
----                           -----
SfIqn                          iqn.2010-01.com.solidfire:wcwb.win1.134
DriveLetter                    F
SfVolID                        134
FileSystem                     NTFS
FileSystemLabel                win1
SfVolName                      win1

PS C:\> $win2sf.win2

Name                           Value
----                           -----
SfIqn                          iqn.2010-01.com.solidfire:wcwb.win2.135
DriveLetter                    G
SfVolID                        135
FileSystem                     NTFS
FileSystemLabel                win2
SfVolName                      win2

PS C:\> $win2sf.sqldb

Name                           Value
----                           -----
SfIqn                          iqn.2010-01.com.solidfire:wcwb.sqldb.136
DriveLetter                    E
SfVolID                        136
FileSystem                     NTFS
FileSystemLabel                sqldb
SfVolName                      sqldb

```

It's not cluster-aware (it doesn't gather host names), but it could be modified to gather data from different hosts for a cluster-wide view.

There's a generic - but GPL 3.0 - script [here](https://github.com/sstorholm/Windows-iSCSI-Enumerator). It doesn't directly tell you SolidFire volume names and IDs, but you can get them from TargetNodeAddress. Example output:

```powershell
DiskNumber           : 2
DriveLetter          : E
TargetNodeAddress    : iqn.2010-01.com.solidfire:wcwb.sqldb.136
TargetSideIdentifier : 0100
Size                 : 5000658944

DiskNumber           : 3
DriveLetter          : F
TargetNodeAddress    : iqn.2010-01.com.solidfire:wcwb.win1.134
TargetSideIdentifier : 0100
Size                 : 2000683008

DiskNumber           : 1
DriveLetter          : G
TargetNodeAddress    : iqn.2010-01.com.solidfire:wcwb.win2.135
TargetSideIdentifier : 0100
Size                 : 20000538624
```

Another way to create a (Windows) cluster-wide or (SolidFire) storage-wide view would be to include server names and key SolidFire volumes on volume.Iqn, and send reports to Elasticsearch or other database. Then it would be easy to get a big picture from a custom table.

**NOTE:** I noticed that the original (first) Windows volume label remains buried in deep in volume properties. That seems fine, as changing the label does work as expected (the label does get changed), but you need to be careful not to use some obscure parameter values if you've changed labels. An easy fix for that is to stick one one volume label for the lifetime of a volume.

## Conclusion

Both 512b and 4kB sectors worked, and iSCSI-wise it seems not much has changed.

The ability to do easy remoting with SSH is a big improvement.

Drive-to-storage mapping is still not as good in VMware where it's easy to figure that out by comparing ESXi and the SolidFire volume's ScsiNAADeviceID. For that reason, I'd just focus on volume labels and SolidFire volume names when managing SolidFire in Windows environments.

The rest of Windows-related configuration details, considerations and best practices can be found in my Github repo.

## Appendix A - cmdlets

Here are some examples to get you started. 

Windows volume information can be gathered for the labels (and SolidFire volume names) to exclude OS boot disk, for example.

```powershell
PS C:\> $win_vol = Get-Volume -FileSystemLabel sqldb,win1,win2
```

Windows iSCSI sessions that connect to SolidFire. Note that `iqn.2010-01.com.solidfire:wcwb.sqldb.136` contains a cluster Unique ID (`wcwb`), so you could add that if connected to multiple SolidFire clusters from the same Windows iSCSI client.

```
PS C:\> $iscsi_session = Get-IscsiSession  | Where-Object -Property TargetNodeAddress -CMatch "iqn.2010-01.com.solidfire"

```

To get SolidFire volumes used by a storage tenant account, specify their account ID. 

```powershell
PS C:\> $sf_vol = (Get-SFVolume -AccountID 13) | Select-Object -Property Name,Iqn,VolumeID

```

When looking for filesystem type, drive letter or filesystem label, you may need to get it from CIM Object Properties (returned by Get-Volume, if you store the object in a variable). 

```powershell
PS C:\> Get-Volume -DriveLetter F

DriveLetter FriendlyName FileSystemType DriveType HealthStatus OperationalStatus SizeRemaining    Size
----------- ------------ -------------- --------- ------------ ----------------- -------------    ----
F           win1         NTFS           Fixed     Healthy      OK                      1.83 GB 1.85 GB

PS C:\> $win_vol = Get-Volume -DriveLetter F

```

Then loop through the volumes and inspect the properties "FileSystem", "DriveLetter", "FileSystemLabel".
