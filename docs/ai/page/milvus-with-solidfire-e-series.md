# Milvus with NetApp SolidFire and E-Series

Observations from using Milvus with NetApp SolidFire and E-Series

- [WTF is Milvus](#wtf-is-milvus)
- [Storage-related stuff](#storage-related-stuff)
  - [Meta storage (etcd)](#meta-storage-etcd)
  - [Logs and queues](#logs-and-queues)
  - [Object store](#object-store)
  - [Storage efficiency](#storage-efficiency)
  - [High availability of block and S3 storage services](#high-availability-of-block-and-s3-storage-services)
- [Aggregate performance on E-Series](#aggregate-performance-on-e-series)

## WTF is Milvus

Milvus is a vector database built for scalable similarity search. 

## Storage-related stuff

To get Milvus up and running I first RTFM. One of deployment options available that fit my existing environment* was Milvus Standalone - local Milvus that can be started with Docker Compose. (* I officially don't work this week, so I didn't want to go out of my way to try it out. I had three SolidFire volumes mounted from my recent [Kafka efficiency testing](/2022/07/05/kafka-solidfire-efficiency.html), so I used those). The volumes:

- etcd - as the name suggests, Milvus Standalone uses singleton etcd instance for cluster metadata
- standalone - location for local Milvus data when Milvus is deployed in stand-alone mode
- object store - volume for S3, currently must be Minio-based, where Milvus moves sealed segments when it's done indexing them

Normally things are more complicated - not all-in-one (Standalone), that is.

![Volume performance and IO request sizes](/assets/images/milvus-bench-01-services-storage.png)

Source: Milvus v2.0 ([documentation](https://milvus.io/docs/))

I don't have the resources to do this easily right now, so for time being I'll stick with Milvus Standalone. Let's see about those three volumes used by docker compose file for Milvus Standalone.

### Meta storage (etcd)

etcd I/O is small and the workload not a novelty since we know it from Kubernetes.

For that we'd just provision a volume (or volumes, for larger clusters) on SSD storage. SolidFire is all-flash, so we'd just set Min IOPS on each such volume to say 5,000 IOPS. E-Series has no QoS settings, so we'd simply create an SSD-backed volume for each instance of etcd.

### Logs and queues

Milvus Standalone uses just one volume, which I think keeps just message logs on this persistent volume. This workload could be be similar to Kafka (in fact, Milvus supports Pulsar and Kafka for message storage, but Milvus Standalone uses RocksMQ). 

For small-to-medium Milvus, SolidFire should be fine, but for large check out E-Series EF300 or EF600 - this is the same recipe that we would use for [S3-tiered Kafka](/2022/06/28/kafka-eseries-object-storage.html).

Capacity-wise I expect few tens of GB of log space should be enough for Milvus Standalone (even more, but in the case S3 goes down, some time to retry uploads should be allowed), but we need to remember that production clusters are different (there are more containers, some are not even stateful, and stateful volumes may need different sizes), so I'll take another look when I build a larger Milvus cluster.

### Object store

Object Store workload is 100% write when there's no query/search workload, and because uploading data to S3 deals with entire segments, these are large (1MB+) writes. I'm not sure how reads work in terms of request sizes, but I expect smaller reads (index data) combined with full segment downloads, so large and medium read requests. It'd be wasteful to run this off SolidFire; it's OK for up to perhaps 1 GB/s, but large Minio runs better on E-Series and NetApp StorageGRID does too (and for large Milvus clusters we'd use dedicated StorageGRID appliances [that we can also use for Kafka](/2022/06/28/kafka-eseries-object-storage.html)).

My SolidFire "cluster" at home is a small VM, which means I couldn't properly benchmark Milvus with it, but even this environment provided some insights regarding possible I/O patterns.

In a small "INSERT" test I did, the first volume (ID 613; etcd) was mostly write workload that consisted of small-request sizes, the second volume (ID 614; S3 service) had a similar pattern due to Milvus tiering data to it, while the third volume (ID 615) was was mostly large-size IO.

![Volume performance and IO request sizes](/assets/images/milvus-bench-02-io-sizes.png)

Workloads on S3 (ID 614) and Milvus Standalone (ID 615; chart below) were similar, which wasn't unexpected because data first lands on Milvus data volume and after indexing, it's moved to S3.

![Milvus MinIO workload](/assets/images/milvus-bench-03-io-request-write-medium-size.png)

As I said above, normally we wouldn't use SolidFire for Minio back-end - we want less fancy storage for that - so the S3 workload would be the first to go (to E-Series or StorageGRID) if we wanted to deploy Milvus in production. As mentioned above, Milvus seems to currently only support Minio which will probably change in coming months (I don't have any "inside info", I only know what other enterprise who prototype stuff with Minio eventually do).

The rest would then be similar to other databases that write to S3 (when they cool data), and read from S3 (to download, decompress and search).

### Storage efficiency

Milvus can be very storage-efficient, so don't expect much in terms of savings from storage array compression and deduplication.

After using random data to populate Milvus Standalone, observed SolidFire efficiency was only 1.04x (4% savings) from deduplication and compression. This may be better with real-life data and given that Milvus doesn't need a lot of capacity on local tier it's not a big deal, but be cautious when counting on storage efficiencies if your available space is very tight (< 1 TB). I may run additional tests with real-life data if need arises.

E-Series has no compression and deduplication so we don't need to mind this section.

### High availability of block and S3 storage services

Production clusters would have multiple replicas for etcd, messaging, index, and data. We could place redundant copies on one E-Series array or SolidFire cluster (both have redundant components), but to get even better redundancy we'd deploy two or three storage back-ends across two or three sites. A lower cost version of this could probably use self-deployed Milvus in the public cloud (if the license allows it, I haven't checked).

E-Series array capacity could be shared between Milvus and StorageGRID SDS, and located all on the same site, or one array per each site. I'd recommend this for medium sites with geo-cluster requirements. Milvus microservices and StorageGRID both rely on software-based replication so neither E-Series nor SolidFire replication would need to be used.

If dedicated StorageGRID appliances were used for S3 service (in addition to E-Series for block storage), we'd need at least three StorageGRID appliances (either per site, for highest availability, or all together (one appliance per site, with limited site redundancy at a lower cost)).

## Aggregate performance on E-Series

Inserting 10 million records with RF1 (ni_per 50000, WAL enabled (local disk), and nlist 1024):

- rps: 47029.11
- flush_time: 2.51
- index build time: 13.96 (runs 4, 5, 6)
- Test environment: single dual-CPU Xeon 6130 connected via iSER to external volume on EF all-flash array; etcd, Minio and Milvus WAL all on one 100GB RAID1 volume (backed by just 2 SSDs on E-Series)

When inserting records (indexing: off, RF1), CPU utilization was very low, and disk I/O was not significant even with WAL and Minio included

![Inserting records with indexing OFF](/assets/images/milvus-e-series-6130-ef570-insert.png)

Three runs as viewed in E-Series SANtricity Web UI (IOs are slightly smoothed compared to dstat output that has 1s granularity):

![SANtricity view of inserting records with indexing OFF](/assets/images/milvus-e-series-6130-ef570-insert-santricity.png)

Same run but with indexing on (index type ivf_sq8) looks a bit different, with indexing no longer deferred there's a lot more CPU utilization.

![Inserting records with indexing ON](/assets/images/milvus-e-series-6130-ef570-insert-index.png)

Three runs of each type were executed; in hindsight I wonder if the 3rd test was with indexing on (reads were negligible), but I can't confirm it.

![SANtricity view of inserting records with indexing OFF (runs 1-3) and ON](/assets/images/milvus-e-series-6130-ef570-insert-index-santricity.png)

What we can see from these examples is that inserting from a single node (RF1) didn't cross 500 MB/s and that's all-inclusive, with Minio, etcd and WAL all on one device. Although the server was connected to E-Series with iSER, it appears even 25Gbps iSCSI should work fine (or FC, NVMe/FC, etc.).

Even with RF2 the smaller of two current all-flash models (EF300) could likely host half a dozen Milvus nodes, especially if S3 was hosted externally and if workload wasn't 100% insert (e.g. with 50% insert and 50% search the number of Milvus nodes could probably be doubled or tripled).
