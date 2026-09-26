# Metrics for NetApp SolidFire backup-to-S3 in InfluxDB and Grafana

Send NetApp SolidFire backup-to-S3 metrics and logs to InfluxDB and visualize in Grafana 11

- [Introduction](#introduction)
- [Initiating and monitoring SolidFire backup-to-S3 jobs](#initiating-and-monitoring-solidfire-backup-to-s3-jobs)
  - [Initiation](#initiation)
  - [Status](#status)
  - [Progress](#progress)
  - [Completion and result](#completion-and-result)
- [Sending metrics to InfluxDB v1](#sending-metrics-to-influxdb-v1)
- [The little DB that could](#the-little-db-that-could)
- [Kubernetes jobs](#kubernetes-jobs)
- [Conclusion](#conclusion)
- [Appendix A - Gauge visualization](#appendix-a---gauge-visualization)
- [Appendix B - Grafana alerts](#appendix-b---grafana-alerts)

## Introduction

In the previous post I wrote about Grafana 11 (Preview), with which good old SolidFire Collector and Graphite work like a charm.

On that occasion I also tested InfluxDB v1 Data Source in Grafana 11 - that also worked great.

Once I had SolidFire Collector, InfluxDB, and Grafana all running, I thought how I should also look at the next steps.

Some two years ago I mentioned how moving SolidFire Collector to InfluxDB would be a good idea, because it's more widely used (and I use it in E-Series Performance Analyzer as well).

While I still don't have enough time to embark on SolidFire Collector integration with InfluxDB, there's an easier target - my PowerShell [script](https://github.com/scaleoutsean/awesome-solidfire/tree/master/scripts) for parallel SolidFire backup to S3. Why?

- SolidFire Collector doesn't do any monitoring related to backup to S3
- Backups are long-running jobs and none of the scripts I've written so far had integration with logging or monitoring (although I blogged about 3rd party integrations such as Velero and Kopia, which do have metrics, but I'm now talking about my own scripts)

An opportunity I couldn't miss!

## Initiating and monitoring SolidFire backup-to-S3 jobs

I've blogged about SolidFire's backup-to-S3 in many posts ([example](/2021/04/21/solidfire-backup-to-s3.html)), so I'll just skip that and focus on task at hand.

First, we need to create a backup job. Then we want to monitor it and finally we want to know whether it was or wasn't successful. Simple!

But we need to stick to the maximum number of job slots per node, so it's not like one giant "for each" loop, which is why I wrote those scripts.

### Initiation

We're after [StartBulkVolumeRead](https://docs.netapp.com/us-en/element-software/api/reference_element_api_startbulkvolumeread.html).

Let's backup volume ID 139.

```powershell
Invoke-SFApi -Method StartBulkVolumeRead -Params @{ `
  "volumeID"= "139"; `
  "format" = "native"; `
  "script" = "bv_internal.py"; `
  "scriptParameters" = @{ `
    "write" = @{ `
      "awsAccessKeyID" = ""; "awsSecretAccessKey" = ""; `
      "bucket"= "solidfire-backup"; `
      "prefix"= "PROD-wcwb/pvc-d793176f-2484-48ea-9255-f70215a7c5f7"; `
      "endpoint"= "s3"; `
      "hostname"= "a.b.c.d" }}} 
```

We get back an async job ID handle (176) and a key that appears in the output of other API calls that we'll see later.

```powershell
Name                           Value
----                           -----
key                            88d5819d96dfda7190b16a1426fcded0
url                            https://192.168.105.29:8443/
asyncHandle                    176
```

### Status

Once a job has been submitted, its job handle can be queried for progress and outcome. 

We use "`-KeepResult:$True`" in the first query so that the API retains this result a longer (and won't disappear before the job is over).

```powershell
PS> Get-SFASyncResult -ASyncResultID 176 -KeepResult:$True | ConvertTo-Json
{
  "status": "running",
  "details": {
    "volumeID": 139,
    "message": "",
    "bvID": 101
  },
  "resultType": "BulkVolume",
  "lastUpdateTime": "2024-04-24T06:44:32Z",
  "createTime": "2024-04-24T06:44:32Z"
}
```

We can run this in a loop every few minutes until the job is complete.

During that time we'd see something like this in Running Tasks tab of the SolidFire UI:

![](/assets/images/solidfire-backup-job-monitoring-influxdb-01-submit.png)

All images here can be opened in a new tab, by the way.

### Progress

As far as job progress monitoring is concerned, use Get-SFBulkVolumeJob for that. Notice "`bvID: 101`" in the output above, by the way. We have that ID here, too!

```powershell
PS> Get-SFBulkVolumeJob -VolumeId 139 | ConvertTo-Json
{
  "BulkVolumeID": 101,
  "CreateTime": "2024-04-24T06:44:32Z",
  "ElapsedTime": 40,
  "Format": "native",
  "Key": "88d5819d96dfda7190b16a1426fcded0",
  "PercentComplete": 0,
  "RemainingTime": 3960,
  "SrcVolumeID": 139,
  "Status": "running",
  "Script": "bv_internal.py",
  "SnapshotID": null,
  "Type": "read",
  "Attributes": {}
}

PS> Get-SFBulkVolumeJob -VolumeId 139 | ConvertTo-Json
{
  "BulkVolumeID": 101,
  "CreateTime": "2024-04-24T06:44:32Z",
  "ElapsedTime": 152,
  "Format": "native",
  "Key": "88d5819d96dfda7190b16a1426fcded0",
  "PercentComplete": 48,
  "RemainingTime": 164,
  "SrcVolumeID": 139,
  "Status": "running",
  "Script": "bv_internal.py",
  "SnapshotID": null,
  "Type": "read",
  "Attributes": {
    "nextLba": 128000,
    "firstPendingLba": 118784,
    "startLba": 0,
    "blocksPerTransfer": 1024,
    "pendingLbas": "[122880, 123904, 124928, 118784, 119808, 125952, 120832, 126976, 121856]",
    "nLbas": 244140,
    "percentComplete": 48
  }
}

```

BulkVolumeID 101 maps to bvID 101 from async job handle but only two concurrent bulk volume jobs are supported on the volume in the first place, so it's unlikely that you'd get confused in any case - you wouldn't have more than one backup job at the same time.

Either way, cross-referencing by using bvID is possible, so we know which is which.

Couple of important points here:

- BulkVolumeID and Key reference async job we submitted
- RemainingTime can go up as well as down (beware if doing own math on current and previous values)
- percentComplete never hits 100%. For example, you may get 95% as the last reading before job exits; so "`($res -eq $null)`" tells you you're done (job is done). Don't expect you'll see a 100% here!
- SnapshotID value will be non-zero if we specify one. In the script I mentioned I have a switch that can automatically use the latest snapshot for the volume, if available.

One reminder: we don't necessarily have to obsess over job progress: we can simply reference that bulk job ID (bv101) and check for its logs in SolidFire Event Log later to see if it succeeded or not!

![](/assets/images/solidfire-backup-job-monitoring-influxdb-02-completed.png)

The reason we *can* obsess over it is that it's inexpensive to get and send those backup progress metrics to InfluxDB. But it's not mandatory for knowing whether a job succeeded. 

I suppose users with fewer smaller volumes wouldn't care about progress of backup jobs, but users with many large (10TB, for example) volumes would.

### Completion and result

Eventually, jobs complete and their outcome is either success or error.

Get-SFBulkVolumeJob tells us nothing about the job outcome. It monitors bulk volume jobs, not backups. Once a backup job is finished, you get nothing back.

```powershell
PS> Get-SFBulkVolumeJob -VolumeId 139 | ConvertTo-Json
PS>
```

Get-SFASyncResult is how we learn of outcome. Here's an example of a successful job (notice it references an async job handle, not a volume ID):

```powershell
PS> Get-SFASyncResult -ASyncResultID 176 -KeepResult:$True | ConvertTo-Json
{
  "status": "complete",
  "resultType": "BulkVolume",
  "lastUpdateTime": "2024-04-24T06:49:14Z",
  "result": {
    "volumeID": 139,
    "message": "Bulk volume job succeeded",
    "bvID": 101
  },
  "createTime": "2024-04-24T06:44:32Z"
}

```

And an example of a failed job:

```powershell
PS> Get-SFASyncResult -ASyncResultID 173 -KeepResult:$True | ConvertTo-Json
{
  "status": "complete",
  "resultType": "BulkVolume",
  "lastUpdateTime": "2024-04-24T06:22:43Z",
  "error": {
    "name": "xBulkVolumeScriptFailure",
    "message": "Bulk volume job failed",
    "volumeID": 139,
    "bvID": 98
  },
  "createTime": "2024-04-24T06:20:57Z"
}

```

My backup-to-S3 script v2 in Awesome SolidFire already checks these things. We just need to send that output to InfluxDB v1 and then visualize it with Grafana 11.

## Sending metrics to InfluxDB v1

While you may send to InfluxDB whatever you want, I'd start with just two metrics: backup job and backup progress.

I haven't thought about it a lot - this post is in my investigation, in fact - but I'd start with something simple.

Backup job:

- Tags: cluster name, volume name, volume ID, bulk volume job ID (maybe more, e.g. K8s PVC, namespace)
- One data field: status (one of: submitted, running, complete)

Backup progress:

- Tags: similar tags as for backup job
- Two data fields: percentDone (int), status

We can simulate that by manually inserting data to InfluxDB.

For backup jobs:

```powershell
PS> Write-Influx -Measure backup -Tags @{cluster="PROD";volName="pvc-d793176f-2484-48ea-9255-f70215a7c5f7";volId=139,bvId=101} -Metrics @{status="submitted"} -Database example -Server http://192.168.50.184:32290 -Verbose
PS> Write-Influx -Measure backup -Tags @{cluster="PROD";volName="pvc-d793176f-2484-48ea-9255-f70215a7c5f7";volId=139,bvId=101} -Metrics @{status="running"} -Database example -Server http://192.168.50.184:32290 -Verbose
PS> Write-Influx -Measure backup -Tags @{cluster="PROD";volName="pvc-d793176f-2484-48ea-9255-f70215a7c5f7";volId=139,bvId=101} -Metrics @{status="running"} -Database example -Server http://192.168.50.184:32290 -Verbose
PS> Write-Influx -Measure backup -Tags @{cluster="PROD";volName="pvc-d793176f-2484-48ea-9255-f70215a7c5f7";volId=139,bvId=101;result="ok"} -Metrics @{status="complete",} -Database example -Server http://192.168.50.184:32290 -Verbose

```

How you want to visualize or show that in Grafana is up to you. 

If we backup volumes every 24 hours, that query can be something as simple as a table that shows last 24 hours of records (which would show submitted, running, complete) for all volumes we care about.

![](/assets/images/solidfire-backup-job-monitoring-influxdb-03-influx-backup-metric.png)

Grafana 11 can conditionally format table rows, so we can show a bunch of these on a page and emphasize only those that failed (i.e. "result="ng") or create Grafana alerts for that.

For backup progress:

```powershell
PS> Write-Influx -Measure backupprogress -Tags @{cluster="PROD";srcVolId=139;snapId=0;bvId=101} -Metrics @{pctDone=0;status="running"} -Database example -Server http://192.168.50.184:32290 -Verbose
PS> Write-Influx -Measure backupprogress -Tags @{cluster="PROD";srcVolId=139;snapId=0;bvId=101} -Metrics @{pctDone=50;status="running"} -Database example -Server http://192.168.50.184:32290 -Verbose
```

Regarding percentComplete (which is unlikely to ever be 100%) - nothing prevents us from creating our own final data point with "`pctDone=100; status="complete"`" - if we've got `status="complete"` and `result="ok"` from the async job for the same bvId, it's fair to assume its progress is 100%.

```powershell
PS> Write-Influx -Measure backupprogress -Tags @{cluster="PROD";srcVolId=139;snapId=0;bvId=101} -Metrics @{pctDone=100;status="complete"} -Database example -Server http://192.168.50.184:32290 -Verbose
```

Again, if we backup to S3 once a day, we wouldn't see a bunch of jobs for each volume. We'd query last 24 hours and maybe just show results (failed = red, success = green), as we would presumably have a lot of volumes and watch them in a table potentially focusing just on those with "successful backups in last 24 hours = 0".

But, let's say we have one "pet" volume which we like to watch because it often fails to backup to the public cloud.

In that case we may want to watch its progress over time, like this (where we see two recent backups). It starts at close to zero percent complete and moves up to 100% (I insert the last value on my own once I know job completed successfully, as explained above).

![](/assets/images/solidfire-backup-job-monitoring-influxdb-04-influx-backupprogress-metric.png)

Data points representing backup job progress are red at the beginning, change to orange and yellow as they go up, and become green at over 50%. That way I can visualize progress of jobs from different volumes.

If query shows data points from multiple backups over time, I can see the newer backup was smoother while the one on the left looks like it almost got stuck at one point.

We can also use other visualization types such as gauge (see Appendix) which may be neat for folks with 10-50 volumes. Maybe try heatmap for more? 

To submit data to InfluxDB v1 I used [this community module](https://github.com/markwragg/PowerShell-Influx) (GPL **3.0** alert!), but you can use another (there are several; [this one](https://github.com/micelshima/InfluxDB-Powershell-Module/blob/master/InfluxDB-Powershell-Module/InfluxDB-Powershell-Module.psm1) uses MIT license) or simply write your own. Or use Python for all of the above. 

## The little DB that could

Under this very light load, my InfluxDB v1 container used 105 MiB of RAM. View from my Kubernetes worker:

```sh
 PID USER      PR  NI    VIRT    RES  %CPU  %MEM     TIME+ S COMMAND  
 161292 root      20   0 2588.6m 230.8m   0.0   2.9   0:22.96 S pwsh                                                                            
 318616 472       20   0 1463.7m 148.8m   0.0   1.9   0:33.72 S grafana server --homepath=/usr/share/grafana --config=/etc/grafana/grafana.ini+ 
  67599 root      20   0 1004.7m 104.5m   0.0   1.3   0:44.48 S influxd 

```

[solidshell](https://hub.docker.com/r/scaleoutsean/solidshell) (PowerShell + SolidFire Core) container where I ran SolidFire and InfluxDB client is at the top and uses more than 2x more RAM.

## Kubernetes jobs

solidshell reminds me that my jobs were dispatched from a Kubernetes pod. I should mention I put it in the same namespace as InfluxDB.

You don't have to backup Kubernetes volumes (PVs) - any volumes can be backed up as backup is done on SolidFire which knows nothing about volume contents - but I mention this because you don't have to stand up a VM just to run PowerShell. 

Also, securing your SolidFire administrator credentials may be easier on Kubernetes than in a VM.

But if you want to run that script from some Windows workstation, that will work as well as long as you can reach both SolidFire MVIP and InfluxDB API endpoint.

## Conclusion

If you don't have a bureaucratic IT environment and if your cluster has up to 100 volumes, maybe you want to use SolidFire's backup-to-S3. 

While most packaged backup solutions - including Velero - have job monitoring built in, SolidFire's backup-to-S3 needs some extra effort, but can be monitored just as effectively (in fact, it can be monitored even better as Velero currently still has some bugs in the area of monitoring and metrics).

InfluxDB v1 is far from dead, it can run in just 128 MiB RAM and it's easier to use and work with than most other DBs. There are Python and PowerShell clients, which makes integration easy.

Having backup job details in a cloud-based VM with InfluxDB makes it very easy to find backups in no time, which can be useful for DR as well. 

You'll be better off with a commercial solution but if you don't have one or want to take an independent backup to public cloud S3 once a week, now it's easy to automate and monitor that workload. If you start with that script I wrote, logging to InfluxDB may take just 2-3 hours of work.

## Appendix A - Gauge visualization

Simply switching to gauge will work, but it may be hard to identify the struggling volumes.

![](/assets/images/solidfire-backup-job-monitoring-influxdb-05-influx-backupprogress-gauges-small.png)

With custom threshold formatting, it's easier to spot which ones are far from being complete.

![](/assets/images/solidfire-backup-job-monitoring-influxdb-06-influx-backupprogress-gauge-thresholds.png)

For some reason even though I had srcVolId in my data, I couldn't show volume ID on the gauges (instead the best I could do was bvId tag), but I didn't want to spend more time on this. The point is that with proper visualization it's easy to monitor dozens of volumes this way.

![](/assets/images/solidfire-backup-job-monitoring-influxdb-07-influx-backupprogress-gauge-100pct-complete.png)

## Appendix B - Grafana alerts

After some fooling around I created several versions of panels that show failed jobs.

- Example Grafana payload: `'backup,cluster=PROD,bvId=4444,snapId=4444 volId=44,volName="bigvol2",status="error"'`
- Example queries: 
  - (top panel in screenshot below) `SELECT "status" FROM "backup" WHERE ("cluster"::tag = 'PROD') AND $timeFilter`
  - (bottom panel) `SELECT "volId" FROM "backup" WHERE ("cluster"::tag = 'PROD' AND "status"::field = 'error') AND $timeFilter GROUP BY "bvId"::tag ORDER BY time DESC`

One thing I realized Grafana is very complex to use for multi-column queries (one has to use Transformations, etc - it's a nightmare). Table at the bottom was the easiest way to create alerts because it simply looks for errors and nothing else. 

![](/assets/images/solidfire-backup-job-monitoring-influxdb-09-backup-errors.png)

Then we can create alert (email, Slack, etc.), such as "when number of errors in the last 24 hours is > 0". 

![](/assets/images/solidfire-backup-job-monitoring-influxdb-08-grafana-alert-green.png)

When such a condition occurs, that alert enters Pending state (not really necessary for backups unless you set Pending Timeout to say 2 hours and have retry logic in the backup job script).

![](/assets/images/solidfire-backup-job-monitoring-influxdb-10-grafana-alert-pending.png)

After Pending timeout expires, alert starts firing at which point it can be acted upon, silenced, etc.

![](/assets/images/solidfire-backup-job-monitoring-influxdb-11-grafana-alert-firing.png)

I'd be careful with automated rescheduling of failed backup-to-S3 jobs because each could create TBs of extra network traffic.

My preferred way of dealing with such alerts would be to manually kick off individual backups that should be retried or even do nothing, if you backup daily and can wait until the same jobs runs the next day. 

Depending on one's objective, it may be easier to just combine several tags into one and eliminate Grafana Transformations. For example, something like this:

- Before: `'backup, cluster=PROD,bvId=222,snapId=2222 volId=22, volName="bigvol2",status="error"'`
- After: `'backup, cluster=PROD,jobId=v22-s2222-b222 volId=22,status="error"'` (v=VolumeID, s=SnapshotID, b=bvID)

This isn't a best practice in InfluxDB world and while it bloats indexes, it works. In this particular case we're recording backup jobs, so even if you add 1000 entries a day, that's hardly going to matter. It's not like we're running a massive IoT monitoring site.

Then:

```sql
SELECT "volId" FROM "backup" 
WHERE ("cluster"::tag = 'PROD' AND "status"::field = 'error') 
AND $timeFilter 
GROUP BY "jobId"::tag 
ORDER BY time DESC
```

With that one query we'd see everything we need to know in the column jobId: `v22-s2222-b222`. 

![](/assets/images/solidfire-backup-job-monitoring-influxdb-12-grafana-combined-tags.png)

Combining tags may be convenient, but "by tag" search then becomes impossible without Transformations, so it's just a tradeoff.

I also tried another approach, with backup status as 0 (started or running) or 1 (failed):
- `'backup, volId=11,cluster=PROD stage=complete status=1'`

```sql
SELECT "status" FROM "backup" 
WHERE ("cluster"::tag = 'PROD') AND $timeFilter 
GROUP BY "volId"::tag 
ORDER BY time DESC
```

Something like that may make it easier to watch a bunch of volumes and jobs at the same time.

After trial and error, I settled for this approach regarding status values:

- job running = 1
- success = 2
- fail = 3

Then in Grafana I just map these values to colors, with 1 mapped to "transparent" (no color). 

![](/assets/images/solidfire-backup-job-monitoring-influxdb-13-grafana-backup-binary-field-values.png)

Now I can see when jobs are running, when they're not, which succeeded and which failed. 

If I zoom out timeline-wise or zoom in Volume ID-wise (drop-down selector), I can recognize problematic patterns and implement corrective action, such as adding QoS exceptions to large volumes or scheduling fewer backup jobs in parallel. 

I'll probably use something like this if I add "send-to-InfluxDB" to that backup script of mine. 

To be honest, it seems *much easier* to send logs and jobs to Elasticsearch and hook Grafana into Elasticsearch instead so that Grafana only does visualization and alerting, if you don't want to use [Kibana](https://www.elastic.co/guide/en/kibana/current/alerting-getting-started.html) for that. [Here](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html#get-events-and-faults-completely-from-api-logs) you can see how we can forward SolidFire events to Elasticsearch and get structured logs, backup job reporting, and alerts all done in minutes. If we choose that route, there's very little we need to send to InfluxDB using our backup script.
