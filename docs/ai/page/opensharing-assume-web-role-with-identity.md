# OpenSharing E-Series data using Assume Role With WebIdentity

Let's assume a Web Role with Identity and see what happens

## Introduction

Databricks saw it first, of course, that's why they came up with it - but, compared to some "storage experts", I think I've done rather well and realized the potential [the day I first learned about OpenSharing](/2026/06/14/netapp-eseries-opensharing-deltasharing.html). 

Thanks to OpenSharing, if you know what you're doing, you can park and securely share PBs of data for AI and analytics for literally free and without most of the hassle related to S3 access management.

![OpenSharing for E-Series](/assets/images/opensharing-eseries-08-opensharing.png)

Since that first blog post, I've created about 10 posts and demos on OpenSharing and my implementation works with not only Versity S3 Gateway (what I recommend for use with E-Series), but also with NetApp StorageGRID.

Folks who use my OpenSharing server - or who who've developed their own inspired by it - are no doubt happy. 

We can do cool things like this - this illustration is based on a real-life requirement to replace old school S3 "uploads" and save tons of money related to S3 infrastructure cost:

![OpenSharing for IoT with VGW E-Series](/assets/images/opensharing-iot-kafka-vgw-parquet.png)

In previous release of my OpenSharing server implementation, I added AssumeRole support for StorageGRID.

Now we can also use AssumeRoleWithWebIdentity with Versity S3 Gateway.

## Assume Role With Web Identity

As the name implies, I need a token that confirms my Web identity.

If OpenSharing server lets something@gmail.com access some table, I need to authenticate as that user with Google and get a token that proves that. 

Then I use that token with OpenSharing.

```sh
$ export JWT="my-token"

$ curl -s -H "Authorization: Bearer ${JWT}" http://127.0.0.1:8000/shares/analytics-share/schemas/analytics-schema/tables | jq
{
  "items": [
    {
      "name": "iot_silver_table",
      "schema": "analytics-schema",
      "share": "analytics-share",
      "shareId": "share:default:analytics-share",
      "location": "s3://default-bucket/tables/iot_silver_table/",
      "accessModes": [
        "url"
      ],
      "id": "table:default:analytics-share:analytics-schema:iot_silver_table"
    }
...
```    

That is all. The "usage" difference is here I include JWT in request header.

Why, because the S3 server doesn't check my S3 keys. I have no S3 keys.

I can deploy OpenSharing server and Versity S3 Gateway 1.8.0 on a cluster of Raspberry Pi servers (with iSCSI to E-Series) and practically eliminate S3 user management on Edge.

Or I can let users use S3 without managing every site. I still need to add the user's email to OpenSharing server configuration for shares, but not much more than that and share configuration is hot-reloaded.

Another example: let's say I keep terabytes of [S3 audit logs](/2026/09/20/sgac-storagegrid-audit-v030.html) for external users registered by their email address and I want to provide a way for each to download their logs. We won't save these to our own SIEM, and we aren't going to read them either. We need to keep them for some time for end users to download if they wish. There aren't many ways to do that as reliably and economically than we can with OpenSharing, AssumeRoleWithWebIdentity (VGW) with E-Series. 

No JWT token, no access:

![AssumeRoleWithWebIdentity with VGW](/assets/images/opensharing-sts-assumerole-with-web-identity.png)

You can view my demos of OpenSharing in various posts, including the first post on OpenSharing (linked at the top) when I used a Python prototype. Today, we can even [share Iceberg tables](/2026/09/07/opensharing-iceberg-netapp-eseries-storagegrid.html) and use S3/RDMA (VGW-only). 

## What's next

One thing that I've mentioned in one of the early posts on OpenSharing was that I believed there will be OpenSharing server implementations that will work with a bunch of different object stores.

You can see Pure Storage and WEKA already have their own that seem built-in and that's fine. While that looks like "table-stakes" (which is also why I've created my own), what I'd like to see as a user is ISVs (Databricks, Snowflake, Komprise, etc.) do that from their Web UI.

Having to access an Object Store's (*proprietary*) management API to share data via *Open*Sharing isn't the best way.

My OpenSharing server already demonstrates:
- Stand-alone server with multi-vendor support (the way it's supposed to be done) 
- Open, vendor-neutral management API for shares (currently works for pre-signed URLs and STS with Web Identity feature explained in this post)

This second item isn't in the published code (v0.4.1) yet, but I use `POST /shares` to create shares via the API. `DELETE /shares/...` could be done the same way. I also have a static page where JWT-authorized users can download their `profile.share` without ever touching object store's management API.

Maybe I will release an updated version with these included, but I think my OpenSharing server already demonstrated this is a workable, secure and better superior approach compared to implementations in vendor's management UI or API.

One may need to access an object store's management API to do *other* things (e.g. create a [bucket snapshot](/2026/09/18/storagegrid-s3-cosi-snapshot-leases.html) before creating OpenSharing shares for it), but those are separate tasks that can be driven through vendor-specific automation and *independently of* OpenSharing. 

If I have OpenSharing shares, I'll have them in at least 2 (cloud, on-premises) places, possibly 3 or more (two clouds and one StorageGRID, or two clouds and two StorageGRID clusters). I want to see them in where I manage my datalake or OpenSharing shares and *not* behind all these different management UIs.

## Conclusion

Assume Role works with OpenSharing and StorageGRID. But that "role" is a StorageGRID role. It has to be managed, and it's not trivial. And sometimes you want to gate access to S3 buckets that way.

If you're on edge - public infrastructure, simple S3 file or data sharing and similar - maybe you can't afford or have no need, to micro-manage read-only access to files. Imagine serving S3 downloads where you need to authenticate based on proven bearer token. Micro-management is neither required nor desirable!

Assume Role With Web Identity works with Versity S3 Gateway (VGW). If VGW data is on E-Series I can eliminate the hassle of managing block storage, EC/RF, storage servers and more.

VGW and my OpenSharing server can run on modest Docker or Kubernetes containers (x64 or ARM) and reliably serve PBs of capacity at a very competitive cost.

And you can get to this data from any hyper-scaler, too, for a "zero copy, zero learning curve, zero added cost" hybrid cloud data sharing. 

![OpenSharing in Hybrid Cloud)](/assets/images/medallion-architecture-dont-manage-storage.png)
