# The elusive data mobility for tables with OpenSharing, StorageGRID, E-Series

Copy or migrate datalake tables from/to remote object stores

## Introduction

As we all know, [S3 solved main challenges related to data sharing](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html) in hybrid multi-cloud environments years ago.

Reverse proxying and caching made sharing for blobs easy in the 2010s. Consider "backup to S3", for example. That was solved 10 years ago (the movement of blobs to/from AWS S3) and incrementally improved since (now not just blobs, but even backup tables live on S3).

What's left to solve? Not *that* much. 

![Data sharing in Hybrid Multi-Cloud](/assets/images/medallion-architecture-dont-manage-storage.png)

The other day someone mentioned "the challenge of sharing structured data in hybrid cloud".

What challenge???

There's a bunch of options for a variety of use cases. Check out the recent post on [Alluxio](/2026/09/04/alluxio-ai-analytics-storagegrid-hybrid-cloud.html) - you literally don't have to do anything but allow access from the cloud and then it's like "copy & paste" in  Windows Explorer.

But, they say, what if I need to copy or migrate tables to the cloud? 

![Uhm, yeah](/assets/images/opensharing-data-mobility-00-uhm-yeah.png)

Well, query that table from Trino/Spark and write the result to a table at the location where you need a copy. Even in this case, Alluxio can help make that faster.

Then there is [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) for structured and unstructured sharing, especially good for E-Series (which it turns into a modern data sharing platforms at zero cost) and StorageGRID, which is more likely to have a catalog server attached to it, so perhaps less in need of OpenSharing. It doesn't do caching or proxying - it not prescriptive, it just makes sharing simpler, more standardized and uniform, and more secure.

Since "query A, write to B" is "solved", I'll just focus on the second approach, where OpenSharing plays a role.

## Data mobility for Iceberg and other lakehouse tables

There are reasons why you may want to copy or "move" (i.e. copy table to target and delete it from the source). Examples:

- Scenario A: we have data on-premises and don't want to cache it, we just want a copy in the cloud
- Scenario B: we need data from Lakehouse Number One attached to StorageGRID in Europe copied to Lakehouse Number Two in the US
- Scenario C: we need to copy table data to Edge locations where we want to read it using OpenSharing API

Lakehouse One has a table with audit logs. That's the one from the recent [Lakekeeper](/2026/09/03/lakekeeper-iceberg-compression-snapshots.html) post. 

![Lakehouse One](/assets/images/opensharing-data-mobility-01-lakehouse-one.png)

There's another lakehouse, Lakehouse Two, in the US. It has some existing, but unrelated, content. (Note that, because my OpenSharing server isn't an Iceberg catalog, but can serve Iceberg tables, we could make read-sharing at the remote site work without a lakehouse at the target.)

![Lakehouse Two](/assets/images/opensharing-data-mobility-02-lakehouse-two.png)

```sh
$ mc ls s3/example
[2026-09-09 01:44:31 CST]     0B remote/     # Datalake Two
[2026-09-09 01:44:31 CST]     0B warehouse/  # Datalake One
```

How to solve the elusive data mobility problem for my Iceberg table `audit_log`?  We simply copy it over.

![Lakehouse table migration](/assets/images/opensharing-data-mobility-03-lakehouse-table-migration.png)

There are some before/after steps which every lakehouse administrator knows how to do. The rest is `mc mirror` (copy data from source to target).

After copying, the copied table is registered in Lakehouse Two and available for use.

![Lakehouse Two with table migration complete](/assets/images/opensharing-data-mobility-04-lakehouse-table-migration-done.png)

(**NOTE:** both of these datalakes use the same StorageGRID bucket, `s3://example`, but the first uses `s3://example/warehouse` and the second uses `s3://example/remote`. They *are* separate. I used the same bucket so that I don't have to create a new bucket, ACLs and the rest of it.)

If Lakehouse Two is persistent (e.g. OneLake or whatever), you won't even need OpenSharing, like in the case above (you can suck it in directly from OneLake using On-premises Data Gateway; I've blogged about that - see see screenshots in the first post linked at the top).

If the target site doesn't have a lakehouse, use a temporary Iceberg REST endpoint, shut it down, edit OpenSharing configuration (to include the new table) and [our OpenSharing server](/2026/09/07/opensharing-iceberg-netapp-eseries-storagegrid.html) will pick up the changes without a restart because of hot reload. 

Edge sites may find OpenSharing useful for read-sharing of replicated Iceberg tables to clients that just need read access. My OpenSharing server runs on ARM64, too, so you can run it and Versity S3 Gateway on a small 3-node Kubernetes cluster of Raspberry Pi devices attached (iSCSI) to an E-Series E4060 with petabytes of capacity.

Finally, realize that one could simply add the remote bucket to Lakehouse One and *easily* copy a table from one bucket to a bucket on another object store managed by the same datalake using Trino.

## Conclusion

Data mobility of datalake tables is another solved problem. We can securely and easily migrate (and/or replicate) and pre-cache datalake tables in any direction at wire speed.

If different object stores can be managed by one catalog, it is trivial. If not, we can replicate to another, temporary (and use OpenSharing after that) or permanent.

Before, (well, some do that even today!) storage-focused shops would keep database tables on a volume (LUN, share, datastore, etc.), and replicate "storage" around.

Now, we have tools for free management of open format tables and just need to copy table files and apply several small configuration changes. And that's *the hard way*, mind you! The easy way is you stream changes to multiple locations (it's usually cheap enough, including S3 capacity) to avoid having to copy/migrate, or you use CDC or some other, even easier approaches.

There are details (like replication of table snapshots, which my script v1 did not do, but v2 (screenshot in Appendix A) does) and minor Iceberg limitations (like statistics on partitioned tables or something along those lines) that we need to pay attention to, but none of that makes me even willing to consider recommending the old way. 

The modern way is vastly better and in most cases - see that diagram at the top - we will *not need* to copy stuff around because our data won't be stuck on block devices. We can easily access tables from anywhere natively, or with OpenSharing, or simply over S3/HTTPS.

## Appendix A: Datalake table migration

In the case that screenshot with migration script isn't clear enough:

```sh
$ ./migrate.sh

Source table location: s3://example/warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f
Target table location: s3://example/remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb
Source metadata file:  s3://example/warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/00001-01a065f4-6a9b-7a80-9b8f-f2d2df25d4a0.gz.metadata.json
Current snapshot id:   5859332520718683361
Ensure the source table demo.audit_log is quiesced (no writers) before proceeding.
Press Enter to continue...
Copying 5 objects...
  ok warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/data/00000-0-4483b496-1308-4a03-a95f-d1ff741d3031.parquet -> remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/data/00000-0-4483b496-1308-4a03-a95f-d1ff741d3031.parquet (5713 bytes)
  ok warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/00000-01a065f4-62f7-7513-b4d0-065b2cc9e396.gz.metadata.json -> remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/00000-01a065f4-62f7-7513-b4d0-065b2cc9e396.gz.metadata.json (415 bytes)
  ok warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/00001-01a065f4-6a9b-7a80-9b8f-f2d2df25d4a0.gz.metadata.json -> remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/00001-01a065f4-6a9b-7a80-9b8f-f2d2df25d4a0.gz.metadata.json (690 bytes)
  ok warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/4483b496-1308-4a03-a95f-d1ff741d3031-m0.avro -> remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/4483b496-1308-4a03-a95f-d1ff741d3031-m0.avro (5148 bytes)
  ok warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/snap-5859332520718683361-0-4483b496-1308-4a03-a95f-d1ff741d3031.avro -> remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/snap-5859332520718683361-0-4483b496-1308-4a03-a95f-d1ff741d3031.avro (1797 bytes)
  rewrote manifest remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/4483b496-1308-4a03-a95f-d1ff741d3031-m0.avro
  rewrote manifest list remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/snap-5859332520718683361-0-4483b496-1308-4a03-a95f-d1ff741d3031.avro
  rewrote metadata s3://example/remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb/metadata/00001-01a065f4-6a9b-7a80-9b8f-f2d2df25d4a0.gz.metadata.json
Registered demo.audit_log in the target catalog.
Next: update the OpenSharing server ./config/shares.yaml to point at the new bucket and restart it.
Example: set storageLocation to s3://example/remote/87a9b36c-4fdc-416d-a1c4-64b43a2626eb
Keep the source table and its data files until the target table has been verified.

```

If your script can handle Iceberg table snapshots, incremental "refresh" style updates become possible.

![Snapshot replication](/assets/images/opensharing-data-mobility-05-lakehouse-table-migration-snapshot.png)

And not only that: rather than copying the entire difference from "previous" snapshot, I can resync to any newer than previous.

## Appendix B: Demo

It's the same thing you see in these screenshots which already highlight the key parts - no need to watch it if you've read the post...

- [The elusive data mobility challenge with datalake tables on StorageGRID](https://rumble.com/v7f9sbo-the-elusive-data-mobility-challenge-with-datalake-tables-on-storagegrid.html) - 1m58s
