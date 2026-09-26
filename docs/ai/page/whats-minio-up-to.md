# What is MinIO up to these days?

MinIO's attempts to monetize aren't stopping

- ["Adjustments"](#adjustments)
  - [Latest and greatest: "breaking changes"](#latest-and-greatest-breaking-changes)
- [Are you telling me there's a chance?](#are-you-telling-me-theres-a-chance)
- [Thoughts](#thoughts)
  - [Risk and commercial issues](#risk-and-commercial-issues)
  - [Technical side](#technical-side)
  - [Alternatives](#alternatives)
  - [Risk of forks](#risk-of-forks)
- [Conclusion](#conclusion)

## "Adjustments"

Last summer MinIO made [an attempt to annoy us freeloaders](/2024/08/04/fixing-ui-annoyance-with-element-blocking.html), but I doubt that did them much good.

But that was just one of the more visible - or perhaps, visual - attempts to squeeze some revenue out of the many users they have out there.

I don't track them very closely so this won't be any kind of deep-dive, but I'm keeping an eye on them.

Some things I remember:

- Deprecated "S3 gateway" (i.e. FS support) feature, probably to free some engineering resources from dealing with the constant issues from multi-protocol environments (since they can't monetize those, i.e. non-S3, in any case)
- Changed to a collectivist open source license to make use by commercial users harder
- Threatened legal action against a friendly downstream user (Weka), which was stupid since anyone could tell Weka was well within its rights (Weka forked the product under the old license)
- Launched a new product, AIStor. I guess the name or purpose doesn't matter, it was just a way to start cutting Minio (Object Store, or MinIO "Core") features
- Recently, just the other day in fact, I noticed they removed all traces of MinIO "Core" downloads from the Web site. The only thing that's easy to find is AIStor. Thankfully, the binaries are still publicly available at the old location at [https://dl.min.io/](https://dl.min.io/).
- Also recently, introduced "breaking changes" that will surely go down really well with both paying and non-paying customers
- And one minor, but annoying, issue is the increasing amount of marketing spam that "smaller" vendors used to be immune to. Look at the SEO/keyword spam! Whoa!!! Does anyone remember the days when it was common to use 5-10 keywords and 3-4 tags (and only if they were related to page content)? 

![Marketing overdrive](/assets/images/minio-marketing-wtf-01.png)

In the case you haven't noticed, this is everywhere. Recently I visited the Web sites of several similar software vendors - Datastax, Influx Data, Dremio - and the mix of SEO and AI-generated spam is sickening. At least MinIO's blog posts still appear human-written. For now.

They have the right, of course, and maybe it's working great. But for me personally (as a hobbyist, not as a competitor), I'm not even trying to read anything but the docs. Everything else is mostly junk, increasingly AI-generated. Does it matter? I think it will.

### Latest and greatest: "breaking changes"

Let's take a look at those.

![Breaking changes](/assets/images/minio-marketing-wtf-02.png)

One could say "breaking" is mostly the removal of boringcrypto support. But the UI is going away as well, so if you use the UI, that's breaking as well.

If you're a DIY hobbyist or a DevOps dude who rarely, if ever, uses the Web UI, that's no big deal. 

But if you're an SMB user who doesn't touch MinIO as long as it works (and when you do, you use the Web UI) you may be getting nervous.... When it does break, or an upgrade fails, what are you going to look at when there's no UI? Yes, the UI is still available, but how good it will remain is another issue. Oh, after writing this I found this - that didn't take long - issue [here](https://github.com/minio/object-browser/pull/3509#issuecomment-2907855950).

> What was the point of this? You deleted all the functionality and left us with just an annoying popup. Are we supposed to manage minio using only MC moving forward?

Thirdly, while AIStor is backwards compatible like they say, can one "migrate" *from it* **to** the free version now and tomorrow? Now you may be able to, but 2-3 months down the road, maybe not. All it takes is one new "feature".

Fourthly, in my opinion it's highly likely that MinIO "core" (and [Object Browser](https://github.com/minio/object-browser) (Web UI) that was ripped out of it) will gradually get worse. 

The annoyances I blogged about before are getting worse (Object Store issue 3550 opened 3 days ago). I don't think it's *deliberate*, but we know where the priorities and resources will go now that there are **two** versions of everything.

![Object Store nagware](/assets/images/minio-marketing-wtf-03.png)

In the case of "Object Store", based on the way they introduce their [Global Console feature](https://min.io/product/aistor/object-storage-global-console), my guess would be manageability improvements will be added to AIStor's console and not to Object Store. 

If 2FA or future FIPS vesions are taken out or not made available, for example, that would make the free version useless for most commercial users.

Oh, speaking of which, that's exactly what happened (I discovered that after writing the post). 

![MinIO community in action](/assets/images/minio-marketing-wtf-04.png)

The clueless users running are now reporting ["issues with LDAP login"](https://github.com/minio/minio/issues/21350). It's not an issue, because no feature, no issue! 

![Crippled MinIO LDAP login](/assets/images/minio-marketing-wtf-05.png)

RTFM, dude! LDAP authentication became an ["issue"](https://github.com/minio/object-browser/pull/3537)... For MinIO Sales team I mean.

- Removal of external IDP login endpoints and associated helper functions in user_login.go and auth endpoints.
- Elimination of bucket tags API endpoints and corresponding swagger definitions.
- Purge of LDAP authentication code and unused configuration/test functions.

Another one [here](https://github.com/minio/object-browser/issues/3518):

![Where's my ILM policy edit feature, dude](/assets/images/minio-marketing-wtf-07.png)

After API "cripplening", [UI was next](https://github.com/minio/object-browser/pull/3538) - to remove "unused" (LOL - they meant "crippled") functions.

Checking [this](https://github.com/minio/object-browser/pull/3532/files) PR, the new intended purpose of MinIO Core is: Basic Features, S3 Express, Non-Disruptive Upgrade, QoS, Catalog, Monitoring, Audit Logs, Health-Diagnostics, RDMA, GPU Direct, AI Features. 

The paid one has "basic" plus Site-Replication, Enterprise Grade Security, Encryption and Key Management. 

The crippled IDP login isn't mentioned, and the removal of subnet support either (I never used that feature, but I wonder if now management UI and S3 must run on the same network - time to brush up your NGINX or Caddy skills, folks!)

After all these changes, this (credit: MinIO) is what you get - a ~~simplified~~ dumbed-down experience.

![We've simplified things for you](/assets/images/minio-marketing-wtf-08.png)

With that, an *en masse* conversion from freeloading to paying is about to commence.

## Are you telling me there's a chance?

They have to pay employees and suppliers and earn money for shareholders, so the above isn't unexpected. 

It's probably "working" in the sense that some users, both large and medium, are happy to pay (or at least RFQ-ing now). 

Most of MinIO's users are simple DIY freeloaders and developer types who may pay for AWS S3 or a low cost substitute service (Backblaze, Wasabi, etc.). I don't think these will subscribe.

For simple on-premises experimentation and testing, MinIO is great. But, I've written about Versity (which is great as well and now probably even *better* for 30-40% of on-premises use cases) and there are others (more on that below).

MinIO's challenge is S3 is a very standardized and extremely commoditized software product (service). I think they'd do well if a server maker (say, Lenovo) bought them. 

As-is, paying customers will want to buy properly supported storage servers - and MinIO has just 3 (SM, Dell, HPE) partners - OS and software. By the time one pays everyone involved, things can get complicated technically, support-wise and sales-wise.

Weka and Vast have similar go-to-market and from what I see and hear I think that's far from friction-free. (I also used to work for ISVs with similar GTM approaches and it was messy.) Maybe bundling the OS (a search-and-replace version of Debian, for example) would make things easier, but then you're in Linux (re)distribution business as well (been there, done that, and it's not fun!).

## Thoughts

### Risk and commercial issues

I expect that most customers who pay for S3 software and have 100s of TBs of on-premises object storage will see MinIO as risky. 

Even with the free version, I never hear of anyone moving *to* MinIO. I'm sure some do and don't tell me, but it's probably in dozens. I've never heard of any cases in APAC. Freeloaders are surely many.

What's different compared to Weka and Vast is MinIO is normally used for high-latency workloads. I know "AIStor" is awesome for low-latency workloads, but paying users  who need low latency usually also need high availability and uptime, which means on-premises or at least in-country support. 

For high-latency bulk workloads it's attractive (cost-wise, risk-wise, features-wise) to use Tier 2 S3 service providers.

In theory, there's "no lock-in", but as we all know, when you EC across a bunch of servers, a crappy one makes the entire N+M set work like crap. Two clusters, two server markers is fine. But I wouldn't mix different server suppliers in one cluster. 

From what I've seen most "commercially-minded" MinIO users in APAC, once they realize S3 is important, get a proper S3 storage solution (meaning: storage appliances).

### Technical side

So, one shouldn't mix different servers in the same cluster (I know it's possible, but it's looking for trouble), and they need at least "a bunch". Do you want to buy half a dozen 1U all-flash servers just for MinIO? You probably don't. 

In theory, MinIO is well-behaved for small files (I mean, objects). Fast metadata, lightweight, some proprietary S3 API calls... In practice, since the AI craze has started, people have been taking notice of that opportunity. 

Now even S3 software is differentiated enough that we're back to people having two (S3) suppliers in order to de-risk, get better prices or maybe buy a smaller "scratch/temp" S3 for AI while they keep a trusted on-premises S3 vendor for backups and other things they intend to keep around for a decade or five. 

And even when it comes to small object workloads, there are faster alternatives and MinIO [can be slow](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html). 

In fact, "traditional" storage systems (often referred to as "unified") simply provide S3 in addition to NFS and other protocols (iSCSI, etc.). Those tend to be already in place (supporting VMware, databases, Kubernetes, for example) and although the way they do S3 isn't "native", the truth is most customers don't care. They're often good enough. 

Instead of buying half a dozen 1U servers, here you buy 10 extra SSDs, create S3 service, use rclone to replicate critical buckets to a SP for DR and you're done unless you have a large deployment with 100+ TB buckets.

Even if you buy a new "unified" box, it often takes just $15-20K to get started with **all** services (block, file, object) and there's almost nothing to maintain. 

Don't forget that with MinIO you need to maintain and patch not just server firmware, but also buy and maintain many OS instances. It's not a huge issue (some SolidFire eSDS customers preferred this approach), but smaller customers don't like it. And performance-wise, if you have small object workloads, unified appliances work much better (similar to Versity S3 Gateway) because there's no Erasure Coding or extra communication overhead on S3 cluster network.

I've also heard of (the freeloading) MinIO users who hated the JBOD storage management side of MinIO. This is also a "feature" that is loved by some, and hated by others. But there's nothing MinIO wants to do about that, because you're supposed to buy dumb servers with JBOD storage. 

So, they move to "proper" enterprise S3 appliances that are easier to mange, or unified S3 appliances that run on protected RAID devices so you can run MinIO scale-out clusters with EC on devices that don't break, or even without EC (especially single-node MinIO, if you don't need more than a few GB/s). I investigated these EC and non-EC approaches [here](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html) after one such user reached out.

One last "technical" point: the "legacy" (in MinIO's view) unified storage appliances (and/or single-node MinIO in a container or VM backed by iSCSI, for example) can take storage snapshots, which makes it easy to protect, replicate and backup object storage. 

Personally, I think that's not how S3 should be managed in most cases, but a lot of people prefer that over scripting rclone or DIY solutions: it's the way they do things today (with NFS, iSCSI, etc.) and it doesn't require cloud-based S3 service to replicate to. KISS works for many smaller S3 users, I guess.

### Alternatives

The customary section where the blog author pitches their company's product(s). Or maybe not.

But in terms of "directions", or where to look if you're fed up with MinIO:

- Enterprise S3 appliances - non-free (same as non-free MinIO), but easy to maintain. Among "unified" you will find "full" or "multi-protocol" (same content can be accessed with NFS and S3, with some limitations due to fundamental differences among file and object service). 
- HPC, analytics, DIY users - Versity S3 gateway for traditional and scale-out file-systems (including Versity's own ScoutFS, BeeGFS, etc.). As the name says, it's a gateway (MinIO nuked that feature in late 2022), offers commercial support and even has **ARM64 builds** so you can use it on tiny ARM64 systems. I'm not aware of a *management* UI, but if I needed one, I'd use one of them Web management front-ends for Ansible and create a couple of Python modules for things I'd like to have in a Web UI. No license tricks either ([Apache 2.0](https://github.com/versity/versitygw/commit/64e6b6dabf857ef4f9930731edaac2175c59006f)).

### Risk of forks

I think MinIO will have a tough time converting many of the freeloaders to paying customers. 

I also think a free fork may appear soon if they drive "Core" and "Object Store" into the ground. 

As I've noted above, the Web site is becoming increasingly useless and even (free) software downloads are almost hidden. There's fewer and fewer reasons to visit their Web site. 

They're moving closer to "danger zone" as far as the risk of getting forked is concerned.

Recently a pull request to un-cripple the free version was submitted, and then closed.

![MinIO community in action](/assets/images/minio-marketing-wtf-06.png)

I can't tell why the request was closed without getting merged (there's no discussion/comments), but maybe the discussion happened elsewhere and the author was informed that the free version must be crippled in order to "monetize" the other one.

## Conclusion

Personally, I use several versions of MinIO, including a 2022 version with Gateway feature (which allows me to see objects as "files" on my file-system and `scp` them to a bucket path, which we can get with Versity S3 Gateway). 

I can handle (by blocking it in CSS) the eye-catching red dot, but the way things have been going, soon we might start seeing even more sophisticated nudges. Perhaps something like this could increase sales by at least 14% YoY?

![Fly in random walk](/assets/images/fly-walk.gif)

The risk of a community fork is real in my opinion. 

Because the recent uncrippled versions were already "license crippleware" (OSS, but with a crappy license), I think the chance of a Service Provider forking MinIO is low (they'd be better off by forking an Apache-licensed version the way Weka did, but they'd lose all the features MinIO added in this decade). 

But a recent version could be forked by the freeloader community that doesn't mind the crappy [GNU Alfero GPL](https://github.com/minio/object-browser/blob/master/LICENSE). They just need to keep the features that MinIO had had. Some Tier 2/Tier 3 storage provides may be interested in contributing, so that they can include it as a free add-on.

Like me, most of those users run single node configurations and in that regard MinIO is pretty much feature-complete. This would work well for SOHO/SMB businesses as well (single VM node on generic iSCSI protected storage, for example).
