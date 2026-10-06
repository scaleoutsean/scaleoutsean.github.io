# Gathering and forwarding E-Series SANtricity Major Event Log (MEL)

Forward SANtricity events to a remote syslog server and then Elasticsearch

E-Series Performance Analyzer (EPA) v3.0.0 collects MEL (Major Event Log) events and send them to InfluxDB. I think SANtricity syslog events have similar information but I haven't yet observed them in that context.

## MEL (Major Event Log)

To get MEL events from the SANtricity API we query the API:

```sh
curl -X GET \
  "https://${API_IP}:8443/devmgr/v2/storage-systems/${SYSID}/mel-events?startSequenceNumber=-1&count=100&critical=false&includeDebug=false" \
  -H  "accept: application/json"
```

Where:

- startSequenceNumber - `-1` from the beginning
- count - number of events (max = 8192)
- critical - include critical only
- includeDebug - include debug info

EPA v3.0.0 gathers MEL information the same way.

In E-Series Performance Analyzer MEL collection is also enabled by default and sent to console with `--showMELMetrics`. MEL details - if any - are displayed in a table in System View Dashboard (EPA v3.0.0):

![Mel events in an EPA v3.0.0 table](/assets/images/santricity-syslog-mel-01.png)

The System Failures table (to the right) is currently empty. If the MPIO failure mentioned earlier was present but unresolved, it would be shown in that table.

MEL table in the screenshot contains non-critical events, including Link Down events and multiple failed attempts to authenticate against the SANtricity API or Web UI which resulted in a lockout (600 seconds with SANtricity 11.74). (Funny fact: if this (wrong password provided in docker-compose.yml) happens to EPA's collector script, you won't see this chart because nothing will be sent to Influx DB or visible in Grafana.)

The EPA's System dashboard doesn't let us search MEL events. 

For that and other reasons it would be better to send MEL data to an indexed document database such as Elasticsearch. EPA v3.0.0 supports only InfluxDB v1 but Elasticsearch supports syslog, so the easiest alternative to gathering MEL data without writing new code or modifying EPA is to [forward SANtricity logs to a syslog server](/2022/12/12/eseries-syslog-forwarding.html). 

The second easiest option is to improve EPA and optionally send MEL to Elasticsearch instead, or also to Elasticsearch (in addition to InfluxDB v1).

## Failures

Failure Discovered / Failure Resolved entries are different from MEL. The Systems dashboard has controls which can display discovered, resolved, or 
both types of failures.

This screenshot shows an MPIO-related failure.

![Failure in System dashboard](/assets/images/santricity-syslog-failure-01.png)

Edit: later I tested some other things and confirmed additional behavior of this feature. System failures such as this one appear in the System Failures table:

![System Failures](/assets/images/santricity-syslog-failure-02.png)

They're also overlaid on charts (red line).

![Discovered failure](/assets/images/santricity-syslog-failure-04.png)

Failures resolved are overlaid as well (green line).

![Resolved failure](/assets/images/santricity-syslog-failure-03.png)

What was the problem that caused it? I used the SANtricity API to create a very thin volume.

![Over-provisioned thin volume](/assets/images/santricity-syslog-failure-05.png)

## Summary

- Failures: `/devmgr/v2/storage-systems/{system-id}/failures` and EPA v3.0.0 tags these with `failures`
- MEL: `/devmgr/v2/storage-systems/{system-id}/mel-events` and EPA v3.0.0 tags these with `major_event_log`
  - New MEL events: `/devmgr/v2/storage-systems/{system-id}/mel-events/available`

## Appendix A: MEL for Automatic Load Balancing (ALB)
 
The [ALB TR](https://www.netapp.com/pdf.html?item=/media/17144-tr4737.pdf) (TR-4737) is an example of the joys of PDFs. Because it's a PDF and because the events are given in a user-hostile form, I had to manually copy-paste each to make use of the list. Yeah, maybe I could have used an AI, but maybe also this should have been available in the JSON or markdown format on Github in the first place.

```raw
event,event_id
MEL_EV_LOAD_BALANCING_VD_TRANSFER,0x2044
MEL_EV_IMPLICIT_FAILBACK_VD_TRANSFER,0x2049
MEL_EV_IMPLICIT_WORKLOAD_VD_TRANSFER,0x204A 
MEL_EV_ALB_OPTIMIZATION_CONSIDERED,0x9104
MEL_EV_ALB_OPTIMIZATION_PERFORMED,0x9105
MEL_EV_ALB_OPTIMIZATION_EVALUATED,0x9106
MEL_EV_AUTO_LOAD_BALANCE_ENABLED,0x9100
MEL_EV_AUTO_LOAD_BALANCE_DISABLED,0x9101
MEL_EV_HOST_CONNECTIVITY_REPORTING_DISABLED,0x9107
MEL_EV_HOST_CONNECTIVITY_REPORTING_ENABLED,0x9108
MEL_EV_HOST_REDUNDANCY_LOST,0x9102
MEL_EV_MULTIPATH_CONFIG_ERROR,0x9103
```
