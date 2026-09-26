# VMware license calculator for VVF and VCF

VMware license options for NetApp HCI users in 2024

- [Introduction](#introduction)
- [VMware's calculator (KB 96426)](#vmwares-calculator-kb-96426)
- [Example for NetApp HCI](#example-for-netapp-hci)
- [Conclusion](#conclusion)

## Introduction

[Recently I blogged](/2024/02/07/migrate-netapp-hci-from-vmware.html#challenges-with-vsphere-8-on-netapp-hci) about how NetApp HCI customers can migrate from VMware. As I mentioned in that post, more NetApp HCI users appear to be interested in continuing to use vSphere (either 7 or 8), than in migrating to something else.

NetApp didn't (re)sell VMware licenses, so all users out there have regular retail licenses for vSphere. If you're on Gen 2 hardware and (see the earlier post) can and want to use vSphere 8, your main options include VMware Cloud Foundation, VMware vSphere Foundation.

Even users of vSphere 7 may need to extend they maintenance and support, so they may be interested in their options as well - especially if they're on Gen 1 compute nodes.

Smaller vSphere clusters can also consider [other vSphere licenses](https://blogs.vmware.com/cloud-foundation/2024/01/22/vmware-end-of-availability-of-perpetual-licensing-and-saas-services/).

## VMware's calculator (KB 96426)

Get it [here](https://kb.vmware.com/s/article/96426), together with the instructions.

Note that the files (sample input file and the script) are in the top right corner.

## Example for NetApp HCI

The main thing here is NetApp HCI clusters aren't vSAN clusters, so `VSAN_ENABLED_CLUSTER` should be a `No`.

The second thing is NetApp HCI's storage nodes are SolidFire (which runs Element OS),so don't count those in `NUMBER_OF_HOSTS`.

Example:

- Two HCI clusters; the first has 5 compute (ESXi) nodes (e.g. PROD) and the second 3 compute nodes (e.g. DR site)
- `NUMBER_OF_CPU_SOCKETS` is consistently 2 on all NetApp HCI nodes from Gen 2
- `NUMBER_OF_CPU_CORES_PER_SOCKET` - I randomly picked 18; there are different models so you need to find your count by yourself
- Gen 1 (see [here](/2024/02/07/migrate-netapp-hci-from-vmware.html#challenges-with-vsphere-8-on-netapp-hci))

My hci.csv (input file in the CSV format):

```raw
CLUSTER_NAME,   NUMBER_OF_HOSTS,    NUMBER_OF_CPU_SOCKETS,  NUMBER_OF_CPU_CORES_PER_SOCKET, VSAN_ENABLED_CLUSTER,   TOTAL_RAW_VSAN_TIB
HCI1,5,2,18, No,0
HCI2,3,2,18, No,0

```

If you have a vSphere clusters with 2 or 3 different CPU models, create multiple rows for such clusters (e.g. HCI1_8C, HCI2_12c).

Now run the script from that KB article with pwsh (PowerShell), or change the file extension to `.ps1` and make it executable. 

For me `-InputFile` didn't work, but I was prompted to enter it manually (hci.csv, which was in the same directory) and I picked the VVF option. The result:

```raw

Calculator Results for VMware vSphere Foundation (VVF):

Required VVF Compute Licenses Per Cluster

CLUSTER NUM_HOSTS NUM_CPU_SOCKETS_PER_HOST NUM_CPU_CORES_PER_SOCKET FOUNDATION_LICENSE_CORE_COUNT
------- --------- ------------------------ ------------------------ -----------------------------
HCI1    5                                2                       18                           180
HCI2    3                                2                       18                           108

Total Required VVF Compute Licenses: 288
Total Required vSAN Add-on Licenses: 

```

Well, this wasn't complicated. We could have done that manually as well - for HCI1: 5 x 2 x 18 = 180 vCPU.

But if you have several clusters, some of which may have non-NetApp HCI compute nodes with different core count, then it can become less trivial. 

## Conclusion

That VMware PowerShell license calculator may be useful for users with multiple clusters.

Users of small (2-3 compute nodes) vSphere clusters on NetApp HCI can consider not just VVF or VCF, but also a lower-cost license (such as vSphere Essentials Plus Kit) that may be cheaper but still get vSphere High Availability (HA), vMotion, and vSphere Distributed Switch's (VDS). 

You may need to "downgrade" from vSphere Standard (or whatever you may have now) and some features may need to be disabled or removed prior to that. Please consult your VMware partner or the VMware Web site about VMware products and licensing options.
