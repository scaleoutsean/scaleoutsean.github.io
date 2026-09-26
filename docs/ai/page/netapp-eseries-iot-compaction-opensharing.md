# IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series

Package IoT sensor data and make it ready for OpenSharing clients

- PART ONE: [Does OpenSharing have anything for NetApp E-Series?](https://scaleoutsean.github.io/2026/06/14/netapp-eseries-opensharing-deltasharing.html)
- **PART TWO:** IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series
- PART THREE: [NetApp volume content sharing with OpenSharing and Versity S3 Gateway](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html)
- PART FOUR: [OpenSharing server for NetApp StorageGRID and E-Series with Versity S3 Gateway](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html)
- PART FIVE: [OpenSharing Server with S3/RDMA-based Versity S3 Gateway](/2026/08/10/opensharing-with-versity-s3-rdma-and-netapp-eseries.html)

## Introduction

This post wraps up my initial exploration of OpenSharing with Versity S3 Gateway and NetApp E-Series for a use case I've seen before, but did not have time to explore at the time.

- Application sends super-tiny IoT data to S3 (000s per second)
- In order to "fix it", a super-duper scale-out architecture was under consideration

That was obviously the wrong way to do it. There are several patterns to deal with this and there's nothing new I can share about that, but after I created a simple [OpenSharing server for sharing tables using Versity S3 Gateway and E-Series](/2026/06/14/netapp-eseries-opensharing-deltasharing.html), I remembered that situation and thought whether OpenSharing could be used here.

That's peripheral to the problem, but it's related to overall architecture so it seems interesting, especially because the result is **incredibly modest** hardware requirements compared to what was being considered at the time.

In fact, it would be hard to justify proposing anything but the minimal, entry-level, all-HDD-based E4012 for this. What was being considered at the time cost 10-20x more.

As an aside, I did explore a brute-force approach in [this post](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html) and the funny part was that brute force worked... almost. Versity S3 Gateway on EF-Series fully worked performance-wise, but the approach wasn't workable because, at 1,000 objects per second, it'd take just two weeks to get to 1 billion. So, extra steps were needed and unavoidable.

## High volume IoT ingress with OpenSharing

IoT sensors are sending tiny JSON files a rate of 1,000 per second.

These JSON files should't be dumped to S3. Instead, we should send them to a message queue or write them directly to a database (e.g. InfluxDB).

I used a message queue, where I set up a Consumer that gets these tiny messages in batches every few seconds, and packages them into tables. These tables *and* their manifests are then uploaded to Versity S3 Gateway over S3.

How many JSON documents every how many seconds? We could do 5,000 every five seconds or 35K every 35 seconds - that makes no difference to our approach. If we batch every five seconds, we'd end up with more table files and have to consolidate more often. If we batch once every 60 seconds, we'd end up with just 1,440 tables per day. That's in steps 1, 2 and 3.

![IoT ingress](/assets/images/opensharing-eseries-12-eseries-vgw-iot-compaction-opensharing.png)

The parts that are interesting to me are 4, 5 and 6:

- Step (4): because in Step 3 we upload tables and manifests in Delta Lake table format, our OpenSharing API server is fully aware of latest status whenever queried
- Step (5): user's Delta Lake client application queries the OpenSharing API server and always has the correct view and latest information
- Step (6): I [blogged about table compaction](/2026/06/15/netapp-eseries-iceberg-table-compaction.html) with an emphasis on the fact that Versity S3 Gateway is a stateless gateway on E-Series volumes, which makes it possible to **write and compact tables without using S3**
  
In our diagram steps (3) and (6) use S3, but these could bypass S3 and use underlying filesystem.

Imagine we needed to query latest data within 5 seconds.

That means we'd have to create tables every 3 seconds.

That also means we'd end up with (at least) 20 tables per minute, or 28,880 tables per day. That is an immediate problem (on day 1), if not for S3 service which can handle it, but for client applications that would wait seconds to get responses.

So, in step (6) we would likely have to compact tables on two schedules - for example, once every five minutes for tiny new tables, and once a day for tables older than 24 hours. If we bypassed S3 to do that as I suggest in the table compaction post, that would let us perform compaction with even less resources and still without breaking OpenSharing API.

## Steps in detail

Steps (2) and (3):

```sh
$ python3 ./subscriber.py 
Listening for messages... Batches of 6000
Aggregated 6000 messages. Writing to S3 as OpenSharing-ready Delta table...
Write successful!
Aggregated 6000 messages. Writing to S3 as OpenSharing-ready Delta table...
Write successful!
Aggregated 6000 messages. Writing to S3 as OpenSharing-ready Delta table...
Write successful!
...
```

Table data on S3:

```sh
$ mc ls vgw/default-bucket/
[2026-06-16 16:09:53 CST]  60KiB STANDARD part-00000-02d30f6c-2f03-467f-be47-c71016691907-c000.snappy.parquet
[2026-06-16 13:48:48 CST]  60KiB STANDARD part-00000-05947538-6666-4050-89c4-cef1485b6e64-c000.snappy.parquet
[2026-06-16 14:11:27 CST]  60KiB STANDARD part-00000-1171de56-969d-4a88-97c1-75abb8ff1e52-c000.snappy.parquet
[2026-06-16 14:08:55 CST]  60KiB STANDARD part-00000-15355253-32b1-481b-8003-659799e4c950-c000.snappy.parquet
...
```

Table metadata on S3 (created by Consumer to prepare data for OpenSharing application server):

```sh
$ mc --insecure ls vgw/default-bucket/_delta_log/
[2026-06-16 13:01:04 CST] 2.1KiB STANDARD 00000000000000000000.json
[2026-06-16 13:03:35 CST] 1.2KiB STANDARD 00000000000000000001.json
[2026-06-16 13:06:06 CST] 1.2KiB STANDARD 00000000000000000002.json
[2026-06-16 13:08:36 CST] 1.2KiB STANDARD 00000000000000000003.json
```

Metadata content sample (00000000000000000001.json):

```json
{
  "commitInfo": {
    "timestamp": 1781586215458,
    "operation": "WRITE",
    "operationParameters": {
      "mode": "Append"
    },
    "engineInfo": "delta-rs:py-1.6.0",
    "operationMetrics": {
      "execution_time_ms": 126,
      "num_added_files": 1,
      "num_added_rows": 6000,
      "num_partitions": 0,
      "num_removed_files": 0
    },
    "clientVersion": "delta-rs.py-1.6.0"
  }
}
{
  "add": {
    "path": "part-00000-e92484f6-3805-450e-a5f9-5a9cb28a4e21-c000.snappy.parquet",
    "partitionValues": {},
    "size": 61696,
    "modificationTime": 1781586215458,
    "dataChange": true,
    "stats": "{\"numRecords\":6000,\"minValues\":{\"timestamp\":\"2026-06-16T04:05:25.091803\",\"Lon\":14.397161607184112,\"device_id\":\"sensor-1\",\"Humidity\":0.02,\"Lat\":50.07733128611952,\"CO2\":301,\"Temperature\":-9.91,\"Pressure\":900.16,\"TVOC\":0},\"maxValues\":{\"CO2\":1995,\"Pressure\":1099.88,\"device_id\":\"sensor-99\",\"Lon\":14.417148152026645,\"timestamp\":\"2026-06-16T04:05:35.571317\",\"TVOC\":500,\"Temperature\":39.97,\"Lat\":50.09730666632498,\"Humidity\":99.97},\"nullCount\":{\"Humidity\":0,\"Temperature\":0,\"Pressure\":0,\"device_id\":0,\"Lon\":0,\"TVOC\":0,\"Lat\":0,\"timestamp\":0,\"CO2\":0}}",
    "tags": null,
    "baseRowId": null,
    "defaultRowCommitVersion": null,
    "clusteringProvider": null
  }
}

```

Summary of stats that have been added in a batch (from 00000000000000000001.json):

```json
{
  "numRecords": 6000,
  "minValues": {
    "timestamp": "2026-06-16T04:05:25.091803",
    "Lon": 14.397161607184112,
    "device_id": "sensor-1",
    "Humidity": 0.02,
    "Lat": 50.07733128611952,
    "CO2": 301,
    "Temperature": -9.91,
    "Pressure": 900.16,
    "TVOC": 0
  },
  "maxValues": {
    "CO2": 1995,
    "Pressure": 1099.88,
    "device_id": "sensor-99",
    "Lon": 14.417148152026645,
    "timestamp": "2026-06-16T04:05:35.571317",
    "TVOC": 500,
    "Temperature": 39.97,
    "Lat": 50.09730666632498,
    "Humidity": 99.97
  },
  "nullCount": {
    "Humidity": 0,
    "Temperature": 0,
    "Pressure": 0,
    "device_id": 0,
    "Lon": 0,
    "TVOC": 0,
    "Lat": 0,
    "timestamp": 0,
    "CO2": 0
  }
}
```

Now, our OpenSharing API client does not list S3 objects or try to figure out what those S3 files are (it can't even access them without OpenSharing API server's help).

Instead, it queries the OpenSharing API, learns everything it needs to know about the tables and can perform zero-copy queries on tables.

```sh
$ python3 ./duckdb_client.py 
Installing and loading httpfs extension for S3/HTTP requests...
Querying the OpenSharing API to fetch presigned payload URLs...
Discovered 830 compacted/raw Parquet files linked by the server.

--- Summary Count ---
┌───────────────┐
│ total_records │
│     int64     │
├───────────────┤
│        672000 │
└───────────────┘

--- Temperature Warnings (> 35°C) grouped by coordinates ---
┌──────────┬───────────┬────────────┬──────────┐
│ latitude │ longitude │ hot_alerts │ max_temp │
│  double  │  double   │   int64    │  double  │
├──────────┼───────────┼────────────┼──────────┤
│    50.09 │     14.41 │      17029 │     40.0 │
│    50.09 │      14.4 │      13246 │     40.0 │
│    50.08 │     14.41 │      12758 │     40.0 │
│    50.08 │      14.4 │       9989 │     40.0 │
│     50.1 │     14.41 │       3939 │     40.0 │
└──────────┴───────────┴────────────┴──────────┘

```
Executed later, client now detects of 1,730 tables (previously 830):

```sh
$ python3 ./duckdb_client.py 
Installing and loading httpfs extension for S3/HTTP requests...
Querying the OpenSharing API to fetch presigned payload URLs...
Discovered 1730 compacted/raw Parquet files linked by the server.

--- Summary Count ---
┌───────────────┐
│ total_records │
│     int64     │
├───────────────┤
│       1122000 │
└───────────────┘
...
```

This shows our packaging doesn't break OpenSharing API server and works completely transparently to clients.

A comment about "fast" table generation (every 5 seconds) in the video demo:

| Data Points/s | Batch interval | Table size | Comment |
| ----          | ----           | --------   | :----   |
| 100           | 5s             | super tiny | Queryable in ~5s |
| 100           | 60s            | very tiny  | Queryable in ~60s |

Originally I was using a 60 second interval, but later (also in the demo video) I made it shorter.

With a small 5s interval, data becomes queryable within seconds.

But a big downside is we're creating super tiny tables.

![Need for table compaction](/assets/images/opensharing-eseries-13-eseries-vgw-iot-compaction-need.png)

We're up to 2,000 tables within hours. While that's better than storing over 1 million JSON files (number of records in these tables), our OpenSharing API service, as well as client queries, will soon start slowing down.

We should aim for a much larger table size (see the compaction post), so we can either:

- Increase table packaging interval to 60 or 600 seconds, and/or
- Use multiple compaction schedules

We could package tables every 5 seconds, then every 10 minutes compact tables aged between 1-10 minutes, then run another schedule for tables aged between 10 minutes and one day...

This kind of frequent compaction sounds attractive, but can be taxing on the S3 service.

Due to Versity S3 Gateway's stateless nature both our Consumer and Compactor services can bypass S3 protocol and work on filesystem level. With the Versity S3 Gateway running on BeeGFS, for example, you could get to the table files from BeeGFS clients over RDMA.

## Conclusion

I'm sure there are even better ways to do this, but compared to what was perceived as a solution to that problem, this approach with batching and OpenSharing API shows a better way with just a tiny fraction of resources. Three 1U servers running Kubernetes, directly attached to an entry-level E-Series E4000 array, would still be an overkill for 1,000 IoT records per second.

OpenSharing makes it easy to add intelligence to object stores without needing an extra service ("a database about databases") or having to immediately send data to a full-featured data lake.

![OpenSharing client in action](/assets/images/opensharing-eseries-14-duckdb-client-opensharing-api.png)

The option to bypass S3 when writing and compacting tables means tables can be compacted on a very short schedules, which saves resources and shortens time to insight compared to scale-out approaches where S3 cannot be bypassed. (Yes, I do know there are other ways to achieve that, but they may not be feasible or convenient.)

Another consequence of Versity S3 Gateway's stateless nature is we can use rsync (rather than rclone or other S3 clients) to upload table data to a remote location for backup or disaster recovery purposes. This isn't to say you *shouldn't* use rclone or an OpenSharing client for that, but that you *can* use other approaches if you need to.

Rather than deploying a costly scale-out object store that can serve thousands of requests per second, we use a very simple stack to deliver insights within seconds and make data available for efficient consumption by analytics applications.

## Appendix A: Demo 

- [IoT and OpenSharing with Versity S3 Gateway](https://rumble.com/v7bdcp4-opensharing-with-versity-s3-gateway-and-netapp-e-series.html) - 3m37s
