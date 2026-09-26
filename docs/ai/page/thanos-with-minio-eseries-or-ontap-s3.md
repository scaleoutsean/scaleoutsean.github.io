# Thanos with StorageGRID, ONTAP S3 and MinIO on E-Series

Pointers for Thanos with various NetApp storage backends

## Introduction

Thanos' object storage component seems to use S3-compliant object stores in reasonably simple ways which lead me to believe it should be easy to get working.

In this post I examine different choices and mention some high-level guidelines to help NetApp customers determine what may be better for them.

## Architecture

I don't want to rehash what so many sites explain perfectly well: basically it's "if you use Prometheus you can add Thanos to it, and Thanos will help you evacuate data to S3 which lowers the cost of storing Prometheus metrics and solves some other challenges". (Image credit: Corelogix)

![Prometheus-Thanos-Grafana relationship](/assets/images/thanos-minio-eseries-ontap-s3-01.png)

The topmost Thanos (Thanos Sidecar) is the main one that's "added" to Prometheus deployments.

Splunk SmartStore, Loki, Kafka and others use similar approaches in tiering: data is first gathered in a hot tier and then moved to S3. Sometimes it's "ASAP", other times when it hits certain age or fullness watermark.

## General storage thoughts

Thanos doesn't require all-flash S3 object stores, but you can certainly use such media. Small (say, 50TB these days) object stores are cheaper to deploy on existing all-flash arrays, especially if query workload is high (Thanos has group cache which may offload some queries from S3) it may be a good way to save time. 

All modern storage supports flash, and some (E-Series, ONTAP) also support NL-SAS which is still a great choice for very large (PB+) object stores.

- If you own an all flash array, it may be cheaper to deploy a 20TB software-defined S3 application for Thanos than buy dedicated S3 storage
- If you have a hybrid storage array with SSDs used by Kubernetes and need to add 1.4PB for Thanos - well, it will likely be cheaper to buy 96 18TB NL-SAS drives (or NL-SAS based S3 appliance nodes) 

### NetApp StorageGRID

StorageGRID is the main S3 object storage software that NetApp has.

It scales out to dozens of PBs, provides multi-site access (and it can provide strong consistency across sites), and users usually buy engineered appliances (some of the hardware leverages E-Series arrays) which are hardened, integrated and take less time to deploy. 

If you need very reliable object storage with DR capability or need to access it locally at multiple sites, StorageGRID will do that better than the other two.

Because StorageGRID requires at least three nodes, it will work better for around 300TB or more of S3 storage capacity.

### NetApp E-Series with MinIO

MinIO, of course, isn't a NetApp product, but it is an open source object store that works in many environments. That includes x64 Linux servers attached to NetApp E-Series.

MinIO seems to be the "default" object store used for testing and evaluation in many projects, including Thanos, so we don't need to worry if it can work.

The free version costs nothing, but it does make the user in charge of maintaining the OS or at least the MinIO container (if you run it containerized). 

Multi-site features are not as good as StorageGRID's, but it may be good enough for single site Thanos deployments, especially where budget is limited. 

You can see [here](/2022/10/21/minio-performance-netapp-e-series.html) - it's easy to achieve multiple gigabytes per second (using MinIO in a single VM, without any multi-VM scaling).

Thanos' MinIO bucket could work off NL-SAS volumes (blue; RAID6 or DDP), and "hot" tier could use flash storage (red; I'd recommend RAID 10 or DDP). 

![MinIO with E-Series](/assets/images/thanos-minio-eseries-ontap-s3-02.png)

As mentioned earlier, I wouldn't attempt to stretch MinIO across sites: I'd use this approach in single site deployments or when replication is done externally (in Thanos layer) so that MinIO at each site still works unaware of replication.

### NetApp ONTAP S3

ONTAP S3 is the latest protocol available on unified ONTAP appliances which started as NAS and added SAN functionality after that.

As we provision storage resources, we can choose to enable S3 protocol. From there it takes 2-3 steps to configure accounts and create access and secret keys and we get a very low maintenance Object Store!

![ONTAP SVM](/assets/images/thanos-minio-eseries-ontap-s3-12-ontap-svm.png)

There's no scale out for S3 service and no multi-site capability (as of the current version 9.13.1), but performance is good and ONTAP S3 requires very little maintenance.

ONTAP S3 has best Kubernetes and VI support among NetApp storage, so non-S3 advantages include excellent VMware and Kubernetes integrations which comes handy if you want to use the same array for container or VM orchestration software.

## Dedicated vs. unified object storage

StorageGRID and MinIO clusters offer S3 only. Even if you want a dedicated S3-only storage appliance, you still need a place to run Thanos, Prometheus, Grafana, and other applications.

E-Series offers block services (iSCSI, FC, etc.) and ONTAP offers even more, so S3 here becomes one of several services used by applications.

Like in the schematic for MinIO with E-Series, these days containerized or virtualized applications would use flash storage (NFS or block) in addition to S3 used by Thanos. 

Organizations with smaller data footprints usually choose unified storage appliances (e.g. ONTAP), or block storage such as E-Series where S3 software services use E-Series block storage. 

ONTAP S3 and MinIO with E-Series can start very small (e.g. 100GB) alongside other workloads, and grow to PB. 

## Thanos walk-through

Since MinIO is well-tested and commonly used with Thanos, I tried Thanos with ONTAP S3. If you're interested in MinIO and E-Series, please see the archive or use the search feature to find posts about this combination.

Multiple Prometheus instances can work with multiple Thanos Sidecar instances, and use one and the same S3 bucket.

```sh
CONTAINER ID   NAMES            STATUS       PORTS
f474068e2411   prometheus_one   Up 2 hours   0.0.0.0:9001->9001/tcp, :::9001->9001/tcp, 9090/tcp
b13dd9fc37c1   prometheus_two   Up 2 hours   9002/tcp, 9090/tcp

```

To integrate Thanos, we need two sidecars, one for each Prometheus instance, and few other containers including Thanos Query Frontend.

```sh
CONTAINER ID   NAMES                   STATUS       PORTS
2a39d8016101   thanos_query_frontend   Up 2 hours   0.0.0.0:19090->19090/tcp, :::19090->19090/tcp
1322a61e2c69   thanos_compactor        Up 2 hours   10901/tcp, 0.0.0.0:10922->10902/tcp, :::10922->10902/tcp
d733844ba1f1   thanos_sidecar_one      Up 2 hours   10901-10902/tcp
926be081aa9c   thanos_sidecar_two      Up 2 hours   10901-10902/tcp
8c4f3f32d9bc   thanos_querier          Up 2 hours   10901/tcp, 0.0.0.0:10902->10902/tcp, :::10902->10902/tcp
721d3d05f79c   thanos_store            Up 2 hours   10901/tcp, 0.0.0.0:10912->10902/tcp, :::10912->10902/tcp

```

Prometheus was a recent version from July 25, while Thanos was built from current source (July 27).

![Prometheus and Thanos versions used](/assets/images/thanos-minio-eseries-ontap-s3-07-thanos-prometheus-versions.png)

Thanos sidecars were configured to use the bucket named `backup`. Thanos lets us use HTTP which is what I used.

![ONTAP S3 bucket for Thanos](/assets/images/thanos-minio-eseries-ontap-s3-04-ontap-s3-bucket.png)

On ONTAP, S3 service may be enabled - along other protocols - in virtualized configurations called SVMs (Storage Virtual Machines). 

SVM also has a per-protocol performance monitor which here shows there's regular but low activity from our two Thanos sidecar instances.

![ONTAP SVM performance monitor for S3](/assets/images/thanos-minio-eseries-ontap-s3-05-ontap-svm-s3-perfmon.png)

Thanos creates multiple "random" paths underneath which it stores its data and metadata. Here there's a 58 MiB data chunk from Prometheus instance number two.

![Thanos S3 bucket data](/assets/images/thanos-minio-eseries-ontap-s3-06-thanos-bucket-data.png)

Accessing Thanos Query Frontend and the same from Prometheus, we can see that they look quite similar. Except for MinIO - which was down because I used ONTAP S3 - all services were up and running.

![Prometheus and Thanos container services](/assets/images/thanos-minio-eseries-ontap-s3-08-thanos-prometheus-running.png)

Grafana, using this Thanos back-end, was able to query Prometheus metrics from Thanos. And not only that, it was able to obtain multi-hour metrics.

![Grafana with Thanos backend](/assets/images/thanos-minio-eseries-ontap-s3-09-thanos-grafana-query.png)

That is significant - I think - because Prometheus by default retains two hours of metrics, so querying Prometheus should show only metrics for the past two hours, while querying the same metric in Thanos should go multiple hours.

![Prometheus vs Thanos data rentetion](/assets/images/thanos-minio-eseries-ontap-s3-10-thanos-prometheus-query.png)

And indeed, by now Thanos (and Prometheus) have been up for 15 hours, so it makes sense that Grafana and Thanos show metrics for multiple hours.

```sh
CONTAINER ID   NAMES                   STATUS        PORTS
2a39d8016101   thanos_query_frontend   Up 15 hours   0.0.0.0:19090->19090/tcp, :::19090->19090/tcp
1322a61e2c69   thanos_compactor        Up 15 hours   10901/tcp, 0.0.0.0:10922->10902/tcp, :::10922->10902/tcp
d733844ba1f1   thanos_sidecar_one      Up 15 hours   10901-10902/tcp
926be081aa9c   thanos_sidecar_two      Up 15 hours   10901-10902/tcp
8c4f3f32d9bc   thanos_querier          Up 15 hours   10901/tcp, 0.0.0.0:10902->10902/tcp, :::10902->10902/tcp
721d3d05f79c   thanos_store            Up 15 hours   10901/tcp, 0.0.0.0:10912->10902/tcp, :::10912->10902/tcp

```

I have re-installed Thanos two-three times without deleting bucket contents, but I can tell bucket utilization went up 2GiB in past 12 hours (demo video below - recorded 12 hours ago - shows 500 MiB).

![Bucket utilization after 24 hours](/assets/images/thanos-minio-eseries-ontap-s3-11-ontap-s3-bucket.png)

This - around 1GiB/day - is just from two small demo instances, so if you need to retain metrics with Thanos you should carefully consider budget and storage requirements.

Remember that data can be down-sampled and deduplicated, so per-day increase shouldn't apply to the entire lifecycle of archived data. But still, plan your requirements carefully!

## Demo

- [Thanos with ONTAP S3](https://rumble.com/v32uekc-thanos-with-netapp-s3-storage.html) - 6m13s
