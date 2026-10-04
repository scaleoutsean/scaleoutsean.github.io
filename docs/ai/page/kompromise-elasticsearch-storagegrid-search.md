# Feed StorageGRID 12 data to Elasticsearch 9 indexes with Kompromise

Consume Kompromise queues to populate Elasticsearch indexes

## Introduction

StorageGRID has two integrations with Elasticsearch. I blogged about them [here](/2023/07/20/storagegrid-and-elaticsearches.html): there's Search and there's (indirect, via Logstash, but it's part of ELK stack) Logging. 

This post is about Search (not Logging). Let's see if we can integrate StorageGRID 12.1 and Elasticsearch 9 better using Kompromise.

This was already demonstrated in an early prototype of Kompromise called "Go NATS!" last year, but this is a more detailed version that are unlikely to change by the time I share Kompromise Webhook binaries.

## From Kompromise to Elasticsearch

As I wrote in the recent post on [Kompromise Webhooks](/2026/09/27/kompromise-webhook-notifications-storagegrid.html#kompromise-webhook-for-storagegrid), there are Simple and Enhanced. 

Here's an example of an index entry created from Enhanced Notifications in Kompromise:

![Kompromise in Elasticsearch](/assets/images/kompromise-storagegrid-search-indexing-01-elasticsearch-9.png)

There are details such as date, tags, metadata and the source IP that created the object.

Simple Notifications will have the usual (bare) details - nothing from `kompromise.*` keys above. Simple Notifications are fine if you search for things like object names, prefixes and dates, but you probably realize that this is useless for most practical purposes (especially anything AI-related).

So:

- At the most basic level, you'd use Enhanced (aka "Rich") as in the screenshot above. At least, you can search by tags and metadata which you can't with "some other integrations"
- Sometimes, you'd just skip this approach altogether and use something that applies to this time and age, such as vector embeddings and full text search

We can do basic (Simple or Rich), we can do lexical, we can do vectors. And we can do all three kinds for the same bucket if we need to, as shown here (the `assumed` bucket).

![Types of Elasticsearch indexes created by Kompromise workers](/assets/images/kompromise-storagegrid-search-indexing-03-simple-rich-lexical-vectors.png)

## Search with Simple/Rich notifications 

For basic search (that only stores data from Simple or Rich notifications), you don't have to do anything extra.

Pick 'em up from NATS topics and submit to Elasticsearch. 

With Kompromise, *indexing* works better than StorageGRID's own Search Integration in 12.1 and that is reasonable, given that we use more resources to do it - Kompromise should better do it better.

> With Kompromise, Simple notifications are persisted in NATS queues and batched to Elasticsearch, so we consume IOPS on NATS (3x, at that) but spare Elasticsearch (also RF3, if you do it right) from being bombarded with 100 byte requests every few seconds - this is *much* better for Elasticsearch, especially if you pay for it! Rich Kompromise notifications may be lost in rare circumstances (heavy load on Kompromise or StorageGRID) but, as I explained elsewhere, if those are critical you can use Simple and create own jobs for reliable Rich that work off Simple.

*Search* also works better with Kompromise if you use Rich Notifications (where tags, metadata are included).

Here's an example of default StorageGRID Search Integration entry (bucket versioning is off, unlike in the Kompromise Rich example above):

![Standard StorageGRID search](/assets/images/storagegrid-elasticsearch-search-03.png)

Let's just say this won't get your AI initiatives very far.

## Full text search with Kompromise

We need to read all object content and store it in `body` or similar index field.

This is impractical for large documents which need to be broken down in shorter segments. For e-commerce product descriptions and even small to medium documents, it's fine.

I used the content from free books ([Alice in Wonderland](https://www.gutenberg.org/cache/epub/11/pg11-images.html#chap08) and [Moby Dick](https://www.gutenberg.org/cache/epub/2701/pg2701-images.html#link2HCH0022)) in my early testing. There were just a couple of KB each, so I did not need to prefetch them to AIS cache.

Document conversion and OCR may be required before one can even begin, but we used text files (markdown, CSV, and similar formats would also work) since data preparation is an extra step (although some commercial tools have it included to provide end-to-end, fully self-contained, workflows).

![Full text search in Elasticsearch 9](/assets/images/kompromise-storagegrid-search-indexing-04-elasticsearch-lexical.png)

S3 access isn't a problem because this works out of the tenant's Kubernetes namespace (which maps 1:1 to the bucket name on StorageGRID). Our "worker" needs `GET` access to read the object from the notification message.

## Vector search with Kompromise

Here, too, we must read full *content* of the object. 

The way embeddings usually work is we "cut" an object in pieces ("chunks") and create embeddings for each piece. Then we store one or more embeddings under the S3 object's key in Elasticsearch.

Imagine that's a movie: 30 frames per second times 1,800 seconds. That's over 50,000 images.

We could probably run image analysis on just one compute node, but that would be *much* slower than if we did it on two or 12 Kubernetes workers. 

That's where step 3A and the integrated AIS come in play: we can pre-fetch to cache (3A) and then compute. Or just compute (3B) using own client that connects to NATs or a curated function if we deal with lightweight content.

![Kompromise and embeddings in Elasticsearch 9](/assets/images/kompromise-beta.png)

Here's a screenshot from the same "Alice in Wonderland" document, but with embeddings. This is the `assume-vectors` index.

![Kompromise and embeddings in Elasticsearch 9](/assets/images/kompromise-storagegrid-search-indexing-02-elasticsearch-9-vectors.png)

Unlike with Full Text Search, here I have a bunch of smaller chunks, each of which has a fraction of overall text, and a vector field for semantic search.

The query shows just one chunk, which is the chunk where "ten soldiers" are mentioned.

### Community vs. commercial Elasticsearch

The free edition can't run own pipelines with vectors. This is why I create them on the client. 

The commercial edition can run vectorization on Elasticsearch, using their own curated models which are very good.

Likewise, when searching using the free edition, I can't search embeddings for words. I compute queries into vectors on the client, and search for best-matching vectors on Elasticsearch. It works, but it's less convenient. 

OpenSearch, on the other hand, is "free" but always has bugs and ends up frustrating me much more than the limitations in Elasticsearch'es Community Edition.

## Search results

With lexical search, we search for terms, words or combinations. For an example, `"ten soldiers" AND queen`. This does appear in the document we have, so that document gets found.

With embeddings, we look for stuff that may have matches in multiple chunks. We can search with vectorized questions, but in the free version that doesn't work well because - as mentioned above - we're not talking to a chatbot, you're comparing vectors and shouldn't be sending question-style queries.

To demonstrate this, the question was:

> "Which of the two groups, gardeners or soldiers, was more numerous?" 

"Query as a a question" doesn't work well because "which" doesn't help with semantic comparison, so results are likely to suck more than if we tried "there were five soldiers" (as "five" is at least a number).

```sh
1. score=0.8049 assumed/alice01.txt#10
   d she put them into a large flower-pot that stood near. The three soldiers wandered about for a minute or two, looking for them, and then quietly marched off after the others.  “Are their heads off?” ...
2. score=0.7954 assumed/alice.txt#3
   es, to—” At this moment Five, who had been anxiously looking across the garden, called out “The Queen! The Queen!” and the three gardeners instantly threw themselves flat upon their faces. There was a...
```

Actually, this isn't bad, because chunk #3 is in fact one of two chunks that have the information we're looking for (the other is #4, but there are other relevant chunks). But you don't get a chatbot answer in vector search like this - you get chunks that best match the vectors you sent.

There are different techniques to identify better results (other than simple ranking), but normally we'd work with agents or LLMs which take care of that; there's no need to try and turn this into a chatbot experience. That comes later.

We can build one or both index types (lexical and semantic) or even something hybrid, depending what we need to achieve.

If you have the both kinds of indexes, you can do fancy searches or have an agent or LLM do them for you. So, our work on getting StorageGRID contents to agents and AIs has been completed!

- Documents get uploaded to a bucket
- Kompromise processes notifications and workers - that possibly require extra steps for conversion, extraction, normalization - store documents in Elasticsearch or OpenSearch (focus of this post, although we could use other indexers)
- Other steps: if documents are deleted, we need to decide what to do. Kompromise subjects wil have delete events, but you may or may not want to delete index documents - that depends on use case
- We need to make sure permissions on each index are open only to a tenant that has ownership of the bucket. But that's harder than it looks, because who would that be? The tenant administrator for the bucket? One of 100 tenant accounts? Who exactly?

## Agents and LLMs

I'll leave this for another post related to Kompromise, but [I've written about this before and created some examples](/2026/08/28/datalake-agentic-rag-netapp-storagegrid.html) with indexes on S3. This is the same thing except indexes are stored on block devices (e.g EF-Series) and tiered to S3 only later.

But let's see what we expect to happen later:
- We have one or two indexes
- We have an chatbot or agent that can use these in *many* different ways
- Now we, or agents that work with agents that have access to these indexes, can ask questions, not just enter words or throw vectors at it

YMMV, as they say. Earlier, we've established there were ten soldiers. At least, that's what I thought.

Example answer from approach A: 

> [answer]
> The story mentions ten soldiers carrying clubs in passages [3] and [4], which describe them as part of a procession. While passages [1] and [2] reference three soldiers, these are likely part of the same group of ten, as the narrative context suggests a cohesive scene. Therefore, the total number of soldiers in the story is **ten**.  

Example answer from approach B:

> [answer]
> The story mentions three soldiers in passages [3] and [4], and ten soldiers in passage [5]. These groups are distinct, as the ten soldiers are part of a procession during the Queen's arrival, while the three soldiers are part of the court. Thus, the total number of soldiers is **3 + 10 = 13**.  

That's intriguing! 

But it's also not our problem: we are in charge of making sure they have data to work with.

Chunk details (`[3]` and `[4]`) and document URIs is what you'd get as URLs to the sources, as is common in RAG or similar applications.

## Comparison vs...

Kompromise isn't a product and if it gets published it will be distributed as (binary) freeware, so it shouldn't be compared with shipping or supported products: you can't get support for it and you'd probably build a similar tool if you wanted to use it in production in an enterprise environment. 

But since the topic is of interest to StorageGRID users in general, I'll share what I currently know because it's hard to find StorageGRID-specific information elsewhere.

### What else is out there

As of now, your choices in terms of near real-time integration are limited and you have to build own integrations.

Maybe [Komprise](https://komprise.com) can receive StorageGRID notifications, but their documentation isn't detailed (or publicly available), so it's hard to tell.

There are data migration products such as Datadobi, which support StorageGRID. I think they may subscribe to Notifications as that would be helpful in migrations, but I don't know if they do it and how their indexes look like (I'm sure they have them, but do they store information AI agents need, or does it need to be re-created by the user?). Kompromise could be used in migrations, but it primarily targets event-driven unstructured data processing use cases.

Then there's [Starfish Software](/2026/08/27/starfish-software-beegfs.html) with explicit StorageGRID support. It appears they use bucket scans as well. Positioning-wise, it's a cross-vendor storage management tool with support for storage-related jobs and workflows, so similar to the Komprise (it can drive workflows) and Datadobi (it can be used in migrations).

Among the more recent solutions, two-three days ago Blocks & Files mentioned NetApp partnered with [Diskover](https://www.blocksandfiles.com/file/2026/10/01/netapp-discovers-and-resells-diskover-rot-technology/5300499). I don't know if Diskover works with StorageGRID, but presumably it does and I would expect it to work the same way Kompromise does. But it could be doing full re-scans rather than use Notifications.

Diskover has many valuable plugins that come useful in those pre-indexing steps I mentioned earlier, while Kompromise doesn't have any and can't parse complex document formats. Although I could develop those or use existing open source tools like I did in [this post](/2023/08/01/fscrawler-filesystem-analytics-elasticsearch.html), that's out of scope for Kompromise.

Finally, earlier this week NetApp also announced next version of AIDE would support StorageGRID. As of October 4, the software is not yet available (based on the Web site it seems its GA is planned for October 23), but there are documentation pages like [this page](https://docs.netapp.com/us-en/ai-data-engine/get-started/architecture.html#data-flow) and [this page](https://docs.netapp.com/us-en/ai-data-engine/data-sources/connect-data-source.html#add-a-data-source) which indicate that indexes are built using bucket scans (ObjectListV2 every time you update an index), so it may not be directly comparable to Kompromise as far as the "how indexes are updated" question is concerned.

How other AIDE things compare, I do not know, but it seems this month's release is more of a "[storage capacity monitoring and management](https://docs.netapp.com/us-en/ai-data-engine/investigate/understand-dashboard.html)" tool - much closer to Starfish Software than Kompromise.

NetApp has a product called Cloud Sync, which is a data replication tool which may (that part is unclear to me) receive S3 event notifications, but doesn't do any processing except synchronization (copying).

## Full re-scan vs notifications

But indeed, if we have TBs of data that's already in a bucket, how to index it?
- Please do not worry. It's just one CLI command with AWS CLI or [MinIO client](https://github.com/scaleoutsean/minio-client). You can output the result to a file and loop through the list to get the data you need. See [this example for finding "version hogs"](/2026/07/13/storagegrid-version-monitoring-pruning.html). One interesting pattern is I've seen users with NAS background who expect "the storage admin" to do these things for them, but that's not how it should work on S3. Who's going to do something for the user whose files are encrypted client-side, or who creates ephemeral COSI bucket claims? "Storage admin" has no clue what chatbot or Elasticsearch instance may be linking to the stuff in your bucket. Clearly, management issues should be fixed in the workflows, not by "storage admin" actions.
- If you need to create embeddings or a lexical index, that may be worth automating separately using own tool
- If you use a brute-force scanner to scan buckets for "storage administration", and another tool to do it for AI, that becomes very expensive quickly

But wait, why even use Notifications when we can simply re-index buckets?
- You can't reindex an entire bucket once every minute, but you can receive Notifications of new objects *every second* and business may not be able to wait until next weekend
- Brute-force listing doesn't work at scale. Imagine re-listing all objects a cross hundreds of TB sized buckets... I don't know if that's what others do or not, but I do know that's unlikely to work well
- "Scanning performance" mostly doesn't matter here. ListObjectsV2 is a metadata query that costs the S3 client almost nothing, but consumes non-insignificant resources the object store (which is why AWS charges for such API calls). Most users should throttle these rather than try to do "scan faster". They'll be constrained by object storage performance, not by client performance.
- Bottom line is, there's no substitute for Notifications. *It doesn't matter how you get 'em*, Webhook or Kafka, every consumer and every software gets the same information at the same time. Kompromise Webhooks won't have less information than any other software, so I expect Notifications to remain one of the least dirty shirts in the closet. You can supplement Notifications with full re-scan once a week to pick objects you missed and maybe reconcile with Elasticsearch (Kompromise can do that as well, just read the list from a file rather than from NATS and the rest is identical), but that should be an exception, not a pattern
- You'd also have to re-scan all Elasticsearch indexes, not just buckets. Why? Because you probably want to remove stale objects from indexes, not just add new ones. Or maybe mark stale index entries as deleted, if you have to keep indexes in sync

As far as getting full list (and building a search index from that content) of a bucket is concerned, we already have a free solution for that: [Snapshot Leases](/2026/09/18/storagegrid-s3-cosi-snapshot-leases.html) with `sg-cosi`:
- Create a Snapshot Lease using my StorageGRID COSI driver. Let's say you create a 48 hour snapshot lease
- That gives you 48 hours (this can be extended up to 7 days) to access the bucket from anywhere it's accessible to S3 clients by using ephemeral S3 keys generated by `sg-cosi`
- The Snapshot Lease function in my `sg-cosi` was created for bucket backup workflows, but you can use it to run ListObjectsV2 for 36-hours non-stop if you'd like (not the greatest idea because such scanning competes with ILM and all workloads - you should throttle it or have limits on the StorageGRID load balancer to control this behavior)
- Then, we can send those results to any, or several, places to perform index maintenance

That's available and easy to use, but it should be used only in exceptional situations, not as the main method to keep track of your S3 data. It can't scale well and it's very taxing on object store.

I see a lot of AI-related examples that are based on full bucket scans of buckets with few to few thousand images. "You just rescan". That's fine, you just rescan.

But why would you have a bucket with just a few thousand images? It must be a consequence of copying. You have the same 7,500 images in another bucket, together with 750 thousand other images, but rather than organizing that data you copy objects to an app-specific bucket *for every application*. This doesn't seem right. It does make full rescan possible.

Kompromise, as a reference stack for data pipelines, does not aim for prescriptive integrations because it's supposed to be able to work with anything on either input (matter of implementation; I hope to add Versity S3 Gateway with E-Series later) or output (matter of user's choice) side.

Notifications are resource-cheap, while data churning is expensive and with Kompromise I can do both and it scales out. After processing, data can be stored on StorageGRID - a scale-out platform itself - and indexes on any scale out database (such as Elasticsearch), so Kompromise plays well here - it focuses on specific areas where it can add value. It doesn't make you change or fragment your workflows - it just makes existing work better.

The only hard-coded dependency is NATS, which is there for a reason. I could support two event stores ("never say never"), but NATS is integrated and doesn't require the user to come up with own NATS cluster. Additionally, any qualified user (with requirements matching what Kompromise does) will likely need AIS as well, and NATS and AIS have the same requirements storage-wise - there are no unnecessary overheads.

## Conclusion

In 2026, keeping your data out of reach for agents is almost as bad as keeping it on tapes.

Kompromise makes StorageGRID-parked data more valuable because with it, you and your agents can actually find your stuff. Kompromise Webhooks let you plugin StorageGRID in existing workflows, send data to existing databases and easily add new targets (e.g. databases specialized not in search, but in [agentic AI](/2026/09/21/yugabytedb-netapp-storage-eseries.html#why-yugabytedb), so that you don't have to use cascading replication where there's no need for it).

I mention this in almost every Kompromise post: the Webhook is the only new part here, while the rest is off the shelf software, but I perhaps shouldn't, because much of commercial software is not any better in that regard.

Today's post doesn't include AIS examples (I showed them in the previous posts, though), but it does show that simply with the Webhook and per-tenant NATS queues, I can easily deliver any kind of search integration we need - including heavy media processing steps, if any - without spending days on reinventing the wheel.

While the scripts to used to populate Elasticsearch indexes aren't part of Kompromise, I may add their key parts to the repo where Kompromise Webhook is expected to appear when ready. These are out of scope (downstream from Kompromise) and everyone does things slightly differently, so I'd rather let everyone consume StorageGRID events the way they prefer - existing compute workflows and existing databases/indexes.
