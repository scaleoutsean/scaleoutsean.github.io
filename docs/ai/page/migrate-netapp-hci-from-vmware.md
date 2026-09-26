# How to change NetApp HCI from VMware to alternatives

The viability of migrating NetApp HCI compute nodes to non-VMware platforms

- [Introduction](#introduction)
- [Challenges with vSphere 8 on NetApp HCI](#challenges-with-vsphere-8-on-netapp-hci)
- [Alternatives](#alternatives)
- [NetApp HCI storage and data migration](#netapp-hci-storage-and-data-migration)
- [Summary](#summary)
- [Appendix A - VirtualBox](#appendix-a---virtualbox)
- [Appendix B - Using Veeam and Kasten for VM migration](#appendix-b---using-veeam-and-kasten-for-vm-migration)

## Introduction

I haven't heard of any NetApp HCI customers who want to move away from VMware. So "the problem" and reason for this post isn't that everyone is asking how to replace Vmware. 

In fact, I've seen more signs of the opposite - I've heard of several NetApp HCI users asking how to move to vSphere 8 from vSphere 7.

## Challenges with vSphere 8 on NetApp HCI

The problem with that is that vSphere 6 (and at the time of end-of-sale) 7 were well-supported, while vSphere 8 is not. 

For example, the NDE (NetApp Deployment Engine) cannot provision vSphere 8. That's not a *huge* problem, as you can provision manually, automate by yourself or use 3rd party tooling.

Another detail here is that CPUs used by NetApp HCI Gen 1 compute nodes (first SuperMicro chassis-based nodes with [Broadwell and other older CPUs](https://kb.vmware.com/s/article/82794)) are not supported by VMware - not just in the case of NetApp HCI, but overall. So there's no chance of running ESXi 8 on those because ESXi 8 will refuse to install:

> Discontinued – vSphere installer will prevent the installation of that release for the discontinued CPU

The third challenge, which is impossible to overcome on our own (I mean, as users), is getting the drivers and firmware for NetApp HCI that are certified for ESXi 8. I obviously can't help with any advice related to that. (Note: [this has worked](https://github.com/scaleoutsean/solidfire-windows/?tab=readme-ov-file#microsoft-windows-drivers-for-netapp-hci-servers-compute-nodes) for some Hyper-V-on-NetApp HCI users, but it doesn't mean the same approach would work with ESXi - it really depends on the availability of related firmware from the manufacturer, the firmware itself (was it certified or merely "works") and the strictness of ESXi checking, so the simple answer is I can't give an educated opinion. Like everyone, I'd have to experiment.)

## Alternatives

If you feel comfortable with unsupported drivers or firmware and have H600 Series (1U) compute nodes or Gen 2 chassis-based nodes, you can use ESXi 8 with old drivers or new (but not certified) drivers and firmware from Mellanox, Broadcom, SuperMicro or QCT, for example. This would be "community supported" aka "you're on your own".

For those curious about the alternatives, I wanted to consolidate existing resources for better visibility.

If you go to [https://github.com/scaleoutsean/awesome-solidfire](https://github.com/scaleoutsean/awesome-solidfire) you'll find most of available information related to the following:

- Hyper-V and Windows (separately mentioned in [here](https://github.com/scaleoutsean/solidfire-windows/))
  - Related: [SolidFire WAC Gateway](/2025/07/26/solidfire-windows-admin-center-gateway) can be used to build to realize proper RBAC
- KVM (also [here](https://github.com/scaleoutsean/solidfire-linux))
- Kubernetes (also [here](https://solidfire-kubernetes.pages.dev/); by the way, pages.dev is frequently used by spammers so this site rarely appears in search results)
- LXD (or Incus)
- Nomad
- OpenStack
- Proxmox
  - See [Firemox](/2025/07/07/firemox), an opinionated console tool for PVE-SolidFire environments
- VirtualBox ([with](https://github.com/cyberus-technology/virtualbox-kvm) - see in Appendix - and without KVM)
- xcp-ng (fork of Xen Server community edition)
  - See [xcp-ng](//2022/07/10/xcp-ng-with-netapp-solidfire-iscsi) with SolidFire)

Many links on these sites lead back to this blog, but they are not a complete list.

You may find additional posts in this blog's archive or by using the search feature. Example: [KubeVirt with SolidFire](/2023/02/12/backup-restore-kubevirt-vms-with-solidfire-kasten-kubernetes.html).

Here I have posts about using Proxmox, xcp-ng, OpenStack and Kubernetes with SolidFire, as well as different related solutions from CSI over backup/restore to replication and monitoring.

While NetApp (and NetApp bloggers) hasn't done much related to these topics, I did a fair bit on my own and I hope these posts can help you get most out of your investment. 

If you're faced with the necessity to choose between vSphere 8 and these alternatives (or can't even run vSphere 8, on NetApp HCI Gen 1) - it's going to be unsupported anyway. In that situation I'd recommend trying the original vendor's drivers and if they don't work well, then Hyper-V or one of the Linux-based solutions.

As you can see in the Windows-related repo, I know of customers whom I helped deploy upstream [drivers](https://github.com/scaleoutsean/solidfire-windows/?tab=readme-ov-file#netapp-h615c-and-h610c) with Hyper-V and it worked well. I also used those in own testing.

With Linux it should be even better. While NetApp HCI was certified for RHEL, Xen Server, Windows Server and such, NetApp never released OS-specific drivers and those versions are now old in any case, but given that Linux *community* driver support is quite good, it may be a good idea to try these alternatives since the OS can be tried (and sometimes used) for free.

Debian, Rocky Linux and Ubuntu (in alphabetic order) all provide free updates that aren't significantly or at all delayed compared to commercial Linux distributions.

## NetApp HCI storage and data migration

What about NetApp HCI storage (SolidFire) support?

You probably won't find Ubuntu 22.04 in the IMT for NetApp HCI Gen 1 (or maybe even SolidFire, I am lazy to check now), but I'd be shocked if some of them didn't work. As you can see [here](https://github.com/scaleoutsean/solidfire-windows/?tab=readme-ov-file#windows-server-2016-2019-and-2022), I briefly tested Windows Server 2022 with SolidFire 12 and it worked fine. Personally I use Ubuntu 22.04, Rocky 9, Debian 11 with SolidFire 12 and that includes both x86_64 and [ARM64](https://scaleoutsean.github.io/2021/02/24/netapp-trident-on-arm64.html) (usually with Debian and Ubuntu).

So, officially it is what it is in the NetApp IMT (interoperability matrix), but I wouldn't worry about that if I were to use a "not officially supported" compute client. You may as well give it a try.

How to migrate data from vSphere to an alternative? Obviously you can't swap compute in-place if your volumes are VMFS or vVols. You can use generic ways to migrate - whether it's backup and restore, replication or something else.

These days even databases are easy to migrate:

- backup & restore (or dump and load), or
- set up database replication or add a replica

When done just swap DNS entries or remove the source set the destination's IP to the old source IP.

There are probably 3rd party migration solutions which should work as they work with any iSCSI storage.

For vSphere RDM disks, those can be simply cloned and the clone assigned to a new host or a VM or a container (NetApp Trident CSI can import non-Kubernetes volumes, but they must be non-partitioned - I can't find that in the docs right now but [this post](https://scaleoutsean.github.io/2021/03/20/kubernetes-solidfire-failover-failback.html), albeit long - shows in detail how Trident import works with non-partitioned volumes). 

Regarding migration from VMware VMs to Kubernetes, for light VMs maybe KubeVirt is now good enough for production. A workaround that could be used here is a VM-based script that mounts a partitioned RDM iSCSI disk as well as an non-partitioned. 

Here's how migration could be done with a dedicated "migration service" VM:
- mount a cloned iSCSI disk from VM formatted with XFS - /dev/sdb -> /src
- mount a new non-partitioned iSCSI disk formatted with XFS meant for Kubernetes (same size or possibly larger) - /dev/sdc -> /dst
- `rsync -av /src/ /dst/`
- Ensure the permissions are correct (especially for Kubernetes data); modify if necessary
- Once done, log out of the both targets, present the destination volume to Kubernetes and import from Trident. Trident can also grow volumes, by the way. I recommend XFS on destination if possible

If you're happy with the result, you may delete the clone of the source volume, but you can also keep it for a while (it should be deduplicated and not take extra space) or [back it up](https://scaleoutsean.github.io/2021/04/21/solidfire-backup-to-s3.html) to a low cost S3 service (such as [Wasabi](https://scaleoutsean.github.io/2022/01/19/solidfire-backup-restore-wasabi-s3.html), [Backblaze](https://scaleoutsean.github.io/2023/09/02/solidfire-backup-to-s3-backblaze-b2.html), on-prem MinIO) and then you can remove the clone volume.

Again, I wouldn't bother with this for databases; dump & load or replication-based seems much cleaner to me. But if you want to automate you can consider that approach. For Windows RDM you could use rsync as well, but robocopy or other tools may be more suitable for NTFS or ReFS.

I have an [example of automating cloning and access](https://github.com/scaleoutsean/solidbackup). Last time I used it I realized it has some minor bugs that are not difficult to solve, but I haven't pushed the fixes to Github because I've never heard of anyone using that code. The same code can be used to create backups to S3 or other destination.

## Summary

NetApp HCI users unable or unwilling to use vSphere 8 have reasonably good odds of successfully re-purposing those for Linux or Windows.

I hope this gives you something to work with, especially NetApp HCI Gen 1 compute users!

## Appendix A - VirtualBox

VirtualBox is the only one from that list that doesn't work well.

What doesn't work well? [This video](https://www.youtube.com/watch?v=GDXDeiC7-Vg) shows VirtualBox iSCSI initiator using SolidFire block devices. It was not very stable. Even if KVM is used from Virtualbox, it's the same problem. 

What works is direct connection from Virtualbox guest VMs to iSCSI storage, which is not hypervisor-related.

## Appendix B - Using Veeam and Kasten for VM migration

- Veeam B&R has features that can be used to move VMs from VMware to several other hypervisors
- Kasten may be used with OpenShift to [migrate](https://veeamkasten.dev/ocpv-migration) VMs to KubeVirt on OpenShift. See about KubeVirt [here](/2023/02/12/backup-restore-kubevirt-vms-with-solidfire-kasten-kubernetes.html)
- If source and target filesystems are not compressed and both old and new hypervisor use the same SolidFire, SolidFire should deduplicate migrated VMs and migration should not need extra space. You could leave a snapshot of old hypervisor data online for some time
