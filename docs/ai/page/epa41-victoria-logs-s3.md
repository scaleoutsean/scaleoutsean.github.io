# New EPA 4.1 and Victoria Logs S3 tiering feature

Fixes some bad Grafana panels and makes several other small improvements. Upcoming S3 "frozen" tier in Victoria Logs helps with data retention costs if you forward SANtricity logs to it.

## EPA (E-Series Performance Analyzer) 4.1.0

EPA 4.1.0 gathers selected additional or new metrics from SANtricity 12.1, related to NVMe, RoCE, and host performance. Host performance figures are already "analyzed" i.e. averaged over minutes when we get them, but that's better than not having them at all. They let the storage administrator see how clients are doing performance-wise, which can help them with planning and troubleshooting. 

It also fixes some annoying Grafana query bugs which turned correct data into wrong information.
- For physical disks (not volumes or controllers), throughput in MB/s was wrong in Grafana.
- For physical disks, I/O latency figures were also wrong in Grafana.
- There is a fix for another Grafana bug that appeared due to the misleading Prometheus metric name (I gave it a bad name in Prometheus exporter, and did the right thing based on the misleading meaning/name, which result in incorrect Grafana metric).
- There were various minor updates including Python dependencies, SANtricity client library, and Grafana.

I spotted the Grafana bugs last month, as I had a chance to use EPA 4 with NL-SAS arrays, where the bugs were easy to spot (due to it, the latency figures Grafana was showing were fakely high). The bug summed up, instead of averaged, disk latency, so with SSD arrays that were not under stress, it was hard to see anything unusual, while the Prometheus metrics were correct... 

That's what happens in one-person projects. I don't think more than five people use EPA, but I like EPA and it works the way I want. 

EPA 4 still has less than 5,000 lines of code. The EPA 3 bloat present when I forked it from upstream has been eliminated. EPA can still run from the CLI and as `systemd` service (added after I forked it) and needs very little resources in general. I can be understood and edited by users.

There are just two direct dependencies: `requests` and Prometheus. When you update OS or container, Python (and likely `requests`) get updated with it. Prometheus exporter shares data from a read only Web site. Because of that, there are few issues and CVEs.

If you look at some other monitoring projects and see they have over 200,000 lines of code. And they keep adding log and event features. EPA, on the other hand, kicked those out in 4.0; in my view, getting rid of those things was a feature. It also significantly reduced the amount of RAM required by Collector.

## Logging 

[Victoria Logs](/2026/04/26/santricity-syslog-forward-victoria-metrics-logs.html) is recommended for logs and alerts, especially if you're one of few EPA 3 users and miss some of the events/MEL stuff removed from EPA 4.

### Victoria Logs' S3 offload feature

Victoria Logs compresses data very well, but still needs disk space. 

Next month, they're expected to release S3 offload feature. It looks similar to searchable S3 snapshots in Elasticsearch. The initial implementation will have a rigid setting and behavior where *daily* partition data older than N days are moved to S3, and can be queried off S3.
- `offload.destination` - point at S3 bucket
- `offloadPeriod` - set to number of days to retain data on Hot Tier

Partitions moved to S3 become immutable and main tiering parameters are fixed. They'll likely improve those later, but if you have a complex environment, it may be better to give it some time to improve.

For on-premises storage, [Versity S3 Gateway 1.9.0](/2026/10/15/elasticsearch-snapshot-to-vgw-eseries.html) should be compatible with this, but we also need to check if Victoria Logs tiers all partitions in one flat path (which wouldn't be good for Versity S3 Gateway).

## SANtricity 12

EPA remains the simplest and most lightweight performance metrics exporter for SANtricity. 

Kicking events and logs out of it was a great decision and Victoria Logs is recommended for that. It can be added to EPA Docker Compose stack with truly minimum RAM resources. Soon it will also lower its block storage requirements. 

The UI in SANtricity 12 was a big step back for user experience and **especially** performance monitoring. EPA is a usable and customizable alternative for out-of-box gathering of SANtricity performance metrics without unnecessary bloat and risk.
