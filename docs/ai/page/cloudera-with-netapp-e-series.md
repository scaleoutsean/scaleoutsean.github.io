# Cloudera Base with NetApp E-Series

Notes on Cloudera with E-Series

- [Introduction](#introduction)
- [Reference architectures](#reference-architectures)
  - [High-level design and best practices](#high-level-design-and-best-practices)
- [What's new in Cloudera Base](#whats-new-in-cloudera-base)
- [Deployment topology](#deployment-topology)
- [Sizing and hardware selection](#sizing-and-hardware-selection)
- [Failure handling](#failure-handling)
- [Operating system best practices](#operating-system-best-practices)
- [Networking and security](#networking-and-security)
  - [Example topologies](#example-topologies)
- [Third party filesystems](#third-party-filesystems)
  - [Storage Scale with E-Series](#storage-scale-with-e-series)
- [FAQs](#faqs)

## Introduction

First off, NetApp doesn't validate or certify E-Series for Cloudera. Maybe you can skip the rest if you need just that info.

Second, while reading their documentation I realized Cloudera doesn't seem too interested in the topic of external storage either. My guess is the KISS principle leads them to simply proposing DAS if the user doesn't have some particular concern or requirement.

DAS works, it's predictable, and it's inexpensive.

But at the same time Cloudera also doesn't say some external storage won't work. And obviously it does work when sized and solutioned correctly.

## Reference architectures

For on-premises clusters, see [these reference architectures](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra.html).

I'll go through this and make E-Series-related comments.

### High-level design and best practices

> Cloudera Base on premises supports a variety of hybrid solutions where compute tasks are separated from data storage and where data can be accessed from remote clusters.

E-Series is great for this because, unlike "modern" arrays, it supports a variety of RAID levels. Need RAID 10 for a DB without buying another array? Bring it on!

They mention three groups of workloads:

| Workload             | Recommended RAID Levels | Media |
|----------------------|-------------------------|-------|
| Data Engineering     | RAID 6 or DDP           | HDD or QLC|
| Data Mart            | RAID 6 or DDP           | HDD or QLC|
| Operational Database | RAID 5 or RAID 10       | TLC or QLC|

Depending on requirements you could have multiple E-Series arrays. For example, you need enough throughput for 5,000 CPU cores - you can't do this with one E-Series array. But for small clusters you could very well use just one (say, EF600) which is a hybrid box (NVMe TLC in controller shelf, SAS TLC and HDD in expansion shelves).

`dfs.replication` (see [here](https://hadoop.apache.org/docs/current/hadoop-project-dist/hadoop-hdfs/hdfs-default.xml)) would be set to 2 for simple mirroring rather than the default RF3. RF2 was also [recommended](https://www.netapp.com/media/16420-tr-3969.pdf) in the prehistoric TR-3969.

## What's new in Cloudera Base

This is from [here](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-whats-new.html) and I guess may be new in Cloudera 7, although I don't really care. Let's just get to the point:

> Ozone is a scalable, redundant, and distributed object store, optimized for big data workloads. Apart from scaling to billions of objects of varying sizes, Ozone can function effectively in containerized environments such as Kubernetes and YARN.

[Apache Ozone S3 and NetApp E-Series](/2022/07/06/apache-ozone-netapp-eseries.html) was a topic here back in 2022, so you can read about it and E-Series in that post. As mentioned in that post, it appears Cloudera provides support for Ozone (best to confirm with them), so storage just needs to provide sufficient bandwidth.

There's a dedicated page on ["Next-Gen"](https://docs.cloudera.com/cdp-private-cloud-base/7.3.1/howto-next-gen-storage.html) (aka Ozone) storage where you can see how it can be used with Cloudera. [This page](https://docs.cloudera.com/cdp-private-cloud-upgrade/latest/hdfs-ozone-migration/topics/hdfs-ozone-migration-intro.html) shows how to migrate from HDFS to Ozone. I'd like to highlight this:

- `ofs`: A Hadoop-compatible filesystem (HCFS) allowing any application that expects an HDFS-like interface to work against Ozone with no API changes. Frameworks like Apache Spark, YARN and Hive work against Ozone without the need of any change.

What that means is:

- Storage protocol simplicity - if you consider file and object (NFS, S3) to be simpler than block - is here for E-Series users. "`mc cp -r /data/in s3gw://datamart/etl`" and you're done - new data is available to `ofs` clients!
- Look, Kubernetes! As I've been saying all along - you *don't need* NetApp Trident to support E-Series in a Kubernetes environment. Why? Because Ozone has Erasure Coding, so PV failover isn't critical.Host and worker reboots (and Ozone container restarts) can be handled transparently to S3 users. [Like with MinIO](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html#e-series-with-unprotected-media), you can run Ozone on RAID 0 (which E-Series supports) and protect data exclusively with Ozone. Or you can do a combination (wide DDP on E-Series plus EC on Ozone on top of that).
- If you prefer to use S3 such as MinIO, [that seems to work as well](https://community.cloudera.com/t5/Community-Articles/Working-with-S3-Compatible-Data-Stores-via-Apache-NiFi/ta-p/244584). You can read about MinIO Erasure Coding with E-Series [here](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html).

If you still wonder about CSI drivers for E-Series, read [this post](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html).

## Deployment topology

This is from [here](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-deployment-topology.html). Cloudera recommends Spine & Leaf for easy rack redundancy and scaling to many racks.

This has no effect on E-Series apart from the obvious:

- If you want rack redundancy, you need multiple E-Series (e.g. two EF300 in two racks rather than one EF600 in one of three racks)
- If you use one or two E-Series across three racks you probably can't use SAS on clients because maximum supported SAS cable length may prevent access to nodes in the rack without EF-Series; you want iSCSI or NVMe or IB or FC
- For a switchless storage design, it may be possible to use iSCSI or FC or NVMe, but only as long as the number of ports on E-Series is enough for direct-attach. For example, 4 hosts with 1 x 100G NVMe on each could connect to EF600 without a switch. Three racks, three EF600, 12 hosts.

## Sizing and hardware selection

- [Sizing](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-cluster-sizing-best-practices.html)
- [Hardware selection](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-cluster-hardware-selection-best-practices.html)

Summary: don't be stupid and go with large HDDs to meet the capacity requirement.

This documentation seems a bit aged, but to make it simple, for Data Engineering and Data Mart, let's use 100 MB/s per core.

Let's say we have 8 hosts with 32 cores = 256 x 0.1 GB/s = 25.6 GB/s. Since this more than E5760 can provide, we'd need roughly two E5760, but if we need to provide 2 copies, then twice as much (4 arrays). Because it's 8 hosts, 4 arrays and 2 copies, we could split this in two racks.

Secondly, as we won't need all disk slots, we can add some SAS SSDs for Operational Database workloads (R5 or R10). Or, for a more luxury approach, get one or (rack redundancy version) two EF300 and use E-Series or (better) native database replication to protect databases.

Thirdly, we can brainstorm about other options such as 9 hosts and 3 racks:

- Instead of 4 E5760, get 3 E5760 
- Instead of 2 replicas, use Erasure Coding on HDFS (6+3) or use Ozone with EC (6+3)
- EC 6+3 overhead is 50%, so 25.6 x 1.5 = 40 GB/s, which is roughly enough (or certainly enough, if you use EF600C (QLC) and don't need more capacity than what 3 EF600C can provide). With EF300C or EF600C you may also be able to avoid dedicated EF for Operational Database

Lastly, some points regarding throughput estimation:

- if data format is compressed (by say 60%), actual writes with RF2 won't be 2x, but 1 x 60% x 2x or only 1.2x. Make sure you consider this
- storage usually handles reads better, and E-Series is much faster with read, too. When sizing, consider whether you're sizing for 100% write, 100% read or a mix of both

Then there's [this](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-data-density-per-drive.html):

> Cloudera does not support drives larger than 8 TB for HDFS data.

This seems outdated. What's wrong with 15.3 TB QLC SSDs?

There's also this:

> Running Cloudera Base on premises on storage platforms other than direct-attached physical disks can provide suboptimal performance.

Driving in a car may result in a car crash. If we size correctly, there won't be suboptimal performance. 

## Failure handling

That's described [here](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-ra-operations/topics/cdp-ra-failures.html) and with external storage not everything is the same.

External storage should have better availability and lower impact than DAS. One thing I mentioned earlier was the idea to "cut corners" for a switchless storage design, in which we'd max out hosts-per-array by using a single 100G link. Obviously, that means link failure results in loss of access to all disks for the host.

That must sound bad to "enterprise" users, but Cloudera claims it's not a big deal.

| Failure   | Impact | Note |
|---|---|---|
| Multi-disk failure (Worker node) | Low |  	Allow automated Cloudera cluster recovery features to trigger| 

You may disagree it's "low", but then you'd also begin to wonder what else they're wrong about.

Another scenario in this vein is that a failed E-Series controller would take out all Cloudera workers connected to that array without redundant paths to the surviving controller.

If you're worried about that, use multiple paths and add a pair of switches (e.g. dedicated FC, or allocate a few from existing Etherenet switches used by Compute Cluster).

The rest is more or less the same even across racks, if you have rack redundancy for storage (which would be 2 copies on protected RAID 6 LUNs on 2 arrays, or 3 copies on 3 arrays).

## Operating system best practices

Cloudera supports [RHEL, SLES, Ubuntu](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-operating-system-best-practices.html) so compare that against the NetApp IMT. 

As an aside, in a [different topic](https://docs.cloudera.com/documentation/other/reference-architecture/topics/ra_cdh5_vmware_isilon.html#concept_htl_ybs_f2b) (also outdated, for Cloudera 5), there's this note about OS boot disk in a VMware environment.

>  If storage is SAN-based, for 20 nodes, reserve 100 GB LUNs/datastores/VMDKs to each node.

This means that if you run Cloudera in VMware, you could create a RAID 5 volume group with 3 TB usable, and cut it in 150 GB LUNs for a separate data store for each Clodera VM. Or create 3 LUNs for 3 Datastores, each for VMware in its own rack (with 3 racks), for example.

## Networking and security

Read about it [here](https://docs.cloudera.com/cdp-private-cloud-upgrade/latest/upgrade/topics/cdpdc-networking-security-requirements.html).

- Cloudera can encrypt in-flight data also supports encryption for [data at rest](https://docs.cloudera.com/cdp-private-cloud-upgrade/latest/upgrade/topics/cdpdc-data-at-rest-encryption-requirements.html)
- E-Series is managed out of band (physically separate 1GigE LAN), so it doesn't introduce new security concerns either in management or data encryption level. FIPS and FED disks are supported, but you probably don't need them if that's taken care of by Cloudera

### Example topologies

Let's take a look at some examples. 

Older Cloudera 5 with Ceph in OpenStack environment:

![Cloudera storage network with E-Series](/assets/images/cloudera-ceph-eseries.png)

Two points about storage access (unrelated to OpenStack and Ceph):

- E-Series iSCSI would connect the same way, via IPv4. To avoid using Ethernet, we can use use IB or FC
- Cloudera itself would use a single network for its services

Why we need to be careful out IP networking:

> Multihoming Cloudera Runtime or Cloudera Manager is not supported outside specifically certified Cloudera partner appliances... Cloudera finds that current Hadoop architectures combined with modern network infrastructures and security practices remove the need for multihoming.

Source: [here](https://docs.cloudera.com/cdp-private-cloud-base/7.3.1/cdp-private-cloud-base-installation/topics/cdpdc-networking-security-requirements.html)

There's a "workaround", but if Cloudera doesn't support it there's no need to consider it. More on this multihoming thing:

> By default HDFS endpoints are specified as either hostnames or IP addresses. In either case HDFS daemons will bind to a single IP address making the daemons unreachable from other networks.

Source: [here](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsMultihoming.html#Multihoming_Background)

This is with Isilon and older [Cloudera 5](https://docs.cloudera.com/documentation/other/reference-architecture/topics/ra_cdh5_isilon.html) but probably still valid.

![Cloudera storage network with Isilon](/assets/images/cloudera-isilon-eseries.jpg)

Note that there's no rack redundancy here. I guess the benefit of this approach is that *if* sufficient (non-blocking) bandwidth is provided, it doesn't make much difference in terms of performance. 

E-Series - especially if there's just one box - would use this approach as well. But you have an option of multiple (entry-level) arrays with RF2 or RF3 with [rack awareness](https://docs.cloudera.com/cdp-private-cloud-base/latest/kudu-configuration/topics/kudu-rack-awareness.html). With RF2 and two racks all "local" workers would prefer to read from the replica stored on array in "local" rack. 

With 3 racks and 2 E-Series, one rack would always read "remote" data, but this doesn't worse than *all* storage traffic reading over multiple hops. It's the same (writes) or better (reads for 66% of cases).

## Third party filesystems

[These](https://docs.cloudera.com/cdp-private-cloud-upgrade/latest/upgrade/topics/cdppvc-filesystems-IBM.html) are some of the validated non-standard ones: PowerScale (Isilon) and StorageScale (Spectrum Scale, GPFS).

### Storage Scale with E-Series

E-Series supports GPFS, so you could buy [GPFS](https://www.ibm.com/docs/en/storage-scale/5.2.2) and use it instead of HDFS.

If you use Ozone, maybe you don't need a 3rd party filesystem, but GPFS has better support and more features. Note that on E-Series GPFS would work best with protected volumes (RAID 6, 8+2, usually, and RAID1 on SSDs for metadata)

![GPFS on E-Series](/assets/images/cloudera_gpfs_netapp_eseries.png)

This image depicts HDFS service for clients which translates requests to GPFS which uses "disks". GPFS in this case runs on dedicated GPFS servers, which use (protected) E-Series LUNs. Cloudera workers don't need to have much storage besides R1 boot media, although they could have local (internal) read-only cache that GPFS supports.

You can read more about GPFS with E-Series in [TR-4859](https://www.netapp.com/media/22029-tr-4859.pdf). This TR also has some indicative performance figures.

## FAQs

Some comments on the [FAQs](https://docs.cloudera.com/cdp-reference-architectures/latest/cdp-pvc-base-ra/topics/ra-cdpdc-faqs.html).

> The HDFS data directories should use local storage, which provides all the benefits of keeping compute resources close to the storage and not reading remotely over the network.

This is nonsense.

If you read via NVMe without even a network switch in data path, what "latency" is there? Not to mention that - since Cloudera recommends NL-SAS - the latency of "remote" (NVMe) storage with QLC is *much lower* than the IO latency of NL-SAS. You may say "but QLC is more expensive" and that's true, but we may need a lot less of raw QLC compared to NL-SAS (if we use 2 copies on RAID 6 vs. 3 copies on DAS).

Secondly, the moment you use Cloudera in a cluster spanning multiple racks, the question becomes: do you still want to use DAS and RF3? Maybe you do, but you're sending 200% more writes over network. If you use Erasure Coding, you send only 50% more, but then you may need to read it from multiple racks, which means a lot more network hops, so "reading remotely over network" happens all the time anyway.

The same applies to Ozone or S3 which would generally be running on "dense" storage nodes and use EC.
