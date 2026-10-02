# Using Kompromise Webhook for automated S3 log indexing

Kompromise Webhook, NATS, Quickwit and CNPG

## Introduction

Kompromise is my personal reference/demo stack for S3-related stuff - mostly NetApp StorageGRID and Versity S3 Gateawy, as you can tell from blog archives.

I haven't finished it yet, but I'm testing what seems like an acceptable beta version and it's looking good. 

- New [Kompromise Webhook for StorageGRID](/2026/09/27/kompromise-webhook-notifications-storagegrid.html) is my own component. It has most unknowns and has required most changes.
- This week I [evaluated it with ETL pipeline](/2026/09/29/kompromise-storagegrid-search-processing.html) for video content and it looks like it will work well for object metadata-related processing (such as creating vector embeddings of tags or object content)

Full text search usually focuses on content indexing, although lexical or semantic search can get help from object metadata and tags.

I've blogged here about Elasticsearch (and Splunk) enough times, so log indexing and search isn't an exciting detour on way to agentic use cases. But I got asked and thought maybe it's a chance to do another, slightly more modern "take" on the topic.

Armed with Kompromise, I got to work.

## Log pipeline

There are many ways to do these and there's nothing I can add as far as getting from logs to search results is concerned.

But on the other hand, you can search for doing this with StorageGRID and the number of posts you'll find on that topic is probably closer to zero than five.

Since I have several new toys, most importantly Kompromise Webhooks, I thought to try something new.

First, there was no reason to do another Elasticsearch post - I have half a dozen - so I picked another (Quickwit).

Second, I figured it'd be nice to use Kompromise here. What that gives me is the ability to configure new Webhook for StorageGRID bucket notifications, so that logs can be uploaded and trigger automated processing. I could have forced the issue further and use AIS for faster log processing (maybe), but I demoed "full stack Kompromise" in yesterday's post, so it doesn't appear in this.

Third, because I use Kompromise Webhooks, I do need NATS. Because I need NATS, I again need to recommend [three disk arrays](/2026/06/21/nats-server-on-netapp-eseries.html). And just like in that post, I do need two arrays for CNPG (Cloud-Native PostgreSQL), which is incidentally mentioned in a diagram from that post as well.

![NATS configuration with multiple arrays](/assets/images/nats_eseries_14_3-rack-5-node-nats.png)

Where's that CPNG requirement coming from? 

It's not a hard requirement, but HA for PostgreSQL is required if you want to scale out Quickwit to more than one indexer: at that point you can't have multiple writers to the same metastore object on S3, so you need *some* sort of HA and backup plan for that PostgreSQL database.

Now, this index-to-s3 ask is interesting because I can securely submit logs (from the public cloud or remote offices, for example) *to a StorageGRID bucket* and have them processed and ingested to Quickwit without *any* intervention. Without automation, I don't think anyone would want to manually ingest hundreds of log files every day.

And the whole thing doesn't cost me almost any extra work, because Kompromise has almost everything:
- Webhook
- HA NATS
- Pipeline
- (Optional) For large logs, AIS (S3 read cache) would be helpfulI did not leverage AIS from Kompromise to make the PoC and this post less complicated

![Kompromise for Quickwit](/assets/images/kompromise-quickwit-storagegrid-00.png)

The green-shaded areas are per-tenant (namespaced) resources that provide user segregation.

- (1) New logs land in `s3://incoming/<app-or-other-prefix>`.
- (2) StorageGRID sends notification to Kompromise Webhook
- (3) Kompromise pipeline - where I added a new "submitter" worker for this - sends `ObjectCreated` notifications to a 3rd party SQS server for Quickwit to poll. Quickwit polls it, finds the log file's URI, downloads the file (it has GET access to s3://incoming), indexes the log and appends to index in s3://indexes. It also has to update its own metadata, which can be on S3 as well but only for one indexer. Normally, you'd have more than one and therefore need a highly-available PostgreSQL and that's another strong case for EF-Series here

Since CPNG runs *really well* with E-Series, and [continuous backup to S3 works well too](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html), there's no better NetApp storage array to serve that database and we already have an object store to upload backups to.

In the minimal setup, you could have one of everything (including NATS servers, PostgreSQL), and no HA. Most people won't do that. They'll want HA for both NATS and PostgreSQL and one *can't* properly protect NATS with less than three arrays across three racks. If you already have three small arrays, using CPNG to replicate the small PostgreSQL DB adds no cost.

NATS won't have a lot of data, since those SNS notifications for objects are tiny. PostgreSQL won't either, but Quickwit might need a TB of "scratch" disk space per indexer because it has to periodically "defrag" indexes on S3. So when you add it all up, between HA and performance (both random and sequential), it's not a trivial group of workloads. That's why there aren't many "free replacements" for Splunk and Elastic.

### The role of Kompromise functions

I didn't use functions in this demo (see about AIS functions in [yesterday's post](/2026/09/29/kompromise-storagegrid-search-processing.html#out-of-box-functions)), but this is not a bad use case for functions if you don't have established pipelines.

What I do above is send JSONL to `s3://incoming/<index-name>/`. But what often happens is you don't get JSONL, you first get `something.log` which you need to process before it can be ingested. Normally you'll do this on your own or use one of the popular log converters (I have one for StorageGRID logs [here](/2026/09/20/sgac-storagegrid-audit-v030.html)) to run them from a pipeline.

Kompromise could create a pipeline for this: something.log-to-something.jsonl.

For example, in this PoC I uploaded StorageGRID logs processed with my tool (SGAC). But if I wanted to make it more convenient, I'd create a function that has my tool and just send `something.log` to `s3://incoming/<index-name>` and have Kompromise take care of conversion before passing notification downstream.

## Walk-through

New batch of JSONL is uploaded to `s3://incoming/<index-name>`.

![StorageGRID incoming bucket](/assets/images/kompromise-quickwit-storagegrid-04-storagegrid-incoming-bucket.png)

Kompromise kicks off the pipeline, forwards the notification to SQS server queue, and Quickwit polls that server periodically to find out what's new.

When it sees a new object is ready, it downloads the object and adds to index in `s3://indexes/<index-name>`. An additional index file was saved as a new object. (I've mentioned above, there's also a periodic "defrag" that downloads from S3, consolidates and writes back to S3, which is where Quickwit local disks get busy so you may want to keep those on EF-Series CSI on RAID 10.)

![StorageGRID bucket with indexes](/assets/images/kompromise-quickwit-storagegrid-05-storagegrid-indexes-bucket.png)

And then you can find data using both structured (fields, if your schema picked them from JSONL) or free form lexical search (on original JSON documents' body content).

![StorageGRID full text log search](/assets/images/kompromise-quickwit-storagegrid-02-storagegrid-audit-access-log-fts.png)

Since SGAC (my syslog-to-Parquet converter for StorageGRID) already converts to structured logs, full text search is more interesting. We can look for random words and it's fast.

![StorageGRID full text log search for error](/assets/images/kompromise-quickwit-storagegrid-06-storagegrid-fts-lexical-body-search.png)

In this PoC, I tried two kinds of logs:
- (1) Raw "syslog-wrapped" with minimal unpacking, aka "semi-structured". This a mix of StorageGRID **audit, access and management** logs (all are forwarded to same syslog)
- (2) and (3) Structured logs (two indexes: one for audit, another for access, created from raw syslog in (1) using SGAC which now supports access log as well)

![StorageGRID log types](/assets/images/kompromise-quickwit-storagegrid-08-storagegrid-logs-on-storagegrid.png) 

## Conclusion

Enterprise standard for this is Elasticsearch. You get [ILM, snapshots to S3](/2023/11/30/elasticsearch-ilm-netapp-eseries.html) and more. Since I've blogged about that before, I picked another valid approach that let me test Kompromise Webhooks.

One of the benefits is now I have a Kompromise submitter pipeline as well, so future integrations with applications that consume S3 feeds - raw or processed - will be even easier.

I do know most applications can get their own notifications directly from StorageGRID, but that's not the point: to get own notifications *reliably*, you need something like NATS or Kafka and neither is a very fun software to manage (although NATS is much better). Kompromise sets up the *entire* stack - Webhook notifications, pipelines, functions, NATS and AIS.
 
I could have demonstrated Quickwit with a random single VM, manually uploaded logs and S3, but that's not usable for business users. It also wouldn't show how to do it right with StorageGRID, which was an important consideration in my context. 

Quickwit at any non-trivial scale needs a reliable PostgreSQL service, amplifying synergy with EF-Series and Kompromise.
