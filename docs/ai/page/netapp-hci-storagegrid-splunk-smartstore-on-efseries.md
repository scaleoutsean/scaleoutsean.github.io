# StorageGRID SDS for Splunk Smartstore on NetApp HCI, EF-Series

Virtualized StorageGRID with NetApp HCI and EF-Series

If you'd like to deploy Splunk SmartStore with NetApp StorageGRID object storage but also want to "start small", you can consider using smaller StorageGRID appliances or deploy StorageGRID as virtual machines.

Which one is better? Both are great. Which one is better for *you* depends on your current, and (expected) future, requirements and preferences.

This post is about the latter - addressing smaller SmartStore requirements which need to be satisfied on-premises by deploying StorageGRID VMs on NetApp HCI.

- [Assumptions](#assumptions)
- [NetApp HCI with Mellanox SN2010 and EF570](#netapp-hci-with-mellanox-sn2010-and-ef570)
- [VM-to-storage mapping](#vm-to-storage-mapping)
  - [Compute node sizing for Splunk and StorageGRID](#compute-node-sizing-for-splunk-and-storagegrid)
  - [VM storage sizing for data on NetApp HCI storage nodes](#vm-storage-sizing-for-data-on-netapp-hci-storage-nodes)
  - [Tier capacity calculation on EF-Series array](#tier-capacity-calculation-on-ef-series-array)
- [Capacity and performance scaling](#capacity-and-performance-scaling)
- [Transition to StorageGRID appliances](#transition-to-storagegrid-appliances)
- [Reasons for SmartStore on StorageGRID VMs and EF-Series](#reasons-for-smartstore-on-storagegrid-vms-and-ef-series)
    - [Storage overheads compared](#storage-overheads-compared)
- [Summary](#summary)

## Assumptions

What's a "smaller" SmartStore requirement? That's also subjective, but let's assume that is (currently) somewhere between 50 and 300 TB.

It is likely that this environment doesn't have a lot of busy Splunk indexers, so let's also assume four indexers running across four ESXi hosts, for which we may be using either blade servers (H410C, 4 per 2U chassis) or "pizza box" H615C servers, with enough CPU cores for all VMs involved even when one server fails (otherwise, if we wanted to be able to process data with "N-1" ESXi hosts, we'd need one more server).

Since we'll use a flash array for SmartStore data, we can use the same array for Splunk Hot Tier (and SmartStore cache).

## NetApp HCI with Mellanox SN2010 and EF570

We'd pick a pair of switches (Mellanox SN2100) and one of all-flash EF-Series arrays such as the EF570 configured with eight 25G iSCSI ports (4 per controller):

- For this situation NetApp EF-Series array would suffice both capacity- and performance-wise, but considering that we'll use the same array for Hot Tier and Smartstore, we pick one of faster models, EF570
- Each Mellanox SN2010 has 18 25G ports, which means we have 36 ports at our disposal (excluding inter-switch links and uplinks)
  - Four H410C (4 x 25G on each) compute nodes take 16 ports
  - Two H410S (HCI storage nodes used for all VMs including Splunk, StorageGRID, etc.) consume 4 ports
  - The EF570 with iSCSI add-on card uses eight ports, so by now we've used 28 out of 36, which means we can add two more H410C compute nodes at a later time. If we expect to need more than that before next h/w refresh, we could start with a larger Mellanox Ethernet switch (SN2100)

That would look approximately like this (with 16 rather than the pictured 4 network cables from NetApp HCI (top) to Mellanox SN2010 switches):

![NetApp HCI with Mellanox SN2010 and EF570](/assets/images/splunk-smartstore-storagegrid-vm-netapp-hci-ef-01.png)

## VM-to-storage mapping

If we wanted to start with a very small configuration, we could use the EF570 which can fit up to 24 SSD drives in the controller shelf (same as other currently available EF-Series models) and scale to 5 shelves (including the controller shelf).

- For VMs running Splunk indexers attached to Hot tier and SmartStore cache, we want volumes on a RAID 10 group because we don't need a lot of capacity, we want a fast performance and we expect that in the future SmartStore will grow much faster than this tier so RAID 10 is perfect for that
- StorageGRID storage VMs can store their data on a more redundant (in terms of tolerance to disk failures) disk group such as RAID 6 or DDP pool ([this post explains](/2021/01/04/elasticsearch-on-netapp-h615c-ef280.html#elasticsearch-data-protection-with-ef-series) main differences between the two, but let's just say RAID 6 and DDP are similar)
  - Because we have four ESXi hosts and sufficient resources to tolerate the failure of one ESXi host, we chose to use four storage VMs and store objects using Erasure Coding 2+1, which requires N+M+1 VMs (2+1+1=4)
  - Considering the small initial size of this StorageGRID, we take 20 disks to create one DDP pool and on top of it create four volumes (for four VMware datastores), so we have just one volume per each StorageGRID storage node
- Splunk, StorageGRID and all other VM OS disks live on NetApp HCI storage - we have just two of them (H610S-1) because that's enough both capacity- and redundancy-wise (we can tolerate the loss of one HCI storage node). If we had over 100 VMs in this environment we might need more capacity and perofrmance and add additional nodes.

Showing Splunk-related data on the EF array (StorageGRID 4 storage node VMs on the left and Splunk indexer volumes on the right with only two VMs to declutter the image) would look similar to this:

![EF-Series storage layout with single shelf for StorageGRID and Splunk indexers](/assets/images/splunk-smartstore-storagegrid-vm-netapp-hci-ef-02.png)

Splunk indexers running Linux could use LVM to combine two physical volumes into one larger logical volume, but we could also create large volumes on the array to avoid having to do that. LVM would be desirable if we expected Hot Tier may need to grow without new indexers.

If we expect our data retention requirements will soon increase or need more disks for SmartStore, we can start with two partially (or fully) populated shelves. Only one VM of each service (StorageGRID storage node, Splunk indexer) represents each workload.

![EF-Series storage layout with two shelves for StorageGRID and Splunk indexers](/assets/images/splunk-smartstore-storagegrid-vm-netapp-hci-ef-04.png)

### Compute node sizing for Splunk and StorageGRID

Sources:

- Splunk [recommendations](https://docs.splunk.com/Documentation/Splunk/8.1.0/Capacity/Referencehardware) for v8.1
- StorageGRID [requirements](http://docs.netapp.com/sgws-114/index.jsp?topic=%2Fcom.netapp.doc.sg-admin%2FGUID-B9B9FB7B-76FA-4C85-99A7-4310E3F24F1C.html) for v11.4 VMs on vSphere
- NetApp HCI [datasheet](https://www.netapp.com/media/7977-ds-3881.pdf) as of now

Following those requirements and recommendations I picked 16 cores (between basic and medium recommendation) for Splunk indexers.

|  Item     |  Detail     |  VM x Cores     |  Total Cores  |
|  :---  |  :---  |  :---:  |  ---:  |
|  Splunk     |       |       |  **82**  |
|       |  Indexer | 4 x 16   |  64  |
|       |  Search Head | 1 x 16 | 16 |
|  StorageGRID |       |       |  **56** |
|       |  Admin | 1 x 8 |  8 |
|       |  Backup Admin | 1 x 8 |  8 |
|       |  Storage Node | 4 x 8 | 32 |
|       |  Gateway Node | 1 x 8 |  8 |
|  Other|  VCSA, HCI Mgmt, Splunk UFW  | 2 x 8 | **16** |
|**TOTAL**|       |       | **154**  |

At a 75% average utilization, 115 cores would be required.

StorageGRID has a lot of CPUs allocated to it, but we know its only hard workload is searches for non-cached data, therefore with one ESXi down only searches that download non-cached SmartStore data could be slightly, if at all, impacted.

Using H410C compute nodes:

- 4 x H410C with 2 x Xeon Gold 6138 (20 cores) = 160 cores
  - 120 cores with one ESXi node down - enough to run Splunk at ~90% and the rest at ~50%

If using H615C compute nodes (these need just 2 x 10/25G ports per server, but require vSphere Enterprise Plus):

- 4 x H615C with 2 x Xeon Gold 6252 (24 cores) = 192 cores
  - 144 cores with one ESXi node down 
  - Because these 1U nodes require just two SFP28 ports each, we can double Splunk cluster size without adding additional ethernet switches

This sizing exercise is obviously just an example that should be further refined.

I did not consider RAM requirements because NetApp HCI compute nodes come with plenty of RAM and we could probably beef up RAM resources of Splunk search head and indexers above the Splunk-recommended values.

### VM storage sizing for data on NetApp HCI storage nodes

| Item   |  Size (GB) |
|  :---  | ---:  |
| OS for all Splunk VMs             | 200 |
| OS and Data for SG Admin & Backup | 1,000 |
| OS for SG Storage Nodes | 400 |
| OS for SG Gateway Node | 100 |
| OS and Data for NetApp HCI Management Node | 500 |
| Everything else | 500 |
| **TOTAL** | **2,700** |

NetApp HCI usually gets 3x storage efficiency, some of this stuff would deduplicate really well (e.g. all OS) and Management Node can be thin-provisioned. It's possible only 1TiB of usable capacity might be enough - especially if we moved StorageGRID Admin Nodes out to that DDP pool on EFF (that would take away 1TB from that pool later so keep that in mind when sizing).

Two H610S-1 (12 x 960 GB SSD each) are more than enough for this. If we wanted to use H410C compute nodes (which use the same chassis as H410S storage nodes), we could consider using two or three of the smallest H410S (6 x 480GB SSD each) instead, but it would be wise to give a try in the lab to avoid surprises.

If you're interested in the details of deploying StorageGRID on NetApp HCI, see [NetApp TR-4734](https://www.netapp.com/pdf.html?item=/media/17114-tr4734pdf.pdf) but remember that with storage node data on EF-Series, some of the detailed tuning advice for NetApp HCI storage would not be required.

### Tier capacity calculation on EF-Series array

How large would these volumes be? That depends on disk size(s) (from 1.9 to 15.3 TB). They could all have the same size, or we could pick a larger capacity for SSDs in DDP pool, and use a smaller size for the 4 disks in RAID 10 (or the other way around). We also don't have to populate all 24 slots at once.

With 3.8 TB disks in all the 24 slots we'd have:

- Approximately 60 TB for SmartPool data which, after Erasure Coding applied by StorageGRID, translates into 45 TB. If by "50 TB" we meant "50 TB for Splunk SmartStore", we could use 12 (or thereabout) 7.6 TB disks instead. Each StorageGRID node would have one or two volumes smaller than 20TB.
- Approximately 7 TB for Hot/Cache Tier which translates to almost 2 TB per each of 4 indexers and enough for 3-4 days of data (with RF=2, daily volume 1,000 GB/day). To make that a week, we'd use the same number of 7.6 TB disks. Using RF=2 on hosts that all have their data on the same RAID 10 doesn't enhance protection from disk failures, but can help prevent downtime to issues with individual indexer OS, filesystem corruption and such.

It doesn't have to be done exactly this way. The idea is to find a balance in data protection, performance, manageability (avoid complexity, avoid too many volumes) and other things we care about.

Larger disks in DDP pool translate into a larger SmartStore capacity, while larger disks in RAID 10 normally result in a better performance for search and reporting because relatively more data would be available for immediate queries (without having to fetch it from SmartStore).

Because the optimal size of each tier greatly varies between use cases, applications and user behaviors, even within one Splunk cluster there could be order-of-magnitude differences between optimal settings for each index (such as 3 days on Hot Tier for one index vs. 30 days for another).

## Capacity and performance scaling

Compute resources could scale to dozens of ESXi servers as common with VMware. But - as mentioned above - if we started with the smallest network switch model (SN2010) we'd have to add additional switches for that, or start with one of larger models (SN2100, SN2700) to avoid the hassle of having to make modifications too soon.

Storage-wise, we could add capacity - and quite a bit of performance - by adding additional disk shelves.

In picture below, to make it easier to on the eye, only one of four Splunk indexers is shown and only some disk groups are highlighted:

- StorageGRID capacity is now carved out of independent RAID 6 disk groups compared to one DDP in the earlier image
- Splunk Hot/Cache is across two independent RAID 10 disk groups (LVM with concatenated logical volumes, Splunk RF still 2)

![Fully populated EF570 array for Splunk Smartstore and Hot/Cache Tier](/assets/images/splunk-smartstore-storagegrid-vm-netapp-hci-ef-03.png)

Above illustrations aren't necessarily "best" ways to lay out storage (for Splunk or in general) but they are "close enough" and indend to show there are different ways to get the capacity, performance, and redundancy for various requirements.

We could increase SmartStore capacity at least fivefold (by adding 4 additional shelves to the initial deployment with one, controller, shelf) before we'd had to add another storage array or StorageGRID appliances. Why "at least" fivefold?

- We could use larger disk drives in other shelves
- If we didn't have to grow Hot/Cache tier shelves #2 to #5 could use more than 20 drives per shelf for StorageGRID VMs serving SmartStore
- If it turned out RAID 10 was too generous performance-wise (i.e. low IOPS observed on Hot/Cache), we could use DDP across the board

## Transition to StorageGRID appliances

What if we *didn't* want to go beyond one EF570, but instead decided it was time to move SplunkStore to StorageGRID appliances? No problem!

Because StorageGRID clusters can be asymmetric and heterogeneous, it's possible to further expand this SmartStore deployment not just beyond the size and performance of multiple EF570 arrays, but also with StorageGRID appliances.

We could expand our VM-based StorageGRID cluster with physical StorageGRID appliances, and even gracefully remove StorageGRID storage node VMs from the cluster, effectively migrating SmartStore data out to StorageGRID appliances without downtime. Other, "storage-less" StorageGRID VMs (administrative VMs, for example) would still live on NetApp HCI but if you wanted to move everything out to StorageGRID appliances, you could (using the StorageGRID SG models which provide network load balancing as well as administrative service).

That would release some or all of the capacity on the EF570, which could be reused for additional Hot/Cache data, or other applications in your NetApp HCI environment.

If we had no immediate need for the freed DDP capacity, we could let StorageGRID run across both VMs and appliances, also transparently to Splunk.

## Reasons for SmartStore on StorageGRID VMs and EF-Series

Some may wonder: why complicate things and use SmartStore when Erasure Coding 2+1 on top of DDP only decreases (by 33%) the amount of capacity that could otherwise be used for Splunk Warm Tier?

First, SmartStore has several operational benefits and if you think that's worth the extra cost, this is one of less expensive ways to deploy SmartStore on SSDs. Most object storage appliances start at more than 50 TB so you'd probably start with not just 10-20 TB of overhead (compared to Warm Tier on DDP, for example) in any case.

Second, deploying a smaller SmartStore to better understand how it fits your use case (search and reporting patterns, retention requirements, and so on) can help you save money when you deploy SmartStore at scale. You may discover there are indexes that you don't want to put on SmartStore and decide to add a Warm Tier on a new RAID 5 disk group, for example.

Third, if your SmartStore continues to grow, you can recover capacity allocated to StorageGRID storage VMs.

Four, suppose you realize you need to retain SmartStore data for 365 days, but your search and reporting timelines go back only up to 60 days. Maybe you don't need 500 TB of all-flash SmartStore capacity? You could expand this EF-based StorageGRID cluster with HDD-based StorageGRID appliances, and use StorageGRID ILM to store SmartStore data in two object store tiers: (1) fast SSD tier on EF-Series, and (2) lower cost tier on StorageGRID appliances. StorageGRID can also use object storage in Public Cloud as its low cost tier.

Five, if you needed an off-site copy of SmartStore data, you could expand StorageGRID with HDD-based appliances at a remote location (it's never searched, so maybe HDDs will do?) and use StorageGRID ILM policies to replicate SmartStore data to it.

Six, my earlier statement about losing 33% capacity was not entirely correct: SmartStore saves just one copy of data to Remote Tier, so with tiering to StorageGRID, Splunk RF changes from 2 to 1. Two copies from RAID 10 become one copy on DDP pool with a 50% overhead due to erasure coding used to protect StorageGRID data.

There's more, but my point is: most Splunk users may not care about some of these reasons, but everyone starting with SmartStore should be able relate to at least one or two, and that can matter enough to consider merits of this approach.

#### Storage overheads compared

To elaborate on point six, here's a look at the overheads involved in our approach with the first, controller shelf (this doesn't concern itself with Splunk compression and metadata):

| Tier       | DDP  | RAID 10 | Splunk RF | Object Store (EC 2+1) | TOTAL|
| ---        | :---:| :---:   |:---:      | :---:                 | :---:|
| Hot/Cache  |  -   |   2x    |  2x       |  -                    | 4.0x |
| SmartStore |  1.1x|   -     |  1x       |  1.5x                 | 1.7x |

If we used DDP for all data or had more (or less) disks in DDP pool, we'd get different results. Hot/Cache Tier has 4x overhead but its cost is minimal (it's just four drives for the entire deployment, not per each indexer).

SmartStore on EF-Series doesn't necessarily have a negative impact on usable storage capacity available to Splunk.

## Summary

Splunk users on NetApp HCI with EF-Series arrays can take advantage of SmartStore by using StorageGRID VMs backed by an EF-Series array.

After the initial capacity requirements are confirmed, we select a suitable disk size for DDP pool and from that moment it is very easy to increase SmartStore capacity in *single drive* increments and scale it to hundreds of TBs without complications.

If you're interested in starting small with an on-premises SmartStore, I hope this post motivates you to evaluate this approach.
