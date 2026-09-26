# Multi-node Qdrant on Kubernetes with NetApp E-Series

Backup, restore and few other things with multi-node Qdrant on Kubernetes

- Part 1: [Single-Node Qdrant on Kubernetes with NetApp E-Series](/2026/04/30/singleton-qdrant-vector-db-netapp-eseries-santricity-csi.html)

- **Part 2: Multi-Node Qdrant on Kubernetes with NetApp E-Series (focus on Backup/Restore)** (this post)

## Introduction

In the first Qdrant-related post we saw how to deploy single-node Qdrant vector database on Kubernetes backed by NetApp E-Series. Nothing was different from how it'd work on Docker or in VM, except that it seemed easier. Not just the deployment, but also CSI-assisted backup and restore.

In this post we'll use a three-node cluster and take a look at one particular detail of storage management, Qdrant's native backup & restore.

## Environment

- Kubernetes 1.36.1
- SolidFire CSI 1.0 (main) and IBM Block CSI with SANtricity Patch 1.13.2 (Appendix B)
- Qdrant 1.18.0
- Versity S3 Gateway 1.4.1 (object store)

```sh
$ kubectl get nodes
NAME   STATUS   ROLES           AGE   VERSION
s78    Ready    <none>          25h   v1.36.1
s79    Ready    <none>          25h   v1.36.1
s80    Ready    control-plane   25h   v1.36.1
```

Using [Qdrant's Helm chart](https://github.com/qdrant/qdrant-helm), I deployed a three-node Qdrant cluster. I also added a utility pod of mine, which I use to automate Qdrant snapshots (more on that later).

```sh
$ kubectl get pods -n qdrant-multi
NAME             READY   STATUS    RESTARTS      AGE
qdrant-multi-0   2/2     Running   0             11h
qdrant-multi-1   2/2     Running   1 (11h ago)   11h
qdrant-multi-2   2/2     Running   2 (11h ago)   11h
qdrant-utils     1/1     Running   0             7h19m
```

I created a test database ("collection") named `test` to make use of storage.

![Qdrant test database aka collection](/assets/images/qdrant-eseries-csi-22-test-collection.png)

**Note:** Qdrant does not store images that you see in this screenshot. Those are merely the inputs used to create embeddings. The images were, and are, in an object store bucket reachable from my Web browser.

## Qdrant snapshots

ISVs have different names for DB dumps and it's "anything goes". Snapshot is one popular term for that.

Old school way of doing this was backup to disk (well, maybe also to tape, before my time). Some databases can backup directly to S3 (I blogged about Elasticsearch'es snapshot-to-S3), others need plugins to backup to S3 (the recent post about Cloud Native Postgres recently), etc.

In the case of Qdrant - but that is true in general - you don't want to dump data to the same volume where your database lives. 

That's why you want to have the second disk, or even more than just one. Here, each Qdrant node has one PVC for data and one for dump-to-disk.

```sh
$ kubectl get pvc -n qdrant-multi
NAME                              STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS       VOLUMEATTRIBUTESCLASS   AGE
qdrant-snapshots-qdrant-multi-0   Bound    pvc-ae0506c8-4c17-40db-856d-820f757cad06   10Gi       RWO            solidfire-bronze   <unset>                 11h
qdrant-snapshots-qdrant-multi-1   Bound    pvc-bd64c7b7-3ddc-4863-bae3-f732b243fb46   10Gi       RWO            solidfire-bronze   <unset>                 11h
qdrant-snapshots-qdrant-multi-2   Bound    pvc-7001d9e1-dc96-4288-9462-a2574746c349   10Gi       RWO            solidfire-bronze   <unset>                 11h
qdrant-storage-qdrant-multi-0     Bound    pvc-a4c6cf82-7743-4711-be3f-0e1283201bf9   50Gi       RWO            solidfire-bronze   <unset>                 11h
qdrant-storage-qdrant-multi-1     Bound    pvc-9a75cded-3d51-45cc-8a69-d3f904e9003f   50Gi       RWO            solidfire-bronze   <unset>                 11h
qdrant-storage-qdrant-multi-2     Bound    pvc-f4272122-ac40-4477-bc4a-ebf2349b2615   50Gi       RWO            solidfire-bronze   <unset>                 11h
```

Because collection data normally gets distributed across all nodes, each node asynchronously dumps its "share" of a collection to own snapshot disk.

In the UI, a collection's snapshot tab lists disk dump files ("snapshots") - if any - that belong to that node.

![Qdrant snapshot](/assets/images/qdrant-eseries-csi-18-qdrant-snapshot.png)

Recall that what you see here isn't "Qdrant cluster snapshots", but Qdrant node snapshot files - that belong to a larger snapshot of a collection. You could go to each node's Web UI to see its snapshots or use the API to get to them.

If you look at that "`get pvc`" output above, this Web UI shows snapshots on `qdrant-snapshots-qdrant-multi-0` which is attached to `qdrant-multi-0`. `qdrant-multi-1` would have different snapshot file names (or even snapshots from different times or collections, as currently snapshots are taken individually on each node!).

As you can see in database info tab, only one shard was created. That's a consequence of how the collection was created and will be discussed further below.

![Qdrant collection info](/assets/images/qdrant-eseries-csi-23-test-collection-info.png)

This is where things get interesting from a storage perspective.

It almost feels disturbing that one can delete or download these backups. I know it doesn't *have* to be that way - the UI wouldn't be accessible to non-admins - but even the fact that admins could download collections is disturbing if you're in a highly regulated sector.

![Qdrant snapshot download and delete](/assets/images/qdrant-eseries-csi-24-test-collection-snapshot-take-download.png)

A collection can be created two ways:

- (1) Create a collection (button)
- (2) Restore a collection 

The first is a wizard that creates a collection configuration file, basically. The second is what lets you get data into a new instance (collection).

![Qdrant snapshot restore](/assets/images/qdrant-eseries-csi-26-test-collection-restore-to-new.png)

The Qdrant documentation explains other ways how it can be done, but the UI has this easy to use, two-step wizard for developers.

The less prominent way - to use the CLI or API - is what enterprise and cloud-first users would use in production. No one will download, or be able to restore with confidence, data dumped to own notebook.

When it comes to choosing between Qdrant "snapshots" (in this blog post) and CSI snapshots (covered in the first post on Quadrant), what would most users prefer for production?

I think for most that would be Qdrant snapshots, even though they make longer to dump to disk and longer to restore (recover).

An advantage of CSI snapshots is that with very large (multi-TB) Qdrant databases, restoring from a snapshot still takes seconds, whether it's SolidFire or E-Series. But the user may prefer to use [replication](https://qdrant.tech/documentation/distributed_deployment/#replication) with servers and storage in own fault domains. The same preference I tried to express in this diagram: you can create AZ-like availability zones from racks and entry-level E-Series EF300 models, each with *own instance of CSI driver* for best redundancy.

![Replication with redundancy](/assets/images/elasticsearch-eck-santricity-csi-three-rack.png)

SolidFire can logically allocate nodes to [Protection Domains](/2021/06/08/solidfire-availability-zones.html), but you still have one cluster. Some see that as bad, some as good. Qdrant's designed for the approach shown in the picture - fewer smaller arrays better.

What about "backups", or copies of data outside of Qdrant cluster?

## Qdrant backups

To do that, simply copy or move Qdrant snapshots to an S3 bucket, possibly with Object Lock and appropriate policies (governance, compliance, tiering, replication, etc.).

You can use NetApp StorageGRID or Versity S3 Gateway for that, for example. 

I created a bucket called `qdrant` and a utility that helped me deal with data protection in this environment. And my "backup" simply copies Qdrant snapshots to `s3:<bucket>/<collection>`. Here's how it looks like for the collection "test".

![Qdrant backup bucket](/assets/images/qdrant-eseries-csi-19-vgw-bucket.png)

Below that level, we have Qdrant node name path of key, as each node holds its fraction of the collection.

![Qdrant backup bucket details](/assets/images/qdrant-eseries-csi-20-vgw-bucket-node-backups.png)

And finally, there may be several snapshot files in each node directory.

![Qdrant backup node snapshot detail](/assets/images/qdrant-eseries-csi-21-vgw-bucket-snapshot-view.png)

## Database snapshot and backup workflows

I'm not sure if mainstream data protection software has Qdrant integration even when it's not running on Kubernetes. The options for multi-node clusters on Kubernetes are likely two:

- Kasten or Veeam with CSI snapshots that leverage Volume Group Snapshot, followed by Data Mover database file copy to S3
- Native integration (Qdrant backup-to-disk followed by upload to S3)

Even though CSI snapshots are available with both SolidFire and SANtricity, I think more users would prefer the latter, Qdrant-native approach. Not just because it's more predictable, but also because native database dumps seem more flexible (not in Open Source Qdrant, but in Enterprise version) and should be more reliable than database files copied from data disk snapshot.

It would seem also right to take such Qdrant-native snapshots from within Kubernetes, either on schedule or on-demand from some workflow. Not through the Web UI, that is.

As snapshots get dumped to snapshot PVCs, they can be uploaded to a bucket in object store where you have full protection, auditing, and so on.

To restore, it's the same process but in reverse.  

That `qdrant-utils` pod is what I created to see how user-friendly that feels in action for these use cases:

- Option 1: irregular restores
- Option 2: day-to-day backup and restore

### Irregular restore

Let's say you ship embedded application based on specific state of an S3 bucket, specific Qdrant collection, and other details recorded in the Github repository and release.

Now there's a problem or you need to get back to that point-in-time, to debug, patch or troubleshoot.

Kubernetes and S3 make that easy. I can deploy multi-node Qdrant using Helm chart mentioned at the top, but I can also name a collection in init section, to not just deploy multi-node Qdrant, but also restore collection in one go.

This can happen years, or days, after you ship. S3 works just the same. And not only that, you can restore to *any* cloud, anywhere, as long as you can get to that S3 bucket. Compared to the traditional approach, that is absolutely amazing.

But there's more! I've written about S3 bucket snapshots (got 0 questions so far, we'll see how many years before someone asks about it) in StorageGRID 12: that lets me get a point-in-time view of the bucket that holds data used to create the Qdrant collection and that is *without* prior knowledge we'd need it.

If that application was released on 2025-06-30 14:43:12 and last DB backup was created at 14:41:38, it's trivial for me to restore the entire stack: 

- deploy a 3 node Qdrant cluster in 30 seconds
- restore Qdrant database ("collection") in 2 minutes
- create a point-in-time view of the S3 bucket that the Qdrant collection vectorized (at the time DB was backed up) in 30 seconds
- access that data anywhere

You gain access to data (used to create vector embeddings), database collection itself, and the entire software stack in minutes.

![Restore inputs to PiT with StorageGRID branch buckets](/assets/images/qdrant-eseries-csi-25-s3-backup-and-sg-bucket-snapshot.png)

The green-colored bucket is something I want to emphasize here: 

- Database backups were uploaded to backup bucket after releases
- Git repositories and artifacts were tagged on release
- However, **input data** (objects) in the `data` bucket are merely versioned in terms of S3 versions, so how to get a view from that point-in-time (PiT)?

StorageGRID 12 lets me create a bucket [snapshot](/2026/01/30/storagegrid-branch-buckets-snapshots.html) from an **arbitrary** point in time. All non-expired versions of objects are in the data bucket; we just need to pick a date-time in order to spin a read-only or read-write "snapshot bucket" as it was like at that time.

If a DB backup for v1 was created at 14:41:38, I'd create a snapshot bucket of my data bucket for the same point in time (and date, of course). An example, taken from the post on bucket snapshots linked just above:

![PiT bucket snapshot](/assets/images/storagegrid_branch-bucket_02.png)

While we keep all versions of objects in data buckets, objects used to calculate embeddings aren't expected to change that much and we can expire old versions of we want to. But the ability to create bucket snapshots gives us **an unlimited number of recovery points** (1,440/day due to minute-granularity in the Web UI; the API allows millisecond precision) without any "snapshot schedule".

This ability significantly simplifies my database operations. I don't have to coordinate my backups with the source (data bucket), coordinate database backups with the data bucket owner, or figure out how to create a point-in-time view of a versioned bucket to match my DB backup. All that is solved - we just upload DB dump files to S3 and create bucket views retroactively based on your Qdrant snapshot timestamp when we need them.

### Day-to-day backup and restore

This is simpler - we just need to control dump-snapshot-to-disk, restore snapshot-from-disk, and push/pull to/from S3.

The Qdrant utility pod I mentioned at the top is what I put together to chain commands into a simpler workflow between Qdrant instances, CSI snapshot volumes, and S3 bucket.

- Create snapshot dumps snapshot data to snapshot PVC (can be NL-SAS, if I want to keep them around for a while)
- Upload snapshot copies snapshot data to S3
- Delete old snapshots on snapshot disk to remove old junk 
- Restore named (or latest) snapshot from S3

```sh
$ kubectl exec -it -n qdrant-multi qdrant-utils -- python /work/qdrant-test.py -h
usage: qdrant-test.py [-h] [--collection COLLECTION] [--remote REMOTE] [--snapshots SNAPSHOTS]
                      {create,upload,restore,restore-latest,list,list-snapshots,delete-snapshots}

Qdrant snapshot management

positional arguments:
  {create,upload,restore,restore-latest,list,list-snapshots,delete-snapshots}
                        Operation to run against the Qdrant cluster

options:
  -h, --help            show this help message and exit
  --collection COLLECTION
                        Collection name for snapshot, upload, restore, or list-snapshots
  --remote REMOTE       Rclone destination, e.g. vgw:qdrant or s3:qdrant
  --snapshots SNAPSHOTS
                        Comma-separated snapshot sources for restore, either full Qdrant snapshot URLs or remote paths like vgw:qdrant/test/qdrant-
                        multi-0/file.snapshot

create: create per-node snapshots and print their node-local URLs
upload: create per-node snapshots, download them from Qdrant, and upload them to the configured remote
restore: use --snapshots with comma-separated remote paths or snapshot URLs and recover them back to matching nodes
restore-latest: pick the latest remote snapshot per node under --remote/--collection and recover them back to matching nodes
delete-snapshots: remove all snapshots for the collection on every node

```

When we delete snapshots, we don't have to deal with individual pods, we just talk to each node, ask it to get a list of snapshots related to a collection and then to delete it, which cleans it up from the snapshot PVCs (`qdrant-snapshots-qdrant-multi-[0,1,2]`).

```sh
$ kubectl exec -it -n qdrant-multi qdrant-utils -- python /work/qdrant-test.py delete-snapshots --collection test
Deleting test-8404107304685885-2026-05-26-09-08-51.snapshot on http://qdrant-multi-0.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-8404107304685885-2026-05-26-09-20-56.snapshot on http://qdrant-multi-0.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-8404107304685885-2026-05-26-09-21-49.snapshot on http://qdrant-multi-0.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-8404107304685885-2026-05-26-16-20-49.snapshot on http://qdrant-multi-0.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-8404107304685885-2026-05-26-09-12-04.snapshot on http://qdrant-multi-0.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-7655613874606540-2026-05-26-09-20-56.snapshot on http://qdrant-multi-1.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-7655613874606540-2026-05-26-09-21-49.snapshot on http://qdrant-multi-1.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-387279780726943-2026-05-26-09-12-05.snapshot on http://qdrant-multi-2.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-387279780726943-2026-05-26-09-20-56.snapshot on http://qdrant-multi-2.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-387279780726943-2026-05-26-09-08-51.snapshot on http://qdrant-multi-2.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-387279780726943-2026-05-26-07-45-58.snapshot on http://qdrant-multi-2.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
Deleting test-387279780726943-2026-05-26-09-21-50.snapshot on http://qdrant-multi-2.qdrant-multi-headless.qdrant-multi.svc.cluster.local:6333
```

"Restore latest" is what we'd use to restore the most recent backup to a new collection. 

```sh
$ kubectl exec -it -n qdrant-multi qdrant-utils -- python /work/qdrant-test.py restore-latest --collection test
Restoring latest snapshots: ['vgw:qdrant/test/qdrant-multi-0/test-8404107304685885-2026-05-26-09-08-51.snapshot', 'vgw:qdrant/test/qdrant-multi-1/test-7655613874606540-2026-05-26-09-08-51.snapshot', 'vgw:qdrant/test/qdrant-multi-2/test-387279780726943-2026-05-26-09-08-51.snapshot']
Downloading test-8404107304685885-2026-05-26-09-08-51.snapshot for qdrant-multi-0 from vgw:qdrant/test/qdrant-multi-0/test-8404107304685885-2026-05-26-09-08-51.snapshot
Downloading test-7655613874606540-2026-05-26-09-08-51.snapshot for qdrant-multi-1 from vgw:qdrant/test/qdrant-multi-1/test-7655613874606540-2026-05-26-09-08-51.snapshot
Downloading test-387279780726943-2026-05-26-09-08-51.snapshot for qdrant-multi-2 from vgw:qdrant/test/qdrant-multi-2/test-387279780726943-2026-05-26-09-08-51.snapshot
Uploading test-8404107304685885-2026-05-26-09-08-51.snapshot into test on qdrant-multi-0 for recovery
Uploading test-7655613874606540-2026-05-26-09-08-51.snapshot into test on qdrant-multi-1 for recovery
Uploading test-387279780726943-2026-05-26-09-08-51.snapshot into test on qdrant-multi-2 for recovery
```

`vgw:qdrant` probably looks familiar to Rclone users. I use rclone to interface with Versity S3 Gateway, and Qdrant API to upload/download snapshots to/from Qdrant nodes.

As a "storage guy", you might think how much faster it would be to clone a collection using CSI snapshot & clone.

The problem is, you'd also clone all other collections on the PVCs disks of that Qdrant cluster. And the user of cloned PVCs may or may not be allowed to access those clones. Or you may want to restore CSI snapshots to a different Kubernetes cluster (e.g. dev/test) that's not even attached to the same storage. And, instead of interfacing with the Qdrant API (to get a list of available snapshots, for example), users now have to interact with CSI and read PVC metadata. Unless CSI snapshots can help you work 100x faster, it's not worth the trouble.

### Other notes

A Kubernetes workflow like that would seem reasonable and convenient.

There are caveats, of course. Not in these approaches, but in the way Qdrant Helm chart or backup/restore works. There may be certain limitations in the free version, and so on, but the same issues impact the other approach (CSI snapshots) as well.

For example, the free version doesn't make it easy to restore a snapshot taken from a five-node cluster onto a three-node cluster. But this is even worse if your backups use CSI snapshots - without CSI, I have dump files neatly placed in an S3 bucket (`s3:/BUCKET/COLLECTION/SERVER_ID/SNAP_ID`; with CSI, I have database files stuck on PVs.

Another tricky part is that [sharding](https://qdrant.tech/documentation/distributed_deployment/#sharding) and some [limitations from the free version](https://github.com/qdrant/qdrant-helm#limitations) may get in your way, so after a restore, you may still need an additional workflow if you want to do something differently.

For example, a useful case that I've described above - would be to instantiate a multi-node Qdrant cluster *and* run a "restore-from-latest" in the same go. That can work, but (the lack of re-)sharding can get in your way and - depending on the objective - you may need to use various tricks to perform a "poor man's re-shard" and other things (such as delete shardless nodes from the cluster) to make database/storage layout fit for your purpose. 

Let's say you're a freeloader who backed up a three-node DB that contained three shards to S3. Now you need to run that through four-node performance tests, but after a restore you'll still have just three shards. That's one of those cases. Since there's no resharding in the free version, one has to read records and store them into a new collection. As an example, this screenshot shows two resharded collections (see Appendix B for more details on the larger collection).

![Resharded DBs](/assets/images/qdrant-eseries-csi-27-resharded-collections.png)

If you just need to debug some old database release for correctness or security updates, it's unlikely that you'll need re-sharding. See the Qdrant Helm chart README and Qdrant documentation for these details.

One of the performance-related observations is my Qdrant utilities pod is that it isn't very efficient. Take the restore workflow as an example:

- It downloads each node's dump file to the utilities pod (it does not download directly to snapshot volume)
- It uploads each Qdrant node's snapshot to the right node's snapshot volume (`qdrant-snapshots-qdrant-multi-[1,2,3]`)
- As soon as that upload to Qdrant is done, Qdrant's "restore snapshot" API "loads" that dump

A smarter way would be to have restore from each node by [reading them *directly* from S3](https://qdrant.tech/documentation/snapshots/#recover-from-a-url-or-local-file).

Storage cost-wise, SolidFire can't economize on capacity as there's only one type of volume, but on E-Series I'd we should use two storage classes if we had a lot of snapshot data:

- SSD-based RAID 1 Storage Class for data and potentially log and audit PVC
- NL-SAS RAID 6-based for snapshots and temporary snapshot area. These PVCs could bet set to `reclaimPolicy: Retain`

I can't think of a reason to have a lot of snapshot data on the snapshot PVC, though. You may have 2-3, but all of them can be easily uploaded to S3 and easily restored.

I also tried this customized version with separate PVCs for logs, audit logs, and snapshot restoration (this last PVC lets me copy-for-restore to a dedicated PVC, so that when I upload snapshots to S3, I don't re-upload snapshots copied from S3 to Qdrant snapshot PVC in order to restore it).

```
$ kubectl get pods,pvc -n qdrant-multi 
NAME                 READY   STATUS    RESTARTS   AGE
pod/qdrant-multi-0   2/2     Running   0          48m
pod/qdrant-multi-1   2/2     Running   0          48m
pod/qdrant-multi-2   2/2     Running   0          48m
pod/qdrant-utils     1/1     Running   0          47m

NAME                                                               STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS       VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/qdrant-audit-qdrant-multi-0                  Bound    pvc-95d56df2-a11c-45bb-9997-3eefe13c40dc   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-audit-qdrant-multi-1                  Bound    pvc-6352631e-dff1-4ec7-aa02-b3e894649aa1   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-audit-qdrant-multi-2                  Bound    pvc-53c88fd8-21c5-4c76-ac18-59cc655fdbbb   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-logs-qdrant-multi-0                   Bound    pvc-1e4ffe49-44ab-4ea7-800b-9eed7e7d67a0   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-logs-qdrant-multi-1                   Bound    pvc-fb2c46fb-159f-459e-8cfd-908671347a4b   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-logs-qdrant-multi-2                   Bound    pvc-807db8fc-84a1-4fee-84b0-3a08d6a21af8   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshot-restoration-qdrant-multi-0   Bound    pvc-4d48696c-0a00-4403-b2fa-ed3ab70624a1   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshot-restoration-qdrant-multi-1   Bound    pvc-55fc26f7-ae28-4b43-8654-313a973caae0   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshot-restoration-qdrant-multi-2   Bound    pvc-4fa3b2f2-30f7-41d7-95a6-9ec13fe48483   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-qdrant-multi-0              Bound    pvc-4db65376-62c6-44d0-b673-82088951acfe   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-qdrant-multi-1              Bound    pvc-c5181f87-8644-426c-9747-95e905d9bca2   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-qdrant-multi-2              Bound    pvc-589cf58b-eb16-4dcf-99c1-882909e7ae06   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-temp-qdrant-multi-0         Bound    pvc-66e02c92-8caa-43c9-a6b7-bb0a2ef1eb32   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-temp-qdrant-multi-1         Bound    pvc-c7a151fa-61c9-400f-9c48-cbf10fd036f0   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-snapshots-temp-qdrant-multi-2         Bound    pvc-cfcf627e-c92c-4796-97fb-9ecfcb70a01a   10Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-storage-qdrant-multi-0                Bound    pvc-eeac7a9e-04b1-4401-a253-fba5a5066111   50Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-storage-qdrant-multi-1                Bound    pvc-5736a153-40f8-4de6-a2f1-7bbd4a026bff   50Gi       RWO            solidfire-bronze   <unset>                 48m
persistentvolumeclaim/qdrant-storage-qdrant-multi-2                Bound    pvc-5ab94dc3-a01a-408a-8ca9-2864f5e903e8   50Gi       RWO            solidfire-bronze   <unset>                 48m
```

What I haven't done yet is an analysis of per-volume performance and capacity utilization. I hope to do that with SANtricity CSI rather than SolidFire, but I also need to prepare more data and come up with a data loading approach that will exercise storage in a non-trivial fashion.

Another thing that could be explored for these extra PVCs Velero/CSI backup using FSB (filesystem backup), if one has to keep logs and audit logs. Qdrant's API makes it possible to [query](https://qdrant.tech/documentation/security/?q=audit#audit-logging) audit logs and fetch logs, but there's no common log forwarding yet.

## Conclusion

I still don't know much more than I know about Quadrant, but some things are clearer now.

In the post with single-node Qdrant, we used CSI snapshot (IBM Block CSI with SANtricity patch) to backup Qdrant database to S3.

Multi-node Qdrant works better (no CSI Volume Group Snapshot and application "freeze" are required) with Qdrant's native dump-to-disk ("snapshot") and from there, copy-to-S3.

The benefits of this approach multiply if you follow that S3-centric approach I sometimes write about, including [this post](/2026/01/16/santricity-eseries-datalake-storage.html) from which I'll borrow this illustration: Qdrant would run on persistent disks on Dynamic Disk Pool (storage pool of E-Series), but processed data (including dumps of vector embeddings) would be parked on S3 (step 3), just like we did it in this post.

![S3 as single source of truth](/assets/images/eseries-datalake-storage-layout-02.png)

Qdrant "lives" on block devices, so block storage is necessary. But it's also costly and inconvenient for long-term retention. If you park your Qdrant backups on S3, you not only get all the benefits I described in this post, but can also take advantage of StorageGRID's bucket snapshots to achieve **coordination-free** "consistency snapshots"-like effect for the buckets where data inputs came from and where their embeddings are backed up.

Appendix B shows the same deployment on E-Series with IBM Block CSI with SANtricity patch.

I wanted to include some details about PVC capacity utilization, but - believe it or not - that's not easy to obtain from Kubernetes. Several aggregate values are offered in Appendix B.

## Appendix A: Demo video

Some bugs in the utility script can be seen, but it works correctly overall.

- [Multi-node Qdrant DB with backup/restore with NetApp SolidFire](https://rumble.com/v7afu8s-multi-node-qdrant-db-with-backuprestore-with-netapp-solidfire-and-santricit.html) - 4m24s

## Appendix B: "Manually" resharded collection

While working on SANtricity where I had more capacity and performance, I took the "Prefix Cache" dataset available from the UI (fixed settings), read all records (163K) and exported them to a *new* collection created with 6 shards with RF2 (12 shards total).

| Property | Value | 
| --- | --- |
| Dataset Name | Prefix Cache |
| Snapshot size | 398 MB | 
| Dimensions | 384 |
| Vectors count | 163,075 |
| JSONL size | 800 MB |
| On-disk (RF2) | 6.2 GB | 

Resulting collection `test-6x2` (Prefix Cache dataset; 6 shards, 2 replicas):

![Resharded Prefix Cache 6x2](/assets/images/qdrant-eseries-csi-28-disk-consumption-prefix-cache-6x2.png)

That's almost 20x from snapshot size to on-disk size across all three nodes, and almost 8x from JSONL size to on-disk size. It's interesting that `test` (straight restore from Qdrant dataset) used less than 400 MB on disk (2 shards, RF1).

`GET /collections/test-6x2` output:

```json
{
  "result": {
    "status": "green",
    "optimizer_status": "ok",
    "indexed_vectors_count": 0,
    "points_count": 163075,
    "segments_count": 48,
    "config": {
      "params": {
        "vectors": {
          "size": 384,
          "distance": "Cosine"
        },
        "shard_number": 6,
        "replication_factor": 2,
        "write_consistency_factor": 1,
        "on_disk_payload": true
      },
      "hnsw_config": {
        "m": 16,
        "ef_construct": 100,
        "full_scan_threshold": 10000,
        "max_indexing_threads": 0,
        "on_disk": false
      },
      "optimizer_config": {
        "deleted_threshold": 0.2,
        "vacuum_min_vector_number": 1000,
        "default_segment_number": 0,
        "max_segment_size": null,
        "memmap_threshold": null,
        "indexing_threshold": 10000,
        "flush_interval_sec": 5,
        "max_optimization_threads": null,
        "prevent_unoptimized": null
      },
      "wal_config": {
        "wal_capacity_mb": 32,
        "wal_segments_ahead": 0,
        "wal_retain_closed": 1
      },
      "quantization_config": null
    },Updated code
    "payload_schema": {},
    "update_queue": {
      "length": 0
    }
  },
  "status": "ok",
  "time": 0.00226129
}
```

`config` section in the official collection (before resharding):

```json
    "config": {
      "params": {
        "vectors": {
          "size": 384,
          "distance": "Cosine",
          "on_disk": true
        },
        "shard_number": 1,
        "replication_factor": 1,
        "write_consistency_factor": 1,
        "on_disk_payload": true
      }
    }
```

Prefix Cache collection shards in the Web UI:

![Prefix Cache 6x2 shards](/assets/images/qdrant-eseries-csi-29-prefix-cache-6x2-shards.png)

Here we also used the approach with many dedicated disks.

![PVCs with IBM Block CSI with SANtricity patches](/assets/images/qdrant-eseries-csi-30-multi-qdrant-pvc-santricity.png)

Using regular Python client to insert records did not stress the system, so there isn't much to report in terms of performance. We'd need a larger collection and an optimized client.

Qdrant has a benchmark suite, but it's done for Docker, so it can't be used with Kubernetes out-of-box. I'll do that if someone actually asks me for it. 

By the looks of it, this isn't going to be very different from [Milvus with E-Series](/2022/07/07/milvus-with-solidfire-e-series.html) - few hundred MB/s on three-node cluster serving a busy collection may be possible and is trivial for E-Series to deliver.
