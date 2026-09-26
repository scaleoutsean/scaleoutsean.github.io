# E-Series Perf Analyzer (EPA) v3.3.0

What's new in EPA v3.3.0

- [Introduction](#introduction)
- [Power](#power)
- [Temperature](#temperature)
- [What does V3.3.0 do for expansion shelves?](#what-does-v330-do-for-expansion-shelves)
- [What's next for EPA?](#whats-next-for-epa)
  - [Database](#database)
  - [Grafana](#grafana)
  - [Other wish-list items](#other-wish-list-items)

## Introduction

My fork of E-Series Perf Analyzer (EPA) may soon see another release, v3.3.0. The changes are already in `master` branch, but I need to do some testing before I release.

What's new? 

Really just two things. The collector now collects:

- Total power consumption of the controller shelf
- Environmental sensors' readings in the controller shelf

## Power

E/EF Series (usually) have two working PSUs.

I didn't see a point in gathering each individually, so I just add them up into one. 

On today's entry-level (E2800, EF300) arrays you may see something like 130W per PSU.

On EF570, I usually see 410W. You may be interested in what happens when... I don't know. I did't look except this one case:

- 100% read workload at 1.1 GB/s
- Total PSU wattage goes up 5W

![Power consumption grows with workload](/assets/images/epa-330-01-power-psu-reading-example.png)

Other interesting details:

- Performance metrics seem to lag behind PSU metrics
- Performance was way lower than 1 GB/s

Both of these statements are false. Performance metrics don't lag, but *average* metrics do.

SANtricity OS has point-in-time metrics but I'm sure they vary wildly, so any point-in-time reading is probably highly inaccurate and requires averaging.

Like most storage arrays, E-Series averages recent metrics on the array and that's what we gather in EPA as well - the so called "analyzed" volume metrics. 

So, what happens here is it takes some time for "analyzed" volume performance to start reflecting recent performance. 

Secondly, if a performance burst lasts less than the averaging interval (say, my test runs 3 minutes and performance is averaged over 5), only 40% of my throughput may be reflected in the reading. 

To precisely capture bursty workloads we'd have to sample every second or 5 seconds, which would be very hard for hundreds of disks and volumes. So we don't. 

So, sustained/stable workloads are reflected in performance metrics, and bursty workloads not fully. But bursty may also be absorbed by cache, whether on the client or array, and we don't necessarily need to worry about them.

For PSU readings, one interesting part is they come from "hardware side of the house" and I assume they are near real-time.

## Temperature

That's another interesting one.

I avoid using any "insider" info to gather and interpret metrics because as Open Source project EPA is not supposed to require non-transparent interpretation of what something might mean.

The API call to a dual controller EF570 array returns 6 values. I don't know if this applies to all arrays or not. I also don't know if sensors are named the same.

To keep things simple I only asked in public (NetApp Community) how to interpret them and was told they represent CPU temperature, inlet temperature, and overall temperature "goodness" (where 128 is OK, anything else isn't).

All right, so we can draw the first two (four curves for two controllers) in one chart, and the last two can be mapped to "Good or Crap" (on the right).

![Six sensors](/assets/images/epa-330-02-environmental-temp-sensor-reading-example.png)

Like PSU readings, these aren't particularly useful in terms of performance monitoring, but if equipment is both busy or insufficiently cooled we can use this to notify us when workloads must be stopped or some equipment shut down.

## What does V3.3.0 do for expansion shelves?

Nothing.

I don't know what the API returns for those. I assume PSU readings are still there, but can't count on the response being identical.

I also don't know if expansion shelves have the same number of sensors or not, and what each might mean.

So for now I'm not even trying to do something about expansion shelves. 

Maybe, if I get a chance to access E-Series with expansion shelves or someone submits a pull request to add that, it can be added in a future version.

## What's next for EPA?

I've no firm plans at this time, but I've been thinking about the following categories.

### Database

As some of you know InfluxDB v1 is kind of old, but it's widely used and still maintained (although updates have slowed down).

I've been toying with the idea to update to InfluxDB v2 just so that I use the more actively maintained version. But it'd gain me nothing.

Another idea was to change to Elasticsearch 8, so that there's one place for logs and performance metrics. But I'd have to redo all dashboards, maybe in Kibana. Also too much trouble.

Then in September came the big news from Influx Data: InfluxDB v3 OSS will be compatible with InfluxDB v1, and it will be released in 2024. Perfect! 

That may still require some work in Grafana, but it could potentially even allow in-place upgrades so that users can keep their historic data.

### Grafana

Grafana 8 OSS is old and the last security update was 12 months ago, in [November 2022](https://grafana.com/grafana/download/8.5.15?edition=oss).

EPA doesn't *depend* on Grafana and even latest Grafana 10 works with InfluxDB v1, but EPA's ready-made dashboards were created for Grafana 8, so users who don't use stand-alone EPA need to continue using Grafana 8.

I don't want to be in dashboarding business, so I'm not going to try to update Grafana deployment scripts in EPA to use Grafana 9 or 10. 

Users could give it a try - deploy Grafana 8, then upgrade container to version 9 or 10 and see if dashboards work fine or not. Or, those who are good at Grafana could just fix or recreate the dashboards.

In 2024 InfluxDB v3 OSS will come out and then we'll see if Grafana 10 works well with it. If it does, then I may look into refreshing and fixing the dashboards, as well as creating a simpler installer that no longer uses Ansible.

### Other wish-list items

As far as performance is concerned, EPA already collects everything I care about. 

I'm interested in manageability metrics - something along the lines of what I already built [here](/2023/10/29/consistency-group-monitoring-in-eseries.html#consistency-group-sensor-for-prtg) - but EPA has been focused on performance so I won't rush adding these "manageability" metrics unless I encounter a real-life user who can benefit from them. 

I still think manageability is better served by gathering logs and events in one place and Splunk or Elasticsearch are better solutions for that. And, by the way, [NetApp SANtricity Performance App for Splunk Enterprise](https://splunkbase.splunk.com/app/1932) is dated but with small updates solves the problem for Splunk Enterprise users. The one thing this does and EPA doesn't is capacity-related metrics.
