# Volume Copy in santricity-client (Python)

Volume Copy and its use cases in santricity-client

SANtricity Client (Python) has added volume copy commands. I wrote about the need for it in the [CSI post](/2026/05/12/veeam-kasten-santricity-csi-netapp-eseries.html#conclusion) yesterday.

First, how does "Copy Volume" work in the first place? From [TFM](https://docs.netapp.com/us-en/e-series-cli/commands-a-z/create-volumecopy.html):

> The create volumeCopy command creates a volume copy and starts the volume copy operation. This command is valid for snapshot image volume copy pairs.

I don't think so.

I think can arbitrarily copy one volume to another of the same or larger size on the same array.

How does it actually work?

Data is thick-copied from A to B. This can be done with:

- source volume "online" - when source is regular source volume in read-write mode or a *read-write* linked clone
- source volume "offline" - read-only linked clone or read-only regular volume

Because SANtricity snapshots are copy-on-write (aka "CoW"), restores don't involve just a change in pointers - data must be copied. Likewise, copying a volume to another *while* the source is being written to means a CoW disk (in a repository group) must be used to preserve the volume in the point-in-time state when the copy command was issues.

In "offline" copying the source is placed in read-only mode and no modifications are allowed unti copying is done.

Why would someone need this as opposed to "simply" using snapshots and clones?

- Copy linked clone to a "real" volume because we want our data on a real volume
- Copy linked clone to a "real" volume because we want to conduct performance testing that could impact production volumes if done on a linked clone
- Copy volume may be faster or simpler than copying data from a host
- Potentially copy data to a different pool or different RAID level (I think I've donoe this in the API several months ago, but I'll have to check)

There are surely other reasons. bottom line is, we want this in SANntricity client(s) and we can start with Python.

This workflow isn't complex:

- Ceck if anyone is copying a volume or linked clone to volume B. If there's no one, copy your volume A to B
- Watch progress, update copy parameters (such as job priority) if you need to, and potentially stop the job (takes too long, works too slow, etc.)
- Delete completed copy job (I guess the main idea is to free the repository group capacity used for ephemeral snapshot in online copying)

The API methods exist, we just need:

- a CLI interface
- a smart way of running it

This takes care of the first item:

![Volume Copy online help](/assets/images/santricity-client-volume-copy-00-help.png)

A smart way of running it would be a command or switch (`--auto`?) to make decisions for us. SANtricity Client has this for snapshots, for example. For Copy Volume, it will be slightly different. I don't know all of the details as I haven't gotten that far yet, but it might include:

- Estimate job duration, poll system utilization, consider job priority and pass adjusted priority when creating a job
- Watch progress and make adjustments
- Automatically delete job 

We don't have to create *three* commands to individually automate each individual step. It may run one or several CLI commands within. For very large volumes, maybe just one that exits after job starts and does not perform steps 2 and 3 above. For small volumes, it may be one longer command that runs for 2-3 minutes and takes care of all three steps.

We may also want to provide `--new-host` or other arguments to wrap multiple steps in one command. These could also be used to speed up the process of copying one volume to many where simple "looping" wouldn't work well. An optional Webhook to E-Series Performance Analyzer would be nice to have as well.

I want to make use of this in:

- Generic volume copy (for databases and whatever else comes along). I have blogged about SANtricity PowerShell modules, which I use in PowerShell scripts that automate snapshots and linked clones for PostgreSQL (those are shared on Github), for example. Those can't copy volumes, though. Having something similar that uses Copy Volume instead of Linked Clones would be nice. Like in the PowerShell examples, these will also have Web hooks that can send notifications to E-Series Performance Analyzer.
- IBM Block CSI with SANtricity patch. This would come handy for Copy Volume in Kubernetes CSI. I don't need it *right now*, but being able to clone workloads to regular volumes - both from CSI snapshots (which create Linked Clones) or from scaled down pods - would be great. If you read the Kasten post linked at the top, you may realize Volume Copy may be able to give us some extra flexibility in data management without building this bloat into the driver itself (especially not IBM Block CSI, which would not only create driver bloat, but additionally make maintenance harder due to the need to constantly re-patch the driver every time IBM updates it).  

To copy, we list to find the IDs. You may need to do a `CTRL + -` to zoom out and avoid truncation. `--json` also works.

```sh
$ santricity volumes list
                                                             Volumes                                                              
                                                                                                                                  
  Name            Volume Ref                       Pool Ref                          Cap (GiB)   Cache (r)   Cache (w)   Status   
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
  repos_0000      32333435363738393031343435000…   323334353637383930313339310000…        4.00      Yes         Yes      optimal  
  vol-cluster-1   32333435363738393031343133000…   323334353637383930313339310000…       50.00      Yes         Yes      optimal  
  vol-cluster-2   32333435363738393031343137000…   323334353637383930313339310000…       50.00      Yes         Yes      optimal  
  vol-linux-1     32333435363738393031343030000…   323334353637383930313339310000…       20.00      Yes         Yes      optimal  
  vol-linux-2     32333435363738393031343034000…   323334353637383930313339310000…       20.00      Yes         Yes      optimal  
  vol1            32333435363738393031333935000…   323334353637383930313339310000…       10.00      Yes         Yes      optimal 
```

Then we copy.

```sh
$ santricity volumes copy 3233343536373839303133393500000000000000 3233343536373839303134303000000000000000 --online
```

The response will contain copy job ID (`volcopyRef`):

```json
{
  "worldWideName": "303132333435363738393A3B3C3D3E3F",
  "volcopyHandle": 11,
  "volcopyRef": "3233343536373839303134353300000000000000",
  "status": "inProgress",
  "sourceVolume": "3233343536373839303134353100000000000000",
  "targetVolume": "3233343536373839303134303000000000000000",
  "currentManager": "070000000000000000000002",
  "idleTargetWriteProt": false,
  "copyCompleteTime": "-1",
  "copyStartTime": "1778905906",
  "copyPriority": "priority3",
  "reserved1": "00000000",
  "cloneCopy": true,
  "pgRef": "3233343536373839303134343900000000000000",
  "type": "unknown",
  "autoClearOnCompletion": false,
  "baseSourceVolumeId": "3233343536373839303133393500000000000000",
  "onlineCopy": true,
  "id": "3233343536373839303134353300000000000000"
}
```

That `id` is the volume copy job ID as well (unnecessary duplication in SANtricity API responses is common). 

In a case where you need to wait, you can use `copy-status` to get all ongoing copy jobs:

```sh
$ santricity volumes copy-status
```

This response has a `percentComplete` value. This example shows a job that just completed.

```json
[
  {
    "volAction": "volumeCopy",
    "copyback": null,
    "reconstruct": null,
    "capacityExpansion": null,
    "raidMigration": null,
    "raidMigrationandExpansion": null,
    "segSize": null,
    "volExpansion": null,
    "volAndCapExpansion": null,
    "defrag": null,
    "init": null,
    "format": null,
    "sync": null,
    "copy": {
      "volcopyRef": "3233343536373839303134353300000000000000",
      "pending": false,
      "percentComplete": 82,
      "timeToCompletion": 0
    },
    "parityScan": null,
    "rollback": null,
    "pitRollback": null,
    "initialSync": null,
    "rebalancing": null,
    "copyThenFail": null,
    "copyThenFailPending": null,
    "copyThenReplace": null,
    "copyThenReplaceAndFail": null,
    "reconstructCritical": null,
    "thinDefrag": null,
    "volCreation": null,
    "volDeletion": null,
    "offlineFormat": null,
    "driveOperation": null
  }
]
```

`timeToCompletion` may not be too reliable, so if you see `5` and sleep five seconds before kicking off some batch job, that may not be the best way. You really want it to return `[]` before you go.

Volume Copy isn't too aggressive - medium priority is the default - but the volume is small and you need it soon, you may want to pump that up a bit. Four is the highest.

```sh
$ santricity volumes copy-update 3233343536373839303134353300000000000000 --priority priority4 
```

Priority4 seems to copy volumes at around 150 MB/s (it should really be faster, since that's the highest priority), and may be preferred for small volumes where (say) a 32 GiB LUN might be copied within five minutes.

If you need something quickly, Linked Clones are near-instant and can be provisioned in seconds. But they're "fake" volumes that depend on real base volumes. I've blogged about snapshots and clones so you can see those other posts for more on that topic.

Speaking of Linked Clones: I've noticed there's no "volume group copy", so that may be one use case for Linked Clones. 

Also for LC-to-Regular Volume Copy. One way to get CGs copied to regular volumes would be to create a CG snapshot (which we can do) and copy all those volumes to regular volumes. Then the CG snapshot can be deleted. When copying from an LC volume:

- In a fully automated workflow, perform an **offline** copy using `--offline`. Now, SANtricity Client can create only read-only LCs (whether stand-alone or CGs) and those aren't writable, obviously. Online volume copy from an R-O LC would fail.
- If you create R-W LCs on a schedule you created or through own automation, then `--online` would be possible. SANtricity offers no way to schedule LC updates or creation - it has to be done by calling the API from the outside

And finally, clean-up. 

Why is clean-up needed? Because ephemeral repo groups may stay behind hogging your capacity. That's why SANtricity Client and E-Series Performance Analyzer 4 expose them.

```sh
$ santricity snapshots list-repo-volumes
                                                    Repository-related Volumes                                                    
                                                                                                                                  
  Name         Volume Ref                         Use            Mapped   Cap (GiB)   Pool Ref                           Status   
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
  repos_0000   3233343536373839303134333400000…   concatVolume     No          4.00   3233343536373839303133393100000…   optimal  

$ santricity snapshots list-groups
                                                         Snapshot Groups                                                          
                                                                                                                                  
  Name              Pit Group Ref      Sched Owned   Sched Count   Base Volume         Snapshots   Repo Cap (GiB)   CG   Status   
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
  ONC_vol1_SG_000   323334353637383…       No                  0   3233343536373839…           0             4.00   No   optimal  
```

Unless you copy volumes several times a day, it's best to nuke these completed copy jobs, which also removes the repos if possible (meaning, if they're not used by other snapshots or read-write clones). Notable, some of these older API commands return text rather than JSON.

```sh
$ santricity volumes copy-cleanup
Cleanup routine executed successfully.

```

(This command (`copy-cleanup`) one wasn't in the screenshot earlier, but it was added later.)

Now this can be added to IBM Block CSI with SANtricity patch as well. I may not do it right away, but it's there should we need it.

Obviously, if you use this, evaluate first and make sure it doesn't do anything you don't want it to do.
