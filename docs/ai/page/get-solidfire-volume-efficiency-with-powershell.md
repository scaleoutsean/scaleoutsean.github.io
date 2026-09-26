# Use SolidFire PowerShell Tools to find low efficiency volumes

How to get volume efficiency information on SolidFire

NetApp Hybrid Cloud Control (HCC) lets you access volume details to a slightly greater detail than the SolidFire Web UI. One additional detail that we are interested about is volume (storage utilization) efficiency.

You can use this information to identify poorly utilized volumes (again, in terms of storage efficiency, not storage performance) and possibly do something about it.

If you have a bunch of volumes, you probably can't afford to do that every day or week. I created a very simple script to get you started - it's available in my Github repository `awesome-solidfire`. Connect to SolidFire and run: `./GetSfVolEff $EfficiencyFactor`

First we list Volume Efficiency of all volumes, and separately those which have volume efficiency less than or equal to $EfficiencyFactor. If $EfficiencyFactor isn't provided, `2` is assumed (that is a pretty low efficiency for SolidFire environments).

Examples:

- `Get-SfVolEff.ps1 3`: find volume IDs and names of volumes with storage efficiency less than or equal to 3
- `Get-SfVolEff.ps1`: find volume IDs and names of volumes with storage efficiency less than or equal to default (2)

I wasn't particularly inspired, so the formatting is crap. But it can still save you some time compared to doing the same in the HCC Web UI.

```raw
./Get-SfVolEff.ps1  
Cut-off efficiency factor: 2 (default)
==== OVERVIEW: VOLUMES' EFFICIENCY (Volume ID, Name, Efficiency Factor) ====
52 scaleoutsean-1 218.98
53 scaleoutsean-2 258.97
167 hv191 28.66
168 hv192 1
==== SUMMARY: LOW EFFICIENCY VOLUMES (Volume ID, Name, Efficiency Factor) ====
168 hv192 1
```

In the Summary we can see Volume ID 168 (name: hv192) has the efficiency of 1x (it's empty, that's why).

If I had more time and wanted to use this myself I'd do the following:

- Output results in HTML with links to Volume IDs in the SolidFire UI (HCICollector's Grafana interface has this "feature")
- Option to sort volumes by size, efficiency, name
- Add few lines of PowerCLI to check these volumes (get a list of VMs and sort them by size, number of VMware snapshots) - this could need a bit more work as we'd have to find a way to figure out which SolidFire Volume ID maps to which VMware datastore. If we created all datastores with Element Plug-in for vCenter and do not have duplicate volume names, that would make things easier.

But I did this for someone who asked for help, and I don't want to add random stuff without knowing if it'd be useful.

## Update (2022/08/10)

Later I also built a PowerShell-based [SolidFire capacity and efficiency report generator](/2022/03/30/solidfire-capacity-report-html5.html), meant for users who aren't connected to ActiveIQ, who need to get some basic information offline. It only lists top low-efficiency volumes, but the script is open source and can be modified.
