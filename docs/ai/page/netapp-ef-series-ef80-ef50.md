# Highlights of NetApp EF-Series EF80 and EF50

What I find noteworthy in the new models

## Introduction

NetApp announced two EF-Series arrays, the EF50 and EF80. The data sheet may be viewed [here](https://www.netapp.com/pdf.html?item=/media/19339-ds-4082.pdf).

These may evolve over time as EF600 and EF300 have (e.g. originally they had no hybrid media capability), so this post is about the initial version with SANtricity OS 12.00.

I'm not going to "introduce" these. I'm just going to say what I think about them.

## Performance

Both the "entry level" EF50 and EF80 deliver significantly boosted performance, which is expected due to newer hardware. It's been a while since EF600 was released!

Many users don't have enough disks or workload to need that boost, but those who do (HPC, AI) will certainly appreciate it.

## Controller memory

This is one of my favorites. The faster model goes up to ... 64 GB of RAM!

![Controller RAM on EF80 and EF50](/assets/images/ef-series-ef50-ef80-controller-ram.png)

And yet, it gives over 100 GB/s in throughput and close to 5 million IOPS.

The reason I like this detail is because it is sized exactly how it's supposed to be.

I often see RFPs that require 1 TB of controller cache. And despite that, they get boxes that can't give them half as much performance with **16 times more** controller memory. Do they know something we don't? Probably not.

## Mixed QLC/TLC platform

The previous generation of EF-Series had QLC-only models, EF300C and EF600C. To be honest, I'm still trying to figure that one out.

The EF80 and EF50 undo that. Now TLC and QLC can be mixed and that is a good thing. Last week (with EF300 and EF600) it still was not.

In any case, now one can buy a system with 12 QLC disks for bulky workloads and several TLCs for workloads with small, write-heavy IO. Or 12 of each. Or many other combinations which are many and did not exist before simply because it was not possible to buy them like that.

## Storage subsystem

A major change - at least compared to EF600 and EF300 - is that large (that is, QLC) SSD disks support DDP only **and** use two DDP stripe sizes:

- less than 20 QLC disks: 128 kiB DDP strip (segment) size, 8+2 pattern (unchanged)
- 20 or more: 32 kiB DDP strip size, 16+2 pattern

That means with TLC and 20 or more disks we have `(16)x32` (512 kiB) **per stripe** (576 kiB *including* parity). That seems a bit on the low side, but it's based on research assisted with real-life data rather than my opinion, so I assume this is about right for most workloads that people usually deploy on E-Series.

If you go from 19 to 20, new stripes get skinnier. And you can't shrink those pools at that point.

Those who are sure some other configuration is better for their workload can use TLC disks or two 12-disk DDPs to max out the controller shelf capacity and continue using the old strip size.

This new approach has an unintentional benefit for something I've been evangelizing for years: RAID 1 volumes on DDP. That is still available.

The TRs say up to two DDPs can be created, but I wonder if three may be possible (3 x 8 drives) from the CLI or API.

## Host side connectivity

For some reason storage clients are called "hosts". The array is a host, and storage protocol clients are clients.

The EF600 was limited in this regard because it simply didn't have enough PCI bandwidth to support more. EF80 uses newer PCI expansion slots, new CPUs and fast interfaces, so now we can have up to six dual-ported 200G NICs for storage services.

And, just like with controller memory, this is done correctly: the EF80 has enough interfaces to extract maximum performance from the system, and not more.

The EF50 is not as good, but it's also cheaper and now the entry level model (EF50) delivers approximately the same performance as the former mainstream mid-range model (EF600). On that topic - EF80 is also called "mid-range", but it's faster than most "high-end" storage systems. And EF-Series doesn't even have a "high-end" model, so... Go figure.

Anyway, the bigger EF-Series model supports 12 x 200G ports for client connectivity.

The point isn't in the bandwidth (only a small fraction of users will need all of it), but **the ports in one specific deployment scenario**: DAS.

The valuable part of that is that it improves one of the strengths I often blog about: you can now connect a cluster of five or six compute nodes to one EF80 and that requires precisely zero dedicated storage switches.

If you follow this blog then you've seen that:

- That is perfect for modern workloads (databases, messaging, analytics) where previously - if one ignored the legacy FC protocol - the number of hosts that could be attached was much smaller
- That is perfect for virtualized and containerized workloads where one can now easily have 2,000 VMs in 7 rack units of space (5 1U servers, 1 EF80, 0 storage switches).

The FC-only interface "option" (if we can call it that) on the EF50 is puzzling. I hope that is only temporary, an "at launch" default.

## Conclusion

The ability to mix QLC and TCL and large NVMe/RoCE port count on the EF80 is the main news of this launch in my view.

The direct-attach (DAS) approach is not only preferred, but also very workable.

If one considers the usual pattern with an odd number of compute nodes, three-servers-one-EF600 switchless pods were small. It was harder to run servers at over 60% utilization, for example.

Now - with five servers per EF80 - the switchless approach covers even more, and larger, use cases without needing a dedicated storage network. Many users can avoid buying and managing storage network without losing flexibility and running servers at ~75% utilization.

You can use Ansible, Terraform and any of the CSI options to deploy and manage such "pods" or "building blocks". Ideally, have one per rack and take advantage of native software or platform or application replication, HA, or erasure coding to create rack-spanning application clusters of physically independent compute-and-storage pods.

![Terraform Provider SANtricity](/assets/images/eseries-datalake-storage-layout-03.png)

When you look at this diagram above, it's easy to see why a switchless, DAS approach is interesting.

When you use S3 as the single source of truth, E-Series delivers the rest: fast, economic and reliable block storage for databases and messaging/streaming services.

![E-Series in AI and Analytics](/assets/images/eseries-datalake-storage-layout-02.png)

If we put aside S3, what's left of major modern workloads is databases and event streaming - almost all of it compressed data written as RF2 or RF3 that shouldn't be deduplicated or stored on the same disk group (or even array, rack!) because it's *supposed* to exist as independent physical copies. That data isn't supposed to be backed up or restored from a snapshot either.

## Appendix A: Ethernet and IB connectivity for DAS attachment

There's "E-Series", too, and those models are currently more focused on workloads suitable for NL-SAS.

This chart (source: NetApp data sheet; the link is at the top) shows current EF-Series models. I marked recommended interfaces and protocols for the DAS pattern. EF600 and EF300 also come with with NL-SAS expansion shelves, if you want hybrid (NVMe SSD and NL-SAS) models.

![NetApp EF-Series data sheet](/assets/images/ef-series-models-2026-03.png)

## Appendix B: the TRs

- EF80: TR-5017 currently at https://www.netapp.com/media/161852-tr-5017-introduction-to-netapp-ef80-array.pdf
- EF50: TR-5018 currently at https://www.netapp.com/media/161736-tr-5018-introduction-to-netapp-ef50-array.pdf
