# Firemox (Proxmox-SolidFire TUI) updates

Small updates to my Proxmox-SolidFire TUI

## Introduction 

Today I updated [Firemox](/2025/07/07/firemox.html), my TUI for PVE with SolidFire.

Firemox is developed and tested with:

- Proxmox 9.1.1
- SolidFire 12.5
- PowerShell 7.6.2 on Linux

## Allow Snapshots as Volume-Chain: on by default

That's new in PVE 9 and while it could be manually enabled after LVM creation, it's nicer to have it on by default because it's been stable enough in [SANmox](/2026/05/21/sanmox-updates.html).

![Allow Snapshots as Volume-Chain](/assets/images/firemox-05-update.png)

## Other changes

Some other, minor changes:

- Too many parameters were hard-coded. Now most of them can be passed on startup, including the option to ignore TLS validation (sigh...)
- Firemox now uses PVE secret token, no more PVE passwords. It's annoying having to create these, but it's more secure, so it's better that way.
- Firemox now injects PVE metadata into SolidFire volume attributes once PVE datastore is created on shared LVM, so if you use [SFC](https://github.com/scaleoutsean/sfc) or something else that gets those, you can filter those out/in, or aggregate all PVE volumes

I still do not do what I do in SANmox - allow profile creation. Although those SANmox profile credentials are encrypted, I still don't like the idea, so that hasn't been added. I also did not want to mess with automated iSCSI configuration. I know it's "nice to have" these features, but I also know it's risky if you have any other iSCSI clients. That's why neither of these features made it to Firemox - I like them, but not enough to add them here.

## Conclusion

Firemox has the same value proposition as before: consistent, end-to-end management for SolidFire in PVE environments. 

- Create volumes on SolidFire for PVE users
- Create VG and shared LVM on Proxmox VE
- Maintain consistent naming and avoid mess
  - SolidFire Volume: `dc1-dc2-001`
  - PVE iSCSI pool: `dc1-dc2-001`
  - PVE VG: `vg-dc1-dc2-001`
  - PVE LVM: `lvm-dc1-dc2-001`

![Shared LVM for Proxmox](/assets/images/firemox-06-shared-lvm-solidfire.png)

Firemox is fast, has a minimal attack surface, requires almost no updates and removes the need to use a Web browser where malicious browser extensions can get you.

The UI hasn't changed - this is one of the sub-menus - it works the same, but with fewer bugs.

![Firemox TUI](/assets/images/firemox-07-firemox-tui.png)

PVE's storage view from iSCSI pool to VG to LVM:

![Firemox naming](/assets/images/firemox-08-firemox-e2e-consistency.png)

An update, released as v1.0.0 (as I may update it again), has been posted to the repo.
