# E-Series as Tier One for multi-tiered Kafka clusters

E-Series as Tier 1 in multi-tiered Kafka clusters

- [Multi-tiered storage in Kafka clusters](#multi-tiered-storage-in-kafka-clusters)
- [How to leverage E-Series](#how-to-leverage-e-series)
  - [Performance vs. data protection overhead](#performance-vs-data-protection-overhead)
  - [Sequential performance vs. latency](#sequential-performance-vs-latency)
  - [Tiering to S3](#tiering-to-s3)
  - [Compression](#compression)
    - [Evaluating data efficiency](#evaluating-data-efficiency)
  - [Snapshots and replication](#snapshots-and-replication)
  - [Environmentals](#environmentals)
- [Conclusion](#conclusion)

I've blogged about the unnecessary decade long abuse of JBOD and DAS storage in the context of Hadoop, Splunk, Elastic, Vertica and other platforms and applications.

Rather than belabor the points that most people already know by know, I'll keep this one short.

## Multi-tiered storage in Kafka clusters

Confluent [introduced](https://www.confluent.io/blog/confluent-platform-6-0-delivers-the-most-powerful-event-streaming-platform-to-date/) Tiered Storage in Confluent Platform 6.

Tiering is done similarly to how it's done elsewhere:

- Small Tier 1 for hot storage
- Big Tier 2 for warm/cold storage

![Kafka with Tier 1 on E-Series SAN and Tier 2 on Object Storage](/assets/images/kafka-eseries-object-storage.png)

With this approach we can:

- Use smaller and cheaper servers servers
- Save rack space and energy
- Deploy, maintain and upgrade with ease 
- Lower software licensing and maintenance fees
- Gain agility and simplicity
- Greatly improved Kafka Self-Balancing Clusters (when Tier 1 contains just a small amount of data)
- etc (you get the idea)

## How to leverage E-Series

Technically we don't "need" to use E-Series (or other SAN) for hot data. It's fine to use broker-internal NVMe in RAID1, for example.

But we've already been through this with Splunk and other applications: once a deployment gets to 10 broker/index/whatever servers, application owner realizes they have 20 NVMe internal disks in RAID1, and one E-Series EF300 with 12 disks in a RAID10 group would have been the same or better value.

*And* they still purchased some external storage for other Kafka applications, databases, management servers and more, effectively spending more in order to get less (e.g. Zookeeper dedicated transaction log volume, Confluent Control Center 300 GB SSD, Kafka Streams 100-300 GB SSD). Plus there's more things to manage.

So, how can we leverage E-Series as Tier 1 storage for Kafka clusters? 

The same way we'd do it for Splunk SmartStore, Vertica Eon Mode and other applications that use the tiering pattern:

- Configure EF300 (up to 7 GB/s write) or EF600 (up to 15 GB/s write) with a several RAID1 (2 disks) groups or one RAID10 (4-24 disks) or DDP (11-24) volume group for of Kafka brokers
  - The larger E-Series model, EF600, can deliver full performance with just one (controller) shelf full of disks (24 NMVe), so you can roughly imagine it delivers > 500 MB/s write performance per populated slot (in DDP configuration)
  - The smaller E-Series model (EF300) would deliver approximately half of that
  - Size for performance first (DDP or RAID10), pick the number of slots; consider leaving some capacity unused for wear leveling, and then size for usable capacity by choosing the right NVMe disk size (currently 1.92-15.3 TB disks are available)
- Create N or N*2 volumes for N broker servers to better spread the workload
  - Connect N broker nodes to E-Series using direct attach (for 2-4 broker nodes) or SAN (more than 4 nodes)
  - Use iSCSI for up to 25 Gbps, FC or NVMe/FC for 32 Gbps, or Infiniband for 100 or 200 Gbps

That would take care of hot tier, which can be small (according to Confluent, between 0.1 and 1 TB). Some related best practices can be found [here](https://docs.netapp.com/us-en/netapp-solutions/data-analytics/confluent-kafka-best-practice-guidelines.html). Configure S3 tier for warm/cold data.

### Performance vs. data protection overhead

If you need extra capacity in hot tier (which you may if you frequently pull data going back days and your S3 is slow), other disk slots in E-Series array can be populated with different-sized disks and used for other applications (VMware, [Tanzu](/2022/05/18/vmware-tanzu-netapp-eseries.html)/Kubernetes, software-defined S3, databases, etc.). This disk group can be protected with DDP ([RAID6-like protection schema](https://www.netapp.com/data-storage/what-is-dynamic-disk-pools-technology/)) to avoid capacity overheads of RAID10 - as long as you still get enough performance from this tier.

I expect an all-DDP (which requires at least 11 slots/disks) configuration should be good enough in most cases, but haven't had a chance to verify this in practice.

If we start with 11 small capacity (e.g. 1.92TB) disks, we can grow DDP by adding as few as 1 disk each time, as many as 13 the first time (11 + 13 = 24), to get more and more performance and capacity while:

- *lowering* disk reconstruction time as DDP pool grows (see [this](/2021/07/06/e-series-ddp-expansion-and-rebalancing.html))
- *lowering* the impact of data reconstruction on performance due to disk failure (with DDP it's normally [around 25%](https://www.netapp.com/pdf.html?item=/media/12421-tr4652.pdf)), and
- *decreasing* DDP overhead; with DDP, one full EF300/EF600 controller shelf would have protection overhead of 24/22 (9%), compared to 11/9 or 22% in a minimal DDP deployment - both are significantly better than RAID10 or RAID1 installed in a bunch of brokers servers

We need to remember that all disks in a DDP should be the same size. Here are some examples of three configurations using RAID10, RAID6 and DDP (two pool sizes, with 2 disks worth of spare capacity in each):

| # |  Protection |  Disks | Overhead   | Overhead % | Rel. Seq Perf 80%w   | Relative Latency |
|---|  :---:      |  :---: | :---:      | :---:      | :---:                | :---:    |
| 1 |  RAID10     |    8   |    8/4     | 200        | 1.0                  | 1.0      |
| 2 |  RAID6      |   10   |    10/8    | 125        | 1.4                  | 1.4      |
| 3 |  DDP(11)    |   11   |    11/9    | 122        | 1.6                  | 1.3      |
| 4 |  RAID10     |   12   |    12/6    | 200        | 1.5                  | 1.5      |
| 5 |  DDP(20)    |   20   |    20/18   | 111        | 1.8                  | 1.3      |

Usable (TB) for high DWPD environments (see pages 71 and 72 of [this TR](https://www.netapp.com/media/17009-tr4800.pdf)) will be lower than expected, i.e. when sizing for 5 DWPD we should leave approximately 28% of usable disk capacity unprovisioned if we wanted to extend lifetime of flash media

- For example, 8 * 1.92TB * 5 DWPD equals 76TB/day or close to 1 GB/s; although the array can deliver more than 1 GB/s, non-stop writing at >1GB/s would result in excessive write workload, potentially increasing failure rates. Normally, though, very few workloads result in average >1 DWPD per disk and Kafka workload is sequential, which means much less impactful on flash media
- DDP uses spare capacity (not spare *disks*), while RAID6 and RAID10 would need at least one hot or cold spare (not included in overhead figure above)

Relative latency (last column in the chart) seems much higher (30-50%), but even the worst case (say, 1ms vs. 1.5ms) probably has limited real life impact.

### Sequential performance vs. latency

Two last columns in table above show relative performance vs. relative latency. Where do they come from and how to read them?

- I sized EF300 with SSDs; each row under the assumption of 64kB sequential I/O, 80% write workload
  - Maybe 256kB request size and 90% write would be more appropriate for tiered Kafka, but the results wouldn't be very different
- Relative sequential write performance is better for DDP and RAID6 because they don't mirror writes - they stripe brokers' writes across all disks in a pool/group
- This of course results in slightly higher latency, but even at maximum performance for the pool/group, it's still <2ms (not exactly high)
  - Let's say a RAID configuration with 10 disks and 80% sequential write workload results in 5 GB/s @ 1.5ms latency; if clients consume 4GB/s rather than 5GB/s, I/O latency could very well be below 1ms

Let's consider scenarios 2, 3 and 4 from table above. If EF300 with 10-12 disks in any of these protection schemas can deliver enough capacity and performance

- RAID6 would give us best sequential performance (scenario 2) with a small 125% overhead
- Scenario #3 would give us slightly lower protection overhead vs. scenario #2 (122 vs 125%), better write performance (1.5x vs 1.4x), and smaller latency
- Scenario #4, 12 disks in RAID10 group, doesn't look great (large capacity overhead, mediocre performance)
- What's not in the chart is "next step" for our cluster: what do we plan to do next year?
  - DDP (pool) can be grown by adding 1 SSD at a time - very convenient
  - RAID10 can be grown by adding even number of disks (2, 4, 8). It makes us run out of available disk slots sooner
  - RAID6 (8 data + 2 parity) should be grown in groups, by adding 10 disks at a time, so not very convenient for Kafka broker hot tier unless you have big clusters and use multiple E-Series arrays. But it may be OK if you used RF2 on Kafka, and multiple E-Series arrays with two RAID6 (8+2) per array. Still, DDP is much less rigid, so I'd prefer to use DDP 
  - Going beyond one controller shelf (i.e. 24 disks) requires add expansion shelves and is usually used only to add capacity, not performance, so if we plan to grow Kafka capacity quickly and don't want to add additional controller shelves or additional controllers, we should start with 8-11 larger NVMe disks rather than 20 tiny disks. If we plan to grow Kafka performance quickly, then smaller disks are fine - we can go with EF300 and use multiple arrays

Some anecdotal evidence from inserting random data into a single Kafka 3.2.0 broker (1 topic, 1 partition, RF1, 100ms linger, 128KiB batching):

- For some reason, gzip looked very slow (the IOPS chart can be ignored, but it's there to give you an idea of IO request sizes observed, if you divide throughput by IOPS)

![Comparison of throughput with non-random JSON data](/assets/images/kafka-eseries-compression-random-data-uncompressed-and-gzip.png)

- Snappy and zstd seemed okay (we're looking at duration of each run here; JSON data was random so compression ratios were poor across the board) and LZ4 seemed suspiciously fast. Additional tests should be done.

![Comparison of throughput with non-random JSON data](/assets/images/kafka-eseries-compression-random-data-snappy-zstd-lz4.png)

- Another run done with *non-random* JSON contents (fake user profile data, ~1kiB per JSON document) seemed to produce more sensible results. This run read a 10GiB JSON collection off local OS disk and used Kafka producer to send few million of those JSON records to Kafka.

![Comparison of throughput with non-random JSON data](/assets/images/kafka-eseries-compression-non-random-data-throughput.png)

In all of these tests Kafka latency was 1.5-7 ms. Kafka broker was configured to flush to disk every few seconds, which avoided burstiness and smoothed out write peaks. Without it writes become bursty - no I/O for 15 seconds, then 500-600 MB/s for 3-4 seconds. I did not measure latency in these "non-smoothed" tests.

With RF2 we'd need 200 MB/s write per broker in the "smoothed-out" scenario, and ~1 GB/s per broker with default Kafka flush settings which indicates that the smaller model, EF300, should be able to handle half a dozen brokers with that workload. (At the same time, broker CPU utilization was <10%, so physically we would probably need just 3-4 servers and 6-8 brokers running in VMs or containers to get more out of the hardware.)

### Tiering to S3

Depending on capacity of, and use case for, Kafka's Tier 1, Object Storage may turn out to be "hot" (or not):

- if Kafka consumers need fast response for data that doesn't go beyond 7 days and Tier 1 can hold 14 days of data, Object Storage can be low-performance (HDD) and/or remote because it probably won't be used much
- if Kafka's Tier 1 storage is tiny (0.1 TB per broker, for example), obviously it's unlikely it will be able to hold weeks of data, which means Object Storage will be busy, and should be fast and/or located nearby (e.g. on-prem, and maybe use only SSD/NVMe media for Object Storage, or have an SSD/NVMe tier in S3)
- some Object Storage, such as NetApp StorageGRID, can consist of heterogeneous nodes (e.g. all-flash and NL-SAS nodes) and use ILM policies to adjust not only where data is placed, but also how
  - 2 Copies on All Flash nodes for all objects within 30 days of creation (gives us faster read performance for recent data)
  - Erasure Coding 2+1 with NL-SAS HDD placement for all large objects older than 30 days (lowers object storage software overhead from 200% (RF2) to 150% (EC 2+1), both of these are layered on top of R6-equivalent (StorageGRID requirement) volumes)

Kafka Tier 1 on E-Series with R10 would result in less usable capacity with faster performance and normally use one hot spare (not displayed).

DDP delivers lower performance for the same number of disks, but overheads of DDP are very limited and can tolerate two concurrent disk failures. DDP reserve is shown in yellow; normally that amounts to two disks worth of capacity for reconstruction in the case one or two disks fail. Other than that, DDP requires no dedicated hot spares so its overhead advantage over RAID6 or RAID10 is even better than the table above suggests.

For classic Kafka we'd use two E-Series arrays and RF2, but with tiered Kafka there's probably no need to use multiple arrays, so I'd consider using a single array (assuming sufficient performance and capacity) either R10 (or multiple 2-disk R1) or DDP, not both.

![Kafka with Tier 1 on E-Series R10 or DDP and Tier 2 on Object Storage with RF2 and EC2+1](/assets/images/kafka-eseries-object-r10-and-ddp-storage.png)

Object Storage (at the bottom) could use multi-replica or Erasure Coding. Some S3 software requires that S3 storage nodes use protected storage (here, RAID6, but it could be RAID5 or DDP or something else), other does not (that, however, results in a longer and more impactful drop in performance when recovering from disk failures).

### Compression

E-Series doesn't compress data; the idea is to make IO path as lean and fast as possible. In the past this meant if the application happened to not compress data that could be nicely compressed (early MongoDB, for example), we left some savings on the table. These days, especially with NOSQL-ish workloads, data can be compressed on the application before being sent to storage. E-Series also doesn't deduplicate, but even if it did, I doubt much could be saved by deduplicating compressed Kafka blobs - even with RF2.

Kafka supports compression (GZip, Snappy, Lz4, zstd) which - after eating up some CPU and memory resources on producers or brokers - has two positive effects on storage sizing:

- Lowers network, and storage I/O and capacity requirements (or, lets us get 100% more performance and capacity on the same E-Series array, assuming 50% savings from compression)
- Lowers wear on SSDs (e.g. 3 DWPD > 1.5 DWPD), allowing for less hold-back on usable storage capacity

Assuming you don't mind the extra latency and CPU resources, enable compression. 

If we tier Kafka data to S3 we won't have much data on E-Series to begin with, but compression can save some egress fees (public S3) and/or decrease latency and increase performance of S3 tier (private or public S3), so I would try to enable compression on Kafka brokers in all scenarios (tiered, non-tiered).

Some anecdotal chart pr0n from tests executed on dual Xeon 6130 bare metal system connected to an older all-flash EF array using iSER:

- Kafka 3.2.0
- 1 partition, 1 topic, RF1, same client and server
- 100ms linger and 128KiB record batches on Kafka producer
- Non-random JSON records emulating user profile data (contact info, self-introduction, location, etc.), approximately 1KiB per record

The effect of compression on throughput and latency was minimal; CPU utilization was below 10%.

![Effect of compression on throughput and latency](/assets/images/kafka-eseries-compression-latency-example.png)

With the same linger and batch-size settings for each run, differences in records/s weren't significant.

![Comparison of rec/s with and without compression](/assets/images/kafka-eseries-compression-rps-example.png)

It doesn't make sense that uncompressed was slower than zstd, for example, so I should have done more runs, rebooted between runs, etc.

#### Evaluating data efficiency

I executed two simple tests using a 12-core VM (both producer and broker; 1 topic, 1 partition, 1 replica, 500ms linger, 128kiB batch size): 

- Test 1: 1kB plain text records made of random uppercase alphabetic characters - data reduction with gzip was 18%
- Test 2: 17MB audit log file in JSON format (StorageGRID audit log, 35K JSON documents) ingested using different compression algorithms - data reduction with selected algorithms was much higher:

|  Item       | gzip  | Snappy| zstd  |
|  ---        |  ---: |  ---: |  ---: |
| Records/s   | 52000 | 82000 | 79000 |
| Ingress (MB/s)|  24 |    38 |    37 |
| Avg latency (ms) |15|    33 |    26 |
| Data reduction (%)|80|   65 |    81 |

These aren't guidelines on whether to use compression (and if yes, which one) but very simple examples to give you an idea that depending on data content and format, CPU speed and other factors, it's best to optimize your settings rather than follow generic recipes.

With random non-repeatable text not even 20% of capacity can be saved despite using a lot of CPU resources, but with structured and repetitive data some algorithms will be better than others - depending on resources and priorities.

I did three runs for each test, but I don't think these results are very accurate (each run took less than 1 second, etc). But for the sake of an argument, if we were to collect StorageGRID audit logs with Kafka, I'd consider zstd because it's faster than gzip (not because it saves 1% more capacity). I'd also do additional tests to examine read latency and CPU utilization, because those metrics weren't captured.

### Snapshots and replication

E-Series can take volume snapshots, but I don't see why anyone would want to use them on tiered Kafka volumes - it doesn't seem to make any sense, with 99% of data on S3. When *all* Kafka data is on E-Series, it might make sense to take snapshots before major upgrades or patches.

E-Series arrays are reliable and have redundant components (controller ports, controllers, data/disk protection), but controllers (and disks in them) can't be split across racks.

- Use Kafka's RF2 replication for local (rack, row, floor) array redundancy 
  - RF2 also helps with multiple EF arrays if array sizing consumes >50% of maximum performance and we can't afford the loss of *performance* (i.e. in the case of controller failure).
  - RF2 on single EF series array makes sense if you want to protect Kafka from filesystem corruption or OS downtime of individual broker nodes; this can be done on a single EF300 (remember to size for 2x write workload in that case)
- Use Geo-Replication for replication between Kafka clusters

### Environmentals

- "Classic" configuration
  - 12 2U servers with JBOD or 12 NL-SAS (Total: 24U; 144 NL-SAS HDDs or around 190 TB usable with 4TB disks and RF3)

- Modern configuration with Kafka tiering to S3
  - 6 1U servers with Hot Tier on 1 EF300 (Total: 8U; 12 NVMe SSDs)
  - 3 or more StorageGRID appliances or other S3 storage
    - 3 (all flash) SGF6024's take 9U (1U server + 2U storage = 3U per appliance)

*Approximate* environmentals* for tiered storage scenarios 2, 3 and 4 (10-12 disks in a single EF300) with 3 x SGF6024:

| Item          | Watts (typical)   | BTU/hr | kWh/yr  | RU  | Usable (TiB)            | 
| ---:          |       ---:        | ---:   | ---:    |:---:| ---:                    |
| 1 x EF300     |      770W         | 2,600  |  6.75   | 2   | 13.8 (DDP, 11x1.92TB)   | 
| 3 x SGF6024** |    4,500W         | 17,200 | 41.00   | 9   | 170 (2-copy on S3)      |

- `*`  - these are just approximate and will vary depending on load, disk size, and more; if you need official figures please reach out to NetApp
- `**` - apart from Rack Units, other environmentals for 3 x SGF6024 (24 x 7.6 TB disks each) do not include power consumption for 3 x 1U StorageGRID server "heads" 
- Some customers may require a load balancer to balance Kafka broker connections among object storage appliances, for which we could use VM based StorageGRID or dedicated hardware (NetApp SG100, F5, GLB, or existing NLB). In terms of rack units used, if NetApp SG100 (1U) is used, that's an additional 2 x 1U for an HA pair. Power/BTU specifications for those generally correspond to regular 1U 2-socket Intel-based servers with high core count. Total RU count for this tiered setup then becomes 6 x 1U for Brokers + 3 x 3U for SG6024 + 2 x 1U for SG100(0) NLB = 17U, but can be 15U without NLB or something entirely different if different appliances are used

In the case you wonder how come we get only 170 TiB from 3 x SGF6024, each of which has 24 7.6TB disks: this assumes we save two copies of each object ("2-copy policy on S3") and the appliances use DDP-style data protection inside, so overhead of this approach is similar to mirrored RAID 6 (overhead of 2-copy over DDP is similar to overhead of mirrored RAID6), so it's still lower than RF3 with JBOD.

Now, admittedly this scenario uses all-flash object storage appliances, which is more expensive and saves more power, but:

- we used 2-copy policy for S3, which isn't very most economical approach we can have. With *four* SGF6024 nodes we could use Erasure Coding 2+1, rather than 2-copy policy for first layer of S3 data protection to make the cost of capacity cheaper and overheads lower. For example, 4 x SGF6024 with 3.8TB SSDs and EC 2+1 gives us close to 147 TiB usable (after EC 2+1 and DDP-like protection in appliances), so by adding one additional S3 appliance and switching to 50% smaller disks, we've "lost" only 23 TiB of usable capacity compared to 2-copy policy with 3 x SGF6024 while decreasing overhead
- generally speaking, larger S3 clusters - or hybrid S3 clusters (10-20% of S3 appliances with SSDs, 80-90% with NL-SAS HDDs) - make the economics of tiered Kafka much better because overheads are generally low (EC 2+1 over DDP vs RF3 with JBODs can save 30-40%, [depending on how wide DDP is](/2022/06/22/e-series-hdfs.html#erasure-coding)), and the cost of this capacity can be spread across many services, not just Kafka but also backup, container registry, archives, and more

## Conclusion

Various if-else statements in this post make it impossible to use simple rules of thumb without knowing more details about the workload, but that's unavoidable - if the inputs are unknown, it's impossible to provide correct outputs. Fortunately, it's just a lot of sequential(ized) IO writes, and can be sized relatively easily once the requirements are known.

The NetApp solution guide for Kafka sizing has a detailed list of inputs that need to be gathered, and can be viewed [here](https://docs.netapp.com/us-en/netapp-solutions/data-analytics/confluent-kafka-sizing.html).

Kafka prototyping can be done on any storage (even in RAM disks) - we just need to find capacity and performance requirements for a small subset of data, and feed them to Kafka and E-Series sizing tools to verify assumptions and come up with appropriate sizing.

When sizing for capacity, performance, and choosing RAID/DDP configuration, I suggest to consider our next expansion step (say, add 3 more brokers). If Kafka Tier 1 storage will be busy and is likely to grow a lot, then EF600 and RAID10 may be more appropriate than EF300 and DDP, for example.
