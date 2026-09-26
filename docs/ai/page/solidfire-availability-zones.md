# Does SolidFire support Availability Zones

Difference between SolidFire Protection Domains and Availablity Zones

## SolidFire Double Helix

As most of you know, up to the current version (12.3) SolidFire protects its data with Helix, which aims to make and maintain 2 replicas of each block. Some vendors call this approach RF2 (some implementations may maintain copies of segments or "chunks" of blocks).

When making copies, one of key requirement is to *not* store both copies on the same storage node because - in the case that node fails - you end up with nothing.

SolidFire Protection Domains introduce awareness in node locality within the cluster, so that Helix can also consider Protection Domain, and not just Node ID, when it creates redundant copies of data.

This means that you can tag all storage nodes in one NetApp HCI 2U Chassis as "PD1", all nodes in another chassis as PD2, and all the remaining nodes in the third chassis as PD3.

Now when Double Helix saves two copies of your data, it avoids using the same storage node as it's always done, but it also avoids using the same chassis or PD.

## Are PDs only available to owners of the HCI 2U chassis

PDs don't have to correspond to HCI 2U chassis, it's just that with those it's fully automated because SolidFire detects chassis ID and if you have 3 and properly balance your storage nodes (e.g. put two equally sized nodes in each), your job is done and you can take advantage of the Protection Domain feature without doing anything else. You don't sacrifice any functionality and there's no added cost.

As you can imagine, you are expected to keep the capacity and storage node count balanced if you want PDs to work. You can't have one PD 90% full, have another one fail at the same time and still expect that your storage service will remain up and running. It won't.

But your cluster would still survive single node failures as it did before.

SolidFire users with H600 Series storage nodes can inform SolidFire about the PD layout (example: nodes 1-3 in Rack 1, nodes 4-6 Rack 2, nodes 7-9 Rack 3) and have Double Helix take PD configuration into account when deciding on the placement of Helix data copies.

## Protection Domains vs. Availability Zones

It's not quite the same. All SolidFire nodes in a PD must be connected with L2 network, both the management and iSCSI networks.

Naturally, iSCSI clients' storage network must also be the same L2 network used by SolidFire storage.

![SolidFire Protection Domains](/assets/images/solidfire-protection-domains-and-availability-zones.png)

As you can immediately see, the client's iSCSI connections connect to SolidFire nodes from any AZ (any SolidFire PD). That is random and it means on average 2/3 of connections will go to different PDs.

SolidFire schedules its volume placement based on its own criteria (number of connections, volume capacity & performance utilization, storage node capacity & performance specifications, and more), so with just a few volumes it is possible that some compute AZs would not connect to the local SolidFire Protection Domain:

![iSCSI connections in SolidFire Protection Domains](/assets/images/solidfire-protection-domain-connection-example.png)

## What does it mean for my VMware, KVM, Kubernetes...

iSCSI clients need no awareness of the SolidFire cluster layout. They just need to be able to reach all storage nodes in the cluster.

On the one hand users with nodes in different buildings get cross-AZ traffic from client traffic traversing PDs, but on the other in private cloud the cost of cross-PD traversal is insignificant. Not because there isn't a lot of traffic, but because those pipes must be fast and thick and in that situation "savings" from local-only reads are insignificant.

Because SolidFire volume scheduler does not consider PDs (only "data service" does) when scheduling individual volumes, NetApp Trident also needs no special settings for SolidFire with Protection Domains: it works the same as without them.

## Does this use storage replication

Maybe this is clear to everyone who's made this this far, but no - there's no storage replication here, it's just a different take on RF2 in a single SolidFire storage cluster.

There are "block replicas" in the cluster because SolidFire uses RF2 (makes two copies of every stored block on different nodes because SolidFire does not use RAID), but that's just a way to protect data within a storage cluster.

Any Protection Domain-enabled SolidFire cluster still supports storage replication (synchronous and asynchronous) to another SolidFire or (async-only) ONTAP (SnapMirror) cluster, but that wasn't discussed. We could have a large SolidFire cluster with three PDs on Site A that replicates some volumes to a smaller SolidFire cluster in Site B.
