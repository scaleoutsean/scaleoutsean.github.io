# Use Telegraf to send NetApp SolidFire metrics to InfluxDB

Use Telegraf exec plugin to send SolidFire metrics to InfluxDB

- [Telegraf for heavy lifting?](#telegraf-for-heavy-lifting)
- [PoC with PowerShell](#poc-with-powershell)
- [Conclusion](#conclusion)
- [Appendix A - Python version](#appendix-a---python-version)

## Telegraf for heavy lifting?

As I'm still thinking how to move ahead with [SFC](/2024/05/03/netapp-solidfire-collector-next.html), I've been checking out Telegraf again.

I thought maybe I should just use Telegraf instead, so today I've been revisiting Telegraf again.

[This](/2021/08/13/solidfire-snmp-v3-grafana.html) post shows how to use SNMP as a Telegraf input that collects SolidFire metrics, but SolidFir's SNMP output is quite basic, so that approach couldn't work well.

A better - but also time-consuming - approach is to use another input and gater SolidFire metrics from the API. 

## PoC with PowerShell

For this PoC I used PowerShell to collect volume metrics. I probably shouldn't have (more on that later).

Thanks to a PowerShell bug I ended up collecting metrics *indirectly*. 

That is, instead of using `inputs.exec` with a PowerShell script that sends output to InfluxDB, I had to run the script independently of Telegraf, spit data out to a place where Telegraf's `input.file` can fetch it and submit to InfluxDB.

Telegraf configuration file:

```raw
[agent]
  interval = "60s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "60s"
  flush_jitter = "5s"
  precision = "60s"
  omit_hostname = true
[[inputs.file]]
  data_format = "influx"
  files = ["/etc/telegraf/telegraf01.out", "/etc/telegraf/telegraf02.out"]
[[outputs.influxdb]]
  urls = ["http://192.168.50.184:32290"]
  database = "solidgraf"
  skip_database_creation = false
  timeout = "5s"
  content_encoding = "gzip"
```

I know that location shouldn't be /etc/telegraf/, but that's Telegraf's home directory and I ran out of patience. Anyways, this is how my config looks like after volume properties (Get-SFVolume) and stats (Get-SFVolumeStats) are saved to two files in the InfluxDB format.

I run a PowerShell script from crontab and overwrite those two files every minute. 

Telegraf agent picks them up and sends them to InfluxDB version 1 (in my case - see `output.influxdb` above) and that gives me these metrics in the `solidgraf` DB:

```sql
> select * from volumeStats
name: volumeStats
time                 accountID actualIOPS_final averageIOpSize_final host         latencyUSec_final readLatencyUSec_final throttle_final volUtilPct_final volumeId volumeName                               volumeUtil_final writeLatencyUSec_final zeroBlocks_final
----                 --------- ---------------- -------------------- ----         ----------------- --------------------- -------------- ---------------- -------- ----------                               ---------------- ---------------------- ----------------
2024-05-20T07:11:00Z 1         0                1920                 scaleoutsean 0                 0                     0              0                1        data                                     0                0                      486871
2024-05-20T07:11:00Z 1         0                1964                 scaleoutsean 0                 0                     0              0                2        log                                      0                0                      260851
2024-05-20T07:11:00Z 10        0                0                    scaleoutsean 0                 0                     0              0                108      win1101                                  0                0                      1220864
2024-05-20T07:11:00Z 11        0                0                    scaleoutsean 0                 0                     0              0                111      pvc-8d31e43b-f942-4cf8-94db-a08762c745ee 0                0                      524288
2024-05-20T07:11:00Z 11        0                0                    scaleoutsean 0                 0                     0              0                112      pvc-14a51322-16c8-4b95-a7e4-28d9963450b3 0                0                      524288

> select * from volumeProps
name: volumeProps
time                 accountID fifoSize_final host         minFifoSize_final qosPolicyId_final scsiNaaDeviceID                  volumeBlockSize_final volumeId volumeName                               volumeSize_final
----                 --------- -------------- ----         ----------------- ----------------- ---------------                  --------------------- -------- ----------                               ----------------
2024-05-20T07:11:00Z 1         5              scaleoutsean 0                 2                 6f47acc1000000007763776200000001 4096                  1        data                                     2000683008
2024-05-20T07:11:00Z 1         5              scaleoutsean 0                 1                 6f47acc1000000007763776200000002 4096                  2        log                                      1073741824
2024-05-20T07:11:00Z 10        5              scaleoutsean 0                 2                 6f47acc100000000776377620000006c 4096                  108      win1101                                  5000658944
2024-05-20T07:11:00Z 11        5              scaleoutsean 0                 0                 6f47acc100000000776377620000006f 4096                  111      pvc-8d31e43b-f942-4cf8-94db-a08762c745ee 2147483648
2024-05-20T07:11:00Z 11        5              scaleoutsean 0                 0                 6f47acc1000000007763776200000070 4096                  112      pvc-14a51322-16c8-4b95-a7e4-28d9963450b3 2147483648
2024-05-20T07:11:00Z 11        5              scaleoutsean 0                 0                 6f47acc1000000007763776200000071 4096                  113      pvc-4fb5d7f5-4d98-429e-ab36-1b2118b7e55c 2147483648
```

Known BS in this release:

- `host` name of the system where Telegraf agent is running is sent to InfluxDB although agent configuration says not to
- `_final` appears in some field names because I mistakenly used the same value for both key and field in the same measurement; avoid that and you won't have this problem

You can find the PowerShell script in the scripts directory of Awesome SolidFire. In the case you wonder why the metrics-related code looks so laborious, it's because it is - it's all manually crafted to minimize code complexity at the expense of coding time. SolidFire.Core is the only external PowerShell module I used.

Also, not *all* fields from Get-SFVolume and Get-SFVolumeStats responses are sent to InfluxDB - only about 50% of the important stuff is. Feel free to adjust if necessary.

## Conclusion

Volume stats and properties are probably two most intensive parts of metrics collection in SFC as these are usually collected most frequently and take up most space which is one of the reasons why the script doesn't send all output to InfluxDB.

I suspect I would have been better off if I used Python, but it's too late now. 

Meanwhile I rewrote the script in Python (notes below), which behaves a bit better on Linux. With it I also took a similarly minimalist approach.

After evaluating Telegraf with both Python and PowerShell, I've concluded it's easier to just use Python (or PowerShell) and keep things simple. SolidFire Collector (SFC) is a simple program and it's easier to add a scheduler module and keep everything within one script than use Telegraf for scheduling and InfluxDB communication. 

Telegraf is good, but SFC doesn't do much and adding a 250 MB container to do schedule Web POST events is hard to justify for this use case. 

## Appendix A - Python version

Rewritten for Python, it works slightly less badly. Telegraf is weird. Working around its quirks, I did it like this:

- Python service that collects data every 60 seconds and outputs to /etc/telegraf/out/telegraf-solidfire.out. Python service runs as another user who's member of the telegraf group
- /etc/telegraf/out is owned by this user, let's say sean:telegraf, so that he can write to it. /etc/telegraf/out/telegraf-solidfire.out is made accessible world with 755
- `[[inputs.file]]` plugin collects /etc/telegraf/out/telegraf-solidfire.out and sends to InfluxDB v1

```raw
[[inputs.file]]
  files = ["/etc/telegraf/out/solidfire-telegraf.out"]
```

Compared to known BS from PowerShell code, there are no such problems in the Python script.
