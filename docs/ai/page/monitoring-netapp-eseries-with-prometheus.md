# Prometheus exporter for NetApp E-Series SANtricity OS

Gather E-Series SANtricity metrics through Web Services proxy and export to Prometheus

**UPDATE (2026):** Since [3.5.3](/2026/01/21/eseries-performance-analyzer-v353.html) (enable by option) and 4.0.0 (Prometheus only), E-Series Performance Analyzer export metrics in the Prometheus format. NetApp Harvest also exports SANtricity metrics in the Prometheus format.

## NetApp E-Series Prometheus Exporter

[Recently](/2022/10/26/eseries-performance-analyzer-e-series.html) I forked E-Series Performance Analyzer ("EPA") so that it can work without SANtricity Web Services Proxy.

As mentioned in that post, EPA pushes data to the aged InfluxDB v1, so in recent days I've been thinking how to modernize that part of EPA's Collector.

That's a good thing because that's what helped me find [NetApp E-Series Prometheus exporter](https://github.com/treydock/eseries_exporter). 

I pay attention to E-Series related information so I'm surprised I didn't know about this project before. But if I didn't know I suspect 95% of other people who should know about it, don't. 

NetApp E-Series Prometheus exporter uses Web Services Proxy, so if that bothers you you can use EPA. Another minor thing with WSP in it is a bit old (version 4.20 vs. the current 5.40), but I assume it all still works fine, and you can update it on your own should you want to.

EPA gathers and sends E-Series events, which this exporter maybe doesn't do (it's written in Go, so I'm lazy to dig through the code).

I haven't used this project, but if you prefer to scrape Prometheus metrics, check it out!

## Performance monitoring choices for E-Series

Packaged performance monitoring approaches for E-Series that I'm aware of:

- E-Series Performance Analyzer v3 - pushes metrics and event logs to InfluxDB v1
- NetApp E-Series Prometheus Exporter - exports metrics for Prometheus
- NetApp Cloud Insights (NetApp's own cloud-based service, free tier with reduced retention is available) - metrics (and events?) pushed to a cloud service by an on-premises acquisition unit (VM)

I'm sure there are others, but I wanted to put the ones I know of in one place to make them easier to find.

E-Series performance metrics aren't available through SNMP (only events are), so SNMP monitoring tools can't be used to monitor performance of E-Series systems.

## Improving event log analysis with EPA and E-Series Prometheus Exporter

Since the gathering of E-Series performance metrics in the Prometheus format is a solved problem for many users (that is, those who can use WSP), it may be worthwhile to consider improving event log analysis with EPA and Elasticsearch.

This can be done relatively easily by redirecting output of EPA's MEL queries to a JSON log file, and shipping that log to Elasticsearch. MEL stands for Major Event Log (I had no idea, but I [looked it up](https://kb.netapp.com/Advice_and_Troubleshooting/Data_Infrastructure_Management/E-Series_SANtricity_Management_Software/What_is_the_Major_Event_Log)). The other part is figuring out some recipes on how to query, analyze and visualize that data.

Elasticsearch can [scrape metrics from Prometheus exporters](https://www.elastic.co/guide/en/beats/metricbeat/8.5/metricbeat-module-prometheus.html), so it is already possible to get performance metrics into Elasticsearch as long as you use Prometheus Exporter. If you take this route you can get SANtricity event logs into Elasticsearch very easily by [forwarding SANtricity system log events to Elasticsearch](/2022/12/12/monitoring-netapp-eseries-with-prometheus.html).
