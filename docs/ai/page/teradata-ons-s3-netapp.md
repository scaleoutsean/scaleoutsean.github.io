# Teradata Vantage with NetApp S3 object stores

Teradata with structured data on a nearby or remote S3-compatible Object Store

- [Introduction](#introduction)
- [Teradata Vantage](#teradata-vantage)
- [Impressive screenshot](#impressive-screenshot)
- [Choosing S3 Storage](#choosing-s3-storage)
  - [Officially supported](#officially-supported)
  - [Sequential performance](#sequential-performance)
  - [Scale of capacity](#scale-of-capacity)
  - [Random performance](#random-performance)
  - [Multi-site deployments](#multi-site-deployments)
- [Conclusion](#conclusion)

## Introduction

External tables on S3 are asn increasingly popular solution.

From the "built-in" (into the S3 API) S3 Select to Teradata, you can use S3 like a database.

As I've blogged on S3 Select and several other approaches, I'll keep this post short and focused.

## Teradata Vantage

Teradata Vantage is the next generation of the popular Teradata Database.

Native Object Store (NOS) is a Vantage capability that lets users use standard Teradata SQL and APIs to:

- Search and query CSV, JSON, and Parquet format datasets located on S3-compatible object store platforms
- Write data stored on Vantage or S3 object stores to S3-compatible object store platforms

Supported data types:

- File type (JSON, CSV, or Parquet)
- File compression (GZIP for JSON or CSV, SNAPPY for Parquet, or uncompressed)
- Character encoding (LATIN or UTF-8)
- Field delimiter (comma, tab, and so on)
- Record delimiter (line feed)

Unlike S3 Select, NOS can write and is much richer. For example, S3 Select can read Parquet files, but NOS can also read Delta Lake files and manifests. 

To find out more about their S3 integration, please visit their Web site!

## Impressive screenshot

As with most databases that can use external tables on S3, we need to create credentials and with that can define external tables on S3 which we can query using Teradata SQL like so:

![Teradata Studio v17.20](/assets/images/teradata-nos-s3.png)

In this screenshot I have S3 running at http://s54.datafabric.lan:80, and my CSV files are in the bucket `poly` (`s3:/poly/tables/`). I used HTTP simply because it allowed me to avoid setting up TLS in Teradata Studio.

## Choosing S3 Storage

These are some general rules-of-thumb as I see them as of September 2023.

### Officially supported

As of September '23, Teradata Vantage supports NetApp StorageGRID (see [this](https://docs.teradata.com/r/Enterprise_IntelliFlex_VMware/SQL-Data-Manipulation-Language/Working-with-External-Data)).

Based on my experience with ONTAP 9.12.1, ONTAP S3 appears to work fine with Teradata Studio but is currently not officially supported by Teradata. I'm not sure if Teradata insists on using supported S3 for production use or not.

### Sequential performance

For workloads that go to double-digit GB/s, consider StorageGRID. 

Less than that, ONTAP S3.

### Scale of capacity

- Big and medium S3 data stores: StorageGRID
- Small and medium: ONTAP S3

### Random performance

- StorageGRID has flash (SGF6112, SGF6024) and NL-SAS appliances for a variety of configurations (including heterogeneous clusters with in-cluster tiering)
- ONTAP S3 supports all media types, including QLC flash (C-Series) 

If your Teradata queries are random (this may be unlikely, but anyway...), you may want to consider all-flash appliances or (with StorageGRID) at least all-flash tier. 

Because random workloads require only small bandwidth, highly random workloads may not need large ONTAP appliances or scale-out features of StorageGRID. Although I think most Teradata customers have predominantly sequential workloads.

### Multi-site deployments

StorageGRID clusters can be easily stretched over two, three or more sites.

ONTAP S3 is currently good for single-site clusters (DR/BC is available with S3 SnapMirror feature, but a single ONTAP S3 cluster currently cannot stretch over multiple sites)

## Conclusion

Teradata Vantage integrates well with S3 and compared to some other vendors seems to be focused on Delta Lake, which makes the platform relatively more open and future-proof.

Among NetApp S3 object stores StorageGRID is definitively the better of two S3 options for Teradata: it is officially supported and covers a wide range of performance, capacity, scale, and sites - from 100TB to many PB.

ONTAP S3 is currently not supported by Teradata, but that may change. ONTAP S3 is easy to use and starts small - as it's included in ONTAP, existing owners just need to enable it and allocate 100 GB or more. 
ONTAP systems also support multiple protocols (data may live on NFS or block devices as well, so having multi-protocol support may be useful), so I think it's quite suitable for small-to-medium Teradata Vantage S3 environments.
