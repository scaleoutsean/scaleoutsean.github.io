# Announcing HCICollector v0.7

Announcing HCICollector v0.7

- [What's new in HCICollector v0.7](#whats-new-in-hcicollector-v07)
- [Improvements](#improvements)
- [Setbacks](#setbacks)
- [What's next for HCICollector](#whats-next-for-hcicollector)
  - [Unsolvable](#unsolvable)
  - [NetApp Trident](#netapp-trident)
- [Download HCICollector](#download-hcicollector)

## What's new in HCICollector v0.7

- Updates: base images, SolidFire SDK, Grafana, and more
- sfcollector: this is the Python script that takes care of SolidFire-related metrics. Updated SolidFire SDK for Python which supports latest and greatest NetApp SolidFire 12 (which means storage QoS histograms and other features that appeared in 11 and 12.0)
- Dashboards: many small fixes and improvements
- Other: works with VMware vSphere 7.0 (and vSphere 7.0U1), improved documentation

## Improvements

I addressed 10% of items from my wish list. Not everything is visible in the Web UI (or even sfcollector) because before I created that wish list I had to evaluate several approaches for each objective.

Here are some examples of what's visible:

![Main HCICollector dashboards](/assets/images/hcicollector-v0.7.png)

(1) Add clock. It bothered me that HCICollector screenshots didn't have time on them. Now only the "main" SolidFire cluster dashboard has it, but it's easy to add it elsewhere, make it bigger or smaller.

(2) Add links to the SolidFire UI. While there's no point in duplicating (especially for a one-man hobbyist such as myself) existing features from the SolidFire UI, *finding* the corresponding Grafana page in the SolidFire UI takes a lot of clicks. 

It doesn't take a lot of time to find the Volumes tab in the SolidFire UI, but it takes a lot of time to find Warnings, or Volumes for User ID 57, for example (because we may need need to use the filter feature). Second, some important features that the SolidFire API has are not available in the SolidFire UI (it runs on storage nodes, after all) and that was addressed in (4), below.

(3) Tighten the formula for Storage Efficiency. Broadly speaking efficiency includes Thin Provisioning (Compression x Deduplication x Thin Provisioning). But that presents challenges when we want to find the wasters: misplaced data (say someone stores 1 TB of images on a 16 TB SolidFire volume) would result in a high (16x) efficiency thanks to Thin Provisioning and that broad definition. 

Now there's Efficiency Factor (Compression x Deduplication) and Thin Provisioning is separate, which results in an Efficiency Factor of 1x for the guy who saved 1TB of images on a SolidFire volume. We an easily find such volumes and also list storage user accounts with a low efficiency (by default, less than 2x).

(4) Expose more SolidFire API features in HCICollector. This is related to the fact that the SolidFire API provides some very good information about both the hardware and services, but it wasn't available in HCICollector (maybe it wasn't implemented, or has appeared in API version 11 or 12).

Thanks to the changes in `sfcollector`, new SolidFire SDK for Python and new dashboards panels, Operations folks can now easily expose some of that information in HCICollector or their own Grafana. To wit:

![HCICollector Disk Drive and Wear Level dashboard](/assets/images/hcicollector-v0.7-cluster-drive-view.png)

These are not the only such changes. HCICollector also gathers and exposes storage QoS histogram stats (see this short [video demo](https://www.youtube.com/watch?v=9vW-PozlIUk)).

## Setbacks

The first one is related to ID vs Name dilemma. In dashboards I semi-abandoned the misleading Names and in the process introduced the hard-to use IDs. But potentially misleading is worse than hard-to-use, in my opinion, and could potentially be seen as an improvement. More on that under "Unsolvable" (below).

The second is: more data means more problems. Thanks to these changes, HCICollector v0.7 gathers more data than the previous version, so I had to trim some retention settings. But at least that's easy to customize so I hope the improvements outnumber annoyances.

## What's next for HCICollector

HCICollector v0.7 beta 1 came out in January 2020 and [at the time](https://github.com/scaleoutsean/hcicollector/blob/v0.7-beta.1/FAQ.md#what-is-the-reason-trident-was-removed-from-hcicollector) I mentioned my primary goal was to "make it easier to install and use SolidFire collector with existing monitoring infrastructure".

I didn't get much feedback regarding that, but it appears that broadly speaking there are two groups of users:

- People who use `sfcollector` to feed SolidFire metrics to their monitoring infrastructure where they visualize and analyze it based on own requirements. They don't care about dashboards, automated installation, and already have own solutions for the rest (VMware and networking). They just want `sfcollector` to work.
  - Kubernetes users who run monitoring in Kubernetes
  - Operations folks who run monitoring in VMs and don't have Kubernetes
- People who use HCICollector, usually NetApp HCI users or various smaller sites which do not have existing Grafana (or ELK, or Splunk) and want something simple that works

I had investigated InfluxDB for HCICollector v0.7 and decided against it because it meant more work, I didn't like its syntax (SQL), and I discovered the excellent [solidfire-exporter](https://github.com/mjavier2k/solidfire-exporter) which took care of this problem.

Considering my limited resources, the ubiquity of Kubernetes, and the release of SolidFire eSDS (that is SolidFire software for 3rd party storage nodes), the following approach seems reasonable going forward:

| Solution             | Use case    |
|  :---:               | :---:       |
| [solidfire-exporter](https://github.com/mjavier2k/solidfire-exporter)   | Kubernetes users |
| sfcollector          | Enterprise Operations users |

This would allow me to spend more time on `sfcollector`, the SolidFire API and the intersection of logging and monitoring (more on that under "Unsolvable"), and less on VMware and hardware.

Some ideas for `sfcollector` v0.8:

- Move from Graphite to another back-end (not InfluxDB) or add support two-three popular back-ends
- For that, I'd have to rewrite `sfcollector` and recreate all dashboards. But it's also an opportunity to move to Grafana 7 (which I tested and found to work as far as SolidFire is concerned, but HCICollector v0.7 doesn't use it because VMware dashboards would need fixing) and make more visually appealing Grafana dashboards
- Create and maintain just one container image (sfcollector) and reference dashboards for Grafana 7

### Unsolvable

One challenge and a top annoyance that I briefly [looked into](https://github.com/scaleoutsean/solidifire) last year is the need to keep record of Name-to-ID mappings for objects like Volumes and Accounts.

As explained in that repository and HCICollector v0.7 CHANGELOG, SolidFire volume names don't have to be unique which makes sense (especially now that more people use Kubernetes and realize they can't decide volume names), but it also means that names can be duplicate (Volume ID 5 and 7 both can be named "dbvol", rendering Name-based Grafana visualizations useless). Kubernetes won't do that to you, but people will.

Additionally, Names can be changed (Vol ID 5 can be named "dbvol" today and "datavol" tomorrow). Kubernetes also won't do that to you, but people will (even in a Kubernetes environment, if you clone and import a Trident volume you can end up with a duplicate volume name).

What I wanted to do in the `solidifire` repository is create a database that maps Account and Volume IDs to Names, so that we can look up a Volume or Account Name based on its ID at the specific time. It'd also help us track name changes as well as CRUD events on these objects.

With that we could show Volumes and Accounts by names, rather than by IDs (HCICollector v0.7). But then I realized it'd be a lot of work (another container, another database, more work to make use of it in Grafana 6...) and at the same time I wasn't even sure if anyone cared.

I'm not sure if this should be filed under "unsolvable", "needs no solution", or even "solved". Enterprise folks who forward SolidFire logs to Elastic, Splunk, or Graylog have this problem solved for them and would maybe prefer to send `sfcollector` metrics to the same platform. But I don't consider it fully solved because `sfcollector` currently can send metrics only to Graphite and forwarding and keeping all SolidFire logs for months or years is expensive (maybe 100 GB per month?).

This could be improved by supporting these back-ends from `sfcollector` and having a syslog filter recipe to strip out non-essential data from the SolidFire logs (and someone would have to do that work). As far as simple log forwarding is concerned, that's the easy "Part 1" (three short video demos created while I was researching this topic):

- [Splunk](https://www.youtube.com/watch?v=scRJePcTp2k)
- [Elastic](https://www.youtube.com/watch?v=lgCn3D010fY)
- [Graylog](https://www.youtube.com/watch?v=S0kOwhGfeTA)

### NetApp Trident

Since last year Trident exports its metrics. The number of SolidFire-related metrics is small, but they're available and only need to be visualized.

`solidfire-exporter` personas will no doubt create their own Trident metrics visualizations, but Operations folks not used to creating own dashboards may benefit from being able to see those in HCICollector.

## Download HCICollector

Download HCICollector v0.7: [https://github.com/scaleoutsean/hcicollector/releases/tag/v0.7](https://github.com/scaleoutsean/hcicollector/releases/tag/v0.7).
