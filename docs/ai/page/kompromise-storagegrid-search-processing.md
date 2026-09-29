# Kompromise - demo stack with Webhooks, S3 caching and indexing for NetApp StorageGRID

Kompromise solution with Webhook, NATS and AIS

## Introduction

I've written several posts on Kompromise ([you may read the first one here](/2026/06/27/kompromise-pipeline-netapp-storagegrid-eseries-vgw.html)), my PoC project for Kubernetes data pipelines based on NetApp StorageGRID and EF-Series.

I feel it's almost finished now so I'll create a "release" post and make small updates as I finalize Kompromise.

## What it does

- Out-of-box Webhook notifications to NATS subjects
- Framework-neutral pre-fetch of S3 data for I/O-intensive data processing (read *and* write caching)
- Out-of-box workflows for content indexing and embeddings ("vectorization")
- Made for NetApp EF-Series, the best NetApp array suitable for all of the workloads involved

(Kompromise Webhooks also run in user's namespace.)

![Kompromise beta](/assets/images/kompromise-beta.png)

### Webhook notifications

I blogged about this in the [previous post](). In short:

- Simple notifications are just StorageGRID notifications sent to NATS, so the user just applies a simple configuration YAML on Kompromise
- Rich notifications fetch object metadata. Also requires just a simple configuration. Rich notifications don't have guaranteed delivery. See the previous post on why that is

### Pre-fetch for I/O-intensive processing

This is a solved problem. All modern AI and analytics stacks and frameworks solve it.

![S3 sharing in Hybrid Cloud](/assets/images/medallion-architecture-dont-manage-storage.png)

I've written about this many times. That is one of the reasons why there's no hybrid cloud data sharing problem, either.

I have blogged about some of them Alluxio, Ray, etc. 

Why do we need Kompromise, then? Because these stacks aren't very easy to integrate, and Kompromise does it out of box, with optimal choices for NetApp EF-Series. And because AIS is *already* in the diagram above: Kompromise *uses* it, it doesn't copy, emulate or replace it.

### Out-of-box functions

I needed several functions representative of the pipelines I find suitable for this stack:
- **Automated data processing**: I have a video example because it gives something to see. For video content we could do anything (down-sampling, video-to-image, video-to-text), what the example workflow actually does with data isn't that important to prove its value. The value of Kompromise is the same as in all other solutions, but Kompromise doesn't even *wait* for a job to start - if the pipeline is configured to prefetch, prefetch starts before the job.
- **Automated document processing**: again, we can do anything but something that we can see is text summarization. While videos may be large, text documents may be in thousands, so prefetching again helps.
- **Indexing and vectorization (embeddings)**: this is different than the first two, as I don't necessarily need to prefetch the object. I can create embeddings or inverse S3 key index purely from object notifications. But I can also do "two-in-one" and prefetch the object to create embeddings from the object content (whether it's video, image, PDF or something else).

For an example, the first one does video-to-image (where "image" is actually a bunch of samples from the video). It uses an "ffmpeg-sampler" function I created because I thought it's easy to realize the potential.

```yaml
apiVersion: labs.scaleoutsean.labs/v1
kind: BucketPipeline
metadata:
  name: bucket-etl-pipeline
  namespace: coke
spec:
  etl:
    name: etl-ffmpeg-sampler
    triggerExtensions: [".mp4", ".MP4"]
    outputExtension: ".png"
    args: ""
```

This particular function reads a video from AIS cache (or pass-through to StorageGRID S3 if it's not yet cached), samples images from the video and writes a "composite" "contact sheet"-style PNG image back to S3.

We can create own functions in AIS or externally. If prefetching or notifications help us and we want to do our own thing, we can.

The key ingredients are Webhook and pipeline. In Webhook setup, we decide Simple or Rich. In Pipeline setup, we decide what other options we use. So `cacheProfile` lets me prefetch. I could *also* call an ETL function, but I can also do nothing else. 

```yaml
spec:
  bucket: "bucketshop"
  endpoint: "https://192.168.1.211:10443"
  credentialsSecret: "aws-credentials"
  cacheProfile: "gold"
  workflowProfile: "none"
  workflowDelivery: "Auto"
```

If my challenge was to get the object cached, so that I can read the file at 15 GB/s when I need, my problem has been solved. Maybe my compute job starts seconds later, triggered via a different workflow. So we can do this any way we want - curated functions, own functions, external workflows...

Just note that, because pre-fetch kicks off seconds after the notification comes in, even if you use another job scheduler in addition to Kompromise for pre-fetch, you don't have to coordinate with Kompromise: you can always read the object through AIS, whether it's there or not yet. If you start reading an object from AIS before Kompromise got to it, that will work fine - no further action needed (AIS will simply skip its own prefetch).

Indexing and embedings can, but don't need to, use AIS. The simplest workflow is: a notification comes in, a vector goes out (insert or upsert an object record to a database). A more complex workflow can read a pre-cached object and do more with it.

Now that that I have a Webhook service that works the way I want and a stack that scales to any practical performance, there's no limit to what can be done with only small adjustments. I hope to write several separate blog posts on this topic of indexing and embeddings.

### NetApp EF-Series

I have a ton of posts on this, but in short, consider what's going on in this stack:
- There's [NATS](/2026/06/21/nats-server-on-netapp-eseries.html) (similar to [Kafka](/2026/08/05/kafka-on-netapp-eseries.html)) which is not trivial to operate
- There's AIS, which needs Replica Factor 2 or more to scale-out to >> 10 GB/s
- It's likely you'll have a vector database and for that EF-Series is the right choice of external storage. Whether it's [Qdrant](/2026/05/26/multi-node-qdrant-vector-db-netapp-eseries-santricity-csi.html), [Milvus](/2022/07/07/milvus-with-solidfire-e-series.html), [Postgres](/2026/06/01/cloud-native-postgres-kuberntes-netapp-eseries-perf.html), [Elasticsearch](/2026/04/13/elasticsearch-eck-kuberntees-netapp-santricity-csi.html), [Yugabyte](/09/21/yugabytedb-netapp-storage-eseries.html), [DuckDB](/2026/09/14/duckdb-quack-netapp-storage.html), [SQL Server](/2026/05/29/microsoft-sql-server-kubernetes-netapp-eseries.html) or whatever - use an EF-Series array

Let me correct myself: for all of these services, one should really use **multiple arrays**. You *can*, of course, use one EF-Series array, but that's not how any of these applications are supposed to work in this time and age. See these linked posts to find out more.

## Walk-through

Webhook (see previous post) learns of events when StorageGRID notifies us, and creates a job queue entry.

```sh
[GIN] 2026/09/29 - 09:15:18 | 200 |   1.38µs |      10.244.0.1 | GET      "/healthz"
[GIN] 2026/09/29 - 09:15:20 | 200 |  12.23ms |      10.244.0.1 | POST     "/events/sg/coke/bucketshop/"
```

Worker for the pipeline watches its NATS queue and kicks off jobs. In this case, its job is to pre-fetch, which it does through AIS.

```sh
2026/09/29 10:33:52 T-Shirt Profile 'gold' triggered Prefetch for traffic.png
2026/09/29 10:33:52 -> Executing AIStore Data Prefetch (Gold/Full) for s3://bucketshop/traffic.png 
2026/09/29 10:33:52 Cache sync successful:
```

Sometimes that's all you want - just make sure the object was prefetched. AIS job show result:

```sh
$ ais show job K6d92XxnC
prefetch-objects[K6d92XxnC] (ctl: 
  t[YvExplXR]: cfg(list:[traffic.png]) job:[cold:(1,1.57MiB)] lifetime:[cold:(1,1.57MiB avg-lat:33ms)]
  parallelism: w[1]
) 
NODE		 ID		 KIND			 BUCKET			 OBJECTS	 BYTES		 START		 END		 STATE
YvExplXR	 K6d92XxnC	 prefetch-listrange	 s3://bucketshop	 1		 1.57MiB	 10:33:52	 10:33:52	 Finished
```

Some other pipeline may prefetch **and** trigger a function, such as that image sampler for videos. These functions run at all times, and kick off when worker spots a matching event and triggers them.

```sh
ais etl show
NAME			 STAGE		 XACTION	 OBJECTS
etl-ffmpeg-sampler	 Running	 etl-L1q512oPnf	 5
```

This is similar to OpenFaaS, by the way. I had an OpenFaaS demo video on YouTube ages ago (2018-ish?). Unlike OpenFaas, these functions are focused on storage-related tasks - they are meant to use AIS, although that's not mandatory (you could probably use them *with* OpenFaaS, and the extra you'd get would probably be a good Webhook for StorageGRID, and AIS on EF-Series).

There was an upload that triggered this function, so when `traffic.mp4` was uploaded, `traffic.png` was created an uploaded back to the same bucket (the choice of destination is flexible). That's why I have these two.

```sh
$ ais ls ais://bucketshop/ | grep traffic
traffic.mp4					 1.48MiB	 
traffic.png					 1.57MiB
```

`traffic.png` (intertingly, it's bigger than the video, why, because the video was SD quality, and the image has different frames of it):

![Kompromise ETL output](/assets/images/kompromise-etl-ffmpeg-traffic.png)

I can check where's that video: it's still cached in AIS (see `location` and `copies` (RF1)).

```sh
$ ais ls ais://bucketshop/traffic.mp4 -props all
PROPERTY	 VALUE
atime		 29 Sep 26 18:28 CST
checksum	 md5[836f96af56dd8f8f...]
chunked		 -
copies		 1 [/var/ais/data]
custom		 [source:aws ETag:836f96af56dd8f8fbb4fd76755a2c5b7 LastModified:2026-09-29T10:20:43Z Last-Modified:Tue, 29 Sep 2026 10:20:43 GMT md5:836f96af56dd8f8fbb4fd76755a2c5b7 version:NkQ5RkMwQzAtQkJFRi0xMUYxLTgxOTAtMTQ2MzAwQzY0RERC Content-Type:video/mp4]
ec		 -
etag		 "836f96af56dd8f8fbb4fd76755a2c5b7"
last-modified	 Tue, 29 Sep 2026 10:20:43 GMT
location	 t[YvExplXR]:mp[/var/ais/data, vda, hdd]
name		 ais://bucketshop/traffic.mp4
size		 1.48MiB
version		 NkQ5RkMwQzAtQkJFRi0xMUYxLTgxOTAtMTQ2MzAwQzY0RERC
```

If I need any other tasks (such as video conversion, especially single source to *many* destinations), they'll *fly* on this thing, for as long as they stay in cache (and if they don't, they'll be pulled on demand). 

I demonstrated this workflow in the first Kompromise post months ago, but it was not a full pipeline. There was a pre-caching pipeline and a separate function. This example now shows a pre-caching, function-calling, pipeline. All we need to do is upload an object to StorageGRID - the rest is hands-off.

## The possibilities

Sometimes you may hear:

> Traditional applications still need to work on data using POSIX-compatible storage or file share before files can be uploaded to S3

But they don't.

FFmpeg is a traditional application. The video file was uploaded to S3, AIS took care of getting it to my local cache and Kompromise triggered my containerized FFmpeg function which processed the video in memory (or ephemeral disk space).

The result was sent back to S3/AIS. Did I use "traditional storage"? No.

My AIS function for video conversion uses RAM and disk cache on AIS nodes and once I get to indexing demos I don't think I'll need any PVCs for those non-AIS containers either.

That's how the applications from that diagram at the top work. Check the detailed [post on Ray checkpointing to S3](/2026/09/19/ray-framework-beegfs-storagegrid-checkpoint.html) to see how that framework does it.

Not only are CSI PVCs on E-Series (AIS, only, and those are semi-ephemeral - no backup/snapshots/DR required) enough for all processing, but even [RAG can run off S3](/2026/08/19/datalake-rag-netapp-storagegrid.html). Are POSIX PVCs used somewhere? Of course, databases live on persistent disks but outside of Kompromise (and one should still use EF-Series for that.)

Kompromise demonstrates I/O-intensive data *processing* for AI and analytics without long-lived persistent volumes.

The RAG post above demonstrated S3-based vector databases, but *getting* StorageGRID data into such databases was painful. Now that Kompromise Webhook is available, that is no longer the case, so I plan to do more in this area (search, vector databases, graph databases, agentic AI...).

## Conclusion

As a solutions architect, I don't like having unsolved problems.

Many have been bothering me for years:
- StorageGRID indexing integration (especially AI-related)
- StorageGRID pipelines (now I have one that works)
- Proven block storage for high-throughput S3 caching, event streaming and vector DBs. Technically, all are possible with EF-Series without Kubernetes, but many people want this on Kubernetes and the best qualified NetApp array did not even have a CSI driver, so I had to [take care of that](/2026/01/19/netapp-eseries-santricity-csi.html), too
- Mini "Technical Report" blog posts on every piece of this stack (and alternatives) with EF-Series. Upstream has none

The only new component is Kompromise Webhook for StorageGRID and the rest is architecting, solutioning, integration and testing. And, s you can see from the posts on every single component and its alternatives, **all** have been evaluated. Even if you use some of the 3rd party components or SANtricity CSI driver(s), you can still avoid duplicating this work.

Kompromise doesn't solve new problems, but it shows how they can be solved correctly and effectively.
