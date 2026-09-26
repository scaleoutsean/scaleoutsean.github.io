# Snapshots and snapshot schedules in NetApp SolidFire

Shallow dive into SolidFire snapshot schedules

- [Introduction](#introduction)
- [Slightly confusing](#slightly-confusing)
- [SolidFire snapshot schedules](#solidfire-snapshot-schedules)
- [Create a schedule](#create-a-schedule)
- [Group vs. single](#group-vs-single)
- [One volume, multiple schedules](#one-volume-multiple-schedules)
- [FIFO settings](#fifo-settings)
- [The API](#the-api)
  - [Group snapshots and Longhorny](#group-snapshots-and-longhorny)
- [Conclusion](#conclusion)
- [Appendix A - ListGroupSnapshots](#appendix-a---listgroupsnapshots)

## Introduction

I'm not going to write what snapshots are. 

On Solidfire they're thin and efficient in the sense that SolidFire's global storage efficiency applies to snapshot data and translates into replication savings as well. Let's move on.

This post is going to be similar to the [recent post about replication monitoring](/2024/06/14/netapp-solidfire-replication-monitoring.html) - an overview of how things works so that people who are interested can hopefully get some insights and I use it to think about how to implement it in [SFC](/2024/05/29/sfc-v2.html).

## Slightly confusing

There's two main things about using and monitoring snapshots:

- Create a snapshot
- List (or get individual) shapshots

Snapshot schedules are related to snapshots (duh!), but I highlight that because that can be slightly confusing.

Namely, when you create a snapshot, if you decide to not retain it forever (as most people do), you may choose to take a single, one-off snapshot, or create a snapshot schedule.

What's not very obvious is that schedule has a life of its own. And the workflow can go in the other direction as well. 

They can be also edited, deleted, used to create a clone, etc. but normally we want to automate that with a schedule.

## SolidFire snapshot schedules

A snapshot schedule can be for individual or group snapshots. 

![Solidfire snapshot schedules](/assets/images/solidfire-snapshot-schedule.png)

This screenshot shows two schedules, one of which is for multiple volumes.

## Create a schedule

This can actually be a bit confusing at first: we can create a schedule while taking a snapshot (right-click on a volume and Create Snapshot) and we can create a snapshot schedule to create snapshots that way.

Notice how the first input *requires* a list of volume IDs (1 at least). That's another view of this slightly confusing two-way relationship.

![Creating a Solidfire snapshot schedule](/assets/images/solidfire-snapshot-schedule-create-in-web-ui.png)

We can't create a snapshot schedule before we decide which volume(s) we want to snapshot.

It gets even weirder. What if we created a schedule and now want to create another one? How is that connected to existing schedules, volumes, etc.?

Well, it may not be connected. We may edit existing snapshot schedule by simply appending additional volume IDs to the list of volume IDs in it.

![Solidfire snapshot schedules](/assets/images/solidfire-snapshot-schedule-edit-in-web-ui.png)

When should we create a new schedule?

Obviously, you may want a different schedule if your objectives are different enough (different times, retention, etc.). People may have 2-4 schedules and occasionally create "custom" snapshots (before upgrades, maybe with "no expiration") when upgrading and such.

So, when naming a snapshot schedule, I prefer to name it after the policy (similar to QoS policy) rather than after the application or volume.

If snapshot policies (schedules) are subject to (editing) whims of the people who originally created them, then create your own. Maybe three-four schedules - something like Bronze, Silver, Gold and Gold-DR (with snapshots included in replication).

Another thing worth mention is when creating a snapshot schedule, there's a [bug](https://github.com/NetAppDocs/element-software/issues/205) in there.

![Snapshot schedule bug in UI, API](/assets/images/solidfire-snapshot-schedule-ui-api-bug.png)

Everything still works, but the API stores this retention setting in a weird way and can mess up your automation if you don't handle it (or if NetApp doesn't fix this by that time).

## Group vs. single

This is also a bit strange. First, when *taking* a snapshot, group snapshots are a thing.

You select more than one volume and then in Bulk Actions you may select Group Snapshot.

![Take a group SolidFire snapshot](/assets/images/solidfire-snapshot-schedule-manual-group-snapshot.png)

Those may be viewed in Data Protection > Group Snapshots, whereas the regular ones are under Data Protection > Snapshots.

But how different they are?

They aren't, really. It's just that one is grouped, and the other is not.

In fact, remember that a snapshot schedule created for a volume, and then expanded to include additional volumes, is actually a group snapshot schedule.

In the screenshot above where I have the volume ID 172, I can add IDs 134,135,136 and save to make that a group snapshot. Weird. 

Notice that a schedule works on all volumes at the same time because it's ... well, a schedule. 

Remember that when adding volume IDs to a schedule to group everything under one (or very few) scheduless. If you take manual snapshots (for whatever reason) and the same volumes are included in some schedule controlled by several people, they may change it so that their schedule creates and retains 30 snapshots. Now, since 32 is the maximum, that means you won't be able to create more than two on your own.

Or, even worse, if you have a backup software that takes 1-2 "transient" ones, you may run out of snapshots for own use.

## One volume, multiple schedules

That's of course possible, just include a volume in multiple schedules. Example:

- int-2h-rep-24h - once every 2 hours, retain 24 hours and include in replication (if the volume included is paired)
- int-15m-2h - once every 15 minutes, retain 2 hours (do not replicate even if the volume is paired)

## FIFO settings

You may have noticed the FIFO thing in the screenshots. 

It appeared [in SolidFire 12.3](/2021/04/20/solidfire-12.3.html) with the purpose to solve a rare problem where people would pile up snapshots beyond the time limit set for delayed replication of blocks.

Let's say our database writes at 70 MB/s and after 2x efficiency we need around 35 MB/s to replicate data.

We create a snapshot every 5 minutes and enable it for replication. But our network bandwidth available for replication sometimes drops to 30 MB/s, so snapshots can pile up in Syncing state and eventually - because the oldest are not done yet - even the newest are behind by a lot, so when the backlog clears even latest snapshots may expire by the time they get replicated. 

It can get eve worse in the sense that you may have a bunch of volumes in a database - and it takes just one volume from a group to not make it to the other cluster for your replica to be useless:

- Async replication - even if you tried to use it - would be affected the same way. Individual volumes may be behind more than others, so that won't be useful. 
- Snapshot replication - eventually you switch to SnapshotsOnly, but snapshots don't make it across either and you don't notice it

The FIFO setting helps people automatically expire old snapshots to not unnecessarily pile them up at the source side. If your snapshot is set to be retained 2 hours at the destination and it eventually gets replicated 3 hours later, it will die an instant death the destination the moment it's completed. 

I haven't experienced FIFO-related problems, so I can't share any special insights regarding it, but for the purpose of creating schedules, be aware that you may keep an eye on both async delay (for Async mode replication) and snapshot propagation delay (for snapshot replication). 

It is important to monitor delays (boh async and snapshot replication) and SFC currently monitors async delay for paired source volumes and the FIFO settings are obtained from volume properties on each side. If snapshot delays become available as well, users will be able to gain full visibility into both types of delays, as well as related FIFO settings and - when/if FIFO is adjusted - observe the effect of those adjustments on delay in snapshot replication.

Notice that in the case of a high churn - such as constant table updates that don't last long - even if database barely grows every day, these backlogs can still happen. Simply reducing snapshot frequency may be enough to fix the problem, with or without increasing FIFO settings for the volume(s).

## The API

You may [RTFM](https://docs.netapp.com/us-en/element-software/api/reference_element_api_schedule.html) for the details, so I'll only highlight what I think is interesting or important in the context of monitoring.

The bug in `ListSchedules` output mentioned earlier may be seen in `retention` value. I don't know if they'll accept that it's a bug, but to me it is. I've never seen that format and it doesn't make any sense. 

```json
{
  "id": 1,
  "result": {
    "schedules": [
      {
        "attributes": {
          "frequency": "Time Interval"
        },
        "hasError": false,
        "hours": 2,
        "lastRunStatus": "Success",
        "lastRunTimeStarted": null,
        "minutes": 0,
        "monthdays": [],
        "paused": false,
        "recurring": true,
        "runNextInterval": false,
        "scheduleID": 6,
        "scheduleInfo": {
          "enableRemoteReplication": true,
          "name": "replicated",
          "retention": "24:0:00",
          "snapMirrorLabel": null,
          "volumeID": 172
        },
        "scheduleName": "int-2h-rep-24h",
        "scheduleType": "Snapshot",
        "startingDate": null,
        "toBeDeleted": false,
        "weekdays": []
      }
    ]
  }
}
```

For group schedules, `volumes` are more than one. Notice the same weird `retention`. Why not `4:0:0`?

```json
 "scheduleInfo": {
    "enableRemoteReplication": true,
    "name": "group-sql-snapshot",
    "retention": "4:0:00",
    "volumes": [
        136,
        135,
        134
      ]
    }
```

In `ListSnapshots`, if a snapshot is included in replication *and* the volume paired, there's this remoteStatuses section in it.

```json
{
"remoteStatuses": [
    {
        "remoteStatus": "Syncing",
        "volumePairUUID": "cfa9a820-2150-437c-b848-207c85975d1f"
    }],
    "snapMirrorLabel": null,
    "snapshotID": 660,
    "snapshotUUID": "aaa85727-bbac-48fb-9e9a-bfc67a3940ee",
    "status": "done",
    "totalSize": 5000658944,
    "virtualVolumeID": null,
    "volumeID": 172,
    "volumeName": "syncJobTest"
}
```

This is similar to what we've seen in the post on [replicated volumes](/2024/06/14/netapp-solidfire-replication-monitoring.html) and useful to have in SFC (or your own replication monitoring code).

`ListGroupSnapshots` has the same thing.

Snapshots are identified by `snapshotUUID`, while group snapshots have `groupSnapshotUUID` and a `members` list where all members' snapshots are included (which look exactly like individual snapshot listing). 

There's a "group" remote status as well, so you may have a three-member group where two members are syncing and one is not paired, but remoteStatuses for the group would be `Syncing` (see Appendix A). That's unusual. I'd expect `PartiallyPresent` or something like that.

If you include your group of volumes into an existing schedule originally created for replicated volumes (and snapshots), but your volumes aren't paired, it can make the management and monitoring of your and their snapshots very confusing. 

That's another reason why excessive hoarding of volumes in only a few snapshot policies isn't a great idea.

### Group snapshots and Longhorny

One thing I noticed while working on [Longhorny](/2024/06/11/introducing-project-longhorny.html) is that I can simply take a snapshot of all paired volumes, which is the equivalent of one giant group snapshot. 

So "`volume --snapshot`" in Longhorny actually works fine even with replicated volumes that belong to consistency groups because it snaps all (local) paired volumes , but that also gives that snapshot one name which may make recovery of individual volumes tricky: if you take a group snapshot of all paired volumes 134,135,136,172 and want to restore your consistency group of 134,135,136, do *not* restore the entire group - restore individual members (134-136) or else you may inadvertently lose data on someone's volume ID 172. 

So, if you can, it's still nicer to take your manual group snapshots because you never know who may restore a group snapshot and nuke your volumes from it!

## Conclusion

SolidFire snapshots are easy to automate and use, but the way schedules and groups work is a bit confusing.

If schedules and groups aren't granular to not mix replicated (paired) and non-replicated volumes then SFC (or your own monitoring tool) may find it difficult to figure out what status to record for volumes included in a snapshot group.

Each member snapshot *is* listed under individual snapshots and *can* be monitored separately. It took me years to spot this location in the Web UI:

![View individual members from group SolidFire snapshots](/assets/images/solidfire-snapshot-schedule-group-snapshot-members.png)

That's the `members` list from `ListGroupSnapshots`, basically.

In order to make good use of snapshots, I would consider using several "global" snapshot schedules (fixed, changeable only by the storage admin, similar to QoS policies for volumes) and several "custom" schedules for each storage account ("tenant").

That way everyone can make use of "shared" schedules - which also makes it simpler to know the RPO after a site failover that resumes from the most recent snapshot at the remote site - but it also allows the optional flexibility for special cases.

Depending on who may change snapshot schedules, sometimes having just 1-2 (one local, one for replicated snapshots, or one short and one long local schedule) per cluster may be enough.

For monitoring and observability, the weird format of retention string needs to be worked around. Some snapshot group members may have pairing inconsistent with the rest of the group, so their group snapshot status may not always be what it says. If I implemented group snapshot monitoring in SFC I'd probably report "partial" group snapshots as "Not Replicated" rather than "Syncing". While "Syncing" means they haven't synced (i.e. not replicated (yet)), it does't tell you they may never replicate because a member volume isn't paired for replication.

## Appendix A - ListGroupSnapshots

Request:

```json
{
  "method": "ListGroupSnapshots",
    "params": {
        "volumes": [134,135,136]
    },
    "id": 1
}
```

Response shows a group snapshot of three volumes in which the first volume is not replicated. Somewhat confusingly, the group status is syncing but because one of them isn't replicated we know it will never sync... Later (see next response) the volume used for that snapshot was also paired and then the status changed to `Present`.

```json
{
  "id": 1,
  "result": {
    "groupSnapshots": [
      {
        "attributes": {},
        "createTime": "2024-06-16T03:27:17Z",
        "enableRemoteReplication": true,
        "groupSnapshotID": 77,
        "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
        "members": [
          {
            "attributes": {},
            "checksum": "0x6174864243730c50",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "de46a946-8503-4645-982f-c22a1ae6aab8",
            "name": "sql-group-snap",
            "snapMirrorLabel": null,
            "snapshotID": 661,
            "snapshotUUID": "de46a946-8503-4645-982f-c22a1ae6aab8",
            "status": "done",
            "totalSize": 2000683008,
            "virtualVolumeID": null,
            "volumeID": 134,
            "volumeName": "win1"
          },
          {
            "attributes": {},
            "checksum": "0x3bc446deaec55ce3",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "6b219785-4732-46fe-bb79-93ae79eec139",
            "name": "sql-group-snap",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "5f70fc08-fad6-465d-8dac-83766eb38ab4"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 662,
            "snapshotUUID": "6b219785-4732-46fe-bb79-93ae79eec139",
            "status": "done",
            "totalSize": 20000538624,
            "virtualVolumeID": null,
            "volumeID": 135,
            "volumeName": "win2"
          },
          {
            "attributes": {},
            "checksum": "0xa5ad86b4325fe51f",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "d313ef27-111d-4bfe-9439-532152214464",
            "name": "sql-group-snap",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "fba6dc63-993c-4a62-b85b-cb4043f04aae"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 663,
            "snapshotUUID": "d313ef27-111d-4bfe-9439-532152214464",
            "status": "done",
            "totalSize": 5000658944,
            "virtualVolumeID": null,
            "volumeID": 136,
            "volumeName": "sqldb"
          }
        ],
        "name": "sql-group-snap",
        "remoteStatuses": [
          {
            "remoteStatus": "Syncing"
          }
        ],
        "status": "done"
      }
    ]
  }
}

```

In this response example, all snapshots from the group are replicated and `Present`:

```json
{
  "id": 1,
  "result": {
    "groupSnapshots": [
      {
        "attributes": {},
        "createTime": "2024-06-16T03:27:17Z",
        "enableRemoteReplication": true,
        "groupSnapshotID": 77,
        "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
        "members": [
          {
            "attributes": {},
            "checksum": "0x6174864243730c50",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "de46a946-8503-4645-982f-c22a1ae6aab8",
            "name": "sql-group-snap",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "e1f4469e-034a-4a01-af26-ad75b2c9f48b"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 661,
            "snapshotUUID": "de46a946-8503-4645-982f-c22a1ae6aab8",
            "status": "done",
            "totalSize": 2000683008,
            "virtualVolumeID": null,
            "volumeID": 134,
            "volumeName": "win1"
          },
          {
            "attributes": {},
            "checksum": "0x3bc446deaec55ce3",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "6b219785-4732-46fe-bb79-93ae79eec139",
            "name": "sql-group-snap",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "5f70fc08-fad6-465d-8dac-83766eb38ab4"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 662,
            "snapshotUUID": "6b219785-4732-46fe-bb79-93ae79eec139",
            "status": "done",
            "totalSize": 20000538624,
            "virtualVolumeID": null,
            "volumeID": 135,
            "volumeName": "win2"
          },
          {
            "attributes": {},
            "checksum": "0xa5ad86b4325fe51f",
            "createTime": "2024-06-16T03:27:17Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-17T03:27:17Z",
            "groupID": 77,
            "groupSnapshotUUID": "6e9eacaa-9ff4-42f1-832e-4522285774b8",
            "instanceCreateTime": "2024-06-16T03:27:17Z",
            "instanceSnapshotUUID": "d313ef27-111d-4bfe-9439-532152214464",
            "name": "sql-group-snap",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "fba6dc63-993c-4a62-b85b-cb4043f04aae"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 663,
            "snapshotUUID": "d313ef27-111d-4bfe-9439-532152214464",
            "status": "done",
            "totalSize": 5000658944,
            "virtualVolumeID": null,
            "volumeID": 136,
            "volumeName": "sqldb"
          }
        ],
        "name": "sql-group-snap",
        "remoteStatuses": [
          {
            "remoteStatus": "Present"
          }
        ],
        "status": "done"
      },
      {
        "attributes": {},
        "createTime": "2024-06-16T04:00:00Z",
        "enableRemoteReplication": true,
        "groupSnapshotID": 78,
        "groupSnapshotUUID": "ed2cc8ee-cec2-47b0-914c-07f0aef571b0",
        "members": [
          {
            "attributes": {},
            "checksum": "0x6174864243730c50",
            "createTime": "2024-06-16T04:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T08:00:00Z",
            "groupID": 78,
            "groupSnapshotUUID": "ed2cc8ee-cec2-47b0-914c-07f0aef571b0",
            "instanceCreateTime": "2024-06-16T04:00:00Z",
            "instanceSnapshotUUID": "e109d830-8779-4782-a804-6e853595d4b7",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "e1f4469e-034a-4a01-af26-ad75b2c9f48b"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 665,
            "snapshotUUID": "e109d830-8779-4782-a804-6e853595d4b7",
            "status": "done",
            "totalSize": 2000683008,
            "virtualVolumeID": null,
            "volumeID": 134,
            "volumeName": "win1"
          },
          {
            "attributes": {},
            "checksum": "0x3bc446deaec55ce3",
            "createTime": "2024-06-16T04:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T08:00:00Z",
            "groupID": 78,
            "groupSnapshotUUID": "ed2cc8ee-cec2-47b0-914c-07f0aef571b0",
            "instanceCreateTime": "2024-06-16T04:00:00Z",
            "instanceSnapshotUUID": "2d9733d6-e4f5-4850-8180-108f220c0ca0",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "5f70fc08-fad6-465d-8dac-83766eb38ab4"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 666,
            "snapshotUUID": "2d9733d6-e4f5-4850-8180-108f220c0ca0",
            "status": "done",
            "totalSize": 20000538624,
            "virtualVolumeID": null,
            "volumeID": 135,
            "volumeName": "win2"
          },
          {
            "attributes": {},
            "checksum": "0xa5ad86b4325fe51f",
            "createTime": "2024-06-16T04:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T08:00:00Z",
            "groupID": 78,
            "groupSnapshotUUID": "ed2cc8ee-cec2-47b0-914c-07f0aef571b0",
            "instanceCreateTime": "2024-06-16T04:00:00Z",
            "instanceSnapshotUUID": "896a487f-60f7-473d-965a-aed297cbd205",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "fba6dc63-993c-4a62-b85b-cb4043f04aae"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 667,
            "snapshotUUID": "896a487f-60f7-473d-965a-aed297cbd205",
            "status": "done",
            "totalSize": 5000658944,
            "virtualVolumeID": null,
            "volumeID": 136,
            "volumeName": "sqldb"
          }
        ],
        "name": "group-sql-snapshot",
        "remoteStatuses": [
          {
            "remoteStatus": "Present"
          }
        ],
        "status": "done"
      },
      {
        "attributes": {},
        "createTime": "2024-06-16T05:00:00Z",
        "enableRemoteReplication": true,
        "groupSnapshotID": 80,
        "groupSnapshotUUID": "ab8c301f-4654-42d2-b282-c603b45e9e5b",
        "members": [
          {
            "attributes": {},
            "checksum": "0x6174864243730c50",
            "createTime": "2024-06-16T05:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T09:00:00Z",
            "groupID": 80,
            "groupSnapshotUUID": "ab8c301f-4654-42d2-b282-c603b45e9e5b",
            "instanceCreateTime": "2024-06-16T05:00:00Z",
            "instanceSnapshotUUID": "8cb1405b-2485-401e-b85d-de549d5badd2",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "e1f4469e-034a-4a01-af26-ad75b2c9f48b"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 671,
            "snapshotUUID": "8cb1405b-2485-401e-b85d-de549d5badd2",
            "status": "done",
            "totalSize": 2000683008,
            "virtualVolumeID": null,
            "volumeID": 134,
            "volumeName": "win1"
          },
          {
            "attributes": {},
            "checksum": "0x3bc446deaec55ce3",
            "createTime": "2024-06-16T05:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T09:00:00Z",
            "groupID": 80,
            "groupSnapshotUUID": "ab8c301f-4654-42d2-b282-c603b45e9e5b",
            "instanceCreateTime": "2024-06-16T05:00:00Z",
            "instanceSnapshotUUID": "a04089f0-1e5a-4399-b21e-faceaa5f9e93",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "5f70fc08-fad6-465d-8dac-83766eb38ab4"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 672,
            "snapshotUUID": "a04089f0-1e5a-4399-b21e-faceaa5f9e93",
            "status": "done",
            "totalSize": 20000538624,
            "virtualVolumeID": null,
            "volumeID": 135,
            "volumeName": "win2"
          },
          {
            "attributes": {},
            "checksum": "0xa5ad86b4325fe51f",
            "createTime": "2024-06-16T05:00:00Z",
            "enableRemoteReplication": true,
            "expirationReason": "None",
            "expirationTime": "2024-06-16T09:00:00Z",
            "groupID": 80,
            "groupSnapshotUUID": "ab8c301f-4654-42d2-b282-c603b45e9e5b",
            "instanceCreateTime": "2024-06-16T05:00:00Z",
            "instanceSnapshotUUID": "ddadc183-e8da-4b75-9432-6952c88be1a3",
            "name": "group-sql-snapshot",
            "remoteStatuses": [
              {
                "remoteStatus": "Present",
                "volumePairUUID": "fba6dc63-993c-4a62-b85b-cb4043f04aae"
              }
            ],
            "snapMirrorLabel": null,
            "snapshotID": 673,
            "snapshotUUID": "ddadc183-e8da-4b75-9432-6952c88be1a3",
            "status": "done",
            "totalSize": 5000658944,
            "virtualVolumeID": null,
            "volumeID": 136,
            "volumeName": "sqldb"
          }
        ],
        "name": "group-sql-snapshot",
        "remoteStatuses": [
          {
            "remoteStatus": "Present"
          }
        ],
        "status": "done"
      }
    ]
  }
}
```
