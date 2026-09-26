# Send NetApp SolidFire metrics to Splunk HTTP Event Collector aka HEC

How to send SolidFire metrics and logs to Splunk

## Introduction

Splunk makes things a bit more complicated than necessary when it comes to using their evaluation software. 

At the same time, I have to ask myself is it any easier with SolidFire demo VM? Not really. It requires registration, and Splunk doesn't. So let's just move on.

But when I think of why I haven't done much with Splunk in years past, that's probably the main reason. 

Anyway, as I've been revisiting Splunk sizing for NetApp E/EF-Series storage, I thought to make a small detour and do a little SolidFire-related post. 

Truth be told, there isn't much to say - SolidFire is the best NetApp block storage for small-to-medium workloads, and that includes the automation aspect. It takes minutes to do stuff: "storage for people who fxxxing hate storage", as the SolidFire founder put it!

## How

You probably want to create a dedicated index, say `solidfire_metrics`.

Create a HEC input for JSON (with time stamps) and set it to send stuff to `solidfire_metrics`. Once you're done creating a HEC, copy the HEC "Token Value" for authentication against the HEC.

We could send multiple indexes and HECs for multiple clusters. Or we could add `source=${CLUSTER}` to your JSON before dumping everything into one big index.

![HEC input for SolidFire metrics](/assets/images/splunk-solidfire-00.png)

Query SolidFire, get JSON out, add a timestamp, and send JSON files to HEC. How? 

- Use shell script with curl or PowerShell equivalent
- Use Python (both SolidFire and Splunk have a Python SDK to make this easier)
- Use PowerShell (SolidFire has PowerShell Tools, but you may need to do the Splunk part "manually" which in PowerShell isn't hard)

## What now?

Well, now you just hoard those metrics. (You may open these in a new tab for easier viewing.)

![](/assets/images/splunk-solidfire-01.png)

Detailed view:

![](/assets/images/splunk-solidfire-02.png)

As a silly search example, here's a "single stat" / "single number" type of search query that shows the largest volume size observed in the past 30 days.

```json
{
    "type": "ds.search",
    "options": {
        "query": "index=\"solidfire_metrics\" | stats max(TotalSize)",
        "enableSmartSources": true,
        "queryParameters": {
            "earliest": "-30d@d",
            "latest": "now"
        }
    },
    "name": "solidfire_metrics_volumes_max_TotalSize"
}
```

Looks totally useless! The largest volume may have been created 2 years ago, so what does that really mean?

It may be useless, but it may be useful, too. There may be people who observe how people use storage and seeing the largest volume size go up, maybe they'd use that information to ask for more bandwidth, or ask the user to decrease their snapshot interval in order to avoid issues with snapshot replication to a remote site.

## Tips

I won't rehash the Splunk HEC docs and best practices, their documentation is good. These are only SolidFire-related tips.

There are several ways to do this, but I found the format in Appendix A good for me. I send those to `https://hec.datafabric.lan:8088/services/collector`.

There are other formats, and even for JSON there's with and without time stamp. I used `_json`, and haven't tried the no-timestamp version. I'm not very good at using Splunk (I'm a bit better at sizing and architecting), so I just picked the format I liked and that worked for me.

![](/assets/images/splunk-solidfire-03.png)

Secondly, SolidFire JSON responses can be pruned before sending, to eliminate junk info and save Splunk, compute and storage costs.

For example in Appendix A I dropped SolidFire QoS curve (this JSON below) from the response I sent to HEC. This QoS curve information is generally not used for anything, so examine all API methods you query and eliminate unnecessary parts before sending that data to HEC.

```json
{
    "Curve": {
      "1048576": 15000,
      "131072": 1950,
      "16384": 270,
      "262144": 3900,
      "32768": 500,
      "4096": 100,
      "524288": 7600,
      "65536": 1000,
      "8192": 160
    }
}
```

To collect multiple metrics as you would just create loops. Example workflow that could send volume and node metrics to HEC in less than 30 lines of PowerShell:
- get all volume IDs or cluster node IDs
- loop over those IDs, get volume information for volumes or nodes
- build a list of JSON documents by extracting useful data to new JSON documents
- loop over this list and send to HEC

As we pass JSON data on to HEC as soon as we get it, event time created by the script should be identical to event datetime from JSON body (if present) or not late by more than a second or two. Generally speaking precision for these metrics is measured in seconds and getting it from the system on the fly isn't worse than getting it from JSON and then converting to seconds-since-epoch (which is doable, but why?).

Third, this reminds me that there's advanced HEC stuff such as batching, channels and acknowledgements. There's nothing specific to SolidFire about that so I won't write about it, but that doesn't mean you shouldn't use it in large, compliance-intensive or mission-critical environments.

Fourth, SolidFire logs: I won't write about syslog because I wrote about logs [elsewhere](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html). You can send SolidFire logs to Universal Forwarder, but like with API responses you can also pre-process them there or before. You can even send syslog to HEC, although that's probably unnecessary.

![](/assets/images/splunk-solidfire-04.png)

Why I wouldn't use HEC for syslog: I'd still have to forward SolidFire logs *somewhere*, then parse that log, batch it, send lines to HECs, check for acknowledgements, and if I did a great job (unlikely) I'd only get the same thing I can get by not doing anything but simply forwarding logs from SolidFire via Universal Forwarders.

Fifth, SNMP traps are also available and Splunk supports them. I wrote about SolidFire SNMP [here](/2021/07/19/solidfire-mib-snmp-monitoring.html). If you don't collect SolidFire events via the API and HEC, you can get them from SNMP traps.

## Conclusion

Now that SolidFire has reached end-of-sale, I use it a bit less, but every time I do, I enjoy it.

Getting SolidFire metrics, logs and SNMP alerts into Splunk is very easy even though it's completely undocumented in the official documentation. 

I don't know any Splunk users with SolidFire, so I've no idea if anyone would benefit from even more details. 

That's why I probably won't try to write a script, compose dashboards and such. But I'm interested in Splunk's [predictive and prescriptive analytics features](https://www.splunk.com/en_us/blog/learn/predictive-vs-prescriptive-analytics.html), so I *may* still revisit this and write scripts to get SolidFire metrics or other data to HEC on a continuos basis, and analyze it there.

If you're interested in Splunk infrastructure, check my posts related to E/EF-Series, NetApp's block storage platform most suitable for Splunk Hot/Warm/Cold Tier and even S3 SDS (if you don't have dedicated S3 appliances).

## Appendix A: JSON format

Your SolidFire JSON is in `event` (here, it's an abbreviated output of `Get-SFVolume -VolumeID 49` in JSON). 

Time and other stuff is what you need to add on your client before sending this to HEC. *If* there's current datetime in JSON response, you could calculate `time` from it. (`CreateTime` in JSON is volume create time.)

```json
{
    "time": 1699779505,
    "host": "prod.datafabric.lan",
    "source": "SolidFire 12.5",
    "event": {
        "VolumeID": 49,
        "Name": "solidbackup-volume-13-38",
        "AccountID": 7,
        "CreateTime": "2023-09-04T09:14:11Z",
        "VolumeConsistencyGroupUUID": "f5a31883-9f35-49ee-89b7-6374cd9cdb97",
        "VolumeUUID": "c93cb4b8-7328-449c-a8aa-ba8a521ecd3a",
        "EnableSnapMirrorReplication": false,
        "Status": "active",
        "Access": "readWrite",
        "Enable512e": true,
        "Iqn": "iqn.2010-01.com.solidfire:wcwb.solidbackup-volume-13-38.49",
        "ScsiEUIDeviceID": "7763776200000031f47acc0100000000",
        "ScsiNAADeviceID": "6f47acc1000000007763776200000031",
        "QosPolicyID": 2,
        "VolumeAccessGroups": [
            2
        ],
        "VolumePairs": [],
        "DeleteTime": "",
        "PurgeTime": "",
        "LastAccessTime": "2023-09-05T06:53:06Z",
        "LastAccessTimeIO": "2023-09-05T06:53:06Z",
        "SliceCount": 1,
        "TotalSize": 1073741824,
        "BlockSize": 4096,
        "VirtualVolumeID": null,
        "Attributes": {},
        "CurrentProtectionScheme": "singleHelix",
        "PreviousProtectionScheme": null,
        "FifoSize": 5,
        "MinFifoSize": 0
    }
}
```
P.S. Wait, what? `FifoSize` and `MinFifoSize`? Interesting. I didn't notice this before. That's kind of new-ish - it must have been added in [v12.3](/2021/04/20/solidfire-12.3.html), to help with snapshot replication in async replication setups. Find more about these two params [here](https://docs.netapp.com/us-en/element-software/api/reference_element_api_createvolume.html).
