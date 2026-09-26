# Monitor wear level of NetApp E-Series SSDs with API and CLI

Monitor wear level of NetApp E-Series flash drives via the API and from the CLI

At some point (I couldn't find the exact release in the documentation, but I've found it v11.52) E-Series Engineering added SSD wear level metrics to the SANtricity API.

Recently I made a [short post](/2022/12/21/eseries-ssd-wear-indicator-santricity-117.html) on where to find that indicator in the SANtricity Web UI.

This post is about getting the same information from the API or CLI.

Using the CLI:

```sh
show allDrives driveMediaType=SSD currentSsdWearLifeStats;
```

The CLI might return many entries like this one as a result:

```raw
CURRENT SSD WEAR LIFE STATISTICS FOR STORAGE ARRAY: EF280
   Collection timestamp:                           12/19/22 9:14:59 AM CST
   DRIVES------------------------------

      Drive at Tray 99, Slot 2

         World-wide name:                          58:ce:38:ee:20:4e:e3:69:00:00:00:00:00:00:00:00
         Serial number:                            78V0A006Z004
         Available LBA mapping resource count:     1976356033800
         Used LBA mapping resource count:          7494916962944
         Percent available provisioning resource:  20%
         Host write block count:                   589774108171
         Total NAND write blocks count:            19853141880064
         Power on hours:                           35540
         Percent endurance used:                   22%
         Percent endurance remaining:              78%
```

Using the API, query physical drives:

```sh
curl -X GET "https://${API_IP}:8443/devmgr/v2/storage-systems/${WWN}/drives"
     -H  "accept: application/json"
```

You’ll get a big JSON response in return.

These are just the relevant KV pairs from one of the drives.

```json
{
"ssdWearLife": {
    "averageEraseCountPercent":4,
    "spareBlocksRemainingPercent":100,
    "isWearLifeMonitoringSupported":true,
    "percentEnduranceUsed":4},
"driveMediaType":"ssd"
}
```

This one has clearly been only lighly used.

As “isWearLifeMonitoringSupported” indicates, not all disk drives have these metrics: only SSD and NVMe drives that support this metrics do. (And no, I don't know which drives may not support it; E-Series SSD and NVMe drives involve many models and sizes and I would expect that almost all if not all have firmware that provides this information.)

These metrics could be added to E-Series Performance Analyzer or your own script or monitoring solution.

In EPA v3.1 SSD wear level metrics are gathered for flash media managed by SANtricity OS 11.70 (older versions may or may not work). Simple chart visualization of that data:

![SSD wear level monitor in EPA v3.1 preview](/assets/images/epa-ssd-wear-level-monitor.png)

(Why is wear level uneven across disks in the same array? Because different disks participate in different groups/pools and have different workloads.)

A simple way to do something with it without writing complicated scripts could be to get wear level figures, find the highest value figure and alert if it’s over 50 (50%), for example.

```sh
echo $response | jq  '.[].ssdWearLife? | .percentEnduranceUsed'
```
