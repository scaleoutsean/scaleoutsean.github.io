# Local agentic RAG with (only) NetApp StorageGRID S3

Agentic AI workload without persistent file or block, with just StorageGRID S3

- Part I - [Datalake-ish RAG with (only) NetApp StorageGRID S3](/2026/08/19/datalake-rag-netapp-storagegrid.html)
- **Part II** (this post) - Local agentic RAG with (only) NetApp StorageGRID S3

## Introduction

This is the second post focused on "serverless" AI with S3. The first one was about "classic" RAG.

WTH is agentic RAG?

> Agentic RAG is the use of AI agents to facilitate retrieval augmented generation (RAG). Agentic RAG systems add AI agents to the RAG pipeline to increase adaptability and accuracy. Compared to traditional RAG systems, agentic RAG allows large language models (LLMs) to conduct information retrieval from multiple sources and handle more complex workflows.

(Source: [IBM](https://www.ibm.com/think/topics/agentic-rag))

So, as far as **object stores** are concerned, this is *almost* the same as RAG in *Part I*:

- Agents can have memory. This is perhaps the key difference. Whereas S3 workload in the classic RAG post was mostly read-focused except when new content was uploaded and indexing and vectorization had to be done, here, agents need to persist data somewhere if they're to have memory, self-reflection and maybe mutual data sharing for multi-step processing
- Agent and chatbot logging is the same - we can send logs to a data lake-backed stream or log gathering service (on-premises or hosted).
- Document uploads for RAG are still done the same way - upload to S3 from the CLI, API or Web UI.

There's also KV cache, but cache is *not* strictly persistent. I recommend EF-Series for that (with BeeGFS, for example). I've blogged about this before. NetApp has no formal solution or recommendations for KV cache with BeeGFS, so you may take a look [here](/2026/06/05/above-and-beeond-beeond.html).

Here's how [NVIDIA](https://developer.nvidia.com/blog/traditional-rag-vs-agentic-rag-why-ai-agents-need-dynamic-knowledge-to-get-smarter/) compares two kinds of RAG:

> - Traditional RAG: Simple – query, retrieve, generate. Typically faster and less expensive.
> - Agentic RAG: Dynamic – agent queries, refines, uses RAG as a tool, manages context over time. 

Because agentic RAG is similar to regular (as far as persisting data to StorageGRID is concerned), I'll focus on highlighting the differences and similarities compared to Part I.

## Agent

- Can call tools (MCP and other)
- May store user feedback ("promotion" architecture)
- May have short and long-term memory that needs to be persisted to stable storage

There's no need to reinvent the wheel, so let's just discuss the move from block to object, which is related to how agents can store data from these interactions:
- Data lake house tables is the usual choice. We could store directly or save streams
- Application (agent, tool, user access) logs could be sent to a streaming endpoint (Kafka or other)

Because of that, unlike in Part I, S3 will be more frequently updated. Database example:

```sh
local D show tables;
┌─────────────────────┐
│        name         │
│       varchar       │
├─────────────────────┤
│ conversations       │
│ docs                │
│ feedback            │
│ logs                │
│ messages            │
│ schemas             │
│ user_settings       │
│ users               │
│ validation_sessions │
└─────────────────────┘
```

My RAG documents and logs get uploaded raw. 

They would be prepared in "silver" bucket, and ultimately stored in these two tables in "gold": `docs` for documents, and `logs` for logs.

As mentioned, I have more or less constant small updates to these tables - individual messages are stored, as are conversations. (Full output is very wide, so I truncated it a little, but not too much).

```sh
local D select * from  conversations  limit 1;
┌───────────────────────┬───────────────────────┬──────────────────────┬───────────────────────┬───────────────────────┐
│    conversation_id    │        user_id        │        title         │      created_at       │      updated_at       │
│        varchar        │        varchar        │       varchar        │ timestamp with time z │ timestamp with time z │
│                       │                       │                      │          one          │          one          │
├───────────────────────┼───────────────────────┼──────────────────────┼───────────────────────┼───────────────────────┤
│ d00f8e9f-3177-43c6-9e │ 6fe269d7-23e6-424f-b1 │ /docs Is E-Series st │ 2026-08-27 23:30:36.6 │ 2026-08-28 00:58:02.9 │
│ 3d-a2b6ff496649       │ 28-6720734fd1fa       │ orage suitable for K │ 40725+08              │ 68975+08              │
│                       │                       │ afka                 │                       │                       │
└───────────────────────┴───────────────────────┴──────────────────────┴───────────────────────┴───────────────────────┘
local D 
local D select * from messages  limit 1;
┌───────────────────────────────┬──────────────────────┬─────────┬───┬───────────────┬──────────┬──────────────────────┐
│          message_id           │   conversation_id    │  role   │ … │ chunk_sources │ is_error │      created_at      │
│            varchar            │       varchar        │ varchar │ … │    varchar    │ boolean  │ timestamp with time… │
├───────────────────────────────┼──────────────────────┼─────────┼───┼───────────────┼──────────┼──────────────────────┤
│ e30b2423-c0e6-4b66-9650-2887… │ d00f8e9f-3177-43c6-… │ user    │ … │ []            │ false    │ 2026-08-27 23:30:36… │
└───────────────────────────────┴──────────────────────┴─────────┴───┴───────────────┴──────────┴──────────────────────┘
  1 rows                              use .last to show entire result                              9 columns (6 shown)

```

So that's really the main difference as far as I can tell (related to storage).

## How it looks like

The app starts with ephemeral storage and consumes GPU resources. 

![Working application](/assets/images/storagegrid-agentic-rag-00-local-setup.png)

In this example I use Llama for everything (data prep, embeddings, chat), so this is completely local, including StorageGRID.

Unlike in my previous post:
- I use just one bucket rather than one-per-step in the previous post. My StorageGRID bucket is: `s3://agentic`.
- I skip data prep, and go from raw to gold in one step as I didn't have to remove "sensitive" data or fix it up

The UI lets me chat about documentation, uploaded logs and whatever other "tools" my agent has.

To test, I have uploaded:
- Several of my own posts about Kafka ("docs")
- StorageGRID audit log ("application logs")

Here we can see `s3://agentic/bronze/sample-docs` - the uploaded posts about Kafka.

![docs in StorageGRID bucket](/assets/images/storagegrid-agentic-rag-02-docs-in-sg-bucket.png)

There is another path with raw StorageGRID audit log file(s).

All that gets processed and I can chat about it, as well as ask an agent to analyze StorageGRID audit log.

![Web UI](/assets/images/storagegrid-agentic-rag-01-web-app.png)

As you can see, chat works fine, I can see the content of segmented chunks, etc.

From the logs above we can see these conversations and messages are getting saved. All good!

Let's see a little bit more using `mc`. The path seen above is underlined.

![mc view of the bucket](/assets/images/storagegrid-agentic-rag-03-docs-in-sg-bucket-cli.png)

The audit logs are shown around the center of the screenshot. 

There's no data lake, so I needed to cut corners. **Normally**, we'd want to use a data lake, perhaps one managed by [Lakekeeper](/2026/06/20/lakekeeper-iceberg-rest-catalog-netapp-eseries.html) for which I recommend EF-Series (because what you need for that is PostgreSQL and Kafka, so from the NetApp portfolio I recommend E-Series), or something hosted such as Azure OneLake. You can see the Lakekeeper post for some thoughts around that, but that's out of scope for this post.

What I do here is download data when I run the app, and upload when I shut it down (or when I start it and it sees local data is newer). 

But to view the `logs` table, we must use a view from Iceberg (`s3://agentic/iceberg`). 

```sh
local D SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'main';
┌─────────────────────┬────────────┐
│     table_name      │ table_type │
│       varchar       │  varchar   │
├─────────────────────┼────────────┤
│ conversations       │ BASE TABLE │
│ docs                │ BASE TABLE │
│ feedback            │ BASE TABLE │
│ messages            │ BASE TABLE │
│ schemas             │ BASE TABLE │
│ users               │ BASE TABLE │
│ user_settings       │ BASE TABLE │
│ validation_sessions │ BASE TABLE │
│ logs                │ VIEW       │
└─────────────────────┴────────────┘
```

Web app uses this DuckDB, but if content is updated we push changes to Iceberg tables.

So, this is a "hybrid" approach where we use ephemeral block volumes for the purposes of a demonstration. For production and scale, we would not use this approach.

For example, adding more documents done in the UI would trigger an update of Iceberg tables on S3.

![docs update](/assets/images/storagegrid-agentic-rag-04-docs-upload-to-s3.png)

`docs` content example shows chunks from the Kafka posts as well as vector embeddings created on update, for which I used local GPU on client.

```sh
local D select * from docs limit 2;
┌──────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────┐
│          doc_id          │          title          │       chunk_text        │        embedding        │ chunk_index │
│         varchar          │         varchar         │         varchar         │       float[768]        │    int32    │
├──────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────┤
│ 59b87e5954ca85d7-dcb023a │ 2022 06 28 Kafka Eserie │ ---\ntitle: E-Series as │ [-0.029795382, 2.249187 │           0 │
│ 5                        │ s Object Storage        │  Tier One for multi-tie │ , -3.9046323, -1.523157 │             │
│                          │                         │ red Kafka clusters\nlay │ 1, 0.9531347, -0.815080 │             │
│                          │                         │ out: single\ncategories │ 05, -0.088269964, 0.531 │             │
│                          │                         │ :\n- analytics\n- stora │ 39955, -1.1158714, -0.7 │             │
│                          │                         │ ge\ntags:\n- e-series\n │ 638985, -0.0005486347,  │             │
│                          │                         │ - eseries\n- kafka\n- n │ -0.37678817, 2.6186304, │             │
│                          │                         │ etapp\ndescription: E-S │  0.71344787, 0.23347601 │             │
│                          │                         │ eries as Tier 1 in mult │ , -0.48532826, -1.00020 │             │
│                          │                         │ i-tiered Kafka clusters │ 58, 0.13098136, -0.7761 │             │
│                          │                         │ \nexcerpt: E-Series as  │ 791, 0.798215, -0.36816 │             │
│                          │                         │ Tier 1 in multi-tiered  │ 424, -0.79898655, -1.16 │             │
│                          │                         │ Kafka clusters\nimage:  │ 72614, 0.1427661, 1.323 │             │
│                          │                         │ /assets/images/kafka-es │ 0054, 1.4103816, 0.0446 │             │
│                          │                         │ eries-compression-rando │ 9049, -0.34432727, -1.8 │             │
│                          │                         │ m-data-uncompressed-and │ 066763, 0.16067277, 1.4 │             │
│                          │                         │ -gzip.png\n---          │ 320562, -0.4267291, -1. │             │
│                          │                         │                         │ 220513, -0.027627513, … │             │
├──────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────┤
│ 59b87e5954ca85d7-5a1b1e4 │ 2022 06 28 Kafka Eserie │ - [Multi-tiered storage │ [-0.40658206, 2.0247087 │           1 │
│ 2                        │ s Object Storage        │  in Kafka clusters](#mu │ , -3.3617983, -0.265125 │             │
│                          │                         │ lti-tiered-storage-in-k │ 33, 1.6671679, -1.40738 │             │
│                          │                         │ afka-clusters)\n- [How  │ 01, 0.26731062, 0.37146 │             │
│                          │                         │ to leverage E-Series](# │ 01, -0.778093, 0.405768 │             │
│                          │                         │ how-to-leverage-e-serie │ 87, -0.24770276, -0.154 │             │
│                          │                         │ s)\n  - [Performance vs │ 75957, 1.9006822, 1.327 │             │
│                          │                         │ . data protection overh │ 8642, 0.29434454, -0.17 │             │
│                          │                         │ ead](#performance-vs-da │ 965834, -0.62876683, 0. │             │
│                          │                         │ ta-protection-overhead) │ 58315545, 0.11963464, 0 │             │
│                          │                         │ \n  - [Sequential perfo │ .3238802, -0.5027454, - │             │
│                          │                         │ rmance vs.              │ 0.43588305, -1.866147,  │             │
│                          │                         │                         │ 0.12699781, 1.3237783,  │             │
│                          │                         │                         │ 1.7294595, 0.37411678,  │             │
│                          │                         │                         │ -0.59892523, -0.6314817 │             │
│                          │                         │                         │ , -0.11324678, 1.577819 │             │
│                          │                         │                         │ 5, -0.35178384, -0.2822 │             │
│                          │                         │                         │ 605, -0.6102708, -0.68… │             │
└──────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────┘

```

StorageGRID audit logs are stored in the `logs` table, suitable for structured querying.

```sh
local D select * from logs limit 2;
┌───────────────────────────┬───────────────┬─────────┬─────────────────────────────────────────────────────┬──────────┐
│         timestamp         │    service    │  level  │                       message                       │ trace_id │
│          varchar          │    varchar    │ varchar │                       varchar                       │ varchar  │
├───────────────────────────┼───────────────┼─────────┼─────────────────────────────────────────────────────┼──────────┤
│ 2026-08-07T10:57:05+08:00 │ sg-storage-02 │ INFO    │ [AUDT:[MRMD(CSTR):"POST"][MPAT(CSTR):"/api/v4/org/u │          │
│                           │               │         │ sers/1a68ebfb-85d8-49e5-b02a-26ee5c0a2695/s3-access │          │
│                           │               │         │ -keys"][MPQP(CSTR):""][MDNA(CSTR):"192.168.1.211"][ │          │
│                           │               │         │ MSIP(CSTR):"192.168.1.13"][MDIP(CSTR):"192.168.1.21 │          │
│                           │               │         │ 1"][MUUN(CSTR):"urn:sgws:identity::2629608539423554 │          │
│                           │               │         │ 5212:root"][MRSC(UI32):201][RSLT(FC32):SUCS][MRSP(C │          │
│                           │               │         │ STR):"{\"id\":\"SGKHAcGFeo64iFHGsqXt4_366fbI5lgmoQx │          │
│                           │               │         │ hkc9LxXMlfBa96gkI590fGSHQ2qpvvcpA2vEc7DPXJkzknpmBPn │          │
│                           │               │         │ YLxA==\",\"displayName\":\"****************IN2K\",\ │          │
│                           │               │         │ "accountId\":\"26296085394235545212\",\"userURN\":\ │          │
│                           │               │         │ "urn:sgws:identity::26296085394235545212:user/BeeGF │          │
│                           │               │         │ S Ah\",\"userUUID\":\"1a68ebfb-85d8-49e5-b02a-26ee5 │          │
│                           │               │         │ c0a2695\",\"expires\":\"2026-08-28T11:11:00.000Z\"} │          │
│                           │               │         │ "][MRBD(CSTR):""][AVER(UI32):10][ATIM(UI64):1786100 │          │
│                           │               │         │ 225129011][ATYP(FC32):MGAU][ANID(UI32):12257404][AM │          │
│                           │               │         │ ID(FC32):GMGT][ATID(UI64):4554821423702731869]]     │          │
├───────────────────────────┼───────────────┼─────────┼─────────────────────────────────────────────────────┼──────────┤
│ 2026-08-20T00:19:22+08:00 │ sg-storage-03 │ INFO    │ [AUDT:[RULE(CSTR):""][CSIZ(UI64):582][UUID(CSTR):"5 │          │
│                           │               │         │ 89C2B64-904A-11F1-BC07-7B769A54F9AA"][PATH(CSTR):"a │          │
│                           │               │         │ utomq-data/C81E728D9D4C2F636F067F89CC14862C/_kafka_ │          │
│                           │               │         │ 5XF4fHIOTfSIqkmje2KFl1/2/1785863706740/wal/12388296 │          │
│                           │               │         │ 2944-123950071808"][BUID(CSTR):"76DC6092-9022-11F1- │          │
│                           │               │         │ 80DE-D5AE00BB087C"][LOCS(CSTR):""][RSLT(FC32):SUCS] │          │
│                           │               │         │ [STAT(FC32):PRGD][ATIM(UI64):1787185162038579][AVER │          │
│                           │               │         │ (UI32):10][ATYP(FC32):ORLM][ANID(UI32):12996059][AM │          │
│                           │               │         │ ID(FC32):SCAN][ATID(UI64):13618205534255737272]]    │          │
└───────────────────────────┴───────────────┴─────────┴─────────────────────────────────────────────────────┴──────────┘

```

I did not expect this generic agent would be able to do anything with StorageGRID audit logs (there's a log-to-JSONLD converter, I recently blogged about it [here](/2026/08/16/sgac-storagegrid-audit-cloud-storage-pools.html)), but I didn't need to give me answers, I just wanted to see if storage-related operations work.

They did work, and StorageGRID S3 is the only persistent storage I need.

## Further agentic AI exploration with StorageGRID

In a future post, I may explore a full-stack agentic setup with Lakekeeper, or consider some additional agentic use cases. Agentic AI is sophisticated, but as far as storage access patterns are concerned, different agentic patterns do not significantly change how we use StorageGRID.

One area of my interest is what I wrote about in the post on [S3 Files](/2026/08/26/s3-files-sg-nvcomp-checkpoints.html#aws-s3-files), but in this first agentic RAG use case my log tool did not do much, so I can't say if it would, or wouldn't need some improvement.

I think - because I changed the application to use native S3 - I don't need anything like S3 Files, although:

- If many agents were to share small amounts of data, using S3 for that wouldn't be the best idea. Since I can modify my source code, I could use [Kompromise](/2026/06/27/kompromise-pipeline-netapp-storagegrid-eseries-vgw.html#high-performance-s3-cache) to solve that and keep S3 access, or fire up BeeOND (download, process, upload) which is admittedly a "workaround" that S3 Files aims to solve
- There may be tools agents use and require shared POSIX underneath them, but data would be on S3, and I may not be able to modify *all* such tools. However, I may be able to use [lakeFS](/2026/08/24/storagegrid-lakefs.html) or [Alluxio](/2021/11/12/alluxio-storagegrid-s3.html) to get an *efficient* POSIX-like access to data that I keep on S3

So, while these problems may surface in different agentic applications, some partner solutions already solve them. Alluxio, in particular, is read/write-capable cache, so it's not a "workaround" because there is no "download, process, share, process, upload" cycle.

Both this post and Part I demonstrated the use of embeddings (vectors) on S3 and because major providers do the same thing, I think it's beyond doubt that I don't need *persistent* block or file for that (at most I could use those for caching). In this post I used DuckDB to store embeddings, as you can see above. And they were generated locally. 

One remaining - although not unique - item is graph databases on S3. While the kind of database is different, data lakes store such records the same way - in data lake tables. 

There are some limitations related to how fast or well it is done, but it works - major data lake services store graph data that way. If it doesn't work fast enough, it's like with vector DBs - we an always run those on E-Series just like we do with [Qdrant](/2026/05/26/multi-node-qdrant-vector-db-netapp-eseries-santricity-csi.html) or [pgvector](/2023/11/28/postgres-pgvector-instacluster-eseries.html). Prefer those that use ephemeral block just for caching, to keep dependence on block low and eliminate storage management.

The log tool issue - out of scope here, but interesting - is discussed in Appendix A below.

## Conclusion

We've seen that agentic RAG needs more interaction with storage because it's dynamic, so it's not easy to run "static site"-like setups. There's no more appropriate place to track events and store tables than a data lake, so it's clear where this "additional interaction with storage" should go to.

Just like regular RAG, Agentic RAG is suitable for S3-only persistent storage, and recommended if you have a data lake in your environment becuase "serverless" then becomes very easy because we actually rely on servers, services and some block storage from your data lake stack (see the Lakekeeper post, if running on-premise).

Ephemeral containers, KV cache, [checkpoints](/2026/08/26/s3-files-sg-nvcomp-checkpoints.html) and so on can run elsewhere. You can use BeeOND or BeeGFS for cache, and EF-Series with TopoLVM for CSI used by general Kubernetes applications, for example.

Data that matters is all on S3 and the value this gives you is good (see Part I).

# Appendix A: Agentic RAG for StorageGRID audit log analysis 

Tools for StorageGRID audit log analysis did not work as they needed modifications to understand the StorageGRID log type, but wasn't the objective of this PoC.

It is an an interesting topic for me because of I maintain that StorageGRID audit log parser script (SGAC). Because log-to-JSONLD (or syslog forwarding if you set it up) both work, you can already get those logs into a data lake and use existing SIEM or other tools to explore them just like you do with any other logs. If we wanted to make our own tools (for Tech Support), that would be a fun exercise, but too niche. This is inconsequential for StorageGRID and agentic RAG.

As an example, this is an audit log event for access (already converted to JSON):

```json
{
  "Timestamp": "2026-08-27T15:23:30+08:00",
  "RSLT": "SUCS",
  "CNID": 1787844205616861,
  "TIME": 14566,
  "SAIP": "192.168.1.131",
  "TLIP": "192.168.1.211",
  "S3AI": "55295525968323305569",
  "SACC": "pepsi",
  "S3AK": "Y5LT3NLZ0SC39RRDOZCT",
  "SUSR": "urn:sgws:identity::55295525968323305569:root",
  "SBAI": "55295525968323305569",
  "SBAC": "pepsi",
  "S3BK": "agentic",
  "S3KY": "bronze/sample-docs/2024-02-23-storagegrid-notifications-kafka.md",
  "UUID": "37C33C09-A22B-11F1-A807-3B02AC94F9AA",
  "CSIZ": 8165,
  "MTME": 1787844192802611,
  "AVER": 10,
  "ATIM": 1787844210789820,
  "ATYP": "SGET",
  "ANID": 12908970,
  "AMID": "S3RQ",
  "ATID": "3730709284183542225"
}
```

As there may be thousands of these for each object, we want a query tool that can handle queries *specific to StorageGRID audit log format* and focus on specific properties.

That means it needs to "understand" these keys and how a question translates to a key or keys. For more complex questions, a bit of extra information about other operations (tiering and so on) would be required.

We need to specify what to ignore and what to include in results. By default, we look 24 hours back.

```sh
/logs Can you check the key bronze/sample-docs/2024-02-23-storagegrid-notifications-kafka.md in bucket called "agentic"?

The StorageGRID audit logs show no entries for the key bronze/sample-docs/2024-02-23-storagegrid-notifications-kafka.md in the agentic bucket within the last 24 hours. 

/logs Can you check any activity on the same S3 key across a larger time window (48 hours)?

The provided data appears to be a log or event stream containing timestamps, file paths, operation types (like SGET, SHEA, SPUT), and possibly user/role identifiers (e.g., SHEA, SGET, ORLM). Here's a breakdown and interpretation...
```

So, agentic tools also work as expected.

![Agentic StorageGRID audit log analysis question](/assets/images/storagegrid-agentic-rag-04-sgac-log-analysis-question.png)

If you care about security or auditing, you probably won't need to build a tool for StorageGRID audit logs. You'll have a proper one and run agentic SIEM there. You just need to build this tool there.
