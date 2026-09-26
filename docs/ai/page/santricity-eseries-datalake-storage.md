# Big data & analytics patterns for NetApp object & block

StorageGRID and E-Series-based pattern for big data and analytics

## Introduction

The post [StorageGRID Branch Buckets and Read Cache ](/2025/10/09/storagegrid-s3-cache-branch-buckets.html) is a rant about patterns for the NetApp storage products in analytics and big data environments.

I didn't do a good job illustrating those at the time, so this post will add hopefully better depictions along with some comments.

## Application, rack and storage redundancy

I like DDP as unified storage pooling and protection layer on E-Series arrays. I've mentioned it in the linked post and many others so I'll keep this short: one highly resilient pool with volumes properly balanced across both controllers and the ability to create fast RAID 1 volumes without creating data islands with "classic" RAID groups.

![DDP as universal data protection layer](/assets/images/eseries-datalake-storage-layout-01.png)

StorageGRID S3 is the single source of truth.

Block storage is there to protect "work in progress" data. If RAID 1 isn't enough and you wish to customize, you can spare a few disks for ephemeral (scratch, KV cache) volumes (see this animated GIF with [BeeOND creating a cluster with ephemeral clustered filesystem on ZFS-formatted storage targets in 10 seconds](/2025/05/17/beegfs-v8-netapp-e-series-indexing-tiering-workflows.html#beegfs-copy-tool)). 

All persistent and protected volumes live on DDP pools.

![StorageGRID, E-Series with R0 and DDP (R1, R6)](/assets/images/eseries-datalake-storage-layout-02.png)

S3 gives you snapshots (the post linked at the top), Point-in-Time rewind (bucket snapshots, data-lake material views, etc), and read caching for buckets you frequently read.

Data streams and events are processed by containers or VMs with data on DDP-backed volumes.

If you have multiple racks and desire rack redundancy, the same pattern scales perfectly well.

![Multi-rack deployment for StorageGRID and E-Series](/assets/images/eseries-datalake-storage-layout-03.png)

- Data applications come with built-in HA and data redundancy (2 replicas or EC)
- Scratch and temp space can be built on RAID 1 (on DDP) or even RAID 0 for a completely ephemeral cache
- With one DDP per array, all you need to do is create volumes and map them to hosts. There's a [Provider for SANtricity for that](/2026/01/16/eseries-santricity-terraform-provider.html)
- High churn, front-end, stateless containers or VMs: use the HA pattern with cross-rack replication (ZFS) or EC (Ceph) for isolated CSI provisioning. One SDS per each K8s cluster lets you delegate and work at any scale. Or build a larger one and use EC
- Ephemeral S3 caching layer at the top may come from any compatible source - NetApp [StorageGRID cache](/2025/10/09/storagegrid-s3-cache-branch-buckets.html), NVIDIA AIStore, Versity S3 Gateway, and so on

An example of this pattern can be viewed here in my [GO NATS!](/2025/07/23/s3-vector-search-02-diy.html) demo app from mid 2025:

![Example application](/assets/images/s3-go-nats.png)

- Data in S3
- BeeGFS used for scratch/temp (top & center) in case we need heavy data processing (such as, for example, vectorizing objects in each individual frames of a longer video)
  - Can be BeeoND with ephemeral volumes or "persistent" volumes on R1 or R6 volumes
- Elasticsearch search index across multiple nodes and/or racks (on the right)
  - Elasticsearch tiers data to S3 and can also be backed up to S3

With this pattern, you can seamlessly extend your access across hybrid cloud because block storage does not need to be replicated to the cloud. It's all done on application level and with data on S3.

## Conclusion

This approach is similar to servers with DAS, but it can accommodate the Active-Standby HA pattern better, requires 50% less overhead than internal replica-based approaches (RF2 vs. RF3) and does not require excessive reliance on SDS (for EC) which increases management costs and sometimes adds risks because you have SDS and you have JBODs compared just to rock-solid RAID on DDP with application-driven RF2 or EC.

One of the big issues with using E-Series in these environments was complete lack of any solution automation and integration (see [this](/2025/12/22/reautomating-eseries.html)). Well, not any more. We now have OSS client libraries for Python, PowerShell and Go, as well as a provider for Terraform and we know they are not that hard to maintain.
