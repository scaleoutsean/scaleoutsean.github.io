# DDP capacity splitter for E-Series

Estimate share of R1- and R6-style volumes in a DDP pool

**NOTE**: the Web site with this tool was improved and updated on 2024/04/19, so some details below may differ from current functionality

Since mid 2022 it's possible to create smaller DDPs (Dynamic Disk Pools) on SSD-based E-Series arrays. I blogged about it [here](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html).

As mentioned in that post, the DDP improvement (the ability to use 8-10 disks) is still available only via the SANtricity API and not in the Web UI. 

The official NetApp sizing tools for E-Series can't yet calculate the split between RAID 1-like and RAID 6-like volumes created within a DDP.

[DDP Capacity Splitter](https://econfig.pages.dev/nvme) lets you do that and it also lets you guesstimate the effect of additional over-provisioning that may be required for unusually write-heavy workloads.

![DDP Splitter](/assets/images/ddpsplitter-01.png)
