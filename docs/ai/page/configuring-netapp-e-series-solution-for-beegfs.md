# Configuration approaches to NetApp E-Series with ThinkParQ BeeGFS

How to mix and match storage and servers

It may not be easy to digest how BeeGFS with NetApp E-Series is usually configured.

One of the good reasons is that it can be configured in many different ways, but then people just ask for one or two suggestions to look at.

Another is that many BeeGFS clusters out there use data mirroring, which the NetApp E-Series solution for BeeGFS does not - instead, it uses HA server pairs with protected storage on E-Series arrays.

Let's take a look at some examples.

## Two servers, one disk array

Two servers with one E-Series disk array are used when performance and capacity requirements can be met with a single E-Series array.

In the case where the servers don't need to max out E-Series array performance, using 1U, uniprocessor servers provides a way to save compute node cost.

![BeeGFS HA pair with one E-Series array](/assets/images/beegfs-layout-two-one.png)

Comments:

- It is usually desirable to put data and metadata on separate disk groups/pools
- Create 1 or 2 volumes on each group/pool and present to BeeGFS server pair(s)
  - Use RAID 1 or 10 for metadata, usually no more than 2-3% of data capacity
  - Use RAID 6 or DDP for data; on each group/pool create 1 or 2 volumes per BeeGFS server
  - EF600 has 24 slots so one nice way to divide that for MD and Data is like this:
    - 2 RAID 6 groups (8+2) = 20 disks; 1 volume per RAID group when two BeeGFS servers are used
    - 2 RAID 1 groups (1+1) = 4 disks; 1 volume per RAID group when two BeeGFS servers are used
  - It's possible to create two metadata volumes on each RAID 1 group, but with two servers one volume per RAID/DDP is enough
- If MD doesn't need more than two disks worth of IOPS, we could also create one RAID 1 group with two volumes on it, but while that would save two disks (and slots in the controller chassis), there isn't much we can do with 2 available slots *unless* we change RAID 6 (8+2) to a wider RAID 6 (10+2) or DDP (12/2). Would that make sense?
  - If you need more capacity to avoid buying another storage array and are happy with just two disks for MD, that can be a good idea
  - 8+2 is most performance-effective RAID 6 configuration for EF600, so if you need more capacity you could as well go with DDP (12/2 or even 12/1) if you're not optimizing for highest data performance

## Two servers, two disk arrays

Sometimes more performance or more capacity is needed. Because we have two E-Series arrays at our disposal, we would probably use 2U, two-way servers to be able to fully utilize their bandwidth. 

This is how NetApp BeeGFS Building Block validated for NVIDIA SuperPOD looks like, so you may hear people refer to this approach as "BeeGFS building block".

![BeeGFS-E-Series Building Block](/assets/images/beegfs-layout-two-two.png)

Comments:

- Commonly you can't go wrong with RAID 6 for data and RAID 1 for MD, but sometimes you may want to use RAID 10 for MD or DDP for data; usually that has to do with capacity or performance requirements, when a small deviation from RAID 6 (8+2) and RAID 1 can help you avoid purchasing another building block
  - Example: one RAID1 (1+1) group and one DDP (22/2) pool per each E-Series array. We should create two volumes per each group and pool to have each server active on 50% of the disks

## Other combinations

By now it's probably clear that we can pretty much do what we want. 

- Need 1 million metadata IOPS? Deploy a dedicated HA pair with EF600 for metadata-only workload and deploy separate data "pods" for data-only workload
- Need to maximize capacity and keep the cost-down? Expand EF600 with multiple NL-SAS expansion enclosures (up to 60 18TB disks each) and configure just two wide pools - DDP (30/2) - on each enclosure which takes only 4 disks of overhead per 60 disk enclosure (93.33% usable)
- Don't want to use any SSDs for BeeGFS data disks? Configure a dedicated Metadata "pod" with EF600 (NVMe SSDs) and have Data pods use E5760 with 100% NL-SAS disks
- BeeGFS clusters with very static data could be built with only NL-SAS (for both data and metadata), but consider using SSD pools (DDP) to cost-down from the optimal RAID 1 while still retaining 100-200K IOPS for metadata before you even think about using NL-SAS for metadata. Especially with EF600 and EF300 where controller shelves can only host SSDs, controller shelf is a great place for all-NVMe metadata SSDs - even if SSDs are in a DDP pool made of 1.92TB SSDs, that's still much than any RAID 10 configuration for metadata on NL-SAS disks.

![Custom BeeGFS with E-Series](/assets/images/beegfs-layout-detailed.png)

Comments:

- Because Metadata volumes are on a dedicated E-Series array, each array dedicated to "Data" has 24 disks slots which means we can either:
  - Use two DDP (12/2) pools per array, to make use of all disk slots in the controller shelf (or shelves), **or**
  - Use two RAID 6 (8+2) groups per array and leave 4 disk slots empty (more optimal performance, but we may need another array if more than 20 disks are required for Data capacity). And adding an extra disk array may also need two more servers, so sometimes a small sacrifice in performance can translate into significant savings
- When possible (i.e. disk slots are available, etc.) and needed, it may be advantageous to use more smaller disks for metadata disk groups. By using RAID10 (4+4) made of 1.92TB disks it is possible to get up to 4 times more IOPS than with just two 7.68TB disks in RAID1. The capacity is the same and the cost of capacity is slightly higher, but the gain in performance is significant
  - BeeGFS clusters that will grow data will ultimately need more metadata capacity and performance, so we need to find optimal balance between using many small disks for IOPS and few large disks for capacity (like in the earlier examples, we don't want to run out of empty slots and buy another array, but we also don't want to use very large SSDs for metadata and have insufficient metadata performance)

## Networking

Although the diagrams are simple, it's obvious that common approach is switchless - it involves directly attaching servers to E-Series - while server-to-server and client-to-server communications are supposed to use a high-performance, low-latency network such as Infiniband or Ethernet. The same switch pair could be used for server-to-storage communications, but many clusters don't have it because there's no gain in performance or even manageability, yet it adds to the cost.

If you need fewer servers and many arrays (example: four servers, 12 arrays), DAS won't do it because there aren't enough ports on current E-Series arrays to allow that. In that case a SAN is necessary and a pair of switches (IB or FC) can help. BeeGFS server pairs connected to switches can be connected to multiple E-Series arrays. To use the earlier example of four BeeGFS servers and 12 E-Series arrays: each server pair can be connected to six arrays).

## Other information

If you plan to deploy BeeGFS with E-Series and get support from NetApp, you should use Ansible to configure E-Series and deploy BeeGFS. 

In that case, read [the documentation](https://docs.netapp.com/us-en/beegfs/beegfs-deploy-overview.html#configuration-profiles-for-beegfs-building-blocks) to make sure your configuration is supported or submit a feature request (or even better, pull request) for it on Github.
