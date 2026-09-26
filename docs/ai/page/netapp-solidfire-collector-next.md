# Towards next SolidFire Collector (SFC)

Working on SFC, a successor to HCI Collector

- [WTF is SFC?](#wtf-is-sfc)
- [Why bother when no one is using it?](#why-bother-when-no-one-is-using-it)
- [Progress so far](#progress-so-far)
- [Conclusion](#conclusion)

## WTF is SFC?

It's a niche monitoring script for NetApp SolidFire that I think originates from pre-NetApp time. Originally it consisted of a Python script for Graphite/StatsD.

At NetApp, a 3rd party vSphere monitoring plugin and Grafana were thrown in together for a Docker Compose-based all-in one NetApp HCI monitoring "community solution". A NetApp Technical Report TR-4964 ([still available here](https://www.netapp.com/media/17083-tr4694.pdf) but who knows for how long). That's when I started contributing.

Over months of occasional fiddling, I started figuring out how everything was connected and eliminated a lot of bloat from that repository. 

HCI Collector received almost no community contributions (yay!) and stalled, and after NetApp HCI disappeared, I forked the repo because I knew no one would maintain it despite its usefulness. 

Thankfully, a community member released SolidFire Exporter, a Prometheus exporter for SolidFire, which somewhat removed the need for HCI Collector. 

I released several updates for HCI Collector ([v0.7](/2021/03/08/hcicollector-v0.7.html), for example) and created templates for Kubernetes deployments. 

Since SolidFire Exporter came out I've been recommending SolidFire Exporter over HCI Collector, I've always wanted to overhaul HCICollector under the new name "SFC" with a newer back-end. I haven't done it because I knew of no one who has been using it so I kept myself busy with other projects.

## Why bother when no one is using it?

Recently I tested [Grafana 11 Preview](/2024/04/23/grafana-11-netapp-solidfire-sfc.html) because I use (older) Grafana in E-Series Performance Analyzer (InfluxDB v1 back-end) and HCICollector (Graphite back-end, as mentioned above).

As I only had SolidFire (Demo VM) at my immediate disposal, I used that opportunity to see if HCI Collector can work with Grafana 11 Preview.

After that I also used the setup to try SolidFire Backup-to-S3 with InfluxDB which can be [visualized in Grafana](/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html).

With that done I was just two steps from getting there:

- Change project name to "SFC" from "HCI Collector" (that name was always incredibly annoying to me)
- Change back-end to InfluxDB v1 (so that both EPA and SFC use the same back-end DB)

At that point the question was: why not now?

## Progress so far

I've created a new Github repository for [SFC](https://github.com/scaleoutsean/sfc). There's no new code there yet - I'm still working on "alpha" version of the new SFC described in this post.

The old HCI Collector repository was deleted because it contained a commit with some internal credentials (from 2016, committed "before my time"), but the SFC repository has last release of HCI Collector without commit history and the offending commit.

First, about some things that are hard or impossible to see in screenshots (and arguably more important):

- Changed job scheduling from one mega job with a bunch of tasks and tons of collection to separate threads with smaller tasks
- Separated threads run on separate schedules, giving the user the ability to schedule less important collection to once every hour
- Created multiple schedules allow SFC to shorten regular collection time and lowers the load on SolidFire API endpoint
- Changed backend to InfluxDB v1
- Minimized code dependencies - only SolidFire Python SDK and Requests are used; SFC has no other modules (even InfluxDB SQL is manually crafted)
- Improved code efficiency - lower the number and frequency of API calls to further shorten run time
- Got volume names (rather than IDs) into more metrics - I really hate that, as SolidFire enforces unique volume IDs but volume names can be duplicate. However, that can't be helped. Users need to pay attention to not use duplicate volume names.
- With volume names, it becomes easier to work with Kubernetes as well, as PVC names are shown and with multiple clusters with replication between them it may be easier to create meaningful panels for multi-site or multi-cluster monitoring

This should make SFC much better for people who had busy SolidFire clusters - which mostly means "clusters with many volumes":

- SFC should be able to handle SolidFire clusters with 500 volumes at 60s volume collection frequency
- SFC should be much easier to modify to selectively lessen the workload on SolidFire

There are few other tricks I can still use to improve performance, such as [this one](/2024/05/04/netapp-solidfire-with-async-http.html), caching and more.

As I mentioned in posts and FAQs related HCI Collector v0.7, I don't want to involved in vSphere metrics collection, so next release will have only SFC itself, Docker Compose and Kubernetes deployment templates (with optional InfluxDB and Grafana containers) will be retained. Folks who want vSphere collection should just add their own and use SFC for SolidFire, I believe, because SFC should be much better.

Second, let's view some obligatory alpha-quality chart pr0n.

These are just draft panels that let me see if the data is there and make sure it makes sense.

As I work on SFC I look at how much time each type of collection takes. This is to ensure I don't get overzealous collecting data.

Volume efficiency is the busiest calls one so far (4s for 32 volumes) but it doesn't need to run every minute - once an hour is enough, so it has one hour to finish.

![](/assets/images/sfc-influxdb-alpha-01-function-instrumentation.png)

That's what leads me to believe that rest of the functions (roughly 5s for 33 volumes) can take less than 60s to process 500 volumes, and should be even more if I find time to further optimize.

People who have 5 thousand volumes in their cluster could schedule those collectors to run every 10 minutes rather than every minute, or simply remove collection of data they don't need.

That panel above may be able to tell the user about potential problems before they happen, so it's going to be useful in production and not just in development and testing.

Next, I'm sticking with InfluxDB v1 and InfluxQL for a "No BS" approach. I looked at different options, but InfluxDB v1 is more than good enough.

Here's an example, my "cluster" metrics table in InfluxDB v1.

```sql
> select * from cluster limit 10
name: cluster
time                 cluster metric                    type   value
----                 ------- ------                    ----   -----
2024-05-03T06:49:50Z PROD    accounts                  tenant 12
2024-05-03T06:49:50Z PROD    activeblockspace                 15931465440
2024-05-03T06:49:50Z PROD    activesessions                   0
2024-05-03T06:49:50Z PROD    averageiops                      0
2024-05-03T06:49:50Z PROD    clusterrecentiosize              0
2024-05-03T06:49:50Z PROD    compress                         1.88
```

I've been thinking about storing certain non-cluster-related metrics into that table, and I started with that approach from the start.

All metrics without `type` tag are cluster metrics from the cluster stats API response, while metrics from other API calls are specifically called out (tenant, volume, etc.).

Since the number of accounts isn't a native cluster metric, I gather it elsewhere and tag it with `"type=tenant"`. I think that's better (and in line with my "opinionated" approach) for users as anything cluster-related ought to be here and not elsewhere.

I do that for volume metric that I store here as well. Rather than using Grafana to run complex InfluxDB (and/or Grafana transformation) queries, I just do this to get the number of tenant accounts on the cluster into InfluxDB and from Grafana there's just this simple query. 

```sql
SELECT mean("value") FROM "cluster" 
  WHERE ("cluster"::tag = 'PROD' 
  AND "metric"::tag = 'volumeCount') 
  AND $timeFilter GROUP BY time($__interval) fill(null)
```

That's one of the places I see value for SFC over simpler and straightforward metrics collection that just gets all the metrics and makes them available: doing some aggregation and analysis on collection can add value by saving time required for dashboard creation and also compute cycles.

Below, 32 is the number of volumes obtained with that query. (As you (may) know, SolidFire supports 400 in-use volumes per node (SolidFire Demo VM is limited to 100, though), so we want to keep an eye on that.)

![](/assets/images/sfc-influxdb-alpha-02-cluster-stats.png)

For a comparison, cluster deduplication ratio (0.760x) just above the volume count figure is a cluster metric. (It is lower than 1x because of relatively many snapshots, in the case you wonder why).

That query simply gets the value from cluster's "dedupe" metric.

```sql
SELECT last("value") FROM "cluster" 
  WHERE ("metric"::tag = 'dedupe') AND 
  $timeFilter GROUP BY time($__interval)
```

QoS Histograms are working as well but - like I've said before - that was never documented or evangelized properly, so figuring out what these mean is another problem (got to leave some work for an 'SFC AI Plugin')...

![](/assets/images/sfc-influxdb-alpha-03-qos-histogram-throttle-pct-and-node-metrics.png)

Below that QoS Histogram chart there's an example of node metrics (for one node, as this is a SolidFire Demo VM). 

It collects cumulative node statistics over time (so additional "change over time" queries would be needed as shown with little green % figures that show a tiny increase over panel's time interval which is last 15 minutes), except for Cluster Network Utilization and Cluster Storage Network (interface) utilization which should be current values but I haven't confirmed that as the cluster is currently idle.

In any case, it's the same as it is in HCI Collector, passed directly from the API values except where explicitly documented.

I gather other metrics the same way - with end user requirements, rather than data collection, in mind. 

These three panels below show:

- Tenant-level efficiency - to see which accounts are doing a poor job managing their volumes
- Tenant level volume count - this is in "tenants" table (called "measurement" in InfluxDB), unlike cluster-wide volume count which I have in "cluster" measurement.
- Another tenant-level efficiency - using gauges and a slightly different query

![](/assets/images/sfc-influxdb-alpha-04-tenant-level-stuff.png)

Curiously, there's a difference between the values from two efficiency queries, but I don't care about it enough to figure out why. For the user `hyperv2025`, SolidFire shows 2.7537x, so the second one is in line with that. 
 
I had to check the query and it turned out the first query showed `Last*` value i.e. an outdated value. The second query is correct.

```sql
> SELECT mean("value") FROM "tenant" 
  WHERE ("cluster"::tag = 'PROD' AND "metric"::tag = 'accountEfficiency') 
  AND $timeFilter 
  GROUP BY time($__interval), "metric"::tag, "accountName"::tag fill(null)

```

InluxDB had the correct metric as well. Whew!

```sql
> SELECT * FROM tenant LIMIT 1
name: tenant
time                 accountName cluster compress dedupe metric            value valueTP
----                 ----------- ------- -------- ------ ------            ----- -------
2024-05-03T06:49:50Z hyperv2025  PROD    2.01     1.37   accountEfficiency 2.75  12.34

```

Other metrics from HCI Collector are also collected including cluster alerts, disk information (disk wear level, disk status), etc.

Below I have 1 warning (Minimum IOPS are over-provisioned on this Demo VM), while (vSphere) disks are all online and SSD wear level is shown as 0% (because vSphere isn't reporting that).

![](/assets/images/sfc-influxdb-alpha-05-cluster-alerts-efficiency-disk-status-and-wear.png)

There's more, but the bottom line is all HCI Collector metrics for SolidFire are fully functional, take less time to collect, etc. 

Next I need to clean up the code, do performance and capacity characterization, create documentation, create Docker and Kubernetes templates, etc. and eventually push this to Github.

## Conclusion

This is more time-consuming than it seems, which is why I also gave up on creating Grafana dashboards for SFC (I create simple ones to do sanity checks). But if there's just one user out there, it will be useful to someone.

There's still a lot of work to clean up and post a beta version, but I think SFC already sucks less than before. 

It would also be a good base for additional collectors such as [backup-to-S3](/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html), once I have Docker Compose and/or Kubernetes templates ready.
