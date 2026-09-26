# Microsoft SQL Server data virtualization PolyBase with S3 Object Stores

Use SQL Server to access structured data on a nearby or remote S3-compatible Object Store

- [What, why and how](#what-why-and-how)
  - [HTTP](#http)
  - [Access from SQL Server](#access-from-sql-server)
  - [Where does Docker come in](#where-does-docker-come-in)
  - [Other S3 clients](#other-s3-clients)
  - [Backup use case](#backup-use-case)
- [Compatibility](#compatibility)
- [Conclusion](#conclusion)

## What, why and how

PolyBase is a data virtualization feature in Microsoft SQL Server and Azure Synapse Analytics. What does it do?

> PolyBase enables your SQL Server instance to query data with T-SQL directly from SQL Server, Oracle, Teradata, MongoDB, Hadoop clusters, Cosmos DB, and S3-compatible object storage without separately installing client connection software.

As you can see S3 isn't the only protocol, but it's a popular and growing one.

[This page](https://learn.microsoft.com/en-us/sql/relational-databases/polybase/polybase-versioned-feature-summary?view=sql-server-ver16) contains the details of which SQL Server features work with which version, but S3 OPENROWSET and EXTERNAL TABLES can be used to query data files in S3-compatible object storage.

If this sounds like [S3 Select](/2022/03/04/storagegrid-s3-select.html), that's about right. Instead of using an S3 client, we use SQL (which in turn uses its built-in S3 client).

Why would we use that rather than copy data to a network share and used external tables on NAS? Because that doesn't help us more - we need to have a network share, copy the (file), and ultimately get the same outcome. Not to mention that sometimes we need only a subset of original data, so why not access it remotely, avoid copying, use superior (HTTPS) security, and fetch only what we need?

How to use it with cloud-based S3 storage is already well documented. What about on-premises S3 object stores and hybrid cloud deployments?

It's very similar:

- to access your on-premises S3 bucket, you need FQDN for your API endpoint, TLS to protect data, and inbound firewall access
- internal (LAN, VPN) access is similar, except that connections can be based on internal DNS

![SQL Server with PolyBase on S3 Compatible Storage](/assets/images/sql-server-polybase-s3-hybrid-cloud.png)

MS SQL Server uses `WinHttp` (Microsoft Windows HTTP Services) to communicate with HTTP(S) (including S3 endpoints), so the base on which it's built is rock solid.

### HTTP

Why does the LAN example have http? Because SQL Server isn't the only client that needs to access S3 data:

- there may be other S3 clients, some of which have no ability to use HTTPS
- there may be other S3 clients which cannot use custom TLS certificates so HTTPS isn't an option
- there may be environments which don't have ADS or other CA on all locations (even if the HQs have it, some remote site may not)
- maybe MS SQL Server will allow HTTP (maybe it allows it now, I haven't tested, but the documentation seems to imply only HTTPS is supported) one day

The first three scenarios are often seen in environments with embedded systems, especially manufacturing and IoT.

Since those clients often have the option to use NFS v3 or SMB 2.0, using HTTP to PUT data can actually be comparatively more secure for both the client and the data.

Either way, data flows in from IoT, logging clients or other systems, and lands on S3. 

### Access from SQL Server

Then it can be converted, cleansed, and enriched if need be. "Finalized" data can be moved to a different bucket for SQL Server access.

Finally, SQL Server can use `OPENROWSET` or name external tables to perform analytics or ingest that data to other tables or databases. 

SQL Server currently supports CSV and Parquet files. This is how querying `OPENROWSET` looks like:

![SQL Server query of CSV and Parquet files over S3](/assets/images/sql-server-polybase-s3-csv-s3-select.png)

Using `EXTERNAL TABLES` is similar. In both cases, we need to first define S3 credentials (this is database-scoped) and data source inside of database. At that point OPENROWSET can work. EXTERNAL TABLES require or or two additional steps clearly explained in the MS SQL documentation. Read about configuring SQL Server for PolyBase on S3 [here](https://learn.microsoft.com/en-us/sql/relational-databases/polybase/polybase-configure-s3-compatible?view=sql-server-ver16).

### Where does Docker come in

It doesn't. I did these demos using SQL Server for Linux (preview for Ubuntu 22.04), i.e. no Docker.

But the same SQL Server can run on Docker CE or Kubernetes. I tried the Docker version and it works fine. 

In my opinion SQL Server is easier to manage on Linux than on Windows, so I recommend containerized SQL Server to folks who don't need features that depend on Windows, and have some basic Linux skills. 

Authentication is still a big challenge for Linux - Windows has a big advantage in this area.

### Other S3 clients

Do not miss the detail that once data is on S3 accessible to SQL Server, you can *still* access it with S3 Select, Python or whatever other methods you prefer.

We wouldn't want to edit data that's actively also used by SQL Server, especially not EXTERNAL TABLES, but concurrent read-only access is fine.

Some examples of how that could work may be viewed [here](https://rumble.com/v32foe0-simple-multi-site-or-hybrid-cloud-workflow-for-s3-analytics-with-ontap-s3.html).

Unlike some of the other PolyBase options, S3 is one those that are easy to maintain and (license-wise) free to access which is a big factor in TCO.

### Backup use case

Unrelated to PolyBase: since S3 client is in SQL Server, there's no reason to not be able to backup to, and restore from, S3.

In this example I backup master database to S3 bucket located on-premises (that is, it backs up to an FQDN S3 location on the Internet).

![SQL Server backup to S3](/assets/images/sql-server-backup-to-s3.png)

Backups can be mirrored to multiple S3 buckets, giving you the ability to make a local and remote backup to S3 at the same time. There are options to enable compression and other features not seen in the screenshot.

## Compatibility

Microsoft doesn't seem to have a strict S3 compatibility list for PolyBase, but they list some S3 storage providers [here](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/sql-server-backup-and-restore-with-s3-compatible-object-storage?view=sql-server-ver16#providers-of-s3-compatible-object-storage).

I haven't looked at what S3 API methods PolyBase uses, but they seems generic and simple. Both S3 servers from NetApp should work (StorageGRID, ONTAP S3), as should MinIO backed by E-Series. 

[This post](https://www.netapp.com/blog/microsoft-sql-server-big-data-clusters-with-storagegrid/) on PolyBase with `s3a` and HDFS does not apply to this use case - it's "HDFS over S3", not PolyBase with native S3.

For large scale and multi-site I'd consider StorageGRID, for small-to-medium scale with easy setup and management I'd consider NetApp. 

## Conclusion

In its core PolyBase is similar to S3 Select. High-end analytics software such as Snowflake (see [Configuring a Snowflake Storage Integration to Access Amazon S3](https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration)) use this for data loading, and SQL Server can do it, too.

To its advantage, SQL Server has:

- huge installed base
- customers with existing SQL Server skills
- ability to deploy on-premises or in the cloud
- compared to simpler approaches  such as S3 Select, SQL Server has excellent security-related features and is more appropriate for sensitive data

Regarding this last point: access that needs to be audited can benefit from a thicker stack such as SQL Server. While read-only access to S3 prevents tampering, leaks, data theft and access auditing are still something that many users need to do, either at the firewall and S3 object store level, or at the client (SQL Server, for example). SQL Server can do it all: AD integration, RBAC, auditing and more.

The ability to backup to S3 makes it easy to use the same or different S3 storage for on-site or off-site backup.
