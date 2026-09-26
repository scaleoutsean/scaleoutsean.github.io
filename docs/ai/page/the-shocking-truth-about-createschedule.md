# The shocking truth about SolidFire ModifySchedule method

CreateSchedule and ModifySchedule work in mysterious ways

- [Introduction](#introduction)
- [Show me](#show-me)
- [Why?](#why)
- [Thoughts](#thoughts)
- [Conclusion](#conclusion)

## Introduction

As I was trying to add snapshot-related feature to Firemox (see previous post, my Proxmox-SolidFire console thing) I was shocked about the true distinction between Group and "standard" snapshots in SolidFire. 

And it shocked me enough to motivate me to blog about it.

## Show me

If you create a snapshot schedule and use `ListSchedules` to view it, you'll see an item like this (here, a schedule that protects volume ID 167).

```json
{
    "attributes": {
        "frequency": "Time Interval"
    },
    "hasError": false,
    "hours": 4,
    "lastRunStatus": "Success",
    "lastRunTimeStarted": "2025-07-08T12:00:00Z",
    "minutes": 0,
    "monthdays": [],
    "paused": false,
    "recurring": true,
    "runNextInterval": false,
    "scheduleID": 1,
    "scheduleInfo": {
        "name": "evry-4h-keep-3",
        "retention": "12:1:00",
        "snapMirrorLabel": null,
        "volumeID": "167"
    },
    "scheduleName": "evry-4hr-keep-3",
    "scheduleType": "Snapshot",
    "startingDate": null,
    "toBeDeleted": false,
    "weekdays": []
}
```

The key part - related to group vs. single - is `scheduleInfo` key which contains this part:

```json
"scheduleInfo": {
    "name": "evry-4h-keep-3",
    "retention": "12:1:00",
    "snapMirrorLabel": null,
    "volumeID": "167"
}
```

Makes sense, right? `"volumeID" = "167"`. Single volume snapshot.

Now let's take a look at the same section in a Group Snapshot schedule (there's no `name` because when it's missing, it's `auto` which is the same as in regular snapshots - snapshots get auto-named by their timestamp). Anyway:

```json
"scheduleInfo": {
    "snapMirrorLabel": null,
    "retention": "12:1:00",
    "volumes": [
    "82",
    "83"
    ]
}
```

Also makes sense, right? `volumes=["81","82"]`. It's a group, of course! 

It all made sense until it didn't. And it didn't once I used `ModifySchedule` on this group snapshot. 

I removed a volume, checked the same `scheduleInfo` section and ... my app crashed. I looked and ...

```json
"scheduleInfo": {
    "snapMirrorLabel": null,
    "volumeID": "83"
}
```

![Dude, WTF?](/assets/images/dude-wtf.png)

`tldr:`

- By removing the second volume, you turn a Group Snapshot into a "standard" snapshot
- By turning a Group Snapshot to "standard" snapshot, you change the JSON key that describes that schedule from `volumes` to `volumeID`
- By turning a Group Snapshot to "standard" snapshot, the value changes from a list of strings to a string
- Any standard snapshot can likewise become a Group Snapshot, as long as you have at least two volumes in the cluster, and the same things change in reverse (`volumeID` becomes `volumes`, and the volume ID string becomes one of strings in a list)

Obviously, this became obvious only after I repeatedly hit, and then investigated "inexplicable" bugs in my code. "Repeatedly" because at first I thought I didn't see it correctly the first time, then later I realized that "it lives".

## Why?

I could probably ask around, but it's not *that* important so I'll speculate:

- We know that initially SolidFire didn't have group snapshots. At the time `"volumeID" : "82"` in JSON made perfect sense.
- Once Group Snapshot became a thing, I imagine the API guys had a problem on their hands. What's less bad: go with the old (`"volumeID" : "82,83"`) or embrace the new (add `"volumes": ["82","83"]` on-demand and also flip-on-demand)?

The first choice would not break automation that looks for the key `volumeID`. But it would still break them if they didn't happen to handle the lack of this key gracefully (and it'd be lacking as soon as someone added the 2nd snapshot to the same schedule).

The second choice "makes sense", but since snapshot-type schedules are essentially the same for Group and stand-alone, they also flip from one to the other, so even the first group of existing plugins or scripts couldn't be spared - it would need to be changed to handle the ability of an *old* snapshot schedule to *flip* from one to the other kind. 

It seems to me the only situation in which nothng would break would be if the user knew about this and refrained from *using* the new feature (or, the new API version) until their automation or plugin were upgraded. If they kept using the old API endpoint (e.g. /json-rpc/9.0 or something along those lines), the group snapshots couldn't be created.

## Thoughts

This is the first time I noticed a breaking API change in SolidFire that I didn't notice at the time. What broke was the guarantee that a snapshot schedule would have that `volumeID` key.

I haven't looked at the API release notes to see if this was documented at the time, but I assume it was - it's just that almost no non-programmer reads that stuff. Even if I read it, I wouldn't have thought much of it at the time. 

Most people assume because new features (and API methods) are added and old retained, that you don't need to change your code because the old feature is there and you don't use the new one. That's not how it always works, as we can see from this example. 

But if you have applications you'd prefer to not break, you have to be careful even when using a versioned API. It doesn't (yet) automagically update your application.

Without knowing any of the details not in public domain, I'd prefer if they added another type of schedule. As you can see in the JSON at the top, snapshots were (and are) this type: `"scheduleType": "Snapshot"`. I think adding `"scheduleType": "groupSnapshot"` would have been a better choice, although that would probably have required even deeper changes (on a level where this distinction probably doesn't really exist) to also handle this new type of schedule.

By the way, I'm also curious why volume ID is always a string in both group and regular snapshots. The reason for that must precede me (I started working with SolidFire around version 9) but I *think* early on they may have started with volume names, and since those could be duplicate (still can; only volume IDs are distinc) and people make typos and copy-paste mistakes, they flipped to `volumeID` and retained that string value. 

## Conclusion

It took me almost a decade to find out about this. This reminds me of another blog post from several years ago, when I discovered that elements of group snapshots could be found under Snapshots > Members in the Web UI. 

In Firemox users can add volumes to a schedule which makes them flip from group to regular and back, which means a workflow can start with one set of parameters and value types and end up with another. Interesing stuff...
