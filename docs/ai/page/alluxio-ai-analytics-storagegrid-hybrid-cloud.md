# AI and analytics in hybrid cloud with Alluxio and NetApp StorageGRID

Short refresher on the Alluxio-StorageGRID solution

## Introduction

I first wrote about Alluxio with StorageGRID in 2021, before that was a thing (in terms of official StorageGRID solutions).

- [Alluxio and StorageGRID ](/2021/11/12/alluxio-storagegrid-s3.html)
- [Hadoop Multi-Tiered Read-Write S3 cache Alluxio and NetApp StorageGRID](/2021/12/16/hadoop-multi-tiered-s3-read-write-cache.html)

Quick refresher on Alluxio:

> Alluxio is a distributed caching layer that sits between your object storage (S3, GCS, Azure Blob, HDFS) and your compute (PyTorch, vLLM, Spark, Ray). It pulls hot data onto the local NVMe or SSD of each compute node, so workloads read at local storage speed instead of crossing the network to object storage on every access — without moving or copying your data. ([source](https://documentation.alluxio.io/ee-ai-en))

It's been at least half a decade (since just this approach was possible for at least that long) that solutions like this one solved the problem of data access in most hybrid cloud use cases.

You still need block or file to host VMware and have to deal with replication to/from the cloud if your objective is workload and data mobility for *that*, but those are not AI and analytics workloads.

Recently I wrote a rant about leveraging object stores in hybrid cloud scenarios because many vendors pretend like data mobility still a hard-to solve problem ([Object stores solved problems with data sharing in hybrid cloud years ago](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html)) and that reminded me I should look back and do a little refresher on Alluxio/StorageGRID.

## What's not new

The solution still works the same and provides accelerated access to StorageGRID data.

Because it runs on-premises *and* in the cloud, you can use it anywhere:

- StorageGRID anywhere where Alluxio can reach it, plus
- Alluxio nodes with working set-sized RAM or RAM with disk cache, equals...
- **Hundreds of GB/s in throughput and millions in IOPS** in your GPU cluster without almost any storage management

![Hybrid Cloud with Alluxio with StorageGRID](/assets/images/alluxio-hybrid-cloud-storagegrid-00-diagram.png)

You don't *have* to use EF-Series, as shown in the diagram - internal NVMe will do, especially in public cloud where you can't have E-Series in any case. But you may want to use fast, protected external storage because it may cost less, be easier to manage and service. You may also need persistence without replication which at least halves internal disks' maximum write performance and usable capacity... 

Alluxio can run on bare metal, Docker and Kubernetes, so you just need to:
- Connect to StorageGRID
- Provision a tier of disks to Alluxio workers (manually, or using Ansible, Terraform, TopoLVM, SANtricity CSI, etc.) when working set doesn't fit in RAM

## What's new

### What's new in StorageGRID

StorageGRID can not only span multiple sites (Active-Active-Active...), but since 12.1 came out, one can also federate multiple grids the way regions are connected in AWS. This is not for everyone, but it can be done and obviously there *are* users who are big enough to require it for whatever reasons.

Another change since 2021 is StorageGRID now supports over 200 nodes which, depending on setup, could deliver a lot more performance. It's never enough, so this extra performance isn't to replace Alluxio, but to *get data to Alluxio even faster*. 

Since late last year, there are dedicated [read-only caching nodes](/2025/10/09/storagegrid-s3-cache-branch-buckets.html). Caching is already performed on Alluxio, but the same way more nodes don't replace it, caching nodes don't replace Alluxio either: what this is useful for is you can warm up cache *before* Alluxio jobs run to populate theirs.
- Step 1: use local client to pre-warm StorageGRID read cache, so that it's ready for Alluxio's pull. Data may reside on several slow and cheap NL-SAS nodes, but once they're in read cache, you get get them at a decent speed
- Step 2: kick off compute job on Alluxio. You can use Passive or Active Preloading, so you could issue an active preload command before you get those GPUs provisioned

It's an extra step that's more applicable for on-premises or campus environments where you can actually get to StorageGRID gateways at 10+ GB/s. It probably won't help you much if Alluxio is accessing StorageGRID from Digital Ocean.

### What's new in Alluxio 

Alluxio has made big strides in expanding support for AI use cases, as you can see from TensorFlow and PyTorch examples here.

![Alluxio stack](/assets/images/alluxio-hybrid-cloud-storagegrid-01-alluxio.png)

I don't recall what the product names were in 2021, but I seem to remember there was one commercial edition and it appears that would be today's "Alluxio DA", while the focus now seems to be "Alluxio AI" ([product page](https://www.alluxio.io/alluxio-ai-overview)) which is more AI-centric as the name suggests. I'll write about this AI edition.

StorageGRID is an "under" file system (UFS, in Alluxio's terminology) accessed using the S3 driver. The steps for that are essentially the same as before - you can find them [here](https://documentation.alluxio.io/ee-ai-en/ufs/s3-compatible#minio) - addd S3 endpoint, bucket name, region, S3 keys and potentially 2-3 other settings and you're good to go.

We create an Alluxio filesystem on top of that bucket, and then can access data using various approaches such as FUSE.

Above, I've mentioned Active Preload, which is documented [here](https://documentation.alluxio.io/ee-ai-en/cache/loading-data-into-the-cache#active-preloading-with-job-load), which is strongly recommended when preload takes a long time and compute resources would be idling without data. There's an API for this, so it's easy to do. Read more about [cache policies](https://documentation.alluxio.io/ee-ai-en/cache/managing-data-in-the-cache), pinning and eviction, which have also seen improvements since five years ago.

Another new feature is [S3-API write optimization](https://documentation.alluxio.io/ee-ai-en/performance/s3-write-cache):

> buffering PUT requests in local NVMe cache and persisting to UFS asynchronously for millisecond-level write latency

We can confidently buffer writes in NVMe cache and wait for write cache to drain to the StorageGRID bucket. This is one of those use cases where you may want to make sure your NVMe cache won't fall apart before that draining is done. We can protect it with RAID or DDP on E-Series, including BeeGFS or Lustre with E-Series.

If you write checkpoints or other large output back to S3, dumping it to NVMe cache lets your GPUs keep working and Alluxio cache can drain its pending writes even after GPU clients have been shut down.

Another new feature is RDMA support, described [here](https://documentation.alluxio.io/ee-ai-en/performance/rdma-networking#native-rdma), which means that - among other things - Alluxio can be your RDMA proxy to StorageGRID data: where RDMA is used is transfer between *Alluxio clients* and *Alluxio workers*. 

RAM would be used first as Tier 0 and disk cache (NVMe (internal) or NVMe/RoCE (EF-Series) or NVMe/IB (EF-Series)) as Tier 1. Example [for Docker](https://documentation.alluxio.io/ee-ai-en/administration/managing-worker#docker-bare-metal) to place Alluxio page cache on `-v /data/alluxio-cache:/data/alluxio-cache`:

```sh
alluxio.worker.page.store.dirs=/data/alluxio-cache
alluxio.worker.page.store.sizes=128Gi
```

Multiple disks can be used as well. Kubernetes example:

```yaml
spec:
  worker:
    pagestore:
      hostPath: /mnt/alluxio/lun1,/mnt/alluxio/lun2
      size: 1024Gi,1024Gi
      reservedSize: 960Gi
```

Alluxio can create [copies](https://documentation.alluxio.io/ee-ai-en/high-availability/multiple-replicas#number-of-replicas) of cached files, which may be good even on protected storage (parallel repeated reads from independent copies may be beneficial), but it depends - they also cut write performance and increase capacity utilization and have some limitations, so the feature has its advantages and disadvantages. I'd consider them even with protected LUNs on EF-Series and and use when appropriate.

Also new are the various AI-related optimizations from recent releases, such as [model loading optimizations](https://documentation.alluxio.io/ee-ai-en/performance/model-loading). As the page says:
- Intelligent Prefetching: Alluxio anticipates the sequential nature of tensor data and fetches large, contiguous blocks.
- Shared Memory Pool: Alluxio utilizes a specialized memory pool within the FUSE process to cache these prefetched blocks. Fetch just once, not from every node!

Alluxio's performance has improved as well. 
- See [here](https://documentation.alluxio.io/ee-ai-en/benchmark/s3-api) about running S3 API benchmarks
- See [here](https://documentation.alluxio.io/ee-ai-en/benchmark/benchmarking-ml-training-performance-with-mlperf) for ML training performance
- For regular POSIX access, which is closest to `fio` - see reference results [here](https://documentation.alluxio.io/ee-ai-en/benchmark/benchmarking-posix-performance#single-node-nvme-baseline)

See more at their documentation page for Enterprise Edition located [here](https://documentation.alluxio.io/ee-ai-en) (always make sure you pick the right edition and version, this got me several times).

## Conclusion

A lot has changed since 2021, but the fundamentals are the same and requirements for this approach have increased.

There was no reason to replicate data to the cloud in 2021, and there's even less reason to do it now - it's more secure, faster, cheaper and generally better to do everything you can without making copies of your data that land on persistent storage and need to be managed - even when it's fully on-premises, let alone in public cloud. 

For simple purposes (i.e. "mount a StorageGRID bucket to /mnt/s3") there are simple tools. Alluxio AI is not a small "driver" application.

It does a lot of things. Deep learning, AI and analytics stacks aren't trivial either, so expect having to invest an effort in automating its deployment to be able to deploy it quickly and seamlessly on (preferably) Kubernetes, but potential payoff is significant.

From the StorageGRID side, you don't have to do anything special - just give Alluxio access and the rest of storage-related tasks would be around cache loading, policies, eviction, pinning and such. You should be able to avoid backup, replication and similar overheads and associated costs and risks, while completing your AI and analytics jobs faster and cheaper than ever before.
