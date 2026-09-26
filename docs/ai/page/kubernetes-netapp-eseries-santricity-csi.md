# Kubernetes CSI with NetApp E-Series SANtricity

CSI options for NetApp E-Series Storage

## Introduction

I wrote a post [about CSI options with E-Series SANtricity systems](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) more than three years ago.

Almost everything from that post is true except [SANtricity CSI](https://scaleoutsean.github.io/2026/01/19/netapp-eseries-santricity-csi.html) is now available for experimental use.

This is an update that's going to be short, and hopefully easier to figure out and then you can move on or continue investigating these options.

## Options

![Options for Kubernetes with NetApp E-Series SANtricity storage](/assets/images/eseries-santricity-kubernetes-options.png)

**SANtricity CSI** is closest to what people might consider a "native" CSI driver. PVs are created on E-Series and presented to pods. It targets NVMe/RoCE and iSCSI, although other protocols (such as FC) may work as well. This one is recommended for "non-traditional" Kubernetes users. You can find more about it [here](/2026/01/19/netapp-eseries-santricity-csi.html).

**My fork of IBM Block CSI** driver (added in February 2026, updated in April 2026) is also an HA-capable CSI driver. Unlike SANtricity CSI, which was purpose-built from scratch for E-Series, this one is a fork of IBM's enterprise-grade Block Storage CSI driver which may be more suitable for, or preferred by, certain users (e.g. users with FC SANs). Read about it [here](/2026/02/26/ibm-block-storage-cis-driver-santricity-fork.html). **Update (April 2026):** since upstream release v1.13.2, this patched driver can [take single volume snapshots and create read-only Linked Clones](/2026/04/30/velero-csi-data-mover-backup-santricity-kubernetes.html) and this can be expanded to Consistency Groups if upstream adds Volume Group Snapshot support.

There are many ways to compare these two, so I'll highlight only what I find notable:

| Feature        | SANtricity CSI | IBM Block CSI with SANtricty patch |
| :--------------| :--------------|:-----------------------------------|
| Language       | Go (with [santricity-go](https://github.com/scaleoutsean/santricity-go)) | Go (front) and Python (back, with [santricity-client](https://github.com/scaleoutsean/santricity-client))
| Protocol focus | iSCSI, NVMe/RoCE    | SANtricity patch adds NVMe/RoCE, follows upstream for rest|
| Distribution focus | plain, modern and micro distributions | plain Kubernetes, OpenShift |
| Access mode | file system, block | file system, block |
| Non-cryptic PVC names | yes  | no (upstream's approach) |
| Volume create, delete, publish | yes | yes |
| Volume extend | yes | yes |
| Volume Snapshots | no (TODO)        | yes |
| Volume Clones | no (TODO)  | read-only |
| Volume Group Snapshots | no (TODO)  | no (not implemented by upstream) |
| Volume Group Clones | no (TODO)  | no (not implemented by upstream) |
| CSI Driver Metrics | yes | no |

**BeeGFS CSI** requires an intermediate cluster file system that lives on protected E-Series volumes. BeeGFS CSI volumes are directories on this clustered filesystem (BeeGFS). Pods run on BeeGFS clients that map these paths as "CSI volumes". This driver does not use the SANtricity API endpoints. Note that, because PVCs are consumed from BeeGFS clients, they're served using the BeeGFS client running on Ethernet or Infiniband. Only the servers (attached to E-Series) need to "talk" transport protocols supported by E-Series. Other parallel filesystems (GPFS, for example) have similar drivers. This category is useful for HPC and AI use cases because PVC data can be physically spread across many servers and many E-Series arrays, allowing the client to use extremely large PVCs and max out client performance.

**Standard** local CSI: TopoLVM and similar "local" CSI drivers for single host filesystems tend to use LVM for various reasons - granular allocation, thin provisioning, snapshots and similar. On top of LVM they use mainstream Linux filesystems (XFS, ext3, ext4). This driver does not "talk" to SANtricity either. Because the host attached to volume is "fixed", these PVCs tend to have no redundancy - if the host goes down, the LVM goes down with it. So for these you need either replication (Active->Standby) or EC (2+1 and such) to avoid downtime and inaccessible data. Use [Terraform Provider SANtricity](/2026/01/16/eseries-santricity-terraform-provider.html) to provision volumes to hosts and, from there, it's all TopoLVM. Note that TopoLVM is sometimes recommended by application vendors (see [this post on Elasticsearch](/2026/04/13/elasticsearch-eck-kuberntees-netapp-santricity-csi.html), for example).

**Specialized** and single-host approaches on the right are similar to "standard" ([TopoLVM](https://github.com/topolvm/topolvm), etc.) but some can use unprotected storage (RAID 0; which is the case with MinIO's DirectPV which suffered a "rug pull" event mere [days ago](https://github.com/minio/directpv?tab=readme-ov-file#unsupported-versions)) or have more distinguished SDS features (volume manager, multi-protocol CSI, synchronous replication) features. These SDS appliances require an intermediate server and may be clustered. ONTAP Select, for example, can run as active-active SDS clusters and share data via its unified storage services - whatever protocols are supported by Trident CSI. TopoLVM, as the name suggests, uses LVM and can work with protected or unprotected (RAID 0) storage mapped from E-Series arrays.

**vSphere** CSI isn't in the diagram because I'm not sure where to put it and I don't want to create a category just for it. It has a NetApp E-Series plugin/console that talks to the SANtricity API, but the rest is similar to Specialized CSI drivers that do *not* talk to SANtricity API. Also, vSphere uses own volume manager and has a parallel filesystem (VMFS), so it's also similar to parallel filesystems, but used for different use cases (desktops, VM, containers). There's a [post and demo here](/2022/05/18/vmware-tanzu-netapp-eseries.html).

## Summary

If you're looking for production-grade CSI drivers, see which of these are on the [kubernetes-csi](https://kubernetes-csi.github.io/docs/drivers.html) list which has information about:

- Persistence
- Supported access modes
- Dynamic provisioning ability
- Other features

As far as native SANtricity CSI drivers are concerned, there's no need to look because NetApp has none. Thankfully, there are alternative approaches.

There are too many ways to compare these alternatives - by protocol, availability, performance, commercial support and more. 

If you are looking for a commercially supported approach, pick your "tax":

- vSphere CSI - uses vSphere CSI, suitable for vSphere users
- ONTAP Select (Trident CSI) - good for clients with NFS, iSCSI requirements and big volume churn
- BeeGFS CSI - for users who purchase E-Series' BeeGFS solution

If you aren't a vSphere customer - say, OpenShift user looking for an HA CSI - the only option I'm aware of is my fork of IBM Block CSI driver which upstream certifies for OpenShift (you nominally lose that by patching) and supports block mode. Otherwise, check out TopoLVM.

Self-sufficient users who need a native driver with HA, especially those focused on AI, analytics or HPC may want to consider SANtricity CSI.

Single-host CSI drivers (TopoLVM, Btrfs, ZFS) are readily available and don't require NetApp support, but may need replication (consider using native replication or the VolCopy project), multi-node Erasure Coding or a KubeVirt VM "wrapper" to provide data and service availability.
