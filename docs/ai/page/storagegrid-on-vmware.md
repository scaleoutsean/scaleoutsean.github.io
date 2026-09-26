# NetApp StorageGRID on VMware

Notes on considerations for running StorageGRID S3 SDS on VMware vSphere

- [Introduction](#introduction)
- [Network](#network)
- [Servers](#servers)
  - [StorageGRID load balancer](#storagegrid-load-balancer)
- [OS](#os)
- [Storage](#storage)
  - [Flash tier](#flash-tier)
  - [NL-SAS tier](#nl-sas-tier)
  - [DDP vs RAID Groups for object space on storage nodes](#ddp-vs-raid-groups-for-object-space-on-storage-nodes)
  - [Maximum storage node capacity for SG SDS](#maximum-storage-node-capacity-for-sg-sds)
  - [Erasure Coding vs 2 Copy policy](#erasure-coding-vs-2-copy-policy)
  - [vSAN as storage backend](#vsan-as-storage-backend)
  - [NetApp E-Series as storage backend](#netapp-e-series-as-storage-backend)
- [StorageGRID pools and grades](#storagegrid-pools-and-grades)
  - [Storage grades](#storage-grades)
- [Deployment and Administrative Domain Controller (ADC) services](#deployment-and-administrative-domain-controller-adc-services)
- [Example](#example)
- [Conclusion](#conclusion)

## Introduction

StorageGRID 11.8 runs in Docker containers VMware and can run on bare metal or VMware.

The StorageGRID VMware-related documentation is [here](https://docs.netapp.com/us-en/storagegrid-117/vmware/planning-and-preparation.html), but it doesn't cover the hardware-related stuff.

> Hardware-specific installation and integration instructions aren't included in the StorageGRID installation procedure.

"The community" has done nothing on this, so I figure this is going to be the best post on StorageGRID on VMware vSphere for some time.

## Network

This is a complex topic, but simpler than with physical StorageGRID appliances because you can adjust your configuration easier on VMware (at least before installation, if not after).

This should be a separate post, but if you're curious, check both VMware-related network requirements as well as general concepts about [StorageGRID networks](https://docs.netapp.com/us-en/storagegrid-118/network/topology-for-all-three-networks.html) including connectivity with external services.

One thing that frequently trips users is promiscuous mode isn't enabled or can't be enabled on the VM interfaces. This is documented for hosts (i.e. VMs) but not specifically in VMware install section for StorageGRID 11.8  (as far as I can see). See [this](https://docs.netapp.com/us-en/storagegrid-118/troubleshoot/troubleshooting-network-hardware-and-platform-issues.html#promiscuous-mode) for that and other troubleshooting.

Jumbo frames: unless those are already in place in your environment, I wouldn't bother with them.

You may need anywhere between 1 (worst) to 4 (or even more) VLANs just for StorageGRID. For example:

- StorageGRID SDS
  - (mandatory) Grid network (that connects all StorageGRID nodes) - if this is the only network you have, then S3, management UI, NTP, DNS, and maybe ADS/LDAP, KMIP, etc. all uses this network. Most people don't want that.
  - (optional, but highly recommended) other networks that segregate different traffic (dedicated network for S3 API endpoints, another for StorageGRID Web UI, outgoing DNS/NTP, etc. - see the documentation).

## Servers

This part is generic - the faster and bigger the better. Official documentation has all the details.

> In a production deployment, don't run more than one Storage Node on a single virtual machine server. Using a dedicated virtual machine host for each Storage Node provides an isolated failure domain. 

This is true - if one ESXi box goes down, you don't want to lose 2 Storage Nodes. But if you use Erasure Coding (e.g. 4+2) and want to save cost, that may be fine: get 3 ESXi and run 2 Storage Nodes on each. 

Another thing to pay attention to is the hefty storage requirements for the seemingly unassuming gateway(s) and admin node(s). For v11.7, you can see those [here](https://docs.netapp.com/us-en/storagegrid-117/vmware/storage-and-performance-requirements.html#storage-requirements-by-node-type). 

Let's say we have 1 admin, 6 storage, and 2 gateway VMs:
- Admin: 100 GB (OS), 400 GB other stuff
- Storage Node (ea): 100 GB (OS) plus at least 3 x 4TB LUNs per node
- Gateway (ea): 100 GB (OS)

If SG OS is on local datastore and if 2 SNs run per box: Admin + 2 SN + 1 GW = 4 OS x 100 GB = 400 GB on each ESXi. Other disks (below) are separate.

If OS boot from a SAN datastore, then you don't need a local data store for SG VMs:

- Boot disks - (1 Admin + 6 SN + 1 GW) x 400 GB = 3.6 TB for 8 nodes
- /var/local - 90 GB per node = 0.72 TB for 8 nodes
- Other disks - 400 GB for Admin, (min) 12 TB for each of 6 SNs

You can find another example from the documentation [here](https://docs.netapp.com/us-en/storagegrid-117/rhel/storage-and-performance-requirements.html#example-calculating-the-storage-requirements-for-a-host). You can use less for "other" admin node data by retaining logs for a shorter time, but you may also want to install a backup admin node, in which case you'd need more.

If we use all-flash storage, then there's no need to "split" this, but if we use hybrid, then Storage Node LUNs can be on both flash and NL-SAS.
- Flash tier on a hybrid array: 400 GB for OS
- Flash tier for SN's disk 0: let's say it's 4 TB x 6 nodes = 24 TB
- NL-SAS tier for SNs disk 1, 2 (given the recommended minimum of at least 3 disks, and an arbitrary 4TB LUN size): 2 x 4 TB x 6 SN = 48 TB NL-SAS

An example of a storage container's disk configuration can be found [here](https://docs.netapp.com/us-en/storagegrid-117/rhel/example-node-configuration-files.html#example-for-storage-node).

```raw
BLOCK_DEVICE_VAR_LOCAL = /dev/mapper/dc1-sn1-var-local  # boot
BLOCK_DEVICE_RANGEDB_00 = /dev/mapper/dc1-sn1-rangedb-0 # optionally SSD on R5; 4 TB is the minimum 
BLOCK_DEVICE_RANGEDB_01 = /dev/mapper/dc1-sn1-rangedb-1 # NL-SAS on R6 or DDP
BLOCK_DEVICE_RANGEDB_02 = /dev/mapper/dc1-sn1-rangedb-2 # NL-SAS on R6 or DDP
BLOCK_DEVICE_RANGEDB_03 = /dev/mapper/dc1-sn1-rangedb-3 # NL-SAS on R6 or DDP
```

VMware Live Migration is not supported. 

### StorageGRID load balancer 

StorageGRID has custom-made appliances that can be used for management and load-balancing. 

Should we consider those or not? 

Most users who wish to use SDS probably won't use them, but they can be used for whatever reason. 

## OS

StorageGRID supports mainstream Linux distributions (Debian, Ubuntu, Red Hat). If you expect to be bothered by Security. you may want to use a commercial distribution with paid support. You can find [Red Hat install guide here](https://docs.netapp.com/us-en/storagegrid-117/rhel/index.html). 

StorageGRID OVA files are Debian-based, again, if you want a commercially supported OS, deploy Red Hat or Ubuntu VMs and then install StoraegGRID on those.

StorageGRID has strict NTP requirements, and you may want to install a small basic Linux VM with NTP service on each ESXi, so that you have at least 3 NTP servers right there, in addition to whatever there's elsewhere on LAN (Active Directory Server, etc.).

## Storage 

There's no requirement to use a flash tier or hybrid setup. Both are fine, as is an all-flash configuration. The only thing I wouldn't do is use QLC disks for the first disk in busy Storage Nodes.

### Flash tier

Continuing from the above, let's say we use RAID 5 for Flash Tier. For Storage Nodes, storage requirements can be found [here](https://docs.netapp.com/us-en/storagegrid-117/vmware/storage-and-performance-requirements.html#storage-requirements-for-storage-nodes).

As you can see, Volume 0 reserves space for metadata, which is why you may want to have that one on a flash disk.

### NL-SAS tier

Here the main thing we need to decide is how to provision storage.

Do we want 1, 2, or 3 arrays? Presumably one, as we're trying to save money. But we could use two arrays (maybe with 2 Copy storage policy), three (for Erasure Coding and  rack redundancy) or more. But if you need the fancy stuff, it's best to buy StorageGRID appliances. Let's assume we use just one.

### DDP vs RAID Groups for object space on storage nodes

DDP (search this blog, I wrote about it many times) puts all disks in one big pool. RAID does not.

Each has its advantages and disadvantages. DDP rebuilds faster, but can't tolerate more than 2 failed disks at a time, and if 3 fail before critical reconstruction is done, you may lose all data on all Storage Nodes. RAID groups have more overhead, but if we use N groups for N Storage Nodes, then it would take more disk failures to lose data. 

If one has two (with 2 Copy Policy) or three (with EC) arrays, then there's no loss in the case an array with DDP fails. But we're now talking about a setup with a single array, so we need to consider that. Even if you copy data to another StorageGRID or the cloud, having to copy back 100 or 500 TB is not practical at in 2024.

With three RAID 6 disk groups one could in theory lose up to 6 disks at the same time and not lose any data. 

### Maximum storage node capacity for SG SDS

As the link above says, a storage node can have 1 to 16 volumes and the other link tells us the largest tested volume size is 39 TB, so assuming 8 TB (largest supported Volume 0) and 39 for the other 15 equals some 620 TB per node. 

For large StorageGRID clusters with smallish objects we'd want to use the maximum sizes of Volume 0 in order to maximize the metadata capacity, which is explained [here](https://docs.netapp.com/us-en/storagegrid-117/admin/managing-object-metadata-storage.html#example-for-allowed-metadata-space). Another requirement for this situation -related to server (or in this case, VM) specifications - is at least 128 GB per storage node VM. That would give us [allowed metadata space](https://docs.netapp.com/us-en/storagegrid-117/admin/managing-object-metadata-storage.html#allowed-metadata-space) of 3.96 TB per VM.

If you want to go stingy on Volume 0 (to save cost of SSD), you could go for a small Volume 0 or even put it on NL-SAS rather than SSD.

### Erasure Coding vs 2 Copy policy

Which one to pick? Or both?

For EC, even the smallest one (2+1) we'd need at least 4 VMs (N+M+1). 

The other thing to notice is of course that we should not put more than M VMs on the same ESXi or RAID group.

For example, 3-node ESXi with VMs set to use EC 6+3, living on 3 datastores (ignoring the SSD group) backed by 3 RAID groups means:
- One ESXi down means 3 VMs down - reads can still work, maybe writes as well (depending on whether ILM is set to apply 6+3 on-ingest or not; which is another [rabbit hole](https://docs.netapp.com/us-en/storagegrid-117/ilm/advantages-disadvantages-of-ingest-options.html#example-of-how-the-consistency-control-and-ilm-rule-can-interact))
- One NL-SAS RAID group down - reads can still work, data not lost

The same cluster could also work with similar EC rules (2+1, 4+2) and 2 Copy. In this case, however, we need to remember to create a 2 Copy policy that:
- never stores 2 copies on storage nodes on the same ESXi (this can be mitigated by anti-affinity rules on VMware, or with local datastores by creating storage pools on StorageGRID that do not have members on the same ESXi nodes)
- never stores 2 copies on the nodes that use the same RAID group (because if that group fails, both copies would be lost)

Like in other cases, multiple arrays make this a non-issue as there's no such overlap of compute nodes and back-end storage.

If you use DDP, then you bet on DDP not failing, so you could have looser disk placement rules against data loss. But you'd still want to prevent downtime, so correct VM placement should still be implemented for service availability reasons.

### vSAN as storage backend

The official StorageGRID documentation lists vSAN is listed as not supported. Until things change, a possible way around that is to ask for an exception.

### NetApp E-Series as storage backend

The easiest protocol to use for this is iSCSI. Of course, other protocols can work as well. Other traditional arrays can as well.

For iSCSI, we should create dedicated VLANs like so:

- E-Series 
  - iSCSI VLAN 1 and iSCSI VLAN 2 (for ESXi MPIO, to each E-Series' controller A and B, respectively) - use dedicated NICs for "back-end" iSCSI storage, if available.
  - (optional) E-Series management API
  - (optional) E-Series BMC 

This is just an example. See the E-Series security features-related TR and documentation for additional information.

## StorageGRID pools and grades

Now is the right time to consider StorageGRID's storage pools. As mentioned above, you can create storage grades.

Guidelines for storage pools are given [here](https://docs.netapp.com/us-en/storagegrid-117/ilm/guidelines-for-creating-storage-pools.html). If you use erasure coding on StorageGRID, this is *required reading*.

I don't want to copy what's already documented, but I'll make an exception for this because I want to comment on those guidelines.

> Keep storage pool configurations as simple as possible. Don't create more storage pools than necessary.

The simplest pool configuration is one per site.

Complex configurations may complicate expansion or even administration. 

With StorageGRID appliances, you generally won't have a need to complicate things. But if you're in a situation where you want to create pools because you're using just one or two storage arrays with RAID groups and more than one VM per ESXi, it's unavoidable.

> Create storage pools with as many nodes as possible. Each storage pool should contain two or more nodes. A storage pool with insufficient nodes can cause ILM backlogs if a node becomes unavailable.

A small cluster with 1 array, 3 ESXi and 2 storage node VMs per ESXi allows the creation of 3 storage pools with 2 storage node VMs from each ESXi in each pool. 

> Avoid creating or using storage pools that overlap (contain one or more of the same nodes). If storage pools overlap, more than one copy of object data might be saved on the same node.

If we don't want precisely distribute data among VMs from different ESXi hosts and RAID groups, we'd have 2 or 3 VMs per pool and all of them use the same RAID group (or a dedicated RAID group for each) or a large DDP (E-Series drive pool, more on this later).

> For site-loss protection using erasure coding, create storage pools that consist of at least three sites. 

We can also do that with 3 ESXi and 3 datastores on 3 RAID groups. It's just one array, so these are fake "sites", but they do help us with creating EC rules that we want.

A storage pool has two attributes:
- Site
- Storage grade

The former is obvious, so let's talk about the latter.

### Storage grades 

Storage grade identifies property of storage in a storage node. That means primarily means storage media (NL-SAS, SSD), but it could be used for other things (fast CPU, slow CPU) if they mattered enough to our S3 services.

What is a [storage grade](https://docs.netapp.com/us-en/storagegrid-118/ilm/creating-and-assigning-storage-grades.html)?

> Using custom storage grades allows you to create ILM storage pools that contain only a specific type of Storage Node. For example, you might want certain objects to be stored on your fastest Storage Nodes, such as StorageGRID all-flash storage appliances.

We should have at least two nodes that share a grade. We already know a site must have at least 3 nodes, so we could use 3 or more VMs, but if we wanted to make use of storage grades, we'd need 6 nodes (VMs).

> Don't create more storage grades than necessary. For example, don't create a storage grade for each Storage Node. Instead, assign each storage grade to two or more nodes. Storage grades assigned to only one node can cause ILM backlogs if that node becomes unavailable. 

The simplest approach is to to keep all VM nodes in Default pool, use one storage grade for everything, and rely on VMware HA. In other words, don't touch those settings.

A complicated approach could be to physically segregate VMs into different storage grades and run them on segregated ESXi nodes (at least by default, if we can't after failover with VMware HA).

## Deployment and Administrative Domain Controller (ADC) services

ADC is documented [here](https://docs.netapp.com/us-en/storagegrid-117/maintain/understanding-adc-service-quorum.html). From that page:

> a minimum of three Storage Nodes at each data center site must have the ADC service.... A simple majority of those nodes must remain available after the decommissioning ((0.5 * Storage Nodes with ADC) + 1).

That's one of the reasons we want to have multiple RAID groups (or even arrays) rather than use DDP or just one array. With three RAID groups we can place up 3, 6 or 9 VMs on them (3 on each) and even if one RAID group is destroyed, we would have a majority online.

If we deploy more than 3 storage nodes on Day 0, an easy way to force them on different disks is to first deploy 3 (each on a different VMware datastore, with datastores on different LUNs backed by different RAID groups), and then add the rest if you have them.

This leaves us with the question of a single RAID 5 for Volume 0: if that RAID group goes down, all ADCs (and the rest) goes down as well. Well, that's a choice. We could use 3 RAID 1 groups instead, and follow the same approach a with NL-SAS. The reason I would tend to use RAID 5 on SSDs is that SSD-based RAID recovers quickly and it's extremely rare to lose 2 SSDs at a time. 

## Example

This made up example shows one possible approach - the complicated one.

This isn't the correct approach, but it's a smart approach. You can use other smart approaches.

First, a quick refresher on (the incorrectly termed) Volume Groups aka Disk Groups vs. DDP. 
- Disk group may be protected, and in the case of NL-SAS we commonly use RAID 6, whereas for SSD we use RAID 5
- DDP is a pool where each stripe is randomly dispersed among 10 disks. Each stripe goes to a different disk, as you can see in the example of 2 stripes here. 
- A best practice for RAID 6 is 10 disks (8+2), and due to that at most 9 disks participate in a rebuild. In the case of DDP, it can be arbitrarily large and only critical strips from the failed disk need to be rebuilt (non-critical also, but a DDP can survive another disk failure right after critical rebuild is done and that's what's important). Additionally, all disks in a DDP participate in reconstruction making it faster.

![](/assets/images/sg-sds-vmware-01-raid-ddp.png)

There's no "better" approach here - other approaches may be better but also worse - and DDP is easy: put all disks in there, create volumes and from them VMFS datastores. The approach I take here is to create separate RAID 6 disk groups.

Next, as the documentation tells us (discussed earlier), StorageGRID metadata benefits from fast storage. It's always on Volume 0, so for that we want SSD if possible. I recreated an image from StorageGRID documentation and added notes on VMware-related VMDK size limits (tested limit is currently 39TB per VM volume and up to 16 of them can be used).

![](/assets/images/sg-sds-vmware-03-sg-disks.png)

SSDs are fast to rebuild so we can have a RAID 5. For the above, we can create E-Series configuration similar to this. Hot spares (at least one of NL-SAS and one of SSD) are not shown. 

That gives us 3 RAID 6 and 1 RAID 5 disk groups. 

![](/assets/images/sg-sds-vmware-02-sg-eseries-vgs.png)

We then must create one or multiple LUNs on each RAID 6 group, and present them to vSphere via iSCSI (or other protocol). Is it possible to not use VMFS? Yes, but if you pick that route (vRDM or pRDM) for storage access, you may lose some storage management benefits that vSphere provides.

StorageGRID VMs could be deployed on a datastore on a LUN from RAID 5. Volume 0 for VMs living on the same ESXi would best be a separate VMFS, so that they are separate and VMFS corruption can't destroy all volumes. Some other VMFS could be created for additional disks that belong to Admin Node (either Primary, or Primary and Secondary if you have two).

VMDKs for StorageGRID storage nodes' volumes would be created on NL-SAS-based VMFS, also separated according to the nodes' grouping on ESXi.

Now with this configuration we can set things up as follows. Admin and Gateway nodes are not shown. 

![](/assets/images/sg-sds-vmware-04-sg-ilm-and-series.png)

My workload predominantly consists of 4 MB objects so I set just one default rule. For multiple workloads we could create another rule (say 2 Copy policy for objects smaller than 1 MB).

First, notice that while Volumes 1+ are cleanly separated on different RAID 6 disk groups, but the SSD group is shared. As I've mentioned, I think SSD-based R5 groups should handle disk failures within the same day.

Second, I've thrown in several small VMs for NTP. StorageGRID is sensitive to time so why not provide extra NTP servers. 

Third, the first three storage nodes will run ADC (explained earlier) so we deploy those first to separate ESXi hosts and then install additional ones. Do we need 6 storage node VMs? By default (without this fiddling) just 3 is enough, but we need 2 per RAID 6 because we're doing the storage grade thing. So we'd install 3 first, let the grid come up, and then add 3 more. 

With this I can use a filthy ILM trick to place 1/3 of each object onto a separate ESXi server and separate Datastore(s): each object is erasure-coded into 2+1 chunks and each of 3 chunks lands onto a datastore located on own RAID 6 disk group.

![](/assets/images/sg-sds-vmware-05-sg-ilm.png)

The warning at the bottom reminds that this isn't a perfect solution. This kind of ILM rule is meant for multiple sites. What I did above is configure 2 StorageGRID VMs from each ESXi as a "storage grade".

That approach means we could lose a whole RAID 6 disk group and still survive, but it's a bit complicated and may need adjustments if we want to expand storage capacity: we'd normally want to add 3 similar RAID 6 groups to expand this configuration, which would mean the next step would likely be at least one RAID 6 (10 disks) group, if not three, or else we'd have to create a new ILM policy and wait many days until rebalancing is done. Yes, it's complicated.

If we wanted to do a simple solution without violating this best practice, we could put all NL-SAS into a large DDP, carve it in to large 3 LUNs (and VMware datastores), use EC 2+1 and rely on VMware HA for storage node availability. Data availability would be good, but rely on the integrity and availability of a single DDP. Storage expansion would be very easy in that case - we could add disks to DDP in increments of 1 and in the case of 18 TB disks adding just a single disk would let you grow StorageGRID capacity in small increments of approximately 9TB ((disk size x roughly 80% for RAID overhead) x 0.66 for overhead of EC 2 + 1) in object capacity. (You'd probably want to add enough of the size you already have to create at least 10TB disks and not quickly exhaust the limit of 16 VMDK/volumes per storage node, but that's a separate concern.)

Some may say the RAID 5 volumes already rely on a single RAID group so why have multiple RAID 6 groups for NL-SAS, but like I said a SSD RAID 5 can rebuild quickly and I wouldn't worry about it compared to 10-disk RAID 6 made of 18 TB NL-SAS HDDs (which can take a long while to rebuild).

One last and very important thing (documented [here](https://docs.netapp.com/us-en/storagegrid-118/admin/managing-object-metadata-storage.html#how-storage-nodes-of-different-sizes-affect-object-capacity)): if we expect a high object count we may max out the MD portion of Volume 0, which happens at 8 TB mark (see that link), so 6 storage nodes need 48 TB. With an 8TB-sized Volume 0, each storage node can use close to 4 TB. 

> Similarly, because StorageGRID maintains all object metadata for a StorageGRID system at each site, the overall metadata capacity of a StorageGRID system is determined by the object metadata capacity of the smallest site. And because object metadata capacity controls the maximum object count, when one node runs out of metadata capacity, the grid is effectively full.

Do I expect ot have billions of objects here? With 1-4 MB object sizes, I do not. If I expected PBs of storage or many billions of small objects, I would use SG6060 (appliances) instead. So I could use the minimum size of volume 0 and only 3 storage nodes, to cut SSD capacity for that by a lot and that would be fine. But as of 11.8 it's not possible to adjust and resize volumes so it's best to use the maximum volume 0 size unless we're certain we won't need it.

## Conclusion

At scale, StorageGRID appliances eliminate the headaches associated with "building your own". 

But if you need a small grid (ROBO, low cost, Dev/Test), using a single E-Series array with a handful of ESXi can create a reasonably reliable VM-based StorageGRID cluster with reasonable trade-offs. 

It's possible to (sort of) emulate multiple StorageGRID appliances with E-Series RAID groups (as I did in that example), but that requires some planning and complicates expansion. The alternative approach with DDP, also described in [this post](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html#tolerance-to-disk-loss), is also workable and not worse.
