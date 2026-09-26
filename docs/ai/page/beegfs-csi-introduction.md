# An introduction to NetApp BeeGFS CSI

CSI provisioner for IO-intensive jobs with BeeGFS CSI and E-Series

- [Introduction](#introduction)
- [Use cases](#use-cases)
- [Getting started](#getting-started)
- [Options in a mixed environment](#options-in-a-mixed-environment)
- [Deploy and use BeeGFS CSI](#deploy-and-use-beegfs-csi)
- [Data protection](#data-protection)
- [Summary](#summary)
- [Demo](#demo)

## Introduction

The E-Series devs behind BeeGFS CSI have done a great job not only developing this provisioner but also [introducing](https://www.netapp.com/blog/kubernetes-meet-beegfs/) it to the world. 

HPC, ML and Data Analytics haven't been unaffected by the changes that first affected (storage-)light-weight application servers.

- Developers want to run workloads anywhere with as few adjustments as possible
- Operations teams want to simplify their life by moving workloads to Kubernetes
- Users want the same high performance that they got on physical or VM-based systems

BeeGFS CSI can be used on any BeeGFS cluster, including with other NetApp or non-NetApp storage. Some advanced features rely on BeeGFS having advanced features enabled which requires subscription which can be bought from NetApp (if you use NetApp storage) or ThinkParQ partners.

## Use cases

Sometimes users of containerized applications have IO-intensive workloads, and sometimes they need parallel access to shared data and want a parallel file system for that.

That's why we need BeeGFS CSI for containerized environments. If you have IO-intensive workloads, you can take a closer look at the introductory post above.

BeeGFS is not useful just in HPC and ML. If you process large amounts of text or binary files (say, file format conversion) it may not be "HPC", but parallel filesytem can help you get things done faster.

More often than not, even users with such workloads optimize their storage configuration around something else (rather than storage performance), but they are unaware how IO performance-dependent their workload is. If time to results matters and a 10x faster performance gets you 70% lower time to results, your "optimization" around some minor details won't get your business too far. Or the alternative solution ends up costing five times more once the organization starts burning money on emergency measures, including dispatching batch jobs to the public cloud (common "solution").

## Getting started

This [post](https://www.netapp.com/blog/beegfs-for-beginners/) shows a "professional" setup with full-sized BeeGFS/Kubernetes nodes attached to E-Series and provides a good introduction.

I'll share screenshots to visualize things and maybe explain them differently, so I think this won't be repetitive.

My environment is much simpler, just 3 VMs, but built on the same principles:

- one or more Kubernetes master nodes - k8s-m-1
- two or more Kubernetes worker nodes - k8s-n-1, k8s-n-2
- ThinkParQ BeeGFS
  - there are several "roles" but to make this simple we need BeeGFS client role on the workers where we want to consume BeeGFS
  - we also need a manager role and one of Kubernetes Masters is a good candidate for that
  - we need some nodes to serve (access) storage - these storage nodes need block storage for capacity & performance, obviously, and with E-Series providing storage, BeeGFS storage nodes are usually deployed in HA pairs
  - we need metadata servers, which are similar to storage servers except that they serve filesystem metadata
- one or more NetApp E-Series storage arrays (E5760, EF300, EF600); depending on capacity and performance needs, these can be added to BeeGFS like Kubernetes workers are added to Kubernetes cluster. E-Series arrays are something like BeeGFS "storage workers", if you will.

Such a small cluster can't follow all the best practices (again, see the "professional" setup and diagram for a production-ready version), so here's how I deployed this on these three VMs:

- BeeGFS Management Node - k8s-m-1
- BeeGFS Metadata Server - k8s-m-1
- BeeGFS Client, BeeGFS Server - k8s-n-[1,2]

Corners were cut, yes. But - given that this stuff happens to be running in VMs - with vSphere one could run this in production and while availability would be lower than with a larger cluster, you'd get HA from VMware HA. And you could scale by adding additional VMs as we normaly do with Kubernetes on VMware or OpenStack.

```sh
$ sudo beegfs-ctl --listnodes --nodetype=management
k8s-m-1 [ID: 1]

$ sudo beegfs-ctl --listnodes --nodetype=meta
k8s-m-1 [ID: 2]

$ sudo beegfs-ctl --listnodes --nodetype=storage
k8s-n-1 [ID: 1]
k8s-n-2 [ID: 2]

$ sudo beegfs-ctl --listnodes --nodetype=client
44A7-6251170F-k8s-n-1 [ID: 1]
524F-62511A55-k8s-n-2 [ID: 3]
```

Some may be surprised, but it's possible to get [multiple GB/s of throughput](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html) to shared filesystem with a configuration like this - running on just one ESXi server.

## Options in a mixed environment

Mixed how? That's the point: any-how.

Your options remain open. An example:

![BeeGFS CSI in a mixed environment](/assets/images/beegfs-csi-e-series.png)

Three things I'd like to highlight related to this particular diagram:
- if you need a detailed design, those are available for highly-tuned and prescriptive solutions such as NetApp-NVIDIA AI-related solutions and usually delivered as "building blocks" (something like: 4 DGX nodes + 2 Mellanox IB switches + 2 E-Series arrays).
- SolidFire uses single fabric, and E-Series uses dual fabric, so if you were to consume block storage via IP, we would use *at least* 3 iSCSI VLANs for iSCSI (or even more, if we had to serve iSCSI over multiple VLANs) - one iSCSI network and VLAN for SolidFire and its clients, and two other networks and VLANs on BeeGFS Storage and Metadata nodes or other iSCSI clients connecting to E-Series iSCSI
- E-Series can use FC, iSCSI, IB, iSER, etc., and usually more than one at the same time. The E-Series team prefers certain options (see NetApp's Technical Reports related to BeeGFS and other workloads of interest) and HPC users tend to use NVMe-over-FC (on BeeGFS storage servers), but you can certainly configure E-Series for more than just one connectivity protocol and use it with other clients. BeeGFS CSI talks to BeeGFS management service, not to E-Series array, and only BeeGFS Storage and Metadata nodes would connect to E-Series, while BeeGFS Clients talk to Storage and Metadata servers.

Once you start to mix and match, sooner or later you discover you need either one storage that does everything, or two types of arrays. Left- and right-hand sides of the diagram serve different purposes and emphasize different features.

|  LHS    | RHS |
|  ---    |  ---  |
| VI, CSI | CSI, DAS |
| Integrations | Performance |
| Trident, vSphere | BeeGFS, vSphere, Nomad | 
| S, M IO | L, XL IO |
| RND>>SEQ| SEQ>>RND |
| Block   | File, block |
| ext[3,4], xfs | beegfs |
| Many, smaller apps | Fewer, larger workloads |

On the left one can have a platform that hosts various management servers (including Kubernetes Master node(s)), VM boot disks, developer workstations, VDI, inferencing, databases, and so on. SolidFire and ONTAP users would use Trident or vSphere CSI for Kubernetes. In certain situations you may need to connect to E-Series from VI or Bare Metal servers - that works too.

On the right we'd BeeGFS CSI would provision BeeGFS Persistent Volumes to pods, which would consume it through HA pairs of BeeGFS storage nodes backed by one or more E-Series. 

The right-hand side is usually dominated by sequential IO (64-8192 kB), while the left-hand side is random IO-dominated (4-64 kB).

The Kubernetes storage classes would likely reflect the above.

- Trident CSI: sc-1kiops
- Trident CSI: sc-5kiops
- Trident CSI: sc-5kiops-snap-dr
- BeeGFS CSI: sc-bee-ssd
- BeeGFS CSI: sc-bee-hdd
- BeeGFS CSI: sc-bee-ssd-scratch-nobkp

Later I tried this in practice. Trident CSI and BeeGFS CSI on the same cluster:

![Kubernetes cluster with Trident CSI and BeeGFS CSI](/assets/images/beegfs-csi-k8s-09-multiple-csi-backends.png)

Multiple Storage Classes, heterogeneous PVs:

![Kubernetes cluster with Trident CSI and BeeGFS CSI](/assets/images/beegfs-csi-k8s-10-multiple-csi-storage-classes.png)

## Deploy and use BeeGFS CSI 

I started with three VMs running Kubernetes 1.23.5:

![Kubernetes 1.23.5 in VMs](/assets/images/beegfs-csi-k8s-01-cluster.png)

In my lab these three Kubernetes nodes had the following network configuration:

- eth0 - "service" network (physical 192.168.1.0/24)
- eth1 - Pod network (physical 192.168.105.0/24)
- eth2 - iSCSI network (physical 192.168.103.0/24)

![Kubernetes Pod network on eth1](/assets/images/beegfs-csi-k8s-02-master-nic.png)

Once Kuberetes was up and running, I deployed [BeeGFS CSI](https://github.com/NetApp/beegfs-csi-driver#basic-use) by following the instructions from its README.md. That took less than a minute.

![BeeGFS CSI Provisioner on Kubernetes](/assets/images/beegfs-csi-k8s-03-provisioner.png)

Note here that BeeGFS CSI doesn't "talk" to E-Series SANtricity like Trident CSI does. BeeGFS CSI talks to BeeGFS Management Service (which I happen to run on Kubernetes Master #1), so E-Series SANtricity (management API) is not exposed to your Kubernetes cluster.

E-Series volumes are usually thick-provisioned using the NetApp E-Series BeeGFS [Ansible collection](https://www.netapp.com/blog/accelerate-deployment-of-ha-for-beegfs-with-ansible/), although you can do it on your own (if you don't use E-Series, for example), so there's no "disk array management" involved in daily operations. Everything CSI-related is done from Kubernetes and against BeeGFS management server.

The examples directory of BeeGFS CSI source code has complete examples with both static and dynamic (plus some other variants) provisioning. 

I picked a dynamic CSI example from the BeeGFS CSI source code, and first deployed a storage class (partially shown below). Check the comments in parameters for key settings!

```yaml
# Copyright 2021 NetApp, Inc. All Rights Reserved.
# Licensed under the Apache License, Version 2.0.
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-beegfs-dyn-sc
provisioner: beegfs.csi.netapp.com
parameters:
  # in this cluster, eth1 IP address of k8s-m-1
  #   where the BeeGFS management service is running
  sysMgmtdHost: 192.168.105.11
  # use k8s/${K8S-CLUSTER-NAME}/${WORKLOAD} to avoid collission among K8s clusters
  # k8s/${K8S-CLUSTER-NAME}/dynamic would be better for production clusters
  volDirBasePath: k8s/name/dyn
```

![BeeGFS CSI SC](/assets/images/beegfs-csi-k8s-04-storage-class.png)

After that I created a PVC that uses this storage class:

```sh
$ kubectl get pvc
NAME                 STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS        AGE
csi-beegfs-dyn-pvc   Bound    pvc-6de9d5b2   1Gi        RWX            csi-beegfs-dyn-sc   90m
```

![BeeGFS CSI PVC](/assets/images/beegfs-csi-k8s-05-pvc.png)

And finally, I deployed an app which is a tiny container that touches the PV, leaving a tiny file to prove "I was here", and then stays idle.

![Test pod on BeeGFS PV](/assets/images/beegfs-csi-k8s-06-pod.png)

Notice this pod was scheduled to k8s-n-2 (under "Resource information", above).

If we scroll down to examine the app's PVC we'll see it's right there, deployed in Read-Write **Many** mode set in the storage class.

![Storage of test pod on BeeGFS](/assets/images/beegfs-csi-k8s-07-pod-storage.png)

We have two workers that are BeeGFS clients, so although k8s-n-2 is accessing the file system we could run a scale-out our workload - or run different workloads that share this data. Filesystem view from k8s-n-1 is identical to that of k8s-n-2:

![Test pod on BeeGFS PV](/assets/images/beegfs-csi-k8s-08-other-beegfs-client.png)

- BeeGFS filesystem mounted at `/mnt/beegfs`
- volDirBasePath (set in SC): `k8s/name/dyn`
- this PV: `pvc-6de9d5b2`
- full path to file created by our demo pod: `/mnt/beegfs/k8s/name/dyn/pvc-6de9d5b2`

If we wanted to play "flock() ping-pong" we could stand up another pod that briefly performs IO to the same file on the same PVC (csi-beegfs-dyn-pvc). (Old HPC hands who were around in the 00's may remember the nice little demos [Scali MPI](https://en.wikipedia.org/wiki/Platform_Computing#History) shipped with their software.)

Or, in terms of modern, real-life workload examples:
- two S3 pods ingressing IoT data and storing it on a BeeGFS CSI PVC (2 x 4 GB/s)
- eight containerized apps analyzing and processing uploaded data without moving, downloading or copying (8 x 4 GB/s)

This mixed workload (30+GB/s) should be doable with just a handful of servers running BeeGFS and one E-Series array (EF600, 2 RU). If you want to experiment with this on your own deploy MinIO and use a BeeGFS CSI.

![MinIO Operator with BeeGFS CSI](/assets/images/beegfs-csi-k8s-16-unified-fileobject.png)

Note, however, that MinIO Operator imposes certain choices ("best practices") which may not necessarily apply to this environment (such as Erasure Coding, which BeeGFS on E-Series RAID no only takes care of with its filesystem chunking, but also offloads on to BeeGFS metadata and storage nodes (chunking) and E-Series (data protection)). These MinIO Operator requirements also bloat CPU and memory resources required to deploy.

Alternatively, consider [MinIO Helm Chart](https://github.com/minio/minio/tree/master/helm/minio) in StandAlone mode with a BeeGFS CSI storage class tailored to your use pattern. My little test cluster didn't have enough resources to deploy MinIO with Helm, so I leave this for another post.

And one last example of the flexibility in mixed environments mentioned earlier: here's the same pod executed with *two* Persistent Volumes from two back-ends managed by two CSI provisioners - BeeGFS CSI and Trident CSI:

![Kubernetes Pod with Trident and BeeGFS PVs](/assets/images/beegfs-csi-k8s-12-multi-backend-pod.png)

This pod runs the same example from BeeGFS CSI examples - it touches a file on a BeeGFS PV - and adds an extra step: it copies the file to a SolidFire volume (iSCSI PV provisioned by Trident CSI). 

```sh
touch "/mnt/dyn/touched-by-${POD_UUID}" && cp /mnt/dyn/touched-by-* /mnt/sf/ 
```

This is of little practical use (although you could move or copy files from one filesystem to another this way), but let's consider a practical example:

- researcher's remote desktop with Jupyter and other tools running with guaranteed SLO in terms of IOPS (fast boot and consistent response). Data protection is done with snapshots and backup (enterprise-grade or free tools such as Velero or SolidFire's built-in Backup to S3)
- at the same time, shared access (can be read-only) to data on BeeGFS at gigabytes per second
- .... and the same approach scales to dozens and hundreds of researchers

## Data protection

Because storage and metadata volumes may be located on many E-Series arrays, E-Series/SANtricity snapshots on one array can't be used to protect data across all arrays.

But generic utilities can be used to protect data using approaches such as replication and backup. It can't be done in a point-in-time fashion across the entire filesystem, but PVs can be backed up. Let's say a BeeGFS CSI PV has 10TiB of data. At 100MiB/s it takes one day to upload this to S3. And the second time it'll take less because only changes have to be uploaded.

To check if this can work I deployed latest Velero with Restic and told it to store backups on S3. If you want a simpler version, you could run scheduled Restic cronjobs outside of Kubernetes and backup data to S3 or [Rest Server](/2022/04/03/restic-server-netapp-eseries.html). But this is a Kubernetes-focused post so I created a new namespace ("backup"), redeployed the same demo app and backed it up.

![Velero backup of BeeGFS data to S3](/assets/images/beegfs-csi-k8s-13-backup-to-s3.png)

I reused an old bucket I use for Restic testing so the bucket name may be confusing, but the important part is BeeGFS PV data was backed up along with the namespace and application details.

![Velero backup in S3 bucket](/assets/images/beegfs-csi-k8s-14-velero-backup-on-s3.png)

As backup succeeded it was safe to delete the namespace and make sure the PV was gone, after which I attempted to restore. That worked, too.

![Velero restore to BeeGFS data](/assets/images/beegfs-csi-k8s-15-velero-restore-from-s3.png)

Some applications may need to not modify data while backup job runs, and there may be some other gotchas. But this looks promising, and potentially viable for PVs up to several TB in size. 

Another approach I evaluated was Kanister, which is one of open source components used in Kasten K10. The approach I tried with MySQL on BeeGFS was `KubeExec` (this isn't to say you should use BeeGFS for MySQL), but `BackupData` can be used for flat files. Or, if the main application is stopped, it is also safe to use `CopyVolumeData` to copy data to S3. Both `BackupData` and `CopyVolumeData` will give better results if files are not modified while they are being copied.

![Kanister restore MySQL on BeeGFS](/assets/images/beegfs-csi-k8s-17-kanister-restore.png)

In case anyone's curious why I didn't use Kasten: I wanted to, but I couldn't make Kanister work because I couldn't make Kasten's Kanister jobs work without attempting to take a snapshot (which fails, because BeeGFS CSI doesn't have snapshots). But I assume that correctly configured, the same Kanister jobs would work just fine in Kasten K10.

## Summary

Parallel file systems are specialized filesystems for workloads that significantly benefit from fast single file performance, fast aggregate performance (throughput or IOPS), the ability to write in parallel to the same file, precisely manage filesystem cache, and more.

Not everyone needs this, and you wouldn't run SQL Server on Kubernetes with BeeGFS CSI (of course, somebody should give it a shot to see if that's possible).

Evaluate with a handful of smallish Linux VMs, free BeeGFS, generic disks, and BeeGFS CSI to see if BeeGFS CSI is fits your requirements. NetApp also has an Ansible collection that can make deployment fast and consistent, but if you start small in an odd environment that doesn't follow best practices, it may be faster to install manually.

If you run generic (Linux) applications, mainstream HPC, or analytics applications in containers and you feel constrained in terms of performance and scale, or don't have enough choice when it comes to HPC in a containerized environment, take a look at BeeGFS CSI and reach out to the fine folks from the E-Series Team for help with sizing and design for highly available production environments. 

BeeGFS CSI has initial (experimental) support for Nomad CSI (which itself is in Beta). In a recent post I blogged about [Nomad and BeeGFS Host Volumes](/2022/04/05/nomad-beegfs-eseries.html) and that works fine. In one of next posts I'll move on to BeeGFS CSI with Nomad CSI.

## Demo

- [Walk-through BeeGFS CSI SC, PVC and PV creation in a Kubernetes cluster](https://rumble.com/v10dlqt-an-introduction-to-netapp-beegfs-csi.html) - 4m54s
