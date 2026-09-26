# S3 vector search - DIY vs AWS S3 Vectors

S3 vector search: it seems no one is doing it right.

This is a two-part post:

- **Part 1 - S3 vector search: S3 vector search - DIY vs AWS S3 Vectors** (this post)
- [Part 2 - S3 vector search: S3 GO NATS!](/2025/07/23/s3-vector-search-02-diy.html)

The first part is a rant against current approaches. The second will show a DIY approach.

- [Introduction](#introduction)
- [AWS S3 has peaked](#aws-s3-has-peaked)
  - [AWS S3 Vectors](#aws-s3-vectors)
- [On-prem S3 vendors' vector search solutions](#on-prem-s3-vendors-vector-search-solutions)
  - [Who wants poor man's S3 Vectors?](#who-wants-poor-mans-s3-vectors)
- [Conclusion](#conclusion)
- [Appendix A: digression on Cloudian's vector search solution](#appendix-a-digression-on-cloudians-vector-search-solution)

## Introduction

This is an opinionated post about two topics:

- AWS S3 has peaked 
- On-premises S3 vendors' "solutions" for "vector search" aren't *that* special (and in fact you may want to spin your own)

## AWS S3 has peaked

- After years (almost decades) AWS S3 has finally become a "legacy service" in my book. It's not a good thing, or a bad thing, it's just a thing
- With trillions of objects and millions of S3 clients/apps that use those objects, there's no way to spin up some kind of "version 2" of the damn thing. Yes, they have been adding features, but I doubt they can make major changes at this point so new AWS S3-based solutions aren't that great in my opinion

So rather than have one S3 service that works, we have AWS S3 This and AWS S3 That, each of which has different limitations and APIs. S3 Tables and S3 Vectors, for example. 

The problem with that - as opposed to everyone just sticking with the S3 API for "regular" S3 and using *other* best of breed services for the rest - is that Amazon is creating these on S3 after everyone has come up with own, and perhaps better, ways to get this done. 

When S3 appeared, it was very basic but there was nothing even close to it. 

Today, if you want to access Iceberg tables over HTTP(S), there are already better ways. (I don't even remember right now, but last year I read a convincing blog post on the topic of (the lack of) AWS S3 API innovation). But AWS has a special S3 service just for that.

### AWS S3 Vectors

Regarding AWS S3 Vectors, that service seems like one of those "it's good, but probably not good enough".

If you code to the AWS S3 Vector API, you won't be able to take your workload elsewhere until non-AWS S3 providers implement the same thing... which may or may not happen. 

In fact, maybe they already have better ways of doing it, in which case you shouldn't even start with AWS S3 Vectors: even if you use AWS S3 today, you may be better off doing it right on your own or by using some other vector service.

I'm not an expert and I've never used it. 

But I've RTFM and I think I get the idea and it is what prompted me to write this post: I'd felt that S3 has been kind of stuck for years now, but after reading the S3 Vectors documentation I wanted to post about it.

Long story short: the service seems familiar - just add a few API calls to your existing S3 apps and you're golden! 

But they try to do something new with a product that shouldn't be used for it. In this case it's a vector DB accessible over S3 using "familiar tools and processes" (for S3 users). Yeah, except that it's weird.

They can't use regular S3 APIs alone because it apparently doesn't quite work for that (remember that Amazon S3 Select and Amazon S3 Glacier Select were closed to new customer access in 2024, if you didn't get the memo), but they didn't want to develop a **non-S3** vector DB service because spinning their own would be too much of a barrier to entry and most vector DB users are already using 3rd party vector search that may be impossible to provide as DBaaS due to licensing that disables OpenSearch-like shenanigans. 

Yes, there's OpenSearch (more on that below), but it's much more expensive to run than a specialized vector DBs at least some of which AWS may not even offer as a service due to restrictive licensing which makes it impossible to do it well.

The result is "AWS S3 Vectors".

It uses mostly existing S3 APIs, all right, but they couldn't make it work seamlessly enough. If you RTFM, you may notice some of the novelties (or "weirdness", if you will).

For example, this service has non-filterable metadata which you can't get with regular S3 API calls. You need to specify `return-metadata` to get these. The other weird part is these "metadata" aren't really S3 metadata. 

Here's what they say about that:

> Store larger text chunks that would exceed the filterable metadata size limits

It seems obvious to me that these fake (or "special") "metadata" are really just regular (but small) *objects* that may go up to few hundred KB in size because S3 Vector runs on all flash S3 storage service instances so that's a way to leverage S3. But they serve data to users as "non-filterable metadata" rather than "S3 objects" or "S3 tables", so it's yet another S3 workaround.

That made me wonder why they didn't offer vector storage as part of their regular S3 service (if only on the premium low-latency AWS S3) as opposed to creating a new offering that only *appears* to work the same as regular S3 while in reality it is a highly proprietary and strange form of it that will probably not be adopted industry-wide.

 They could have chosen to create vectors and store them in S3 tables or Parquet files on S3, but users would still need a client or server to access that data, so this doesn't really solve the problem for AWS.

Another weird detail is one can "export" S3 Vectors data and import it to AWS OpenSearch Service. 

According to an S3 Vectors team's blog post, it's because OpenSearch is much more expensive to run. Also, it's rather limited in terms of vector search features, (which they didn't mention). But S3 Vectors is slow, so they provide a way to export this to OpenSearch for "hot" buckets.

And, according to screenshots of workflows in the AWS S3 Vectors documentation, it seems export feature is conveniently integrated with AWS-hosted OpenSearch, but there's no direct way to simply dump it to a file or S3 bucket and import to *own* OpenSearch instance or other database (such as ElasticSearch or a vector DB of your choosing).

Okay, "I see you". 

But hey - maybe I can do most of that on my own without using any AWS services (except S3, which is well supported by dozens of vendors) in the first place?

Yes, maybe you can, and maybe you'll be better off if you do.

## On-prem S3 vendors' vector search solutions

I don't need to go out of my way to provide a "balanced view": it's simple - on-prem "S3-compatible" vendors haven't done a better job than AWS. On the contrary.

At first, they had nothing for vector search for years although the solution was sitting *right under their nose*. 

For example, most have had SNS and Webhook for ages, and what have they done with that? Nothing. Figuring out the rest was an exercise for the user. 

Now it's the other extreme - many are overreacting. One recent example is Cloudian (see in Appendix A).

I won't say more as I've already ranted about these often unnecessary and bloated "solution stacks" (for AI and analytics) recently.

It's not rocket science, people! You already have some sort of notification feature. Just publish a `docker-compose.yaml` with services required to get that to top 3 vector DBs and let the customers use it! 

But that's not good enough because everyone "needs a vector solution". So they now waste time on productizing and re-packaging free 3rd party software rather than publishing 5 files on Github and spending time to innovate elsewhere. Excellent choice! Not.

### Who wants poor man's S3 Vectors?

I intended to work on this before AWS S3 Vectors (with export to OpenSearch) appeared.

It was in the post about BeeGFS gRPC event notifications in version 8 (of BeeGFS). As I mentioned [here](/2025/06/15/pipeline-with-beegfs-file-system-notifications-v2.html) and [here](/2025/06/22/data-pipeline-with-beegfs-file-system-notifications-and-versity-s3-gateway.html), that gives me a good tool to do "my own thing" in terms of building data pipelines.

But I spent all my free time in late June and early July working on another thing ([Firemox](/2025/07/07/firemox.html)), so AWS S3 Vectors (Preview) got released before I managed to do my own take on "vector search for on-premises S3 users". 

At the same time their announcement gave me the opportunity to reflect on S3 in general and take a look at their take on S3 and vector search.

I have the details in my [next post](/2025/07/23/s3-vector-search-02-diy.html).

## Conclusion

AWS S3 Vectors looks "okay" given the limitations AWS S3, which they have to use, has. 

Would I use AWS S3 Search? If vector search was important to me, I don't think I would. If it was peripheral (small scale RAG for some non-essential internal documents), maybe I would.

If vector search was important, I'd rather look at ways to:

- use a 3rd party cloud API or vector search that integrates with my on-premises S3 or AWS S3. By now there are good ones and well worth making this trade-off
- roll my own (and when doing it, I'd emulate APIs of the vendors who I think do this better, rather than AWS S3 Vector API calls)

S3 Vectors is in preview so it's surely going to get better, but my guess is *not* by much because they'll spend time working around the limitations of S3.

The way it works now has major disadvantages:

- if I use vector search a lot, I'll have "hot" vector data, so I'll have to subscribe to AWS OpenSearch, export data (operational hassle!), and still have somewhat limited vector search (compared to vector-focused databases)
- if I need other vector DB or have S3 data on-premises or in some other public cloud, I still need a solution for that
- even if you develop your vector search workflows based on AWS S3 Vectors architecture, you won't be able to use those on-premises for 1-2 years (until your on-premises S3 vendor implements those new API methods, if they do it at all)

What can on-premises S3 storage vendors do?

They could implement similar "special buckets" feature and follow the AWS S3 vector-related S3 Vectors API to provide the same API methods S3 Vectors uses. Don't rock the boat, implement S3 Vectors API calls (they're already in AWS SDK, although subject to changes) and move on. 

The problem with that is they still wouldn't have a complete solution - the part that is "hot" vector DB search (an on-premises equivalent of AWS OpenSearch Service) would be missing. 

So now some are coming up with a "vector solution" which in most cases are nothing but a *low-complexity* engineered solution with sizing guidelines on how to send Webhooks to **one** particular vector DB. I think customers would be better served by providing a small repo with how-to articles and integration samples for **top 5** vector databases on Github. 

Another way to think of this "solution" is: more than three decades ago (1995) companies started sharing product documentation from their Web sites. How many storage vendors built a "search database solution" for NFS shares? 

No one did because it wasn't necessary and search was always (ideally) a *shared* service and not something that's attached to a storage system. Some storage vendors sold full stack database systems (IBM and Oracle+Solaris, for example), but I don't think that comparison applies here and even if it does, that approach has been mostly abandoned.

Now we're supposed to believe we should buy a vector DB hardware & software stack from our on-premises S3 vendor and tether it to that particular S3 system. Or use S3 Vectors.

Storage-tethered search service wasn't necessary in 1995 and it's not necessary today. There are better and technically more correct ways to do this.

## Appendix A: digression on Cloudian's vector search solution

> The integration of data storage and AI inferencing into a single, efficient platform represents a fundamental shift in how enterprises approach AI infrastructure.

That's what their CTO said according to Blocks & Files.

I disagree:

- It's not a "single platform". Maybe it's all running in single K8s service, but that's not what "single platform for object and vectors" means. If it is a single platform, what do I do if I want another vector database rather than Milvus? 
- There's nothing fundamentally new here. S3 SNS and Webhooks have existed for many years and can be sent *anywhere*, and processed and stored in the way that suits you best. 

The blog post also [says](https://cloudian.com/blog/cloudian-ai-inferencing-platform/):

> Having separate unstructured data and vector stores entails data movement and separate infrastructure components. 

I'll believe it when I see it.

B&F mentions "Milvus runs on auxiliary nodes while leveraging HyperStore for persistent storage of vector indexes and collections", but we know Milvus nodes (more or less like Elasticsearch) need local disk and while they can dump or tier data to S3, they're not stateless. 

Who knows, maybe they run Milvus on NFS storage from Cloudian S3 gateways (I hope not!) which would make me wrong?
