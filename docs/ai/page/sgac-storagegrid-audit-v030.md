# SGAC v0.3.0

Major changes and breakage

## Introduction

After last week's [v0.2.4 update to StorageGRID Audit-log Converter aka SGAC](/2026/09/14/sgac-storagegrid-audit-v024.html), this weekend I wound down the Python version.

## What's new in sgac v0.3.0

SGAC v0.3.0 is Go-only.

![sgac vs sgac.py](/assets/images/sgac-go-00-comparison.png)

It's about 800% faster, but performance was never a problem for sgac.py: as I've always said in the old SGAC README, even the Python version was easy to deal with any log sizes and log files could always be chunked and parsed in parallel. 

Let's look at the important changes.

### New JSON schema

The new SGAC creates "non-native" column name in output and drops some fields. 

It no longer has a "1:1 mapping" to StorageGRID's audit log fields, so you can't just use v0.3.0 and pass JSONL to pre-existing users downstream. It would break their scripts or queries.

The reasons for this change are:
- The StorageGRID documentation for audit is not completely accurate, so there's no point in trying to create "correct" output from it
- The field names are cryptic, which isn't analysis-friendly 
- There's a lot of junk in those audit log entries
- If the StorageGRID documentation gets improved, or if I need some of the fields that are currently dropped, I may need to update the schema

So, while the schema is new, it's for the best. The new schema is documented (although it's also self-documented in Parquet files) and any changes in follow-up releases will be documented.

### Binaries only

I've simplified my life and closed the source.

I may give the source code in direct engagements, but I'm not going to maintain a public copy.

The binaries will remain available, free, and 100% offline-ready without any telemetry gathering or similar nonsense.

### Parquet output

SGAC (Python) had one output, JSON documents.

SGAC (Go) can output JSON or Parquet. It can also split output into multiple files and upload files to S3.

Since we're talking about **audit** logs here, I do not recommend uploading audit logs to the same StorageGRID that is supposed to be audited, just as I don't recommend using the StorageGRID "upload logs to a bucket" (anti-)feature:
- For buckets smaller than 10TB and with less than 50K Parquet entries in largest "prefix" ("directory level"), I recommend [Versity S3 Gateway attached to E-Series](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html). It costs nothing and can run it in a small VM. You can also upload data to StorageGRID if you need another copy
- For larger buckets, use another StorageGRID or other S3 object store
- If you don't need audit logs for auditing (i.e. don't need a copy elsewhere), it's fine to upload audit logs just to the StorageGRID which generates those logs

## Other stuff

SGAC (Python) stopped at generating "intermediate" output. If you wanted to do something with that output, additional steps where necessary before data could be effectively queried. 

Now we can also output to Parquet, upload those files to S3 and query them without moving data back.

SGAC had a similar feature in the 2020/11/03 release, when it stored data in a SQLite database. I abandoned that because someone wanted to put audit data in Elasticsearch and Opensearch, but the idea was correct and is now back in a datalake-friendly format.

You can still output to JSONL and ingest like you used to. But that is now optional and not a recommended practice, so you'll notice the SGAC (Go) README no longer features Kibana screenshots.

v0.3.0 has some simple queries for Parquet files to get people started. This is for "offline" Parquet files, but the SQL is the same:

```sql
SELECT DISTINCT client_ip FROM ('long-go.parquet') WHERE atyp IN ('SGET') ORDER BY client_ip;
```

Result:
```sh
┌───────────────┐
│   client_ip   │
│    varchar    │
├───────────────┤
│ 192.168.1.110 │
│ 192.168.1.125 │
│ 192.168.1.140 │
│ 192.168.1.164 │
│ 192.168.1.122 │
│ 192.168.1.119 │
│ 192.168.2.14  │
│ 212.140.30.23 │
└───────────────┘
```

If I publish new releases, analytics-related features will be be where most of my effort will go.

Audit logs are the only viable way to gain insights into what's happening on a grid but - as I've mentioned above - the documentation and breaking changes make that unreliable because it's hard to know whether you're missing something you shouldn't, or whether something that worked last week no longer works this week after a minor StorageGRID update. That remains outside of my control.

## Conclusion

I've successfully wound down another "0 ROI" open source project that had generated 0 feedback, 0 contributions and 0 bug reports over half a decade. Admittedly, it's not a complex project, but anyone who's properly maintained a Github project knows it doesn't require zero effort, either.

In 2026 I've created more (and non-trivial, like the CSI drivers or API client libraries) open source project than closed the source on existing, but the ROI on closed source ones (sg-COSI, OpenSharing server, Eke, etc.) has been better - I still waste time to get the familiar zero ROI, but I waste much less of it. I'll keep the fundamental OSS projects like CSI drivers and API client libraries open because they enable others to build (if they want), but the stuff that works on top of it... there's no reason to bother.

Anyway, as far as SGAC (Go) is concerned, it's still out there and free. I'll attempt to address the Github issues and feature requests, if any.

The new version provides a big performance and usability boost and I look forward to enhancing it for more actionable insights the way I started in 2020.
