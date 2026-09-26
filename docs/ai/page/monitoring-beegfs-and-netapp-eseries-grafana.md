# BeeGFS and NetApp E-Series metrics in InfluxDB v2 or Prometheus

Send BeeGFS monitoring data into InfluxDB v2 or NetApp Cloud Insights

**NOTE**: Since BeeGFS v7.3.3 there's an improved and self-contained monitoring package. There's no need to use this approach on BeeGFS v7.3.3 and beyond. See [the docs](https://doc.beegfs.io/7.3.3/advanced_topics/mon.html#mon).

NetApp has a BeeGFS [solution](https://docs.netapp.com/us-en/beegfs/index.html) which consists of ThinqParQ BeeGFS and NetApp E-Series arrays. Servers that run BeeGFS are purchased separately from one of customer's preferred server vendors.

These configurations usually have a cluster of BeeGFS servers connected to one or more E-Series arrays. BeeGFS servers and E-Series arrays are usually designed and deployed as "pods" in which there's two industry-standard servers connected to one or two E-Series arrays. These server pairs split their workload and act as failover target for services runing on the other server. 

As always in these environments, usually we want to monitor at least the main service (BeeGFS-related services), but if possible also some of key hardware and services running underneath BeeGFS-related services.

- Install InfluxDB v2 (any way you want, but you can also follow [these](/2022/08/11/nomad-pack-influxdb-beegfs.html) steps if you're a Hashicorp Nomad user)
- Configure beegfs-mon to send BeeGFS 7.3 metrics to InfluxDB v2, or make them scrape-able from Prometheus
- Configure monitors for storage (E-Series), network adapters/switches, and server hardware (depening on which server brand you use)

## beegfs-mon to InfluxDB v2

If you have NetApp E-Series, you may want to check out [this](https://github.com/NetApp/eseries-perf-analyzer) Github project, which does everything for you, but note that this uses the older [InfluxDB v1.x](https://github.com/NetApp/eseries-perf-analyzer/blob/06f7103d1af21f49400ba1609b5a81316f7d7b13/influxdb/Dockerfile#L1). 

In my approach I send BeeGFS metrics to Telegraf and from Telegraf to Influx v2:

![Monitoring BeeGFS with InfluxDB on BeeGFS](/assets/images/nomad-pack-influxdb-beegfs-08.png)

What you see is a screenshot of InfluxDB v2 with data from BeeGFS 7.3.0, but without ready-made BeeGFS Grafana dashboards (why, because I don't have Grafana installed yet).

## beegfs-mon to Prometheus

In order to get beegfs-mon metrics to Prometheus, we need to convert bgfs-mon's InfluxDB feed into a format that's "scrape-able" or can be imported by Prometheus. I'm not sure about advantages and disadvantages of various approaches, but after some experimenting I managed to get this to work (at least to an extent) using Prometheus InfluxDB exporter:

![Scraping beegfs-mon](/assets/images/nomad-pack-influxdb-beegfs-09.png)

Example of data scraped from a Prometheus endpoint in the text format:

```raw
# HELP highResStorage_workRequests InfluxDB Metric
# TYPE highResStorage_workRequests untyped
highResStorage_workRequests{nodeID="b3-8003",nodeNumID="1"} 3
```

It is also possible to output InfluxDB v2 to a file and scrape it from Prometheus, or use other round-about ways that I haven't tested or may not be aware of.

## Dashboards

InfluxDB v2 users should probably use Flux to query data and create your own dashboards. First use sample queries to see what's in there.

![Visualizing beegfs-mon data in InfluxDB](/assets/images/nomad-pack-influxdb-beegfs-10.png)

Then narrow it down to your measurement of interest.

![Visualizing beegfs-mon highResMeta with Flux](/assets/images/nomad-pack-influxdb-beegfs-11.png)

What to show, and how, are very important questions. I haven't looked at how others do it, but I'd go with something like this:

- Responsiveness
- Workload (separate metadata and data, some aggregate, some broken down by node or client)
- Capacity
- Another panel with advanced metrics that you normally don't need to look at unless there's as problem
- Overlay and mix with BeeGFS server/client, network and E-Series metrics where that helps (not shown)

![Example of a beegfs-mon InfluxDB/Flux visualization in Grafana](/assets/images/nomad-pack-influxdb-beegfs-12.png)

## Conclusion

Despite beegfs-mon's support for only InfluxDB v1, everything appears to work fine with InfluxDB v2.

Even if you have parts of your cluster environment (maybe server, network or E-Series) that still use InfluxDB v1, you can send BeeGFS metrics to InfluxDB v2 and get the advantages of InfluxDB v2. Obviously, check for any *disadvantages* as well before you make that decision.

I haven't tested it, but I think this approach with InfluxDB v2 can be used to send BeeGFS performance metrics to NetApp Cloud Insights, if you prefer to use a cloud-based monitoring service.
