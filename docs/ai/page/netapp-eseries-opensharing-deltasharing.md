# Does OpenSharing have anything for NetApp E-Series?

Thoughts on OpenSharing for NetApp E-Series

- **PART ONE:** Does OpenSharing have anything for NetApp E-Series?
- PART TWO: [IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series](/2026/06/16/netapp-eseries-iot-compaction-opensharing.html)
- PART THREE: [NetApp volume content sharing with OpenSharing and Versity S3 Gateway](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html)
- PART FOUR: [OpenSharing server for NetApp StorageGRID and E-Series with Versity S3 Gateway](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html)
- PART FIVE: [OpenSharing Server with S3/RDMA-based Versity S3 Gateway](/2026/08/10/opensharing-with-versity-s3-rdma-and-netapp-eseries.html)

## Introduction

Some of your applications gather or create TBs of data that needs to be shared with AI or analytics applications.

Easy-peasy! Just put it on a network share or S3.

Even better, keep it there from day 0, so that you don't have to move or copy it there in the first place!

In analytics, "network shares" used to mean mostly NAS (one of the NFS or SMB flavors). Other protocols weren't industry-standard, or didn't take off in analytics. Since 10 years ago, Object Store has become a prominent - even dominant - alternative, especially in hybrid cloud or multi-site environments.

Spot the odd one:

![Data sharing for analytics](/assets/images/opensharing-eseries-01-file-object-block.png)

Yep, there's something off about the last (right-most) approach. That *obviously* sucks.

And that's not the worst part.

The worst part is that DIY layer is a PITA. You implement a poor man's alternative to file/object sharing, need to ensure HA for services, end up with something that may not be very reliable or secure, and need to maintain it all. Ouch.

![Workarounds for block](/assets/images/opensharing-eseries-02-block-workarounds.png)

Then - if you didn't use NFS or SMB or (not shown) S3 - you still have problems *integrating* with these less popular protocols (rsync, SFTP).

Why bother at all? You might as well get proper NAS or S3 storage.

But, merely having file sharing doesn't make integrations happen out-of-box. Your applications may understand and work well with data sharing protocols (NFS, S3), but there's a lot of other things that have to happen. As OpenSharing puts it:

> this process often requires custom point-to-point integrations, manual asset copies and transfers, and overall a high level of friction

## OpenSharing

OpenSharing is based on [DeltaSharing](https://delta.io/sharing/), but even more open and generic.

- Cross-platform, vendor-neutral protocol 
- Secure zero-copy sharing of data assets

OpenSharing [aims](https://github.com/OpenSharing-IO/OpenSharing) to enable generic clients to use a consistent set of discovery API, credential vending model, and access controls across tables, volumes, ML models, and more.

You don't get discovery APIs on NFS or S3. You don't get credential vending (you do get it from COSI, see [here](/2026/06/13/storagegrid-sg-cosi-branch-snapshots.html), but that's just one part of the puzzle and Kubernetes-only). 

Also, you may list files on an NFS share, or objects in a bucket, but won't necessarily know what's what. 

So, this is going to be big for analytics and AI and it seems people are interested. This is the current ecosystem (credit: OpenSharing).

![OpenSharing ecosystem](/assets/images/opensharing-eseries-04-deltalake-ecosystem.png)

(Yes, there's a NetApp logo in there. I didn't create this image and I don't know what OpenSharing integrations there exist or may be planned by NetApp.)

## OpenSharing and E-Series

Does this mean anything for E-Series users? 

I would say it does. Just like you can use COSI to provide credential vending and bucket lifecycle for a [Kubernetes-based Versity S3 Gateway backed by E-Series](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html), you can do the same with OpenSharing.

Without OpenSharing, analytics users with E-Series couldn't park "external tables" on E-Series volumes. They had the cost and the performance benefits (and that's why they use E-Series to store data), but not a good way to get to their data after it was collected or generated.

OpenSharing is disruptive and changes that.

How's that different from simply uploading data to S3? You should read the DeltaShare and OpenSharing docs, but there are two sets of features:
- Authentication, discovery and credentials vending - this is new
- Asset data serving - this is your old school file/object sharing (in OpenSharing, it's just S3)

Having S3 (or NFS) just lets you serve data. If your assets aren't already registered as external tables - and with E-Series, they almost certainly are not because there has been no good way to get to them - even S3 is not enough.

OpenSharing has the following asset hierarchy:

```raw
Share
 └── Schema
       ├── Table
       ├── Volume
       ├── AgentSkill
       ├── Model
       ├── Agent (WIP)
       └── Page (WIP)
```

- A **share** is a collection of assets shared 
- A **schema** is a logical namespace grouping
- An **asset** is a data or AI artifact being shared

Let's see which of these may be interesting to E-Series users.

## OpenSharing with E-Series

Kubernetes is the key to avoiding DIY nightmares: it's easy to implement security, restrict access, and get HA. It's all free. You could certainly use OpenSharing on low-powered VMs or a pair of bare metal servers directly attached to several PB-sized E-Series boxes, if you don't like the thought of running Kubernetes just to access that data.

The minimal implementation featured in this post uses exactly that (Tables scenario) - Docker Compose on a bare metal system.

![OpenSharing with Docker](/assets/images/opensharing-eseries-06-opensharing-eseries-docker.png)

If you wanted something very simple, this could work.

To implement OpenSharing, a provider - that would be our OpenSharing API service instance - creates a share and adds assets. Tables will be served over the S3 protocol, so we add Versity S3 Gateway to our solution stack. `test-object.parquet` is a test table with 100 million rows.

![Versity S3 Gateway with a bucket and Parquet table](/assets/images/opensharing-eseries-07-opensharing-versity-s3-gateway.png)

An authenticated consumer can then discover and consume these assets. Note that - unlike with rsync, for example - these assets aren't copied anywhere ("zero copy"). If you have some lower-value data archived on E-Series, it can be consumed over S3 thanks to Versity S3 Gateway and that's obvious from the demo and the screenshot, where a Parquet table is queried remotely (not downloaded and then queried), similar to how [S3 Select](/2022/03/04/storagegrid-s3-select.html#example-3-brute-force-sizer-for-solidfire) works.

What assets are of interest to E-Series users? I can't tell for sure, but what's interesting to me personally is:

- Table asset - this is the default, really - any tables (CSV, Parquet, etc)
- Volumes asset - this is for generic data, if we just want to let clients access whatever data we've hoarded on E-Series. Documents, media, embeddings, raw data...

You could say:

| Asset | Who wants it? |
| :---- | :-------|
| Tables| Analytics clients |
| Volumes| AI clients, including agents |

Delta Sharing - with a narrow focus - could do Tables since 2022, but OpenSharing is broader and support for the second asset (Volumes) is new and somewhat of a *replacement* for file-based sharing or even "raw" object sharing over S3.

Before, we'd have a bucket or shared filesystem, but no apparent structure or information aside from share "paths", file names, or S3 keys that are usually meaningless or at best extremely limited outside of S3 or NFS protocols themselves. 

Assets are still on S3, but it's not the same thing.

### Tables

Assuming we wanted to do the bread-and-butter case and deliver OpenSharing for Iceberg or Delta **tables** parked on E-Series volumes, how could we do that?

First, we need to implement an OpenSharing API server, to take care of authentication, discovery, and credentials vending.

Second, we need to serve assets from E-Series volume(s).

The steps (`ListTables` and `GetTable` (info) have been simplified to make the diagram less busy):

- Steps 1 and 2: Client accesses OpenSharing server, gets redirected to OAuth2, gets `id_token` (JWT, JSON Web Token) and uses it with OpenSharing API server
- Step 3: OpenSharing API server assists the client with discovery and retrieves pre-signed S3 URLs from S3 server
- Step 4: OpenSharing client provides table information from S3 and shares it via pre-signed S3 URLs (credentials vending)
- Step 5: OpenSharing client gets data directly from S3 (Versity S3 Gateway)

![OpenSharing with Versity S3 Gateway and E-Series](/assets/images/opensharing-eseries-03-opensharing-vgw-eseries.png)

Here's how that works:

![OpenSharing for Tables with Versity S3 Gateway and E-Series](/assets/images/opensharing-eseries-00-versity-s3-gateway.png)

- Client starts with JWT obtained separately from an OAuth2 service and then discovers shares, schemas and assets available from OpenSharing API server 
- Upon receiving information about table(s), it can run analytics workload directly against Versity S3 Gateway paths using pre-signed URLs (provided by OpenSharing API server's credentials vending)

Human users would get a JWT token from a portal and store it in a `profile.share` file.

```json
{
  "shareCredentialsVersion": 1,
  "endpoint": "http://eseries.opensharing.company.com/",
  "bearerToken": "eyJhb...Of8SA"
}
```

Then they would simply access data on E-Series by connecting to OpenSharing API server using said profile file.

In the case of automated issuance, applications would load the same share profile on the fly and use it the same way.

If you have dedicated S3 storage such as StorageGRID, you can enable it for OpenSharing the same way Versity S3 Gateway is used in this post.

### Volumes

Tables are the default asset for analytics, but Volumes are more interesting for non-analytics use cases.

You could say that Volumes are also more disruptive as far as E-Series is concerned, because Volumes take care of the unstructured data sharing use cases, where E-Series simply didn't fit ("the odd one", at the top of this post). For Volumes assets, we'd reverse-proxy S3 access through OpenSharing app.

![OpenSharing of CSI volumes with E-Series](/assets/images/opensharing-eseries-05-opensharing-eseries-kubernetes.png)

As far as Kubernetes is concerned, I've already blogged on Versity S3 Gateway with E-Series CSI. We can take a PV with archive data, create a static PVC, use and share it to OpenSharing application server from an instance of Versity S3 Gateway. The OpenSharing API deals with clients (authentication, discovery, credentials vending...) as before.

The only difference compared to Tables is Volumes need a pass-through S3 proxy in OpenSharing API because we're not dealing with tables here. (**UPDATE:** that seemed to be the case while reading the specification; as I continued exploring I realized I misunderstood the specs and confirmed it [here](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html).)

I haven't implemented that for this post as Tables are where 95% of the OpenSharing action must be right now (considering Delta Sharing has been around for four years and virtually all their users are in analytics), but I'll keep an eye on this and other emerging use cases in OpenSharing.

## Conclusion

We've seen what OpenSharing is, why it matters, and how it "unstucks" E-Series in analytics and even AI workflows. If you have Kubernetes, there's nothing else you need but that simple OpenSharing API resource server, to make E-Series a first class citizen in AI and analytics.

![OpenSharing and SANtricity](/assets/images/opensharing-eseries-08-opensharing.png)

OpenSharing for Tables is working, and Volumes can be as well. The former is more useful right now, but the latter is highly disruptive - in the positive sense - as far as E-Series is concerned because until now E-Series was isolated and one had no choice but to move data that needed to be shared out to a file or object sharing service. Not any more!

The ability to park Delta and Iceberg tables on E-Series and access them using Kubernetes-based OpenSharing and S3 services is highly valuable. It costs next to nothing to implement, integrate and maintain.

While most OpenSharing data will end up on dedicated object storage because that is the only cloud storage type supported (I did not see NFS or SMB anywhere in OpenSharing specifications), not all will.

E-Series is still significantly cheaper and faster for archive data and with hardware redundancy and highly available S3 gateway services like Versity S3 Gateway running on Kubernetes, there's plenty of value in keeping active archives on E-Series.

Versity S3 Gateway gives this approach some extra features that you can't get with S3-only services, such as the ability to massage, slice and dice S3 data directly on filesystem. It's a stateless S3 gateway, after all!

## Appendix A: Demo 

This is a **looping** (i.e. best don't stay watching for minutes) 30 second demo that ends with a Parquet query shown in that CLI screenshot above.

It shows our workflow:
- Get your JWT where you get it. Refresh it in the same place and update your share profile if you need continued access. We could obtain and refresh our JWT on schedule, but this isn't directly related to OpenSharing
- The JWT token allows OpenSharing (and DeltaSharing) clients to access OpenSharing application configured for the user, and interact with what's shared
- Data access - used to create that report at the end - to S3, it is direct access based on pre-signed URLs created by OpenSharing application server

![OpenSharing with Versity S3 Gateway and E-Series ](/assets/images/opensharing-eseries-short-demo.gif)

The server runs OpenSharing API (basic server implementation created for this PoC) while the client is a DeltaSharing (existing DeltaSharing Python client implementation, compatible with OpenSharing Tables).
