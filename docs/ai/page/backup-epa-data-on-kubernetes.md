# Backup/restore E-Series Performance Analyzer with Kasten K10

How to leverage E-Series for both Veeam and Kasten backup destination

- [Introduction](#introduction)
- [Backup](#backup)
  - [Customizing backup scripts](#customizing-backup-scripts)
- [Restore](#restore)
  - [Scenario 1: delete deployments, PVCs and PVs, restore from repository](#scenario-1-delete-deployments-pvcs-and-pvs-restore-from-repository)
  - [Scenario 2: force delete Trident/SolidFire volumes, followed by the entire `epa` namespace](#scenario-2-force-delete-tridentsolidfire-volumes-followed-by-the-entire-epa-namespace)
  - [Scenario 3: revert to a Kasten/Trident snapshot](#scenario-3-revert-to-a-kastentrident-snapshot)
- [Quirks and fine-tuning](#quirks-and-fine-tuning)
- [Demo](#demo)
- [Summary](#summary)

## Introduction

Yesterday's [post on using Kasten with various backup repositories](/2023/02/09/veeam-eseries-nfs-storage-provider.html) talked about the choices between S3, NFS, and Veeam Repository.

I didn't want to make the post too long and I'd created Kasten demos before, so I didn't add another demo of a backup or restore procedure.

But recently I released E-Series Performance Analyzer v3.2.0 which [works with Kubernetes](/2023/01/14/eseries-performance-analyzer-container-orchestrator-kubernetes.html), so I wanted to see if it can be backed up and restored with Kasten v5.5.4.

EPA was using a SolidFire 12.5 backend managed by Trident v23.01.

## Backup

By default I deploy EPA to the `epa` namespace.

Since I already created a repository for NFS (called `nfs-repo`), I created a simple policy like this:

- Snapshot daily and retain two daily and one weekly snapshot
- Exports (i.e. "backup") two dailies and one weekly

```yaml
apiVersion: config.kio.kasten.io/v1alpha1
kind: Policy
metadata:
  name: epa-backup
  namespace: kasten-io
spec:
  comment: ""
  frequency: "@daily"
  paused: false
  actions:
    - action: backup
      backupParameters:
        profile:
          name: nfs-repo
          namespace: kasten-io
    - action: export
      exportParameters:
        frequency: "@daily"
        migrationToken:
          name: ""
          namespace: ""
        profile:
          name: nfs-repo
          namespace: kasten-io
        receiveString: ""
        exportData:
          enabled: true
      retention:
        daily: 0
        weekly: 0
        monthly: 0
        yearly: 0
  retention:
    daily: 2
    weekly: 1
    monthly: 0
    yearly: 0
  selector:
    matchExpressions:
      - key: k10.kasten.io/appNamespace
        operator: In
        values:
          - epa
```

Before we execute this policy we can edit and modify it. In the end Kasten will show something like this:

![EPA backup policy](/assets/images/epa-kubernetes-backup-00.png)

To take a snapshot of the application (i.e. the `epa` namespace) we can click on Run Once. 

![Run Once to take a snapshot](/assets/images/epa-kubernetes-backup-04.png)

I was using Trident PVCs, and the first (snapshot) part of the policy made Kubernetes take snapshots of Trident CSI volumes.

One particular detail worth mention is that EPA's database - InfluxDB v1 - was configured to use three volumes (data, metadata, WAL) - but the default way of taking those snapshots isn't a group snapshot (see Group Snapshot ID missing) and there's no straightforward way to enforce that in Kasten policies.

![InfluxDB snapshot on SolidFire](/assets/images/epa-kubernetes-backup-02.png)

An easy way to "fix" this is to use a single volume for InfluxDB if you're backing it up with Kasten. A harder way would be to mock around with advanced settings. 

Because the EPA workload (in terms of InfluxDB) is small and data few and not mission-critical, it's OK to use a single volume or even keep this as-is (3 PVCs, below).

![Multiple PVCs](/assets/images/epa-kubernetes-backup-01.png)

Export (backup) can be done on-demand, such as when you're about to upgrade EPA from one version to another.

![Kasten manual backup](/assets/images/epa-kubernetes-backup-05.png)

On export (backup), data is copied by Kanister (bronze Storage Class is the SC that uses SolidFire back-end).

![Kanister pod](/assets/images/epa-kubernetes-backup-03.png)

When this is done Kasten deduplicates and compresses data and copies it to repo (here, NFS). 

Although EPAs PVs were several GB in size, they were almost empty so several backups took only a few MBs of space on disk. Here's the NFS directory after 2 "full backups" of EPA with a minimal amount of InfluxDB data (just internal metrics, basically).

```sh
# Used  # Path
5.9M	/data/nfs/dump/k10/809cbcf4-a4dc-485b-9ed0-a9652711e186

```

One thing to note is on SolidFire you need the mind the number snapshots, because 32 per volume is the maximum. Create policies that don't retain too many snapshots. With 3 PVCs per app, 4 manual Kasten snapshots result in 12 SolidFire snapshots total (because they weren't expired).

![Trident and SolidFire snapshots](/assets/images/epa-kubernetes-backup-06.png)

If you want to delete these snapshots, expire them from Kasten to not confuse manual (on-demand) with scheduled (automated) snapshots.

### Customizing backup scripts

Kasten allows custom Kanister scripts which I [used before](/2022/04/13/backup-restore-beegfs-csi-pv-with-kanister-kasten.html), but I didn't want to do that here because the simple solution to use just one volume looks good enough.

Another item of interest is [Verda](https://github.com/NetApp/Verda), a NetApp project with execution hooks that could be used to make backups more reliable, but while it supports half a dozen databases, InfluxDB v1 isn't one of them.

## Restore

I ran three scenarios and all succeeded in restoring applications, settings and data.

### Scenario 1: delete deployments, PVCs and PVs, restore from repository

This is a common scenario that happens with accidental deletion or failed upgrades. 

Note that Kasten overrides Storage Class settings and even if we delete an app by mistake, the volumes remain and therefore restore from a snapshot can still work. 

But I deleted PVCs and PVs as well, which deleted all Trident/SolidFire snapshots. Because the backup was exported to NFS, I was able to restore from NFS repository without any issue.

### Scenario 2: force delete Trident/SolidFire volumes, followed by the entire `epa` namespace

This is a tough one, as all applications get stuck when storage is deleted first.

Like in Scenario 1, all volumes and snapshots were deleted, so the only option was to restore from an export (backup), i.e. a repository.

To make this restore faster (while the old namespace was terminating), I restored to a new namespace (called `eseries`).

It took a little bit more time, but still just a few minutes.

### Scenario 3: revert to a Kasten/Trident snapshot

In this scenario, without stopping or deleting anything, we restore a Kasten i.e. Trident (SolidFire) snapshot.

Because in Scenario 2 the application was restored to a new namespace (`eseries`), here we restored a snapshot created in that new namespace. This took less than two minutes.

![Restore from Trident and SolidFire snapshots](/assets/images/epa-kubernetes-backup-07.png)

## Quirks and fine-tuning

Kasten v5.5.4 seems to have less quirks than the previous versions I blogged about here. 

I wish there's a way to expire manually taken snapshots from the Web UI, but I haven't found a way to do it. 

Here's another inconvenience that needs to be solved (and maybe it can, with some work or knowledge):

- Create an app, take manual snapshots and create exports (backups)
- Wipe the app from Kubernetes
- Restore the app to a new Kubernetes namespace, and create a similar policy to protect it

Now we have a bunch of volumes and snapshots from the first policy.

It's best to first make sure new backup policy can work in terms of snapshots and backups and only then delete the old policy. At that point we're sure we no longer need any of the orphaned volumes and snapshots.

But deleting the old policy doesn't seem to expire or delete orphaned volumes and snapshots from the first application. If you aren't a Kasten expert figuring out which storage volumes (and you may have hundreds) are orphaned and may be deleted may require some effort.

In one of the early Kasten posts I gave some basic examples with PowerShell (which I used to find old SolidFire snapshots), but those could be improved to automate cleanup or orphaned resources. When you have just orphaned snapshots, see [Trident issue 462](https://github.com/NetApp/trident/issues/462#issuecomment-847102105). Maybe [K10 Garbage Collector](https://docs.kasten.io/5.5.4/operating/garbagecollector.html) can take care of this automatically, but I haven't had time to try it.

Realistically, without additional integration there's no way for Kasten to know what needs to be deleted and how so some manual intervention may be unavoidable. The good news is these problems shouldn't happen often and can be solved with simple scripts.

## Demo

- [Backup and restore of EPA with Kasten](https://rumble.com/v29ha40-use-kasten-to-backup-and-restore-e-series-performance-analyzer-application.html) - 11m10s

## Summary

EPA can be backed up and restored with Kasten.

If you care about recoverability a lot and can't get group snapshots to work, fall back to a single InfluxDB volume, or find a way to take a group snapshot (whether it's SolidFire or some other platform).

If using SolidFire, also pay attention to the number of snapshots retained by your Kasten protection policy.
