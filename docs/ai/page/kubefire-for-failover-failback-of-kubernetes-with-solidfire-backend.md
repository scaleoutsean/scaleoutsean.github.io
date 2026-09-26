# Kubefire for Kubernetes failover/failback with SolidFire

Recipes and tools for Kubernetes failover and failback with Trident CSI and NetApp SolidFire backends

- [Introduction](#introduction)
- [Kubefire](#kubefire)
  - [Simplified version of Longhorny focused on Kubernetes](#simplified-version-of-longhorny-focused-on-kubernetes)
  - [Automated replication service for SolidFire replication in a Kubernetes environment](#automated-replication-service-for-solidfire-replication-in-a-kubernetes-environment)
- [Conclusion](#conclusion)
- [Appendix A - implementation ideas](#appendix-a---implementation-ideas)

**NOTE:** since mid 2026, I only recommend [SolidFire CSI](/2026/03/06/solidfire-csi-driver.html) for failover/failback. Trident CSI does not support failover/failback. There's nothing else to recommend or consider.

## Introduction

In [this post](/2024/07/02/solidfire-volume-attributes-from-trident-and-other-apps.html) I described how SolidFire Collector collects and stores volume attributes from NetApp Trident CSI.

It's one of several pieces of the storage replication, failover and failback puzzle - maybe not even a necessary, but certainly a useful one.

As a reminder:

- Since CSI took over storage provisioning and management in Kubernetes, it is no longer possible to simply tell Kubernetes workers to use a different path to your storage. Failover to a different back end implies different PVs.
- As Trident CSI hasn't developed any features to make failover and failback with SolidFire backends easier, the only viable way to failover and failback is to connect each Kubernetes cluster to its own SolidFire backend

To make that easier, I wrote Longhorny (see the post linked at the top) which makes replication, failover and failback easier, and SFC that collects and stores volume-related settings and metadata. Another script maps Trident CSI PVCs to SolidFire volumes and tenants.

Now it's a matter of putting those bits and pieces together, and maybe adding an extra script or documenting workflow, to make all this more automated and prescriptive. Another benefit is maybe some users out there can reuse some of this and create workflows that work better for their environments.

## Kubefire

**UPDATE:** the [repository](https://github.com/scaleoutsean/kubefire) now has has SolidFire CSI-related notes and two scripts: one exports SolidFire and SolidFire CSI state to JSON, and the other uses that export file to create a Kustomize overlay for the site you're failing over to. Trident CSI-related notes have been removed.

### Simplified version of Longhorny focused on Kubernetes

Longhorny can already perform all SolidFire replication and failover/failback tasks. 

What it does "too much" (as far as Kubefire-related tasks are concerned) is checking and validation. Longhorny is meant to deliver its functionality in environments where each site may have multiple clusters, not just Kubernetes, but also other. It is also very careful when tearing down replication relationships.

What Longhorny does "too little" is it won't let you flip one storage tenant's volumes from one site to another, and the reason is most people don't do that anyway (I mean, have multiple tenants in a paired cluster environment and not all run at the same site). It isn't a crazy idea, but it can be challenging to manage - imagine having 2 vSphere and 3 Kubernetes clusters whose administrators switch them over from one site to the other as they please. 

Longhorny could allow that, but just checking for all the possible problems and mis-steps would be a complex task.

For Kubefire, however, that may be exactly what people want - it would do similar things that Longhorny does, but account-specific:

- Specify a (Trident CSI) storage account for each site
- Let Kubefire create replicated volume pairs for these two accounts
- Allow failover/failback (change of replication direction) for all volumes owned by these accounts

If you screw things up by randomly deleting volumes or fiddling with access modes, it's up to you to fix it. 

Longhorny wouldn't delete volumes in this approach, but careless management could leave you with messed up relationships where some volumes would replicate from A to B, others from B to A, and yet others not replicating at all. It would require manual intervention to sort out.

### Automated replication service for SolidFire replication in a Kubernetes environment

The other approach is more radical. 

It occurred to me that it's possible to make that workflow even easier and more automated if we allow Kubefire to perform destructive actions. More automation, more risk, more benefits.

In this approach we also have a unique storage account pair for two sites, but volume pairing relationships are managed by Kubefire.

Every 5-10 minutes Kubefire checks Trident CSI volumes at the active site:

- If a volume is new on the active site, create a new, replica volume at the passive site and enable replication between the pair
  - To avoid replicating all sorts of junk, potentially set this up so that it only works for specific volume QoS settings or Kubernetes namespace
  - To help pick the right replication mode (Async, Sync, SnapshotsOnly), also apply filters based on QoS policy setting or Kubernetes namespace
- If a volume is larger than the replica, automatically resize the replica and resume replication
  - This isn't controversial and eliminates the need to notify the storage administrator of volume resizing at the active site
- If a volume deleted and only an orphaned replica available, delete the replica to eliminate orphaned volumes (this is possibly controversial, so we could optionally not delete it, or make it an option)

It would also have the ability to change the direction of replication for all paired volumes owned by a pair of accounts. This would be performed manually, of course.

There isn't anything dangerous in this approach, but most people don't like to have scripts with destructive power running in autopilot mode. 

In the case you haven't noticed, [Astra Trident CSI v23.10](https://github.com/NetApp/trident/releases/tag/v23.10.0) added some volume replication feature for ONTAP backends. I don't even know what it does, but I doubt it would be more convenient than this automated approach.

## Conclusion

A modified version of Longhorny would probably be more appealing to SolidFire users with multiple Kubernetes or other clusters per site. If they don't mind the super-careful approach taken by Longhorny, they could use this approach today - the only step that Longhorny can't do is flip volumes based on account ID (it currently flips all volumes from one site to another), but they could achieve that with a single PowerShell command.

The radical version sounds more appealing, but it has to be reliable and transparent, otherwise no one will want to try it. 

I'll toy with these ideas and see which one wins me over. 

The Longhorny approach works today and even without any new code we only need 2-3 PowerShell commands for users to execute when they want to fail over or change the direction of replication. This makes the radical approach more interesting, as the conservative approach already works, so maybe I'll try to do both:

- Provide PowerShell commands for failover/failback for Longhorny users 
- Create a new "autopilot" script based on Longhorny code

## Appendix A - implementation ideas

- Site A: Kubernetes volume information is obtained by ingesting `tridentctl` output (as mentioned in one of previous posts on this topic, the idea behind this is Kubefire doesn't require access to either `kubectl` or `tridentctl` that way - Kubernetes admin schedules these to output configuration to files)
- Site B: the same approach, but `tridentctl` and `kubectl` inputs are collected from Kubernetes/SolidFire at the second site
- `tridentctl` and `kubectl` from each site uploads volume information to S3 bucket
  - This makes it possible to always get this information and provides HA to `tridentctl` output
  - Kubefire downloads information from this location/bucket and needs just *outbound* access to three-four locations (one or two S3 buckets, and two SolidFire MVIPs)
- Kubefire has the Trident CSI storage account ID from each site and the active site is provided in startup arguments
  - Account IDs can also be determined from `tridentctl` output and used for verification/sanity check
  - Kubefire gets volumes names and sizes from `tridentctl` and creates and grows remote (replica) volumes as necessary
  - On Kubernetes/SolidFire site failover, Kubefire is restarted with the surviving site designed as active
  - Kubefire takes note of, and logs volumes "orphaned" from the active site, but it's up to the administrator to decide what to do about them. As mentioned earlier, namespaces where volumes are "randomly" added and removed may be excluded from Kubefire's coverage to eliminate the need to frequently fix these discrepancies
- If a site fails, Kubefire needs to be restarted to reverse the direction of replication and start watching for changes at the new active site, but we also need to use `tridentctl` information to import replicated volumes to Kubernetes at the new active site. This can be done by Kubefire, or even better manually with a separate command following a review of latest replication status
  - If replication of some volumes was significantly (e.g. 15 minutes) delayed, decision needs to be made whether it's worth failing over (and losing 15 minutes of data) or waiting for the source site to recover
- Volume relationship and status reports are available from InfluxDB ([populated by SFC collector](/2024/06/15/sfc-adds-volume-replication-monitoring.html#what-can-we-see))
  - Longhorny's "mismatched volumes" feature can also report mismatched volumes and a more advanced "volume replication report" (I wrote about that [here](/2024/06/12/longhorny-cluster-volume-replication-report.html)) may be added as well; it would report detailed replication status and maybe send changes to SFC (InfluxDB, that is) and make no configuration changes

![Longhorny - advanced replication report](/assets/images/kubefire-longhorny-advanced-replication-report.png)

This example shows the situation in which four volume pairs are set up for replication and there are no problems in terms of direction, account ID or size mismatches.

Status reports - such as whether replication is delayed and by how much - is already collected by SFC and can be viewed in Grafana or queried in InfluxDB. Before failback the administrator needs to wait until all replicated volume pairs are in sync, to avoid data loss on failback. Fortunately this information is already available in SFC.
