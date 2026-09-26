---
related: true
title: Kubernetes with vSphere CSI Plugin and NetApp E-Series
layout: single
categories: ["virtualization", "storage", "kubernetes"]
tags: ["netapp", "vmware", "tanzu", "vsphere", "e-series", "eseries", "csi"]
description: "Complete workflow for configuring E-Series for VMware Tanzu with vSphere plug-in"
excerpt: "Complete workflow for configuring E-Series for VMware Tanzu with vSphere plug-in"
---

NetApp E-Series are fast-performing disk arrays frequently used by big data, analytics, video processing, NOSQL databases, and HPC applications. You can find more about E-Series [here](https://www.netapp.com/data-storage/e-series/) (SSD, HDD) and [here](https://www.netapp.com/data-storage/ef-series/) (NVMe, SSD, HDD).

I don't have any statistics or breakdowns of how E-Series is used in Kubernetes environments, but if I had to guess I'd say AI and HPC use cases are most popular. In those environments shared block storage is required, so many customers use BeeGFS CSI, a CSI plug-in for BeeGFS created by NetApp. One of solutions from this group that recently made the news is [NVIDIA SuperPOD with NetApp E-Series EF600](https://www.netapp.com/blog/netapp-hybrid-cloud-storage-nvidia-dgx-superpod/). I’ve written about BeeGFS CSI plug-in [here](/2022/04/09/beegfs-csi-introduction.html) and several other posts.

The second major group is probably Kubernetes on vSphere. E-Series supports vSphere, Tanzu can use vSphere CSI plug-in to consume datastores provisioned on E-Series arrays.

Recently a customer wanted to know more and the E-Series team used the opportunity to demonstrate that.

The way this works is as you would imagine: create a volume, present it to vSphere cluster, create a datastore and then ... do the Kubernetes stuff. To see the details, take a look at the excellent video recorded by a member of the E-Series team (the link is at the bottom of this page).

## Why use E-Series with Tanzu

You get (nearly) the same performance as with with physical servers or VMs attached to E-Series, but it's much easier to consolidate, scale, monitor and otherwise manage your heavy workloads.

One recent example is a customer who used E-Series to record and process video content. Their previous configuration involved physical server and several HDD-based E-Series systems.

In the past they hesitated to move the workload to VMs due to performance concerns, but after vSphere 7 was launched they found the courage to not only make the move, but to skip Virtual Machines and go straight to the next level - Kubernetes.

Tanzu PVs live on VMFS, so while there's some minimal overhead due to VMFS, current generation of x86-64 servers and E-Series arrays are much faster and now also easier to use that sacrificing single-digit percentage versus bare metal performance seems well worth it.

If you have "shared nothing" heavy workloads (CCTV, Elasticsearch, RDBMs) in your Kubernetes environment, Tanzu and E-Series could be good for you.

For workloads that need shared (or parallel) data access to same files from containers running on multiple hosts, consider using Kubernetes with BeeGFS and skim through my [introduction](/2022/04/09/beegfs-csi-introduction.html) to BeeGFS CSI plug-in.

## Other Kubernetes work

It seems so. Just configure it with vSphere CSI driver. 

Check out [this recipe](https://www.unknownfault.com/posts/installing-and-configuring-vsphere-csi-driver-k3s/) for K3s.

## Conclusion

If you use vSphere, especially with VMs, vSphere CSI gives you the ability to use Kubernetes without much effort.

Tanzu customers can use Velero to backup Kubernetes data and applications to S3 and so can other Kubernetes distributions - just without VMware's support for Velero.

KubeVirt is gaining popularity, but using vSphere for VMs and Kubernetes is much simpler than using Kubernetes for the same.

## Demo

The demo is longer than my own demos, but at the same time it's not longer than necessary.

It takes you through the whole process in less than 13 minutes and it's pretty much the only video you need to see to start using Tanzu with E-Series. Enjoy!

- [vSphere Tanzu with E-Series](https://rumble.com/v1569x1-vmware-tanzu-vsphere-csi-plugin-and-netapp-e-series-storage.html) - 12m22s

One thing not in the demo is Velero CSI backup, but it should work well with vSphere CSI plugin. I used Velero with [NetApp Trident CSI](/2022/03/15/velero-18-with-restic-and-trident-2201.html), so I expect for simple scenarios it should work even better with vSphere CSI.
