# Faster PostgreSQL with DDP-based RAID 1 compared to DDP-based RAID 6

Alternative to old school R5/R1 database volume pattern - NetApp E-Series DDP with R6/R1

- [Introduction](#introduction)
- [Environment](#environment)
- [Tests](#tests)
- [Results](#results)
- [Other performance views](#other-performance-views)
- [Conclusion](#conclusion)

## Introduction

In the post [Benefits of RAID 1 in E-Series DDP](/2023/10/08/raid1-in-netapp-eseries-ddp.html) I highlighted the performance benefit of DDP-based RAID 1 over DDP-based RAID 6 using a synthetic performance test (fio).

This post attempts to make that comparison more "real-life" by running a non-synthetic test using pgbench, a workload utility from PostgreSQL. 

The subtitle refers to the "old school" RAID 5 - RAID 1 pattern. By that I mean "data on RAID 5, logs and indexes on RAID 1".

## Environment

- PostgreSQL 14.9 (included in Ubuntu) on top of XFS filesystem
- Ubuntu 22.04 LTS connected to the EF-570 via iSER
- x86_64 server with dual CPU (Intel Gold Xeon 6136, 3.70GHz, 2x12-cores, 48 vCPU (HT ON)) and 32 GB RAM
- NetApp E-Series EF-570 with 100Gbps IB
  - SANtricity OS 11.80
  - DDP (16 disks, 2 reconstruction capacity)

Database was initiated with the following, resulting in more data than cache size.

```sh
pgbench -P -i -s 5000 -U postgres -h localhost postgres
```

In all tests, both RAID 1 and RAID 6 volumes were created on that DDP (in the earlier post linked at the top, I have one non-DDP test for comparison purposes. It used RAID 0).

## Tests

As I mentioned in that post linked at the top, I'm not confident that MPIO is working correctly (in fact I know it's not, as one controller occasionally loses connectivity), which is why I was reluctant to run these tests at all.

But since the equipment is remote and it's unlikely I'll be able to physically inspect the network connections, I did these tests with all volumes moved to controller A, so controller B wasn't impacting tests with its connectivity flapping (it was impacting them by depriving the array of some performance).

So, take these results with a grain of salt. That's also why I'm not creating very detailed notes about the environment and benchmark.

These results may not be perfect, but should be reproducible and directionally confirm my expectations and the FIO results obtained in the same environment last week.

```sh
pgbench -P 10 -c 32 -j 32 -T 120 -U postgres -h localhost postgres
```

## Results

First, what do these acronyms mean? 

- D - data
- I - indexes
- L - transaction logs
- R1 - RAID 1
- R6 - RAID 6

DLI-R1 means data, logs and indexes were all on (DDP-based) RAID 1.

This chart summarizes TPS from various runs across different setups. 

I didn't run 3 runs in each case, but in the "important ones" (the last three here; all-R6, DI-R6-L-R1, D-R6-I-R1-L-R1) I did, whereas in other cases I ran the same test once or twice.

![](/assets/images/ddp-pgbench-results-01-tps.png)

The first two scenarios all RAID 1-based, and if someone wants to use an all-RAID 1 configuration, they'll probably not use DDP except in rare situations. That's why I want to focus just on the scenarios with data on RAID 6.

Specifically, DLI-R6 and DI-R6-L-R1 show that by moving just the log to a separate, R1-based volume (L-R1) in the same DDP, we can get a nice performance boost.

If we also move the indexes, we get another boost, albeit smaller.

In all cases, moving transaction log or indexes (or both) to R1 volumes resulted in a 15-20% better performance.

We'd also expect the latency to be improving with more workloads hitting R1, and this chart proves the same.

![](/assets/images/ddp-pgbench-results-02-latency.png)

Here's a more detailed look at the (TPS) performance improvements. The "credible" tests are the first three (for some reason Excel ordered them that way):

- The first two bars are test with transaction log and indexes (respectively) on R1 and improvements ranging between  ~15 to >20%
- Bar #3 all-RAID 6 (baseline)
- Bars #4 and #5 are all-RAID 1-on-DDP tests that we can ignore

![](/assets/images/ddp-pgbench-results-03-improvement.png)

And the last chart combines TPS and latency for easier viewing. 

Although the number of tests was limited, it appears that moving WAL to RAID 1 gives the bigger boost, but moving indexes as well still manages to improve both latency and performance.

![](/assets/images/ddp-pgbench-results-04-comparison.png)

(The fourth blue bar looks like TPS are almost 20% better than in the ImprovementPct chart above (where the difference is closer to 15%), but that's because the third blue bar isn't at 1.00; instead it's 20,071 TPS on the right hand Y-axis.)

## Other performance views

I have a few more interesting charts.

The all-R6 test generated around 18K read and 25K write requests (~45K total). 

![](/assets/images/ddp-pgbench-dil-r6-ddp.png)

The average request size - not shown here - was over 10kB (presumably table and index requests were 8kB and transaction log IO requests were much larger).

With transaction logs and indexes on RAID 1 volumes, generated IOPS were more (maybe 55KB on average?) and storage throughput achieved was ~25% more (peaking at 600 MB/s).

![](/assets/images/ddp-pgbench-d-r6-i-r1-l-r1--ddp.png)

This isn't a screenshot from a test, but from database initialization for a test. I share it to show that this server can generate PostgreSQL data at > 3 GB/s (100% write).

![](/assets/images/ddp-pgbench-d-r6-i-r1-l-r1-loading-ddp.png)

Of course, this kind of throughput is when requests are large, and won't be observed in TPC-B-like pgbench runs on the same system.

I'll finish this post with two not-so-useful graphs (for this particular post): the first one is from one of those RAID 1-based runs, where all data, indexes and logs are on DDP-based RAID 1.

![](/assets/images/ddp-pgbench-r1-all-flamegraph.png)

The second is where it's all on "classic" RAID 6 (DDP), our baseline case in this post.

![](/assets/images/ddp-pgbench-r6-all-flamegraph.png)

CPU-based flame graphs aren't that useful for comparing the same workload across different RAID 1 configurations, but I didn't have time to capture more logs and traces.

There isn't much different except that certain activities (pglz_compress, for example) seem to go take relatively less time on RAID 1 (lower (re)write latency, I suppose?).

Something that applies to the both graphs is they're quite "tall" because there's a lot of network activities involved in client-server (even though it's running on the same system, over loopback) and server-storage IO with iSCSI (iSCSI extensions for RDMA (iSER), in this case). Presumably the height would be even lower and performance faster with end-to-end NVMe (with EF-Series EF600, for example), but I don't have access to that storage to compare.

It would look more like this (baseline case - all data on R6 - with less time spent in network-related calls for IO).

![](/assets/images/ddp-pgbench-r6-all-pgio-flamegraph.png)

That should translate into performance gains with PostgreSQL as well. Not quite like this, but perhaps close to it.

![](/assets/images/ddp-pgbench-dil-r6-ddp-pgio.png)

## Conclusion

This and the previous post on this topic confirm RAID 1 on DDP is a valuable feature. 

We can move transaction logs to RAID 1-like volumes in DDP, gain 15-20% in performance, and do it without sacrificing the convenience of DDP. Even the cost of extra capacity isn't significant (just the transaction logs).

Similar gains should be possible with NoSQL-like databases (MongoDB, Elasticsearch, etc.).
