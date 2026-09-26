# Kinetica with NetApp E-Series

E-Series has what Kinetica needs

## WTH is Kinetica?

According to [TFM for version 7.2](https://docs.kinetica.com/7.2/):

> Kinetica is a scalable database for real-time analysis on large and streaming datasets. Kinetica's vectorized processing delivers faster analytics than traditional databases, with the flexibility and ease of use of a relational database.

Very well!

Let's see about its storage and HA requirements.

## High Availability

Kinetica employs quite a unique design. Maybe it's due to the fact that it aims to provide a compressed "all-in-one" stack where a bunch of things are packaged in one integrated DBaaS. And HA is provided by a cluster-o'-clusters. 

It's not entirely clear if a "mini-cluster" is a bunch of services or containers than run on one physical node, or a number of Kinetica nodes clustered together. 

I won't linger on this because it works the way it works and there's nothing to configure there storage-wise.

## Storage

This is what I'm interested in.

Kinetica uses storage in tiers, non-persistent and persistent. 
- `vram`: GPU memory
- `ram`: Main memory
- `disk` : Disk cache - spill-over for `vram` and`ram`
- `persist` : Permanent storage -  `disk` (local/network storage), `hdfs` (Hadoop distributed filesystem), `azure` (Azure blob storage), `s3` (Amazon S3 bucket) and `gcs` (Google Cloud Storage bucket). 
- `cold` : Extended long-term storage - the slow `persist` tier. Supports the same types as `persist`

`cold` and `persist` can be compressed into a single tier, especially if they have similar characteristics.

It's interesting that "network storage" is mentioned, but NAS is not called out. The Kinetica docs aren't detailed and the free Developer Edition doesn't have the "advanced" features, so we can only infer and guess. 

### `disk` tier

This is supposed to be faster than `persist` tier, so probably an NVMe disk device, local or remote.

### `persist` and `cloud` tiers

Data is asynchronously drained into `persist` tier.

>  data for persistent objects is always present in the Persist Tier (or Cold Storage Tier, if configured), but may not be up-to-date at any given time.

If there's a `cloud` tier, then `persist` can spill over to `cloud`. Or you could just configure `cloud` as `persist` and have one tier less.

If you want DR, you can stretch your on-prem S3 storage across sites and have it all done in one go: move Kinetica bbackups to S3, use Kinetica cloud tier and have S3 do DR for it all.

## E-Series for Kinetica

Patterns for Kinetica are similar for other NOSQL databases.
- `disk` is practically ephemeral and it's supposed to be very fast. We don't have to use shared storage, but we can. An advantage of shared protected storage is we can right-size it without overprovisioning. Basically the same argument that attracts people to mvoe from DAS HDFS with RF3 to shared protected storage (S3, in modern data lake designs). On E-Series we could do ephemeral (R0, single disk per Kinetica "rank") or protected (R10 or DDP)
- `persist` - this can be a slower tier on external storage, or, if you want simplicity and elegance ([which I think should be given priority](/2025/10/09/storagegrid-s3-cache-branch-buckets.html#so-how-is-this-supposed-to-be-used)), simply persist to `s3` as I've mentioned above when talking about `cloud` tier 

In the extreme, `disk` (on internal RAID 1) and `cold` are enough. But that may be slower and - depending on how you plan to recover from server failures (on premises), it may be better to use external storage for `disk`. 

Kinetica's documentation for on-premises operations isn't very clear.  One wonders how "failover" works, for example, and how the (lack of) CSI driver for E-Series impacts things in Kubernetes environments  (it looks like [it doesn't](https://docs.kinetica.com/7.2/install/kubernetes/)).

![K8s operator](/assets/images/kinetica-eseries-pod-with-k8s-02.png)

In short, everything from [this post on CSI drivers and E-Series](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html#how-to-configure-das-csi-with-e-series) seems to apply: since there's no need for volume "failover", TopoLVM or even static volumes should suffice.

`disk` and `persist`, especially if there's also `cold`, or just `disk` and  `cold`) don't need to be resized sudenly (or ever, if you just let it go to to `cold` or add extra `persist` LUNs when needed, since there doesn't have to be just one). Actually from a performance perspective, having 2 or 4 LUNs per node may be better for performance.

And these volumes can be and can be resized in a rolling fashion. Shutdown a Kinetica node, grow (XFS) filesystem, restart node. It takes 2 minutes. You could even use Ansible to do it.

Kinetica backups could and should be moved to S3 and Kinetica supports incremental backups. So apart from the fast `disk` and well-protected `persist`, there's nothing else we need from block storage.

## Summary

A "building block" configuration like this is simple and provides RAID 10-like and RAID 6-like volumes within a single pool that starts with 11 disks and can be grown to 24 in increments of one (e.g. 7.68 TB).

![Kinetica Pod with E-Series](/assets/images/kinetica-eseries-pod-with-ddp-01.png)

This gives you:
- RAID 10-like performance for `disk` tier. Notice each R1 stripe in the schematic is "split" in 2 halves to signify those are 5+5 (R10 on DDP) stripes
- RAID 6 performance and protection for `persist` tier (8+2 stripes)

The advantage of this approach is a single protected pool gives you two "tiers" of performance without micro-management. Assuming 700 MB/s of throughput in mixed "hot" (400 MB/s) and "cold" (300 MB/s) access, your `disk` tier would enjoy performance-focused RAID 10 access while `persist` would get relatively less IOPS/throughput, but still have enough for bulk destaging and persisting for which RAID 6-like volumes are perfect.

![IO distribution](/assets/images/kinetica-eseries-building-block-03.png)

Note that 133 MB/s for `disk` volumes should realy be measured in IOPS as those requests would be smaller in size (e.g. 64KB) - still in "random IO" range as far as E-Series is concerned.

And E-Series doesn't have QoS, so any node really gets the full performance of the DDP if other nodes are momentariliy not using it. Since Kinetica balances its IO workload, it is expected that over tens of seconds each of N `k` (Kinetica) nodes would average approximately 1/N of array performance.

We could get fancy and further micro-manage this for specific workload patterns. For example, separate media protection domains into `disk` on R10 and `persist` on classic Volume Groups or DDPs, so that workloads are very clearly segregated which may be important for some use cases (e.g. traffic control).

To achieve rack resilience and save ports on ToR storage switches, use "building blocks" [similar to those in the CSI post](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html#how-does-it-work). With 3 Kinetica servers per one entry-level EF300 you can use switchless DAS connectivity with FC links, for example.

EF Series arrays also support NL-SAS expansion shelves, if you want to create "building blocks" that include a `disk` tier and a thick `persist` tier with HDFS, which Kinetica also supports. This may be useful if you are comfortable with HDFS and/or expect to often copy-and-load data from HDFS (rather than have it ingressed "live" by Kinetica).

However, anyone who hasn't used HDFS should probably just go with [this S3 pattern](/2025/10/09/storagegrid-s3-cache-branch-buckets.html#so-how-is-this-supposed-to-be-used) instead. If you start (relatively) small (< 500TB), you can use those NL-SAS expansion shelves for StorageGRID software-defined S3 storage running out on bare metal or within KVM or VMware VMs. I've blogged about that approach several times including [here](/2021/01/15/netapp-hci-storagegrid-splunk-smartstore-on-efseries.html).
