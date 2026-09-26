# Monitoring NetApp E-Series with PRTG

Use SNMP Get, SNMP traps and SANtricity API to monitor E-Series in PRTG

- [Introduction](#introduction)
- [Software stack](#software-stack)
- [Getting E-Series events and metrics into PRTG](#getting-e-series-events-and-metrics-into-prtg)
  - [Generic probes](#generic-probes)
  - [SNMP walk](#snmp-walk)
  - [SNMP traps](#snmp-traps)
  - [Custom sensor script](#custom-sensor-script)
    - [API access](#api-access)
- [Conclusion](#conclusion)
- [Appendix A - SNMP walk ("Needs Attention" status check)](#appendix-a---snmp-walk-needs-attention-status-check)
- [Appendix B - SNMP Trap Receiver sensor](#appendix-b---snmp-trap-receiver-sensor)
- [Appendix C - HTTP Push Data sensor (performance monitoring)](#appendix-c---http-push-data-sensor-performance-monitoring)
  - [Write a script for sensor](#write-a-script-for-sensor)
  - [Security in shell scripts](#security-in-shell-scripts)
- [Appendix D - Syslog receiver](#appendix-d---syslog-receiver)
- [Appendix E - SANtricity 12 and PowerShell 7](#appendix-e---santricity-12-and-powershell-7)

## Introduction

[This post](/2023/09/17/netapp-e-series-snmp-trap-notifications.html) explains how SNMP works on E-Series, so you should be able to accomplish everything you need by simply using the details from that post.

Because that post is quite long, I decided to add some screenshots and additional notes related to PRTG.

This post covers main approaches to get event and metrics data into PRTG.

When some detail in this post is missing, refer to that previous article.

## Software stack

- Windows Server 2022
- PRTG 23.3.88.1393
- E-Series SANtricity 11.80 (see **Appendix E** for latest updates)

## Getting E-Series events and metrics into PRTG

These are four main ways to do it:

- generic probes
- SNMP walk can give you one meaningful information, which is whether the array needs attention
- SNMP traps can give you precise error (event) details
- custom plugin or script can get array events and performance details into PRTG

### Generic probes

Generic probes include ping and HTTPS, for example. 

Set up one of these probes to check the controllers' IPs.

These IPs should always be reachable. When they are not, that's likely because the management network or cable got disconnected, or maybe a controller is rebooting.

The ping sensor is useful because when it fails at the same time as few others (say, L2 switch probe), it may be a sign of a network issue rather than storage issue. Then the ping alert can be ignored until network is up again.

There's also a TLS certificate checker sensor, useful for when you have proper TLS certificates deployed to E-Series controllers, and want to avoid failures when these expire and become invalid.

You don't need any E-Series-specific knowledge to setup these probes.

### SNMP walk

Here the idea is simply to GET the value of an OID that tells you when there's a problem.

To do that we simply watch `enterprises.789.1123.2.500.1.7.0` which indicates if there's a problem:

- If value is 0, do nothing
- If value is anything else, alert and notify

We can poll this OID periodically. 

When it activates, PRTG users can't see what is wrong, it can just see *something* is wrong. So after the Warning is received, the storage administrator needs to take a look at the storage system. Or, if SNMP Trap Receiver is set up, they can also (or only) use SNMP Trap Receiver to see what the MEL error is.

See Appendix A for more on this setup.

### SNMP traps

As explained in that previous post, for these you need to add a PRTG server to the list of trap recipients for the E-Series trap sender (or its forwarder). In my environment I couldn't get from SANtricity controller to my PRTG server, so I used an SNMP trap forwarder.

I want to highlight several items from the PRTG documentation:

> The sensor states of this sensor persist for one scanning interval only. After showing the Warning or the Down status, and if there is no warning or error message in the next scanning interval, the sensor shows the Up status again.

There's a way to change this in the settings (same as with my "Needs Attention" SNMP example in Appendix A), but by default it's like it says.

If you want to retain traps beyond maximum retention period of PRTG's SNMP Trap Receiver, configure E-Series Syslog redirection to also send events to something like Elasticsearch.

Filter rules exist for you to customize PRTG behavior depending on various conditions. But read my previous post (link at the top) and also see [how SNMP traps with filters are used with SolidFire](/2021/07/19/solidfire-mib-snmp-monitoring.html#snmp-traps-cluster-fault-trap-and-cluster-resolved-fault-trap-examples).

PRTG's SNMP trap filters work very similarly to this and are described [here](https://www.paessler.com/manuals/prtg/snmp_trap_receiver_sensor#filter_rules). For example, to catch the specific MEL error you could use `bindings[oid,value,mode]` mentioned at this page. 

See Appendix B for a walk-through.

### Custom sensor script

There's no official or community PRTG plugin for E-Series at this time, so the main approach would be to use "Standard and Advanced Script Sensor" which is a script that uses the SANtricity OS API.

As the name of this section suggests, this involves writing a [custom sensor script](https://www.paessler.com/manuals/prtg/additional_sensor_types_(custom_sensors)). Main approaches we can consider:

- EXE/Script - PowerShell with Write-Output to provide output to PRTG, for example
- Python Script Advanced - similar to EXE/Script
- HTTP "push" sensors (see in Appendix C)

You'd need a valid Bearer authentication token to access the SANtricity API, and that token has to be refreshed inside of, or by, your script.

There are other (especially indirect) ways to do it, but the main point to remember is: SNMP walk and/or traps from E-Series contain no performance metrics. If you want E-Series performance metrics, you need to get them from the SANtricity API or some service or file that got them from the SANtricity API.

Alternatively, consider [E-Series Performance Analyzer (EPA)](/2022/10/26/eseries-performance-analyzer-e-series.html). You can also modify EPA's source code to create a Python script for PRTG (this source code is very permissive). The other source code you could leverage is from [Centreon](/2023/09/17/netapp-e-series-snmp-trap-notifications.html#appendix-d---centreon-with-e-series).

#### API access

See the NetApp Technical Report 4736 (aka TR-4736) for more on using SANtricity Web Services API. 

Personally I would suggest to not use the SANtricity Web Services proxy; I prefer to directly access E-Series controllers' API endpoints if possible. 

Ideally in the future it will be possible to issue long-lasting bearer tokens or allow public access to read-only API methods, but until then you need to obtain them and - update the bearer token if the script doesn't automatically obtain it.

Why wouldn't the script obtain it? It can, but then it needs access to a SANtricity account and password, so if you get bearer token on the fly, setup a read-only (Monitor) type SANtricity user account.

A safer way is to use PRTG API and have another place (VM, container, etc.) where a script only obtains a fresh bearer token from SANtricity and use PRTG API or other method to deploy the token for use by the script.

Read [this page](https://www.paessler.com/manuals/prtg/custom_sensors) for additional details on writing custom scripts for PRTG.

## Conclusion

We configured an SNMP Custom String sensor on the E-Series device, and an SNMP Trap Receiver on Probe Device (PRTG server).

![](/assets/images/prtg-eseries-18-snmp-trap-receiver-sensor-location.png)

It seems this placement is flexible - each sensor could be placed on either device. 

With filters configured to trigger warnings (SNMP Trap Receiver when number of messages starts going up, and SNMP Custom String when its value is not equal to 0), issues with the array makes both sensors enter the Warning state.

![](/assets/images/prtg-eseries-19-snmp-sensors-prtg.png)

In my configuration SNMP Trap Receiver by default returns to non-Warning after one probe cycle (also PRTG default), but SNMP Custom String remains in the Warning state as long as `ssStorageNeedsAttention` is not 0.

In order to not miss warnings triggered by SNMP traps, configure SNMP Custom String sensor to remain in the Warning state as long as its value isn't 0, or configure SNMP Trap notifications to be triggered each time there's a warning (for example: a new trap event is received).

PRTG also provides Syslog Receiver sensor which works similarly to SNMP Trap Receiver sensor.

Custom scripts can be used to fetch main metrics (such as array MB/s and IOPS, for example) and send them to PRTG.

These are some screenshots from my environment at the end of this PoC.

-  E-Series is monitored via SNMP Get (basic "Needs Attention" monitor), and Custom EXE/Script sensors for System and critical Volume monitoring (later on DDP as well).

![](/assets/images/prtg-eseries-29-prtg-snmp-and-custom-senors.png)

- As multiple volumes or pools are added, they can be selected from the sensor drop-down list for the array. (As mentioned earlier, SNMP Trap Receiver sensor can't be seen here because we didn't attach it to the monitored storage array - see the notes related to SNMP Trap Receiver).

![](/assets/images/prtg-eseries-30-prtg-list-of-sensors.png)

- This DDP (pool) monitor can show some things that aren't even in the SANtricity Web UI, such as total DDP capacity expressed in [RAID1-](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html) and RAID6-style volumes. (I think most E-Series admins have no idea RAID1 volumes can be created in DDP to begin with.)

![](/assets/images/prtg-eseries-32-prtg-pool-sensor-gauge.png)

## Appendix A - SNMP walk ("Needs Attention" status check)

As usual with PRTG, you can run ome sort of discovery, such as SNMP, and add the usual sensors such as ping and HTTP(S) service check. 

![](/assets/images/prtg-eseries-01-discovery-snmp.png)

As I mentioned in the main post on E-Series SNMP,  SNMP walk won't give you almost anything useful, but ping is still useful.

![](/assets/images/prtg-eseries-02-discovery-status.png)

What we really want to do is monitor one specific OID. So, add another sensor based on SNMP.

![](/assets/images/prtg-eseries-03-add-sensors.png)

There's a bunch of them and several potential candidates are marked in this screenshot. For our "Needs Attention" purpose, we don't need a table, but just the value of one OID.

![](/assets/images/prtg-eseries-04-sensor-snmp-get.png)

We can use SNMP Basic sensor to monitor a single OID. Add SNMP Basic. Use any name you want, and use this exact OID. You may also edit other options (see further below) for the situation when the value is not 0 (which is when there is a problem).

![](/assets/images/prtg-eseries-06-snmp-sensor-add-ssStorageArrayNeedsAttention.png)

With ping, HTTP(S) to SANtricity management IP addresses, and this new SNMP monitor, you have a good idea of how E-Series is doing: with ping and HTTPS up and array needing no attention you know everything is fine.

![](/assets/images/prtg-eseries-07-snmp-sensor-ssStorageArrayNeedsAttention-status.png)

What happens if management network cables get disconnected or a controller dies?

![](/assets/images/prtg-eseries-08-warning-01.png)

Now you know it's likely a network problem. If the controller's management IP cannot even be pinged, there's no hope that SNMP queries could be OK. So PRTG pauses those other probes.

![](/assets/images/prtg-eseries-09-paused-sensors.png)

By default, a failed ping sensor pauses check of other sensors.

Notice the blue pause icon in the larger pane in the background (screenshot above). You can always configure PRTG differently (to not pause dependent sensors, that is), but then you may receive a bunch (ping, HTTP(S), SNMP) of alerts at the same time, with little value added. 

Another thing to notice is: *if* ping fails, you can still manually un-pause SNMP or HTTP(S) sensors, although it's likely they would also fail.

The next screenshot shows what happens when a controller enters Maintenance Mode:
- SANtricity Web UI will show an alert
- SNMP sensor we configured will change from 0 to 1, meaning "storage array needs attention". 

![](/assets/images/prtg-eseries-10-snmp-sensor-add-ssStorageArrayNeedsAttention-test-OK.png)

Notice that there's no alert in PRTG despite the value being `1`. This is a matter of configuration. You need to set off an alert or send some kind of notification when the value becomes `1`. 

![](/assets/images/prtg-eseries-12-snmp-sensor-ssStorageArrayNeedsAttention-raise-warning.png)

Where do we do that? In sensor settings: if the OID value isn't `0`, I want this sensor to show Warning.

![](/assets/images/prtg-eseries-13-snmp-sensor-ssStorageArrayNeedsAttention-set-warning.png)

In SNMP configuration wizard there's a check box "Trigger 'change' notification" [if value changes] which I did select, but I didn't have time to complete setting up. The PRTG [trigger documentation says](https://www.paessler.com/manuals/prtg/notification_triggers_settings#change):

> Before you set up a change trigger, make sure that you select Trigger 'change' notification in the sensor's settings, otherwise PRTG never sends the notification.... Hover over `(+)` and select Add Change Trigger from the menu to add a new change trigger...

Also worthy a mention is the behavior on recovery. As the controller is being brought online (background window), sensors start recovering from a failed state. The ping probe and SNMP in this screenshot are already OK, but HTTP(S) hasn't done a fresh check yet, so we still see a warning in PRTG.

![](/assets/images/prtg-eseries-11-snmp-sensor-ssStorageArrayNeedsAttention-recovery.png)

This shows that the default approach, in which the failure of ping causes all other sensors to be paused, is reasonable. Having extra warnings and alerts for the similar or same problem doesn't help.

Here's another view of how a failed ping sensor pauses other sensors. 

![](/assets/images/prtg-eseries-14-ping-pauses-other-sensors.png)

## Appendix B - SNMP Trap Receiver sensor

As in Appendix A, we start by adding an SNMP-based sensor, but pick SNMP Trap Receiver.

![](/assets/images/prtg-eseries-05-sensor-snmp-trap-put.png)

In SNMP Trap Receiver settings, you don't need to change anything to start receiving alerts from E-Series.

![](/assets/images/prtg-eseries-15-snmp-trap-receiver-retention.png)

Windows must let SNMP traps come in through firewall (162/UDP) to let PRTG receive traps. If PRTG is properly installed, it should already have the ability to receive SNMP Traps, but alternatively SNMP Traps may be allowed to any application as in this screenshot.

![](/assets/images/prtg-eseries-16-snmp-trap-allow-windows-firewall.png)

Next, receive SNMP traps from E-Series and look for notification type traps in this sensor, as explained in [the main E-Series SNMP post](/2023/09/17/netapp-e-series-snmp-trap-notifications.html#santricity-snmp-traps-and-trap-examples).

If you (optionally) uploaded the E-Series MIB files to PRTG (at least two: one generic, one E-Series model-specific MIB), you'll see OIDs from traps "translated", as in this screenshot (otherwise you'll see numeric OID strings).

![](/assets/images/prtg-eseries-17-snmp-trap-messages.png)

Notice the message is the **ssStorageArrayAlert NOTIFICATION-TYPE** trap from the SNMP trap section in the [main E-Series SNMP post](/2023/09/17/netapp-e-series-snmp-trap-notifications.html#e-series-specific-sm10-r3-mib-and-es-netapp).

Now that this is working, we can refine SNMP Trap Receiver sensor filters and customize alerts, notifications, etc. 

If only E-Series forwards to this SNMP Trap Receiver, everything PRTG receives would be an alert. But this can be configured - especially with filter - to represent warnings, downtime, or something else. Fine tune these filter and notifications as needed.

If we receive only SANtricity SNMP trap, then we don't have to create complex filters - we can accept "any" trap entry and count it as "Warning" if it has the word "Critical" in it:

![](/assets/images/prtg-eseries-21-snmp-trap-receiver-filter.png)

Such traps would increase the value of Warnings counter by only slightly, but that is enough. 

This is how [the PRTG documentation](https://www.paessler.com/manuals/prtg/snmp_trap_receiver_sensor) explains it:

> By default, the sensor changes to the Warning status after a scanning interval finishes and there was at least one warning message (and no error message) during this scanning interval. The sensor shows the Warning status at least until the succeeding scanning interval finishes.

I configured traps to trigger only warnings, so I just watch that one indicator. We don't care whether the value is 0.01 or 0.03 - if it's incremented at least once during an interval, it will trigger a Warning and then go back to normal in the next interval if no new traps are received. 

![](/assets/images/prtg-eseries-18-snmp-trap-receiver-sensor-chart.png)

Notifications (email, Slack, etc.) can be configured separately to fire off when triggered by the Warning status, for example. That lets you not miss traps that trigger a warning and then "disappear".

If you get rid of junk traps, your sensor won't show non-SANtricity errors. This screenshot below show an example of that, with the [MEL error code](/2023/09/17/netapp-e-series-snmp-trap-notifications.html#appendix-a---e-series-mel-codes-aka-storage-system-event-types) MEL_EV_WB_CACHING_FORCIBLY_DISABLED (0x212B).

![](/assets/images/prtg-eseries-25-snmp-trap-receiver-filtered.png)

## Appendix C - HTTP Push Data sensor (performance monitoring)

This should be enough to get you started. 

The first step is to pick an approach and a sensor. As mentioned earlier, there are many ways and "which is better" is up to you.

For this demo I picked a simple one, HTTP Push Data sensor. Please [RTFM to see what it does](https://www.paessler.com/manuals/prtg/http_push_data_sensor), but it's a custom URL (usually on PRTG system) where you can periodically submit a key-value pair.

- TLS Settings - I chose HTTP (which is the default) because I ran my probe *from* the PRTG server, so I was really using http://localhost which is secure enough for me
- the unique port (here 5050) is picked by PRTG on the fly a you Save and create the sensor. Just create the sensor and go to Settings to see what this value is
- the identification token (`F75...5A3`) is also generated on-the-fly, do not try to come up with your own string. Create the sensor and then check the value
- in other settings for this sensor I picked Any (over GET, POST) and picked float over integer (because I realized many E-Series performance metric are floats)

![](/assets/images/prtg-eseries-22-http-push-value-webhook-01.png)

All right, now we have the URL template and some values.

We need a Key-Value pair. 

In the SANtricity API there's a method `analysed-system-statistics` that returns a JSON like this. This is a "per controller" query, so you may want to do one against each controller's management IP.

```json
{
    "observedTime": "2023-09-26T06:46:40.000+00:00",
    "observedTimeInMS": "1695710800000",
    "sourceController": "070000000000000000000001",
    "readIOps": 0.0,
    "writeIOps": 0.0,
    "otherIOps": 0.0,
    "combinedIOps": 0.0,
    "readThroughput": 0.0,
    "writeThroughput": 0.0,
    "combinedThroughput": 0.0,
    "readResponseTime": 0.0,
    "readResponseTimeStdDev": 0.0,
    "writeResponseTime": 0.0,
    "writeResponseTimeStdDev": 0.0,
    "combinedResponseTime": 0.0,
    "combinedResponseTimeStdDev": 0.0,
    "averageReadOpSize": 0.0,
    "averageWriteOpSize": 0.0,
    "readOps": 0.0,
    "writeOps": 0.0,
    "readPhysicalIOps": 0.0,
    "writePhysicalIOps": 0.0,
    "storageSystemId": "600A098000XXXXXXXXXXXXXXXXXXXXXX",
    "storageSystemWWN": "600A098000XXXXXXXXXXXXXXXXXXXXXX",
    "storageSystemName": "iXXXXXXXXXXXXXXXXXXXXXX",
    "cacheHitBytesPercent": 0.0,
    "randomIosPercent": 0.0,
    "mirrorBytesPercent": 0.0,
    "fullStripeWritesBytesPercent": 0.0,
    "maxCpuUtilization": 34.0,
    "cpuAvgUtilization": 5.3742857142857146,
    "raid0BytesPercent": 0.0,
    "raid1BytesPercent": 0.0,
    "raid5BytesPercent": 0.0,
    "raid6BytesPercent": 0.0,
    "ddpBytesPercent": 0.0,
    "readHitResponseTime": 0.0,
    "readHitResponseTimeStdDev": 0.0,
    "writeHitResponseTime": 0.0,
    "writeHitResponseTimeStdDev": 0.0,
    "combinedHitResponseTime": 0.0,
    "combinedHitResponseTimeStdDev": 0.0,
    "maxPossibleBpsUnderCurrentLoad": 9.69375E10,
    "maxPossibleIopsUnderCurrentLoad": 4442968.0
}
```

I picked `"maxCpuUtilization": 34.0` for this PoC.

Now we have the complete URL.

```raw
# http://<probe_ip>:<port_number>/<token>?value=<integer_or_float>&text=<text message>
http://127.0.0.1:5050/F7584438-F08D-4172-90D4-7C33A73355A3/?value=34.0&text=maxCpuUtilization

```

Visit the URL (which is a `GET`).

![](/assets/images/prtg-eseries-23-http-push-value-webhook-02.png)

This is looking good. Let's see how the sensor page looks like now.

![](/assets/images/prtg-eseries-24-http-push-value-webhook-03.png)

Also good - max controller utilization: 34%. (cpuAvgUtilization seems more useful, but nothing prevents you from collecting more than one or, indeed, all of the KV pairs returned by the API.)

For two controllers you could create two sensors **or** you could have one script that intelligently combines values from two controllers into one sensor (which seems hard - personally, I gave up).

Because a misconfigured host or array can actually have a good average but poor balancing, it's probably better to have two sensors, one per controller, or a more complex senor that can take values from both at once.

### Write a script for sensor

If you're going to do it in PowerShell, remember that even PRTG 23 uses 32-bit PowerShell 5.1 (which, surprisingly, even Window Server 2022 has).

- Create HTTP Push Data sensors you need (one or more, but probably at least one per controller)

- Get analysed-system-statistics from either controller, c1 or c2 (results should be the same). You need a JWT or Bearer Token (see that SANtricity API technical report) to be able to access the API.

```raw
https://c1:8443/devmgr/v2/storage-systems/1/analysed-system-statistics
# https://c2:8443/devmgr/v2/storage-systems/1/analysed-system-statistics
```

- Extract KV pair(s) you need, such as cpuAvgUtilization, readIOps, writeIOps, readThroughput, writeThroughput

- Submit KV pair(s) to sensor(s) by creating per-sensor URLs on the fly (PRTG collects `stdout` from the script)

- Wait 5 minutes, repeat (done automatically by PRTG)

Remember that analysed-system-statistics are not raw. They are pre-cooked averaged metrics and collected after fixed intervals (PRTG default: 5 min), so it is only fixed and stable workloads that would reflect in PRTG (which usually lags by a few minutes, and shows averaged values). (Full stripe writes percentage (-1) isn't a bug in my script, that's the value obtained from the API; I don't know why it can be negative. Maybe it's for negative for DDP-based volumes).

![](/assets/images/prtg-eseries-31-prtg-volume-sensor-gauge.png)

If you have half a dozen performance metrics you want to track, it's easy enough to use this single-value sensor. How does one create a visualization from multiple individual sensors? You can use [Sensor Factory](https://www.paessler.com/manuals/prtg/sensor_factory_sensor) for that. It's relatively resource-intensive, but if you have 10 sensors (5 per controller) that are refreshed once every 5 minutes, a Sensor Factory dashboard refreshed every 6 minutes won't create any impact on your PRTG.

If you have a bunch of metrics (dozens) you want to collect, check out [HTTP Push Data Advanced Sensor](https://www.paessler.com/manuals/prtg/http_push_data_advanced_sensor) and other custom sensors.

Here's an example of a Custom EXE/Script Sensor with a PowerShell script that checks a controller for `analysed-system-statistics`, picks selected metrics, and submits them to PRTG.

![](/assets/images/prtg-eseries-26-prtg-script-gauges.png)

When metrics are many, viewing them as a chart may be easier. Generally I'm against collecting unnecessary metrics in the first place, so I wouldn't collect all these on my production system.

![](/assets/images/prtg-eseries-27-prtg-script-table.png)

Another approach is to focus on selected values over time which is better done with charts.

![](/assets/images/prtg-eseries-28-prtg-script-chart.png)

Here we see DDP is > 80% of my workload, and most recently read latency was around 150 microseconds (0.15 ms) which is not unusual with RDMA-based storage protocols and EF-Series ([Ubuntu with EF-570 over iSER](/2023/09/22/ubuntu-lts-netapp-eseries-iser.html), in this case).

### Security in shell scripts

PRTG can pass username/password combinations, JSON Web Tokens or Bearer tokens as parameters to sensor scripts. They have practical recommendations for security of credentials, and that should be your primary source of information for securing PRTG.

One way to deal with passwords or Tokens is to hard-code them into the script. That's generally a stupid idea, but SANtricity has read-only monitor RBAC, so hard-coding a password the monitor account is usually not a major concern (an attacker could view SANtricity settings, but not change anything).

As of SANtricity 11.80 JWTs still have a known shortcoming which is that they can't be issued by (or on behalf of) accounts who aren't security admins, so the harmless monitor account can't have it. See [more about JWTs here](https://docs.netapp.com/us-en/e-series-santricity/sm-settings/access-management-tokens.html).

Ideas:

- Encode username/password for the monitor account in the script or pass them from PRTG - it doesn't matter.
- Alternatively, in Sensor settings, use Bearer Token (the relatively short-lived token you get when you login via the APIs) for the SANtricity Monitor account. Since these last much shorter than JWTs, you would need another script (maybe running from a secure system) that renews Bearer Token on SANtricity and uses the PRTG API to update the value of token variable in the Sensor settings of the PRTG system or remote Windows system that runs the script. You could have that script run on the local system, but then you'd have approximately the same security as in the first, simple alternative, with username/password encoded in the script or passed to the script from PRTG.

JWT is convenient because it can last up to 366 days despite any (possible) SANtricity password changes, but it's no different from using an admin user's username/password: if somebody get hold of it, they can write their own script and use it there. If you decide to use JWT , create a renewal reminder in (X-7) days somewhere to renew it and update parameters in Sensor settings or the script itself before it expires.

If SANtricity makes it possible to issue JWT for the monitor account, we could then use a secure workstation to issue and daily refresh JWT for the account, and remotely push JWT token to the script or value to the sensor to refresh it. 
Even if the attacker gets the JWT token, it'd be valid only for the day, and have nothing but read-only capabilities.

## Appendix D - Syslog receiver

E-Series lets you forward system logs to another destination and PRTG has a Syslog Receiver sensor that works very similarly to SNMP Trap Receiver. If SNMP for some reason isn't available in your environment and syslog is, you can use it to apply most of the details from SNMP Trap Receiver sensor appendix.

To test this feature I forwarded logs from SANtricity controllers to another system, and from there to PRTG server running on Windows. 

The source IP belongs to the Linux forwarder, but Hostname in forwarded messages is the address of SANtricity Controller(s).

We could use these in `(source[IP1] AND source[IP2])` for both controllers and drop the rest (if SNMP traps are being indiscriminately forwarded and contain some junk). If DNS resolution worked, you could use FQDNs in filters instead, or expand the filter to cover both controller IPs and FQDNs.

Another property that can be used in generic Syslog Receiver message filter is App Name, "StorageArray"; if that appears in non-test messages as I think it does, then we can use that to eliminate non-SANtricity log messages. In PRTG filter, that could be used as `(message["StorageArray"])`, but I haven't tried that as I didn't want to spend time on syslog.

![](/assets/images/prtg-eseries-20-syslog-receiver-eseries-test-prtg.png)

Try without any filters first, so that you can confirm messages are coming in, and then configure the filters and customize the rest.

## Appendix E - SANtricity 12 and PowerShell 7 

I've updated the scripts in 2026/04/04 because I noticed a decent amount of activity on Github. One funny (and usual) thing is - no one ever bothered to report any issues, although there were several. I think I've fixed those, and also:

- Touch-tested with SANtricity 11.90 and 12.00 - OK
- Touch-tested with PowerShell 7 wrapper (using PowerShell 7.6.0 LTS on Ubuntu 24.04 LTS) - OK

```powershell
& '.\monitor\PRTG\Get-ESeriesInfo.ps1' -ApiEp <your-san-ip> `
   -ApiPort <port> -SanSysId <id> `
   -Account <user> -Password <pass> `
   -UsePowerShell7Wrapper
```

Expected Behavior:

- If PS7 is installed and discoverable as `pwsh`, wrapper invokes the backend and returns PRTG JSON.
- If PS7 isn't available and wrapper fails, native PS5.1 path still works (backward compatible).
  
Fallback Options:

- If `pwsh` isn't in PATH, specify the full path: `-UsePowerShell7Wrapper -PwshPath "C:\Program Files\PowerShell\7\pwsh.exe"`
- If PS7 isn't installed, just omit the `-UsePowerShell7Wrapper` flag - sensors run natively in PS5.1.
