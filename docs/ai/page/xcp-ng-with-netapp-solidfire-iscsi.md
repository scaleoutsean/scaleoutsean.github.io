# XCP-ng and XOA with NetApp SolidFire iSCSI Storage Repositories

XCP-ng 8 and XOA with NetApp SolidFire

- [Introduction](#introduction)
- [XCP-NG with SolidFire](#xcp-ng-with-solidfire)
- [XOA](#xoa)
- [Conclusion](#conclusion)

## Introduction

XCP-ng is an open-source fork of Citrix Xen Server. As the thing with Broadcom and VMware unfolds, people are looking for alternatives.

It "feels" similar to Proxmox (which I wrote about [here](/2022/04/05/proxmox-solidfire.html)). Although underlying hypervisor technology is different, storage-related integration with iSCSI is very similar, so if you want to check some general tips for data efficiency, provisioning, etc. of SolidFire storage with XCP-ng, skim through that [Proxmox post](/2022/04/05/proxmox-solidfire.html).

When Xen Server was version 7 I posted a demo video of it with SolidFire, you can find it on YouTube. Connecting to SolidFire from XCP-ng still works exactly the same. 

What follows is a screenshot-based walk through XCP-ng and some comments - mostly related to connecting to SolidFire, but also about parts unique to XCP-ng.

## XCP-NG with SolidFire

First, I deployed XCP-ng-on-ESXi 7. You won't do this for production environments, but I used VMs for both XCP-ng and SolidFire. 

- You won't get far without at least 2 vCPU and 4 (better 6) GB of RAM and 60 GB boot disk; if you want to run XOA, use 6GB RAM at least
- SCSI controller should be LSI Logic SAS
- I had problems booting XCP-ng, so I disabled IOMMU (not sure if that or install-alt made the difference). In CPU settings you must expose CPU virtualization to the VM, and also CPU counters as well. At first XCP-ng was getting stuck on boot so I had to boot XCP-ng in Safe Mode (press F2 to choose it, or enter `install-alt`). Next boot (after installed) was normal
- I added a NIC for iSCSI to connect to SolidFire; both NICs where VMXNET3 type

![xcp-ng VM properties](/assets/images/xcp-ng-netapp-solidfire-01.png)

Like with Xen Server, once you're done you can start using the system.

![Booted xcp-ng VM](/assets/images/xcp-ng-netapp-solidfire-02-booted.png)

If your second (iSCSI) interface is connected, you could set up iSCSI storage repositories from the CLI.

![](/assets/images/xcp-ng-netapp-solidfire-03-configure-iscsi-interfaces.png)

Under Disk and Storage Repositories, go to Create New and pick Software iSCSI (client).

![Configure xcp-ng iSCSI interfaces](/assets/images/xcp-ng-netapp-solidfire-04-add-iscsi-sr-from-cli.png)

On SolidFire, you need to create a new storage (CHAP) account for XCP-ng and set a CHAP password. If you had multiple servers (aka a "pool") you could use one account for all pool hosts, or you could add all their iSCSI initiators to an Access Group (and then assign volumes to that access group as well). 

![Create SolidFire tenant for xcp-ng iSCSI](/assets/images/xcp-ng-netapp-solidfire-05-create-solidfire-account-and-disks.png)

Notes on iSCSI networks:

- I used MTU 1500 because that's what my SolidFire Demo VM is configured to use
- I did not use tagged VLAN for iSCSI network, but XCP-ng supports that
- I did not have more than one, so I did not need to set up bonding or LACP

This is not iSCSI related, but it applies to iSCSI network as well: if you need to adjust MTU, do it early and reboot the host.

```sh
xe network-list # to get UUIDs
xe network-param-set uuid=<network-uuid> MTU=1472
reboot
```

Assuming your network and SolidFire account/volumes are ready, you could connect like this.

![](/assets/images/xcp-ng-netapp-solidfire-06-create-xcp-ng-sr.png)

In my case I had some problems and couldn't figure it out so I postponed that step because I knew I would use a GUI. iSCSI network as up and running, but something else was wrong.

![](/assets/images/xcp-ng-netapp-solidfire-07-configure-iscsi-interfaces-details.png)

Next I started Windows 10 and downloaded the old Xen Server management client for Windows, now still community-maintained as XCP-ng.

![](/assets/images/xcp-ng-netapp-solidfire-08-add-sr-classic-xcp-ng-center.png)

Add and select XCP-ng server, go to Storage > New SR and pick iSCSI.

![Create xcp-ng Storage Repository](/assets/images/xcp-ng-netapp-solidfire-09-add-sr-classic-xcp-ng-center.png)

Enter SolidFire SVIP, CHAP credentials (if you aren't using Access Groups), and Scan Target Host.

![Add xcp-ng Storage Repostitory to xcp-ng Center](/assets/images/xcp-ng-netapp-solidfire-10-add-sr-classic-xcp-ng-center.png)

I kind of screwed up here, by creating too small a volume (1 GiB). It will work for the purpose of connecting, but as I found out later, even Alpine Linux VM  template requires gigabytes of disk space.

![](/assets/images/xcp-ng-netapp-solidfire-11-add-sr-classic-xcp-ng-center.png)

One thing about networks - as I mentioned above, some details can't be changed later, such as MTU of the management interface. I also discovered there's no way to change MTU outside of maintenance mode so if you think you'll want non-default settings here, do it before you have a bunch of things going on.

![](/assets/images/xcp-ng-netapp-solidfire-12-iscsi-nic-classic-xcp-ng-center.png)

At this time XCP-ng doesn't ask questions like Proxmox does, it simply formats the SolidFire volume with ext4 (I assume, I didn't look) and LVM. If you've configured multipathing you should be able to see its status at the bottom of that page.

![](/assets/images/xcp-ng-netapp-solidfire-13-iscsi-sr-classic-xcp-ng-center.png)

Once you have a storage repository aka SR, you can create virtual disks. Unlike with VMware, you can't just create a VM on a 10GB datastore. If the XCP-ng VM template says 10GB is the minimum required, and you have 9.9GB available on that SR, better luck next time! I assume that's because of "thick" provisioning on ext4, but as I explain later, that's not a problem with SolidFire - you won't waste any space.

![](/assets/images/xcp-ng-netapp-solidfire-14-add-virtual-disk-on-iscsi-sr.png)

It seems Virtual Disks can be moved around by editing their location.

![](/assets/images/xcp-ng-netapp-solidfire-15-create-vm-on-iscsi-sr.png)

I haven't tried this but if this works okay, then this would be a way to resize SolidFire volumes (why, because even if you resize a volume on SolidFire, LVM won't realize it):

- Create a new SolidFire volume and create a new SR on XCP-ng
- Move VMs to the new SR
- Unmount and destroy the old (empty) SR from XCP-ng, and then from SolidFire

SolidFire won't waste any capacity if you provision volumes that are larger than necessary, so you could do that as well. But because smaller volumes are easier to deal with and spread around SolidFire cluster better, I'd go with several 2TB volumes (and migrate VMs to larger volumes later) rather than with one 16TB volume.

When configuring a new VM, pick a location on a SolidFire SR. I had to create few larger SRs to accommodate the minimum requirement (10GB) for built-in Rocky Linux 8.

![](/assets/images/xcp-ng-netapp-solidfire-16-create-or-reuse-vd.png)

If everything goes right, the new VM will show up and boot.

![](/assets/images/xcp-ng-netapp-solidfire-17-vm-on-iscsi-sr.png)

And because the disk is on a SolidFire SR, you should see some IO activity on the underlying SolidFire volume.

![](/assets/images/xcp-ng-netapp-solidfire-18-iscsi-sr-activity-on-solidfire.png)

## XOA

So far this has been old school stuff from Xen Server 7. 

What's different is there's a vendor that builds a Web management interface for XCP-ng which can management many individual XCP-ng servers, or groups (pools) of servers. With Proxmox you'd have to login to each host's individual Web interface, here you don't. 

XOA isn't free, but if you have a dozen XCP-ng hosts, more likely than not buying support help you save money. The vendor has a plan to provide a completely free XOA Lite built-into XCP-ng. If you were to use XOA to manage multiple pools of XCP-ng servers, you would presumably also create multiple Access Groups (one per each XCP-ng pool).

The default and recommended method of installation is via a JavaScript-enabled browser. After you your XCP-ng host's IP and credentials this page will connect to your XCP-ng host to deploy XOA (Xen Orchestra VM) for you.

![](/assets/images/xcp-ng-netapp-solidfire-19-xen-orchestra-xoa-installation-web-ui.png)

Once this page connects to your host it will ask you where you want to provision XOA and how. Great!

![](/assets/images/xcp-ng-netapp-solidfire-20-xen-orchestra-xoa-installation-web-ui-step-2.png)

Then it will deploy XOA.

![](/assets/images/xcp-ng-netapp-solidfire-20-xen-orchestra-xoa-installation-web-ui-step-3.png)

And indeed, my XCP-ng Center is still open and I can see XOA is being deployed. Awesome!

![](/assets/images/xcp-ng-netapp-solidfire-21-xen-orchestra-xoa-deployment.png)

Unfortunately, my home network is a little weird, so XOA couldn't connect to the Internet to report that it installed correctly. They support other installation modes and I used the CLI approach from XCP-ng host. I had to make one of the storages the default, which I did for"Local storage" (the only place where I had enough free capacity) and then installation worked.

![](/assets/images/xcp-ng-netapp-solidfire-22-xen-orchestra-deploy-xoa-from-host-cli.png)

Once in XOA - using the IP address I specified in the installer wizard/script - everything feels reasonably solid. XOA can also update itself from the cloud. Mine did as well, and it worked. It also helped me upgrade XCP-ng.

![xcp-ng upgrade](/assets/images/xcp-ng-netapp-solidfire-23-xen-orchestra-upgrade-xoa.png)

So, storage-related stuff.... You can see it in Dashboard. I have two SolidFire-backed SRs at this time.

![Storage in xcp-ng dashboard](/assets/images/xcp-ng-netapp-solidfire-24-xen-orchestra-storage-in-dashboard.png)

If you take a closer look at those, you'll see additional details.

![SolidFire Storage Repository in xcp-ng](/assets/images/xcp-ng-netapp-solidfire-25-iscsi-sr-details.png)

Even host-side performance view is available. Nice.

![Storage repository performance in xcp-ng storage dashboard](/assets/images/xcp-ng-netapp-solidfire-26-iscsi-sr-performance.png)

Another view of resources can be obtained from Home > Storage.

![Storage repository detailed view in xcp-ng](/assets/images/xcp-ng-netapp-solidfire-27-dashboard-storage-view.png)

When we create a new VM, we need to pick a SolidFire SR under Disks. Notice the little "Fast clone" thing at the bottom? That avoids making a full clone of the VM template.

![Deploy VM on SolidFire SR in xcp-ng](/assets/images/xcp-ng-netapp-solidfire-28-deploy-vm-on-solidfire-iscsi-sr.png)

And once the VM is deployed you can see it's located on SolidFire.

![xcp-ng VM on SolidFire SR](/assets/images/xcp-ng-netapp-solidfire-29-vm-on-solidfire-iscsi-sr.png)

Similar to VMware snapshots, you can take hypervisor-side snapshots that rely on LVM. Also similar to VMware, you can take a snapshot of VM with memory or just a crash consistent snapshot. I took a crash consistent snapshot in seconds.

![LVM snapshot of SolidFire volume in xcp-ng](/assets/images/xcp-ng-netapp-solidfire-30-vm-lvm-snapshot.png)

Now if you look at the little icons to the right of that snapshot (bottom right corner on the screenshot), one of them is Export/Download. If you click on that icon, a pop-up will ask you if you want to download the snapshot in the OVA format (no additional choices) or XVA (choices: zstd, gzip or no compression).

![LVM snapshot export step 1](/assets/images/xcp-ng-netapp-solidfire-31-vm-lvm-snapshot-export-step-1.png)

It takes a few seconds to prepare the file, and then you get a download link.

![LVM snapshot export step 1](/assets/images/xcp-ng-netapp-solidfire-32-vm-lvm-snapshot-export-step-2.png)

I didn't wait for the entire file to download, but it was working fine.

![LVM snapshot export step 1](/assets/images/xcp-ng-netapp-solidfire-33-vm-lvm-snapshot-export-step-3.png)

VMs are installed from the Hub menu, which has Templates (for VMs) and Recipes (VM + automation recipes). I found one recipe in there, for Kubernetes. Knowing that my storage and RAM resources were very limited, I couldn't afford to run this.

![xcp-ng with Kubernetes deployment recipes](/assets/images/xcp-ng-netapp-solidfire-34-deployment-recipes-kubernetes.png)

As far as SolidFire is concerned, there isn't that much difference in using SolidFire from Proxmox vs. XCP-ng. XCP-ng is still slightly behind in terms of storage support and as we saw can be opinionated (LVM is automatically chosen for SolidFire repositories) but I think that's also quite good:

- the choice (LVM) is right
- by avoiding unnecessary uniqueness, your setup is similar to hundreds of iSCSI setups out there

You probably noticed that XCP-ng marks SRs as "thick"; SolidFire volumes are thin by default, so you will save space by using "thick" LVM with SolidFire volumes.

And because LVM doesn't compress data, SolidFire will deduplicate and compress data from all LVM on all SolidFire volumes (global efficiency): data is deduplicated across all SolidFire repositories and VMs (Alpine, Debian, etc) and 3x savings aren't rare. This screenshot shows efficiency of my XCP-ng account (3 volumes): 1.99 x 1.44 = 2.86x.

![View SolidFire storage efficiency](/assets/images/xcp-ng-netapp-solidfire-35-solifire-efficiency.png)

The only thing I'd change from the defaults is possibly take a look at XCP-ng CLI and set up bonding (LACP) on iSCSI interfaces prior to configuring Storage Repositories on SolidFire. MTU 9000 is strongly recommended so use it if you can.

We could use storage-side (SolidFire) snapshots, but if you rely on hypervisor snapshots, maybe take those more frequently (i.e. as frequently as you need) and take storage-side snapshots less frequently (such as once per day, for which you can configure a schedule).

Storage QoS can be set on SolidFire to provide IO performance guarantees so that VMs don't get starved. Additional throttling can be done on XCP-ng side, which cannot guarantee minimum QoS for the SR, but it can throttle "bully" VMs from taking too large a share, so these features complement each other.

I looked at the XOA documentation and it offers JSON-RPC which I hope is easy to use. That could make Storage Repository operations even easier, but with XCP-ng they're already easy enough.

## Conclusion

I like XCP-ng and XOA, I think it's easier to use than Proxmox. Of course, there's more to hypervisors and management than just ease of use - there are also support and compatibility concerns and many other factors.

As far as SolidFire is concerned, XCP-ng is very easy to setup with SolidFire and XOA makes the management of multiple XCP-ng pools a breeze.
