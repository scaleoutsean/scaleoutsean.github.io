# Improved Kompromise webhook for NetApp StorageGRID

Notes on the improvements to Kompromise Webhook service

## Introduction

[Kompromise](/2026/06/27/kompromise-pipeline-netapp-storagegrid-eseries-vgw.html) is v2 of my PoC project for S3-based data pipelines with NetApp StorageGRID and Versity S3 Gateway, based on last year's "GO NATS!". 

It aims to create a no-nonsense, fully functional, production-worthy pipeline demonstration. The first Kompromise post last June (link above) was the initial "alpha-grade" stack. Since then I've been busy with other (and simpler) projects, but a lot of those have been successfully completed, so this weekend I spent some time revisiting Kompromise and made some progress.

As a reminder for those lazy to click: 

![Kompromise architecture](/assets/images/kompromise-pipeline-00-diagram.png)

Given the code's immaturity, there are many areas that need to be fixed. I started from Step 1, webhook service.

## Kompromise webhook for StorageGRID

That's the first two steps from the diagram above:
- Receive notification
- Send to data to the right NATS subject

What's been improved is support for the StorageGRID, because notifications on the Versity S3 Gateway are currently very basic and may change:
- Reliability - handles objects that get deleted before enrichment and more
- Enrichment now offers basic and advanced notifications. Advanced pre-fetches object details, freeing the user from having to do that on their own in Step 3
- Added S3 authentication needed for rich notifications, uses STS Assume Role
- Fixed convention for subject naming in NATS (step 2)

## Walk-through for Kompromise webhook

StorageGRID platform services must be enabled, and notification endpoint has to be set up.

![StorageGRID notification](/assets/images/kompromise-storagegrid-webhook.png)

- (1) `sg` for StorageGRID
- (2) `pepsi` is the tenant name
- (3) `assumed` is the bucket name
- (4) `assumed` is not assumed from (3) but the topic name from actual XML notification configuration in the bucket. If this bucket had different notifications, this name would have to be different for each
- (5) mTLS is strongly suggested for production environments, but requires some effort on both Kubernetes (where Kompromise Webhook is expected to be, although it can run stand-alone)

Bucket owner the sets up Webhook service for `s3.events.<namespace>.<bucket>.<pipeline>` in Kompromise and - depending on whether notifications are basic or advanced, Webhook sends event data to the right NATS "topic" (subject). Using the example above, NATS subjects would be named:

- Simple: `s3.events.pepsi.assumed.raw`
- Enriched: `s3.events.pepsi.assumed.enriched`

Simple provide less data, but have reliable delivery, while enriched do more, but can fail and there's no "retry" (since StorageGRID has already delivered the notification, and Kompromise Webhook does not retry). If you need "reliable Rich", you can use Simple and create your own enrichment pipeline that uses same NATS service for reliable enrichment.

The first Kompromise post at the top has demos of example functions that can be created and deployed by pipeline owner. The ETL function on video objects is one such example which only needs a simple notification and the rest is handled in user's ETL function, so that is already available.

There are several minor limitations, for example by convention it is required to name StorageGRID notifications after the Kubernetes namespace, for automated bucket-to-namespace matching. This doesn't mean all users who consume notifications *must* have workflows in the same namespace - you can have multiple container-based Kubernetes clusters on a VM- or bare metal-based Kubernetes cluster and create notifications for multiple destinations. 

If you have Coke and Pepsi using notifications for the same bucket, you can create two small Kubernetes-in-Kubernetes clusters and two notification destinations on StorageGRID.

## Next steps

The Webhook now sends data differently, so NATS configuration and pipeline setup must be updated and improved.

It needs a better configuration, mostly, to implement stronger user segregation, considering that NATS is a shared service managed by the Kompromise admin. If you don't want to have one Kompromise service (and one NATS cluster) per each bucket, you need secure multi-tenancy on shared services (NATS and AIS, primarily).

While this worked in Alpha, it had some loopholes, and needs improvements.

## Other thoughts

Someone may ask why is it so complicated? Why bother? And let's throw in a "whataboutism": what about Open Source S3 Notification Webhooks?

It's not exact complicated, it just needs work and I have 20 things going on.

One of the other reasons it took me months to start working on this again was I probably spent days (on-and-off) exploring various angles to improve the design, but none of them worked out: not possible, too hard, too complicated to use, etc. 

Why bother? Why do we need this anyway?

NetApp StorageGRID [still has the same, basic search integration](/2023/07/20/storagegrid-and-elaticsearches.html) from last decade.

In 2024, [Kafka notifications were added](/2024/02/23/storagegrid-notifications-kafka.html,) and Webhook notifications after that. These are fine - they do one basic thing (notify) and the AWS specs don't leave room for arbitrary innovation, so it's different from Search which is up to each Object Store's integration (StorageGRID doesn't serve AWS S3 Vectors API, for example). The basic Search functionality and S3 Vectors was what motivated me to do "GO NATS!" last year.

Anyway, so I consume Webhook notifications in Kompromise - but don't do anything for search. Notifications are just the shovel for the "shovel-ready job" that modern search is. You have to take care of the job yourself until they build something that may or may not work the way you want.

That's why Kompromise is valuable to me: I'm trying to create a pipeline tool that works for unstructured data (images, videos, unstructured text) exactly the way I want it. To do that, I don't use Search integration because it can't do what AI workloads require. We need to use the shovel.

Now, I can't change how StorageGRID Notifications work. I could send Notifications to a Kafka (more reliable) or Webhook service (little less reliable). [Kafka is a hog](/2026/08/05/kafka-on-netapp-eseries.html) and if you want to send to Kafka, go ahead.

You can skip Kompromise Webhook and send Kafka Notifications directly to [Instaclustr-managed Kafka](https://www.instaclustr.com/platform/managed-apache-kafka/), as a way to get the benefits while outsourcing maintenance to the professionals. For me, [NATS does the job](/2026/06/21/nats-server-on-netapp-eseries.html) close enough and it's easier to use and manage. So I use Webhook and NATS.

The Webhook looks good enough now, so I'll probably release a stand-alone binary and container image that can be easily used with any NATS instance for whatever purpose - those who have no need for AIS and S3 caching can probably use it for something else.

For the purpose of processing large data objects, Kompromise benefits from AIS, and NATS needs reliable block storage as well. If you make good use of three-to-six LUNs for AIS and three for NATS and save by not spending $500K on something else, it makes sense to buy three EF50 arrays and take care of all block storage needs. Now, that *is* interesting. You have a *better* service and you didn't waste $500K on nonsense. Good job!

Stand-alone Webhook service that sends data some NATS to do something I don't know about is viable, but less *interesting* to me from a solutions architect perspective - it's a little bit like an open-ended "what's better" question that has no clear answer. Not interesting.

What about Open Source Webhooks? Recently I've [stopped wasting my time on open sourcing these projects](/2026/09/20/sgac-storagegrid-audit-v030.html), and this week I realized that's a new and pertinent question. Why use Kompromise Webhook when I can use my own or some open source S3 notification Webhook or send directly to Kafka instead? 

One of the purposes of these projects is to encourage NetApp users to build integrations rather than wait for "features", so if anyone builds their own, that's the ideal outcome.

Whether some generic S3 notification Webhook works, what's better, what's not, etc. I don't know and - to be honest - I don't care unless I'm engaged in a situation where I need to answer that for work. I know *mine* works exactly the way I think it should with StorageGRID (it doesn't even work for the Versity S3 Gateway, although I'd like it to work for both). It also has a "rich" mode which Webhooks usually don't have. So, another way to ask the same question could be "why does Kompromise use its own Webhook?" and the answer is because it works better as far as I can tell.

## Conclusion

The Webhook component of Kompromise is beta-grade now and might be decent enough for simple non-critical use cases.

Some might ask what "non-critical" use cases can be when notifications can fail? I answered that in the first Kompromise post: if the pipeline is object pre-caching (which is why Kompromise has AIS - that's *the main pipeline*), worst that can happen is a slower, non-cached read.

There are many "professional" solutions out there, from datalake platforms to startups, so for truly mission-critical everyone will buy or rent one of those, to have someone to blame or sue.

Kompromise just needs to works good enough to prove the concept and idea is sound, so that you can build one like it if you want. The basic pipeline is simple, there's no bloat, failures are low-impact events, and the rest is based on established open source code. It's free, but not worth nothing.

My next to-do items:
- NATS configuration improvements
- User pipeline configuration updates to reflect changes in Webhook and NATS
- Add an additional ETL demo function(s) that I had in "Go NATS!", to create embeddings and search interface as the main use case for "rich" Webhook notifications
- Documentation
- Testing
- Packaging (binaries)
