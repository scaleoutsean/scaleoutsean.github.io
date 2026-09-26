# Cassandra with SolidFire and E-Series

Notes on Cassandra with NetApp SolidFire and E-Series

## Introduction

Apache Cassandra is an open-source NoSQL distributed database.

DataStax has a commercial, value-added bundle based on Cassandra called [DataStax Enterprise](https://www.datastax.com/products/datastax-enterprise) and a cloud service [AstraDB](https://www.datastax.com/products/datastax-astra) which provides [zero lock-in](https://www.datastax.com/products/datastax-astra/features#zero-lock-in) guarantee (users can always fall back to open-source Cassandra).

A while ago NetApp released a Technical Report [TR-4635](https://www.netapp.com/media/10513-tr-4635.pdf) ("NetApp SolidFire with Cassandra") which in my opinion isn't useful. For example, it mentions Cassandra's LCS, STCS and DTCS (which we can read about in TFM), but it offers no SolidFire-specific insights related to the actual effect of these compaction strategies and how SolidFire users should lay out volumes or configure QoS to get most out of each approach (or minimize downsides of each approach). And by now the TR is grossly outdated - for example for specific workloads DTCS is now recommended over TWCS.

I'll use this page to write down some notes around running Apache Cassandra (and DataStax Enterprise) on NetApp SolidFire and E-Series.

## Cassandra workload

Like with most other scale-out NoSQL databases, write I/O requests are large and sequential. See the official DataStax, Cassandra and Instaclustr pages for additional insights.

What you see below is volume IO statistics from SolidFire (Demo VM) running a simple Cassandra workload (which split Cassandra data among two volumes; more on that below). I/O isn't high because it's all small VMs, but we can see that writes are sequential.

![Cassandra workload](/assets/images/cassandra-01-insert-io.png)

- Memory-based tables are flushed to disk once they grow beyond certain size [which can be several GBs](https://community.datastax.com/questions/5457/off-heap-memory.html); SolidFire would probably benefit from a smaller value to keep writes bursts smaller (say, 0.5-1.0 GiB)
- Database compaction runs at different times but more importantly it creates "churn" because it re-writes and combines existing SSTables into new SSTables which amplifies I/O (reads old data, performs new writes)

Factors that impact I/O characteristics:

- Workload, obviously, especially in terms of inserts (write workload)
- Workflows and application design - how applications create and delete data can influence other factors from this list, even if data format and content are the same
- Compaction strategy - some modes amplify write workload more than others; they have benefits but also "cost" in terms of extra storage throughput
- Replication factor - Cassandra usually recommends 3 (RF=3), but with protected storage (such as E-Series and SolidFire) RF2 is good enough
- Type of data - more vs. less compressible impacts storage efficiency on SolidFire and required storage capacity in general

## SolidFire-specific notes

### Performance

SolidFire has no RAID; it uses an RF2-like data protection schema called Double Helix.

Some of the good things about SolidFire clusters is they scale out and there are no volume groups to manage and schedule (you just create a volume and SolidFire will host it on the right cluster node and spread its data around the cluster). But it also isn't the greatest approach for heavy write-intensive workloads: if the application uses RF2 or RF3 in addition to being heavy on writes, then you hit the limits sooner and need to add more nodes which increases the cost.

That is why - in general - we'd use SolidFire for small to medium Cassandra workloads, where application-side write I/O goes up to 1 GB/s (with current SolidFire models H610).

### Compaction strategies

You can read about them in the Cassandra documentation; these should be set according to workload requirements, not according to what's better for SolidFire (what's better is less data churn, but if your sizing leads you the conclusion that SolidFire would be too expensive to host the workload, then don't use SolidFire)

### Compression

Each SolidFire cluster has *global* always-on efficiencies, both compression and deduplication. If you compress data on Cassandra, you may or may not find SolidFire efficiencies helpful - it really depends. 

I ran two simple experiments on a single node Cassandra 4 database:

- Two-column numeric KV table with Cassandra RF1 *without* compression: SolidFire compressed **1.38x** (account storage efficiency; i.e. 38% savings)
- Text/float/int table with Cassandra **RF2 and LZ4 compression**: SolidFire compressed **1.27x** (account efficiency)
  - I've made several edits to this efficiency factor, from 1.7x all the way to 1.27x; the reason is when I was writing this post I was running a low-I/O benchmark with 10 million records and published the post before it was completed. Compression was fairly consistent 10 hours into the benchmark, but after it was finished (27 hours), savings from compression eventually dropped to 1.27x
- In both cases, SolidFire deduplication didn't save any space

Cassandra benchmarking and testing is tricky so while it seems possible to get savings even with compression and RF2 or RF3, you should test your workload to estimate savings with confidence. As mentioned earlier, all volumes on SolidFire belong to the same global pool so regardless of volume placement, efficiencies are always cluster-global.

**NOTE:** remember to use `discard` on SolidFire mount points, to release de-allocated filesystem space and rethin volumes. That won't improve performance, but it will save usable disk space on the cluster. Without `discard` (or periodic `fstrim`) your volumes will always look full although they aren't, and SolidFire won't be able allocate that unclaimed space to other volumes in the cluster.

### Volume layout and QoS

I haven't done any performance testing yet, but I'd consider splitting commit log and data, simply in order to have two device queues.

```sh
/dev/sdb 2086912  114032  1972880  6% /var/lib/cassandra/commitlog
/dev/sdc 2086912   77780  2009132  4% /var/lib/cassandra/data
```

Then give each disk a high Min QoS, but if you're short on IOPS, Cassandra commit log volume may benefit from higher Min QoS than data volume.

I'd set Max QoS and Burst QoS to high values because they don't "cost" anything in terms of performance reservation on SolidFire - only Min QoS is guaranteed while Max and Burst are "best effort".

This can be confirmed in practical testing.

### Rack awareness

SolidFire requires at least four nodes per cluster, so completely independent storage would require RF2 on Cassandra and two SolidFire clusters (each with 4 or more nodes).

SolidFire clusters with 6 or more nodes can be deployed with "AZ-like" redundancy where each of SolidFire's Double Helix copies is placed in a different node group (called Protection Domain or PD). If we place all nodes from a PD in the same rack, we can spread the cluster across several racks and get rack protection with one SolidFire cluster.

![Cassandra with RF2 and SolidFire PDs](/assets/images/solidfire-protection-domains-and-availability-zones.png)

What's the difference between a PD and AZ? SolidFire PD doesn't concern itself with rack awareness - any client must be able to connect to any of the PDs, i.e. it's one big L2 network and some spine-switch hopping will always be involved. If you want to know more about PDs, see [this post](/2021/07/06/solidfire-protection-domains-data-path.html).

## E-Series-specific notes

### Performance and compaction

E-Series arrays are designed for low latency, high throughput and high IOPS (with NVMe media), so when considering compaction, we have to be relatively less concerned about its IO impact (compared to SolidFire, for example, which internally uses RF2 and therefore amplifies writes).

EF300 delivers close to 10 GB/s write performance and EF600 close to 20 GB/s, and each array can scale to hundreds of TBs, making E-Series great for Cassandra deployments of any size and performance. Use whatever compaction strategy is best and just make sure you size appropriately.

### Compression

E-Series has no compression and deduplication, so when considering compression we should simply configure compression based on recommendations from the Cassandra documentation.

### Storage and volume layout

I don't have any test results to give these with confidence, but I'd start with:

- RAID 1 or RAID 10 or DDP on SSD for Cassandra commit log - not because we need SSDs here, but SSDs have higher throughput than HDDs and take up fewer slots
- DDP or RAID 6 (HDD or SSD) for Cassandra data

EF600 and EF300 can fit up to 24 NVMe disks (1.92 TB to 15.3 TB) in controller shelf, so if you have up to few hundred TB of data you may be better off with all 24 disks in a DDP pool.

### Rack awareness

E-Series has no logical availability zones inside of a single array. 

While we can use Volume Groups to *segregate volume performance* between types of volumes based on workload and/or Cassandra nodes, for *rack redundancy* with NoSQL we usually use multiple arrays: if we use Cassandra with Replication Factor 2, deploying a pair of EF300 or EF600 in different racks would protect Cassandra from rack failures or downtime due to scheduled rack maintenance and at the same time keep storage overhead lower than with RF3 + JBOD.

## Backup and restore

If you can take Cassandra offline, it's easy to back it up on both SolidFire and E-Series. If you can't, you probably want to use logical (application-aware) backup and restore, rather than storage or filesystem snapshots.

Instaclustr Esop and [Icarus](https://github.com/instaclustr/icarus) can protect Cassandra data by taking and exporting application-aware snapshots to S3 or dumping them to a local filesystem.

In the former case, backups are self-contained so we can restore them anywhere - including to the cloud - and in the latter case we can leverage E-Series volumes or even NFS mounts (and if NFS happens to be on ONTAP, we could snapshot those backups and tier their cold data to S3). 

Here's what I got when I used Esop to snapshot and export Cassandra 4:

```sh
# dir -lat /tmp/7cd65d40-6fe2-460d-8a82-c7a91608ca24/datacenter1/rack1/
total 16
drwxr-xr-x 4 root root 4096 Jul  8 12:10 .
drwxr-xr-x 2 root root 4096 Jul  8 12:10 manifests
drwxr-xr-x 6 root root 4096 Jul  8 12:10 data
drwxr-xr-x 3 root root 4096 Jul  8 12:10 ..

# dir -lat /tmp/7cd65d40-6fe2-460d-8a82-c7a91608ca24/datacenter1/rack1/manifests/autosnap-1657282244-f4f11ad3-0e58-320b-ab27-e95101fe70f0-1657282249777.json 
-rw-r--r-- 1 root root 89210 Jul  8 12:10 /tmp/7cd65d40-6fe2-460d-8a82-c7a91608ca24/datacenter1/rack1/manifests/autosnap-1657282244-f4f11ad3-0e58-320b-ab27-e95101fe70f0-1657282249777.json

# du -sh /tmp/7cd65d40-6fe2-460d-8a82-c7a91608ca24/datacenter1/rack1/data/
127M	/tmp/7cd65d40-6fe2-460d-8a82-c7a91608ca24/datacenter1/rack1/data/
```

Sometimes people will tell you that NoSQL database backups aren't necessary when RF >1 (and possibly cross-cluster replication) is available and used.

I don't have a strong opinion on that - if your Cassandra is self-contained or you simply must have backups (compliance requirement), go ahead and back it up. If its records are inter-dependent with data on other systems and it doesn't make sense protecting or restoring its data out of sync with the rest of your data systems, then having Cassandra backups taken at different times from the rest probably won't be very useful.

For example, we don't take backups of Cassandra databases running inside of NetApp StorageGRID and we don't backup internal SolidFire cluster databases because in both cases there is a ton of other data that would have to be backed up at the same point in time to make restores useful.

## Future work

The above takes care of the basics.

For now I don't plan to investigate SolidFire efficiencies with Cassandra because it's highly data-dependent and additional synthetic experiments may be relevant to some, but won't be relevant to most, while E-Series users can take advantage of only Cassandra compression. General Cassandra compression recommendations are good enough, and we know that SolidFire compression likely saves some space as well.

I'm interested in real-life performance testing on E-Series as well as data protection, so my next post on Cassandra will probably be about E-Series, while data protection may come later after I see what NetApp does with Instaclustr Esop and Icarus.
