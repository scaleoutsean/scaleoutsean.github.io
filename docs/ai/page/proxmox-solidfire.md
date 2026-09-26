# Consume SolidFire storage from Proxmox hosts

Notes on connecting Proxmox 7.1 iSCSI client to SolidFire 12.3

- [Configure Proxmox 7.1 with SolidFire 12.3](#configure-proxmox-71-with-solidfire-123)
- [SolidFire Demo VM on Proxmox](#solidfire-demo-vm-on-proxmox)

Some notes for folks who want to use Proxmox 7.1 with SolidFire 12... (PVE 8.4 also works!)

![Proxmox with SolidFire](/assets/images/proxmox-solidfire-diagram.png)

## Configure Proxmox 7.1 with SolidFire 12.3

First, create a tenant account on SolidFire, such as proxmox1 (in the case you have multiple Proxmox hosts).

I've created a SoliFire VAG as well (below), because at first I thought to use Proxmox without CHAP, but I later changed my mind... So you don't need a VAG (unless, perhaps, if you cluster multiple Proxmox hosts).

![Create tenant account and VAG for Proxmox](/assets/images/proxmox-solidfire-account.png)

On your Proxmox machine, install open-iscsi (not sure if it has to be enabled?) and configure iscsid.conf:

- In `node.session.auth.chap_algs` use MD5 (as SolidFire v12.3 and lower versions do not support other algorithms)
- Provide tenant account credentials for CHAP user and password, in both discovery and access
- I changed iSCSI startup to automatic (iscsid.conf) and enabled/started open-iscsi service - I'm not sure if that's necessary but it didn't create problems

You'll probably want to use iSCSI on a dedicated network or VLAN. For my environment I configured a NIC on network used by SolidFire. Pay attention to the MTU setting. 

I didn't use jumbo frames on Proxmox, so I set client MTU to 1500 (SolidFire Demo VM I use uses MTU 9000 on iSCSI network, so ideally the both sides should use the same MTU). iSCSI VLAN 103 was native on the ESXi vSwitch (Proxmox was running nested).

![Add Proxmox iSCSI interface(s)](/assets/images/proxmox-solidfire-network.png)

You may add the SolidFire target via the Web UI or in the CLI. 

![Add iSCSI storage to Proxmox](/assets/images/proxmox-solidfire-add-storage.png)

At first I used the Web UI, but later had to change the settings too many times (because I wasn't [RTFM](https://pve.proxmox.com/wiki/Storage:_iSCSI)). Storage configuration can be created and edited in the CLI as well. 

```sh
# cat /etc/pve/storage.cfg
dir: local
	path /var/lib/vz
	content iso,vztmpl,backup

lvmthin: local-lvm
	thinpool data
	vgname pve
	content images,rootdir

iscsi: DR
	portal 192.168.103.34
	target iqn.2010-01.com.solidfire:46z9.solidfire.279
	content none
```

Here:

- Device Name: "DR". SolidFire Cluster Name + Volume Name + Volume ID would have been better, so I later did this again - that's why the screenshot looks a little different
- Portal IP: SolidFire cluster's Storage Virtual IP (SVIP)
- SolidFire target is `iqn.2010-01.com.solidfire:46z9`
  - SolidFire volume created for this entry is called `solidfire`, and on SolidFire this Volume's ID is 279
- Content: I picked "none" here, to get a "raw" device which I can format with filesystem of my choosing. According to Proxmox docs "it is usually best to export one big LUN, and setup LVM on top of that LUN. You can then use the LVM plugin to manage the storage on that iSCSI LUN."

Presumably you'll have more than just one volume (which is why you shouldn't name SolidFire iSCSI devices by cluster name alone). These iSCSI stanzas - and the entire process of provisioning, in fact - should be automated with Python or via the API (SolidFire & Proxmox).

Rescan:

```sh
# pvesm scan iscsi 192.168.103.34:3260
iqn.2010-01.com.solidfire:46z9.solidfire.279 192.168.103.34:3260
```

SolidFire disk "DR" (in screenshot it's "DR-solidfire-279" - I took this again to make it better but in CLI examples below I continue using the original name before the screenshot was updated - `DR`) on Proxmox:

![DR disk on Proxmox](/assets/images/proxmox-solidfire-storage.png)

Find Proxmox Volume ID for this device:

```sh
# pvesm list DR
Volid                                           Format  Type            Size VMID
DR:0.0.0.scsi-36f47acc10000000034367a3900000117 raw     images    2147483648
```

From the Proxmox Wiki:

> So it is usually best to export one big LUN, and setup LVM on top of that LUN. 

Let's create LVM group on that volume, as they suggest.

```sh
# pvesm add lvm sf01 --vgname sf279 --base "DR:0.0.0.scsi-36f47acc10000000034367a3900000117"
  Physical volume "/dev/disk/by-id/scsi-36f47acc10000000034367a3900000117" successfully created.
  Volume group "sf279" successfully created
```

That's it!

![Proxmox LVM on SolidFire iSCSI device](/assets/images/proxmox-solidfire-lvm-on-solidfire-volume.png)

This gives us the ability to take snapshots and add additional SolidFire volumes to this LVM pool, but if you do that remember to use the same QoS settings (or a QoS policy) on all volumes that are part of the same volume group. 

Another thing to note is Proxmox API provides a way to set various workload-based bandwidth limits so in Proxmox you can set a lower limit than SolidFire gives you to restrict sequential bandwidth for certain operations (say, Proxmox-side cloning) and let the rest be used by other storage operations. Refer to their documentation for these details.

I haven't tried to resize this test volume because generally speaking a better way to grow LVM is to add additional same-sized devices. SolidFire comes with deduplication, compression and thin provisioning, so there's no harm in having "unused" space in volumes used by LVM as long as "discard" (rethinning) is in place.

SolidFire supports Group Snapshots so although you can't take SolidFire snapshots from Proxmox, you can take LVM snapshots, and from time to time you may want to take a SolidFire group snapshot as well (just in case, as they say), which can be done with a SolidFire group snapshot schedule. We could consider the old snapshot trick that folks use with VMFS filesystems on ESXi:

- Create a schedule that takes a daily LVM snapshot on Proxmox (e.g. 4:00pm)
  - When taking daily LVM snapshot on Proxmox, delete any old Proxmox daily snapshot(s)
- Create a Solidfire schedule for daily group snapshot of all LVM volumes (e.g. 4:05pm)
- This gives you just one daily LVM snapshot from Proxmox side, while SolidFire snapshots contain LVM with one Proxmox snapshot which can be filesystem- or application-consistent (depending on how you took it). You'd first restore the SolidFire snapshot or clone it, then import (LVM) disks and reconstitute LVM if required, and finally restore the LVM snapshot taken from Proxmox, if you thought it provided better consistency than crash-consistent SolidFire snapshots

Proxmox has its backup mechanisms which you can use, but you can also use some of the Proxmox features (such as "suspend") and then take a snapshot on SolidFire.

Guest OS that support TRIM could use "discard" mount option for SolidFire-backed volumes, so that they can be rethinned.

As far as storage efficiency is concerned, SolidFire compresses and deduplicates very well, which is why good old LVM with ext4 or XFS works very well here. If we used ZFS and enabled compression, the likely result would be a lower efficiency because cross-volume savings would evaporate, whereas SolidFire gives you global deduplication across the entire cluster. Maybe there are some workloads where it makes sense to use btrfs or ZFS, but I'd go with LVM as my default and choose others only when it clearly makes sense.

There's certainly more to say about how Proxmox and SolidFire could be used together, but this will do for now.

## SolidFire Demo VM on Proxmox 

What follows is my usual experiment - try to run SolidFire Demo VM and see if I can get it to work on different virtualization platforms. Officially only vSphere is supported, but I've managed to get the Demo VM 12.3 to on Virtualbox, so I thought to give it a try.

I briefly tried to run the SolidFire Demo VM (OVA for vSphere 7).

```sh
# tar xvf solidfire-demo-node-12.3.0958.ova
# qm importovf 300 solidfire-elementos-demo-magnesium-patch3-12.3.0.958.ova.ovf o2 --format qcow2
```

This resulted in a promising-looking VM.

![SolidFire Demo VM as Proxmox VM](/assets/images/proxmox-solidfire-demo-vm-import.png)

But the result wasn't so promising.

![SolidFire Demo VM fails to start](/assets/images/proxmox-solidfire-demo-vm-start-fail.png)

As you may have noticed, I had this Demo VM (which is big-ish) on NFSv3 (because I don't have enough capacity to store it elsewhere). And that NFS "server" happens to be a tiny ARM device... So I can't say if this is an import problem, or simply the fact that NFS server is too underpowered.

The VM is able to start, but not complete, boot process. Again, it could be the slow storage, but it could also be someting in post-initrd boot process.

![SolidFire Demo VM boot screen](/assets/images/proxmox-solidfire-demo-vm-start.png)

Possible workarounds include a change of disk controller. I've tried several from this list to same result.

![Proxmox 7.1 SCSI controller choices](/assets/images/proxmox-solidfire-demo-vm-storage-controller-options.png)

As you can see from [my notes on SolidFire Demo VM with Virtualbox](https://scaleoutsean.github.io/2021/04/20/solidfire-12.3.html), I managed to get it to work by detaching all of the disks from SCSI controller, adding a new SATA (AHCI, to be exact) controller, and finally attaching the disks to AHCI controller in the exact same order (although, apart from boot disk, the order maybe doesn't matter).

To do the same on Proxmox I detached all SCSI disks so that they become Unused, then attached them as SATA devices. I had to hit ESC to get to boot menu where I picked the largest (60GB) disk which is boot disk, but just like before it timed out after a while.

![SolidFire Demo VM with SATA disks](/assets/images/proxmox-solidfire-demo-vm-sata.png)

Unfortunately this failed as well. I suppose the reason is the same why SolidFire Demo VM couldn't work on Virtualbox 5 - no support for device paths (MD + Data disks) by-disk-uuid. I haven't verified this, but I found a post on the Proxmox forum that says /dev/disk/by-uuid paths aren't provided to guests.

I suppose the next thing to try would be SolidFire Demo VM on the free ESXi (6.7U3 and 7.0) running nested on Proxmox. (**UPDATE:** this was reported to work.)

**Update (2025/06):** an expanded article with PVE 8.4 can be found [here](/2025/06/24/initial-exploration-solidfire-proxmox-plugin.html).

**Update (2025/08):** my opinionated console tool for Proxmox with SolidFire, Firemox, is available on Github
