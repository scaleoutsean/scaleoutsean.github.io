# Tier WEKA NeuralMesh to NetApp StorageGRID S3

High-level overview of WEKA tiering with NetApp StorageGRID

## Introduction

Just in case anyone wondered: yes, you can use WEKA NeuralMesh with NetApp StorageGRID.

To be exact, "to use with" means this:

![Weka with NetApp StorageGRID](/assets/images/weka-storagegrid-00-tiering.png)

As WEKA [explains](https://docs.weka.io/4.3/weka-system-overview/data-storage#media-options-for-data-storage-in-the-weka-system):

> Users seeking to balance performance and cost must consider a tiered data management system, with the assurance that the WEKA system features control the allocation of hot data on SSDs and warm data on object stores, thereby optimizing the overall user experience and budget.

The same page also notes that even in SSD-only WEKA configurations, users can still Snap-to-Object. That is a [separate feature](https://docs.weka.io/4.3/weka-filesystems-and-object-stores/snap-to-obj) and works as one can expect from the name. [WEKA administrator can also export WEKA audit logs to StorageGRID](https://docs.weka.io/5.0/security/security-hardening) where we can protect them with Object Lock. These are additional use cases for WEKA with StorageGRID, but they aren't about tiering so I won't focus on them in this post.

## Benefits

The benefits are obvious from the diagram:

- Get features and benefits of WEKA on front-end
- Transparently tier warm or cold objects to StorageGRID and retrieve them automatically and on-demand
- Get features and benefits of StorageGRID for whatever other S3 workloads (including WEKA's Snap-to-Object and other applications)

## How does it work?

### WEKA front end

You can find the details in the documentation (links below), but just to give you an idea what happens once tiering is configured.

- WEKA metadata always stays on WEKA
- Writes always land on WEKA
- Metadata reads are on WEKA since that's where metadata always is, while data comes from wherever it is located (WEKA SSDs or Object Store back-end "proxied" by WEKA)

To the client, this is fully transparent - clients use the usual protocol to connect to WEKA. There's no external redirection or similar.

Inside of WEKA and between WEKA and StorageGRID, it works like this (borrowed from the WEKA documentation):

![Weka-StorageGRID Data Lifecycle Flow](/assets/images/weka-storagegrid-01-tiering-state.png)

If a file has been evacuated to StorageGRID and isn't already cached, WEKA gets it for you from S3. All writes land on WEKA SSD.

Tiered objects have `CAPACITY IN OBJECT STORAGE` greater than zero:

```sh
$ weka fs tier location image
PATH   FILE TYPE  FILE SIZE  CAPACITY IN SSD (WRITE-CACHE)  CAPACITY IN SSD (READ-CACHE)  CAPACITY IN OBJECT STORAGE  CAPACITY IN REMOTE STORAGE
image  regular    102.39 MB  0 B                            0 B                           102.39 MB                   0 B
```

[An example](https://docs.weka.io/4.3/weka-filesystems-and-object-stores/tiering/pre-fetching-from-object-store) of on-demand **pre-**fetching tiered objects from object store:

```sh
$ find -L /mnt/archive/project_53 -type f | xargs -r -n512 -P64 weka fs tier fetch -v
```

You may want to do this before running large compute jobs on tiered data, when you know you'll need to quickly access most or all of the files that the `find` command comes up with. "Smarter" patterns and filtering based on file names, dates, etc. are possible and often used; the WEKA `fetch` command will try to prefetch whatever file list is generated for it.

Objects tiered to StorageGRID get tagged by WEKA, but I don't have any real-life examples and can't say if they can be used in some way (for example, to create charts that help you better understand how WEKA uses object store data). StorageGRID does have a ton of stats and WEKA does too, but still - if you need to know more and can derive useful information from those tags, that would be interesting.

Some WEKA documentation pages (WEKA NeuralMesh v4.3) to get you started:

- [States](https://docs.weka.io/4.3/weka-system-overview/data-storage#states-in-the-weka-system-data-management-storage-process) in the WEKA data management storage process
- [Attach to an object store](https://docs.weka.io/4.3/weka-filesystems-and-object-stores/attaching-detaching-object-stores-to-from-filesystems/attaching-detaching-object-stores-to-from-filesystems)
- [Configure tiering to StorageGRID](https://docs.weka.io/4.3/weka-filesystems-and-object-stores/tiering)

### StorageGRID back end

For now, I'll put my thoughts from a StorageGRID perspective into a long-bulleted list.

- I would expect most users would acquire NL-SAS-based StorageGRID appliances for this use case. If you have existing (all flash or hybrid), that would work too, but to realize cost savings for cold data, NL-SAS is better
- ILM policy on the "WEKA bucket" should be Erasure Coding-based:
  - WEKA users usually need high throughput
  - We want savings, so 2-Copy ILM policy doesn't make sense in any case
  - EC 4+1 or something like it is probably a good idea for ILM on the bucket used by WEKA
- I'd disable versioning and Object Lock on the bucket as I can't see a reason to enable them
- There's usually no reason to enable encryption or compression on StorageGRID for this kind of workload
- You may use Day 1+ ILM policies (say, Day 0 uses 6+3, Day 1 uses 4+1), but I wouldn't. What's the point?
- Bucket(s) used by WEKA must not be configured for cloud tiering to slower/external object stores. This isn't supported for any vendor's tiering to StorageGRID simply because fetch requests from front-end could take many seconds, or minutes, to complete leading to I/O timeouts and poor user experience
- Performance-wise, even a small four- (storage) node StorageGRID cluster may be enough because even at 2 GB/s that is 70 TB/h. But four nodes won't let you configure Erasure Coding 4+1 until you get to six storage nodes (+1 for HA), so with four nodes you'd have to use EC 2+1 and maybe "re-stripe" (using StorageGRID ILM policies) that to EC 4+1 later, as your StorageGRID grows.
- Network Load Balancer for StorageGRID could be the smaller [SG1](https://docs.netapp.com/us-en/storagegrid-appliances/installconfig/hardware-description-sg120-and-1200.html) (S3 API gateway and load-balancer) appliance. The larger one is obviously faster and has 100G NICs, but it also costs more. Furthermore, one can deploy multiple gateway appliances in a cluster, so for half a dozen storage nodes (say, six as in our recommended "starter kit") two of the smaller load balancer appliances would be enough (N+1 for HA). Even if this cluster grows later, you could add another pair of the smaller appliances for other users. One situation where one should start with the larger appliances is when you know from the beginning you'll need more than one pair of smaller appliances and would rather use two bigger than four smaller. Only rarely would one want two pairs of smaller appliances; one example is if these need to serve clients from different networks, or vastly different workloads (performance, governance, security, and so on).

I will expand and improve this section later if I manage to gain additional insights.

One of the several things I'm interested is WEKA and StorageGRID stretched across DCs.

![WEKA+StorageGRID stretched cluster](/assets/images/weka-storagegrid-02-stretched-clusters.png)

I don't know whether this is possible, but it should be (assuming your network between DCs is fast and redundant enough).

From a StorageGRID perspective, this is not a new pattern. Splunk SmartStore with StorageGRID, for example, relies on the same grid layout and features. In order for WEKA in DC1 to retain access to StorageGRID, it would have to be able to automatically switch to the SG1200 pair in DC2:
- Normally, there's a global load balancer (for more on that, see the StorageGRID solutions) sitting between S3 clients (WEKA) and local S3 load balancers (such as SG1200). This approach is fully automated and global load balancer usually uses smart DNS redirection.
- Poor man's object store switchover to the other site: without global load balancers, you can change DNS for Object Store FQDN that WEKA uses to "local" load balancer pair on the other site. Make sure the TLS certificates, routes, MTUs and more all work as expected. There's just one StorageGRID cluster so S3 access will remain unaffected and S3 keys don't need to change. The way this works is WEKA uses one back-end, say sg.example.org.com, but each site needs to get "local" SG1200 IP addresses from its DNS servers and because TLS terminates on those SG1 boxes, TLS certificates need to be valid across. If StorageGRID in DC1 fails, DC1's DNS records need to be redirected to SG1 nodes in DC2, and that change has to be reversed on fail-back. WEKA would need to be able to use different DNS settings in each site. Stretched StorageGRID [supports](https://docs.netapp.com/us-en/storagegrid-121/maintain/modifying-dns-configuration-for-single-grid-node.html) different DNS server at different sites
- You can also assume an entire site (DC) is a failure domain, in which case you wouldn't need to make WEKA from one DC be able to switch to StorageGRID load balancers in the other DC, but considering the cost of GPUs, you'd probably want to be able to keep those GPUs and WEKA running in all DCs if at all possible

I don't know if anyone uses stretched WEKA-StorageGRID clusters this way, but that is not complex or new. I'd certainly investigate this if requirements justified it. Three and four sites (DCs) are possible as well.

The ILM rule in the image says "1 copy per site", but:
- it doesn't have to be configured that way, and
- that doesn't mean each copy is or isn't erasure-coded, and
- either way, the objective is to have a DR copy if you need it. Asymmetric ILM could be created as well (1 Copy per DC; EC 4+1 in DC1, 1 Copy in DC2)

## Compatibility

Most S3 tiering clients try to not use fancy API methods because the goal is to make the feature reliably support the widest range of object stores.

I understand the recent versions of WEKA (4.x) and StorageGRID (12.1, 12.0, and later 11 versions) are all compatible. 

**Edit:** after completing this post I found that [WEKA >=3.10 is mentioned as validated](https://docs.netapp.com/us-en/storagegrid-enable/third-party/116-3rd-party-list.html#third-party-solutions-validated-on-storagegrid) for StorageGRID (likely version 11.6 at the time).

## Conclusion

No matter which all-flash high-performance storage solution one uses, sometime it makes sense to offload warm or cold data to a lower-cost object store, especially if it's NL-SAS-based. Object stores often don't provide the same storage protocols and interfaces, so front-end high-performance storage clusters such as WEKA make the consumption of S3 seamless. 

WEKA and StorageGRID users get the benefits of both products the same time and any additional (deep learning, cold archive, Hadoop, whatever) applications can directly consume whichever system's S3 service makes more sense from a performance, security, governance, features, cost and other perspective. Tiering-to-S3 isn't mandatory. It a value-add which helps users get more out of the combination.
