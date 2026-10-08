# Kompromise, SGII, StorageGRID and Instaclustr OpenSearch

Worry-free notifications-based global search with Komproise, SGII, StorageGRID and Instaclustr OpenSearch

## Introduction

This post builds upon other work, mostly [Kompromise](/2026/10/03/kompromise-elasticsearch-storagegrid-search.html) and `sg-cosi`, especially with the recent addition of [Snapshot Leases](/2026/09/18/storagegrid-s3-cosi-snapshot-leases.html) in the latter.

In that linked Kompromise post you can see how it receives, enriches and forwards StorageGRID notifications to Elasticsearch.

This post is another take on that, with the addition of SGII, a new tool that builds on Snapshot Leases from [`sg-cosi`](https://github.com/scaleoutsean/sg-cosi/).

Components:

- Kompromise Webhook server
- `sg-cosi` Snapshot Leases exposed through SGII CLI
- Instaclustr-managed OpenSearch infrastructure

## What this does

Kompromise still does the same thing as in the linked Kompromise post.

This diagram shows a simplified Kompromise stack without any object processing - it just enriches StorageGRID notifications and forwards to OpenSearch.

The new thing is SGII, a CLI tool that automates comparison of StorageGRID [bucket snapshots](/2026/06/13/storagegrid-sg-cosi-branch-snapshots.html).

And finally, that OpenSearch on the right is a Instaclustr-managed OpenSearch cluster in my public cloud account.

![Kompromise, SGII and Instaclustr OpenSearch](/assets/images/storagegrid-sg-cosi-sgii-ic-opensearch-00.png)

## About Instaclustr

Best way to understand what Instaclustr does is to visit [Instaclustr](https://www.instaclustr.com/platform/hosting-options/) and give it a try.

My take: Instaclustr frees you from managing key Open Source infrastructure for modern stacks: Kafka, OpenSearch, Valkey, ClickHouse, Spark and more.

I'm a good showcase for this post, because in my previous post I couldn't set up OpenSearch (again!), so this week I went to Instaclustr and now a small three-node OpenSearch 3.6 cluster is running in my own cloud account.

I can manage it both from infrastructure (since it's my cloud account) and service (OpenSearch configuration) side, but I can also get additional services from Instaclustr if I need some help.

That's exactly where it adds value in this solution:
- You're 15 minutes away from using OpenSearch deployed in accordance with best practices and multi-cloud-ready (I really like that - it's *optimized for hybrid cloud* because you don't have to understand hyperscaler infrastructure that much to use it from on-premises). No hyperscaler-related annoyances is a big plus for me!
- If you don't want to run or manage Kompromise (which requires NATS, if you want very reliable notifications), you can use Kompromise Lite (which sends to Kafka) and Instaclustr can do that for you, too.
- Scale out, scale "in", scale up, scale down require just two-three clicks in the Instaclustr Web UI.

That's why users have them manage thousands of these nodes. It just works.

**Minutes to going live. Hours to business results. Zero vendor risk.**

## What's the role of SGII again?

The role of SGII is what I briefly hinted at in the previous Kompromise post linked at the top when I talked about backup with `sg-cosi`: `sg-cosi` can create Snapshot Leases, which are generic non-Kubernetes specific *read-only snapshots* of StorageGRID buckets.

SGII is a CLI that uses the same code to create bucket snapshots without COSI. 

Fun fact: `sg-cosi` supports "between"-style bucket snapshots. That means:

- I can take a bucket snapshot today at noon
- Tomorrow nooon, I can take a "between" bucket snapshot for last 24 hours
- Then I look at that snapshot bucket and what do I see? I see *what was deleted and added i last 24 hours*

SGII automates this and spits out a database table. 

That's why it's called SGII: StorageGRID incremental inventory.

So, while you use Kompromise (or send StorageGRID notifications directly to Instaclustr Kafka, which sends them to Instaclustr OpenSearch) to get instant AI-ready pipelines going, you now can also use SGII to verify the stuff's been inventoried as expected, and do that **without full bucket enumeration**.

Example:
- Kompromise runs 24x7, sending notifications to OpenSearch
- Every Saturday noon, you take a snapshot for the period "between last Saturday noon and now" using SGII and get a table with all changes. Because it's incremental, it takes four hours rather than 45 hours and you can have 7 rather than 10 StorageGRID nodes because you don't beat on StorageGRID metadata service like a maniac.
- With this table, you can run random checks against OpenSearch (sample 1% of the new and deleted objects to confirm all `PASS`), or do a full check of all incremental changes to see if your OpenSearch is up to date and if anything was missed. If you want, you can also fix any misses by re-touching objects (Kompromise should later get an option to automate these fixes for you).

## What does all that mean?

SGII adds an ability to take advantage of notifications without being concerned about "missing some data".

Do not settle for an inferior approach (periodic re-sync) if your business needs near real-time!

If you want to use SGII as your primary synchronization method and notifications as supplemental/advisory, you simply schedule SGII for periodic re-synchronization to avoid full bucket enumeration. Please do not worry: it doesn't do anything that StorageGRID 12.1 doesn't do.

Instaclustr provides similar peace of mind - if you're not sure you can handle OpenSearch or Kafka, Instaclustr is just a click away.

I had a similar diagram last year when Kompromise predecessor "Go NATS!" was shared:

![Kompromise, SGII and Instaclustr OpenSearch](/assets/images/storagegrid-sg-cosi-sgii-ic-opensearch-01.png)

## What can I do with this?

Instead of spending months POC-ing DIY stacks or betting big on mega projects, you can start forwarding your StorageGRID notifications to Instaclustr-manged OpenSearch in your own hyperscaler account in minutes.

You can run included plugins (anomaly detection, machine learning, embeddings and more) at no extra cost for enabling these features.

![OpenSearch Kibana in Instaclustr](/assets/images/storagegrid-sg-cosi-sgii-ic-opensearch-02-kibana.png)

Next, we fire up Kompromise and let it populate indexes with data. (These screenshots are coming soon!)

Within minutes, your bucket metadata will be AI-ready. New content from StorageGRID takes mere seconds to surface to AI agents and applications.

If you later want to check or reconcile bucket and index state, schedule periodic SGII runs with bucket and index sampling.

If your Kompromise instance goes down and you're not sure if you missed some notifications, run SGII and push own notifications to Kompromise to update OpenSearch index.

You can also use the SGII output to delete stale data from OpenSearch (especially needed if you run ILM that deletes stuff from buckets).

If you need LAN-latency search locally, you can stand up own OpenSearch replicas in each site. If you want to manage those on your own, it won't cost you anything. Get 'em [for free](https://opensearch.org/) and deploy 'em in minutes. 

You can replicate from Instaclustr OpenSearch to on-prem (Instaclustr as "Single Source of Truth"), or push Kompromise notifications to two destinations (Instaclustr OpenSearch and on-premises cluster).

StorageGRID can span sites and [Starburst](https://starburst.io/) can search any and all of them. Availability, replication, search performance, federated search... All solved!

If you want to repatriate the workflow with data, simply export data and redirect Kompromise to OpenSearch on-premises. Zero lock-in due to open data format and no API changes required anywhere!

And if you want to do more in the cloud with Instaclustr: vector search, Kafka, MCP, caching... It's all minutes away in your Instaclustr console.

### Other use cases for SGII

The `sg-cosi` post on Snapshot Leases was about the main use case: S3 bucket backup. That's one of "other" use cases for SGII:

- SGII lets you perform incremental backups fully without `sg-cosi`
- Every SGII run builds inventory tables, so you keep track of what happened in every step - not just "retain your `rclone` logs, but you don't have to do anything special to keep record of what **inputs** `rclone` received
- SGII uses the open Parquet format that can be consumed by a bunch of applications. It's meant to be stored on S3 and can be used for reporting

SGII does not delete bucket snapshots that it takes. The main reason is maybe you want to hang on them for compliance or whatever other reason.

The second reason is that StorageGRID now supports 20,000 buckets per tenant, so the risk of hitting that limit isn't very high and even at 2 snapshots per bucket day, it will take a while for TSHTF. You'll notice it before there's 1,000 of outdated snapshot buckets.

But also: if you use SGII to copy data to a vault and hang onto those tables (which you can also copy to a vault), you can nuke the read-only snapshot buckets: checksums, keys, object IDs and everything else is in the tables. SGII will list stale snapshots for you - if you don't want them, just loop-delete them with a script or from Ansible. 

It's a zero-cost, modern interface to a workflow that used to be a challenge, require 20x more resources and leave you with data locked behind a proprietary API. 

## Take-aways

I've always had confidence that `sg-cosi`, Kompromise and Instaclustr all add plenty of value to StorageGRID, which is why I had a similar post last year. But I didn't have `sg-cosi`.

Now, that approach is even better, although I do notice "not everyone around me gets it" - that's fine.

 `sg-cosi` has supported StorageGRID snapshots for weeks and it seems some people on the Internet do get it (I see the downloads are more than random bot traffic).

SGII (StorageGRID incremental inventory) takes `sg-cosi` Snapshot Leases and packages them into a stand-alone tool.

StorageGRID notifications (and Kompromise) are now more useful because you no longer *must* put all eggs into the notifications basket (although it should be the bigger basket) - you can have incremental re-synchronization with SGII as your primary approach or use SGII as your tool for recovery from unplanned downtime in local NATS or Kafka or cloud connectivity.

If you're comfortable with notifications and prefer them, you even don't need to use Kompromise or SGII: just forward StorageGRID notifications to Instaclustr-managed Kafka clusters and data will make it to OpenSearch.

In any of these approaches, it takes hours to start benefitting from results. You can scale up and out, scale across sites, but also get in and out any time, together with your data and unchanged applications/clients. 

At this time, there's **no better NetApp solution for making meta-data AI-ready across sites or hybrid clouds**.

I plan another (demo-focused) post on SGII before I finalize the code and documentation and share a binary in the `sg-cosi` repository.

The sharing of data was [discussed in many earlier posts](/2026/09/08/opensharing-data-mobility-netapp-eseries-storagegrid.html) - basically, you open StorageGRID S3 API gateway's TCP/443 to your cloud compute instances. Another StorageGRID solution that takes 30 minutes to implement.

![StorageGRID in Hybrid Cloud](/assets/images/medallion-architecture-dont-manage-storage.png)
