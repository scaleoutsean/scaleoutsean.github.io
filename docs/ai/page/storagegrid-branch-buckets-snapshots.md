# Using S3 bucket snapshots in StorageGRID 12

How to use NetApp StorageGRID bucket snapshots in version 12

## WTF are branch buckets?

Those are S3 bucket snapshots on StorageGRID 12.

I wrote about them in [the post called StorageGRID Branch Buckets and Read Cache ](/2025/10/09/storagegrid-s3-cache-branch-buckets.html).

They seem useful to me, but apart from this link above no one has found this feature interesting enough to blog about it since the thing appeared several months ago, so I'll probably have to repeat this at the top of every related post for a few more months.

## Workflow

In Tenant management interface, find a bucket you want to snapshot and go to the `Branches` tab (on the very right).

By default you won't have any pre-created snapshot buckets. Click on the `Create branch bucket` button. As an example, I store StorageGRID logs in this bucket. Now I want to create and use a read-only snapshot bucket for log analysis.

![Branches tab](/assets/images/storagegrid_branch-bucket_01.png)

Pick a name for your bucket snapshot and use `Read-only` if you don't need to write to it.

![Bucket snapshot option](/assets/images/storagegrid_branch-bucket_02.png)

Notice that you may pick **any** point in time. That's unlike with (say) ONTAP or E-Series snapshots where you can only pick one of the existing snapshots. These point-in-time's are "on demand". Pick any point from the past since versioning was enabled.

Proceed to create a snapshot bucket.

You may need to wait a minute and then you may use your S3 client to access the new snapshot bucket (assuming you could access the original or "base" bucket with those keys and didn't change access policies on the snapshot).

### Snapshot buckets vs. materialized views

Because you don't have to create a snapshot bucket unless you need it, you don't *need* a "snapshot schedule" either. You can look back as far as your object versions allow and create a snapshot on demand.

Let's say you suddenly need to produce a point-in-time view of an S3-backed database as of 60 and 30 days ago. You create two bucket snapshots at that point in time and that's all. Now you can easily compare tables from these databases.

But remember that modern S3-backed databases may have this feature built in:

```sql
CREATE VIEW <viewName> AS SELECT * FROM <tableName>
SHOW VIEWS
DESCRIBE [EXTENDED] <viewName>
```

In other words, they can create on-demand point-in-time "views" and that works *without* StorageGRID bucket snapshots.

This is the native approach for modern databases and tools that keep tables on S3. If it's available, use it over StorageGRID bucket snapshots.

If it's not available or if you have unstructured data, you can create snapshots/clones using StorageGRID and from them generate your own "views" for arbitrary points in time.

## Sizing

Do we always wait "a minute" for a StorageGRID bucket snapshot to be created? Or is the answer "it depends"? What to expect?

It may seem unbelievable, but that is not documented.

I could give you my "home lab" examples, but these are resources-starved VMs so I won't do that. "Contact your NetApp representative", as they say.

Bucket snapshots are reasonably fast for my own liking.

## Bucket Snapshot API methods

There's a new method to create (`PUT`) and list bucket snapshots.

I don't like the fact that there's no `DELETE` for snapshot buckets. They are *different enough* and there are already `PUT` and `GET` methods for bucket snapshots, so why would `DELETE` be special and inconsistent to warrant wasting user's time required to figure this out?

To delete a snapshot bucket, you have to call generic `DELETE` API endpoint (the same one you'd use for "normal" buckets). I don't understand what justifies this confusing "saving". If the idea was to not add unnecessary, new API endpoints, they could have reused existing "create bucket" (or "container", as they're called in the StorageGRID Swagger) method and add a nested JSON key related to snapshots and collapse everything into the existing bucket/container API methods.

Despite this poor API design, the API isn't hard to use and, as I've mentioned earlier, the process of creating bucket snapshots is not too slow either.

Note that read-only bucket snapshots can't have their content changed (doh!), which means you don't have to delete stuff from them before you nuke them. That is great considering how much faster that kind of bucket deletion is and that analytics workflows may require quick iteration. If you don't have to write to a snapshot bucket, use read-only snapshot buckets. Even if you need to create a dedicated "temp" bucket where you can have an agressive audo-delete ILM policy, it's worth the trouble because you can iterate faster.

Read-write snapshot buckets are "Copy-on-Write", so to speak, as they create new (current) object versions of modified keys (objects).

If I remember correctly, with appropriate permissions, you can also delete objects (which only makes them non-current in the base bucket), but double check TFM if this concerns you.

I'm mostly interested in read-only use snapshot buckets:

- No need to worry about base bucket or controlling write access permissions on snapshot bucket
- No need to empty (i.e. wait for this to happen) a snapshot bucket before you can delete it
- Better for [read-only caching](/2025/10/09/storagegrid-s3-cache-branch-buckets.html#s3-cache) (knowing that nothing in the bucket can *possibly* change)
- Enables rapid iteration because deleting read-only snapshot buckets is very fast

Another thing to mind is: for both read-only and read-write, versioning has to be enabled on base bucket. 

For the former, to "split" the snapshot from its base bucket at that *exact* "point in time" you choose. For the latter, to "Copy-on-Write" i.e. redirect new writes to new objects/keys. Deletes may hit the (versioned) base bucket as I've said above. Also, S3 Object Lock can be enabled if you need it to protect data in base buckets when snapshots are read-write.

Read-write buckets are of course also useful. For example, if you want to keep results co-located with data. Otherwise, if you need to write to S3 but not permanently persist such writes, create and use dedicated temp/scratch buckets where many users can share one (just remember to fine-tune permissions on those shared buckets, if that's important to you). You can also write to a RAM- or filesystem-backed S3 caching layer (Vinyl Cache, VersityGW backed by BeeGFS, etc.).

## Next steps

I blogged about use cases for bucket snapshots in the first post about StorageGIRD S3 bucket snapshots, so here I'll just make an "update" and say that, having used snapshot buckets, I think they're very suitable for analytics, Big Data, and AI use cases. 

Now I'm even more confident that [my architecture pattern for StorageGRID and E-Series](/2026/01/16/santricity-eseries-datalake-storage.html) is a good one (despite what you may have read (elsewhere) on the Internet):

- Snapshot a bucket
- Use Terraform to stand up an S3 RAM-based cache layer and E-Series temp/scratch volumes (BeeGFS or single-host filesystems)
- Work on S3 data while using BeeGFS or direct-attached E-Series disks for scratch/temp when RAM isn't enough or we need to create temporary or intermediate files
- Write results back to S3 (different bucket, e.g. the base bucket, if the snapshot bucket is read-only)

A diagram from that post:

![S3/E-Series Data processing pattern](/assets/images/eseries-datalake-storage-layout-03.png)

The entire stack can be deployed in minutes with readily available automation tools for StorageGRID and E-Series:

- StorageGRID API (or Ansible modules)
- SANtricity client libraries for Go (Terraform, Kubernetes), PowerShell or Python (or Ansible, if you like to wait)

Results are easy to upload to S3 using standard clients and workflows, while both data, but also entire E-Series volumes, can be "parked" on S3 when E-Series NVMe storage is running out of capacity

- Upload your work (results) back to S3: `rclone`, `boto3` or any S3 client, stand-alone or in a workflow
  - BeeGFS-on-E-Series users can also use BeeGFS Remote Storage feature
- Backup: [clone](/2026/01/25/eseries-santricity-ps-snapshots-clones.html) E-Series volume or volumes, present to a "backup worker" container, and upload to a bucket using any S3 client
  - Restore: use the same process in reverse, at several GB/s

E-Series gives you fast performance for work-in-progress, and S3 is the source of truth. You can create S3 bucket snapshots from **any** point-in-time because of bucket versioning.

As recently as two months ago these scenarios seemed complicated and laborious, but with SANtricity automation tools and libraries I built in recent weeks there's almost no need to *develop* API integrations - just automate and orchestrate using tools you already have (example: Terraform). Seamless data flows between S3 and E-Series are now well within our grasp. 

I'll blog more about this as I create related demonstrations. (**DONE**, see [the Kompromise post here](/2026/06/27/kompromise-pipeline-netapp-storagegrid-eseries-vgw.html).)

Also done (2026/09): COSI Snapshot Leases can be obtained from `sg-cosi` and used from any location that can reach S3 API endpoint. See [this post](/2026/09/18/storagegrid-s3-cosi-snapshot-leases.html).
