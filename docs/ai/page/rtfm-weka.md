# Reading Weka's documentation

I love GitBook

WEKA has a nice documentation site based on GitBook. I love good documentation! 

It's a Friday evening and I have nothing else to do, so I thought to RTFM and take some notes.

[Scalability](https://docs.weka.io/overview/about):

> Scalable: The Weka system linear performance depends on the size of the cluster. Consequently, a certain amount of performance will be received for a cluster of size x, while doubling the size of the cluster to 2x will deliver double the performance. 

How does it work if I don't want to double the size of the cluster, but only double or triple the capacity?

[Filesystem encryption with GDS](https://docs.weka.io/overview/networking-in-wekaio#limitations):

> Encrypted filesystems: The framework will not be utilized for encrypted filesystems and will fall back to work without RDMA/GPUDirect for IOs to encrypted filesystems

> Note: RDMA/GPUDirect Storage technology is not supported when working with a cluster with mixed IB and Ethernet networking.

If I understand this correctly:

- once you encrypt a WEKA filesystem, you lose both RDMA and GPUDirect (GDS) features (but you can buy *another* RDMA-only cluster and stand it up *with*)
- if you add Ethernet clients to your WEKA cluster with RDMA/IB and GDS, GDS can't be enabled on any filesystem. What to do if you have some lightweight workloads that can't justify the cost of RDMA switches or new NICs? I suppose you can build another cluster just for Ethernet and copy data back and forth between these clusters.

Additionally, [here](https://docs.weka.io/overview/filesystems#encrypted-filesystems) we have another note on encryption:

> Note: You can only set the data encryption when creating a filesystem.

If you set up with a single-FS WEKA cluster that runs the way you want but need to encrypt it after the fact, that may require some sacrifices or data migration to a WEKA (or other) filesystem which is encrypted.

[Performance tests](https://docs.weka.io/testing-and-troubleshooting/testing-weka-system-performance/test-environment-details#supermicro):

> 8 backend servers (SYS-2029BT-HNR / X11DPT-B), each with 6 .. drives

Those are some chunky nodes - one Xeon Gold 6126 CPU ([TDP](https://ark.intel.com/content/www/us/en/ark/products/120483/intel-xeon-gold-6126-processor-19-25m-cache-2-60-ghz.html): 125 W) per every three SSDs. The read performance is nice, but that's a lot of CPUs (16 x Gold 6126 CPU) for only 48 disks. What would Greta say?

![Greta is NOT happy about WEKA's CPU requirements](/assets/images/weka-angry-greta.png)

The other thing with this approach having another storage cluster (Object Store for tiering to S3) seems almost mandatory. After you get the bandwidth you need - 100-200 GB/s, whatever - to be fair with WEKA's performance that happens quickly - who wants to run eight new CPUs for every 24 disk drives added to the cluster? Not many people do.

WEKA is all-flash storage, all right, but many users can't avoid NL-SAS which has to be "outsourced" to an Object Store where you load up on hundreds of NL-SAS disks just as you would with hybrid primary storage. So you don't buy NL-SAS here, you buy or rent them over there (from whoever offers S3 appliances or service).

As an example not meant to be completely like-to-like: with IBM Spectrum Scale or ThinkParQ BeeGFS one can use hybrid storage with mixed SSD/NL-SAS pools, avoid S3 network traffic, and potentially avoid the need to move data around in the first place (why, because you can say "these are sequential workloads, write directly to NL-SAS pools on parallel file system"). (Spectrum Scale can also tier to S3, but I'm not talking about that feature here.)

I get it, WEKA can tier blocks and not files and can also "force" writes to go to S3, but the approach does mean many WEKA on-prem users have to buy (or lease) and manage S3 storage, and design for enough bandwidth not just internally within the cluster, but also to the outside world (to/from S3) - because if you don't, your S3 (and therefore WEKA front-end) will work like an on-prem version of AWS Glacier. The complexity, power consumption and performance requirements just move from A to "A & B".

Let's say you "start small" with six WEKA nodes and perhaps four S3 appliances to form an Object Store cluster. That's 10 nodes and two clusters with likely different operating systems to secure, maintain and manage. (I see that WEKA has a front-end S3 service, but I don't know if they have S3 SDS that supports NL-SAS which could be used for tiering from WEKA hot storage). 

[Cloud bursting](https://docs.weka.io/fs/snap-to-obj#cloud-bursting) vs. 4096 snapshots:

> Cloud bursting requires the following steps: Take a snapshot of an on-premises Weka filesystem. Upload the data snapshot to S3 at AWS using Snap-To-Object.

All good. But I suspect in 2022 very few people burst TB-sized data sets to the cloud because for most it's probably faster to just wait in their on-prem queue. 

The other thing to note is the [snapshots](https://docs.weka.io/fs/snapshots) section mentions a global maximum of 4096 snapshots, which means users on large capacity Weka clusters who size their filesystems for frequent cloud-bursting may end up with hundreds of small filesystems, making it necessary to economize with snapshots (4096/200 = average 20 per filesystem). 

A better approach for users who want to burst to cloud a lot might be to create several small filesystems dedicated to "cloud bursting" and when they need to burst to cloud, rsync data from wherever on WEKA it normally is to this small filesystem and then kick off "snapshot to S3" to restore it from the cloud. That doesn't sound very convenient, though: create a smaller FS, copy some of your data to FS, create a snapshot of it, upload snapshot to the cloud, wait until upload is done, and delete the source snapshot, and then delete the source side copy data.

Not everyone solves this better, but if cloud bursting is a frequent operation it may be better to use another solution - for example file replication or [transparent caching](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html) approaches that only fetch files or *parts* of files when they're are accessed from the remote (cloud) side. Or just use S3 to upload the file set you need to the cloud and don't bother with filesystem-based replication.

Another approach, which can be convenient for users who won't run a scale-out workload in the cloud can be [this](/2022/08/30/apptainer-beegfs-software-bom-sbom.html#build-data-app-container-and-check-its-inventory): package both your app and data in an Apptainer container and copy it to your cloud storage. Like I said one container won't scale out, but it's very easy to transport your containerized app and the files you need, to any destination you want. It can be AWS FSxN or - for parallel workloads - [Azure BeOND](https://techcommunity.microsoft.com/t5/azure-global/tuning-beegfs-and-beeond-on-azure-for-specific-i-o-patterns/ba-p/1015446) or whatever other filesystem that works with Singularity-type containers.

Above I've mentioned several alternative approaches that all seem easier and are storage-independent giving you more flexibility and a lower cost. I can think of only one use case for Weka's approach: you have Weka in the cloud and on-prem, and you want to re-sync your on-prem filesystem to the cloud (and/or back). That's great, but not very effective.

Oh, one more thing about WEKA [snapshots](https://docs.weka.io/appendix/weka-csi-plugin#unsupported-capabilities) - at this time they aren't supported from WEKA CSI Plugin:

> Unsupported capabilities: Snapshots

To be fair, some scale-out storage doesn't support snapshots at all (example: BeeGFS). But if you need them today with WEKA and Kubernetes, you can't create them using WEKA CSI Plugin. Perhaps scheduled storage-side snapshots or on-demand snapshots with `snaptool` can be used to get around that, but administrator's assistance is required, making it suitable for only static workloads (which wouldn't work with auto-scaling, for example).

About WEKA [licensing](https://docs.weka.io/licensing/classic-licensing#obtain-a-classic-license-from-get.weka.io):

There are Pay-as-You-go licenses and "old school" Classic Licenses. 

> A classic license is a text element you create in get.weka.io for your specific Weka cluster and then apply the license text to your Weka cluster.

For Pay-Go licenses, it's not rare that when they expire, the stuff just stops (of course, it not *always* does - for example, NetApp StorageGRID 11 will alert you and keep going). 

For Classic, it's not so common to see your software stop. But in this Classic License workflow I see a screenshot that says "Duration: 365 days" and it makes me wonder what happens on Day 366.

![The Day after 365 days plus tomorrow](/assets/images/weka-classic-license.png)

Does the stuff still work? Or do WEKA mounts simply disappear? It'd be nice to have that documented.

As an example, BeeGFS won't stop regardless of how you run it (Community or Enterprise mode). I think it is also easy to switch from Enterprise to Community by simply disabling Enterprise mode features (such as ACLs) and restarting BeeGFS services - the features would become unavailable, but your filesystem would be up and running and data available.

About [failure domains](https://docs.weka.io/overview/ssd-capacity-management#failure-domains-optional):

> This documentation relates to a homogeneous Weka system deployment, i.e., the same number of hosts per failure domain (if any), and the same SSD capacity per host. For information about heterogeneous Weka system configurations, contact the Weka Support Team.

SolidFire has them too, and I [wrote about that](/2021/07/06/solidfire-protection-domains-data-path.html) feature once or twice. (Incidentally, an image from that post reminds me: some SolidFire appliances also use SuperMicro Big Twin chassis.)

SolidFire supports heterogeneous failure domains (the term SolidFire uses is "Protection Domains", but it's the same thing), and maybe some other storage software does too. One might think WEKA does this the same way, but it seems not-so-trivial to accomplish and probably negatively impacts the manageability. 

Once you go with FDs, you need to manage expansion based on a common pattern for these situations:

> All failure domains are always participating in storing the data, and the hot spare capacity is evenly spread within all failure domains.

Like with SolidFire, if you have N protection domains, you must grow the cluster by at least N nodes at a time (with SolidFire they can be smaller or bigger than existing nodes), whether you need them or not. What does one gain in exchange?

> ... system data with a protection level of 4 is protected against any concurrent 4 host/disk failures, and its availability is protected against any 4 concurrent disk failures or 2 concurrent host failures.

It seems that with WEKA on Big T(w)in that (optional) protection from *two* concurrent host failures doesn't get you very far with Bin T(w)in boxes because each chassis has *four* nodes.

How does it protect you when a four-node chassis - or a rack that hosts one - fails?  The documentation doesn't say. I suspect it doesn't. So you may want to use 1U servers to get around that, and maybe lose some of those CPUs which make Greta angry.

## Conclusion

The Weka product documentation is good and easy to use.

I would recommend it to anyone looking to learn more about WEKA as well as alternatives, because some of their [marketing blog posts](https://www.weka.io/learn/beegfs-parallel-file-system/) are not as ... detailed. 

I expected more from the new S3-related features in v4 but they seem somewhat basic and mostly aimed at solving a WEKA-to-WEKA filesystem copy or re-sync problem without opening incoming network ports on WEKA clusters.

What's missing in the documentation - maybe just there, maybe in the software as well - are compliance features, anti-ransomware, anti-virus, anti-tampering (including by admins), and such. Because if you have 500TB of ~~eggs~~ data in one big basket, you probably want an enterprise basket.

Users who want to offload (or tier) high-performance data to an on-prem object store, encrypt all data regardless of client type or protocol, prevent OS tampering, have a more efficient and seamless hybrid cloud integration, and so on - can't do that with WEKA v4 alone. 

Many would have to purchase and manage at least two storage platforms (for example, WEKA + on-premises Object Storage) and probably source additional 3rd party software or subscription services. Or they may want to consider another high-performance tier and get the entire storage solution stack from one of the larger storage vendors.

*NOTE:* if you think you've found an inaccuracy in this post, create an issue in my blog's Github repository.
