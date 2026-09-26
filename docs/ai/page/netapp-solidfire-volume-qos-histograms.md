# Make use of storage QoS histograms on NetApp SolidFire

aking sense of storage QoS histograms on NetApp SolidFire

- [Intro](#intro)
- [About QoS histograms on NetApp SolidFire](#about-qos-histograms-on-netapp-solidfire)
- [Request](#request)
- [Response](#response)
- [What *are* these things?](#what-are-these-things)
- [Bucket naming](#bucket-naming)
- [Should you use QoS histogram information?](#should-you-use-qos-histogram-information)
- [Role of metrics collection](#role-of-metrics-collection)
- [Conclusion](#conclusion)

## Intro

As I've been [working on SFC v2](/2024/05/03/netapp-solidfire-collector-next.html) I've been playing with SolidFire's QoS histograms and I thought I should write a post about it (why, more on that below).

Some SFC users will use QoS histograms but maybe even those who use other tools (or don't use any) can make use of the API call in their own environment.

Secondly, QoS histograms aren't exposed in the SolidFire UI, so unless you looked at the API you may not even know it existed.

## About QoS histograms on NetApp SolidFire

In my opinion Volume QoS Histograms - as they're called - is one of the worst-marketed features on NetApp SolidFire. 

What do do they?

Well, [here](https://docs.netapp.com/us-en/element-software/api/reference_element_api_listvolumeqoshistograms.html?q=Volume) it says:

> ... generate a histogram of volume QoS usage for one volume or multiple volumes. This enables you to better understand how volumes are using QoS.

That's about it.

If you're looking for help on how to make sense of them or how to use them to improve storage management, you're out of luck.

## Request

We request QoS histogram for one or more volumes. If you have 5 volumes you care about you maybe provide something like [1,24,33,41,57] instead of [1]. 

```json
{
    "method": "ListVolumeQoSHistograms",
        "params": {
            "volumeIDs": [1]
        },
    "id": 1
}
```

## Response

This is where things start to get funny. 

Here's what the response means (same page from the documentation):

> A list of objects describing volume usage for one or more volumes.

That's it. Go figure...

To keep it short, I'll show just a response with only one histogram dictionary, `belowMinIopsPercentages`, out of six available for each volume (others were removed from response).

```json
{
    "id": 1,
    "result": {
        "qosHistograms": [
        {
            "histograms": {
            "belowMinIopsPercentages": {
            "Bucket1To19": 2406,
            "Bucket20To39": 3,
            "Bucket40To59": 0,
            "Bucket60To79": 4,
            "Bucket80To100": 0
            }
            }
        }],
        "timestamp": "2024-05-29T15:00:53.799575Z",
        "volumeID": 1
    }
}

```

## What *are* these things?

These are the six dictionaries with bucket-named KV pairs that you get back for each volume.

Unlike other SolidFire API objects, there's nothing meaningful in the docs that can help you do much with it without experimentation. 

Of course, it's not ancient Egyptian, it's just English, but still... Let's see...

- belowMinIopsPercentages - tells you how much time the volume has spent below Min QoS setting level. Example: if a lot of time is spent below Min IOPS, maybe QoS settings for the volume are too generous.
- minToMaxIopsPercentages - same, but for time spent in the "right" range, between Min & Max
- readBlockSizes - breakdown by block sizes in read requests
- targetUtilizationPercentages - this one is more tricky. Below 100% is below Max IOPS. Above 101 is bursting. 
- throttlePercentages - how much time volume is being QoS-throttled (meaning, hitting maximum and exhausting all, or not having any, Burst IOPS)
- writeBlockSizes - like read above

Once you've sort of figured that out, you start wondering about stuff. 

If a volume is 10 months old and it was idle ("pre-prod testing") for 6 months, then it enters production and it looks like it's spent most of time idling below MinIOPS, is that actionable?

Then you come up with a few more questions like these and realize you'd really want to see a 15-minute video or read a nice blog about this which may help you save time and avoid mistakes.

But there's nothing, even in the API documentation, which is why I say it's one of the worst marketed features of this product (rivaling Backup to S3).

## Bucket naming

It doesn't take many seconds to realize the bucket names are a disaster. 

```json
"readBlockSizes": {
    "Bucket131072Plus": 2690,
    "Bucket16384To32767": 8,
    "Bucket32768To65535": 2,
    "Bucket4096To8191": 12,
    "Bucket512To4095": 142,
    "Bucket65536To131071": 1,
    "Bucket8192To16383": 4
}
```

It's hard to read and sorts in the wrong order with the largest bucket at the top, followed by the smallest bucket. Terrible!

## Should you use QoS histogram information?

If you haven't thought about using it, you probably don't need it.

But if you're curious, I'll give one example that may increase your interest.

This is volume ID 134 which happens to be a SQL Server data volume (from the recent SQL Server 2022 post). 

writeBlockSizes tells me the great majority of all writes are 4-8 KiB.

![](/assets/images/solidfire_sfc_volume_qos_histograms_01_write_block_sizes.png)

Oh, and by the way, check out the bucket names (Bucket131072Plus is b_131072_plus here) - they are correctly displayed *at the bottom* of the list. Because they sort correctly, you don't even need to read the values in bucket names (although I find them more readable, too).

Below that we have readBlockSizes, where tiny-to-small blocks dominate.

![](/assets/images/solidfire_sfc_volume_qos_histograms_02_read_block_sizes.png)

Now you may think - what's the point, it's just a bunch of horizontal lines. But that's just for one hour, and lines can go up and down when and if composition of IO patterns changes. For an example, you may notice changes after an application update and suggest changing QoS policy for the volume.

The two visualizations above use regular Time Series from Grafana. You just pick a volume ID (I "hardcoded" the ID in my visualization query but you could have volume names in a drop-down list instead) and add all six buckets to pull those values.

I suppose viewing a whole bunch of volumes at once could be messy, and in any case I always prefer to watch "key" volumes/apps rather than the entire cluster.

This what unscrewed bucket names look like in Grafana when querying InfluxDB populated by SFC v2: they look good. And when you select them, they're sorted in the proper, ascending order. Also there's a `tag::name` (not included in `ListQoSHistograms` response), added for convenience in selecting volume by name, either here or in the panel if you want to make it interactive. (The volume names aren't sorted in ascending order because InfluxDB has these measurements sorted based on volume IDs. If that's inconvenient - it might be if you have more than 20-30 - you could probably create a custom query that sorts them right.)

![](/assets/images/solidfire_sfc_volume_qos_histograms_04_volume_selection.png)

Below we have belowMinIopsPercentages. This uses Grafana Histogram visualization. 

It's hard to decipher and because most people view these in charts rather than spreadsheets, this is another reason why tutorials or guides about this should have been part of "this is how to do it" which was never created.

![](/assets/images/solidfire_sfc_volume_qos_histograms_03_time_spent_below_min_iops.png)

What does this mean? Let's try JSON.

```json
"belowMinIopsPercentages": {
    "Bucket1To19": 1034,
    "Bucket20To39": 73,
    "Bucket40To59": 13,
    "Bucket60To79": 17,
    "Bucket80To100": 2
}
```

Huh... Okay. I give up.

Let's look at the other one, `minToMaxIopsPercentages`, for the same volume.

```json
"minToMaxIopsPercentages": {
    "Bucket101Plus": 832,
    "Bucket1To19": 8,
    "Bucket20To39": 21,
    "Bucket40To59": 22,
    "Bucket60To79": 193,
    "Bucket80To100": 1462
}
```

Hmm. For this one I'd say "out of some 2,500 samples taken, 832 were taken during the periods when volume 134 was bursting".

For belowMinIopsPercentages, I'm not sure and it's not documented. I created a documentation issue on Github, so maybe the document will be improved.

## Role of metrics collection 

When you start thinking about how you may want to use that information, you are surely going to come up with more questions. 

Such as, do these metrics show "last 60 days"? Or go back to the time the volume was created? Why do two volumes created at the same time have a different number of samples?

Then there's also the question of watching QoS histogram changes over time. 

- First, I'm not sure what "down-sampling" does to these numbers and whether they have any meaning once down-sampled
- Second, if you don't collect them like SFC or other utilities do, it may be hard to find out when QoS was last changed and whether that alone invalidates QoS histogram charts preceding that change
- Third, with volume performance statistics you can also see how changes in workload impact IO latency, etc. 
- Fourth, if volume performance statistics are down-sampled as well, there are more questions about the validity of anything you see that way

These answers can be found with some effort, but that takes time and effort.

Without having them I'd still say these metrics can be useful and actionable, but I'd only reference data that hasn't been down-sampled (and averaged) until I know how that affects visualizations.

In terms of cost, currently with SFC v2 (still being worked on) I'm seeing just about 1 MB/day with 32 volumes and one (SF Demo VM) node, so retaining full metrics for 30 to 60 days should be easy. Compared to HCI Collector I collect less data and less frequently when it comes to data that doesn't need to be pulled every 60 seconds, so SFC v2 makes collecting QoS histogram data effortless and affordable .

Down-sampling could be avoided even past that any built-in time limit: use SQL to dump older data to a file, upload backups to S3 or some other low-cost location, keep it there for a year and download when running monthly analytics. But that is probably not necessary.

Maybe the greatest value and simplest use case for QoS histograms is for new workloads that are being onboarded. QoS histograms combined with QoS policies make it simple for the SolidFire administrator to optimize QoS policies with very little effort within the first week or two of new workload coming online.

## Conclusion

Hopefully these examples answer some of the questions for you.

If we can guess what QoS histograms mean, they can be useful. As an example, simply being able to know IO request sizes over time is nice. I know it can be done from each host, but this is much easier and you don't have to ask the DBA or application owner to do anything.

But there are also unanswered questions that may or may not be answered in coming months.

As far as SFC v2 is concerned, QoS histograms will be included and available. They were/are in HCI Collector as well, but they used to work very slowly and were scheduled the same way as everything else, once every 60 seconds (by default). In SFC v2 it takes less than 1 second to make the API call for QoS histograms, parse JSON response, unscrew the bucket names and send data to InfluxDB. Because QoS histograms can be scheduled separately from the rest, if you run it once every 600 seconds it could still finish in time even on SolidFIre clusters with thousands of volumes.
