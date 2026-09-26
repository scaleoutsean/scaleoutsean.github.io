# santricity-powershell adds single volume snapshots and clones

santricity-powershell cmdlets for single volume snapshots and clones

## Introduction

Recently I released [santricity-powershell](https://github.com/scaleoutsean/santricity-powershell) and this weekend I worked on adding snapshot and clone support.

## What is new

Notably, these are for single volumes. See [this post](/2026/01/14/e-series-santricity-clones-consistency-group-clones.html) about the difference (although you don't really need to - most readers no doubt know how stand-alone volumes compare to consistency groups).

So, what's new in these:

- Snapshot group (i.e. "snapshot reserve repository volumes") cmdlets
- Snapshot (i.e. "snapshot image") cmdlets
- Clone (i.e. "snapshot volume") cmdlets

You can find the details in the repository on Github.

The confusingly named "snapshot group" is a group of Copy-on-Write "evacuation zones" for snapshot image data. It's similar to snapshot reserve on ONTAP. SolidFire, for example, didn't have those - you'd just take snapshots (or not) - possibly until you hit the maximum (32 on SolidFire) or run out of space, but you didn't have to waste capacity on "reserving" anything (which ironically takes away from available capacity for volumes, making it easier to run out of that capacity in order to not run out of this (snapshot reserve) capacity).

In any case, these cmdlets let you do the entire workflow - create SGs, create snapshots, create clones, refresh clones. Oh yes, some volume mapping cmdlets (to present clone volumes to *other* hosts) have been added, too. And they're easy to use. 

There's no snapshot schedule creation cmdlets yet. If you need a schedule you can create it in the UI. I just don't see enough value in implementing this error prone cmdlet and it'd require a lot of typing anyway.

## What's the big deal?

It's not a huge deal (everyone can do snapshots and it's been available in Ansible for E-Series), but almost no one likes to automate with Ansible. Even commercial backup vendors seem to be using lousy SMcli scripts (I think that's what Veritas Netbackup's SANtricity plugin does).

It's better now.

```powershell
# Take initial snapshot
$snap1 = New-SANtricitySnapshot -VolumeName "DB"

# Create Clone (View)
$clone = New-SANtricityClone -SnapshotImageId $snap1.id -Name "DB_Test_Clone"

# Map it to your test server
New-SANtricityHostMapping -VolumeId $clone.id -HostName "TestServer"
```

Now on the host you rescan storage and mount this thing. Read-only clones may not be mountable on Windows, but Linux users should be fine (check "read only" mount options for your filesystem). Or create writeable clones (default is read-only), if you have issues mounting read-only clones.

Then after you backup or finish testing, unmount and log out (iSCSI).

You may delete the clone or refresh it. Say you want to refresh your clone for a test with latest data.

```powershell
# Take NEW snapshot
$snap2 = New-SANtricitySnapshot -VolumeName "DB"

# Refresh the existing clone to the new snapshot data
Update-SANtricityClone -Id $clone.id -SnapshotImageId $snap2.id
```

Now you have fresh data for testing or backup again.

If you do this a lot, you need to control the number of snapshots (and/or clones) because the limit isn't high and you shouldn't have many anyway. 

SANtricity snapshot scheduler lets you set the maximum number (default: 32) after which the oldest snapshot gets auto-purged, so they get rotated out and the Snapshot Group doesn't get full. The other, non-default setting, is to suspend writes to base volume - this means your application stops, but if you're afraid of ransomware this option is available and can't be gamed by repeated overwrites.

Unlike the auto-generated, uninspired, 9-to-5 tools (easy to see in PowerShell modules "out there", including old PowerShell modules for SANtricity), `santricity-powershell` works how it's *supposed* to. That means I can get the most recent snapshot, and delete the oldest the way I'm supposed to - with a simple switch.

```powershell
# Get the most recent snapshot for the DB volume
$prodSnap = Get-SANtricitySnapshotImage -BaseVolumeId $dbVol.id -Newest

# Refresh our test environment clone to match production
Update-SANtricityClone -Name "DB_Test_Clone" -SnapshotImageId $prodSnap.id

# Delete the oldest snapshot on the DB volume to free up space
Remove-SANtricitySnapshotImage -BaseVolumeId $dbVol.id -Oldest
```

The easiest thing to do is restore a snapshot from the SANtricity Web UI. It is recommended to do it as follows:

- Take note of snapshot dates and inspect the one you aim to restore
- Take a **new** snapshot just in case. If you have to, delete the oldest snapshot before that
- Then unmount the volume on the host and restore from the UI (recommended)

### When to use?

Many applications and hypervisors can take hardware-independent snapshots (example: [Hyper-V](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/checkpoints?tabs=hyper-v-manager#creating-checkpoints)) and even upload them to S3.  With those, you would probably use hardware snapshots sparingly - for example, with vSphere and Hyper-V you may do like this:
- Hourly hypervisor VM snapshots, retain eight
- One hypervisor-based VM snapshot every eight hours, retain three
- Daily hardware snapshots, retain seven

There are applications where you may want to take snapshots daily and before major patches or upgrades.

Backup offload to another server is a use case for plain filesystem backup, but also databases. 

There's no need to create excessive number of hardware snapshots - most volumes will be fine with just two that are created on snapshot schedule and expired, and maybe one or two on-demand, which can be deleted immediately after they're no longer necessary.

## Related information

### Host-side

Remember to do the host-side thing (unmounte before a refresh; rescan, login and mount after) as you normally do.

We don't tell hosts what to do. If you refresh clones at 10 am, be done with your clone work by 9:55 am and unmount the volume before 10 am sharp. Then, by 10:05am you can query your latest SANtricity snapshot for the volume to confirm it's less than 6 minutes old and start using it again.

Ansible lets you control host-side behavior, but you don't need an application for orchestration unles it's something complex. Simply create an independent schedule on servers. You're not trying to create some low-latency coupling here.

### Host quiesce (freeze or suspend I/O)

Likewise, you can freeze the host IO, VM or application, and then call these cmdlets (to create a snapshot, mostly) from the same script.

Do we need Ansible or similar?
- Yes, you may need Ansible or similar if your server administrator or DBA must not be allowed to access storage (the same API allows them to delete all volumes). And you have to assume your server will get hacked, so even if you trust your DBA, you shouldn't try to get away with letting server administrator being able to wipe your disk array
- No, you do not need Ansible or similar if you nicely time your sequence and have NTP and logging done. When taking a snapshot, freeze the app or VM at 9:59:55am, let SANtricity scheduler do its thing at 10 am sharp. Resume the app at 10:00:10 am. Send the logs of both events to Elasticsearch or other place where you can keep an eye on these logs and any errors

Not good enough? It's easy to do it better.

Start polling for newest snapshot at 10:00:01 am, once every second, and resume IO as soon as you spot a new snapshot or alert if no snapshot gets generated by 10:00:15 am. You need read-only access to SANtricity API and you can use the built-in `monitor` account for that so that even if the server gets hacked, the attacker can't do anything to storage. Easy!

### Consistency Groups

Support for CGs is a to-do item, but there's nothing different or more difficult about Consistency Groups. 

For now, you can loop over individual volumes if your application or IO can be frozen (suspended) while you do that. Or just use a snapshot schedule that creates crash-consistent CGs.

As an aside: I sometimes hear from people how quiesced or application-consistent snapshots are somehow "better", but if you can't reliably count on your application handling unplanned OS or system outages, you have a problem. 

CGs are necessary to handle applications that use multiple mutually dependent volumes, but even plain crash-consistent CG snapshots should reliably protect them. If they can't, you're in trouble no matter how you create snapshots.

### SANtricity Cloud Connector

[This thing](https://docs.netapp.com/us-en/e-series/cloud-connector/backup-intro-concept.html#run-full-and-incremental-backups) existed for some time. If it was open source and provided some implicit assurance such backups will remain restorable no matter what, maybe it would have been useful.

As it didn't do either, I've never heard of anyone who used it. I've never heard anyone tell me what it's good for, so I'm not surprised it's gone.

Well, now you can get [Kopia](https://kopia.io/docs/installation/), Veeam Community Edition or something else that works for you, and backup your data to S3 for almost free - just refresh your clones before each run and kick off your backups. And you'll very likely be able to restore your backups for a long while.

A modern, SANtricity, version of [SolidBackup](https://github.com/scaleoutsean/solidbackup) is now possible if you want to automate this with or without Ansible (which I use in SolidBackup). If you're on Windows, you could have the whole thing run just Kopia or [rclone](https://rclone.org/downloads/) to S3. This way you can have an unlimited number of cloud-based backups that consume a small amount of low-cost capacity.

### Monitoring

You need to watch out for issues. It's vague, but that's because it is:

- Read the E-Series snapshots TR ([TR-4747](https://www.netapp.com/media/17167-tr4747.pdf)) to understand what makes sense
- Like with VMware, don't pile up too many snapshots. CoW doesn't like that due to their cascading effect on performance
- You need to watch out for capacity in "internal" volumes used for Snapshot Group (repos) and separate clone repos (these can be small, if you backup and just need read-write in order to be able to mount, a 1% reserve is enough). [E-Series SANtricity Collector](https://github.com/scaleoutsean/eseries-santricity-collector?tab=readme-ov-file) lets you monitor many things related to capacity and even [snapshot group capacity](https://github.com/scaleoutsean/eseries-santricity-collector/blob/master/docs/SCHEMA.md) although you can get that with cmdlets such as `Get-SANtricitySnapshotGroup` as well. This reminds me - years ago I wrote several PRTG E-Series monitoring scripts in PowerShell. Those may need small updates as it's been a while, but if you're a PowerShell user and prefer it over Python, check those out
  - [PRTG with E-Series](/2023/09/25/monitoring-netapp-eseries-with-prtg.html) - for 11.80, so it may need very few updates, really
  - [Consistency Group monitoring](/2023/10/29/consistency-group-monitoring-in-eseries.html) - this post is about stand-alone volumes (not CGs), but if you're wondering about the scope of monitoring snapshots, clones and such, it contains some useful information
- Start small (daily snapshots, keep 5), watch Snapshot Group utilization/count, Snapshot Volume (clone) reserved capacity utilization and count, and SANtricity events and logs (again, send these to something like Elasticsearch or Grafana to get alerts if anything goes wrong)
- Increase use (more frequent schedules, more clones, and so on) to meet your busines and technical objectives

### Clones vs. Volume Copies

Volume Copy is a separate concept, where you copy one volume into another of the same size. This also works with groups of volumes. 

You could, for example, copy NVMe-based database volumes to NL-SAS based volumes for the purpose of having a low-cost database upgrade environment.

Volume Copy hasn't been implemented in cmdlets, but it can be depending on need.

## Conclusion

This is an important milestone for `santricity-powershell`. Being able to create snapshots, clones and refresh clones returns some semblance of sanity to SANtricity users, especially those who prefer to use the CLI or API.

SANtricity snapshots take seconds and work well. The API sucks, the terminology sucks, and it can be hard to figure out what the heck is going on with all the `repos`, but that's behind us. You still have to be more careful than with SolidFire where there are just two gauges to keep above 0 (global cluster free capacacity and the number of snapshots left on the volume), but PowerShell makes that relatively easy compared to before.

I bet less than 1% of users go to the SANtricity UI, create or refresh a clone, and then run some backup software. They either use [SMcli](/2026/01/05/eseries-santricity-smcli-client.html) (fragile, brittle, hard to ue), Ansible (fine for some, annoying for many) or maybe some commercial software (most don't even have good SANtricity snapshot support).

Now we can do it easily, for free, and from any major OS (supported by PowerShell). I rarely use PowerShell on Windows, for example: `santricity-powershell` is developed and tested overwhelmingly on Ubuntu Linux.

Whether you want to quiesce and snapshot Hyper-V VMs, clone SQL Server or execute hardware-assisted snapshots PostgreSQL on Rocky Linux, these cmdlets can help probably you do it easier or better.

If you use SQL Server on Windows, you've probably heard of [DBATools](https://dbatools.io/). Now it takes two-three cmdlets to properly update and refresh a clone and one to [offload SQL Server backup](https://dbatools.io/Backup-DbaDatabase/) to another host without worrying you didn't do something right but you're not aware of a problem. You can also include SANtricity cmdlets into [T-SQL snapshot workflows](/2024/04/01/windows-server-2025-with-solidfire-part-two-sql-server-2022.html).

On a related, but separate, note: once Consistency Groups cmldlets get done in `santricity-powerShell`, I will consider implementing these in SANtricity Python and Go libraries as well. These will also help you avoid Ansible and SMcli.
