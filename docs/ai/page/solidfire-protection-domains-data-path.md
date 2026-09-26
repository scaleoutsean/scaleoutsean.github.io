# Data Path in SolidFire clusters with Protection Domains

How does SolidFire with Protection Domains store data

In the [post that compares SolidFire Protection Domains with Availability Zones](/2021/06/08/solidfire-availability-zones) I had this illustration of network connectivity among SolidFire v12 cluster nodes and between SolidFire and iSCSI clients.

![SolidFire Protection Domains](/assets/images/solidfire-protection-domains-and-availability-zones.png)

Sometimes one wonders if it'd be better if clients had some intelligence about storage layout. In this post I explain why I don't think that would be beneficial to SolidFire.

Let's take a quick look at some examples of how data flows in a SolidFire v12 cluster with three Protection Domains (PD's).

First, when an iSCSI client (container, VM, physical server - it doesn't matter) connects to a volume, that volume can be running on "primary" SolidFire volume located in any Protection Domain. In this case, it's in another rack (or floor, or building), and client must make three hops (local Leaf, Spine, remote Leaf) to get to the volume. This applies to 66.66% of connections here - they'd be remote.

![SolidFire nodes fetches blocks client connects to volume in another rack](/assets/images/sf-protection-domain-data-flow-01.png)

If it's a read request the SolidFire storage node running "slice" (metadata) service for this volume must fetch data blocks on behalf of the client - each block from either copy (SolidFire Double Helix aims to maintain two copies of each block on different nodes and even in different PDs', as is the case here).

With three Protection Domains, 2/3rds of all requests have to make three hops to get to the block. One third needs just one hop or less (when the block that's being fetched is in the same PD, including on the node running slice service located in the same rack as the client).

![SolidFire node fetches data to satisfy read request](/assets/images/sf-protection-domain-data-flow-02.png)

As the storage node has to serve *all* requested blocks to satisfy that read request, getting 1/3rd of the requested blocks from nodes in local PD doesn't make much difference.

After all the blocks requested by the client have been gathered and decompressed, data is sent to the client via iSCSI.

![SolidFire node returns data to iSCSI client in another rack](/assets/images/sf-protection-domain-data-flow-03.png)

Now, one might wonder if it wouldn't be better if the iSCSI connection and all block fetching (or dispatching) could somehow happen within the same protection domain in order to minimize network hops.

![iSCSI client connects to volume in same rack](/assets/images/sf-protection-domain-data-flow-04.png)

This would be great, right?

But when we consider that each block written still has to be protected across two PD's, this doesn't buy us much. When we write a new block, in 2/3rds of all cases the SolidFire node running slice service (home node for the iSCSI volume) needs to make at least one three-hop trip to another storage node *in another protection domain* to save the second copy of the data.

![SolidFire Double Helix protects written blocks](/assets/images/sf-protection-domain-data-flow-05.png)

Another thing that instinctively comes to one's mind is how localizing iSCSI and intra-node (for SolidFire) traffic could save network resources and lower I/O latency. But you can also think of it this way:

- Any write that lands in only one PD (even if there are redundant replicas in two different storage nodes) is not protected, so we must write at least one replica to another PD (sometimes both replicas have to be saved to other PDs, in order to keep capacity utilization evenly balanced among nodes and PDs)
- If your Spine & Leaf network would benefit from decreasing cross-PD traffic by 1-2 GB/s, maybe you have a networking problem?

There is just one scenario for which I think some built-in intelligence may be nice to have, and that is for reads that have a copy in the same PD - if SolidFire had a way to prefer reading replicas from local PD, it could eliminate some 3-hop reads. But:

- Such cases are already a minority (only 1/3rd of all reads can be local in a cluster with 3 PD's)
- The risk of hotspotting nodes in local PD would increase
- We'd still have to wait for blocks that must be fetched from remote PD's
- Writes would still have to be sent out to other PDs to protect new or modified data

So even this doesn't sound too useful. It'd have to be a very predictable and controlled workload, which is rarely the case outside of HPC or single application environments.

I've worked with HPC storage that could benefit from preferring local nodes or storage pools for reads, but that was before fast & affordable Spine & Leaf architectures, and it was meant for use cases that involved reading huge amounts of data (many TBs in one go), and the users had to be very careful about job placement (to avoid hotspotting local storage or network).

For SolidFire and workloads that run on it, the way PDs work looks fine to me. Traffic flows all over the place, but you don't have to pay attention to it.

Mellanox SN2700 and SN2100 (or SN2010) switches that many NetApp HCI customers have deployed are affordable and great building blocks for Spine & Leaf networks serving iSCSI and application traffic. You can use other switches as well, of course (just stay away from stackable switch designs).

Once you get the networking right, Protection Domains just work. You don't have to mind them, you can schedule your containers or VMs anywhere, and you don't need a PhD in SolidFire cluster philosophy. Which is exactly how SolidFire is supposed to be - simple.
