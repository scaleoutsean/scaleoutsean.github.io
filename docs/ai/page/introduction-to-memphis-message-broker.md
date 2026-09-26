# Storage considerations for Memphis message broker

About Memphis (aka Memphis.dev)

- [What is Memphis](#what-is-memphis)
- [Storage-related observations](#storage-related-observations)
  - [Tiers](#tiers)
  - [S3 tier](#s3-tier)
  - [Disk and object storage (S3) considerations](#disk-and-object-storage-s3-considerations)
- [Conclusion](#conclusion)

## What is Memphis 

According to them, Memphis.dev is an intelligent, frictionless message broker.

I would describe it is "Kafka minus headaches". If you hate Java, you may like Memphis.

At this time Memphis is at v1.2.0. Their Web site has a full list of features but I'll highlight the ones I think are more important:

- Production-ready message broker in minutes
- Easy-to-use UI, CLI, and SDKs
- Data-level observability
- Dead-Letter Queue with automatic message retransmit
- Schemaverse - embedded schema management for produced data (Protobuf/JSON/GraphQL/Avro) removes the hassle of dealing with it separately
- Storage tiering
- "End to end" message tracing

After brief testing, I wouldn't disagree with any of these claims. 

Memphis is currently still a young product, but versions > v1 ought to be production-ready. 

You may ask: if it's production ready, why aren't more people using it? 

One of the reasons may be that some nine months ago they wised up and changed the software license from the Apache to [BSL 1.0](https://github.com/memphisdev/memphis/commit/e0dcfabf7cb873513d9c76d3c9f4b24eb959c2aa). (Notice how the commit is called "Update LICENSE" although it's a complete replacement of the permissive Apache license...)

In other words, Memphis may now be suffering the fate of Hashicorp, Elastic and other companies that attempted doing what they're supposed to (make money). How dare they!

If the case you wonder how Memphis compares vs. something else, see [this](https://docs.memphis.dev/memphis/memphis-broker/comparisons) in their documentation. (Their current comparison with Kafka is slightly outdated; Kafka can now use RAFT which used by Memphis, too.)

Among other systems, Memphis is also quite similar to NATS.

## Storage-related observations

As far as I understand "front-end" and Tier 1 are very similar to the tech found in NATS Jetstream, whereas Tier 2 (S3) is a novelty in message brokers (although the code may be based on an existing implementation from a non-message broker project - I haven't looked into that because it should be similar to how other projects use S3).

### Tiers

Memphis v1.2.0 can use two tiers:

- Memory or Disk: the former is faster, but even with multiple replicas (replication is available with multiple nodes) you can lose data if the cluster becomes affected by an unplanned network or power outage.

![Memphis memory or disk tier](/assets/images/memphis-broker-02-ram-disk-tier.png)

Configured first tier: store messages on disk and keep no more than 10.

![Configured Memphis first tier](/assets/images/memphis-broker-03-first-tier.png)

- S3: records that expire from Memory/Disk tier are migrated to an internal buffer and from it to S3

![Configured Memphis S3 tier](/assets/images/memphis-broker-03-s3-tier.png)

Memphis lets us pick Memory or Disk for Tier 1. Transaction logs are rolled every 8 seconds (default), packed up and shipped to S3 if S3 tier is enabled.

![Memphis S3 connect](/assets/images/memphis-broker-04-s3-connect.png)

Alternatively, X in "every X seconds" can be changed to another value. It is also possible to use "when Y MB of message data has piled up" or "when Z number of messages have been gathered" (as in that screenshot above).

If there's no S3 tier, then after that limit has been hit messages would be pruned from system. 

It is not possible to use only S3 tier - we'd use Memory and S3 if we didn't have proper disk storage for Memphis instances.

This is a sample of a station with two tiers, disk and S3, with on-disk retention of 1 hour, no replicas:

![Memphis broker settings](/assets/images/memphis-broker-06-settings.png)

I ran into some issues with S3 so I'll share a few things about that.

### S3 tier

This feature exists and no doubt the main scenario (Memphis-as-a-Service with tiering to AWS S3?) works, but it has bugs and doesn't work at all for me.

- API endpoint: s3
- Bucket: memphis-store
- Memphis "topic": scaleoutsean

If a memphis station scaleoutsean is configured as S3 tier, we'd expect to see messages tiered to it. But:
- S3 tier setting sometimes persis, but it also disappears and becomes `-` (the hypen stands for "tier not configured" in the UI)
- In the bucket, Memphis creates a path to tier producer data, for some reason appends `$1` to station ("topic") name, and loses messages when tiering them to S3 
- There's currently one S3 integration per Memphis cluster (that is, you can't use two buckets, even though you may have 2 or more stations) 
- It's impossible to edit S3 configuration even after the last station (topic) has been deleted. The docs say 

This is how the path to tiered data looks like. I don't know why they need that `$1`... And (the bigger problem) the path is empty. Yes, tiered data is missing...

```sh
$ mc ls df/memphis-store/memphis/global/scaleoutsean$1/
$
```

Memphis log says data has been uploaded. That seems inaccurate.

```raw
[1] 2023/08/28 14:17:15.792100 [INF] new file has been uploaded to S3: memphis/global/scaleoutsean$1/RBTQjjWLgfBoomxKM1OHKE(5).json
```

We know Memphis can write to this bucket because the user has necessary permissions, and when we started only `s3/memphis-store` existed and `${STATION}$1` name did not. I'm pretty sure this is a Memphis problem.

### Disk and object storage (S3) considerations

As far as NetApp disk storage is concerned, this is the same "NoSQL" requirement that I [wrote about before](/2022/06/28/kafka-eseries-object-storage.html) on more than one occasion: we don't need almost any features - we need reliable, fast storage capacity. 

If auto-scaling is required, then Kubernetes would be a better way to deploy Memphis. In a static environment, Docker would be fine.

In a Kubernetes environment, we'd use Trident CSI for ONTAP and something like [DirectPV with E-Series](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html). Again, we wouldn't care much about storage features in this situation - there's no need to resize, backup, snapshot, recover, replicate, etc. 

In a static environment we could use Docker and configure static volumes or even use something like [Nomad](/2022/03/23/nomad-solidfire-hostpath-volumes.html) or Terraform to deploy.

I evaluated Memphis in a VM so I can't guesstimate its performance requirements, but I imagine it should be similar to Kafka. I evaluated Kafka on E-Series [here](/2022/06/28/kafka-eseries-object-storage.html#sequential-performance-vs-latency) and even after one or two extra copies, 100 MB/s is still a lot of compressed 500 byte messages! You'd need a big workload to need to worry about the performance, and if you had that problem you should look at E-Series EF300 or EF600 to solve it cost-effectively.

Multi-AZ (or multi-rack) configurations would need multiple storage arrays which is another case where smaller dedicated arrays may need to be purchased. (This multi-AZ Kafka image is borrowed from [this](/2022/11/11/netapp-spot-instaclustr-eseries.html) post.)

![Multi-AZ configuration](/assets/images/instaclustr-eseries-big-detailed.png)

(Cost of) capacity could be an important concern for those who keep days of messages (e.g. 14) on disk. Consider:

- 500 MB/s ingress
- 100 MB/s compressed
- 200 MB/s after extra replica
- 86400 * 0.2 = 17 TB per day

I don't know if it makes sense to keep data that long, but those who do probably want to access it faster than it'd be on S3 which is why I assume they'd want low-cost flash storage.

For S3 I think performance isn't a big concern - by the time data hits S3, it's unlikely to be reused. S3 here could be more about reliability, governance, manageability, auditing, etc. 

Here most Memphis users could use StorageGRID (large performance and scale, single- or multi-site) or ONTAP S3 (small-to-medium, usually single-site) or the free MinIO on E-Series (fast, low cost, maybe more suitable for smaller, single-site and edge deployments where there's no ONTAP).

One thing that I will have to figure out later when I find a way to get S3 tiering to work is whether messages can be consumed from S3 tier, or only from Disk/Memory tier. It's supposed to be transparent, in which case S3 performance may sometimes matter. Kafka's storage tiering design (implementation is currently [work-in-progress](https://docs.memphis.dev/memphis/memphis-broker/comparisons)) also behaves like that.

## Conclusion

Memphis is predictable and while it has bugs, it actually makes me want to use it. I think that's a great sign - it reminds me of SolidFire that way.

Compared to Kafka, it should be said that Memphis is obviously a young and work-in-progress product: both the code and documentation have room for improvement, and need fixes.

But it seems fine for simple use cases and projects if the non-OSS license isn't a problem. If you need a message broker for non-mission critical internal use in 2024, maybe you'd be better off with Memphis than Kafka, unless you already have Kafka expertise and deployments which can grow: it is likely to save you money and time.

For mission critical apps that need to run 10 years from now, Kafka a sure bet: it's an Apache project with a huge, healthy ecosystem that's still growing.

Kafka-as-a-Service vs. Memphis-as-a-Service? Anyone can offer Kafka-as-a-Service, but thanks to its license **not** anyone can offer Memphis-as-a-Service. I think that's the biggest challenge for Memphis. Management and ease-of-use-wise it seems superior to Kafka and that could make its hosting costs cheaper, too, but the service is offered by a small startup with few or no alternatives which probably causes some discomfort among potential as-a-service users who don't have the ability or cannot operate the software by themselves (or indeed, aren't allowed to do that by the Memphis' BSL license).
