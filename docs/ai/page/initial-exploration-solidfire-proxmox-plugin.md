# Do we need a NetApp SolidFire plugin for Proxmox

Tire-kicking exercise: SolidFire plugin for Proxmox PVE

- [Who wants it and why?](#who-wants-it-and-why)
- [Perl for the win!](#perl-for-the-win)
- [Features](#features)
- [Effort](#effort)
- [Appendix A: what works and how](#appendix-a-what-works-and-how)
- [Appendix B: observations, problems, solutions](#appendix-b-observations-problems-solutions)
- [Appendix C: why I don't want a SolidFire plugin for PVE](#appendix-c-why-i-dont-want-a-solidfire-plugin-for-pve)
- [Appendix D: Corosync 101 for casual users](#appendix-d-corosync-101-for-casual-users)

> "Any headline that ends in a question mark can be answered by the word no." 

> [Betteridge](https://en.wikipedia.org/wiki/Betteridge%27s_law_of_headlines)

My post title doesn't even have a question mark, but I tentatively reached the same conclusion.

## Who wants it and why?

No one is asking. Maybe some SolidFire users would want it - I don't know. 

But as IT teams (mostly SMB, from what I see) kick tires on various "alternatives", sometimes they ask about plugins (not specifically SolidFire, but "overall").

My ["SolidFire with Proxmox"](/2022/04/05/proxmox-solidfire.html) post gets visitors every now and again, so I figure there may be half a dozen users out there.

SolidFire is simple and easy to use. There isn't that much to automate and I don't know if there's much value in making what's already incredibly easy, easier...

Maybe there is a little. Someone would need to make that happen, though. At this time - with [not much time left](/2022/09/23/eoa-solidfire.html) before End of Support arrives.

But still, I was curious so I looked at this "[community](https://github.com/kolesa-team/pve-purestorage-plugin)" plugin for Pure Storage. 

Let's see...

## Perl for the win!

Proxmox "PVE" storage plugins are written in Perl. That is hilarious!

I last used Perl in 2003 (I guess) and around 2010 I probably already thought I'd never need to use it again.

But here we are... I heard some rumors about Rust as well, so I took a look at these two.

Simple Perl script for `ListAccounts` method in Python API has been [posted](https://github.com/scaleoutsean/awesome-solidfire/commit/833dcf0c66dae8ea1e024fc867372448e94a4edc) to my Awesome SolidFire repository. 

In the same commit I made a Rust example.

So okay, Perl is possible, but unpleasant. 

## Features

I always thought VMware plugins were monstrosities, especially the ones bloated Java-based ones (before vSphere v7). 

I've no idea if they were "bloated", but they certainly seemed so. And there were **always** some bugs. Year after year. Spot a bug if you do this, spot a bug if you do that, spot a bug if you upgrade vCenter... I tend to RTFM so I didn't encounter as many, but it was a terrible experience. 

Proxmox storage plugins look exactly like I'd expect a storage plugin to look except for the fact that they're written in Perl.

This one has around 1,000 lines of code, and the usual features: create, grow, delete, purge, snapshot, clone and restore (from a snapshot).

SolidFire's API is probably easier to use than Pure's and unlike that plugin (iSCSI and FC), we don't have to deal with FC. Yay!

We also don't have to deal with multi-pathing (which seems like a big deal in this Pure Storage plugin), because every SolidFire who did it right does not **have** a multi-pathing SAN. Why? Because they use LACP or (maybe even) a single physical path to Solidfire storage.

So, it should be very easy to re-purpose the Pure plugin, right? 

Pure Storage (Flash System) uses RESTful API and SolidFire uses JSON-RPC, so almost none of the plugin content can be "recycled" for SolidFire. But, with some DIY practice such as that sample script above and a bit of scrolling up and down that code, it's not too hard to do the basic stuff (such as, "create volume").

## Effort

I've started doing some search & replace work, but I'm still not determined to go further.

But if anyone wants to try, it's worth looking at. 

I don't have a Proxmox environment at this time so I'd have to set that up, and then I could try my "SolidFire plugin", see how each of those storage functions fails, fix them one by one, test and document. Writing five or six API methods is not even half the effort. See the list of recommended [integration testing](https://pve.proxmox.com/wiki/Storage_Plugin_Development) for storage plugins. If you give it a try also check out the Linstor [plugin](https://github.com/LINBIT/linstor-proxmox/blob/master/LINSTORPlugin.pm) that's very readable (great for those of us who suck at Perl!).

At minimum, I think we'd need at least 5 "subroutines" as they call them:

- 2-3 helper functions for SolidFire
- Create
- Delete
- Snapshot
  
The rest of those that the Pure Storage plugin has are very nice to have, but at minimum I'd start with these three features and whatever other plumbing is required to make them work.

Since now one is asking and there are other pressing things to do (and where Perl isn't required), I doubt I'll try to make that happen. But, if I do it, I'll update this post!

## Appendix A: what works and how

I blogged about this last year, but briefly: every SolidFire volume needs to be added like this: in Datacenter aka "vCenter", add iSCSI storage. 

![Configure iSCSI Target](/assets/images/proxmox-pve-solidfire-01-add-iscsi-target.png)

IDs should probably follow some convention like "clusterName-volumeName-volumeID" which in this particular case would be `DR-pve01-99`. Notice how `Nodes` is empty - like with vSphere, you could create a SolidFire VAG and simply add all PVE nodes' initiators to it the same way NetApp HCI did with vSphere ESXi servers.

Once that's done, you may have one or more such iSCSI targets aka "pools".

![Configured iSCSI Target](/assets/images/proxmox-pve-solidfire-02-added-iscsi-target.png)

Now you can create LVM on this iSCSI target and use it.

![Configure LVM on SolidFire iSCSI Target](/assets/images/proxmox-pve-solidfire-03-add-lvm-on-iscsi-target.png)

You might do something like this. I tried "Wipe Removed Volumes" and it didn't do anything obvious, but this probably isn't a smart option for most SolidFire users (more on that later).

![LVM on SolidFire LUN in PVE](/assets/images/proxmox-pve-solidfire-05-lvm-on-solidfire-lun.png)

LXC containers:

![LXC on SolidFire-backed LXC in PVE](/assets/images/proxmox-pve-solidfire-06-lxc-vm-on-lvm-iscsi.png)

Now  you may wonder: if we had a PVE storage plugin for SolidFire, would SolidFire appear on that list? Not necessarily. More on that later.

![LXC LV disk on SolidFire-backed LVM in PVE](/assets/images/proxmox-pve-solidfire-07-lxc-lv-creation.png)

This creates a LV for the container. Use `discard` (not shown, but it's in `Mount options` in the LXC containers screenshot above, make sure yuo select it!) to keep it slim.

For VMs (and containers) you can put boot disk on LVM backed by shared storage (here, SolidFire iSCSI, of course.) This creates more workload on storage, but OS is "movable" together with any extra disks with data which is good for HA and DR since you don't have to think where the OS is going to come from.

![VM boot disk on SolidFire-backed VM in PVE](/assets/images/proxmox-pve-solidfire-08-boot-disk-creation.png)

Still, there's no value in having OS data on shared storage if one can use stateless OS, provision workload in containers and mount data volumes as Docker volumes. This is also useful with LXC containers.

Either way, LVM can host containers, VMs, boot and data disks. But in both cases you need to do your homework regarding HA with LVM on shared storage to make sure HA works the way you need.

![VM resources overview with Disk on LVM/iSCSI ](/assets/images/proxmox-pve-solidfire-09-vms-and-lxc-on-lvm-with-solidfire-iscsi.png)

After playing a bit I checked Account Efficiency for the user `pve`. Compression was high, dedupe fine. 

![Proxmox PVE and SolidFire storage efficiency ](/assets/images/proxmox-pve-solidfire-10-pve-lvm-solidfire-efficiency.png)

This isn't representative, and there's no reason why you'd get more than with VMware or KVM or Trident, but as I mentioned in the old Proxmox post, blocks dedupe and decompress globally, which means across LVMs. 

I checked in order to see if my storage efficiency was alarmingly low. It wasn't, so this is fine.

## Appendix B: observations, problems, solutions

Some extra thoughts related to Proxmox PVE and/or SolidFire...

When you create LVM, Proxmox offers to expand existing LVM groups.

![Promox PVE Storage UI](/assets/images/proxmox-pve-solidfire-11-proxmox-storage-ui.png)

I don't think that's what we should do with SolidFire, except in very special circumstances. Most users want 1-iSCSI-LUN = 1 LVM and then create LVs on that LUN. The default approach seems like VMware datastores that are spread over multiple extents or something like that... I would create a new LVM for every iSCSI volume.

Number (2) below: it's also not *easy* to achieve consistency in naming. iSCSI targets and LVMs can be observed, but VGs cannot, so I often had to leave that dialog box, go see what I have in terms of VG names, and then go back.

![Promox PVE Storage naming conventions](/assets/images/proxmox-pve-solidfire-12-proxmox-storage-naming-conventions.png)

Number (1) above: even for SolidFire LUNs, I didn't start with `DR-volName-volID` but with just `DR`, so LUNs and LVMs aren't consistently named either. (LUN names can't be edited, so you can't fix it later if you don't want to remove anything you have on LVMs, and LVMs themselves.)

Number (3): it seems "Wipe Removed Volumes" activates a "shred-like" feature that senselessly overwrites LVs which creates a lot of workload on SolidFire. I can't say that's "unnecessary", but it often probably is unless you're in hosting business. 

Also, near number (3) you can see cloning (copying) from one LVM to another can be done. It's not smart like VMware Storage vMotion,but it helps avoid the finding 

![LXC moved from local to shared PVE storage](/assets/images/proxmox-pve-solidfire-13-proxmox-clone-from-local-to-shared.png)

You may want to give a higher bust setting to iSCSI volumes to handle these cases. While thinking about this, see top right corner - I created very small iSCSI volumes, which is why moving/rebalancing was necessary. Clone + delete (old) is one way to do it. I didn't see a "move" command, but even if there is it can't offload that from storage any better than cloning can.

## Appendix C: why I don't want a SolidFire plugin for PVE

Maybe it's because it's very hard to create one. But I actually got a very basic version working this weekend. It's not easy, but it's not super-hard, either. 

The biggest reason is SolidFire is so easy to use, it's hard for me to see much value in creating a storage plugin that only saves the *easiest* step. Yes, I now need to do "three steps" instead of two or maybe one:

- Create volume on SolidFire
- Create iSCSI storage "pool" (iSCSI target rescan is in this step)
- Create LVM

With a SolidFire plugin, I would have two steps, or maybe one. And the SolidFire step (1) is the easiest one, so why create a plugin for SolidFire? 

Considering how confusing the Proxmox UI is (see next Appendix), I honestly don't see value in having a SolidFire plugin for PVE. I just have to update and patch the thing and the confusing and difficult steps all remain (the other two).

I thought how I'd *want* this to work and my conclusion was: I'd prefer a good CLI that I could run on my management workstation or on a PVE node. 

From that CLI, I'd like to automate all those steps, but especially the ones I now do in the Proxmox UI because that's the part that sucks.

I first created a basic SolidFirePlugin.pm which seemed useless to me (more on that later). Then I took some content from it and created what I'd like to have. The result was this:

```sh
$ perl ./perl-utils.pl  -h
Usage: ./perl-utils.pl <subroutine> [args...]
Available subroutines:
  solidfire_cluster_info
  solidfire_volume_name_to_id <volume_name>
  solidfire_volume_id_to_name <volume_id>
  solidfire_create_volume <volume_name> <size_gib> [qos_policy_id]
  solidfire_modify_volume <volume_id> <new_size_gib>
  solidfire_modify_volume_qos_policy <volume_id> <new_qos_policy_id>
  solidfire_delete_volume <volume_id>
  solidfire_create_qos_policy <policy_name> <burst_iops> <min_iops> <max_iops>
  solidfire_list_qos_policy [policy_name]
  solidfire_modify_qos_policy <policy_id> <new_burst_iops> <new_min_iops> <new_max_iops>
  solidfire_print_volumes_for_account [account_id]

$ perl ./perl-utils.pl solidfire_cluster_info
Property  Value                               
Name      DR                                  
Unique ID xh67                                
SVIP VLAN 0                                   
SVIP IP   192.168.105.34                      
UUID      2da5c99a-3cd1-46bc-abef-cadebec27bea

```

I get cluster name, iSCSI target IP, volume names, QoS and accounts, so entire back-end information PVE needs is available and can be piped to PVE CLI commands or API functions.

I created even more "subroutines" later, that were out of scope for Proxmox integration, but very much needed.

![Prime SolidFire cluster for PVE](/assets/images/proxmox-pve-solidfire-04-prime-back-end-solidfire-for-proxmox-pve.png)

For example, let's say you tend to use these VM QoS settings. Fine. 

![Proxmox VM storage QoS](/assets/images/proxmox-pve-solidfire-14-proxmox-pve-vm-qos.png)

We create a 1 TiB iSCSI LUN, give it 10K/50K/150K QoS and split it among 10 VMs, so each can get a fraction of that.

But, how do I really control and monitor that end-to-end? I can't. Or maybe I need a very complicated plugin.

Instead of that, I can solve this in my CLI with 10% of the effort:

- Assign storage QoS tags to VMs (gold, silver, bronze)
- Use PVE API to query them
- Use my CLI to create the right number of SolidFire volumes with appropriate QoS settings

Or maybe in the opposite direction, where I know I have 500K IOPS in my cluster with 5 SolidFire H610S nodes, so I create X LUNs with 400K IOPS (MinIOPS commitment) for VMs and leave the rest to LXC containers, and then create PVE storage QoS tags and decide individual VM's IO settings based on my resources.

No matter how I'd do it, it'd be always 10 times easier in my CLI than in a plugin because I can connect and use both APIs (SolidFire and Proxmox VE) and avoid the hassle of SSH-ing into a Proxmox box.

Earlier I mentioned how writing SolidFire-specific function is not even half of the effort required to do this. It's even worse than that. As I worked on this I realized there are additional parts (and this also answers the earlier Storage Plugin UI question):

- Storage Plugin module with CLI commands 
- Extra Perl module with SolidFire-specific logic, if one wishes to "piggyback" on one of existing plugins (and not have that module clobbered every time Proxmox is updated)
- Patches to the Proxmox UI (to get your storage exposed in the UI) - of course, this is the worst because every update breaks it, and then you have to patch, test and deploy again

This one below is probably the easiest to piggyback on - it takes a new "back-end" module in the plugin and enough patching to show SolidFire in the drop-down list as well as expose any options that other, existing back-ends don't have (say, QoS). 

![ZFS over iSCSI](/assets/images/proxmox-pve-solidfire-15-proxmox-piggyback-storage-plugin.png)

So even this "easiest" approach involves constant patching of the JS-based Proxmox Web UI every time PVE is updated. It's ridiculous. They can't "load" plugins like vCenter does - the experience is more consistent with having a vSphere storage plugin that invariably breaks every time unless you can get it included in Proxmox ISO (they have ZFS and Ceph included, for example, so Ceph with E-Series may be the easiest built-in approach as far as NetApp storage arrays are concerned.)

I'm still thinking if I should try to release the SolidFire CLI tool for PVE. Even that seems unnecessary. 

If you create a SolidFire Volume Access Group and add PVE cluster members to it, all there is to do on SolidFire is create 1 or 2 TB volumes with one of 2-3 QoS policies you choose. That takes seconds. The rest of the problems and challenges are all on PVE side.

The CLI tool I wrote can do most of SolidFire-related workflow (including SolidFire Storage Account and VAG creation), but I'd like it to have just one key feature for PVE: scan & create *consistently named* iSCSI volumes, LVMs and LGs so that it's easy to tell which VG is which LVM is which SolidFire volume.

End-to-end QoS monitoring and enforcement would be nice, but it's less important.

Two more observations related to Proxmox storage configuration file:

- Of course, it uses a proprietary format...
- Secondly, only the first `iscsi` entry (`iscsi: DR`) was manually created. The rest of them are simply done by adding more iSCSI devices in the Proxmox Web UI. Because iscsid.conf is already capable of accessing the same SolidFire iSCSI Portal, you don't have to add or remove LUNs to this configuration file. 
- LVMs are also added and removed by interacting in the UI, e.g. `base DR-pve02-101` is an LVM that uses another iSCSI pool (which is volume ID 101 and volume name `pve02` on SolidFire). 

```sh
$ cat /etc/pve/storage.cfg 
dir: local
	path /var/lib/vz
	content backup,vztmpl,iso

iscsi: DR
	portal 192.168.105.34
	target iqn.2010-01.com.solidfire:xh67.pve01.99
	content none

lvmthin: local-lvm
	thinpool data
	vgname pve
	content images,rootdir

iscsi: DR-pve02-101
	portal 192.168.105.34
	target iqn.2010-01.com.solidfire:xh67.pve02.101
	content images

lvm: pve02-101-lvm
	vgname pve02-vg
	base DR-pve02-101:0.0.0.scsi-36f47acc1000000007868363700000065
	content rootdir,images
	saferemove 0
	shared 1

```

What's even funnier is when you use the Proxmox API, you get the same data structure in API response. Happy parsing!

If you have a CLI tool that takes care of adding and removing iSCSI devices and LVMs while giving things reasonable name, the rest is just creating LVs when you create VMs or LXC containers.

Speaking of which: those who want a good, modern UI should check ["native" LXC](/2024/02/28/incus-zfs-netapp-eseries.html) on Ubuntu or [XCP-ng](/2022/07/10/xcp-ng-with-netapp-solidfire-iscsi.html) than spend time fiddling with PVE's 20 year old UI. Or wait until they fix it, then give it a try again.

## Appendix D: Corosync 101 for casual users

As I tried to add the 2nd node to the cluster, I hit what seems to be a common Proxmox landmine.

> I have a question that I tried many times and search over the Internet and got no answer. Well, I have 2 Proxmox machines fresh install. But when I join the cluster it had the pve-ssl.pem not exist error.
> [source](https://forum.proxmox.com/threads/joining-cluster-pve-ssl-pem-error.131263/)

> I’ve spent all week trying to get clustering working but I’m having problems. 
> [source](https://forum.proxmox.com/threads/create-cluster-problem-possibly-ssl-related.130309/)

I've definitively seen this as well.

Corosync config after failed cluster expansion:

```raw
nodelist {
  node {
    name: pve
    nodeid: 1
    quorum_votes: 1
    ring0_addr: 192.168.105.194
  }
  node {
    name: s195
    nodeid: 2
    quorum_votes: 1
    ring0_addr: 192.168.1.195
  }
}
```

Long story short, I suspect that PVE "smartly" picked "Private" (actually it's my iSCSI network, so I wouldn't have picked it if I noticed) network 192.168.105.0/24 for cluster traffic. 

It also tried to pick a gateway on that network (I normally wouldn't have it on a iSCSI network, but I have some DHCP clients on it that need to get package updates). I noticed that and stopped DHCP server and gateway on that network. 

Then later, when I rebooted the first single-node cluster, I realized my `ring0_addr` was down. Why would anyone go out of their way to pick a cluster interface that has DHCP address is beyond belief. 

The second node did NOT get an IP address on that network and I tried adding it to the cluster before I configured fixed IP on iSCSI network and that was the end, I suspect...

Proxmox allows you to pick a "secondary" network for cluster traffic, but the UI is poor so I didn't even notice that until I reinstalled everything and paid close attention. 

All right, fair enough - it works, but it's lame.
