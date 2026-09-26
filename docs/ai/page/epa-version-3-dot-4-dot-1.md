# EPA version 3.4.1

E-Series Performance Analyzer v3.4.1

## What's new in EPA v3.4.1

3.4.0 was released days ago but based on user feedback this week, two micro-features have been added in version 3.4.1.

### Include metrics

If you don't need all of the metrics that EPA 3 collects, you can specify just a subset and keep your InfluxDB v1 "thin".

Running `collector.py --include temp power` would store only temperature and power metrics. It still collects the rest, but discards them because what we normally collect once every minute is not a lot.

### Group disks by volume grouping (RAID or DDP or None)

Physical disks are tagged with their volume group if they are part of any.

![EPA 3.4.1 - disk's volume group tag](/assets/images/epa_341_disk_volume_group_tag.png)

Then, when we view the little suckers in Grafana (Disk View), we can show only the disks that belong to a group.

Some disks may have neither RAID or DDP and consequently they won't be tagged.

(It bothers me that some measurement names are in plural and some singular. I just looked and [originally they were in singular](https://github.com/NetApp/eseries-perf-analyzer/tree/master/plugins/eseries_monitoring/dashboards), so along the way I've changed some in the collector code, but not consistently. And I didn't care much about the dashboards, so I didn't change those. Unfortunately I've almost finished version 4 by now, so I won't touch that for time being.)

## Stacks

### Rants vs. reality

There's a seemingly self-contradiction in my rants against "stacks" and the effort related to create them.

[Here I ranted against stacks](/2025/05/23/beegfs-data-pipeline.html#road-to-bloat). But then here when it's my own, I feel like it's not just "copy-pasting stuff to Docker Compose". So, which is it?

Integration does require potentially value added work which may or may not be trivial, but my rant was against bloat-by-default - bloating one's stack with unnecessary but mandatory additions (see the rant link for additional context). A Dell blogger [recently blogged](https://www.dell.com/en-us/blog/dell-leading-the-future-of-ai-data-platforms/) about that, too. 

- One of EPA's primary objectives is "CLI first". It's been that way since I forked it. That means you don't have to use my EPA stack. If EPA was delivered as closed source (or under a stupid OSS license like GPL 3.0) or packaged only for containers, then it could be labeled as bloat
- InfluxDB v1 was included in the NetApp's EPA, which I forked, so it was already there by the time I laid my hands on it. As I've just said, I added CLI to enable easy "de-stacking". And InfluxDB 3 Core defaults to HTTP, which is extremely relevant in EPA 4 (EPA 3 uses InfluxDB 3), which is "secure by design" (see my post on EPA 4 Beta), so I absolutely need to have it in *that* EPA stack in for EPA version 4, so that it can be deployed in a secure way
- As another example of de-stacking, I have removed Grafana from both SFC and EPA 4 because I see it as unessential

So I think my rant was justified and doesn't apply to my "EPA Stack". There's no tight coupling and everything that can be removed has been removed.

### Where's the value, Kenneth?

Another observation I want to make is about OSS. Since InfluxDB 3 Core Alpha became available, [I evaluated it promptly](/2025/01/24/influxdb-3-core-alpha), but did not rush to integrate [SFC Collector](2025/06/18/sfc-2-dot-1) and EPA with it. That was in part because I was busy, in part because I didn't like how some things worked and wanted to wait until it's more stable. 

Even as InfluxDB 3 Core GA-ed, it still had problems, especially for my work on [EPA 4](2025/08/11/epa-4-beta) which is currently in `develop` branch of the EPA repository, just not with InfluxDB and the rest of the stack (InfluxDB Explorer, etc.). 

I've submitted the following bugs to InfluxDB - some have been accepted, some not - which goes to show that some value is being added as it seems not many people have been using InfluxDB 3 in similar way, which may be why these issues hadn't been reported before. 

- [Add --https-bind for HTTPS-only connections on a different port](https://github.com/influxdata/influxdb/issues/26263)
- [Ambiguous error messages for invalid --tls-cert and --tls-key](https://github.com/influxdata/influxdb/issues/26726)
- [Document or fix TLS CA for InfluxDB 3 server](https://github.com/influxdata/influxdb/issues/26727)
- [Undocumented port binding with --admin-token-recovery-http-bind](https://github.com/influxdata/influxdb/issues/26750)

The next person who tries to use InfluxDB 3 Core the same way won't need to spend as much time and effort on figuring these out. In some cases because the documentation is already better, in others because InfluxDB logging is better or some function improved.

Contributions to OSS can be made through issues, not just code.

Stack or not, useful work has been done.
