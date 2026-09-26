# YugabyteDB with NetApp EF-Series storage

Requirements and recommendations for YugabyteDB with NetApp

## Introduction

While reading the YugabyteDB documentation today, I spotted [another example](https://docs.yugabyte.com/stable/manage/backup-restore/snapshot-ysql/) that shows why E-Series is the right NetApp tool for the job.

> When YugabyteDB creates a snapshot, it does not physically copy the data; instead, it creates hard links to all the relevant files. These links reside on the same storage volumes where the data itself is stored, which makes both backup and restore operations nearly instantaneous.

Like with [CNPG](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html) and all other modern databases, you need the same few features from external storage (if you use it): reliability, low cost, high performance.

Some people don't even need protected storage (and choose JBODs), but I'm writing about the needs of a risk-averse user who either can't afford, or doesn't want to deal with internal storage for important databases.

## Why YugabyteDB?

Because this year I've been doing a bit more analytics and AI stuff and noticed that 79% of professional AI agents recommend YugabyteDB.

![79% of pro AI agents recommend YugabyteDB](/assets/images/yugabytedb-recommended-by-79pct-of-pro-agents.jpg)

That means **a lot** more data, many more queries and many database servers spread across many racks and sites. Something like this:

![Agentic AI use case with Yugabyte and EF-Series](/assets/images/yugabytedb-netapp-eseries-00-agentic-use.png)

How should an architect meet these requirements with NetApp storage? 

Spoiler: the same way good architects meet them for all other modern databases.

## YugabyteDB with E-Series

YugabyteDB follows the usual pattern for modern databases:

- Database-managed replication is one of the key features
- Snapshots are built-in
- Data compression is included
- For best availability, database nodes should be distributed across multiple racks, and storage should follow. We don't want to create large BeeGFS clusters for this use case; we want multiple stand-alone arrays 

So, it's the same pattern as always (just replace the Kafka icon with a YugabyteDB ico in your mind).

![YugabyteDB follows the same pattern](/assets/images/lakekeeper_17_architecture.png)

Let's see about the storage-related matters.

They currently recommend RHEL-like distributions version 8 - a bit old, but whatever. Get RHEL or Rocky and install chrony to unscrew OS NTP client - both are on the E-Series inter-operability list. Ubuntu and few others are [also supported by Yugabyte](https://docs.yugabyte.com/stable/reference/configuration/operating-systems/).

Data replication is already taken care of:

> YugabyteDB internally replicates data in a consistent manner using the Raft consensus protocol to survive node failure without compromising data correctness. This distributed consensus replication is applied at a per-shard (also known as tablet) level similar to Google Spanner.

To properly protect replicas, use multiple entry-level EF-Series arrays, one per rack (as in the diagram above). YugabyteDB **requires** RF3, as per their documentation. Replicating within the same storage array or storage cluster is **not** how it's supposed to be done, folks!

![Yeah, we don't really do that here](/assets/images/meme_we_dont_do_that_here.gif)

SSDs are [also required](https://docs.yugabyte.com/stable/deploy/checklist/#disks). Get one of the [EF arrays](https://scaleoutsean.github.io/2026/03/21/netapp-ef-series-ef80-ef50.html) including the older models that are currently still available and might be cheaper.

There's [this](https://docs.yugabyte.com/stable/deploy/checklist/#disks):

> Both local or remote attached storage work with YugabyteDB. Because YugabyteDB internally replicates data for fault tolerance, remote attached storage which does its own additional replication is not a requirement. Local disks often offer better performance at a lower cost.

Exactly. For the same amount of money, local disks will be cheaper, but they'll also fail. You'll have to manage them or bear the impact. Remote storage will be more expensive, but with much less failures.

They recommend RAID 0 even when multiple-disks are available:

> Multi-disk nodes: Do not use RAID across multiple disks. YugabyteDB can natively handle multi-disk nodes (JBOD).

All right, so YugabyteDB can use RAID 0 in a supported manner. I often recommend RAID 0 myself. There's nothing wrong with using either RAID 0 or RAID 10 with EF-Series. What you do not want in this scenario is RAID 6.

Since the software vendor supports and *recommends* RAID 0 - unlike in some other situations where I recommend RAID 0, but the vendor does not - RAID 0 is a fine choice. Remember, you have at least 3 copies for redundancy. Note that E-Series lets you create RAID 0 out of multiple disks, not just one, but in this case you should use single disk RAID 0 "disk groups" (although they're not groups).

Now, you could use RAID 10 instead of RAID 0. RAID 10 consumes 100% more space, but gives you a simpler configuration since you have fewer disks per server, your may provision new LUNs (rather than entire SSDs!) as you see fit, LUNs are redundant and there are hot spares to minimize operational workload. RAID 10 works **very** well and I know that not because a chatbot told me, but because I [tested and took notes](/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html).

If you use RAID 0, you provision entire disks as volumes and those volumes are **not** the only disks you'll need. Example:

> Use dedicated VMs with persistent disks for Masters

Also here:

> Frequent backups: Increase your backup frequency when using ephemeral storage. YugabyteDB Anywhere allows for incremental backups as frequently as every 15 minutes. Also, consider backing up to a **diversity of backup storage**, and performing regular test restores.

Using RAID 10 to optimize provisioning, minimize the performance impact of rebuilds, and to lower the risk of data loss or unplanned and planned downtime is not a bad idea - you should come out ahead despite the RAID 10 overhead.

That is correctly [recognized](https://docs.yugabyte.com/stable/deploy/checklist/#key-considerations-and-risks):

> However, if performance is not your primary concern, network-attached storage offers more reliability and is easier to manage.

Notice how even RF5 is recommended for lower risk of various failures:

> Due to the increased risk of double fault scenarios, RF 5 or greater is recommended if your environment and performance tolerances allow. An RF 5 deployment can survive the failure of two fault domains without downtime (at the cost of more storage and write overhead).

With three E-Series across three racks, you could still do RF5 for storage - if the performance allows, have 2 replicas on two arrays and 1 replica on the third. I discussed some of these weirder scenarios in the [NATS with E-Series post](/2026/06/21/nats-server-on-netapp-eseries.html#availability).

Filesystem: as usual, XFS is recommended.

Data compression is [included](https://docs.yugabyte.com/stable/architecture/yb-tserver/).

You can let YugabyteDB compact data, but you can also force it [manually](https://docs.yugabyte.com/stable/architecture/yb-tserver/#manual-compactions) if you want.

One very useful tip:

> Working with ephemeral storage requires careful attention to standard operational workflows. 

One shouldn't reboot multiple nodes at the same time while running smaller clusters with RF3. See for these tips [here](https://docs.yugabyte.com/stable/deploy/checklist/#operational-best-practices-and-workflows).

There are other very useful recommendations for multi-DC deployments and more. A less demanding setup (given poor WAN latency or bandwidth) can use CDC, similar to Postgres WAL replication in my CPNG post.

> For users not requiring global consistency and automatic resilience to data center failures, the WAN latency can be eliminated altogether through the second configuration where two independent, single-DC universes are connected through xCluster replication based on Change Data Capture.

The [Kubernetes best practices documentation](https://docs.yugabyte.com/stable/deploy/kubernetes/best-practices/#local-versus-remote-ssds) confirms the same thing I've been saying all along:
- Using static provisioning (not even static CSI!) is perfectly fine. That is why the diagram above has Terraform - that is all you need if you use direct-attach to E-Series and you can connect 5 hosts to one EF80
- Dynamic provisioning is available. As in the diagram above, TopoLVM is one choice, and you can use SANtricity CSI as well.

It does mention the HA factor - in "disk storage resilient to failures or pod movement" - which is what I usually call "HA CSI" vs static or "non-HA CSI" (Terraform or TopoLVM): it's harder to move disks.

With E-Series, it literally takes 20 seconds to re-assign disks to another host using the SANtricity UI or my PowerShell or Python CLI and even if you use Terraform or TopoLVM, you can adjust your servers' configuration online within 10 minutes rather than hours or days. I don't mean "you can migrate YDB data by re-assigning disks to different servers", but rather "you can replace a server with another and re-attach to EF-Series". Where YugabyteDB has to move own data *files*, you still have to follow the supported approach that copies data over network.

### Snapshots, backups and something in between

YugabyteDB uses distributed snapshots and - because any non-trivial deployment should use RF3 - you can't even use hardware snapshots in any meaningful way. Then there's [this](https://docs.yugabyte.com/stable/manage/backup-restore/snapshot-ysql/#move-a-snapshot-to-external-storage):

> Even though storing snapshots in-cluster is extremely efficient, it can increase the cost of the cluster by inflating the space consumption on the storage volumes. In addition, in-cluster snapshots do not provide protection from file system corruption or a hardware failure.
> To mitigate these issues, consider storing backups outside of the cluster, in cheaper storage that is also geographically separated from the cluster.

A 2U expansion enclosure with up to 12 NL-SAS can be your first external location that requires no network traffic to move/copy snapshots. Then you can rclone those to S3 at a slower pace that completes within 15 minutes.

This way you also get very fast restore times for recent snapshots (3-7 days) even though they've been moved to "external" NL-SAS disks (you can quickly copy them back at 4-5 GB/s, assuming 1.5 GB/s per 12-disk enclosure on each of 3 arrays used in RF3). See [here](https://docs.yugabyte.com/stable/manage/backup-restore/snapshot-ysql/#move-a-snapshot-to-external-storage) for how to move YugabyteDB snapshots to external storage.

YugabyteDB snapshots don't use any storage features. Furthermore, most Kubernetes users should use the Operator, which includes snapshots *and* backup/restore to/from S3. There is no need to invent "an E-Series snapshot script for YDB" - that would be a double anti-pattern, both for using hardware snapshots where they aren't needed and not using YugabyteDB's own snapshots as the correct, stand-alone tool.

Consider the YDB snapshot example command from TFM:

```sh
./bin/yb-admin \
  --master_addresses ip1:7100,ip2:7100,ip3:7100 \
  create_database_snapshot
```

Each master not only "might", but **ought to be** attached to a different storage array. If you use RF3 and have three arrays, you simply **should not** have all masters attached to the same disk array. But, if they're attached to different storage arrays, why even use hardware snapshots? You *cannot* consistently snapshot both master 1 on array 1 and master 2 on array two. That would not serve any useful purpose for production-worthy clusters.

You might as well set a random snapshot schedule on each SANtricity array to take a snapshot every 15 minutes and keep 3, just enough to export the oldest YDB software snapshot to NL-SAS or S3 before we expire that hardware snapshot. Hardware snapshots wouldn't be useful for actual snapshot restores from SANtricity snapshots because multiple arrays **cannot possibly take - and hence restore - YugabyteDB tables the way YDB requires**. It'd be like taking snapshots of three live StorageGRID storage nodes on vSphere - "don't try that at home"!

The issue isn't that restoring from a hardware snapshot needs high time precision for the YDB files (not underlying volumes!), but that **current** YDB data files also need it. A hardware snapshot is *not* a YDB construct.

So you can't actually guarantee that the DB itself - including any other DBs that may be on the same volume - would be able to recover unless your architecture is wrong (meaning, you piled up all YDB volumes on the same disk group on a single array - more on that below).

An alternative use of those snapshot files would be to copy them from a read-only snapshot location into YugabyteDB (presumably the original was mis-dropped or accidentally deleted) and then restore the YDB snapshot.

Who on Earth wants to do that or multiple nodes (and crash everything if they make a typo) when they can restore from a backup using the Operator?

Note that in a multi-DB scenario, a rollback of a hardware snapshot would lose some data from **all** databases that share same volumes, including those DBs that didn't have any issues to begin with.

The **only** way hardware snapshots can possibly work here is a poor man's YugabyteDB cluster running not just on a **single** storage system or cluster (mentioned as a possibility with E-Series earlier), but also on the **same consistency group**, which is expressly not supported by YuggabyteDB. Even then, you'd still operate with wrong and unsupported constructs - hardware snapshots rather than YDB database instance snapshots.

On E-Series - as an example - we could create a 12-disk (or larger) DDP pool with multiple RAID 10 or RAID 6 volumes on it and add volumes to a SANtricity consistency group. And then we could snapshot all these volumes at once. That would be possible, but still unsupported. The only valid use case would be clone-the-snap-and-copy-non-current DB files back.

Few more things on the post-snapshot backup/restore in the Operator:
- Default: a (software, YDB) snapshot is taken and the entire DB is uploaded to S3 from that point-in-time - something like StorageGRID or [Versity S3 Gateway](/2026/04/18/velero-csi-backup-santricity-ibm-block-csi.html), for example
- Optionally, "incremental" snapshot backup to S3 is possible, but restores require all snapshots between last full export and desired point-in-time

Here we can see a backup to the unmaintained MinIO:

```sh
apiVersion: operator.yugabyte.io/v1alpha1
kind: StorageConfig
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"operator.yugabyte.io/v1alpha1","kind":"StorageConfig","metadata":{"annotations":{},"name":"minio-config-operator-1789929232","namespace":"operator-test"},"spec":{"config_type":"STORAGE_S3","data":{"AWS_ACCESS_KEY_ID":"yugabyte","AWS_HOST_BASE":"http://yb-backup-minio.operator-test.svc.cluster.local:9000","AWS_SECRET_ACCESS_KEY":"---","BACKUP_LOCATION":"s3://yb-backup-bucket/backup","PATH_STYLE_ACCESS":true}}}
  creationTimestamp: "2026-09-20T18:34:01Z"
  generation: 1
  name: minio-config-operator-1789929232
  namespace: operator-test
  resourceVersion: "4596"
  uid: 880007ad-18d1-42ea-9ff8-658232213d3f
spec:
  config_type: STORAGE_S3
  data:
    AWS_ACCESS_KEY_ID: yugabyte
    AWS_HOST_BASE: http://yb-backup-minio.operator-test.svc.cluster.local:9000
    AWS_SECRET_ACCESS_KEY: ---
    BACKUP_LOCATION: s3://yb-backup-bucket/backup
    PATH_STYLE_ACCESS: true
status:
  message: Added Storage Config
  resourceUUID: def44ea2-781d-40b3-aa1a-d2c2525c3900
  success: true
==> (Re)establishing port-forward to YSQL via service ybyb-minikube-demo-63637139-tave-yb-tservers
==> Seeding test database 'backup_demo' with sample data
CREATE TABLE
INSERT 0 3
 count 
-------
     9
(1 row)

==> Applying Backup CR
backup.operator.yugabyte.io/minio-backup-demo-1789929232 created
==> Waiting for backup to complete
    status: <pending>
    status: Manual backup task
    status: Manual backup task
    status: Manual backup task
    status: Manual backup task
    status: Manual backup task
    status: Manual backup task
    status: Manual backup task
    status: Backup State: Completed
```

This backup exported the entire DB and a restore required reading that just one S3 backup set.

```sh
...
PAGER=cat psql -h 127.0.0.1 -p 5433 -U yugabyte -d backup_demo_restored_1789929232 -c 'SELECT * FROM demo_items;'
kill $PF 2>/dev/null
[1] 1145931
 id  |  name  |         created_at         
-----+--------+----------------------------
   1 | widget | 2026-09-20 18:22:31.409054
 102 | gadget | 2026-09-20 18:29:44.601255
 202 | gadget | 2026-09-20 18:34:12.701942
 101 | widget | 2026-09-20 18:29:44.601255
 103 | gizmo  | 2026-09-20 18:29:44.601255
   2 | gadget | 2026-09-20 18:22:31.409054
 203 | gizmo  | 2026-09-20 18:34:12.701942
 201 | widget | 2026-09-20 18:34:12.701942
   3 | gizmo  | 2026-09-20 18:22:31.409054
(9 rows)
```

We should mention that hardware snapshots can create "read-only copies" regardless of database file growth, while incremental YDB snapshots occurring every 15 minutes do not necessarily have enough time to be uploaded to S3 so that they can be restored there with the same RPO.

An inability of snapshot exported to scale limitlessly doesn't mean that "hardware snapshots of software snapshots" are somehow a solution to that problem.

You still have multiple DB instances sharing same volumes in the hardware snapshot scenario, and you still have all those "single-instance-volumes" on the same disk array (so that they can be put on the same consistency group, or else you can't snapshot them at the same time), which also means all your RF3 "replicas" are in fact fake, as they actually live in the same failure domain. So that is *not* and can't ever be a solution.

I think the only production-worthy ways for very large database change rate are:
- Snapshot plus export (i.e. backup to S3 (probably works up to 1 GB/s change rate) or NL-SAS (may be okay up to several GB/s change rate))
- [CDC](https://docs.yugabyte.com/stable/architecture/docdb-replication/cdc-logical-replication/) or [xCluster](https://docs.yugabyte.com/stable/architecture/docdb-replication/async-replication/). Both have several limitations, but those disadvantages are very well understood and the trade-offs are clear. With hardware snapshots, you probably have no clue what you're doing

Most users won't have this problem, but those who do should almost certainly stay away from hardware snapshots and consider one of the supported solutions. They can also stick with the "simple" snapshot & export approach as long as they keep adding severs and EF-Series arrays - with six entry-level arrays and 18 YDB servers, one may be able to handle twice as much as with three and nine, respectively.

Finally, in RF3 only one server needs to push snapshot data out to S3.

## Recommendations for EF-Series

NetApp currently doesn't have a YugabyteDB-specific solution brief or recommendations. 

These are mine (and common sense):

- Use **multiple entry-level arrays (EF300 or EF50) across three racks** rather than one mid-range array with three or five RAID groups (although you can, 3 x 8 disks in R0 or R10 fits nicely in one controller shelf)
- Use **either RAID 0 (since YugabyteDB recommends that) or RAID 10** - both are fine choices. If using RAID 10, you can pick a RAID segment size, e.g. 32KiB for smaller strips. Let's say you have want 8 disks in RAID 10 (giving you 4 disks worth of "usable") - for this you'd get 9 disks (1 hot spare) and pick a 256KiB stripe size for Yugabyte DB with large IO, 32 KiB when small I/O dominates. You get the same capacity regardless, so try several with a representative workload before deploying
- **Direct attach your servers or Kubernetes workers to EF-Series** - just make sure you configure EF-Series boxes with enough host-facing ports
- **Use Ansible, Terraform, TopoLV or SANtricity CSI** (pick one that works for you) to manage storage presentation. If you don't use an HA CSI driver, make sure disk re-assignment workflows are exercised and confirmed to work. You can leave 10-20 GB of unallocated space and create 10 2GiB LUNs for this automation testing
- All EF-Series arrays have NVMe in the controller shelf, but you can **add inexpensive expansion shelves (NL-SAS HDD) for export of snapshots** to RAID 6 (NL-SAS) volumes

![YDB with hybrid EF-Series](/assets/images/yugabytedb-netapp-eseries-01-ef-series-hybrid.png)

- **Capacity sizing: size the way YugabyteDB recommends**. EF-Series doesn't compress or thin-provision
- **OS and application disks: use any supported client** - Hyper-V, bare metal, Linux KVM, vSphere. [Proxmox](/2026/07/17/proxmox-pve-vm-templates-eseries-nfs.html) also works

You don't have to do much to significantly enhance the resilience, availability and data protection without sacrificing performance of your YugabyteDB cluster.

Things you should never do with YDB:

- Use multiple servers with a single disk array or storage cluster
- Rollback hardware snapshots
- Take hardware snapshots on hot YDB disks
- Try to integrate distributed snapshots with hardware snapshots

## Deploy

- Docker or bare metal: provision storage with Terraform, Ansible or other. RTFM [here](https://docs.yugabyte.com/stable/quick-start/docker/)
- Kubernetes: use Helm or [Yugabyte K8s Operator](https://github.com/yugabyte/yugabyte-k8s-operator). Don't forget to specify the right Storage Class. See TFM [here](https://docs.yugabyte.com/stable/quick-start/kubernetes/) for more

Sample data are [here](https://docs.yugabyte.com/stable/develop/sample-data/retail-analytics/) although you can insert some junk into a new database manually.

Backup and restore are not storage-dependent, so we don't need to "test" them as far as fancy storage "features" are concerned.

## Conclusion

I haven't used YugabyteDB much beyond several basic tests, but it's clear to me the pattern is identical to my other database-related posts from 2026: multiple, entry-level EF-Series models in three or five racks is the way to go for users who don't want to fiddle with local JBODs.

EF-Series delivers what Yugabyte users need and gives you the shortest and most reliable path to protected storage you can get from NetApp.

As an aside: one can tell from the YugabyteDB documentation - the YugabyteDB people understand storage *very well*, unlike some other NOSQL companies whose documentation sometimes contains complete nonsense from which it is obvious their employees haven't seen a storage array in their entire life.
