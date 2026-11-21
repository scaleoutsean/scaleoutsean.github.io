# Use SGII to for easy periodic indexing in Elasticsearch

This post showcases efficient bucket enumeration and content indexing from StorageGRID using SGII and Elasticsearch. Unlike notifications-driven Kompromise, this approach is for point-in-time indexes.

## Introduction 

Yesterday I realized I accidentally uploaded SHA checksum files instead of binaries to [SGII Releases for v0.1.3](https://github.com/scaleoutsean/sg-cosi/releases/tag/sgii-v0.1.3).

I corrected that mistake, so SGII binaries for that version are available for download. While doing that, I realized I should probably do another SGII post about a simple indexing workflow.

[The post about SGII with OpenSearch](/2026/10/08/kompromise-storagegrid-instaclustr-opensearch.html) shows the same thing in a hybrid cloud setup, with StorageGRID on-premises and Instaclustr-managed OpenSearch in your public cloud account.

This post shows a similar scenario, with the following differences:
- Only SGII (not Kompromise) is used. This means we update Elasticsearch on a schedule or on-demand.
- We use on-premises Elasticsearch 9. This means Elasticsearch is managed by you or your Elasticsearch partner.

![SGII with Elasticsearch](/assets/images/sgii-elasticsearch-00-diagram.png)

There's another post about [near real-time indexing of SG in Elasticsearch using Kompromise](/2026/10/03/kompromise-elasticsearch-storagegrid-search.html), but that is a different use case although SGII can be used for periodic reconcilliation (e.g. weekly) if any discrepancies are discovered.

## How it works

It works the same way as the previous post, and as SGII has always worked.

SGII creates a read-only bucket snapshot and a list of all objects. 

The first time a full list of all bucket objects is created, so it may take a long time (if we assume just 1,000 per second, for example, it'd take 1,000 seconds to scan a bucket with 1 million objects)

Since we work with object storage, we can keep the inventory table in a bucket owned by the tenant manager, for example. Others may be given read access if needed.

Next, we run a Python script to upload to Elasticsearch. And that is all! These two steps can be executed to run on a schedule.

![SGII-created index in Elasticsearch](/assets/images/sgii-elasticsearch-02-sgii-esgee-index.png)

You can see above there's a `sgii-<bucket-name>` index. Just one.

But I figured people may prefer two indexes per bucket:
- Current
- Historic

So the Python script actually creates two new indexes in Elasticsearch (per bucket). In this case:
- sgii-current-esgee
- sgii-historic-esgee

Current, with just one entry per each S3 key.

![SGII-created current index in Elasticsearch](/assets/images/sgii-elasticsearch-03-sgii-esgee-index-current.png)

And historic. Notice it has more objects, and some keys (due to object versions) appear more than once:

![SGII-created current index in Elasticsearch](/assets/images/sgii-elasticsearch-04-sgii-esgee-index-historic.png)

This shows why two indexes per bucket is better, although you could, just like in the very first Kibana screenshot, have just one. With two indexes per bucket:

- If you want to see what was before, you can search the historic index.
- If you want to do some AI stuff (like [RAG for current StorageGRID documentation](/2026/11/09/sgii-for-agentic-hybrid-cloud-use-cases.html)), you may not want to see old document. You want current documents only and use the current index.

So, the Python demo script now creates two indexes per bucket. 

There's nothing in the SGII inventory tables that prevents us from creating just one index (one current, as shown earlier, or one historic) or even one per each SGII snapshot.

## Refresh

This is an example of how these cycles work.

First I upload a baseline snapshot data to Elasticsearch (this is a full inventory) and get this back:

```text
indexed history bucket=esgee index=sgii-history-esgee documents=4
updated current bucket=esgee index=sgii-current-esgee operations=4
indexed history documents=4 current operations=4 buckets=1
```

The first incremental snapshot may be even empty, so no changes will happen.

```text
indexed history documents=0 current operations=0 buckets=0
```

The second incremental snapshot may contain a few changes.

```text
indexed history bucket=esgee index=sgii-history-esgee documents=4
updated current bucket=esgee index=sgii-current-esgee operations=3
indexed history documents=4 current operations=3 buckets=1
```

The current index will have what SGII thinks is current bucket inventory. The historic will have everything it's seen, so it is expected to be larger as it can't shrink.

![Multiple indexes](/assets/images/sgii-elasticsearch-05-sgii-esgee-indexes.png)

SGII thinks there are four items in the bucket, which is correct.

```sh
$ mc ls pepsi/esgee
[2026-11-19 17:20:31 CST]  56MiB STANDARD 1776.jpeg
[2026-11-19 17:42:06 CST]  11KiB STANDARD flat-doco.md
[2026-11-19 22:49:31 CST] 323KiB STANDARD it-worker.jpeg
[2026-11-19 17:42:06 CST] 414KiB STANDARD kafka-getting-started.pdf
```

The historic index shows I should see eight *unless* I've deleted them with ILM or manually or haven't updated Elasticsearch for a while.

```sh
$ mc ls --versions pepsi/esgee | wc -l
8
```

Eight is correct.

Currency is maintained with incremental SGII snapshots which drive deletions of removed or stale objects from Elasticsearch current index for the bucket. Notice "3 Deleted" on the right:

![SGII maintains currency](/assets/images/sgii-elasticsearch-06-sgii-esgee-indexe-current-deleted.png)

## Management and other considerations

SGII needs API access to StorageGRID's tenant administration API to take (or delete) a snapshot. In order to create bucket listing, it also needs to be able to list objects, get tags, and more. 

That means that, in order to centrally manage indexing for a tenant, you need to use an account with the tenant Root role. 

If you want non-admin tenant groups to each manage buckets they own, you need a two-step workflow:
- To create and delete snapshots: tenant admin or other user with tenant root access permission. Despite what the documentation says, "Manage all buckets" permission isn't enough in v12.1 [as far as I can tell](https://github.com/NetAppDocs/storagegrid/issues/99) 
- To read object names, versions, tags: bucket owner to create a bucket policy for himself or designated SGII user

How does one control access to these Elasticsearch indexes? 

Elasticsearch can control access on index, document and even field level - see [the Elasticsearch documentation](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level) for the details. You can use federated authentication on both sides (StorageGRID and Elasticsearch). SGII needs API access to tenant management API (for snapshots) and S3 keys that allow it to edit bucket policy to read objects.

It is possible to make this workflow even more granular and use STS AssumeRole so that SGII can create snaphots and then obtain access for different groups, so that each group gets access to different objects from the same snapshot bucket, and creates different indexes on Elasticsearch. This makes it possible to create any number of "custom" (content, authorization, access control) indexes from the same base bucket. StorageGRID 12.1 supports 100,000 buckets per grid and 20,000 [per tenant](https://docs.netapp.com/us-en/storagegrid-121/release-notes/whats-new.html#maximum-number-of-buckets), so having several tenants with hundreds of buckets isn't a problem. 

SGII's incremental snapshot and scan are faster on a smaller bucket, so right-sizing may be highly desirable in some scenarios: easier access control management on S3 and search index, faster scans, faster turnaround (and more frequent updates). Elsewhere, that may not work as well. With SGII:
- Unlike with traditional indexing solutions for S3 that don't use StorageGRID snapshots, SGII lets you run scheduled hourly updates of hundreds of buckets and that costs almost nothing in terms of resources.
- Unlike with traditional NAS, using hundreds of related right-sized buckets isn't a problem [because I can snapshot 200 buckets at the exact same point in time with milisecond precision](/2026/01/30/storagegrid-branch-buckets-snapshots.html). I don't have to snapshot them all at once. I just need to snapshot them at any time and specify the same Point-in-Time in order to get a "group" snapshot. We're not talking about snapshotting a datalake, but snapshotting a bunch of Web shop product catalogs, product pictures, and product videos for a consistent search of your entire site. For a shop with 100 product categories, that can be 300 buckets. You can't do that with NAS or block unless Consistency Group supports hundreds of volumes (they [usually don't](/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html), but check the documentation for your own product to find if its maximums).

### SGII vs integrated stacks

Compared to a packaged solution, these steps are slightly more involved, but they also create no barrier between you and your data. Since StorageGRID now supports very many buckets, a way to keep things simple is to use smaller buckets.

How about integrating enrichment, embeddings and other Elasticsearch features?

Like in the previous posts (linked near the top), you can create elaborate workflows, not just "upload this list to create an index". Having the list that's inexpensive to update is the key. The rest is just several extra functions: create embeddings and NER (or set up pipelines and let Elasticsearch create them), etc.

## What's good about this

- SGII gathers more data than built-in Elasticsearch integration in StorageGRID, making it a better choice if you can use either live or scheduled indexing and care more about what's indexed then when.
- SGII scans buckets incrementally, unlike other on-demand scans that don't use StorageGRID bucket snapshots. If you have 500 million objects and add/change 10,000 objects a day, that will still take just seconds to scan.
- SGII lets us avoid indexing "live" buckets or creating live updates, which may be preferred for some use cases. If you need live index updates, you can use Kompromise Lite (or own integration for notifications). This approach is for point-in-time use cases.
- The historic index in Elasticsearch makes it possible to quickly find what existed when. If you want to retain such records forever, you can. But you can also delete older Elasticserach index records based on `last_modified` and your StorageGRID data with an ILM policy for non-current and current versions.
- The historic bucket also keeps track all object versions that SGII has found. If you don't delete old versions and don't delete the corresponding index entries either, you'll always find them in the historic index and also on StorageGRID. You can also use Elasticsearch (not StorageGRID) ILM to move that historic index to StorageGRID (searchable S3 snapshots) and make it economic to hang onto both historic AI data (current and non-current versions in a StorageGRID bucket) and indexes (historic indexes of such buckets).

Unlike in the Instaclustr post, we don't create embeddings here, although we could. That is because my objective is to highlight on-demand capability that is also very efficient due to StorageGRID snapshots and SGII's use of them. With embeddings, we'd have to have yet another index per bucket, which would make it harder to see what's unique about this approach.

## Conclusion

I'm quite happy how SGII turned out: there's still nothing like it out there, I have a bunch of nice use cases for it, and it's free.

We can improve this basic demo by consistently managing StorageGRID ILM, SGII snapshots, and Elasticsearch indexes, so that versions are snapshot, scanned, indexed and removed (from both StorageGRID and Elasticsearch) in a way that doesn't confuse users.

We can also modify the Python script and Elasticsearch settings to keep historic indexes on a lower-cost tier (e.g. on [HDD tier](/2026/11/06/topo-lvm-netapp-santricity-e-series.html#how) of a hybrid EF50 system) or use searchable S3 snapshots for all historic indexes. The Python script will be posted to the SGII examples directory in the `sg-cosi` repo.

An example of an even more advanced approach: we could use SGII for one snapshot per index: just take a point-in-time baseline snapshot and create one, "current" index named after the snapshot, so we have a snapshot called `sgii-esgee-v1.2-nov20` and identically named (one-time, therefore "current" as of creation) index on Elasticsearch for 1-1 mapping. We retain non-current object versions on SG and keep the Elasticsearch index around as long as we need to. That would be like a "production release" of an index with grounding available (i.e. older versions don't disappear) as long as needed for business or compliance.
