# Volume Copy behavior on NetApp E-Series

Volume Copy on NetApp E-Series (SANtricity) systems is weird

## Introduction

The SANtricity Volume Copy feature serves a different purpose to Linked Clones:

- linked clones - or "snapshot volumes", as the documentation calls them - live off a Point-in-Time snapshot which, in turn, lives off a Base Volume
- Copies are simply full copies

Sometimes you want linked clones (usually for online backup), sometimes actual copies (maybe for a longer term experimentation, given that these don't read off the same blocks shared by the Base Volume).

## The strange world of Volume Copy feature

For some reason the weird SM CLI seems to be **the** place to learn about the API. The Swagger not so much. 

In this case, the info is [here](https://docs.netapp.com/us-en/e-series-cli/commands-a-z/create-volumecopy.html#context):

> This command creates volume copies in two ways:
> - Volume copy without snapshot image, also called offline volume copy
> - Volume copy with snapshot image, also called online volume copy

OK, so we can do this by sourcing data from a PiT reference (snapshot). Great!

Then there's this:

> If you use volume copy without snapshot image, you cannot write to the source volume until the copy operation is complete. If you want to be able to write to the source volume before the copy operation is complete, use volume copy with snapshot image.

Wow, wow, wow! So I'm literally one freakin' command from offlining my production volume? Wut?

But, not to worry, we can use a snapshot, right? 

> You can select volume copy with snapshot image through the optional parameters in the command syntax.

Whew, I was about to ... snap!

Let's see that friendly SM CLI example:

```sh
create volumeCopy source="sourceName"
target="targetName"
[copyPriority=(highest | high | medium | low | lowest)]
[targetReadOnlyEnabled=(TRUE | FALSE)]
[copyType=(offline | online)]
[repositoryPercentOfBase=(20 | 40 | 60 | 120 | default)]
[repositoryGroupPreference=(sameAsSource | otherThanSource | default)]
```

Dude, where's my `snapshotImage` param?

Is that `source`? 

> The name of an existing volume that you want to use as the source volume.

Okay, it's not that.

Soooo, given that I can't actually specify a snapshot image as the source, that means I could very well offline my source volume with this command. Wonderful!

## Weird facts about Volume Copy

### Volume Copy is about relationships

This is no doubt weird. When you use the feature, you're not creating a volume copy job, you're creating a relationship. 

That is why, *after* the job is complete, you can't create another one just like it.

```json
{
  "errorMessage": "The operation cannot complete because the target volume entered is already a target volume for another source volume. Please select a different target volume or remove the copy pair where this target volume currently resides. Then retry the operation.",
  "developerMessage": null,
  "localizedMessage": "The operation cannot complete because the target volume entered is already a target volume for another source volume. Please select a different target volume or remove the copy pair where this target volume currently resides. Then retry the operation.",
  "retcode": "207",
  "codeType": "symbol",
  "invalidFieldsIfKnown": null
}
```

Why? Because by using the feature, you've created a relationship and these can't be duplicate.

### POST A, GET B

I don't remember when I last saw something like this, but I've seen it here: `POST /volume-copy-job` with this payload creates a volume copy relationship between the volume specified with `sourceId` and its target.

```json
{
  "targetWriteProtected": false,
  "onlineCopy": true,
  "sourceId": "020000006D039EA000493A9C00000AE969A3E735",
  "copyPriority": "priority2",
  "targetId": "020000006D039EA000493A9C00000BD169B610B2"
}
```

Very neat - `sourceId`, `targetId` - how easy!

Except this is what you get back.

```json
{
  "worldWideName": "6D039EA000493A9C00000BD969B6112D",
  "volcopyHandle": 49172,
  "volcopyRef": "180000006D039EA000493A9C00000BD969B6112D",
  "status": "complete",
  "sourceVolume": "350000006D039EA000493A9C00000BD869B6112C",
  "targetVolume": "020000006D039EA000493A9C00000BD169B610B2",
  "currentManager": "070000000000000000000001",
  "idleTargetWriteProt": false,
  "copyCompleteTime": "1773557373",
  "copyStartTime": "1773548791",
  "copyPriority": "priority3",
  "reserved1": "00000000",
  "cloneCopy": true,
  "pgRef": "330000006D039EA000493A9C00000BD469B6112C",
  "type": "offline",
  "autoClearOnCompletion": false,
  "baseSourceVolumeId": "020000006D039EA000493A9C00000AE969A3E735",
  "onlineCopy": true,
  "id": "180000006D039EA000493A9C00000BD969B6112D"
}
```

Most SANtricity `POST` actions from the API V2 return an object. Say if you use `POST /volumes` to create a volume, you get back a volume object. 

Here, you get a relationship object, with a job that only ever runs once. Makes one wonder why bother with setting up and storing this relationship in the first place. 

Secondly, notice what the response says about `sourceVolume`: it's a relationship but the source is **not** `sourceId` and `targetId`. I don't know what other V2 API method returns non-idempotent responses like that.

### RTFM (the other one)

I learned more about this by reading the LSI Inc [document from the Oracle Web site](https://docs.oracle.com/cd/E23944_01/pdf/E23971-01.pdf).

![SANtricity Volume Copy User Guide](/assets/images/santricity_volume_copy_user_guide.png)

Yep, this is where we are 15 years later - RTFM-ing the LSI documentation from 2011.

It seems that, back then (page 4), one could provide a snapshot image (PiT Reference Id) to copy it to a new volume, but these days SANtricity takes an undocumented "on-demand" snapshot. What's worse, this undocumented snapshot (`350000006D039EA000493A9C00000BD869B6112C`) doesn't show in `GET snapshot-images`, and makes it hard to use the API because you cannot easily tell - with `GET /volume-copy-jobs` - which of the several jobs may be yours. You have to look at the `targetId`, remember the `volCopyHandle` or maybe even take screenshots with your mobile phone so that hours later you can still find that sucker.

This "convenient" (not really) snapshot makes this feature less valuable.

Before I could copy a volume from a known point-in-time, whereas now that is not possible. I tried passing a Snapshot Image Id instead of a source volume ID but that payload was rejected. So all you get is that undeterministic on-demand snapshot.

Furthermore, `repositoryGroupPreference` in the SM CLI example above indicates that, by default, any volume group may be used for temporary data needed for this on-demand snapshot. That is weird; unless we pick a repository group (notice, we're not talking about snapshot groups), we may end up with data consumed in unexpected places.

Let's also take a look at [the SANtricity 11.9 documentation](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/copy-volume.html):

> Before you begin
> All I/O activity to the source volume and the target volume must be stopped.

Nah, I don't think so. My source volume remained online and I was able to write to it.

Furthermore, the API clearly returns a snapshot, not source volume, reference. Is a snapshot taken or not? It looks like it is, which means I don't have to take anything down except mount point on the hosts mapped to the Target Volume when it's being copied into.

Then just below that:

> An online copy creates a point-in-time copy of any volume within a storage array, while it is still possible to write to the volume with the copy in progress. 

Wut? I thought all the IO activity must be stopped. Which is it? 

> Offline copy
> All updates to the source volume are suspended to prevent chronological inconsistencies from being created on the target volume. 

This one sounds exactly what one would expect from an **online** or **live** copy, as no snapshot is taken. But instead, they call it "offline", making it more likely for the user to cause unplanned downtime.

### Start and pause

Of course it's not called start and pause, but start and *stop*.

I'm not sure if it starts from the beginning or continues (in which case that "stop" should realy be "pause").

You can control this via the API. For example, to "stop" a copy:

```http
POST /volume-copy-jobs-control/180000006D039EA000493A9C00000BEE69B648AD?control=stop
```

I think it's dangerous - even "online" Volume Copy is very dangerous - to expose in the CLI, so I am not going to add these to SANtricity PowerShell module. it's just a minefield. 

### Relationships are difficult

I mentioned these volume copy "jobs" are actually relationships with an associated one-shot job.

That is why, for example, the SANtricity UI will suggest to "clear" a completed job. Then when you want to run it again, you'll realize it doesn't exist. Yep, that's because you've deleted it  (i.e. that "clear" was realy a call to `DELETE /volume-copy/${relationshipId}`).

I also noticed that this defaults to deleting temp repositories as several large volume copy jobs that abruptly stop could leave a ton of stranded space in these hidden CoW reserves (which the UI would later remind to you "recover" next time you log in).

```http
DELETE /volume-copy-jobs/180000006D039EA000493A9C00000BD969B6112D?retainRepositories=false
```

Similarly, if a job runs fine, you get your copy, but when you run the same thing again, it fails as in that example near the top. Why? Because the same relationship already exists.

So, if you automate, you want to clear these after they're done running in any case. 

The nice part about deleting these relationships right away is you can create another one without checking. There's no reason to let stale volume copy relationships linger around unless, perhaps, `start` restarts them from the beginning. I'd rather recreate mine and be sure what it does than rely on the documentation.

## What's good about Volume Copy

### Performance

It's a fully, physically separate clone and so it has to perform real reads and writes. The good thing is they're fast as your E-Series usually is.

On this DDP with 14 disks, it takes a very short time to copy a 100GB volume at highest priority, if you need it fast.

![Volume Copy performance](/assets/images/santricity_volume_copy_performance.png)

### Convenience

From the SANtricity 11.9 documentation:

> The target volume must have the same or greater capacity as the source volume; however, it can have a different RAID level.

If you want to copy a bunch of volumes for long term dev/test use and don't want to impact your production volumes, this is it!

You can set Volume Copy priority to 2 or 3 rather than 4, and do this every weekend (but be careful about "offline" copying - that refers to offlining your workload). 

### Use Linked Clone in Volume Copy

Due to the limitations that don't seem to have existed in 2011, you can't specify a source snapshot.

But what you can do - although I haven't tried that - is specify a linked clone ID ("snapshot volume") as the source. That would give you the ability to use specific snapshot image to create your full clone and do it online (I mean, offline... just kidding).

- Source  => (take a snapshot) => Snapshot Image => (create read-only clone) = Snapshot Volume ("thin linked clone")
- Now Volume Copy Snapshot Volume to Target Volume and your point-in-time will be that of the Snapshot Image (snapshot)

### Save capacity on long term test/dev

DDP storage pools let you create RAID 1 and RAID 6 volumes.

Using Volume Copy rather than (writeable) linked clones for dev test is a good idea for RAID 1 users:

- It helps you avoid piling up CoW deltas even if you keep a copy for a while
- It helps you downgrade RAID 1 sources to RAID 6 copies (Volume Copy 1TB RAID 1 volume to a RAID 6 target, save 0.2TB). Of course, you "save" even more by using writeable think clones, but you impact production performance and eat into reservation space as CoW data piles up

I think I was also able to copy volumes from traditional disk groups into targets on DDP, but maybe I misremember now. Unfortunately, that was NVMe-to-NVMe and I haven't had a chance to try copying from traditional disk groups with NVMe to NL-SAS-based DDP - those would be big money-savers, if that was possible.

## Conclusion

It's hard to tell what's the problem with this - does the lack of usage result in deteriorating documentation, or is it the other way around?

Regardless, I think I fixed several issues in SANtricity PowerShell related to this poorly documented feature, and the feature works well on SANtricity, as long as you don't offline yourself.

You just need to pay a bit of extra attention and figure out how to use it and you'll probably like it. 

Today virtualized infrastructure is quite impressive ([hypervisors are good for 80% of use cases](/2026/03/08/proxmox-backup-server-with-netapp-eseries.html)) and we don't have to use these storage features on a daily basis if hypervisor can make a think clone in seconds, but when you know something should be done on the array, Volume Copy is there for you.
