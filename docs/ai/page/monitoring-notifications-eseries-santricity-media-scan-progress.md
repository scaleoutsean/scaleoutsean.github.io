# Monitor progress and notify of E-Series media scan events

Detect, monitor, and notify of media scan jobs on NetApp E-Series

- [Introduction](#introduction)
- [SANtricity API methods related to scrubbing, scanning, fixing data issues](#santricity-api-methods-related-to-scrubbing-scanning-fixing-data-issues)
- [Media scan in Web UI](#media-scan-in-web-ui)
- [Relevant API methods](#relevant-api-methods)
- [Implementation](#implementation)
- [Example](#example)
- [API polling frequency](#api-polling-frequency)
- [Manual vs. SANtricity-scheduled media scan jobs](#manual-vs-santricity-scheduled-media-scan-jobs)
- [How to observe SANtricity-initiated media scan events](#how-to-observe-santricity-initiated-media-scan-events)
- [Conclusion](#conclusion)

**NOTE**: accounts and passwords from this post are given as examples and not used in production.

## Introduction

NetApp E-Series (and its SANtricity OS) periodically performs disk media scan to detect and, if necessary, fix bit rot.

> Media scan is a process that, when enabled, runs during idle time to check the physical disks in a volume. It works to ensure that the sectors are readable, and if Redundancy Check is enabled, will check RAID parity for consistency.

I got that from [this NetApp KB](https://kb.netapp.com/onprem/E-Series/SANtricity_OS/What_is_Media_Scan_on_E_Series_storage_systems). The rest is not available to users without a valid support account, but it's also documented in the SANtricity documentation.

## SANtricity API methods related to scrubbing, scanning, fixing data issues

The related SANtricity API methods may be confusing:
- The terminology related to scanning and checking is inconsistent
  - There's a `check-volume-parity` API (presumably this is media scan) and `data-parity-repair` and it's hard to figure out which API does what, when they should be used. As we shall see later, the latter isn't supposed to be executed at whim.
- Media scans manually-initiated in the SANtricity Web UI don't appear in the API output for media scan jobs (which makes the problem mentioned just above harder to solve)
- There's no documentation on how media scan API is supposed to be used
- Media scan progress indicator provided in SANtricity API responses is constantly stuck on 0 (%) which looks like a bug
- For system-initiated media-scans, it's hard to see when/where (on which volumes) they run without using the API, so one really has to poll the API every few minutes and watch it that way

Fortunately, even an outsider can get past these. 

After some experimenting:
- We can use `check-volume-parity` to initiate media scan jobs on your own (you shouldn't do that, but you need to do that if you're developing a monitor), otherwise you may need to wait on SANtricity 
- When calling that API to start a manual scan, set an `endLBA` value that's smaller than what you may think it should be. You can ignore this if you use automatic SANtricity-initiated scans
- Use seconds elapsed and seconds left indicators to figure out the correct % completed indicator
- Check out other related API calls (e.g. diagnostics or error reporting) if you want a bit more detail on errors detected (if any). I'd run these only manually and the in case of repeated or growing errors observed in media scans

## Media scan in Web UI

To give you an idea, here are some screenshots.

These are media drive scan settings. You can completely disable them. The default (SANtricity 11.80) is 30d.

30 days means *at least* once every 30 days, but if no automatically scheduled media scans (scrubs) are running, SANtricity may start one anyway so a volume may get scanned more than once a month. 

Each controller would run one scrub per VG/DDP that it owns. Say you have 4 VGs with 4 volumes each, evenly distributed across both controllers. Each controller would constantly run 2 jobs because no more than 1 job per VG from which the volume originates.

In this screenshot I set that to 1 day (don't do this in production!) in the hope of spotting some scans through the API, but none were initiated during the few hours (maybe due to the fact that I was also running manually initiated scans).

![E-Series drive media scan settings](/assets/images/eseries-santricity-media-scan-00.png)

Notice that in the above, you could disable media scan or redundancy check for selected (or all) volumes to run these jobs more (or less) frequently.

This below is **not** it!

![E-Series media redundancy check](/assets/images/eseries-santricity-media-scan-01.png)

This is Media Redundancy Check (I think. It's very confusing) that can be found in Pools & Volume Groups.

If you run this media redundancy check (again, this is *not* media scan), it won't appear in `check-volume-parity` jobs queried through the API.

![SANtricity media redundancy check progress](/assets/images/eseries-santricity-media-scan-02.png)

(If you're wondering WTF are those three volumes with the prefix `repos_`, see [this](/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html) and [this post on SANtricity snapshots](/2023/10/12/snapshot-clone-repository-monitoring-in-eseries.html).)

## Relevant API methods

This one initiates a media scan. When automatic scheduled scanning is enabled, SANtricity does this based on those settings as explained above (maybe I should say it uses AI, but this is a technical blog) and you won't need to use this API method except in development or if you want to initiate on-demand media scans so that you can monitor (or cancel) them.

```raw
POST /storage-systems/{system-id}/volumes/{volume-id}/check-volume-parity
```

The above takes 2 params (SANtricity System ID and volume ID) as well as these job settings. 

```json
{
  "startLba": "0",
  "endLba": "3145727000",
  "scanPriority": "priority0",
  "repairParityErrors": true,
  "repairMediaErrors": true
}
```

I had to shave off a few K bytes from `endLba` value as I'd get an error when calculating that my way. Later I found I could deduct just 1 from that figure because `startLba` starts at 0... 

Say you have a volume with 512 (some may be 4096) byte sectors, and volume size is 512000 (small, for easier calculation), then startLba would be 0 (as usual) and endLba would be (512000/512)-1 = 999. (I haven't tried, but maybe you can omit both of these params and SANtricity would scan the entire volume...)

If that request is successful, that request returns a JSON file that contains your job ID.

```json
{
  "jobId": "1cc7992c-a8f6-440c-ac2e-bda43987487a",
  "volumeId": "02000000600A098000F637140000284763A83F44",
  "volumeName": "fifteen"
}
```

For mere monitoring (of media scan jobs initiated with `POST`), you just need this one call below. 

```raw
GET /storage-systems/{system-id}/volumes/check-volume-parity/jobs
```

In SANtricity 11.80 you can't `GET` system-scheduled media jobs this way. This works only for manually initiated media scan jobs.

Typical response with one of the jobs in progress:

```json
[
  {
    "jobId": "6bf07c1b-fad7-4be0-b475-dee812a0aee0",
    "jobStartedTimestamp": "2024-03-16T09:34:11.780558Z",
    "volumeId": "02000000600A098000F637140000284763A83F44",
    "volumeName": "fifteen",
    "jobStatus": "inProgress",
    "startLba": "0",
    "endLba": "3145727000",
    "scanPriority": "priority0",
    "repairParityErrors": true,
    "repairMediaErrors": true,
    "lastScannedLba": "105902079",
    "percentComplete": 0,
    "runtimeInSec": "24",
    "estimatedTimeRemainingInSec": "672",
    "totalParityErrorsDetected": 0
  },
  {
    "jobId": "5a79fd6d-6735-44d7-8087-3738bc78697f",
    "jobStartedTimestamp": "2024-03-16T09:14:04.638466Z",
    "volumeId": "02000000600A098000F637140000284763A83F44",
    "volumeName": "fifteen",
    "jobStatus": "completed",
    "startLba": "0",
    "endLba": "3145727000",
    "scanPriority": "priority0",
    "repairParityErrors": true,
    "repairMediaErrors": true,
    "lastScannedLba": "3145727000",
    "percentComplete": 100,
    "runtimeInSec": "720",
    "estimatedTimeRemainingInSec": "0",
    "totalParityErrorsDetected": 0
  }
]
```

There's also a job-specific API endpoint where you could poll just the job that you initiated. 

```raw
GET /storage-systems/{system-id}/volumes/check-volume-parity/jobs/{job-id}
```

But the response is the same, so I prefer the one above where all jobs are returned and I simply look for jobs in progress, if any.

In theory, I suppose some users very familiar with their workloads could disable automated periodic media scans by SANtricity and kick off their own media scan jobs during low workload periods, so in some extreme cases you may actually want to use this API method.

Likewise, in some extreme cases you may want to cancel a job that's bothering your workload. I didn't use this either.

```raw
DELETE /storage-systems/{system-id}/volumes/check-volume-parity/jobs/{job-id}
```

To my earlier point, SANtricity API constantly tells you media scan is 0% complete. That doesn't look correct at all, but you need to notice it first.

![SANtricity media scan progress indicator](/assets/images/eseries-santricity-media-scan-03.png)

Until you realize that, you may wonder what the heck is wrong with your script. Or maybe not even notice that anything is wrong and needlessly debug it like I did.

![PowerShell misled by API response](/assets/images/eseries-santricity-media-scan-05.png)

## Implementation

While there's nothing complicated that needs to be analyzed, it still requires some thought because it can be done incorrectly. 

There are different use cases, so there's more than correct way.

- Some people may want to know which volume is media-scanned before performing maintenance actions
- Others may want to know how much time is left (i.e. when this internal workload will go away, since it has a performance impact) and trigger/throttle client workloads
- Yet others may want to monitor these jobs to watch for errors/fixes, for example to spot an uptrend for old media (especially HDDs)
- Some may want to integrate notifications or kick off some batch jobs when a job completes

Because everyone may want a different thing, I didn't try to do a full PoC.

I may add media scan jobs to [E-Series Perf Analyzer (EPA)](https://github.com/scaleoutsean/eseries-perf-analyzer/) at a later time. For now I just tried to check which APIs work and how - I'm not convinced many users really care about media scans and those who do now know how to add them to EPA (or other monitoring software) on their own. 

One thing I didn't try is looking at reports on errors found (there's another API call for that), in part because I don't know if anyone cared about that or not. Also, I didn't get any errors. I don't think one can simulate errors (especially since I don't even know how such API responses look like), so until I hear from someone who has this problem/need, I'll just ignore that.

If I had more time I'd try building a simple JavaScript based media scan. As we use the read-only "monitor" account, it's safe to build a nice single page monitor with media scan table, charts that can be easily scraped by whomever needs that info, and just let it run on LAN, especially if we don't need retention or can push updates to some DB that's already out there.

## Example

A few months ago I discussed monitoring E-Series from PRTG. I used PowerShell in those articles and since this is something that could also be added to PRTG, I used PowerShell here as well.

The script takes a volume name and few other inputs. Then it logs in, gets volume parity check jobs that are `inProgress` to see if the volume `fifteen` is one of them. If yes, it looks at "seconds used" and "seconds left" (an estimate, obviously). If no in-progress job on the volume is found, it exits silently.

```powershell
> Get-ESeriesMediaScan.ps1 -ApiEp "1.2.3.4" -ApiPort "8443" `
    -SanSysId "600a098000f63714000000005e79c17c" `
    -Account "monitor" -Password "XXXXXXXXXX" `
    -VolName "fifteen"

VolumeName PctComplete SecUsed SecLeftEstimate

---------- ----------- ------- ---------------

fifteen          79.22 549     144
```

As mentioned earlier, the API constantly returns 0 as % complete. I solve that by calculating that value on my own.

That's about it. Again, I initiated scans manually through the API, and as mentioned above I can't be certain that SANtricity-initiated scans are visible in the same API. I couldn't spot any SANtricity-initiated jobs during the few hours I was working on this, so I can only hope they'd be visible the same way when they do run.

We could send notifications or push these updates to InfluxDB or Elasticsearch or Slack, but that's unrelated to E-Series and "use case"-dependent so I'll leave it out for now.

![PowerShell monitor of E-Series media scan job](/assets/images/eseries-santricity-media-scan-04.png)

## API polling frequency

On my small and idle SSD-based volumes, scans took mere minutes. But on huge and/or busy NL-SAS volumes (500 TB, for example) media scans could take days since they self-throttle when user workload is high.

The API seems to update media scan progress every 30-60 seconds, so there's no point in polling it every 10 seconds.

For HDD-based volumes or large SSD volumes, consider 600 seconds or even longer.

There's no need to constantly update this status, especially if you already use the API for pulling tons of other metrics every 60 seconds.

## Manual vs. SANtricity-scheduled media scan jobs

Manually initiated media scan jobs (using the API):
- Let you start them when you want
- Let you watch their progress
- Let you cancel (stop) them if you need the resources for some workload

SANtricity-initiated jobs don't let you do any of these things. But they run without any effort on your side.

If you decide to take advantage of the conveniences provided by manually initiated media scan jobs, make sure you do schedule them. 

Then there's the challenge of scheduling jobs the way SANtricity does, with the right priority and frequency. I didn't discuss `scanPriority` (see one of the JSON files above), but there are different levels and I don't know what they mean (it another not-so-well-documented area). Is priority 0 higher than priority 1? Who knows!?

If one were to initiate such jobs manually, what would be the right scan priority level. Maybe use one high priority scan on Friday evening, and schedule additional lower priority scans at other times? Also, how do we not schedule too many jobs on one controller, etc.? 

Because startLba and endLba can be specified, we could split very large jobs in smaller jobs (20% at a time) and scan 20% of a volume each night, which may help you avoid the need to cancel media scan jobs.

That would require some planning and observation of how different settings work in practice:

- Find a way to monitor MEL or SNMP to see how many jobs run, when, etc.
- Pick one or two volumes, disable automated media scans on just those two volumes
- Run manually initiated scans from external scheduler and send stats - which you can collect using the above API - to some place that's easy to monitor
- Make sure scans run on a regular basis
- Try different priority settings and observe performance impact and duration, so that you can decide what works best for you (maybe a high priority scan on weekends and low-priority at other times)
- From your monitoring data, create a report of scans-per-volume-per-month and alert in the case that number drops below a level that you're comfortable with

This isn't 100% risk free, so be careful or consult a specialist.

If you forget to schedule jobs, that would be risky for data integrity. If you schedule too many, that could result in (harmless, judging by the documentation) errors and some impact on performance.

## How to observe SANtricity-initiated media scan events

With the API, probably only in [MEL](/2022/12/13/eseries-santricity-mel-forwarding.html). Otherwise [SNMP](/2023/09/17/netapp-e-series-snmp-trap-notifications.html) or smcli (to show MEL events).

I don't know how detailed these sources are, but if we could see when scans begin and end, et least we'd have something to work with and we could probably estimate when they are supposed to end.

## Conclusion

Automatically scheduled media scan jobs aren't visible in SANtricity and directly accessible in the API, but you can check MEL and SNMP.

If you're willing to disable automated media scans for one or more volumes, you can gain full control and observability without taking big risks.
