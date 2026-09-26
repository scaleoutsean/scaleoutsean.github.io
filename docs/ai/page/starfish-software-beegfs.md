# Starfish Storage for better StorageGRID and BeeGFS manageability

Short post on what Starfish Storage can do for BeeGFS and StorageGRID users

## Introduction

In the case you haven't heard of [Starfish Storage](https://starfishstorage.com/product/), they're a software vendor whose flagship product - if I may call it that - is Starfish Storage Unstructured Data Catalog (UDC). 

UDC thing catalogues your unstructured data.

> Think of the UDC as a living map of your entire data universe. It works with anything – HPC clusters, regular NAS boxes, all those obscure file systems, Windows servers, you name it.

That means it scans it, basically. 

Unfortunately, their documentation isn't public, so I can't say if it can build catalogues using other approaches, but scanning is the usual and default one.

As you can imagine, once you have a database of all your file and object stores with all the shares, buckets, files, objects, you can make smarter decisions, and even automate some of your administrative operations. Starfish Storage Automation Engine takes care of automation. And then there's Starfish Storage Zones, which logically groups multiple resources for "virtual" views of an organization's, team's or project's unstructured data estate.

## What's it for?

Anyone who drowns in unstructured data and needs to manage or understand it better.

There are different vendors with different approaches and focuses and oftentimes those solutions are vertical-focused. I recommend you take a closer look by yourself.

- Starfish has a page with [case studies](https://starfishstorage.com/resources/)
- There's also an overview of solutions [by industry/vertical](https://starfishstorage.com/industries/)

Some other vendors who provide similar software focus more on hybrid cloud, others more on migration, etc. They may have similar features, but if you look at what someone can do for *your* use case, it's easy to see if it could fit or not.

## BeeGFS and StorageGRID 

The [ecosystem](https://starfishstorage.com/ecosystem/) page shows BeeGFS and StorageGRID.

I mostly put this post together because of Starfish Storage validation for BeeGFS, listed on the ecosystem page. I had no idea, which is embarrassing for a solutions architect.

From the [FAQs](https://starfishstorage.com/faq/):

> Starfish supports any and all file storage systems. We have special integrations for Spectrum Scale, Lustre, HPSS, Isilon, and Qumulo. Our superfast, multi-node crawler is great for VAST, Weka, Pure, NetApp, Panasas, BeeGFS, Quantum, and Quobyte.

### BeeGFS

We first discover by scanning (or other techniques) and then we execute various actions.

Those actions may be tagging (in the DB), replication, reporting, showback/chargeback, deletion, compression, and even data processing.

While other parallel file systems may have some of these features, BeeGFS has very few, which makes this integration worth highlighting. 

Starfish lowers the cost of managing BeeGFS. While you can build some of these tools and utilities yourself, you may not want to, or you may not have enough time.

If you're buying BeeGFS for "just" 500 TiB of KV cache plus some model serving, doing one-off development just for one system may be wasteful. 

Without Starfish, reporting and chargeback/showback *can* be done, but you need to create, QA and maintain scripts and databases. It's not very hard, but a lot of people don't see value in doing that for "just" 500 TiB of data on BeeGFS when they have 37 PiB to manage across S3, BeeGFS and NAS.

Without Starfish, you may use BeeGFS Storage Pools and even RST for tiering to/from S3. I've blogged about that several times, most recently weeks ago. But then you also have to monitor pool utilization, bucket utilization, and of course develop and maintain these utilities that can theoretically disappear files and directories. I even created [a wrapper](/2026/07/05/eke-smarter-workflows-for-beegfs-netapp-eseries.html) to make it easier to use Storage Pools, but anyone who uses it must believe that my wrapper won't delete their data (deliberately or by mistake).

Without Starfish, you can't compress files on BeeGFS. Many times they're compressed (images, for example), but sometimes they aren't and they consume a lot of space. This can be "solved" by using a compression-enabled ZFS on NL-SAS pools; I blogged about it years ago. But then you have to manage not just BeeGFS but also ZFS, zpools, filesystem's own L1 and L2 cache, and BeeGFS on top of it. Some people don't like to do that.

There are other situations where Starfish makes sense, but I can't access their documentation to confirm:

- BeeOND: because BeeOND can create RAID 0-based ephemeral filesystems on (GPU) compute nodes. Starfish can be used to find stale BeeOND data and alert the administrator. It could also be configured to automatically delete *very* stale BeeOND data (e.g. older than 14 days)
- BeeOND to BeeGFS replication: anyone who uses BeeOND for things other than KV cache (say, checkpoints in deep learning) could have Starfish take care of copying those to BeeGFS
- Tiering to/from S3: BeeGFS [has this feature](/2026/07/18/beegfs-84.html) but it's not for the faint of heart (see the post for these details). If you write your own automation, then you need to trust your own code and QA tests. So, it still makes sense to use tiering the way Starfish does it, have a fixed recipe for it and have authentication, logging, auditing all in one place

### StorageGRID

StorageGRID support is interesting as well, but it is usually the destination for replication, tiering, archiving. Sometimes it's also the source, but if you understand the value for BeeGFS, you will also understand it for StorageGRID. 

BeeOND-to-StorageGRID replication of deep learning [checkpoints](/2026/08/26/s3-files-sg-nvcomp-checkpoints.html) seems useful, as BeeOND isn't protected (RAID 0-based) and its capacity is usually limited. Frequent rescans (every 60 minutes) and "copy to S3 & delete" seems useful, as users in 90% of cases don't need more than 1-2 checkpoints in any case. There's no need to use the BeeGFS tiering (RST) feature because BeeOND is ephemeral anyway - key appeal to me lies in scheduled scans that's logged and centrally managed in one place. I could write a script that does something similar, but I'd prefer not to if the purpose was to provide this as a supported service for production Deep Learning.

### AI

Inevitably, someone would ask this question.

I have no idea what "AI features" Starfish has, but once you have a database with file paths, file metadata, Storage Automation Engine can do whatever you want with it. I wouldn't be surprised if they had an MCP server and some experience with agentic AI integrations.

Also from the FAQs linked above:

> What kinds of jobs can Starfish execute?
> Pretty much anything. We include commands for copy, move, delete, hash calculations, extracting metadata, analyzing text, etc. Of course, you can execute your own scripts and call any third-party APIs.

## Takeaways

Starfish support for BeeGFS is valuable, but I didn't even know about it. If you deal with sensitive data, PII data, services where workflows must be formalized, auditable and so on, Starfish deserves a close look. 

StorageGRID was a known Starfish solution to me, and it's usually used as the destination for data migrated, replicated, archived to S3.

[This page](https://starfishstorage.com/21-surprising-things-you-can-do-with-starfish/) has an iconographic with a list of 21 things Starfish can do for StorageGRID and BeeGFS users.
