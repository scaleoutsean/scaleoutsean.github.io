# Postgres, pgvector, E-Series and Instaclustr

PostgresSQL's pgvector extension, Instaclustr and NetApp E-Series

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

- [Introduction](#introduction)
- [pgvector](#pgvector)
- [Instaclustr](#instaclustr)
- [NetApp E-Series](#netapp-e-series)
- [Wait, what does pgvector actually *do* and is it any good?](#wait-what-does-pgvector-actually-do-and-is-it-any-good)
- [pgvector notes](#pgvector-notes)
- [Conclusion](#conclusion)

## Introduction

In recent years, due to their growing popularity, there's been a number of new vector databases. 

Why now? Because they have become useful in AI (RAG and more) and analytics. 

Why is that? Because keywords are no longer enough and the amount of data this takes is not just one small table and its index.

Says [Wikipedia](https://en.wikipedia.org/wiki/Vector_database):

> A vector database management system (VDBMS) or simply vector database or vector store is a database that can store vectors (fixed-length lists of numbers) along with other data items.

But what about vectors in AI? Well, that's one of use cases. Also from Wikipedia:

> Text documents describing the domain of interest are collected and for each document a feature vector is computed, typically using a deep learning network, and stored in a vector database. 

And it's not just text. We can create vectors for images, sounds and videos.

## pgvector

As it often happens, incumbent database projects and vendors would prefer to create an add-on or extension rather than tell users to run another database.

And most users would prefer that too, if at all possible. Same skills, same backup and restore procedures, and mostly the same best practices. Sounds good!

How can we use it? Well, obviously, we can [download](https://github.com/pgvector/pgvector) and use it - it's OSS, just like PostgresSQL itself. That's what I did for this post.

But there are all sorts of users. 

Some run PostgreSQL in the cloud, others on-premises. Some want to use it in the cloud but not run it, some can do everything by themselves but need help with storage performance, etc. 

From my perspective I'd like to highlight Instaclustr PostgreSQL service and, among NetApp storage arrays, E-Series. 

## Instaclustr

Instaclustr provides a fully managed, enterprise-grade service for PostgreSQL hosted on AWS, Azure, GCP, or on-premises.

As a platform, Instaclustr focuses on open source solutions and adds value with support, consulting and enterprise-grade services that can be deployed in the cloud and even on-premises.

- 24x7 Expert Support Included
- Enterprise-Grade Deployments
- 99.99% Uptime SLAs, 
- Latency SLAs
- SOC 2 Certified 

![Instaclustr Offerings](/assets/images/postgres-pgvector-00.png)

As we can see here, it's not just Postgres - it's who's who (or "what's what?") of OSS for AI and analytics. Many users can use Instaclustr's services to manage their entire data persisting-stack.

You can view Instaclustr's PostgreSQL-related documentation [here](https://www.instaclustr.com/support/documentation/postgresql/getting-started-with-postgresql/getting-started-with-postgres-creating-a-postgres-cluster/).

Does Instaclustr support pgvector? Yes. It's not called out (yet) in [PostgreSQL Add-Ons](https://www.instaclustr.com/support/documentation/postgresql-add-ons/getting-started-with-pgbouncer/) because it's not used by most users, but trusted community extensions can be installed to Instaclustr-managed PostgreSQL. 

Instaclustr's technical blog recently blogged about pgvector in [How To Improve Your LLM Accuracy and Performance With PGVector and PostgreSQL®: Introduction to Embeddings and the Role of PGVector](https://www.instaclustr.com/blog/how-to-improve-your-llm-accuracy-and-performance-with-pgvector-and-postgresql-introduction-to-embeddings-and-the-role-of-pgvector/) as this extension is gaining popularity among its customers. 

If you want a fully managed Postgres with pgvector, consider Instaclustr. Instaclustr's service is comparable to manged database services offered by hyperscalers, but based on 100% Open Source Software: you can take a backup on Instaclustr and restore it to your self-managed OSS application anytime you want. 

Cloud-based users can start small (single database), while for on-premises it's cost effective to combine different services or several databases at once.

On-premises Instaclustr-managed PostgreSQL could use E-Series as described [here](/2022/11/11/netapp-spot-instaclustr-eseries.html), but while I'd recommend that it's not mandatory or even officially recommended - any standard block storage will do.

To try Instaclustr online, you may sign up for a free trial [here](https://console2.instaclustr.com/signup). 

## NetApp E-Series

I think E-Series is the best NetApp array for vector databases. Why, I explained many times. You can see one of the recent tries in the article about [Milvus](/2022/07/07/milvus-with-solidfire-e-series.html) which is one of the more popular specialized vector databases. 

Some things I'd want from my vector database - and this includes PostgreSQL with pgvector:

- [Excellent insert performance](/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html) - or "high write performance" in storage terms
- Excellent select performance - or "high read performance", which is also important, but secondary to insert performance which may be what keeps GPU servers waiting
- Basic snapshot features including [Consistency Groups](/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html) which I'd use before upgrades
- A way to backup and restore - either by replicating to another DB and dumping to S3 on target system (which PostgresSQL can do) or by dumping backups and archiving WAL logs to S3, which we can easily do with [MinIO on NL-SAS disk pools](/2022/10/21/minio-performance-netapp-e-series.html). Of course, the old fashioned "dump to disk" would work as well, but S3 (with Object Locking, for example) creates a backup on another system (StorageGRID or MinIO VM//container) which uses the same storage system but yet represent a separate security domain (assuming E-Series management network is properly isolated and access secured).

There's always more, but these are the main things.

With E-Series EF300 or EF600 you can get 5-40 GB/s per second - sufficient for a number of production and replica instances and S3 backup repos, all in one competitively priced package.

## Wait, what does pgvector actually *do* and is it any good?

I'm not the best person to explain, so I encourage you to search the Internet for better explanations than the one I'm about to give. 

To be honest, I've read a bunch of those too, and found most of them very confusing, which is why I will attempt to provide a short explanation myself.

To expand on what I copy-pasted from Wikipedia earlier: a string or image or sound can be described with multi-dimensional vectors. That means videos as well, of course, because they can be broken into frames, and audio transcribed or otherwise broken into smaller units.

So we could have "`orange=[3,2,7]`" and "`apple=[1,2,4]`" and then we could actually compare apples and oranges. 

That sounds silly but when you think about it, it's better to know that at least the middle value 2 matches and the distance between the rest is as it is, than having to compare the strings `apple` and `orange` (not equal, and that's it!).

To me that's enough to understand what vector embeddings do and why they are useful.

The other thing is: how do we compute these values? As I am not trying to come up with a novel way to do it, or write new apps - that's not our problem. Various tools (e.g. AI models) can create them and insert them into our pgvector-enabled database. A vector database may have this built in, so it could be done in one go. 

```sql
SELECT vector
INTO @v
FROM kb
WHERE filename = "/data/kbs/kb01232.txt";
```

As I understand it, with pgvector it's less fancy - embeddings must be computed externally - but also requires no new DBA skills and workflows: we calculate these externally and perform inserts using regular PSQL statements.

pgvector stores these "embeddings", can create comparisons, averages, and such. 

How does pgvector fare against specialized vector databases? To make it simple - or maybe even to oversimplify: it's not as good, but if you don't run a big AI shop, you probably *don't need* a specialized vector database. 

Or, even if you do, if you have no full time DB admins you may be happy to go with PostgresSQL and pgvector, despite some of its shortcomings. 

## pgvector notes

I suggest to read the technical blog post by Instaclustr, it's surely more "professional". But I have a different (unprofessional? OK, I'll take it!) take so I'll make some notes as well.

First, I have some content that I want to search. 

Second, I need to create embeddings. As I'm doing this for search (say, KB/FAQ), I use a pre-trained general purpose model for semantic search to create embeddings for documents.

Both the content and embeddings are stored in a database, which I named `garbage`. You could have an entire question as an entry. For other purposes maybe you'd do sentences rather than entire KBs.

- 'The database is having IO errors'
- 'The IOs are timing out'
- 'The database performance is sluggish'
- 'The indexing is slowing down inserts'
- 'The vacuuming sucks!'
- 'The multipathing configuration is suboptimal'
- 'It took a long time to get to that storage facility'

Now we can calculate things like distances between an entry and the average or a custom string (such as vectorized search string by a shopping site user looking for a product).

```raw
                       content                       |      distance
-----------------------------------------------------+--------------------
 The database performance is sluggish                | 0.7150044911917102
 The indexing is slowing down inserts                | 0.781554391690017
 The database is having IO errors                    | 0.7900150705662531
 It took a long time to get to that storage facility | 0.8147491722044202
 The IOs are timing out                              | 0.8669605473646411
 The vacuuming sucks!                                | 0.9034211303536858
 The multipathing configuration is suboptimal        | 0.9572276322647403
(7 rows)

```

From this we see that depending on *how* we calculate distance (there are half a dozen ways, in pgvector), we may get different results.

And for certain data and use cases certain ways of indexing and calculating distance, average, etc. may be more suitable than others.

These are some of the subtleties that influence whether users pick pgvector or something else. This blog post isn't about developing apps that use embeddings (and I couldn't write a good one even if I wanted).

The length of each embedding depends on you - I still don't know why someone would select 200 instead of 400 and when - but vector data looks like this (384 numbers in this particular example, shortened for brevity):

```sh
garbage=# SELECT AVG(embedding) FROM documents;
[0.051372103,-0.014272122,0.016947407,0.025603464... ]
```

Here's a screenshot of the embedding for the 7th document; it's still incomplete but it's basically large vector. Sometimes it's nicer to see the actual screenshot.

![Embedding for this example](/assets/images/postgres-pgvector-01.png)

Each vector usually takes up more space than the text itself. These seven short sentences with embeddings and IDs resulted in a 16 kB table.

```raw
    table_name    | pg_size_pretty
------------------+----------------
 pgbench_accounts | 13 MB
 documents        | 16 kB
 pgbench_branches | 8192 bytes
 pgbench_tellers  | 8192 bytes
 items            | 8192 bytes
 pgbench_history  | 0 bytes
(6 rows)
```

That makes sense as each vector takes approximately (4 * dimensions) bytes of storage. 384 dimensions per vector = 1.5 kB per document just for the embeddings.

For 100 million vectors we'd need around 150 GB, and this isn't too hard to consume. As mentioned in the [Milvus post](/2022/07/07/milvus-with-solidfire-e-series.html), it's easy to consume 500 MB/s from just one database. PostgreSQL with pgvector works differently, so it may consume less or more, but it's also likely that you'd have more than just one database. Run 10 projects and suddenly you have 5 GB/s in INSERTs alone.

Earlier we had 7 documents sorted by embeddings' values. But how do we actually use those? 

To answer that I tried another experiment, which was to create a poor man's KB search app hacked from a pgvector code sample. 

I create three KB articles (actually just short KB article titles) and pretend to be a customer who issues search queries that should give relevant results in descending order.

The KB articles in returned result are sorted in descending order, i.e. best matching KB title goes first.

```sh
$ ./search.py -q "Storrage sucks"
[(3, 'The database is unresponsive'), (1, 'The storage array is struggling'), (2, 'The IO queue is full')]

$ ./search.py -q "Data base slow to respond"
[(3, 'The database is unresponsive'), (1, 'The storage array is struggling'), (2, 'The IO queue is full')]

$ ./search.py -q "Slow storage"
[(1, 'The storage array is struggling'), (3, 'The database is unresponsive'), (2, 'The IO queue is full')]

$ ./search.py -q "Storage slow to respond"
[(1, 'The storage array is struggling'), (3, 'The database is unresponsive'), (2, 'The IO queue is full')]
```

The first result is interesting and shows why we need vector databases: "sucks" obviously  isn't used in any of the KB article titles while "storrage" is misspelled, but the result isn't necessarily wrong. Also, remember how some traditional search engines may give you 0 results in this case, which can be just as annoying as a wrong result.

The second query also looks good. The third and fourth benefit from full match on a word ("storage") from the queries.

In the last example I believe the third KB article was ranked second (not last) because "respond" isn't semantically distant from "unresponsive".

## Conclusion

Vector indexing and search features are becoming important in many use cases leveraging AI and analytics. 

Postgres users with regular vector database requirements may find pgvector suitable for their needs.

pgvector's vectors take about the same disk space as in other databases, which means insert performance while processing millions of documents or images is important - we don't want those GPU servers to be waiting, do we?

Many modern analytics applications need a high throughput and relatively few other features. Although Postgres isn't a NOSQL database, it does support a remarkable number of extensions and integrations making it very similar to NOSQL in that sense (where replication, HA, backup/restore are usually included). 

I like to say that for such databases E-Series does everything they need, and nothing they don't. 

In the cloud and on-premises Instaclustr-managed Postgres does everything you need, and nothing you don't, PostgresSQL management-wise. In the cloud it takes minutes to get started, and should you need help Instaclustr can help with data migration to Instaclustr PostgreSQL or other Instaclustr services.
