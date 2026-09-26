# What is new in E-Series Perf Analyzer v3.5.4

What's new in E-Series Perf Analyzer v3.5.4

## Introduction

E-Series Performance Analyzer was updated to [v3.5.4](https://github.com/scaleoutsean/eseries-perf-analyzer/releases/tag/v3.5.4).

The change log in the repository has the details, but it's not very descriptive and lacks detail.

## SSD Cache

I recently wrote [my second post on SSD Cache](/2026/03/17/netapp-eseries-ssd-cache-update.html).

Due to the significant flash storage price increases in recent months, some folks have been using this feature and the new metrics have been added to help them.

You can see what they are in the second SSD Cache post.

The new dashboard simply shows that stuff.

![SSD Cache example dashboard](/assets/images/epa_354_00_ssd_cache.png)

Anyone interested in augmenting NL-SAS performance with SSDs - at least in the context of E-Series and Linux - should consider bcache and Terraform Provider SANtricity (or maybe some other automation tool) as the primary way. Windows users and the "conservative" IT users would probably prefer SANtricity SSD cache which is now a little easier to understand.

The official KB still advises to run some "diagnostic commands" on controllers over SSH to find out what's going on with SSD Cache. So this is potentially an improvement, dare I say it.

## Volume and snapshot count

These are simple, just numbers. 30 volumes, 4 snapshots - that kind of thing.

It's not much, but it may be needed by anyone who uses [Kubernetes CSI](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html) with SANtricity arrays: you have to keep an eye on volumes and snapshots, although these haven't been integrated and tested in SANtricity CSI and IBM Block CSI (with SANtricity patches), array snapshots can still be taken by bypassing CSI and integration isn't strictly necessary for one to have a snapshot or volume count problem.

vSphere, Proxmox, Hyper_V and other users may also need to keep an eye on volume and snapshot count because SANtricity maximums aren't very high. Because SANtricity's single volume performance is great (assuming backing storage pool can deliver it), it's not necessary to have many volumes, so Kubernetes and Nomad users would be the ones that could need hundreds of volumes.f

## Repository volumes capacity

This is related to snapshots and total capacity of those is collected.

We'd ideally want even more details because SANtricity snapshots [are not that great](/2026/03/21/shocking-truth-netapp-santricity-snapshot-schedules.html), but this is a start.

## Updates

Various stuff was updated, from base containers to InfluxDB and Grafana.

### InfluxDB

InfluxDB v1 is still being maintained - I absolutely love it, that's a gift that won't stop giving!

It's a minor update, but years ago when I forked EPA from NetApp some people were "concerned" about the ageing Influx DB v1. Well, it's 2026 and it's still maintained. So much for ageing.

Meanwhile, the "next gen" InfluxDB v2 has become a dead end by now.

InfluxDB v1, on the other hand, is the one that has a future - we can replace InfluxDB v1 with latest & greatest InfluxDB 3 Core even without making any changes to Collector. The only reason I haven't done it yet is InfluxDB v1 is still maintained, and works.

### Grafana

Grafana is the most visible update, in EPA v3.5.4 - from version 8 to version 12.

I generally dislike dealing with dashboards and I barely touched them since I've forked EPA, and hanging onto Grafana 8 was part of that. The other part was the assumption that many users would use own Grafana anyway, and have to work out their own dashboards for whatever version they use.

But I had to update it eventually, so it was done. Few dashboards had to be updated in minor ways, but I've done a bit of extra work there and created several new panels (including one for power and temperature). Those who run own instance of Grafana 12 should be able to simply import dashboards from the repo without having to fix them (at least not in major ways).

### SANtricity

I haven't noticed any unusual behavior with SANtricity API in version 12, but some of the fixes for EPA 3.5.3 were tested on both SANtricity 11.95 and 12.00, so whatever was fixed or added should work equally on both.

Since - as of now - SANtricity 12.00 is supported only on [EF80 and EF50](/2026/03/21/netapp-ef-series-ef80-ef50.html) - it is expected that EPA should work well with these two.

## Conclusion

A long overdue update of Grafana and SANtricity 12.00 readiness are probably the main highlights of this small release.

Personally, I'm more happy about the small fixes and refreshes, including Grafana dashboards (which simply had to be fixed because they wouldn't work properly with Grafana 12) because one has to learn of a problem to be able to fix it, and I was fortunate to see a handful. 

What's next for EPA 3? I have plenty on my plate in case you haven't noticed, but I'd like to do more related to snapshots and repositories, and migrate DB to InfluxDB 3 (which isn't hard, but all Grafana dashboards will have to be re-fixed again, so I may wait until Grafana 13 to do that).
