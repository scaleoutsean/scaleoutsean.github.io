# Getting SolidFire volume details with Powershell and Python

Getting volume information from SolidFire via the API or CLI

Just a few examples for those who struggle to get started.

Volumes have other properties, of course, but names, IDs and sizes are what most people want to get. Feel free to extract other details as you see fit.

It is recommended to create a dedicated read-only cluster admin for use with reporting-style (that is, read-only) scripts. This partially limits the security exposure in the case of credentials leak.

## PowerShell Tools for SolidFire

Install the module from PS Gallery. Current version works with both PS 5.1 and PS 7.

```powershell
# connect
# Connect-SFCluster 192.168.1.30 -Username admin -Password adminP4SS
$vols = Get-SFVolume
foreach ($v in $vols) { 
    Write-Host "ID:", $v.VolumeID, "Size (bytes):", $v.TotalSize, "Name:", $v.Name
    }
```

Output:

```
ID: 21 Size (bytes): 5000658944 Name: db
ID: 23 Size (bytes): 2000683008 Name: garbage
ID: 24 Size (bytes): 2000683008 Name: junk
ID: 25 Size (bytes): 1073741824 Name: dr-test
```

## SolidFire Python SDK

Obviously you must [install the SDK first](https://solidfire-sdk-python.readthedocs.io/en/latest/solidfire.html) and have Python 3 installed.

```python
from solidfire.factory import ElementFactory
sfe = ElementFactory.create("mvip-address-of-cluster", "username", "password")
for v in sfe.list_volumes(include_virtual_volumes=False).to_json()['volumes']:
    print(v['name'], v['volumeID'], v['totalSize'])

```

Output:

```
db 21 5000658944
garbage 23 2000683008
junk 24 2000683008
dr-test 25 1073741824
gin 44 2000683008
```

## SolidFire CLI (Python)

This one requires installation (`pip3 install --user solidfire-cli`) of SolidFire CLI (Python) and optionally the jq utility. (solidfire-cli is not supposed to produce output the pickle format by default, but that's what this version I have does, so I use the jq utility to get output as JSON objects.)

```sh
sfcli -m 192.168.1.34 -u admin -p admin volume list | jq '.volumes | .[] | {id: .volume_id, sizebytes: .total_size, name: .name}'
```

Output:

```json
{
  "id": 21,
  "sizebytes": 5000658944,
  "name": "db"
}
{
  "id": 23,
  "sizebytes": 2000683008,
  "name": "garbage"
}
{
  "id": 24,
  "sizebytes": 2000683008,
  "name": "junk"
}
```

You can create and use a defined cluster connections rather than specify connection details every time you run the CLI, but that's less secure in the sense that credentials may be exposed to people who can read your configuration file.

## List of disk drive assignments with Python SDK

This isn't about volumes but it came up recently so I'll just share it here as it can be adjusted for volume-related purposes (I used a volume listing by node to maximize parallelism in backup to S3 in a PowerShell script, for example; in that case list nodes and active iSCSI connections and from that I get which volume is active on which node). Anyway, for what it's worth, connect to SolidFire, create Element Factory and then:

```python
node_list = sfe.list_active_nodes().to_json()['nodes']
drive_list = sfe.list_drives().to_json()['drives']
for node in node_list:
    for drive in drive_list:
        if drive['nodeID'] == node['nodeID']:
            print("Drive", drive['driveID'], "is in chassis slot", drive['chassisSlot'], "of node", node['nodeID'])
````

Output:

```raw
Drive 1 is in chassis slot 1 of node 1
Drive 2 is in chassis slot 2 of node 1
Drive 3 is in chassis slot 3 of node 1
Drive 4 is in chassis slot 4 of node 1
```

Similar with SolidFire CLI:

```shell
sfcli drive list | jq '.drives | .[] | {id: .drive_id, slot: .slot, node: .node_id}' 
```

## Where to get more examples

- Python: see [the SDK docs](https://solidfire-sdk-python.readthedocs.io/en/latest/solidfire.html), and [sfcollector.py](https://github.com/scaleoutsean/hcicollector/blob/v0.7/sfcollector/solidfire_graphite_collector.py) (not high-quality code, but it kind of works)
- PowerShell: see the scripts in [awesome-solidfire](https://github.com/scaleoutsean/awesome-solidfire/blob/master/scripts/) and check the repo itself (there's also a link to another repo called solidbackup)
- Take a look at other posts tagged "automation", possibly view BRK-1055-2 mentioned in [Insight '21](/2021/10/24/solidfire-insight-2021.html) highlights
