# Minimizing ransomware risks for SolidFire data

How to better protect SolidFire data

## SolidFire vs. Ransomware

If you want best ransomware protection, consider ONTAP. There's a lot about it, so I won't rehash it.

Second, if you have SolidFire, that doesn't mean you're defenseless. I've never seen anyone write about that, so I decided to do something about it.

I won't make this post long long, but rather point out some obvious, although perhaps not well-known, features so that those who are interested can follow up on their own.

## SolidFire data protection in general

All SolidFire storage out there comes with the following features included at no charge:

- Snapshots
- Clones
- Replication
- Backup to S3
- Backup integrations

SolidFire is extremely easy to automate, so with the above it gives you decent protection from ransomwhare and other data loss on iSCSI clients.

## Snapshots

We all know what snapshots are and how they work.

What I often see among customers is they don't use them well.

One group is people without snapshots. Sometimes they forget, other times they didn't get to it, and so on.

Another group is people with manual snapshots taken only from vSphere or other client. These snapshots are not SolidFire snapshots, but they are, in fact, snapshots. Ransomware-wise, the problem happens when/if vSphere gets pwn3d, vSphere snapshots wiped, and data encrypted.

How big an effort are we talking about? 15 minutes of PowerShell. 

- Get a list of all volumes
- Loop over the list and create a snapshot schedule for each

For people who micro-manage, they could tag the volumes using SolidFire volume attribute, so that multiple schedules can be applied depending on the value of the tag. Here's a simple and simplified example:

- no tag present or tag value equals "low": one snap every 12 hours, keep 4
- tag value equals "high": apply three schedules
  - schedule 1: one snap every 15 mins, keep 8
  - schedule 2: one snap every 4 hours, keep 4
  - schedule 3: one snap daily, keep 2

This literally takes one day to write and can run in a scheduled fashion to take care of all volumes.

I have several blog posts about using the SolidFire API, but one specific example that I'd like to highlight is [this one](/2020/11/28/powershell-set-sfqosexception.html) - it shows how to use SolidFire volume attributes which is what I suggest in this section.

Snapshots are not backups. If they're admin-immutable they will protect you from ransomware, but not from catastrophic storage failures, so we need either replication or backup for that.

## Clones

SolidFire clones are the same as snapshots, in fact they're "write-able snapshots" the moment they're created.

If you make a clone and do not present it to any client, that clone will:

- Take some metadata space (so you need to watch your free metadata capacity if you use this at scale)
- Be protected from deletion even if the original volume gets deleted (which can happen through vSphere Plug-in, and would delete all snapshots of that volume as well)

vSphere admin is also a SolidFire admin. How do we deal with that? More on that in RBAC section below.

If one clones a SolidFire volume or a snapshot and assigns the volume to another SolidFire storage account (let's say the account is called "backup"), that protects the volume from malicious take-over of the original storage account *if*, as long as the other admin is not taken over. 

Maybe this sounds insecure because that is exactly what happens (admin accounts get owned across the board), but there are ways to minimize that risk, for example by proxying API requests on a TLS-terminating reverse proxy/firewall, or by employing policies in vSphere or elsewhere.

## Capacity management for snapshots and clones

SolidFire doesn't "reserve" capacity for snapshots or clones.

This is good in the sense you don't have to commit to wasting capacity that you may not use, but it also means more responsibility for your use of available data and metadata capacity.

Due to the RF2 in Helix and N-1 approach to node HA, you should always ensure you have enough free capacity in both data and metadata to sustain the loss of a single node.

Example:

- one node fails in an eight-node cluster
- we should keep data and metadata utilization below 85%

Snapshots don't take extra capacity but changed data blocks do. As we can't see how much, it's best to simply monitor storage utilization and not take more snapshots than necessary. Snapshots can be up to 32 per volume.

Clones take the same "data change" space for data, plus a full copy of metadata. A 1TB volume may use up to 4GB in metadata, and a clone of that volume may take 4GB of metadata.

With clones we want to monitor the total number of volumes in the cluster. That number can be found in the documentation - it depends on the SolidFire version, but it's hundreds per each SolidFire storage node.

How hard is it to monitor these things? Here's a fairly complete list:

- see it in the Web UI
- see it in ActiveIQ
- send it to NetApp Cloud Insights
- get it a single command from PowerShell or Python 
- scape and send it to Prometheus with SolidFire Exporter
- send metrics to Elasticsearch and use Kibana to watch and set alerts
- send metrics to Graphite and use ready-made Grafana charts and alerts (SF Collector)
- receive alerts via SNMP v3 or v2

So it's not hard at all, and everything except Cloud Insights is free. I've blogged about almost all of these here, so you can search this blog to find out the details. 

One area of monitoring that I haven't had time to blog about is performance alerts: we could watch dedupe ratio and the rate of storage APIs and use ML/AI in Elasticsearch and similar applications to alert us to unusual behavior on clients (consistently high IOPS) and storage (declining storage efficiency, which takes up to 1 hour to reflect in SolidFire storage statistics so it's delayed, and API rate especially create/delete API calls which my Elasticsearch posts shows how to collect).

## Replication

One SolidFire can replicate to another. There is a NetApp Technical Report ("TR") on this topic out there, but I don't know if it's still posted or linked. In any case:

- This replication can be enabled and disabled on demand
- Destination cluster can take snapshots of replica volumes using a lower frequency but longer retention (say, 1 snapshot per day, retain 30 days)
- If you have a replica cluster, generally (especially async and snapshot-only replication) it has enough bandwidth for backup to S3 as an additional measure of protection. Although SolidFire backup to S3 isn't a very powerful feature, it does work.

It can also replicate to ONTAP using the SnapMirror API, although that replication uses SnapMirror and has no on-wire encryption, so it's generally secure on protected networks such a isolated VLANs.

## Backup integrations

For this see my "awesome-solidfire" repo on Github. Some vendors integrate with SolidFire snapshots, others don't provide direct storage integration (they integrate with VMware, but not with SolidFire, for example).

In some cases - and I've been encouraging users to take advantage of it, but it's still extremely underutilized - applications (especially NoSQL databases) and containers ([Velero](/2022/09/30/velero-backup-192.html) and other) have built-in data protection, and you don't even need any storage integration.

SolidFire Volume QoS can be easily adjusted upward for the duration of a backup - see the link and example in the Snapshot section above.

As far as the SolidFire Backup to S3 feature is concerned, it can be easily automated - I wrote about it on this blog so you can search this blog for "backup to S3" and find links to sample scripts. It doesn't work as well as commercial software so it may not be able to take care of all workloads, but it can be used for smaller volumes especially if you want a low cost approach. Because small volumes tend to have low QoS settings, see that approach to automating QoS adjustments during backup mentioned earlier.

## RBAC

SolidFire has very basic RBAC features, as roles do exist, but apply across the cluster.

That means the admin of vSphere Cluster 1 with SolidFire Plug-in is also the admin of all other volumes. There are ways to protect and segregate access with vSphere (there's a PCI DSS white paper on NetApp HCI, you may find it on a search engine), but it's hard and complicated. On the other hand, security is usually hard and complicated.

A simple way to lower this "risk" without sophisticated procedures is to not use plugins, but then storage mangement becomes manual.

Another way is to strictly manage your management network and limit access to the SolidFire management API. First, use VLANs, and second, you can "proxy" management actions to another component such as Ansible Tower or an API proxy such as commercial API proxies (example: [NGINX+](/2020/12/14/netapp-hci-rancher-ingress-nginx-plus-lets-encrypt.html#use-n-to-reverse-proxy-multiple-rancher-clusters-or-services)).

- How a well-segregated LAN looks like? See [these screenshots](/2020/12/24/netapp-hci-network-segregation.html)
- [DIY RBAC with Ansible](/2022/02/14/middle-class-rbac-solidfire-ansible.html)
- [DIY RBAC with PowerShell](/2023/01/17/automation-with-powershell-server.html)

In the Clones section I mentioned API firewalls - those are a very good solution for this, because when TLS is terminated on them, they can reject requests from certai IPs, inspect requests on the fly and more. It's cheaper to pay for these than do it for free, but I like that approach. The NGINX+ link above gives some hints of how that works.

## Summary

If you have SolidFire, you can probably improve your security posture at little to no extra cost.
