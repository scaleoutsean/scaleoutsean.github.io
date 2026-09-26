# MCP Server for NetApp E-Series arrays

Use cases for MCP server for NetApp E-Series arrays

## Introduction

As I'm gradually getting out of "EPA hell" (weeks of work on E-Series Performance Analyzer 3 and 4), I'm thinking about other things I could do.

Months ago I created a simple [proof-of-concept MCP server for SolidFire](/2025/05/20/get-started-with-netapp-solidfire-mcp-server.html), then [another, slightly more featured one](/2025/06/05/simple-filesystem-and-s3-analytics-and-mcp.html) for file system analytics, and I've been wanting to do more. 

E-Series seems like a "legacy" platform which needs no MCP, but maybe that's exactly why it needs MCP?

## What do we need?

What would I like to see in an MCP server for E-Series?

- Low-risk, low-stake API automation, so that I don't have to write my own
- Storage analytics

Well, that's basically it. What does that mean, though? Examples:

- Create LUNs for a cluster of hosts (Kubernetes, LXD, KVM). It's not much, but it's also low-risk. 
- Analyze and optimize storage 

## Creating LUNs

On E-Series, that is easy. 

You usually have very few choices as disk groups (or disk pools) have been created. There's no way to enable efficiency or even thin provision, so it's mostly about picking the right size. 

You also don't do it very often - if you need to do it often, usually a smarter way is to use a volume manager such as LVM and manage volumes on the host. 

However, in recent years (mostly because of EPA) I've been working with E-Series on regular basis and I miss the ease of use - mostly related to creating volumes - that I have on SolidFire. Most recently, I realized I'd love to have a simple MCP server to take care of that. I've never liked Ansible and E-Series PowerShell module was killed [years ago](/2024/03/28/netapp-santricity-powershell-module.html), so perhaps it's time to consider MCP Server for E-Series?

## Analytics and optimization

This helps us identify workload patterns and opportunities for performance optimization. 

With SolidFire, optimization is mostly around QoS and from my experience there isn't much you can do with MCP there. I've seen many overprovisioned and underprovisioned volumes (in terms of storage performance), but I've never seen anyone who said they'd like to automate right-sizing. NetApp Auto-Support has QoS analytics features, but it was advisory and users seemed to be too busy to look until they hit a problem.

E-Series, is much more tunable and it's easier to make mistakes. At the same time, many E-Series users have very sensitive performance requirements. This is where MCP can help. Now that [EPA 4](/2025/08/11/epa-4-beta.html) seems is making progress, I may be able to get a lot of performance details exposed to AIs (see the post, but basically through InfluxDB and its InfluxDB Explorer) and I'm curious how many useful details I'll be able to get out of those metrics. 

For SolidFire I recently finished SolidFire Collector that uses InfluxDB 3, but I'm still looking for something interesting that I could do with that data (one possibility is automation, but more on that in another post). For E-Series, I think there's more potential. Some examples:

- SANtricity Flash Cache - it's a read-caching feature for which there's a Technical Report which tells you when it should be enabled (basically when read workload is > 85%), but then you have almost nothing to work with. You can see current Flash Cache read hit rate the UI, but ain't nobody got time for that. But if I can gather related metrics in InfluxDB, correlate, watch cache hit rate over time, and even use MCP to instruct AIs to do all that work for me. I could even come up with a schedule to enable/disable Flash Cache based on predictive analytics!
- RAID level performance comparison - while right-RAID-ing is no longer popular, it's still relevant. It's hard to move data from one RAID to another, and many users don't even have multiple RAID groups and default to all-R6 or DDP or all-R5, I think a decent number still has multiple RAID levels and would be interested in optimizing those because on RAID 10 performance is [much better](/2023/10/08/raid1-in-netapp-eseries-ddp.html), while RAID 6 is much cheaper. Even if you have multiple RAID levels, moving workloads from one to another may be hard (in case of physical hosts, for example), but for VMs and containers it's easy.
- E-Series allows you to pick segment size and other per-LUN performance parameters. That's easy. What is hard is to figure out - even if you have just one workload - whether you picked the right one. It's also hard to evaluate different options if you have to do it manually and have no way to collect data.

There are several examples of this nature and I'll revisit this once EPA 4 is out and I have some data to work with.

## Volume Ops with MCP

That's a combined "create LUN" + analytics workflow that I am now most interested in.

I started looking into this yesterday and here's how it can work:

- SANtricity
    - If your host isn't already added, list existing host groups or hosts
    - Add your host to a group (for HA, clusters, etc.) or individually (stand-alone)
    - List hosts or groups again to get its host or group ID
    - List storage pools (that's RAID groups and DDPs in SANtricity API)
    - Pick where you want to create LUN (based on desired RAID level, available capacity maybe)
    - Create volume in specific storage pool
    - List volumes to find new volume's WWN
    - Present volume to your host or host group
- Host
    - Rescan storage (iSCSI, FC, NVMe)
    - Login to target with matching WWN
    - Format LUN or add to volume manager's control
    - Create filesystem (or logical volume)
- Do stuff, and after it's done, delete everything

As you can see, even though in the UI it's not hard, when using the API that's a lot of steps because the API is archaic. In SolidFire there's just one (or two, if you check available cluster capacity and IOPS beforehand).

And responses can be hefty. Example for `GET` hosts:

```json
[
  {
    "hostRef": "84000000600A098000E3C1B000302F0C650C2668",
    "clusterRef": "0000000000000000000000000000000000000000",
    "label": "Ubuntu_2204",
    "isSAControlled": false,
    "confirmLUNMappingCreation": false,
    "hostTypeIndex": 28,
    "protectionInformationCapableAccessMethod": true,
    "isLargeBlockFormatHost": false,
    "isLun0Restricted": false,
    "ports": [],
    "initiators": [
      {
        "initiatorRef": "89000000600A098000F6371400302A3E650C2A5B",
        "nodeName": {
          "ioInterfaceType": "iscsi",
          "iscsiNodeName": "iqn.2004-10.com.ubuntu:01:e7f6625b59c",
          "remoteNodeWWN": null,
          "nvmeNodeName": null
        },
        "alias": {
          "ioInterfaceType": "iscsi",
          "iscsiAlias": ""
        },
        "label": "Ubuntu_2204_1",
        "configuredAuthMethods": {
          "authMethodData": [
            {
              "authMethod": "none",
              "chapSecret": null
            }
          ]
        },
        "hostRef": "84000000600A098000E3C1B000302F0C650C2668",
        "initiatorInactive": false,
        "initiatorNodeName": {
          "nodeName": {
            "ioInterfaceType": "iscsi",
            "iscsiNodeName": "iqn.2004-10.com.ubuntu:01:e7f6625b59c",
            "remoteNodeWWN": null,
            "nvmeNodeName": null
          },
          "interfaceType": "ib"
        },
        "id": "89000000600A098000F6371400302A3E650C2A5B"
      }
    ],
    "hostSidePorts": [
      {
        "id": "89000000600A098000F6371400302A3E650C2A5B",
        "type": "iscsi",
        "address": "iqn.2004-10.com.ubuntu:01:e7f6625b59c",
        "label": "Ubuntu_2204_1",
        "mtpIoInterfaceType": "ib",
        "name": "Ubuntu_2204_1"
      }
    ],
    "id": "84000000600A098000E3C1B000302F0C650C2668",
    "name": "Ubuntu_2204"
  }
]
```

As you finish SANtricity-side steps, you end up with a bunch of cryptic entries like this one:

```json
{
    "lunMappingRef": "8800000077000000000000000000000000000000",
    "lun": 9,
    "ssid": 27,
    "perms": 15,
    "volumeRef": "02000000600A098000E3C1B0000034D8689951AF",
    "type": "host",
    "mapRef": "84000000600A098000E3C1B000302F0C650C2668",
    "id": "8800000077000000000000000000000000000000"
}
```

That's your "volume mapping" entry.

At least initially, it's good to double-check in the Web UI:

![SANtricity volume WWN](/assets/images/mcp-eseries-created-lun-wwn-3600a098000e3c1b0000034d8689951af.png)

With it, you can identify the LUN in `multipath -ll` output: look for `3` + (most of) `volumeRef` string.

```sh
3600a098000e3c1b0000034d8689951af dm-12 NETAPP,INF-01-00
size=203G features='3 queue_if_no_path pg_init_retries 50' hwhandler='1 alua' wp=rw
`-+- policy='service-time 0' prio=50 status=active
  |- 17:0:0:9 sdae 65:224 active ready running
  `- 15:0:0:9 sdal 66:80  active ready running
```

Now we can use `/dev/mapper/3600a098000e3c1b0000034d8689951af` and complete our workflow.

My immediate use case for this is "DevOps". Well, not really, but more like LabOps. 

I'd like to be able to avoid dealing with all these steps and just ask for a 100G R1 LUN mounted with XFS.

I'd obviously have to have some MCP on the host as well, to complete host-side work. SANtricity has [Ansible host-side module](https://docs.ansible.com/ansible/latest/collections/netapp_eseries/santricity/na_santricity_host_module.html) which can do that for us.

But I don't like monkeying around with Ansible and even if I did like it, how could I even know where I want to create a volume? 

No, I don't want to script my own AI in Python. If-then-else. I want to offload that to MCP and let an AI figure it out. I'm not deploying SAP HANA, I'm just creating one LUN for a lab workload that I'll destroy tomorrow.

I'd like to be able to type these instructions in 2 minutes and return the next morning to check the result.

- Log actions to a file
- Deploy E-Series Performance Analyzer stack with data on a 10GB disk formatted with XFS and created on storage pool with most capacity
- Run a sequence of tests with docker-compose.yaml from this Github URL
- Each test should run 3 times on 100G RAID 1, RAID 6, RAID 0 volume. Re-run failed tests while keeping logs. Try to fix any problems on your own
- Record start/end time of each job, generate a comparison and produce a detailed analysis based on test results and EPA measurements
- If tests complete successfully, post logs and results to S3, and destroy all resources logged in file by removing them in reverse. Else, wait for me to take a look

That's what I want. Simple Volume Ops and analytics.

Maybe I'll have to do it step by step until I also have AI agents, but even that would be okay.

## What's next

I have gathered all the individual steps, now I just need to turn them into something that works in useful ways.

There are challenges already (and I haven't even started): I realized I don't have access to GPUs in the lab, so I'll have to find an offline, CPU-based model that hopefully isn't useless. So it will take a while. And I should finish EPA 4 first, because that's where bulk of useful findings should come from.

The combination of more detailed performance insights and AI-driven automation is helpful even to users of harder-to-automate storage systems. 

The other day I wondered if AI narrowed the manageability gap for older systems. I concluded it hasn't (yet). 

I think what has happened is twofold:

- Hard-to-automate systems can be automated to a degree
- Easy-to-automate systems can be almost completely automated

With SolidFire, I think I could probably automate clusters for autonomous failover and failback with Kubernetes. 

I don't think that will be possible for E-Series anytime soon, but what *is* achievable is still very useful.

## Appendix A - Updates

- **October 11, 2025:** - Completed Proof-of-Concept implementation of `easy-e`, an MCP server for E-Series. How it works:
  - Tools - tools can create volumes of desired RAID type and size on DDP, present them to defined host, select a workload/benchnmark (several preconfigured workload profiles are available) and run perforemance tests on these volumes. This is all automated: LUN creation, presentation, testing, and result comparison. Both SANtricity and host automation are fully functional. It uses SANtricity API and passwordless SSH, so MCP server can run on `localhost` attached to SANtricity or any client that can access SANtricity and a host connected to it. Available volume selection is currently RAID level (R1, R6), but can be easily expanded 
  - Agents - TODO item at this time. I'll work on this later if I find someone interested in using this. The problem is I don't have hardware where meaningful tests can be done. But I have in mind two agents, one runs things, another tells it what to do. State and performance data would be stored in [ESC](/2025/10/07/ecp-eseries-performance-analyzer-aka-collector.html) where I already have all relevant configuration data and can watch and compare system settings with results, which would be required for unattended testing

![MCP Easy-E in action](/assets/images/mcp-easy-e-01.png)
