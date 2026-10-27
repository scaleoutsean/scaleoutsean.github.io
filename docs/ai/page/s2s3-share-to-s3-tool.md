# S2S3 - NAS Share to S3 copy utility

Yet another tool to copy data from NAS shares to S3 easily and for free

## Objective

You have a bunch of unstructured data scattered on dozens of NAS shares spread across several NAS clusters and want to put it to good use:
- Enable it for simple, secure and efficient WAN access over HTTPS from your other sites or public cloud (check out [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) if you have a datalake)
- Reduce NAS sprawl 
- Save manpower and hardware maintenance costs
- Implement async replication or simple backup to low-cost public cloud (yes, [you can create point-in-time bucket snapshots](/2026/06/13/storagegrid-sg-cosi-branch-snapshots.html) to backup StorageGRID buckets) for simple, low-cost backup
- Enable AI and analytics projects (see these examples with [Ray](/2026/09/19/ray-framework-beegfs-storagegrid-checkpoint.html) and [Alluxio](/2026/09/04/alluxio-ai-analytics-storagegrid-hybrid-cloud.html))

To do that, you need move data from NAS shares to an S3 object store such as NetApp StorageGRID.

We do that by copying data from, and then eliminating, NAS shares.

Target destinations:

- Data center: NetApp StorageGRID
- Edge: [Versity S3 Gateway](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html)

Bucket Man says: consider it solved with Share-to-S3 (S2S3)!

![S2S3 Social Logo](/assets/images/s2s3-00-logo.png)

## Solutions for NAS to S3 migration

There are already many, including free ones.

Some take care of the entire workflow (including bucket creation), but most focus on data replication since that is the key and critical part.

My wish list:

- Easy download, privacy-respecting and no registration required.
- Single binary, no installation required.
- S3 as the only and first class destination, but StorageGRID and Versity S3 Gateway in particular. I don't want any troubles with these two, and I may want to optimize for them in the future.
- Open-format database (such as Parquet). I want to be able to access and use data from other applications.
- Enterprise-friendly and user-friendly logging and verification.
- Performance that doesn't suck... much.
- NFSv3 source support, since that's my main source protocol.

These are my check-boxes for most share-to-bucket migrations and S2S3 is built to check them.

How's it work? As one might imagine: copy, sync-incremental (zero or more times), final-sync from a read-only source, and finally switch over.

![S2S3](/assets/images/s2s3-diagram.svg)

If you can make your source read-only before you start (that is, run Step **3** *before* Step **1** and skip Step **2**, which is practically the same as starting from Step **3**) and wait (e.g. you have only 10-20 TB to copy), you may be able start and finish a bucket in one day. If you want to run checks, do tests and whatnot over several days or weeks, then you need Step 2 and repeated inventory scans with incremental syncs in those iterations.

If I have NFSv4 and don't have NFSv3 on source, I can enable v3 on existing NFS shares for the S2S3 client instances only.

SMB support would be nice to have, but I rarely encounter it. For time being, I can do without it. Some NAS systems can share SMB via NFSv3 (to S2S3 client) as a workaround.

## How does S2S3 scale out?

It doesn't. It *could*, but that's not a problem that needs solving. One S2S3 per share will do just fine in 95% of cases.

![Scaling out](/assets/images/s2s3-01-scaleout-scanning.png)

> But one client surely can be too slow when copying a 100TB NAS share!

Maybe, but I don't buy that for **NAS shares smaller than 100TB**.

And your StorageGRID or NAS may be slower than you think.

Once I get a file list to work with - let's say I have 100,000 in 1GiB files - I can copy those with 100,000 S2S3 workers in parallel (although only two S2S3 clients are shown working in parallel):

![Copy operation](/assets/images/s2s3-02-scaleout-sync.png)

The math is simple. S2S3 can list at this speed:

| Source | Objects or Files per second | Enumerations per hour |
| ---- | ---- | --- | 
| S3 | 3,000 | 10 million |
| NFSv3 | 8,000 | 28 million |

Assuming 0.125-1 MiB file sizes, and **if** you can *read the entire files* (not just list them) at that rate:

| File size | Source | Hourly copy rate (@8K files/s) | 
| --- | --- | 
| 1 MiB | NFSv3 | 28 TB/h | 
| 125 KiB | NFSv3 | 3.5 TB/h |

We'd have to read 1 MiB files at 8,000 per second, which I can probably do with just 8 workers (2vCPU and 10 GigE per worker - cheap!), to copy at 28 TB per hour, but our NAS storage may not be able to *serve* that much throughput (expensive!) or accept that amount of writes (we know Versity S3 Gateway can do 4-5 GB/s on servers you'd usually use for it; StorageGRID scales out and usually does more, but it's not "unlimited").

And let's not forget: you probably have production workloads running 24x7 and will likely throttle your migration workload anyway. 

I hope someone will tell me they have a PB-sized NAS share where data enumeration or copying needs help, but I don't think that will happen. I've seen problems, but problems existed because the NAS or object store weren't fast enough for Read and Put rates required.

What normally happens is: it's a storage performance problem (at the source, or destination, or both). *Consuming* resources is not difficult, especially in trivial (for the client) workloads such as share-to-S3 enumeration and copying.

## StorageGRID-related features

What StorageGRID features does S2S3 have? None.

At this time I don't need any, but I *can add them if I want*, which is important.

Since there's nothing else to do in this section, let's waste a minute on addressing vague "concerns" about the performance that I've heard from some "experts".

I don't need this feature in S2S3 because it can be done from a simple shell wrapper today, but: I could automate SG1 (S3 API gateway) bypass. 

To do that, I run S2S3 [on Grid Network](/2024/04/02/storagegrid-networking.html), query StorageGRID API to find out what's what (I can make that query from another network) and then copy data from NFS share *directly* to Storage Nodes, bypassing StorageGRID's S3 API gateways.

Check this out:
- 2 x SG120 (the smaller StorageGRID S3 API load-balancing gateway)
- 3 x SGF6212 (all-flash StorageGRID data nodes)
- If I bypass the SG120 and PUT directly to the SGF boxes, I can migrate 47% faster, muahahaha!
- If I had 64 data nodes, I could run 64 or 128 instances of S2S3 in copy-data mode and achieve 200 GB/s PUT **to a single bucket**.

![SG1 bypass](/assets/images/s2s3-03-scaleout-sync-sg1-bypass.png)

But, why would I want to do that? Who *has* this problem???

It would also be easy to improve re-sync (subsequent incremental updates of S3 buckets), but there's no reason for me to solve that problem knowing it's unlikely to exist in the first place. I'll solve it when I hear of someone who actually has it.

I built S2S3 to make this possible, but I don't think I'll need this. I do have some ideas not related to performance.

## Versity S3 Gateway-related features

There are also none. 

But I have this section anyway because - as illustrated in the [Parquet compaction example](/2026/06/16/netapp-eseries-iot-compaction-opensharing.html#steps-in-detail) - Versity S3 Gateway is an Open Source, S3 gateway for standard POSIX filesystems.

That means - see my other posts about the Versity S3 Gateway - we can do cool things when that makes sense.

For example, we normally shouldn't use S2S3 to copy data over S3 if we can mount the NFS share from the VM attached to E-Series and do something like:

```sh
rsync /mnt/nfs_share /mnt/vgw/ && \
   versitygw ... posix /mnt/vgw
```

No need for S2S3! You do need to pay attention to links or any unusual stuff, of course. `man rsync` to figure out how to deal with it.

But, "it depends". Sometimes, we'd have to use Rclone or S2S3 or something else, and then we'd want it to work rather than stumble.

So far, I know S2S3 does work with Versity S3 Gateway (v1.9.0) because I test S2S3 with Versity S3 Gateway.

Incidentally, client-side or object store-side throttling is usually necessary with small objects because these can be retrieved from NAS faster than they can be uploaded to Versity, even though Versity S3 is [very fast for small objects](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html).

We also have to be mindful of the fact that it's still POSIX underneath S3. Since you're migrating from POSIX (NFSv3) to POSIX (Versity S3 Gateway's filesystem), you probably don't need to worry about weird filesystem layouts, but you should still watch out for surprises - someone could have 10 million files in a directory and the miserable experience would be migrated to S3 together with that directory layout.

## More advanced automation

One may wish to give a copy tool like this an "all-in-one" feel, and make it a full-featured migration utility. For example, automate steps in StorageGRID side of migration:

- Create bucket in tenant account
- Create dedicated account for S23, if it does not exist. Create a new set of S3 keys if none are available
- Create or update traffic classification rules for S2S3 clients
- Pick a canned ACL template (including limited read-only policy for non-tenant users, recommended until after final sync and verification)
- Analyze file list and recommend ILM rules
- Perform the initial copy and do things S2S3 does today...

None of that is hard, but how many users who use free tools actually have these problems?

From what I've seen, there are users who need to migrate hundreds of NAS shares at once, but they use commercial software for that. It works, it has all of the features one can think of, and you get L2/L3 support and patches, so that you don't have to to have prepare three freeware tools for "just in case the main one gets stuck"

Another reason for using commercial tools is you can *do more* than just migrate to S3. You can create embeddings, tags, check for the presence of PII and more - all in a single pass, whereas S2S3 doesn't do any of that - so if you use freeware you may read the same 300 TB data set three times to do what Datadobi or Komprise do at once.

I *am* able to do this with S2S3 and [Kompromise](/2026/09/29/kompromise-storagegrid-search-processing.html) today, and this is why I wanted my own copy tool: not to overcome some imaginary performance bottleneck, but for technology and integration demos.

## What about tiny files?

They make S2S3's job easier.

Let's say you have 3.125 billion 64 KiB files in a 100 TB NAS share. At 8,000 files/s (basic NAS enumeration speed on S2S3), that takes 4.52 days to enumerate, and maybe just a day to compare that with previous inventory, calculate the changes and re-sync.

But, I didn't say S2S3 stops at 8,000 files/second. That's what I get with one S2S3 client. If your NAS can list files 4.52 times faster than my Linux kernel-based NFS server with 2 vCPU VM, you could enumerate and re-syc over a weekend.

I say *could*, because that's theoretical - if many files changed, you may need to PUT 0.125 billion new objects to the destination bucket and delete 75,000,000 old objects, which your S3 may not be able to do in a day.

## What to use and why

My first suggestion is: don't use S2S3 if anything else works for you. There's no reason to. 

Commercial software: most apps for NFS-to-S3 migration work fine with StorageGRID. There are API headers and calls that aren't implemented, but those are documented and relatively less frequently used.

If you're a hardcore freeloader, consider Rclone. S2S3 makes use of it as well.

Or, if you like Rclone, also take a look at S2S3. Unlike Rclone, which is more "transactional", S2S3 is for one-off or iterative copying for the purpose of permanent migration. It tries to do not more, but less, than Rclone.

So, what does S2S3 actually do?

First, we enumerate a share like this:

```sh
$ s2s3 inventory nfs://nas.example/export \
  --db ./inventory-run-001 \
  --threads 2 \
  --uid 1000 --gid 1000 --groups 1000,2000
```

This gives us a list of files in a database I can query from S3S2 or elsewhere. I use that file list to copy with Rclone. After that, I can create another inventory to get another (full) up-to-date list with latest NAS share state and do an *incremental* copy. 

Other commands from the initial v0.1.0 release:
- export - exports file names, file paths, etc.
- diff - diff two inventories, to see what would be copied and delete in next Rclone sync
- verify - compares NAS and S3 inventory, or physical comparison for final switch-over to S3

When I'm ready to switch over, I make the NAS share read-only, run one final inventory and sync followed by a final pre-switch-over report generation.

I can do all this with Rclone alone, but Rclone does a million things and all I want is just five fixed steps (for as long as I can resist using custom options).

## What not to migrate

There are workloads that suck on S3. Each year, they [suck](/2026/08/19/datalake-rag-netapp-storagegrid.html) [less](/2026/08/28/datalake-agentic-rag-netapp-storagegrid.html), but there are applications (especially closed source) that simply can't work with S3. What works well on NFS or can't even work elsewhere should likely stay where it is.

Focus on what obviously shouldn't be on NAS. If you have multiple NAS boxes with data that can be either on NAS or S3, you probably should move at least 80% of that to an object store such as StorageGRID and [get more out of your data](/2026/09/08/opensharing-data-mobility-netapp-eseries-storagegrid.html) and [GPUs](/2026/10/14/kompromise-instaclustr-opensearch-workflow.html) for less money *even after* paying for application refactoring.

## Conclusion

S3 solved [data sharing in hybrid cloud](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html) both for AI and analytics. For most enterprises, migrating (what they can) from NAS shares to S3 buckets should be one of top business priorities. Do that, and you've solved half a dozen other problems.

![S3 solved data sharing in hybrid cloud](/assets/images/medallion-architecture-dont-manage-storage.png)

NFSv3 to S3 is part of that migration opportunity.

S2S3 is not meant to replace anything, it's just my take on data copying from sub-100TB NAS shares to S3 buckets. 

You don't have to [use S2S3](https://github.com/scaleoutsean/s2s3) in particular - I won't know either way - but if anyone uses it and it works better or cheaper for them than some other tool, that would be great.

I know there are better and proven copy tools. Some may be costly, others may be hassle to download or use. Pick whichever works for you.

## Appendix A: Demo

This lengthy demo goes through the workflow (plus some small extras) for **one-shot** NFSv3 to S3 migration. Main steps:
- Make NFS share read-only
- Build NFS inventory
- Copy NFS share to S3 bucket
- Verify (using several approaches)

- ![S2S3 walk-through](https://rumble.com/v7hgax0-s2s3-share-to-s3-a-tool-for-nas-to-s3-migration-for-storagegrid-and-vgw.html) - 8m52s
