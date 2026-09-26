# Convert NetApp HCI from VMware to Hyper-V

How to convert  NetApp HCI VMs to Hyper-V (VMDK to VHD)

- [Requirement](#requirement)
- [Workflow](#workflow)
  - [Storage considerations](#storage-considerations)
- [Tools](#tools)

## Requirement

If you have NetApp HCI or SolidFire with vSphere 7 and want to move to Hyper-V, how to do that?

For NetApp HCI, the tricky part is compute, which likely isn't certified for latest Windows Server. I wrote about that [here](/2024/02/07/migrate-netapp-hci-from-vmware.html).

As far as SolidFire (HCI storage nodes) is concerned, Windows Server's iSCSI initiator and MPIO doesn't seem to be any different to how it was years ago.

Assuming your compute nodes support Windows Server version you want to use, or you decide to recycle some NetApp HCI on your own, you should be good to go.

## Workflow

- On SolidFire, create another tenant (storage) account for your Hyper-V cluster
- Stand up a Hyper-V cluster
- If you want to use Volume Access Groups (VAGs), get Windows initiators' IQNs and add them to a new VAG (not to any existing VAG that you may have for vSphere)
- Create several volumes on SolidFire and enable access to these volumes
- Perform VM migration
- Leave old vSphere cluster online and keep VMs (powered off) in the case you need to revert

Here you can find my notes on [Microsoft Windows with NetApp HCI and SolidFire](https://github.com/scaleoutsean/solidfire-windows) as well as some simple scripts to get you started.

I tried even [Windows Server 2025](/2024/03/31/windows-server-2025-with-solidfire-part-one.html) with SolidFire, as well as earlier Windows releases and haven't had any issues.

### Storage considerations

SolidFire volumes are always thin-provisioned by default, so you can create similarly large volumes (e.g. 4 or 8 or 16 TB) that you use on vSphere, but if you're short on capacity, you may need to migrate VMs in batches rather than copy them all at once because while deduplication may deduplicate content from VMDK copied to Hyper-V, you also need space for Hyper-V disks (VHD) which should be deduplicated, but it's best to confirm rather than assume.

If you have a 2-VM stack (e.g. IIS, SQL), copy two VMs, convert, complete migration, and then remove the VMware copies if they aren't deduplicated. Then do the next app.

Some tools may perform conversion on the fly, but you still need to make sure deduplication between VMDKs and VHDs works fine, otherwise you may run out of capacity. 

SolidiFire garbage collection runs at the top of the hour, so in order to see whether deduplication works across hypervisors, wait until the next run and compare efficiency before vs. after. If efficiency has gone up after copying (and also after conversion), that means deduplication works fine and you can move more VMs at a time.

## Tools

There are various how-to's out there, but each has some problems or "gotchas", so I'd first consider these two "packaged" solutions rather than some DIY scripts.

- Microsoft System Center VMM 2022
  - Works out of the box, supported by Microsoft
  - Read [this](https://learn.microsoft.com/en-us/system-center/vmm/vm-convert-vmware?view=sc-vmm-2022) for more
- StarWind V2V Converter
  - Can convert in both directions, in the case you decide to bail
  - Zero-Copy: converts on the fly, no need to copy VMDKs to Windows Hyper-V before conversion
  - Get it for free [here](https://www.starwindsoftware.com/starwind-v2v-converter)

Enterprise customers who use MS SC may find it more convenient as no external tools are required (which eliminates "compliance" and "security" concerns).

If you don't have MS SC, use a 3rd party tool such as StarWind V2V Converter. 

If you can leave your vSphere online for a week or two and get stuck StarWind V2V Converter can also help you move the VMs back (as they will have been updated, you wouldn't be able to simply shut down Hyper-V VMs and power up old vSphere VMs). 

Among other tools I like (conceptually at least) is Veeam's approach, as they leverage backup and restore - extra assurance in the case something goes wrong.
