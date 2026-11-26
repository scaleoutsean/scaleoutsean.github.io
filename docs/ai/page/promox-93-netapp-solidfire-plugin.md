# Storage plugins for Proxmox 9.3 with NetApp SolidFire (Firemox) and E-Series (SANmox)

Quick look at the latest update to Proxmox PVE 9.3 and how that impacts Firemox and SANmox, my plugins and TUIs for SolidFire and E-Series (SANtricity)

## PVE 9.3.1 and new Firemox

Proxmox 9.3.1 has been released.

Among noteworthy changes that I care about professionally:

- An improved (but not by much) storage plugin API
- NVMe/TCP is built in now (the lack of `nvme` was an annoyance for E-Series NVMe/RoCE, as `nvme` had to be installed manually and NVMe/RoCE wasn't officially supported)
- "Preview" shared LVM functionality is now fully supported, which affects both SANtricity and SolidFire.

## SolidFire (Firemox)

I've only updated the SolidFire (Firemox) repo so far, since I like that one.

I've [added](https://github.com/scaleoutsean/firemox/commit/127175994a0d385690dc44d033dde2a8164da944) SolidFire Perl plugin to the Firemox repo and now SolidFire users can provision SolidFire LUNs as per the README (meaning, you need to create LUNs and let PVE see them, and from there on you can use the storage plugin and do the rest from the PVE Web UI).

PVE view:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-09-pve93-perl.png)

SolidFire view:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-10-pve93-solidfire.png)

The SolidFire plugin uses the API 17 (latest), but it doesn't really do anything special.

I think Firemox PowerShell TUI is still better and you may in fact need it (or something like it) for QoS and other details.

You could also use [SolidFire Ansible](https://github.com/scaleoutsean/netapp.solidfire) instead of my PowerShell TUI, and then the plugin, but you could also use Firemox TUI and Ansible for everything and avoid the plugin circus.

Very modest value add in the plugin, even in 9.3.1

## SANtricity (SANmox)

Everything should still work like in [this post from March 2026](/2026/03/11/proxmox-pve-nfs-rdma-netapp-eseries.html), but you no longer need to `apt install nvme`.

I just upgraded and rebooted. NVMe wasn't set to auto-connect so I had to do that from shell, but after that, everything came up including the volume used for [CetraFS](/2026/11/07/proxmox-pve-netapp-eseries-cetrafs.html). 

![SANmox with PVE 9.3.1](/assets/images/sanmox_v2_04_pve93-santricity_volumes.png)

The one that was down was `pbs421`, which was a backup datastore that lived on Proxmox Backup Server 4.2 (powered off).

Then I powered it on, and that datastore came up too.

![SANmox with PVE 9.3.1](/assets/images/sanmox_v2_05_pve93-santricity_volumes-cetrafs.png)

So, PVE 9.3.1 works fine with SANtricity 12.1.

### Disappointing RoCE support

I just realized that it is only NVMe/TCP that is supported. That is medieval!!!

![No RoCE support](/assets/images/sanmox_v2_06_pve93-storage-add-wizard-00.png)

Just as before, we don't have to care if you don't use NVMe/RoCE. 

In 9.3.1, `nvme` is included, so we just configure RoCE, configure NVMe the same way it's done for NVMe/TCP (only for RoCE), create block devices and rescan.

Since I've done presenting already, I could use SANmox to create a datastore from the CLI, but if you use it from the UI, you can see the same fields that `sanmox_lvm` requires.

![No RoCE support, but OK](/assets/images/sanmox_v2_07_pve93-storage-add-wizard-01-sanmox-lvm.png)

So, long story short: **the only thing you no longer have to do is `apt install -y nvme`. The rest remains the same.

- We still need to create LUNs with SANmox TUI (PowerShell)
- We need to configure RoCE when configuring network
- We can do the rest manually or with SANmox TUI and `sanmox_lvm`

## Conclusion

Storage plugin improvements in 9.3 are minimal. There is *still* no reason to use them.

And this is a very lame update, as far as NVMe/RoCE is concerned.

If you're using one of the block protocols listed in the PVE Web wizard (e.g iSCSI), just create LUNs, present to PVE cluster, and use them.

[SANmox TUI](/2026/05/21/sanmox-updates.html) hasn't been updated, as it still needs to do the same thing - take care of provisioning. It's probably not necessary to touch it, unless someone reports a bug. Also, I haven't received any feedback, so I guess either nobody needs one, or the few people who do use it just fork and vibe code the rest.

I have [updated](https://github.com/scaleoutsean/santricity-powershell/tree/master/sanmox/proxmox_plugin) the Perl storage plugin because now you have places to paste things into (in the storage wizard). Sadly, that doesn't do much, so I don't recommend it: it's just last of several steps and the same thing that you can get done with `sanmox_lvm`, but slower and more annoying, because you use it in the Web UI rather than from the shell.
