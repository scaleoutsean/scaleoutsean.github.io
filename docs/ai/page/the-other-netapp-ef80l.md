# The other NetApp EF80L

About the NetApp EF80L... I mean the other one.

Here's the NetApp [EF80L](https://www.netapp.com/product-updates/netapp-ef80l-with-embedded-lustre/), in which "L" means Lustre.

How about this?

- An EF80L where L stands for Linux with the optional small Kubernetes distribution such as [k0rdent k0](/2026/03/02/netapp-santricity-csi-with-k0rdent-k0s.html)?
- [TopoLVM](/2026/11/06/topo-lvm-netapp-santricity-e-series.html) or my SANtricity CSI
- [Rook with EF Series](/2026/05/22/ceph-kubernetes-eseries.html) (Ceph on Kubernetes) or just Ceph on Bare metal if you don't want Kubernetes
- Rook Storage Classes with RAID 0 or RAID 6 for data that works okay with RF3 and Erasure Coding. SCs on RAID10 for natively-replicated databases ([CNPG](/2026/06/01/cloud-native-postgres-kuberntes-netapp-eseries-perf.html), etc.)
- Lightweight [compression](/2024/02/26/zfs-deduplication-netapp-eseries.html#compression) to avoid waste created by inefficient data
- Containers, VMs, light databases, S3, and more
- Velero for backup/restore, including built-in Change Block Tracking [once they figure it out](https://x.com/ScaleoutSean/status/2118029361303708016?a=qcKTM20SMz3nrQKhZIc&s=20)

![The other EF80L](/assets/images/ef80l-01-the-other-one.png)

It wouldn't be the same, but could it be good for general workloads? I think so.
