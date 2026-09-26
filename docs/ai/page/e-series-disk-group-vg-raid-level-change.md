# Change disk group's RAID level on NetApp E-Series

Did you know you can change a SANtricity disk group's RAID level on the fly?

## Introduction 

SANtricity calls them "volume groups", I call them "disk groups". That is also incorrect, but less so - you can have a RAID 0 disk "group" of just 1 disk, but that's rare, though. But many E-Series users have single-volume disk groups, so calling those "volume groups" is often incorrect.

E-Series supports several RAID levels including RAID 0, RAID 1, RAID 10 (which are just larger R1 disk groups), RAID 5, RAID 6. 

One of the weird things you can do with SANtricity disk groups is convert them from one RAID level to another.

## What that does

It converts a disk group and all its volumes to another RAID format. For example:
- RAID 0 to RAID 1
- RAID 1 to RAID 5
- RAID 5 to RAID 1

It doesn't work with DDP because those have internally fixed structures. On those we can create volumes with different characteristics (RAID 10 or RAID 6) - see about that [here](/2023/10/08/raid1-in-netapp-eseries-ddp.html).

Main benefits of disk group RAID level change:
- Change performance characteristics without data migration: you may say "I can do that on SolidFire with QoS" and that's true, but we're talking high-end performance, like GB/s on a single volume, which you won't get regardless of how you configure your QoS. In "classic" RAID environments you'd have to evacuate data and re-create. Here you don't, it's done online
- Change capacity utilization by going to a "higher" RAID level, e.g. RAID 5 to RAID 6 saves space while potentially losing performance
- Change protection level
- Easily deal with workload changes - you were told the app will do fine with R6, but it turns out it sucks and reportedly R10 is required. Easy-peasy - one command away and zero downtime

This is especially useful if you have single-volume disk groups. 

Unfortunately, traditional RAID is also rigid. Yes, you can have 9+1 RAID 5, but you shouldn't. So how does one convert an 8+2 RAID 6 disk group into an 9+1 RAID 5? They probably shouldn't. But at least you can undo and convert back.

What is legit? For example:
- RAID 0 to RAID 10 (2 disks to 2 disks)
- RAID 1 to RAID 6 (10 to 10)
- RAID 5 to RAID 0 (5 to 5)
- RAID 5 to RAID 10 (start with 5 disks (4+1), add 1 disk to get to 6, then convert disk group to a 3+3 RAID 10)

This last line includes some extra steps, but if you're going from R5 to R10 you'll experience a capacity drop anyway, so if you sized correctly before, then you may as well need an extra disk. 

Almost no one wants to deploy storage *knowing* they'll convert disk group to another RAID level, so having to do some extra steps such as buying an extra disk is indeed not convenient, but it's much more convenient than scheduled downtime or migration.

If you want slighty better flexibility (in some aspects), I would suggest DDP (see the post above):

- RAID 1 or RAID 6
- Grow or shrink storage pool in increments as small as one disk

A disadvantage of DDP is RAID 6 and RAID 1 are comingled (workload segregation isn't as good) and you can't convert RAID 1 to RAID 6 volumes on DDP. But their performance is so different that you shouldn't make such mistakes in the first place. 

With disk groups, you may need to move from RAID 5 to RAID 6 because you discovered you need less performance than thought. Not a big gap, and saves you 10% (or so, depending on how each is configured).

## RAID level Conversion

Using the SANtricity UI, **Storage** > **Pools & Volume Groups** > **View/Edit Settings** and change RAID level. More [here](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/change-configuration-settings-for-a-volume-group.html).

You can use [SMcli](https://docs.netapp.com/us-en/e-series-cli/commands-a-z/set-volumegroup.html#context) for that as well.

```cmd
set volumeGroup slowgroup raidLevel=1
```

See more about [getting started with SMcli](/2026/01/05/eseries-santricity-smcli-client.html).

In the API, we want to change a (disk group-type) storage pool properties. In main API v2 path:
```http
GET storage-pools
```

That will give you `volumeGroupRef`, `raidLevel`, and `name` (or `label`, here `r5now`) information.

![Swagger response to GET storage-pools](/assets/images/santricity-raid-level-change-01-volumegroupref.png)

`raidLevel` 0, 1, 5 and 6 can be converted back and forth. But - as we've mentioned above - you can't convert a two-disk disk group into a RAID 6.

Now you can build payload for the call:
```json
{
    "volumeGroupRef": "123",
    "newRaidLevel": "raid5"
}
```
And send it to the SYMbolV2 endpoint:
```http
POST symbol/startVolumeRAIDMigration?controller=auto&verboseErrorResponse=true
```

RAID-to-RAID churn takes some time, and while it's all online, it has some performance impact and takes time. It's not instant. You can get a progress report from the API (you'll get back `timeToCompletion` in minutes).
```http
POST symbol/getVolumeActionProgress?controller=auto&verboseErrorResponse=true
```

Automating this may involve some extra steps and I think automating this is not worth the effort as it's very unlikely to be something you'd use often. Given the amount of testing and edge cases, it's probably not a good candidate for generic automation.

If you have one and only pattern that repeats, then yes. Example:
- Convert to R10 before running monthly reports
- Convert back to R5 after that

But you'd need to keep enough idle capacity available to do that, so why not run R10 all the time?

## Demonstration

I had a two-disk RAID 0 disk group. The application has become important enough to require protection. 

In order to convert to RAID 5, I've added a disk (so that I can do N+1) and renamed the group to `r5now`.

![RAID 0 awaiting transformation to RAID 5](/assets/images/santricity-raid-level-change-02-raid0-disk-group.png)

Then I ran the conversion calls from above, and it took about 4 minutes per TB of converted R0 to R5 (and vice versa) capacity.

![RAID 5 after transformation to RAID 5](/assets/images/santricity-raid-level-change-03-raid5-disk-group.png)

As you can see in this screenshot, there's a 1,500 GB volume on the group now. The reason I have this is after trying with smaller volumes, I created one to see if I can make the pool blow up as I move from R5 to R0. Nope!

```json
{
  "errorMessage": "The operation cannot complete because there is no free capacity or not enough free capacity on the volume group to accommodate the new RAID level.",
  "developerMessage": null,
  "localizedMessage": "The operation cannot complete because there is no free capacity or not enough free capacity on the volume group to accommodate the new RAID level.",
  "retcode": "84",
  "codeType": "symbol",
  "invalidFieldsIfKnown": null
}
```

## LUN (volume copy) as alternative 

Maybe you'd prefer to copy a volume to another storage pool over converting an entire disk group with many volumes.

Maybe you'd like to move a R5 volume to DDP. 

You can achieve that with volume copy:
- Online (snapshotless) - can't be done on live disk
- Offline (from snapshot) - take a snapshot, create a clone, copy clone volume to regular volume of the exact same size
- Un-map the "old" volume from the host, map the copy volume to the same host (or cluster)

The offline approach is easy and lets you quickly move (data of) a single volume from one disk group to another (or to a DDP (pool)).

But there may be limitations, especially between MVMe and SAS/NL-SAS disks, so you need to check the TFM. And [it's more complicated](/2026/01/14/e-series-santricity-clones-consistency-group-clones.html#copy-clones-to-other-disk-groups)

## Conclusion

Use cases for RAID level change of classic RAID disk groups exist.

Not necessarily for weekly two-way swings, but certainly for selected use cases. SANtricity makes that easy and the necessary guardrails (group fullness) are in place.

Use cases I like:

- Start small (two disks in R1) because you don't even have 5 or 10 disks, add more later and convert to R5 if you need to get more capacity. It's possible that, after going from two to five disks (4+1 R5) you wouldn't even notice any drop of performance after coming "down" from R1.
- Repeated, fixed workflows with significant gains: specific patterns (such as R6->R10, compute, R10->R6) for predictable or periodic workflows: data analytics, HPC, and the like. You may want to automate these, but since you're not handling several (or countless) different possibilities it's just several lines of code and if [I know](/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html#results) I can get 40% more performance out of RAID 10, the effort of automating this once and using it for years would have a great ROI
