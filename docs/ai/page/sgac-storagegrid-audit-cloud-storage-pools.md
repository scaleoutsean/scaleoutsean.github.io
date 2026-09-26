# Auditing StorageGRID Cloud Storage Pools with SGAC

Use SGAC to find CSP-related events in StorageGRID log

## Introduction

[StorageGRID Audit-log Converter aka SGAC](https://github.com/scaleoutsean/storagegrid-audit-analysis) is one of the more frequently downloaded utilities I maintain on Github. I don't recommend it for version 12, but people still download it.

I suppose there are still some use cases for it:

- People who can't or won't do the right thing and send logs to [Elasticsearch](/2023/07/20/storagegrid-and-elaticsearches.html) or other log management system
- On-demand analysis for development and experimentation

WTH is a Cloud Storage Pool ("CSP")? It's a remote object store that StorageGRID may use in ILM rules and policies. 

Why use it? That is [explained in TFM](https://docs.netapp.com/us-en/storagegrid-121/ilm/what-cloud-storage-pool-is.html):

> A Cloud Storage Pool lets you use ILM to move object data outside of your StorageGRID system. For example, you might want to move infrequently accessed objects to lower-cost cloud storage, such as Amazon S3 Glacier, S3 Glacier Deep Archive, Google Cloud, or the Archive access tier in Microsoft Azure Blob storage. Or, you might want to maintain a cloud backup of StorageGRID objects to enhance disaster recovery.

*Unlike* data in [RSTs in BeeGFS, which can be directly accessed](/2026/08/07/simple-access-to-beegfs-rst-data.html), CSPs are tightly managed by StorageGRID. That means objects are wrapped in a StorageGRID "wrapper". You may view contents of the CSP bucket, but you can't really use data (unless you strip the ILM wrapper).

This post considers what happens with objects in CSP-related workflows and how SGAC can be used to track related events.

## CSPs, audit log and SGAC

Let's take a look at how data gets tiered into a CSP.

This is on StorageGRID 12.1, by the way. First, an object is PUT into a bucket.

```raw
2026-08-14T17:56:42+08:00 sg-storage-02 Audit: 2026-08-14T17:56:42.638653 [AUDT:[CBID(UI64):0x0000000000000000][RULE(CSTR):"Make 2 Copies"][STAT(FC32):DONE][CSIZ(UI64):1075][UUID(CSTR):"81CEA4B8-9809-11F1-981B-1925965B087C"][PATH(CSTR):"rand/LICENSE"][LOCS(CSTR):"CLDI 12908970, CLDI 12257404"][RSLT(FC32):SUCS][AVER(UI32):10][ATIM(UI64):1786730202638653][ATYP(FC32):ORLM][ANID(UI32):12257404][AMID(FC32):OBDI][ATID(UI64):16792649010399259655]]
```

I have an ILM policy that kicks in after a delay (`1d`) so, 24 hours later, that CSP ILM rule (`r-pepsi`) creates this log entry:

```raw
2026-08-15T17:57:43+08:00 sg-storage-03 Audit: 2026-08-15T17:57:43.238337 [AUDT:[CBID(UI64):0x0000000000000000][RULE(CSTR):"r-pepsi"][CSIZ(UI64):1075][UUID(CSTR):"81CEA4B8-9809-11F1-981B-1925965B087C"][PATH(CSTR):"rand/LICENSE"][LOCS(CSTR):"CLDI 12908970 3221225472, CLCP cf205ee0-4032-43ff-b002-aafca5b4ed46"][RSLT(FC32):SUCS][STAT(FC32):DFER][AVER(UI32):10][ATIM(UI64):1786816663238337][ATYP(FC32):ORLM][ANID(UI32):12996059][AMID(FC32):ILMX][ATID(UI64):9842901317166428289]]
```

Here's how that object looks like in the console after that:

![CSP-tiered object](/assets/images/sgac-csp-00-object-metadata.png)

The bucket uses this policy tag:

![CSP-tiered bucket policy tag](/assets/images/sgac-csp-01-bucket-policy-tag.png)

The tag uses this policy:

![CSP-tiered bucket policy](/assets/images/sgac-csp-02-bucket-policy.png)

The policy uses this rule:

![CSP-tiered bucket policy rule](/assets/images/sgac-csp-03-csp-policy-rule.png)

Time-wise, these are the rule details:

![CSP-tiered bucket policy rule details in time periods](/assets/images/sgac-csp-04-csp-policy-rule-details-time.png)

- Keep 2 copies for 1 day
- Cut copies to 1 and make a copy to CSP after 1 day
- After 4 days, delete object and purge from CSP

The same but in "storage pools" view:

![CSP-tiered bucket policy rule details in pools](/assets/images/sgac-csp-05-csp-policy-rule-details-pool.png)

We're in day two now.

The CSP itself:

![CSP storage pool](/assets/images/sgac-csp-06-csp-storage-pool.png)

At this point, grid administrator's object (named `LICENSE`) metadata lookup query shows this:

```json
{
  "TYPE": "CTNT",
  "CHND": "81CEA4B8-9809-11F1-981B-1925965B087C",
  "NAME": "LICENSE",
  "PHND": "756F33BC-9809-11F1-8286-FE9600BB087C",
  "PPTH": "rand",
  "META": {
    "BASE": {
      "PAWS": "2",
      "ACCT": "55295525968323305569",
      "SOWN": "10",
      "*ctp": "application/octet-stream"
    },
    "BYCB": {
      "CSIZ": "1075",
      "SHSH": "MD5D 0x4BF474A51A92B42E8709C9EB64783252",
      "CVER": "262149",
      "BSIZ": "1322",
      "CTME": "1786730202512616",
      "MTME": "1786730202512616",
      "ITME": "1786730202512616"
    },
    "CMSM": {
      "LATM": "1786730202512616"
    },
    "AWS3": {
      "LOCC": "us-east-1"
    }
  },
  "CLCO": [
    {
      "Location Type": "CLDI",
      "NOID": "12908970",
      "VOLI": "3221225472",
      "LTIM": "1786730202512875",
      "Object File Path": "/var/local/rangedb/0/p/00/00/00vu@B^g--iw6mqxTL-7"
    },
    {
      "Location Type": "CLCP",
      "CPID": "CF205EE0-4032-43FF-B002-AAFCA5B4ED46",
      "CPTH": "rand.81CEA4B8-9809-11F1-981B-1925965B087C.1786816663093613",
      "LTIM": "1786816663093613"
    }
  ]
}
```

`CPID` is the automatically assigned unique Cloud Storage Pool ID for this CSP I set up (cf205ee0-4032-43ff-b002-aafca5b4ed46, assigned to a unique combination of an endpint URL and a bucket name) and `CPTH` the S3 key name in it.

In the UI we an see our storage pools copies have dropped to one and we have a copy in cloud storage pool.

![Object lookup for CSP-tiered object in SG UI](/assets/images/sgac-csp-07-object-md-lookup-with-csp.png)

I have multiple ILM policies that tier multiple buckets from the `pepsi` tenant into the same remote bucket, which is fine for testing. You may be forced to the same in production as well if you set up CSP for over 10 buckets because the maximum number of CSPs in 12.1 is 10.

It was very frustrating setting ILM rules for CSP, as I couldn't figure out how to set per-bucket rules that affect placement for over an hour.

For this "source" bucket, `rand`, I see two objects in the remote CSP bucket.

```sh
$ mc ls s3/csp/
[2026-08-16 02:02:52 CST] 1.4KiB STANDARD rand.31070563-980A-11F1-A41B-4D7744DB087C.1786816972294133
[2026-08-16 10:38:44 CST] 1.3KiB STANDARD rand.81CEA4B8-9809-11F1-981B-1925965B087C.1786816663093613
[2026-08-13 13:36:45 CST]    20B STANDARD x-ntap-sgws-cloud-pool-uuid
```

So, to get to CSP I use `csp_bucket` + `/` + `sg_bucket`+ `.` + `CPTH` + `.` + `LTIM` (the last two values are from the metadata lookup JSON above) identify the S3 key for this object. 

`CPTH` is the same as `sg_bucket` + `UUID` from audit log.

`LTIM` is a problem because that isn't in the audit log lines above. But it *is* logged in audit log: there's a tiering "metadata action" (copy-object-to-CSP) triggered to rewrite StorageGRID metadata and it uses a private API (`/api/v4/private/object-metadata`), which isn't guaranteed to remain stable or even available in future versions of StorageGRID, so I won't attempt to rely on it. Yes, we can get `LTIM` today, but if they change the API 12.2, audit log will change as well and our scripts would stop working.

Since `LTIM` is just a suffix (`.LTIM` is added to the end of S3 key), it makes the "mapping" between objects in the source and CSP destination bucket harder, but still possible with SQL `LIKE` queries or regular expressions.

StorageGRID tenants can't use object metadata lookup API which is available only to StorageGRID administrators. Also, what if a tenant wanted to check dozens or hundreds of objects?

## CSP data validation at scale

I think the cost and latency StorageGRID doesn't have a tool or utility to check CSP at scale because it would be very expensive.

As long as there's a local copy (which would have precedence) on storage pools accessible to the grid, we can't recall the CSP copy. If our ILM policy deletes all copies from Storage Pools, then we can validate CSP copy by reading it or its metadata, but that would be extremely expensive. 

Checking should be done externally and probably closer to the CSP bucket (e.g. in AWS EC2 if your CSP uses AWS S3).

To run a check, we'd need to compare two lists or "tables", the source and CSP. 

The next problem is CSP-tiered objects are "tainted". We can't *directly* get an object's true content from a CSP bucket and compare it against a copy from a Storage Pool. Their sizes and hashes will differ. Even names (without `LTIM`) and times (because create time and "tier to CSP" time will differ from when an object is written to CSP tier) won't be identical.

If StorageGRID was configured to encrypt content (by picking one of the two encryption options below) or if objects were encrypted on the clients, contents would look garbled.

![Enable object encryption](/assets/images/sgac-csp-12-object-encryption.png)

So the question is what should these lists contain? I think best we can do is partial matches on object names from StorageGRID audit log, as explained above. Or, if you want to chase any private API changes, get `LTIM` as well and you can perform full matches on object names.

## Object versioning on CSP buckets

It appears object versioning *on destination* (CSP bucket) can be used to retain older versions - in case someone overwrites ILM-tiered objects - so that we can recover them. Each version at the source results in a different object in the CSP bucket, so I believe normally - until ILM expires or objects get deleted at the source - no CSP object ever needs two versions. So, as long as overwritten CSP version can be recovered, you can get that object back.

Normally, there's a limit to object version count and non-current versions get cleaned up, so one can't wait for too long.

Object Lock could interfere with ILM rules from StorageGRID, and that's even more likely if multiple buckets tier to the same CSP bucket, so I'd stay away from that. In fact, [TFM says](https://docs.netapp.com/us-en/storagegrid-121/ilm/considerations-for-cloud-storage-pools.html#s3-permissions-required-for-the-cloud-storage-pool-bucket) "Objects with S3 Object Lock enabled can't be placed in Cloud Storage Pools", but that seems wrong.

![No Object Lock on the source](/assets/images/sgac-csp-08-object-lock-csp.png)

But I have it enabled. And object count shows `8`, while there's only three in the UI.

That means several versions - if not *locked* versions - exist.

![Object count](/assets/images/sgac-csp-09-object-lock-object-count.png)

I also see locks are in place on source bucket objects.

```sh
$ mc retention info pepsi/csp-pepsi/LICENSE
Name    : pepsi/csp-pepsi/LICENSE
Mode    : GOVERNANCE, expiring in 1 days, 20 hours
```

And although the source bucket shows few objects, the CSP bucket shows 7 (I added one to the source bucket minutes ago and it hasn't been tiered to CSP yet):

```sh
$ mc ls s3/csp
[2026-08-16 01:26:31 CST]  78KiB STANDARD csp-pepsi.0565EC40-9805-11F1-A806-BD38BA164DDB.1786814791877426
[2026-08-16 01:30:24 CST] 1.3KiB STANDARD csp-pepsi.154152EE-9805-11F1-BC07-6BC0C274F9AA.1786815024074695
[2026-08-15 22:15:37 CST] 1.3KiB STANDARD csp-pepsi.4DFF72E6-97EA-11F1-BC07-7F636A54F9AA.1786803336818741
[2026-08-16 01:36:26 CST] 7.8KiB STANDARD csp-pepsi.7C0FA337-9806-11F1-B41B-A37EBE1B087C.1786815385730865
[2026-08-15 22:21:12 CST] 3.3MiB STANDARD csp-pepsi.BD9B06A3-97EA-11F1-981B-55C84EFB087C.1786803672393493
[2026-08-16 01:33:22 CST] 1.3KiB STANDARD csp-pepsi.CB3F30F7-9805-11F1-B407-E1C15E14F9AA.1786815202423230
[2026-08-16 01:56:14 CST] 1.3KiB STANDARD csp-pepsi.DE4DC393-9808-11F1-A806-BD3ABE164DDB.1786816574532888
```

`csp-pepsi/Vagrantfile` also had Object Lock on it, there's just one version of it, and it was tiered to CSP.

```sh
$ mc retention info pepsi/csp-pepsi/Vagrantfile
Name    : pepsi/csp-pepsi/Vagrantfile
Mode    : GOVERNANCE, expired 14 hours 29 minutes ago

$ mc head s3/csp/csp-pepsi.7C0FA337-9806-11F1-B41B-A37EBE1B087C.1786815385730865
�^?L|^?�7�^?^?��^?�~�^?^?|IMAGE_NAME = "bento/ubuntu-20.04"
K8S_NAME = "k8s"
MASTERS_NUM = 1
MASTERS_CPU = 1 
MASTERS_MEM = 4096

NODES_NUM = 2
NODES_CPU = 2

$ mc retention info s3/csp/csp-pepsi.7C0FA337-9806-11F1-B41B-A37EBE1B087C.1786815385730865
mc: <ERROR> Remote bucket `s3/csp/csp-pepsi.7C0FA337-9806-11F1-B41B-A37EBE1B087C.1786815385730865` does not support locking 
```

So, the claim related to object lock and CSP seems wrong. It is true there's no object lock on the destination CSP bucket, but that was never in question and that's not what the documentation claims. Objects with object lock *are* being tiered to CSP buckets, it's just that they're not *locked* there.

To test, I made sure Object Lock is enabled on the bucket, with 2 day duration and created a new object, `LICENSE` at 2026-08-17 04:40:44 GMT. I checked 24 hours later (Tue Aug 18 05:10:55 AM UTC 2026). The object was supposed to be tiered after 24 hours as per that per-tenant policy tag for the `pepsi` tenant.

![Locked object in CSP](/assets/images/sgac-csp-10-object-lock-in-csp.png)

The object was tiered to CSP bucket. Below, we see Object Lock has close to 24 hours to expiry, but CSP does have a copy as well.

![Locked object in CSP and local time](/assets/images/sgac-csp-11-object-lock-in-csp-and-local-time.png)

The `pepsi` bucket has a different policy, based on this rule, so 3 copies are expected on day 2:

![The WTF rule](/assets/images/sgac-csp-12-wtf-rule.png)

Regarding object lock on CSP buckets: one could probably even enable object lock on CSP buckets, as long as locks expire sooner than shortest StorageGRID ILM rule that's supposed to delete them. I'm not advocating this, I'm just saying the documentation in StorageGRID version 12.1 doesn't seem accurate and fails to elaborate on potentially useful data protection scenarios for CSP copies.

## CSP vs. Cloud Mirror vs. DIY copy/delete

If we need to periodically (weekly or monthly, for example) make sure CSP objects are "all there", we probably shouldn't use CSP. 

You can use Cloud Mirror and let StorageGRID replicate objects for you. Most obvious advantages:
- objects in two locations are separate - you have a copy in StorageGRID, and you have a copy elsewhere, so consistency checking is possible and easier
- compared to DIY replication, StorageGRID manages copying for you. This can also be a disadvantage if you want to do this differently, write to different destinations or have some other fancy requirements
- your grid or Internet connection in the office can go down, but your Cloud Mirror data remains reachable from Equinix or elsewhere

Note that [there are limitations, too](https://docs.netapp.com/us-en/storagegrid-121/tenant/understanding-cloudmirror-replication-service.html#cloudmirror-and-s3-buckets), so you'd have to evaluate based on your requirements and needs.

If you don't like how Cloud Mirror works, you can replicate objects by yourself and then it's easy to audit and validate later.

In the case of large buckets, this means you won't be able to replicate the entire bucket once a day or week. You'll have to use notifications and create object-copy tasks and workflows. As you take over job queue and job management from Cloud Mirror, you need to run (or pay someone to run) another service to keep track of what needs to be copied or deleted from the remote bucket. Examples:

- [NATS](/2026/06/21/nats-server-on-netapp-eseries.html)
- [Kafka](/2026/08/05/kafka-on-netapp-eseries.html)

That means you also have to make sure that these services:
- get notifications from StorageGRID
- don't lose those notifications until you've processed them
- don't silently fail to execute copy-to-cloud jobs
- since lists of objects can be obtained from both sites, we can run verification jobs

Deletion seems simple, but it is tricky. CSP and Cloud Mirror are used for different purposes and [Cloud Mirror doesn't propagate deletes](https://docs.netapp.com/us-en/storagegrid/ilm/comparing-cloud-storage-pools-to-cloudmirror-replication.html). There's no ILM here and maybe you don't want to delete a replica in public cloud just because it was deleted locally. In other words, maybe you need a policy engine in your DIY stack or maybe you are okay with an independent ILM policy at the destination ("delete objects older than 5 years + 1 day from remote bucket").

Each approach - CSP, Cloud Mirror, DIY solution - has its advantages and shortcomings. There's no problem that a DIY approach can't solve *if you have unlimited resources* or a very trivial problem.

## Conclusion

This post shows you how CSP is recorded in StorageGRID audit logs and what to look for if you want to find and use this information.

If we don't feed audit log or event notifications to a service, SGAC can help us perform **sampling** checks on a subset of data. For example, we could do the following once every month or week:

- Use SGAC output to verify existence and no tampering for 1% of the CSP-tiered objects (using full or `LIKE` matching explained above). This could use SGAC output (or Elasticsearch query output, if you feed StorageGRID audit log to Elastic)
- Use S3 logs from the *destination* object store to make sure no CSP object was ever overwritten (as that isn't supposed to happen) and that can be easily checked by enabling versioning on the CSP bucket. You may also want to check object deletes - while this is more complicated to check, if the shortest ILM retention rule used on the bucket is 365 days, no deleted object should be aged less than 364 days. You can build scripts that make these checks more targeted based on ILM rules that apply to policies that tier into that CSP destination
- Retain all audit logs in a read-only bucket (possibly in a different cloud or StorageGRID region)

Since there are several ways to do this, it doesn't seem like something that should be added to SGAC as a generic feature, and so far I've heard just about people kicking tires on this topic. If I hear some concrete requirements from real customers, maybe I'll improve SGAC to make it easier to get a list of candidates to sample from CSP.

If it's important to verify all CSP data on an ongoing basis, you may need to run a service. (Or, before you decide that, consider if the destination can provide these guarantees to avoid doing extremely comprehensive checks.)

The first question to answer would be: a service for what? Do we want to run daily or weekly checks on statistically significant sample sizes from CSP, or build a service that does more?

- If you want to rent, Instaclustr provides [OpenSearch as a service](https://www.instaclustr.com/platform/managed-opensearch/), Kafka and other services. You can send logs and notifications to Instaclustr-manged services running in *your cloud account* and automate replication or logging and verification without managing own infrastructure. Third party (ISVs) may have a packaged solution for this, but make sure it works with notifications and not just "brute force" object lists (which isn't very valuable - you probably can do this yourself for free).
- If you want to build on premises, prefer three entry level storage systems (e.g. EF-Series EF300) over one larger array (e.g. EF80) because there's no point building a DIY replication or CSP verification system that's less reliable than the system it's supposed to replace or keep in check.

This isn't a simple task, so although "full control" sounds ideal, it's complex and costly.

If I wanted a DIY service that ensures validity of replicated data, I'd try to build or pay for a service that is in charge of *both* data replication and verification. Having a way to verify but not *do* anything about failures would seem like a partial solution. Data lake users could store StorageGRID logs and notifications in data lake tables, which would also offload some of the work on existing data lake workflows, processes and tools and cut implementation effort by more than 50%.

I still dislike the complexity of these solutions, but the reality is there are no other solutions for this scale - not just for unstructured and semi-structured, but - with data lakes - all types of data at scale. Workloads, tools, applications and entire stacks have moved to S3 and there's nothing else that lets you solve these problems on non-S3 protocols. I ranted about that recently [here](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html) so I'll skip the rest of that rant this time.

We can run one hyperscaler's stack in public and private cloud and "solve" the problem that way, or we can use these established patterns to build (or rent) something that works with all public object stores and even allows us to use on-premises S3 object stores from multiple suppliers.
