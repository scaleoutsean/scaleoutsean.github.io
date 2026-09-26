# SSD Cache feature on NetApp SANtricity E-Series

How to configure SSD Cache, enable HDD volumes to use it, and monitor its performance

- [WTH is "SSD Cache"](#wth-is-ssd-cache)
- [Create SSD cache](#create-ssd-cache)
- [Configure HDD-based volumes to use SSD Cache](#configure-hdd-based-volumes-to-use-ssd-cache)
- [Summary](#summary)
- [API for monitoring](#api-for-monitoring)

**UPDATE:** See [updated](/2026/03/17/netapp-eseries-ssd-cache-update.html) post about this. Also, since 2026, E-Series Performance Analyzer gathers SSD Flash Cache metrics.

## WTH is "SSD Cache"

It's a feature that makes E-Series arrays store frequently accessed data from HDDs on faster flash disk drives.  

The documentation isn't very clear so I'm putting this post together.

The use cases for SSD Cache are read-intensive workloads such as reporting or analytics. SSD cache is read-only (from client perspective), so constant invalidation or eviction would render it useless. Generally we want to use SSD Cache with working sets of up to few TB (per array) when we have constant or at least long-lasting read-dominant activity on volumes enabled to use SSD Cache.

To use this feature on an E-Series array, you'll need:
- A hybrid array (you can't use SSD to cache SAS SSD data on SAS or NVMe SSDs)
- One or more non-QLC SSDs for cache (not too many - each array has a limit and the biggest array can cache 8TB of data)
- One or more volumes (clone volumes included) created on HDDs 

SSD cache - even when comprised of multiple SSDs - is not protected because it has no unique data. 

Even if you used 4 drives, they'd be like RAID0 - if a drive fails, SSD cache capacity drops, and nothing else happens. If the drive is replaced, SSD Cache will recover to its original size.

![](/assets/images/santricity_ssd_cache_eseries_04_ssd_cache_suspend_resume.png)

There can be only one SSD cache. If you decide to add more disks, select SSD Cache and "Add Capacity" to add additional SSDs. Just remember (before buying additional SSDs) that each array has a maximum and currently no array can use more than 8TB. 

## Create SSD cache

In the same place where we create RAID groups, pick "Create SSD cache" and pick up to the maximum your array supports. 

When creating SSD Cache you may be prompted to enable it for all qualified (HDD-based) volumes. If you have many such volumes and don't want to enable each one manually, agree. If you don't want many volumes to use this feature, then don't agree.

After that SSD Cache will appear in the list of volume groups and DDP (pools).

![](/assets/images/santricity_ssd_cache_eseries_01_ssd_cache.png)

## Configure HDD-based volumes to use SSD Cache

I didn't want SSD Cache to be enabled across the board, so I had to enable my volume manually.

Go to Volumes, find your volume, check on "Enable SSD Cache".

![](/assets/images/santricity_ssd_cache_eseries_02_volume_cache_settings.png)

After a while you can go back to VGs/Pools to find your SSD Cache, select it, and in the same drop down list (see it at the very top), select to View SSD Cache statistics.

![](/assets/images/santricity_ssd_cache_eseries_03_ssd_cache_performance_stats.png)

From this modal you can download that report as CSV file:

| Statistic               | Controller A | Controller B | Total     |
|:------------------------|------------:|-------------:|-----------:|
| Reads                  | 45827        | 40800        | 86627      |
| Writes                 | 34573        | 61200        | 95773      |
| Cache hits             | 57084        | 27540        | 84624      |
| Cache hits (%)         | 71           | 27           | 46.4       |
| Cache allocation (%)   | 63.9         | 92.3         | 77         |
| Cache utilization (%)  | 77           | 71           | 73.7       |
| Read blocks            | 45827        | 40800        | 86627      |
| Write blocks           | 34573        | 61200        | 95773      |
| Partial cache hits     | 22512        | 21420        | 43932      |
| Partial cache hits blocks | 22512     | 21420        | 43932      |
| Cache misses           | 8844         | 17340        | 26184      |
| Cache miss blocks      | 8844         | 17340        | 26184      |
| Populate actions(Host Reads)) | 3207 | 2856          | 6063       |
| Populate actions(Host Reads) - Blocks) | 3207 | 2856 | 6063       |
| Populate actions(Host Writes)) | 2420    | 4284      | 6704       |
| Populate actions(Host Writes) - Blocks) | 2420 | 4284| 6704       |
| Invalidate actions     | 1206         | 1530         | 2736       |
| Recycle actions        | 402          | 510          | 912        |
| Available bytes        | 2336317935289 | 1991615289099 | 4327933224388 |
| Allocated bytes        | 1493711466823 | 1838414113013 | 3332125579836 |
| Populated dirty bytes  |   59748458672 |  294146258082 |  353894716754 |
| User data bytes        | 1090409370780 | 1011127762157 | 2101537132937 |

When interpreting these statistics, we need to remember SSD Cache is read-only. It appears at least some of these figures are general controller statistics.
It could be that writes refer to pass-through writes that go directly to volumes cached by SSD Cache, or it could be that those are controller statistics. I think it's the former.

These stats shown here came from SANtricity simulator - they were randomly generated. For example, "Available bytes" is 4327933224388 bytes which is 4,030 GiB, but my SSD Cache is 3,566 GiB, which is obviously less. That's all right, it's a simulator, but don't try analyzing its data. 

Generally, on a real system with active SSD Cache, we'd like to see relatively low values in cache misses and dirty bytes, and on the volumes that use it, low write % (<5% when running ready-heavy analytics workloads).

The documentation has the details on these metrics [here](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/how-do-i-view-and-interpret-all-ssd-cache-statistics.html).

## Summary

If you have data on HDD volumes but the workload can benefit from read-only cache (that is to say, it's >80% read) and some space for at least one SSD disk drive, perhaps this feature can help you with reporting and such.

If your workload is write-heavy, but you have to create periodic reports that can benefit from SSD cache, you can enable and disable cache just prior to running such workloads. That can be done in the UI as shown above, or via the API. 

## API for monitoring

I may add this to E-Series Performance Analyzer at some point, but here's what I've been able to find in the API.

To view SSD cache:

```http
GET ​/storage-systems​/{system-id}​/flash-cache
# Retrieve the FlashCache, if it exists.
```

Query:

```sh
curl -X GET "https://127.0.0.1/devmgr/v2/storage-systems/1/flash-cache" -H  "accept: application/json"
```

Response when it's configured:

```json
{
  "wwn": "3233343536373839303134343000000000000000",
  "flashCacheRef": "3233343536373839303134343100000000000000",
  "flashCacheBase": {
    "label": "SSD_Cache",
    "status": "optimal",
    "configType": "filesystem",
    "analyticsStatus": "unknown",
    "analyticsCause": "none",
    "statusCause": "none"
  },
  "fcDriveInfo": {
    "flashCacheType": "readOnlyCache",
    "fcWithDrives": {
      "securityType": "enabled",
      "protectionInformationCapabilities": {
        "protectionInformationCapable": true,
        "protectionType": "type2Protection"
      },
      "usedCapacity": "3830029402112",
      "securityLevel": "unknown"
    }
  },
  "cachedVolumes": [],
  "driveRefs": [
    "01000000343932304D2007020025384500000004",
    "01000000343932304D2008070025384500000004"
  ],
  "name": "SSD_Cache",
  "id": "3233343536373839303134343100000000000000"
}
```

There's also a POST function to create it, but I need only GET for monitoring so I won't provide those examples.

Next, let's see some SSD Cache statistics.

```http
GET ​/storage-systems​/{system-id}​/flash-cache
# Retrieve the FlashCache, if it exists.
```

Request:

```sh
curl -X GET "https://127.0.0.1/devmgr/v2/storage-systems/1/flash-cache" -H  "accept: application/json"
```

Response:

```json
{
  "wwn": "3233343536373839303134343000000000000000",
  "flashCacheRef": "3233343536373839303134343100000000000000",
  "flashCacheBase": {
    "label": "SSD_Cache",
    "status": "optimal",
    "configType": "filesystem",
    "analyticsStatus": "unknown",
    "analyticsCause": "none",
    "statusCause": "none"
  },
  "fcDriveInfo": {
    "flashCacheType": "readOnlyCache",
    "fcWithDrives": {
      "securityType": "enabled",
      "protectionInformationCapabilities": {
        "protectionInformationCapable": true,
        "protectionType": "type2Protection"
      },
      "usedCapacity": "3830029402112",
      "securityLevel": "unknown"
    }
  },
  "cachedVolumes": [],
  "driveRefs": [
    "01000000343932304D2007020025384500000004",
    "01000000343932304D2008070025384500000004"
  ],
  "name": "SSD_Cache",
  "id": "3233343536373839303134343100000000000000"
}
```

Notice `cachedVolumes` is empty. 

Update your configuration to enable SSD Cache on a on volume (3233343536373839303134343300000000000000). Now `cachedVolumes` reflects that.

```json
{  
"wwn": "3233343536373839303134343000000000000000",
"flashCacheRef": "3233343536373839303134343100000000000000",
"flashCacheBase": {
  "label": "SSD_Cache",
  "status": "optimal",
  "configType": "filesystem",
  "analyticsStatus": "unknown",
  "analyticsCause": "none",
  "statusCause": "none"
},
"fcDriveInfo": {
  "flashCacheType": "readOnlyCache",
  "fcWithDrives": {
    "securityType": "enabled",
    "protectionInformationCapabilities": {
      "protectionInformationCapable": true,
      "protectionType": "type2Protection"
    },
    "usedCapacity": "3830029402112",
    "securityLevel": "unknown"
  }
},
"cachedVolumes": [
  "3233343536373839303134343300000000000000"
],
"driveRefs": [
  "01000000343932304D2007020025384500000004",
  "01000000343932304D2008070025384500000004"
],
"name": "SSD_Cache",
"id": "3233343536373839303134343100000000000000"
}
````

- View averaged volume statistics for a volume w/o SSD Cache (3233343536373839303134343800000000000000). (**NOTE**: ignore returned values here, both volumes are were completely idle!)

```sh
curl -X GET "https://127.0.0.1/devmgr/v2/storage-systems/1/analysed-volume-statistics/3233343536373839303134343800000000000000" -H  "accept: application/json"
```

Response:

```json
[
  {
    "observedTime": "2024-03-29T09:41:28.000+00:00",
    "observedTimeInMS": "1711705288000",
    "sourceController": "070000000000000000000001",
    "readIOps": 0.0011210679860913066,
    "writeIOps": 0.0001862318252065831,
    "otherIOps": 0.002626461477637265,
    "combinedIOps": 0.0013072998112978898,
    "readThroughput": 20555.157674309175,
    "writeThroughput": 0.0000022038310851775423,
    "combinedThroughput": 20555.15767651301,
    "readResponseTime": 1.590637093017075,
    "readResponseTimeStdDev": 1.5904477047645624,
    "writeResponseTime": 2.4837644161694494,
    "writeResponseTimeStdDev": 2.4837536139265914,
    "combinedResponseTime": 1.717867840008008,
    "combinedResponseTimeStdDev": 1.7177152369041442,
    "averageReadOpSize": 19225992786258.152,
    "averageWriteOpSize": 12408.64380407436,
    "readOps": 1918938,
    "writeOps": 318774,
    "volumeId": "3233343536373839303134343800000000000000",
    "volumeName": "2",
    "poolId": "040000006D039EA00044C2530000957960828C91",
    "controllerId": "070000000000000000000001",
    "workLoadId": "4200000001000000000000000000000000000000",
    "mapped": true,
    "readHitOps": 394516,
    "readHitResponseTime": 6.070696549696336,
    "readHitResponseTimeStdDev": 6.0706461801095735,
    "readHitBytes": 36893488143733430000,
    "writeHitBytes": 840660226,
    "writeHitOps": 67346,
    "writeHitResponseTime": 2.4682958750334096,
    "writeHitResponseTimeStdDev": 2.4682958750334096,
    "combinedHitResponseTime": 5.545415673945897,
    "combinedHitResponseTimeStdDev": 5.5453685734760985,
    "readCacheUtilization": 99.99999999581709,
    "writeCacheUtilization": 21.252659786115068,
    "flashCacheReadHitOps": 190,
    "flashCacheReadHitBytes": 2269690,
    "readPhysicalIOps": 0.00023048126495009105,
    "writePhysicalIOps": 0.00003934438975688903,
    "queueDepthTotal": 2614860,
    "queueDepthMax": 48,
    "readTimeMax": 134540,
    "writeTimeMax": 116900,
    "averageQueueDepth": 1.1685417962633262,
    "randomIosPercent": 84.67300528396862,
    "randomBytesPercent": 2.9776774913674366e-8,
    "cacheWriteWaitOpsPercent": 0,
    "cacheWriteWaitBytesPercent": 0,
    "prefetchHitPercent": 0,
    "fullStripeWritesBytesPercent": -1,
    "flashCacheReadThroughput": 1.2645547538929502e-9,
    "flashCacheReadResponseTime": 3.240157894736842,
    "flashCacheHitPct": 0.9999009869000458
  }
]
```

- View averaged volume statistics for a volume **with** SSD Cache (3233343536373839303134343300000000000000). (**NOTE**: ignore returned values here, both volumes were completely idle!)

```sh
curl -X GET "https://127.0.0.1/devmgr/v2/storage-systems/1/analysed-volume-statistics/3233343536373839303134343300000000000000" -H  "accept: application/json"
```

Response:

```json
[
  {
    "observedTime": "2024-03-29T09:41:28.000+00:00",
    "observedTimeInMS": "1711705288000",
    "sourceController": "070000000000000000000001",
    "readIOps": 1916.5761904761905,
    "writeIOps": 851.2142857142857,
    "otherIOps": 3292.4238095238097,
    "combinedIOps": 2767.790476190476,
    "readThroughput": 13.379674498240153,
    "writeThroughput": 7.341724445706322,
    "combinedThroughput": 20.721398943946475,
    "readResponseTime": 5.231222139678644,
    "readResponseTimeStdDev": 5.23116795986525,
    "writeResponseTime": 3.52132302313222,
    "writeResponseTimeStdDev": 3.5213194684025897,
    "combinedResponseTime": 4.705354821449463,
    "combinedResponseTimeStdDev": 4.705312293243358,
    "averageReadOpSize": 7320.139755665485,
    "averageWriteOpSize": 9043.96951693659,
    "readOps": 804962,
    "writeOps": 357510,
    "volumeId": "3233343536373839303134343300000000000000",
    "volumeName": "1",
    "poolId": "040000006D039EA00044BBAC0000AAD460828D52",
    "controllerId": "070000000000000000000002",
    "workLoadId": "4200000001000000000000000000000000000000",
    "mapped": true,
    "readHitOps": 124254,
    "readHitResponseTime": 5.183369291934264,
    "readHitResponseTimeStdDev": 5.183309213153392,
    "readHitBytes": 930219910,
    "writeHitBytes": 406945632,
    "writeHitOps": 33924,
    "writeHitResponseTime": 3.128929135715128,
    "writeHitResponseTimeStdDev": 3.128929135715128,
    "combinedHitResponseTime": 4.742759170048933,
    "combinedHitResponseTimeStdDev": 4.742707591830926,
    "readCacheUtilization": 15.78668266188493,
    "writeCacheUtilization": 12.586039991342096,
    "flashCacheReadHitOps": 5908,
    "flashCacheReadHitBytes": 36374998,
    "readPhysicalIOps": 295.8428571428572,
    "writePhysicalIOps": 80.77142857142859,
    "queueDepthTotal": 702552,
    "queueDepthMax": 48,
    "readTimeMax": 134540,
    "writeTimeMax": 116900,
    "averageQueueDepth": 0.6043603630883152,
    "randomIosPercent": 25.296265200366115,
    "randomBytesPercent": 57.58927685355991,
    "cacheWriteWaitOpsPercent": -0.8725386157292773,
    "cacheWriteWaitBytesPercent": -0.29283911812573526,
    "prefetchHitPercent": 0,
    "fullStripeWritesBytesPercent": -1,
    "flashCacheReadThroughput": 0.08259500321887789,
    "flashCacheReadResponseTime": 5.461655721056195,
    "flashCacheHitPct": 0.9926605231054385
  }
]
```

- Getting SSD Cache performance metrics (after 30 mins of digging around, I think I've found it in SYMbol v1 API!):

```sh
curl -X POST "https://127.0.0.1/devmgr/v2/storage-systems/1/symbol/createFlashCacheAnalytics?controller=auto&verboseErrorResponse=true" 
  -H  "accept: application/json" \
  -H  "authorization: Basic YWRtaW46aW5maW5pdGk=" \
  -H  "Content-Type: application/json" \
  -d "{  \"flashCacheType\": \"readOnlyCache\",  \"flashCacheLabel\": \"SSD_Cache\"}"
```

Note that  you'll need to use the correct Authorization header for your own environment and a JSON object that reflects properties of your SSD Cache:

```json
{
  "flashCacheType": "readOnlyCache",
  "flashCacheLabel": "SSD_Cache"
}
```

Yeah, nah.

```json
{
  "errorMessage": "Processing struct 'devmgr.api.symbol.ObjectBundle'",
  "developerMessage": null,
  "localizedMessage": "Processing struct 'devmgr.api.symbol.ObjectBundle'",
  "retcode": "unexpectedError",
  "codeType": "devicemgrerror",
  "invalidFieldsIfKnown": null
}
```
