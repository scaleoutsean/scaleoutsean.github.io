# IBM Block Storage CSI for NetApp E-Series SANtricity 1.13.1

What's new in IBM Block CSI Driver with SANtricity patch 1.13.1

## What is IBM Block Driver CSI with E-Series SANtricity patch

[IBM Block Storage CSI driver](https://www.ibm.com/docs/en/stg-block-csi-driver/1.13.1?topic=log-1131-april-2026) is a decent CSI driver which I (not IBM, so don't call them about it!) patch to work with SANtricity. It has some unique features that may be interesting to NetApp E-Series owners.

Check out the patch [README](https://github.com/scaleoutsean/ibm-block-csi-driver/tree/santricity/santricity) for more.

IBM Block CSI just released 1.13.1, so it's time to check it out and get to work...

## What's new in IBM Block CSI 1.13.1 

- Support of NVMe over FC hosts
- Extended support to RedHat OpenShift 4.21
- Extended support to Kubernetes 1.35
- More info in callhome

**NVMe-over-FC** is noteworthy for me because that is precisely why I maintain this patch: not being interested in this enough myself, I choose to completely ignore FC in SANtricity CSI ([this post has a very high-level comparison](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html)), but IBM does it for us.

I won't go as far as to say NVMe/FC happened because of my fork although NVMe-oF first appeared there, in my patch to 1.13.0, but - if they looked - maybe it helped them realize it's the low-hanging fruit.

Currently the SANtricity patch does not specifically detect SANtricity FC ports, so it's unclear if dynamic FC provisioning would work with SANtricity FC targets, but as long as you can get output of hostside ports from your system, CSI Node logs, and submit these to Issues, there's a chance a small patch would be enough to fix it.

**Red Hat OpenShift** is the second reason why this patched driver exists: they do it, so I don't have to. This doesn't translate into a Red Hat OpenShift-supported driver for SANtricity, but if you have OpenShift and SANtricity, there's a chance it might work. Just don't put mission critical stuff behind this driver and don't call IBM or Red Hat to support you.

**Callhome** is mentioned here just so that I can say that callhome is excplicitly disabled by default in this patch. We're not supposed to send our junk logs to IBM, but it's also good to know from a privacy perspective.

## What's new in SANtricity Patch

There are no new SANtricity-related features or improvements. But the patch now uses latest SANtricity Client (my Python client library) which can support create/delete/list snapshots (and also has new bugs).

That means that we should be able to add single volume snapshot support without major changes. The patch may still be updated during v1.13.1 to add snapshots. If that happens, the patch documentation will be updated to reflect that. Currently I'm thinking about building a snapshot wrapper in SANtricity Client to include a full workflow, so that it can be used in other Python software.

## Conclusion

I'm happy with IBM Block CSI (with SANtricity patch) - it's a nice solution that meets specific needs for CSI that I could not deliver by myself.

v1.13.1 keeps delivering in two of those key areas, Fibre Channel and OpenShift.

It's also working out development-wise: after the first SANtricity patch (for 1.13.0), I submitted a bug report to IBM (a fix was already applied in my patch, but IBM Block CSI doesn't accept contributions) and it seems that problem has been fixed by IBM, so I had less to patch this time. Today I've submitted another bug report (related to PV deletion on CSI controller) which they'll likely fix soon as well because it's easy to hit.

This approach is now proven because my SANtricity patch to 1.13.1 reached "PVC bound" within less than 72 hours after upstream release. That shows this is a feasible, workable approach.

IBM Block CSI with SANtricity Patch 1.13.1 in action with NVMe/RoCE (EF600):

![IBM Block CSI with SANtricity Patch 1.13.1](/assets/images/ibm_block_driver_for_santricity_03_1-13-1.png)

Patched 1.13.1 code was published in the usual `santricity` (default) branch once testing has been done as per the second link below:

- Documentation for [IBM Block CSI 1.13.1](https://www.ibm.com/docs/en/stg-block-csi-driver/1.13.1)
- Documentation for [IBM Block CSI with SANtricity Patch 1.13.1](https://github.com/scaleoutsean/ibm-block-csi-driver/tree/santricity/santricity)
  - [Note on avoiding driver name conflict](https://github.com/scaleoutsean/ibm-block-csi-driver/tree/santricity/deploy/santricity-solidfire) (if you already use IBM's driver in the same Kubernetes cluster)
