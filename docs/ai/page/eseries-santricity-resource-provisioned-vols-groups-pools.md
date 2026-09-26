# Resource Provisioning on E-Series SANtricity

To resource-provision or not?

## Introduction

What the heck is "resource provisioning" (or RP, for short) on SANtricity?

From [the documentation](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/faq-pools-volume-groups.html#what-is-resource-provisioning-capable):

> Resource Provisioning is a feature available in the EF300 and EF600 storage arrays, which allows volumes to be put in use immediately with no background initialization process.

This doesn't mean that non-RP volumes are allocated before a volume is available - it's just that their allocation happens on-demand. See [this post](/2021/07/06/e-series-ddp-expansion-and-rebalancing.html) about background allocation with non-RP volumes: it shows how non-RP volumes are available right away, but all stripes are pre-emptively initialized in the background.

Here's how it looks like when RP is enabled on a group or pool (with supported flash media):

![Resource Provisioned DDP in action](/assets/images/eseries-santricity-resource-provisioned-01-dg-dpp.png)

Let's check out some other, more or less obvious details.

## Hosts

RP is seemingly unrelated to what hosts (storage clients) do, but that's not correct. From the documentation link above:

> In addition, hosts can deallocate logical blocks in the volume using the NVMe Dataset Management command or the SCSI Unmap command. 

Additionally, unused space in RP volumes can be "deallocated" by hosts' `unmap` (iSCSI) or NVMe Dataset Management (NVMe) commands. This then makes empty stripes accessible for wear levelling (see about under-provisioning) which is helpful if you cut corners and don't [under-provision](/2023/01/17/eseries-ssd-overprovisioning.html) enough.

## How much does it cost?

RP isn't free. The NetApp [TR-4800](https://www.netapp.com/media/17009-tr4800.pdf) discussess these on page 15 (in current version). 

From the TR:

> A resource-provisioned volume is a thick volume in an SSD volume group or pool where drive capacity is allocated (assigned to the volume) when the volume is created, but the drive blocks are deallocated (unmapped). 

So there you have it. If you give someone a 10TB volume, they may whine about "slower than expected" performance. 

The EF[3,6]00 arrays don't support Thin Provisioning, which means a DG (I prefer Disk Group over Volume Group, as a volume group can have no volumes or just one volume, but always has more than one disk so it is in fact considered a *group*) or pool can't gradually allocate drive blocks on demand. It's an all (non-RP, in background) or nothing (RP allocation-on-demand) approach to initial disk space allocation at creation.

The user doesn't have to wait either way, but there are trade-offs. From the TR:

> For random write workloads, the first write to each stripe has higher latency because the partial stripe writes are turned into a full-stripe operation.

![Resource Provisioned Volume in action](/assets/images/eseries-santricity-resource-provisioned-02-volume.png)

Roughly speaking:
- if you like "super-consistent" performance, disable RP on a volume and suffer a bit until blocks are allocated in background
- if you didn't under-provision enough and have >1 DWPD and/or don't mind the slight loss of performance on initial writes to a stripe, enable RP
  - if you additionally enable `unmap` or its NVMe equivalent, the RP allocation will happen regularly on repated allocation of unmapped volume regions (and physical disk regions RAID or DDP writes to)

A semi-extreme database example:

- Enable RP on the pool to be able to use RP (default with SSDs in EF600/EF300)
- Enable RP on table volumes - just-in-time allocation is fine here
- Enable RP on index volumes - more or less the same as with tables
- Disable RP on log volumes - avoid slower first write
- Enable RP on dump volume - here writes are sequential and infrequent

In the extreme case, you'd disable RP on all DB volumes. Probably 90% of all database users could leave it enabled across the board.

## What if...

This stuff isn't exposed (or at least not obviously) in the Web UI, so here are some common ideas and recipes for the other other UI (Swagger).

**... you want a mix of Resource Provision enabled and disabled volumes** in a DG/DDP, then the DG/DDP must be Resource Provisioned. You then must individually disable Resource Provisioning on the volumes that shouldn't use it. This is done by setting the `hostUnmapEnabled=False` (`POST /storage-systems/{system-id}/volumes/{volume-id}`).

**... you want all the volumes in a VG/DPP have Resource Provisioning disabled**, then Resource Provisioning should be disabled at that level (`POST to /storage-systems/{system-id}/storage-pools/{storage-pool-id}/full-provisioning-format` and set the `disableDulbe=True` to prevent auto-RPing. After this is done, the DP/VG, all existing volumes in the DP/VG, and newly created volumes in the DP/VG will have Resource Provisioning disabled.

**... the VG/DPP has not been created and you only want volumes without Resource Provisioning on it**, disable Resource Provisioning for with `POST /storage-systems/{system-id}/settings` - set `enableResourceProvisionedVolumes=False`. DP/VG created *after* this setting is changed will have Resource Provisioning disabled as will all volumes created in them. This field will not affect existing volumes or DP/VG or new volumes created on existing DP/VG.

## Summary

(The confusingly named) Resource Provisioning eliminates the initial background churn after provisioning, but user pays for it through slower performance on first random write to each yet-to-be-allocated-on-disk (or de-alocated) stripe. RP has benefits benefits for flash media (wear leveling), so it is recommended to keep it enabled unless you absolutely need random writes to run at full speed on Day 2 and beyond. 

RP management is easier to do in the API. The API for RP isn't very intuitive (there are multiple endpoints, inconsistent keys), but if you find it in one place (such as a blog post), it makes sense.

The RP "penalty" isn't high and may not be apparent to most users. It is observable in repated consecutive runs of `fio` (random write and re-write) on a new volume, for example, but to 99% of users waits for background churn will be more obvious than the slightly slower performance of freshly created RP volumes or nightly unmap runs.
