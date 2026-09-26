# Burst on-premises BeeGFS/E-Series to Spot Ocean in the cloud

Make BeeGFS on E-Series data available to GPU-enabled Analytics and Deep Learning workfloads with Spot Ocean for Spark

- [Problem statement](#problem-statement)
- [Data replication](#data-replication)
- [Storage](#storage)
  - [CSI drivers](#csi-drivers)
- [GPU compute nodes](#gpu-compute-nodes)
- [Performance monitoring](#performance-monitoring)
- [Workflow](#workflow)

## Problem statement

Enterprises with analytics, HPC and Deep Learning workloads that have high-bandwidth storage requirements use BeeGFS with NetApp E-Series.

For various reasons they may need to burst-to-cloud. Some of the main challenges in this process:

- Data replication from on-premises BeeGFS to the cloud
- Storage performance in the cloud
- Cost of compute resources in the cloud

## Data replication

For obvious resons (granularity) in this use case file and object replication are generally a better choice than volume replication.

To copy BeeGFS files to the cloud you may use a file sync tool of your choice: rsync, rclone, etc.

Alternatively, NetApp has a subscription (charged per hour) service called [Cloud Sync](https://docs.netapp.com/us-en/cloud-manager-sync/concept-cloud-sync.html).

I wrote about various ways to sync files and objects [here](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html). If you use Cloud Sync, automation is availble via the [Cloud Sync API](/2022/01/17/using-netapp-cloudsync-api.html).

Data replication *from* the cloud to on-premises is usually not a problem because we're talking just about the results (few KB to few GB, perhaps). To avoid having to open enterprise firewall to incoming connections (or - even worse - use VPN), simply post your results to the cloud provider's Object Store and download them from there using Cloud Sync or rclone.

## Storage

For Big Data anlaytics and DL/ML workloads it usually pays to use fast storage because that saves compute costs. Cloud GPUs aren't extactly cheap, so if you use BeeGFS on-premises, you likely want to use it in the public cloud for similar workloads.

The creators of BeeGFS, ThinkParQ, have created BeeOND, a subscription service that's based on BeeGFS running on hyperscaler hardware. Back in 2019 it was possible to get close to 100 GiB/s from such clusters (see [this example](https://techcommunity.microsoft.com/t5/azure-high-performance-computing/tuning-beegfs-and-beeond-on-azure-for-specific-i-o-patterns/ba-p/1015446) from Azure).

Compared to ONTAP-based cloud storage, BeeOND is limited in terms of data management features: backup, snapshots, etc. If you need to protect your cloud data before BeeOND subscription is terminated, make a copy in the hyperscaler's Object Storage.

### CSI drivers

- [BeeGFS CSI](/2022/04/09/beegfs-csi-introduction.html) for BeeOND
- [NetApp Astra Trident CSI](/2022/04/09/beegfs-csi-introduction.html) for ONTAP-based cloud storage

In the case you'd like to use both at the same time - that is BeeOND and for example Cloud Volumes ONTAP - that is possible. You can see how both are used in the same Kubernetes cluster in [this post](/2022/04/09/beegfs-csi-introduction.html#options-in-a-mixed-environment).

Why would we want to do that? Maybe you have cloud data that needs to be kept in the cloud between workloads and CVO is good for that. Then, when you need to run compute jobs, you can use DataOps Toolkit to [copy data from CVO to BeeGFS (and back)](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html#netapp-dataops-toolkit). 

It is also possible to use multiple PVCs at the same time - read data from CVO and stage it to BeeOND, and write the result to a CVO volume.

## GPU compute nodes

We want to avoid unnecessary cost of GPU compute resources.

To do that we can use a [Spot.io](https://spot.io) service called [Spot Ocean for Spark](https://spot.io/products/ocean-apache-spark/).

![Spot Ocen for Spark](/assets/images/spot-ocean-for-spark.png)

Spot doesn't seem to build GPU clusters from scratch, but Spot allows you to [import existing clusters to Spot](https://docs.spot.io/ocean-spark/getting-started/create-cluster?id=import-an-existing-kubernetes-cluster-to-ocean-spark) and let Spot control and manage them.

This means we can build a cluster with GPU-based worker nodes and tell Spot Ocean for Spark to use it.

The next question is whether containers used by Spot Ocean for Spark have CUDA? Spot Ocean Spark uses its own images. Or, to be perfectly correct, containers based on its **base** images (this distinction will come useful shortly).

At the time of writing this post, the images don't seem to have CUDA libraries in them. Because we don't have to use Spot images and can use custom Docker images **based on** Spot's base images, we can easily start with those and create custom containers with CUDA drivers and libraries.

Here you can find [information about the official Spark official images](https://docs.spot.io/ocean-spark/configure-spark-apps/package-spark-code) which can be used as base, and [here is the list](https://console.cloud.google.com/gcr/images/datamechanics/GLOBAL/spark?tag=platform) of images.

## Performance monitoring

For short-lived clusters I'd probably use hyperscaler's monitoring and CLI tools built into BeeGFS. Why? 

- Cost optimization is done by Spot
- Cluster will be deleted anyway

Alternatively, [BeeGFS monitoring plugin](https://github.com/NetApp/eseries-perf-analyzer-plugin-beegfs) for Grafana which can run on-premises or be the free Grafana Cloud - both would connect to a small, cloud-based, long-running InfluxDB container that could be left running in the case bursting to cloud happens frequently enough.

## Workflow

The entire workflow would look like this:

- Preparation
  - Build images with CUDA version recommended by hyperscaler, and store them in private registry
- Replication
  - Stand-up minimal BeeOND cluster
  - Replicate data to BeeOND (or CVO/ANF/FSxN, if you want to use it alongside BeeOND)
- Compute
  - Grow BeeOND cluster to enough nodes
  - Stand up a Kubernetes cluster with GPU-based nodes and deploy BeeGFS CSI (and Trident, if required)
  - Import the cluster to Spot Ocean for Spark
  - Run Spark and other workloads 
- Terminate temporary environment
  - Copy results to Object Storage, or CVO/FSxN, or back to on-premises 
  - Scale down to zero or destroy Kubernetes cluster
  - Destroy BeeGFS cluster

Users who burst to the cloud often could scale up and down rather than re-create clusters every time.
