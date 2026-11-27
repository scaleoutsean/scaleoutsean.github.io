# Storage plugins for Proxmox 9.3 with NetApp SolidFire (Firemox) and E-Series (SANmox)

Quick look at the latest update to Proxmox PVE 9.3 and how that impacts Firemox and SANmox, my plugins and TUIs for SolidFire and E-Series (SANtricity)

## PVE 9.3.1 and new Firemox

Proxmox 9.3.1 has been released.

Among noteworthy changes that I care about professionally:

- An improved (but not by much) storage plugin API
- NVMe/TCP is built in now (the lack of `nvme` was an annoyance for E-Series NVMe/RoCE, as `nvme` had to be installed manually and NVMe/RoCE wasn't officially supported)
- "Preview" shared LVM functionality is now fully supported, which affects both SANtricity and SolidFire.

## SolidFire (Firemox)

- Firemox has **no news/updates**. It is expected to work the same as it did with PVE 9.2 and 9.1.
- [SolidFire plugin has been added](https://github.com/scaleoutsean/firemox/blob/master/SOLIDFIRE-PLUGIN-PROXMOX.md) to the Firemox repo and now SolidFire users can provision SolidFire LUNs as per the plugin's [documentation](https://github.com/scaleoutsean/firemox/blob/master/SOLIDFIRE-PLUGIN-PROXMOX.md).

Do you need the plugin?

- If you use Firemox TUI, just do everything there. There's no need to use the plugin.
- If you use this Plugin or Web UI in general, maybe you'll like the plugin

The plugin in PVE 9.3's "Add storage" wizard:

![SolidFire Plugin for PVE 9.3 - add storage](/assets/images/firemox-11-pve93-solidfire.png)

The details:

![SolidFire Plugin for PVE 9.3 - add SolidFire LUN](/assets/images/firemox-12-pve93-create-solidfire-volume-details.png)

All it does is create a volume. PVE view of the volume:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-09-pve93-perl.png)

SolidFire view:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-10-pve93-solidfire.png)

Then you need to create LVM, VG, datastore using built-in PVE Web UI features for Shared LVM on iSCSI. You can see the rest at the plugin link above.

The new SolidFire plugin uses the API 17 (latest). Because each LUN is independent, there's no centrally saved configuration for SolidFire, so it takes a lot of data to key in for each volume, but the CLI version command is a little easier to use.

Why even bother? If you work mostly in the Web UI, it might be OK (especially the CLI version). It won't be okay if you create and delete a lot of LUNs every day, or if you need to edit them (there are known limitations regarding updates of edited configuration details in this minimal initial version).

I think Firemox PowerShell TUI is still better - it lets you do everything in a fast shell interface - and you may in fact need it (or something like it) for QoS and other details even if you use the new Perl plugin for the final step.

## SANtricity (SANmox)

Everything should still work like in [this post from March 2026](/2026/03/11/proxmox-pve-nfs-rdma-netapp-eseries.html), but you no longer need to `apt install nvme`.

I just upgraded and rebooted. NVMe wasn't set to auto-connect so I had to do that from shell, but after that, everything came up including the volume used for [CetraFS](/2026/11/07/proxmox-pve-netapp-eseries-cetrafs.html). 

![SANmox with PVE 9.3.1](/assets/images/sanmox_v2_04_pve93-santricity_volumes.png)

The one that was down was `pbs421`, which was a backup datastore that lived on Proxmox Backup Server 4.2 (powered off).

Then I powered it on, and that datastore came up too.

![SANmox with PVE 9.3.1](/assets/images/sanmox_v2_05_pve93-santricity_volumes-cetrafs.png)

So, PVE 9.3.1 works fine with SANtricity 12.1.

### NVMe support circus

I just realized that it is only NVMe/TCP that is supported. That is medieval!!!

![No RoCE support](/assets/images/sanmox_v2_06_pve93-storage-add-wizard-00.png)

Just as before, we don't have to care if you don't use NVMe/RoCE. 

In 9.3.1, `nvme` is included, so we just configure RoCE, configure NVMe the same way it's done for NVMe/TCP (only for RoCE), create block devices and rescan.

Since I've done the LUN presenting already, I could use SANmox to create a datastore from the CLI, but if you use it from the UI, you can see the same fields that `sanmox_lvm` requires.

![No RoCE support, but OK](/assets/images/sanmox_v2_07_pve93-storage-add-wizard-01-sanmox-lvm.png)

A `santricity_lvm` example (`saferemove 1` is not used in this particular example):

```sh
$ pvesm add santricity_lvm pve93 \
  --vgname pve93 --array_serial 952103002724 \
  --shared 1 --nodes h3 --content images \
  --santricity_namespace_eui eui.000016186b07f66dd039ea0000493a26 \
  --santricity_initialize 1
```

And, in your storage config files, you'd see something like this:

```sh
santricity_lvm: pve93
        array_serial 952103002724
        shared 1
        vgname pve93
        content rootdir,images
        host_group pve-dc1
        saferemove 1
        santricity_initialize 1
        santricity_namespace_eui eui.000016186b07f66dd039ea0000493a26
        snapshot-as-volume-chain 1
```

You can get the EUI and serial from `ls /dev/disk/by-id` and you can also get the serial from `nvme list`. Or from SANtricity PowerShell cmdlets from the same repository.

```sh
# ls -lat /dev/disk/by-id/
lrwxrwxrwx 1 root root   13 Nov 26 03:18 nvme-NetApp_E-Series_6000_952103002724_10 -> ../../nvme1n9
lrwxrwxrwx 1 root root   13 Nov 26 03:18 nvme-eui.00000f996a0e75efd039ea0000493a9c -> ../../nvme1n9
```

Most absurdly, there's nothing else to do! It works out of the box, unchanged from 9.2 and 9.1 (where it also wasn't supported).

![NVMe-of-RoCE](/assets/images/sanmox_v2_08_pve93-storage-nvme-of-roce.png)

But hey, NVMe/RoCE n0T sUpPorRtEd because reasons!

The UI even correctly identifies the devices, NVMe/RoCE connections and multi-paths.

![NVMe-of-RoCE devices](/assets/images/sanmox_v2_09_pve93-storage-nvme-of-roce-devices.png)

VM test:

![NVMe/RoCE test with VM](/assets/images/sanmox_v2_10_pve93-storage-nvme-of-roce-vm-test.png)

CT test:

![NVMe/RoCE test with VM](/assets/images/sanmox_v2_11_pve93-storage-nvme-of-roce-ct-test.png)

In contrast, SANmox just takes care of the E-Series side, as well as passwordless SSH-driven PVE host operations. This is enough if you don't use NVMe/RoCE. Example of one submenu:

![SANMox for volumes](/assets/images/sanmox_v2_12_pve93-sanmox-tui.png)

### Gotchas

Even after deploying the new plugin, my browser initially showed the old add storage UI wizard (from the old Perl plugin). Restarting related services didn't help, so I rebooted PVE and hit F5 a few times.

### Recap and download links for SANmox

So, long story short: NVMe/RoCE users no longer have to do is `apt install -y nvme`. The rest remains the same as it was:

- We need to configure RoCE when configuring PVE storage network
- We still need to create LUNs, PVE host group and present to host/cluster (use SANmox TUI (PowerShell) or other tool)
- We can do the rest manually or with SANmox TUI and `sanmox_lvm`

Download links (both are in the same repository):

- [SANmox TUI](https://github.com/scaleoutsean/santricity-powershell/tree/master/sanmox) - PowerShel 7 TUI for storage prep-steps (iSCSI, NVMe/RoCE, maybe FC (submit bugs if any doesn't work))
- [`santricity_lvm`](https://github.com/scaleoutsean/santricity-powershell/tree/master/sanmox/proxmox_plugin) - "Add storage" wizard is recommended for NVMe/RoCE only and CLI (`pvesm add santricity_lvm`) is recommended over UI storage wizard because you can avoid browser-based copy-pasting of the EUI string. E-Series users with the officially supported protocols can use standard PVE 9.3 "Add storage" wizard once PVE cluster can see disks.

If you dislike PowerShell, you can use other tools libraries to build your own automation of the storage side: my Go library or Python (both the official Ansible (meh warning) and my client library).

## Data protection and DR

This isn't related to the plugins, but in order to pre-empt whataboutism:
- With Shared LVM, you can take CT and VM snapshots without storage array support. That is why neither of these plugins or TUIs attempt to do anything with snapshots (which both arrays support)
- Default data protection method is PBS - see an example in the [Proxmox Backup Server (PBS)](/2026/03/08/proxmox-backup-server-with-netapp-eseries.html) post. Or use some of the commercial solutions such as [Veeam for Proxmox](/2026/03/14/veeam-proxmox-netapp-eseries.html)
- PBS can also replicate data, so your destination can be any box from any manufacturer. You can also [backup to S3 such as Versity S3 Gateway attached to the E-Series 4012](/2026/05/10/proxmox-backup-server-versity-s3-netapp-eseries.html) 

## Conclusion

PVEs' storage plugin improvements in 9.3 are minimal. There is *still* no reason to use them unless you do most of your management in the browser. And this is a very lame update as far as NVMe/RoCE is concerned.

**SolidFire** (Firemox) has not changed. An experimental native plugin for simple LUN creation (no edit or delete from back end) has been added if anyone wants to build upon it.

[SANmox TUI](/2026/05/21/sanmox-updates.html) for SANtricity hasn't been updated, as it still needs to do the same thing - take care of provisioning. It's probably not necessary to touch it, unless someone reports a bug. Also, I haven't received any feedback, so I guess either nobody needs it, or the few people who do use it just fork and vibe code the rest

`santricity_lvm` (Perl storage plugin) has been updated because now you have a form that lets you paste things into (in the storage wizard for `santricity_lvm`). Sadly, that only helps you overcome the NVMe/RoCE nonsense and not much else, so I don't recommend it: it's just the last of several steps and the same thing that you can get done with `sanmox_lvm`, but slower and more annoying, because you use it in the Web UI rather than from the shell. But, if UIs are your thing, it's there to be used!
