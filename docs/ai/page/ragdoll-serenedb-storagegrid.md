# Semantic and lexical search with SereneDB and StorageGRID S3

Whole document search (lexical and semantic) with SereneDB and NetApp StorageGRID

## Introduction

My [previous post](/2026/11/03/ragdoll-surrealdb-storagegrid.html) demonstrated an approach to creating RAG-ready search index with documents in a StorageGRID bucket and indexes in a database. 

This post shows a different approach (to avoid repetition and highlight its differences) with [SereneDB](https://serenedb.com/).

## Differences

Examples in this post do not use chunking. Index (and results) are document-based (not chunk-based).

Second, lexical search in this example uses the StorageGRID bucket as a foreign external table. Documents are indexed **in-place**, and they do not need to be chunked and/or copied into the database.

Third, SereneDB plans to add a feature that puts inverted index files on S3, which would allow us to have an extremely slim SereneDB volume and leverage StorageGRID for practically all lexical search data that grows proportionally with data size.

SereneDB *can* use [different](https://serenedb.com/docs/sql/indexes/inverted#choosing-a-search-type) (or several at the same time) approaches, but this approach was chosen because it's different and addresses some use cases chunking does not.

## What does Ragdoll do?

You probably don't need something like it.

In my example, the content isn't in a format useful for search indexing, so I needed a tool to prepare it:
- Ragdoll converts documents to Markdown
- Ragdoll uploads documents to S3 and verifies
- It also has some simple management features, like list/delete, for product names and document collections

These steps may not be necessary if, for example, you author and upload Markdown content directly to S3 with something like: `mc copy -r storagegrid s3://docs/`.

I couldn't do that with the NetApp documentation so, before I start using SereneDB, I use Ragdoll to get to this point where the documentation is uploaded in the Markdown format using versioned document prefixes:

![Ragdoll-uploaded S3 content](/assets/images/ragdoll-02-storagegrid-docs.png)

These steps were described in the [previous post](/2026/11/03/ragdoll-surrealdb-storagegrid.html#ragdoll).

## Examples

Depending on content, SereneDB has different ways. Normally I'd use `--product <product> --build <build>` in Ragdoll, but I hard-coded these since Ragdoll was covered in the previous post.

```sql
CREATE VIEW netapp_docs AS
SELECT *
FROM read_text([
    's3://docs/e-series/latest_2026-10-30T18:26:50_37adf45/**/*.md',
    's3://docs/storagegrid/12.1_2026-10-27T12:35:25_f21e68f/**/*.md'
]);
```

Once indexes are built according to the extensive SereneDB documentation, my SereneDB database as the following tables:

```sh
postgres=# show tables;                                                        
      name      
----------------
 docs_idx
 docs_pages
 docs_pages_idx
 netapp_docs
(4 rows)
```

`docs_idx` is the external inverted index of StorageGRID bucket content. `REINDEX INDEX` can be used to update the index once Ragdoll or other tool has finished updating documentation.

How many documents have the word "autosupport"?

```sql
SELECT regexp_extract(filename, 's3://docs/([^/]+)/', 1) AS product,
       count(*) AS matches
FROM docs_idx
WHERE content @@ 'autosupport'
GROUP BY 1
ORDER BY matches DESC, 1;
   product   | matches 
-------------+---------
 storagegrid |      40
 e-series    |      19
(2 rows)
```

[Search](https://docs.netapp.com/us-en/e-series/search.html?q=firewall&products=storagegrid) the NetApp Docs StorageGRID documentation for "firewall". Screenshot:

![NetApp docs firewall search](/assets/images/ragdoll-09-netappdocs-serenedb.png)

Search SereneDB for "firewall":

```sql
SELECT regexp_extract(filename, 's3://docs/([^/]+)/', 1) AS product,
       regexp_extract(filename, 's3://docs/[^/]+/[^/]+/(.*)$', 1) AS path,
       round(BM25(docs_idx.tableoid)::numeric, 3) AS score
FROM docs_idx
WHERE content @@ 'firewall'
  AND filename LIKE '%/storagegrid/%'
ORDER BY score DESC, path
LIMIT 8;
   product   |                          path                           | score 
-------------+---------------------------------------------------------+-------
 storagegrid | admin/configure-firewall-controls.md                    | 3.559
 storagegrid | admin/manage-firewall-controls.md                       | 3.543
 storagegrid | harden/hardening-guidelines-for-storagegrid-nodes.md    | 3.523
 storagegrid | admin/controlling-access-through-firewalls.md           | 3.470
 storagegrid | troubleshoot/troubleshooting-syslog-server.md           | 3.446
 storagegrid | harden/hardening-guidelines-for-storagegrid-networks.md | 3.413
 storagegrid | network/external-communications.md                      | 3.413
 storagegrid | admin/manage-security.md                                | 3.365
(8 rows)

Time: 3.037 ms
```

That's pretty close, fast and simple. 

That was lexical search.

`docs_pages_idx` is a word vector index created using the same embeddings model we used yesterday. 

```sql
WITH q AS (
    SELECT ai_embed(
        'Firewall settings for StorageGRID AutoSupport',
        'nomic-embed-text:v1.5',
        'ollama'
    )::FLOAT[768] AS embedding
)
SELECT product, path
FROM docs_pages_idx, q
WHERE content @@ 'firewall'
ORDER BY docs_pages_idx.embedding <=> q.embedding
LIMIT 5;
   product   |                     path                      
-------------+-----------------------------------------------
 storagegrid | admin/controlling-access-through-firewalls.md
 storagegrid | admin/configure-firewall-controls.md
 storagegrid | admin/manage-firewall-controls.md
(3 rows)

Time: 1582.992 ms (00:01.583)
```

It took a lot longer the first time, then quickly dropped to 50ms and finally 19ms the third time.

Provide semantic search for only some content, rather than across the board, is a good idea to avoid unnecessarily bloating SereneDB with junk. For example, we could create embeddings only for the sections most relevant to end users, e.g. `s3://docs/storagegrid/tenant` and `s3://docs/storagegrid/s3`.

My last example is a search for a non-existing string:

![WTF](/assets/images/ragdoll-08-serenedb.png)

The same in SereneDB lexical search across both E-Series and StorageGRID documentation:

```sql
SELECT regexp_extract(filename, 's3://docs/([^/]+)/', 1) AS product,
       count(*) AS matches
FROM docs_idx
WHERE content @@ 'wtf'
GROUP BY 1
ORDER BY matches DESC, 1;
 product | matches 
---------+---------
(0 rows)
```

In this example SereneDB loses in search result count, but potentially wins on search relevance.

## Backup and restore

This is out of scope for a post on search, but also not enough for a dedicated one. To backup:

```sql
SELECT pg_backup_start('nightly') AS start_lsn;
```

Copy the SereneDB data directory to an Object Lock-enabled bucket on StorageGRID, e.g. something like `mc cp -r /data s3://backup/<db-name>/<timestamp>/`. Stop when done using `pg_backup_stop`.

```sql
SELECT lsn, labelfile FROM pg_backup_stop();
```

There's more, including the restore steps, [in TFM](https://serenedb.com/docs/operations/backup).

You can do that [in Kubernetes](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html) as well.

## Conclusion

In this workflow, my Ragdoll data preparation tool (or any other tool, including [S2S3](/2026/10/22/s2s3-share-to-s3-tool.html) and [S2S3 Feeder](/2026/11/01/s2s3-feeder.html) for NAS-to-S3 migration) copies Markdown documents to a StorageGRID bucket and SereneDB makes it searchable in no time. 

SereneDB has very nice search-related features. This post highlights just two - the nice in-place lexical index feature and vector-based search, which are *very* effective in terms of approach, resources, cost and storage capacity used.

It's a very simple workflow even when your documents need preparation (in my case: git clone, ragdoll prepare, ragdoll upload and just one SQL command (`REINDEX INDEX <index>`) in SereneDB) and it is attractive for not just documentation search, but also Web search, light RAG and other AI-related use cases, especially since Markdown pages on S3 can be shared and browsed without using mounts or PVCs (StorageGRID does have a [COSI driver](/2026/07/25/storagegrid-12_1-sg-cosi-0_5_4.html), too).

Because this approach is so effective and StorageGRID can be easily accessed from remote locations, it is cheap to create and deploy SereneDB on premises and in your cloud instances for various use cases. Data lives on your object store and your cloud applications have nothing to replicate backup, or manage (storage-wise). SereneDB doesn't need to be nearby to index your StorageGRID content.

If clients need access to documents, that works with native S3 clients and various ways to deliver that, including [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html).

**Update:** after AI chat evaluation, I consider this PoC successful. My chatbot is hosted uses hybrid search with "luxury" options. Because it does more, it's a lot slower, but I think it gives me much better results. Instead of three queries, I need one (and for now, have 1-2 quirks that are tolerable).

## Appendix A: AI chat examples

As the last step of this evaluation, I added own AI chatbot and compared it against the one on NetApp Docs ("Doc").

As I've said before, I've no idea what they do, but I know what I do. And, there is cost to this stuff, plus it's fully open to public, so how much should be done and how is tricky: very good may also be very expensive.

But that is also my starting premise: I need it to be very good, that's why I'm doing my own. I'd rather give it one query, wait 10 seconds, and get the correct answer.

- **Question** about management actions in the StorageGRID audit log

![Management messages in audit log by NetApp Docs](/assets/images/ragdoll-10-ai-chat-example-01n.png)

Very academic.

My chatbot:

![ACL example by NetApp Docs](/assets/images/ragdoll-10-ai-chat-example-01dc.png)

That's better. `MGAU` is what I was after.

- **Question** about an ACL example for anonymous access to bucket:

![ACL example by Docochat](/assets/images/ragdoll-10-ai-chat-example-02n.png)

That is completely useless!

My chatbot gave a less academic answer, which was great.

![ACL example by Docochat - take one](/assets/images/ragdoll-10-ai-chat-example-02dc-alpha.png)

But, it also wasn't correct.

![ACL example by Docochat](/assets/images/ragdoll-10-ai-chat-example-02dc.png)

That was good, once corrected. But if you did't know it was wrong... 

It seems it mis-remembers and mixes up previous queries. For now, a "fix" is to start a new chat for a new topic.

- **Sources** vs. NetApp sources

It's a bit quirky as I sometimes need to ask for links to sources (the prompt says it should always provide them and it *mostly* works).

![Links to sources](/assets/images/ragdoll-10-ai-chat-example-03-references-dc.png)

My sources link directly to the Markdown files because I scrape markdown files on StorageGRID. Here's the first of those links:

![Source in Markdown](/assets/images/ragdoll-10-ai-chat-example-04-references-dc-markdown.png)

This is what I wanted.

So, I picked the "luxury" option:
- Good quality answers
- Better UI

Downsides I accepted:
- Slower, because it works harder to produce better results and I don't assign significant resources
- Self-hosted, so not free
- Currently I have search on premises and chatbot in the cloud

I don't know how it fares against NetApp's cost-wise, but I wasn't paying for NetApp's AI chatbot before. But I save time and effort this way.
