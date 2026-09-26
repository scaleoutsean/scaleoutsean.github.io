# Lakekeeper Iceberg REST Catalog with NetApp E-Series

Getting started with Lakekeeper on NetApp E-Series

- **Lakekeeper Iceberg REST Catalog with NetApp E-Series** (this post)
- [Lakekeeper with NetApp StorageGRID](/2026/09/03/lakekeeper-iceberg-compression-snapshots.html)

## Introduction

What's Lakekeeper? 

> A secure, fast, and user-friendly Apache Iceberg REST Catalog built with Rust and available under the Apache License. 

How is that related to NetApp E-Series? Lakekeeper needs to persist data somewhere. 

This post will take a look at those needs, and a future posts may explore certain aspects in additional detail, especially since we've been playing with [OpenSharing](/2026/06/14/netapp-eseries-opensharing-deltasharing.html) and it's clearly a great use case for E-Series that justifies additional exploration.

## Lakekeeper interfaces

To see what storage Lakekeeper consumes, we look at this image (credit: [lakekeeper.io](https://docs.lakekeeper.io/docs/nightly/concepts/#architecture)):

![Lakekeeper Interfaces v2](/assets/images/lakekeeper_interfaces-v2.svg)

There's just this:

- Persistence backend: Postgres
- Secrets store: Postgres or Hashicorp Vault
- Object store: self-managed S3
- Events store: NATS or Kafka

**Postgres** on E-Series rocks. We've seen it in performance, both [here](/2026/06/01/cloud-native-postgres-kuberntes-netapp-eseries-perf.html) and [here](/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html), we've seen it in [HA clustering, manageability, DR](/2026/05/01/cloud-native-postgres-kuberntes-netapp-eseries-csi.html) and [backup/restore](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html).

**NATS** and **Kafka**: both work great on E-Series. Highly-available RAID 10 volumes on external storage give you get reliable, high-throughput, low-latency storage. Use one EF-Series box for a single rack deployment and [three for a rack -redundant deployment](/2026/06/21/nats-server-on-netapp-eseries.html) where you can use entry level E-Series systems if you need rack redundancy more than performance.

**Self-managed S3**: pick one of three T-Shirt sizes for object stores

- Small: Versity S3 Gateway in VMs or Kubernetes
- Medium: StorageGRID SDS with E-Series - you need at least 3 1U servers and one E-Series box. Get three E-Series boxes for rack redundancy
- Large: NetApp StorageGRID appliances (the SG6x00 models, for example) - get three StorageGRID boxes and two S3 API gateways (one can be SG SDS (VM-based)) for rack redundancy

Lakekeeper is yet another case of a modern analytics stack that matches what was explored in [this post](/2026/01/16/santricity-eseries-datalake-storage.html):

![Lakekeeper with E-Series](/assets/images/eseries-datalake-storage-layout-03.png)

That's exactly how it'd look like. The same pattern everywhere.

## Consuming storage from Lakekeeper

Postgres is simply set during Lakekeeper bootstrapping - we just tell Lakekeeper what databases to use. In other words, Lakekeeper doesn't run Postgres DB service for you - you need to set these up and [CNPG](/2026/05/01/cloud-native-postgres-kuberntes-netapp-eseries-csi.html) or some other established native clustering approach will do.

Or, if you need a source, [RTFM](https://docs.lakekeeper.io/docs/latest/production/#production-checklist):

> Use an external high-available database as a catalog backend. We recommend using a managed service in your preferred Cloud or host a high available cluster on Kubernetes yourself using your preferred operator. **We are using the amazing CloudNativePG internally.**

I didn't know that before, but I'm not surprised. I should emphasize that CNPG backup is **continuous** and to S3 ([the link provided just above](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html)) which is what lets you restore Catalog, secrets and rewind tables (versioned S3 objects) to the same point-in-time.

Then, in Lakekeeper Web UI, we start consuming (self-managed) S3-compatible object storage:

![Lakekeeper Web UI](/assets/images/lakekeeper_00_wh_vols.png)

- (1) Warehouses ("just a bunch-o-tables")
- (2) Volumes - currently just a roadmap item, but I think this is absolutely fantastic as I've referred to this asset (Volumes) as the more positively disruptive one for E-Series. File sharing for E-Series, folks!

This week I blogged about [OpenSharing Tables](/2026/06/14/netapp-eseries-opensharing-deltasharing.html#tables) and [OpenSharing Volumes](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html), which is exactly what (1) and (2) do (only Iceberg instead of Delta Lake format).

Zooming in on Volumes, we can see "it's coming".

![Volumes roadmap item](/assets/images/lakekeeper_06_lakekeeper_volumes_roadmap.png)

But, does Lakekeeper work with VGW and StorageGRID? I tried it, and it appears that way.

Not only does it work, but we know **all three T-Shirt sizes work**:

- `wh` is a Versity S3 Gateway-backed warehouse, which works the same way as our OpenSharing Tables approach: you can keep table data on E-Series and you can run Versity S3 Gateway containerized, even on [Kubernetes](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html) which is ideal for low-cost deployments on Edge
- `sgvh` is a StorageGrid-backed warehouse, and since it's the same software stack on both the appliances and SG SDS, Medium & Large sizes work, too

![Lakekeeper Warehouses](/assets/images/lakekeeper_01_whs.png)

This is one of the screenshots of a Versity S3 Gateway-backed data warehouse, taken before the screenshot above while I was exploring the various S3 configuration options. 

![VGW WH in Lakekeeper](/assets/images/lakekeeper_02_whs_versity_s3_gateway.png)

StorageGRID doesn't require special steps - just S3 Object Lock in `GOVERNANCE` mode.

![StorageGRID bucket](/assets/images/lakekeeper_03_whs_sg_bucket.png)

The VGW bucket had the same configuration:

![VGW bucket](/assets/images/lakekeeper_05_whs_vgw_bucket.png)

Initial access logs.

![Warehouse](/assets/images/lakekeeper_04_whs_in_action.png)

I created a namespace and several tables and it went without errors.

This concludes this "overview of architecture, requirements and getting started with Lakekeeper on NetApp E-Series" post.

## Conclusion

Lakekeeper looks nice and I'm going to keep an eye on the progress of their Volumes feature.

Both Versity S3 Gateway with E-Series and StorageGRID are ready.

For smaller, edge, low-cost sites with less than 1 PiB, you can put the whole thing on a single (hybrid or all-flash) E-Series box, and for larger, Data Center,  scale-out, enterprise environments, StorageGRID is more suitable.

- get at least one [EF-Series](/2026/03/21/netapp-ef-series-ef80-ef50.html) box for Postgres and [NATS](/2026/06/21/nats-server-on-netapp-eseries.html)/Kafka. Use TLC SSD disks for these services.
- use the same E-Series box for Versity S3 gateway (use NL-SAS for low-performance or cost-down) or StorageGRID SDS. Get more of them as StorageGRID appliances if you need to scale-out.

In a future post we'll look at specific Lakekeeper solutions and use cases.
