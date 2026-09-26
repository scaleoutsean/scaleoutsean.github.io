# Simple file share and S3 analytics and MCP ops

If you're not Google, maybe there's a simpler way

- [Introduction](#introduction)
- [SMB and NFS data migration](#smb-and-nfs-data-migration)
  - [Shell scripts and utilities](#shell-scripts-and-utilities)
  - [XCP](#xcp)
  - [Elaborate schemes](#elaborate-schemes)
  - [Enterprise software](#enterprise-software)
  - [Example: SMB share](#example-smb-share)
- [S3 reporting and replication](#s3-reporting-and-replication)
  - [Example: S3 usage reporting](#example-s3-usage-reporting)
- [Combined file and object shares](#combined-file-and-object-shares)
- [Conclusion](#conclusion)
- [Demo](#demo)

## Introduction

Sometimes storage admins have challenges related to data movement, such as moving stuff from A to B, or deleting old stuff from A.

Normally, that's easy - find the sucker, hit Delete. But sometimes the problem is you don't know where the sucker is (or the suckers are). And there may be millions of them.

Another frequently found problem is file system reporting, which isn't novel either and needs to be solved before you can solve the two problems mentioned earlier.

Things to highlight before we begin:

- Solutions have existed for decades. I haven't invented anything new.
- One has to know what he's doing. Sometimes the right thing to do is to buy, other times it may be to build your own.

As that famous blog post said ("you're not Google"), storage administrators often imagine their problems require solutions used by largest enterprises (or even Google). 

Recently one of the new and upcoming storage vendors has been telling everyone they're Google, so to speak, but that's not true either.

## SMB and NFS data migration

An SMB share with 100 million files takes a long time to rescan. The files need to be scanned for two purposes: sometimes it's to delete old junk. Other times it's to move specific files to an archive (and even this case may be complicated, because copying a fat directory tree may take a while).

### Shell scripts and utilities

They work up to a point, but if data is growing rapidly it becomes harder and harder to keep up.

After a while it makes sense to buy a commercial - if not "enterprise" utility and move on. 

### XCP

For the latter case NetApp has its own tool called XCP. I've blogged about it before. It can move/copy, but it can't delete. However, you can scan and store in a PostgreSQL DB and query the database to obtain a list of files you need to delete. 

Great, there's a solution! But, as an SMB user, now you need a Linux VM for PostgreSQL, another for XCP server, and maybe two RHEL licenses and a Linux admin. You multiply annual cost of that times 5 years... and maybe you keep looking. 

It's a great solution (free, fast), but it may be more attractive for one-off migrations. For daily use, there are additional considerations.

### Elaborate schemes

Maybe you think you'll have better luck with several tools, including shell scripts, databases and such. 

That's commendable if it's justified. Back in 2023 [I looked at one such approach](/2023/08/01/fscrawler-filesystem-analytics-elasticsearch.html) with mixed results. Admittedly, it was a more complicated scenario - it involved indexing and search - but it just wasn't something that most commercial users could accept.

### Enterprise software

At some point - whether due to the scale, (legal and other) responsibility or other reasons, one has to tap out and get Datadobi, StorageX, Starfish Software and similar.

As soon as it looks justified, I immediately recommend these. If you work with patient or financial data at scale, it's often better to buy because getting sued could cost a lot more.

### Example: SMB share

In recent days I've been dealing with a cataloging aka "file-system enumeration" problem. Based on previous experience and gut feeling I figured the problem was solvable with a better mouse trap ("Elaborate Schemes Lite").

It took me some time to set things up and then I got to work.

I don't have a lot of capacity and file-system enumeration is really a metadata-intensive workload, so I started with 500,000 files.

Then, to check the scalability of this new mouse trap, I increased that to slightly over 2,000,000 files:

```raw
4 top level dirs x 4 mid x 8 bottom x 16,000 files per each bottom directory
TOTAL: 2,048,000 files in 128 directories
```

![SMB share with 2 million files](/assets/images/filesystem-analytics-ai-mcp-01-smb-share.png)

I tried half a dozen approaches with both 0.5 and 2 million files and I was surprised to see that PowerShell 7 on Ubuntu 24.04 was faster than PowerShell 7 on Windows Server 2025.

Since I had the same SMB share mounted on both systems at the same time, it was very easy to compare. Windows was 2-4x slower.

But - I've mentioned this before - I've experienced the mysteries and wonders of .NET on Linux and when it comes to sensitive data operations like archiving of SMB data, I'd rather use Windows. 

After evaluating half a dozen approaches, I settled on this one:

- Enumerate several top levels of directories (e.g. top 2, in my case 4 x 4 x 8 = 128)
- Create a number of parallel jobs to scan these directories. If you have 8 Windows VMs, that's easy, if you have just one like I did, maybe create 8 jobs, each of which sequentially scans 16 directories 
- Save data to CSV or flat file DB files (SQLite, for example, to avoid the PostgreSQL management thing I mentioned above). This would be over 100 flat database files
- Optionally create a database of databases (yep, it's downhill from here) or merge all those into one big database

Obviously, there are subtleties in this and what's "best" depends on many factors, but with using the above approach I was able to get the following:

- 80 seconds to enumerate all directories and files and create database files
- 20 seconds to run a query to find files that match certain criteria (file name, path, size, etc)
- PowerShell memory utilization rarely goes over 500 MB (some of my bad attempts complete exhausted VM's RAM, so this was a big win)

![SMB scan of 2 million files](/assets/images/filesystem-analytics-ai-mcp-02-smb-scan.gif)

As scanning completes and indexes are built, built-in check shows 16,001 (16,000 + 1 new CSV file) in one of bottom-level directories.

![SMB index verification](/assets/images/filesystem-analytics-ai-mcp-03-smb-scan-verification.png)

Two million wasn't more than 4 times slower than 0.5 million and memory utilization remained almost the same due to simply more jobs of essentially the same size (number of files per folder went from 2,000 to 16,000, for example, but it wasn't reflected in PowerShell memory consumption).

Finally, the script searches for files older than a certain cut-off point, reading all 100+ CSV "database" files. This takes just 16 seconds and 89,935 files (out of 2.048 million) matched the condition.

![SMB file index search](/assets/images/filesystem-analytics-ai-mcp-04-file-index-search.png)

I can't "guarantee" it'd scale the same way to 100 million, but it seems that way. 

Later I did another test, with 4 million files (`8 x 8 x 4 x 16,000`) to get an idea. 

![SMB with 4 million files](/assets/images/filesystem-analytics-ai-mcp-12-smb-count-4million-files.png)

Enumeration/cataloging performed the same. Even PowerShell didn't consume more resources. With more (sub)directories to scan, there were more jobs to do, but the script batches those anyway so it's effectively zero impact.

![SMB file run with 4 million files](/assets/images/filesystem-analytics-ai-mcp-10-smb-scan-verification-4million-files.png)

Search was roughly 2x slower compared to 2 million files. No slowdown from 0.5 to 2 to 4 million, and this is a worst case scenario (many CSV files).

![SMB file search with 4 million files](/assets/images/filesystem-analytics-ai-mcp-11-smb-scan-search-4million-files.png)

If one needs daily or weekly actions (archiving, deletion, migration, etc.), based on the above tests, shares with 100 or 500 million files could probably be scanned daily and certainly weekly.

Also, I've been positively surprised by the "flat file DB" approach. The ability to query CSV files has fully met my expectations:

- No "DB server" (or indeed, DB *service*) to setup, backup, or maintain
- No need to backup as they're so easy to recreate, but since we can keep those flat file databases on SMB shares, they get backed up without any issues
- Excellent performance
- Easy to work with. As I've mentioned above, we can merge or import them into one big DB (great up to a few hundred GBs, I suppose), or build a DB of DBs, which was the approach I took: I'd just query the DB of DBs for CSV DB locations and then query CSV files. Even if 100 CSV "databases" are searched, it's quick enough for tasks such as file deletion or migration. 

I think this has been a successful example of a correct guesstimate that a slightly more elaborate DIY approach might work well.

## S3 reporting and replication 

S3 isn't that different in terms of addressing challenges, but I want to mention two additional things:

- Komprise is one of the enterprise vendors that have been doing well in this space
- Most people know about rclone as a "famous" free utility for listing/cataloging, moving and copying of object data.

### Example: S3 usage reporting 

This was a recent ask by a customer and I've seen colleagues asking the same. 

In my case it was fairly simple:

- Want to see who's doing what in terms of capacity and object count utilization
- Want to determine differences between buckets (some may be used for testing or S3-to-S3 "backup")
- Hundred million objects per bucket, 3-4 buckets

This also seemed perfectly doable so I didn't even bother to check if there's a product "feature" (on ONTAP S3 or StorageGRID) that can do it. 

- I can list around 1 million object (names and other system metadata) per minute. 100 million is doable for daily, and especially weekly, use
- Once I get hold of that, nothing can stop me from doing the rest

And what would that "rest" be?

- Bucket listing is stored to a file with a bunch of one-line JSON "documents" (one per object)
- We import this to a flat file database
- Then we query data for object count, object size, project size, and we could even run extra queries to check tags and versions (although this may be too much for daily use)
- With that information, we can share/present it:
  - Send usage alerts (high capacity, high object count, etc.) to a log analysis or TSDB system
  - Expose database(s) via Jupyter or other Web UI, API, CLI, etc.
  - Build MCP server to share data through AI chat bots

For performance monitoring, I would use InfluxDB (my SFC and EPA both use it), but what was available was Loki. Loki is primarily for logs, we really want to send events, and not so much performance metrics. 

In this example I look at different "projects" (which may be just specific S3 prefixes such as `top_level_1/`) and send object count and object size by "project", with some KV pairs including event severity, service name and such.

![S3 service monitoring for projects](/assets/images/filesystem-analytics-ai-mcp-05-s3-service-performance-event-monitoring.png)

If I spot more than 0.5 million objects in a project, that may be an error event that should be checked. Or we can just log everything as info-level severity and let others decide what to do with it.

![S3 service monitoring for projects](/assets/images/filesystem-analytics-ai-mcp-06-s3-service-performance-event-monitoring.png)

For more "free form" data querying, we could simply put those CSV (or other) database files on S3 and let people query them with [S3 Select](/2022/03/04/storagegrid-s3-select.html). ONTAP S3 can't provide S3 SELECT, but StorageGRID can. Also, there are good flat file databases that can be queried directly from S3 without downloading them. 

We simply query a URL to CSV "database" and it works like a charm! For several million files or objects it doesn't even have to be an optimized file format.

```sql
SELECT COUNT(*) AS total_objects, 
  SUM(size) / (1024 * 1024) AS total_size_mb 
  FROM objects WHERE key LIKE 'top_level_1/%'"
# total_objects = 480039
# total_size_mb = 1940.2514181137085

```

One question I got from a colleague was "why not use (object storage) system metrics for S3"?

Because they're meant for storage admins, not for operations or LoB. Of course, we can get both, if that helps. 

Here the top row is storage system metrics - "per bucket" object capacity and object count. But what about "per top-level prefix" stats? You can't get those from a storage system. Or maybe your "projects" are under some prefix two levels deep (e.g. `s3/bucket/projects/hr-proj-1/`). 

Top row (S3 system metrics) tells you object count in the bucket is increasing, but you have no clue why. That's where the 2nd row comes in: S3 API-level metrics where we can do whatever we need and get insights daily or weekly (for fairly large buckets).

![S3 service metrics vs. S3 bucket metrics](/assets/images/filesystem-analytics-ai-mcp-13-smb-count-4million-files.png)

Without "in-bucket" analytics, you're blind and have to do "1 bucket per project" to make storage system S3 stats work for you. Sometimes that's OK (each user has many TB of data), sometimes not OK (500 smaller projects would require 500 buckets).

**Implementation note:** here my bucket metrics are sent to InfluxDB 3 rather than Loki, which lets me easily create nice dashboards. InfluxDB 3 also supports SQL, so I could run similar SQL queries as above.

And finally, it's time for the obligatory AI crap! 

I'm not sure if that's a thing - I wouldn't use it since I already know how to query data and would prefer to just do it from shell scripts - but we have to assume maybe there are users who don't deal with this stuff often and may want an easy way to find their way through all the various information. Enter MCP.

Since I have a database of all objects, I just need a server and although VS Code + Copilot seem a bit behind, they're popular and Copilot somehow manages to work with MCP. Conservatively, I might add - as you can see here, it refuses to do things, instead it prefers to pass the bucket by giving you the exact command.

I ask what tools are available, and it answers promptly (I have three - one for list of projects I watch as S3 administrator, one for individual project metrics, and one for "top projects" to see who's eating my storage). 

![MCP server for S3 service in VSCode - chat](/assets/images/filesystem-analytics-ai-mcp-07-s3-service-mcp-server.png)

For specific tool commands that need to be issued to the server, Copilot spits it out and then I copy those and paste them in VS Code terminal to query the MCP server. 

![MCP server for S3 service in VSCode - Q&A with RPC](/assets/images/filesystem-analytics-ai-mcp-09-s3-service-mcp-server-copy-paste.png)

As you can see above, although JSON-RPC style advice is annoying, it minimizes the likelihood of catastrophic errors and mistakes. 

Notice how Copilot allows me to ask questions in "conversational language" - as long as it's understandable, it provides the right RPC command. (I told it once to add `| jq` to its command examples, and it consistently did that after that ask.)

And if you get confused by long JSON output (sometimes it can be multiple lines long), you can copy that to Copilot and tell it to process it for you (filter, format, etc.).

![MCP server for S3 service in VSCode - pretty table](/assets/images/filesystem-analytics-ai-mcp-08-s3-service-mcp-server.png)

One can see how, once this "preview" phase of "Copilot with MCP" is over, Copilot can successfully and seamlessly bridge AI chat with MCP services and AI agents available to it. 

Other MCP-capable chat bots already do this much better, of course, but this is from VSCode and for many IT folks it's deployed, licensed and subscribed today.

I wasn't completely sure how to tell it to use my MCP server (which I called "my-s3"), as some instructions I found on the Web didn't work, so I did things like:

`/mcp my-s3 give me top projects by object count`

That "/mcp" prefix wasn't really necessary, it seems. "my-s3", the name of my MCP server, was enough for Copilot to tell me to do copy-paste JSON-RPC command like this:

```json
 {"jsonrpc": "2.0", "method": "tools/call", 
  "params": {
    "name": "list_top_projects", 
    "arguments": {"metric": "count"}
  }
}
```

Of course, I wrote that API function and wouldn't normally ask this question myself, but a chat bot and this MCP server can help *anyone* answer these questions. 

Related to replication for DR and testing purposes, the same bucket listing and databases we create from it can be used to create replication jobs and move or copy data to other buckets or other sites. 

Similarly to the SMB approach above, once we work out a query we work out a way to make it parallel, multi-threaded or whatever it takes, and mid-sized buckets in low-risk environments can be handled with these DIY approaches.

## Combined file and object shares

During above experimentation I realized that one of the customers could expose their SMB shares via multiple protocols (File/Object). 

The advantage of that - mentioned earlier - is that any migration, scanning or archiving can be performed via S3, making it possible to use generic, robust S3 clients and greatly simplify the problem. For example, a 300-lines long shell script that deals with file shares can be replaced by a 30 line script that deals with objects without losing, or perhaps while gaining robustness and performance.

## Conclusion

These recent challenges have been interesting and reminded me that "you're not Google" post from more than a decade ago.

Sometimes we just need to try a bit harder and a DIY approach can work. Other times it's smarter to give up ASAP and pay for proper tools and services. And it takes experience (and some luck) to know when to do what.

I was more skeptical about the ability to catalog SMB shares with hundreds of millions of files (maybe because of FSCrawler), but even that turned out to be likely possible even with small resources.

I was more optimistic about S3 - because "scanning" happens inside of S3 server, so it should work much faster - and indeed, listing 1 million objects per minute doesn't require any programming, it simply works with common S3 clients (not the crappy ones, perhaps).

Last month I started playing with MCP servers ([this POC with SolidFire](/2025/05/20/get-started-with-netapp-solidfire-mcp-server.html)), but I didn't have a reason to do something practical with it. The S3 reporting/analysis requirement was very much appreciated as I had a reason to use MCP again.

Neither StorageGRID nor ONTAP S3 have internal tools for bucket data analysis - it's kind of "out of scope". Overall bucket capacity and object count may be [available](/2025/02/17/minimal-prometheus-exporter-with-ontap-harvest.html) (I haven't even looked), but if you want to get information by tag or by path, you probably have to build something anyway (in the case of StorageGRID probably with [Elasticsearch](/2023/07/20/storagegrid-and-elaticsearches.html) which is similar to FSCrawler in NAS environments, which I mentioned at the top). 

Using simple object list commands - when it's feasible, as it was in this case - plus some modern scripting tools works very well with both StorageGRID and ONTAP S3 and means I can use it with either without any modifications. 

Lastly, for very high file count or high data volume environments, BeeGFS with E-Series has very good scanning and reporting features built-in. I blogged about them [here](/2025/05/17/beegfs-v8-netapp-e-series-indexing-tiering-workflows.html) and [here](/2025/05/23/beegfs-data-pipeline.html).

## Demo

This demo video (6m32s) has 2.5 parts:

- Part 1 - shows how "live" queries can be repeatedly executed and send to some event log (such as Loki)
  - It also shows how Loki works with (tiers cold data to) object storage. (This is off topic here, but this trend [benefits "fast & simple" storage arrays like NetApp E-Series](/2023/11/06/netapp-eseries-sizing-for-splunk-smartstore.html). It's the same trend that you see with Splunk, InfluxDB 3 and other modern architectures).
- Part 2 - shows that, for buckets with many objects, it's probably better to list objects on a fixed schedule (daily or weekly), store results and summaries in a database which can then be exposed through several front-ends, whether it's Jupyter, MCP, CLI or whatever works for users

Link: [https://rumble.com/v6uiorh-getting-extra-information-about-s3-buckets-on-netapp-object-storage.html](https://rumble.com/v6uiorh-getting-extra-information-about-s3-buckets-on-netapp-object-storage.html)
