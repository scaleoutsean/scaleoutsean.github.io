# Proxmox 9.3.1 and SolidFire Plugin for PVE 9.3 (Firemox)

Post describes latest update to Firemox

## PVE 9.3.1 and new Firemox

Proxmox 9.3.1 has been released.

Among noteworthy changes:
- Improved (but not much) storage plugin API
- NVMe/TCP is built in now (which was an annoyance for E-Series NVMe/RoCE, as `nvme` had to be installed manually and NVMe/RoCE wasn't officially supported)
- "Preview" shared LVM functionality is now fully supported, which affects both SANtricity and SolidFire.

## SolidFire (Firemox)

I've only updated the SolidFire (Firemox) repo so far, since I like that one.

I've [added](https://github.com/scaleoutsean/firemox/commit/127175994a0d385690dc44d033dde2a8164da944) SolidFire Perl plugin to the Firemox repo and now SolidFire users can provision SolidFire LUNs as per README.

PVE view:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-09-pve93-perl.png)

SolidFire view:

![SolidFire Perl Plugin for PVE 9.3](/assets/images/firemox-10-pve93-solidfire.png)

The API is 17 (latest), but it doesn't really do anything. I think Firemox PowerShell TUI is still better and you may in fact need it (or something like it) for QoS and other details.

## SANtricity (SANmox)

Everything should work like in [this post from March 2026](/2026/03/11/proxmox-pve-nfs-rdma-netapp-eseries.html), but you no longer need to `apt install nvme`.

I may update the [SANtricity plugin (SANmox)](/2026/05/21/sanmox-updates.html), although - given the low value of PVE's plugin features - it's probably not necessary and the old one may work just as well. SANmox can be downloaded [here](https://github.com/scaleoutsean/santricity-powershell), just remember it doesn't do that much and I haven't tested it with Proxmox 9.3 yet, although - reading the docs - there's no reason why it shouldn't work.

Also, I haven't received any feedback, so I guess either nobody needs one, or the few people who do use it just fork and vibe code the rest.
