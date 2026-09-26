# Benefits of RAID 1 in E-Series DDP

Get performance and management improvements with RAID 1 on DDP

- [What is this about again?](#what-is-this-about-again)
- [Why is RAID 1 on DDP a good idea?](#why-is-raid-1-on-ddp-a-good-idea)
- [Is R1 on DDP really faster?](#is-r1-on-ddp-really-faster)
- [Which workloads can benefit from mixed RAID 1 and RAID 6 volumes in DDP](#which-workloads-can-benefit-from-mixed-raid-1-and-raid-6-volumes-in-ddp)
- [Data loss protection vs. classic RAID 1 VG](#data-loss-protection-vs-classic-raid-1-vg)
- [Conclusion](#conclusion)

## What is this about again?

Even now, few people know E-Series DDP can accommodate RAID 1 volumes. One of the reasons is it still can't be crated in the Web UI (as of SANtricity 11.80).

I wrote about it [here](/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html), so check that long post if you're interested in details. 

"Traditional" storage arrays and RAID controllers use disk groups (or volume groups, or RAID groups).

E-Series and EF-Series are no different - disks are used to create one or more volume groups (RAID 0 or 1 or 5 or 6) and one or more volumes are created on top of each. In addition, E-Series also has DDP (see that post for more) which is generally used to host RAID 6-style volumes.

But if we use the API we can create RAID 1 volumes as well.

This post adds some details about performance of R1 on DDP, as that's something I didn't have time to evaluate when I wrote that earlier post.

**Note**: R1 and R10 will be used semi-interchangeably. The smallest "classical" RAID 1 VG would consist of 2 disks, whereas a VG with 4 or 8 would be "RAID 10" because data would be striped across mirrored R1 pairs. Data in RAID 1-style volumes in DDP with 11 or more disks is not striped across mirrored pairs; it's striped and mirrored across a different set of 10 randomly selected disks every time a write occurs. 

## Why is RAID 1 on DDP a good idea?

It's not *always* a good idea, but it's a great feature to have.

Before, when we needed RAID 1-like performance we'd either have to give up on DDP and create at least two volume groups (say, two RAID 1 and another RAID 5 or 6 - shown in the top image, without a hot spare for the R1 VGs).

![RAID 1 vs RAID 6 on DDP](/assets/images/eseries-r1-ddp-mixed-r1-r2-volumes.png)

Or we'd give up on that complexity, eliminate RAID 1 and and use RAID 5 or RAID 6 or R6-style DDP for all volumes.

Now (the bottom image) you can get 11+ disks, create a DDP and in this pool create RAID 1 and RAID 6 volumes.

You don't get physical disk segregation between R1 and R6 disks that you'd have with distinct Volume Groups, but R1 and R6 maintain their relative performance:

- R6 stripes are spread each over 10 random disks in the pool (8 data + 2 parity)
- R1 stripes are spread the same way, but in a RAID 10-like fashion (5 + 5)

We get R10-level performance without having to have 3 extra disks (and also potentially 3 disks less in DDP) which is the minimum required for one RAID 1 VG + 1 Hot Spare. In DDP, there are no hot spares: reconstruction capacity is usually set to 2 disks worth of capacity, and shared among all DDP volumes.

With DDP we also don't have to grow R10 volumes by adding 2 physical disks at a time. 

With DDP, both R1 and R6-like volumes can be extended in volumes in GiB increments. If you add 3.84TB of capacity, that capacity is shared among all DDP volumes.

## Is R1 on DDP really faster?

We should expect it is, and that seems to be the case with both sequential and random IO.

This chart is by no means scientific and representative of real life, but I think it is indicative enough. 

My multipathing setup in this environment is not optimal, so any one (or all) of these tests could be slower than it should be. But in all tests R1 consistently outperformed R6, which is why I believe this is indicative.

![EF-570 R1 vs R6 on DDP](/assets/images/eseries-r1-ddp-4k-write-performance.png)

- E-Series EF-570 (all-flash SAS) with SANtricity v11.80
  - DDP with 16 disks (2 disks of reserve capacity)
- R1 and R6 volumes in DDP
- Ubuntu 22.04 LTS iSER client
- Workload: 8 jobs, QD 8, block size 4kB, 80/20 read-write (Note: *only* the write portion of the benchmark is shown above)

What's R0_2D0P? It's a RAID 0 made of two SSD disks. I threw it in there to get another reference point. (I've never heard of anyone who uses RAID 0 on E-Series, but I'd almost certainly use it for *something* - it's not a bad idea at all).

I observed 1.5x to 2x faster performance with RAID 1 vs RAID 6 on DDP. And the latency was better as well (blue bars).

That's very encouraging and meets expectations. I'd also like to evaluate application performance, but since the system doesn't seem 100% properly configured, I'll leave that for later.

## Which workloads can benefit from mixed RAID 1 and RAID 6 volumes in DDP

All workloads that benefit from RAID 6 (or 5) and RAID 10. 

Example 1: traditional RDBMS. Transaction log on R1, data on R6. Ideally we'd want data on R5 but that's a small compromise compared to compromising on R1 (which as you can see in that chart above often gets us not only a ~50% jump in performance, but also a ~50% drop in latency).

Example 2: NoSQL/NuSQL. Elasticsearch, Splunk, Kafka, MongoDB, various new vector databases, etc.

Example 3: different workloads that use E-Series. If we size and manage correctly, we can just create one big DDP pool and offer R1 and R6 on top of it.

## Data loss protection vs. classic RAID 1 VG

RAID 1 Volume Groups can lose 1 disk without losing data. Sometimes more than 1, but you need to rely on luck for that.

A RAID 1 volume on DDP can also survive the loss of only 1 disk at the same time, but - unlike the traditional R1 VG - DDP can recover and hours later our R1 volume can survive another disk loss and be like new.

So, while "R1 on DDP" doesn't automatically make R1 volumes resistant to double concurrent disk failures, it increases chances over weekends, holidays and in general, with much less reliance on luck. For example, data lost on a 3.84 TB disk that was 70% full (~2 TB) can be reconstructed in low single digit hours.

I should mention the case of modern replicated databases: let's say we have a database that creates three copies of data. In this case six disks in three R1 Volume Groups can lose 3 disks at the same time without losing data. In this case the resilience of a "classic" VG beats R1 (and even R6) on DDP, but you also need 6 (or 12 or 24, for more capacity) disks to make that happen. If we wanted to minimize data loss risk, we'd use the approach similar to the upper image above and provision a RAID 1 VG to each instance.

This example shows that R1 on DDP isn't always more suitable or faster or "better", but in many cases it can be.

## Conclusion

R1 on DDP isn't widely known, but it's a very useful feature.

As long as total performance doesn't exceed the maximum performance of the array, the benefits of higher performance and lower latency can be significant and worth the overhead.

Because R10 has a greater capacity overhead (R6 - 25%, R10 - 100%), if you use R10 and R6 in DDP you need to carefully monitor DDP capacity utilization - especially so if you also use snapshots and clones.

Check the longer DDP post for more details, links to documentation and API examples.
