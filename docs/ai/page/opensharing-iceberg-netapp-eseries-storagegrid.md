# OpenSharing Iceberg tables on NetApp StorageGRID and E-Series

Use OpenSharing for read-only access to Iceberg tables

## Introduction

I've blogged about [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) a bunch of times.

It is most exciting because it turns E-Series into a cost-effective data lakehouse store for exactly $0 and also provides sharing features for StorageGRID (including `Volumes`, i.e. file tables) useful in various [hybrid cloud](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html#conclusion) use cases.

Some interesting possibilities that have been on my mind:

- STS AssumeRole, because that can give clients a mind of their own (they don't have to rely on individual presigned URLs, which is what I do now, and why it can't work dynamically)
- Iceberg tables, because OpenSharing has been dismissed because "not invented here" and - "as we all know" - "it's for Delta tables only" (except it's not)

Let's see about that.

## OpenSharing for read-only access to Iceberg tables

I now run OpenSharing server using the S3 keys that still work the same way - OpenSharing uses the key to generate static presigned URLs for Delta tables and volumes. That's the `SUSR` dude.

```sh
2026-09-07T11:00:54+08:00 sg-storage-02 Audit: 2026-09-07T11:00:54.880396 [AUDT:
[RSLT(FC32):SUCS]
[CNID(UI64):1788778854212427]
[TIME(UI64):8339]
[SAIP(IPAD):"192.168.1.19"]
[TLIP(IPAD):"192.168.1.211"]
[S3AI(CSTR):"55295525968323305569"]
[SACC(CSTR):"pepsi"]
[S3AK(CSTR):"NM1IM6O2PR89WXXRUDIF"]
[SUSR(CSTR):"urn:sgws:identity::55295525968323305569:user/lakehouse"]
[SBAI(CSTR):"55295525968323305569"]
[SBAC(CSTR):"pepsi"]
[S3BK(CSTR):"example"]
[S3KY(CSTR):"warehouse/01a065f4-62da-7dc2-8b59-0f770e1cda4f/metadata/00001-01a065f4-6a9b-7a80-9b8f-f2d2df25d4a0.gz.metadata.json"]
[VSID(CSTR):"QUYwNzIyMkMtQTc2MC0xMUYxLThDNzctRjgzQTAwQzRGOUFB"]
[CBID(UI64):0x0000000000000000]
[UUID(CSTR):"AF0729FF-A760-11F1-A407-7509C034F9AA"]
[CSIZ(UI64):690]
[MTME(UI64):1788416912037534]
[AVER(UI32):10]
[ATIM(UI64):1788778854880396]
[ATYP(FC32):SGET]
[ANID(UI32):12257404]
[AMID(FC32):S3RQ]
[ATID(UI64):2904979783460582779]]
```

But now I also use that user to dish out STS AssumeRole credentials for another group from StorageGRID.

I blogged about them STS AssumeRole credentials just days ago in [Lakekeeper with NetApp StorageGRID](/2026/09/03/lakekeeper-iceberg-compression-snapshots.html).

The identity that gets these temporary credentials is under `STRO`.

```sh
2026-09-07T11:00:54+08:00 sg-storage-03 Audit: 2026-09-07T11:00:54.949369 [AUDT:
[RSLT(FC32):SUCS]
[CNID(UI64):1788778854157515]
[TIME(UI64):65633]
[SAIP(IPAD):"192.168.1.19"]
[TLIP(IPAD):"192.168.1.211"]
[STSU(CSTR):"urn:sgws:identity::55295525968323305569:user/lakehouse"]
[STRO(CSTR):"urn:sgws:identity::55295525968323305569:group/AssumedRole"]
[STSN(CSTR):"analytics-share-analytics-schema-iceberg_demo_table"]
[STDU(UI64):3600]
[AVER(UI32):10]
[ATIM(UI64):1788778854949369]
[ATYP(FC32):ASRO]
[ANID(UI32):12996059]
[AMID(FC32):STSR]
[ATID(UI64):2323724246960406894]]
```

Annnd, because the OpenSharing specification supports Iceberg tables, that's been implemented and the client can now put that assumed identity from `STSN` above to productive use.

The S3 clients first use JWT auth to access OpenSharing API (not shown here) and the OpenSharing server can use a separate tenant (their S3 keys) to give the clients short-lived credentials which let them get read access to Iceberg tables such as `analytics-share-analytics-schema-iceberg_demo_table`.

In fact, the clients could get write access or a mix depending on OAuth2 identity and/or per-share configuration, but I just assume one client and universal read-only access to OpenSharing resources, which is sufficient for evaluation and testing.

And just like that, I can view OpenSharing shares with Iceberg tables.

![OpenSharing with Iceberg](/assets/images/opensharing-sts-assumerole-00-table.png)

The clients are using STS AssumeRole to dynamically access this sucker...

![OpenSharing access with STS AssumeRole](/assets/images/opensharing-sts-assumerole-01-sts-assumerole.png)

... and Trino, demonstrated with the same table in the previous, [Iceberg catalog post](/2026/09/03/lakekeeper-iceberg-compression-snapshots.html#trino-with-lakekeeper-and-storagegrid), here works with table details from OpenSharing rather than Lakekeeper's Iceberg REST, using the same table that's still in the same bucket. 

This OpenSharing server does not query an Iceberg REST or other Iceberg-capable catalog service. It tries to discover Iceberg tables at the specified share path. This isn't "real" Iceberg REST, but it also doesn't require you to have one - if you had it, you would simply access Iceberg catalog server and would not need OpenSharing.

![Trino with OpenSharing](/assets/images/opensharing-sts-assumerole-02-trino-opensharing-sts-assumerole.png)

The referenced OpenSharing table is *named* differently to the one from the previous Iceberg post, because we're getting table information from OpenSharing now (although the table data is actually identical).

![Trino with OpenSharing access details](/assets/images/opensharing-sts-assumerole-03-trino-opensharing-sts-assumerole-job.png)

It seems to work. As in the recent Iceberg demo, Trino registers internal catalog (this time a simple one from OpenSharing server) or skips it if it's already registered and then queries that OpenSharing table. We get the same output.

![Trino with OpenSharing Iceberg](/assets/images/opensharing-sts-assumerole-05-opensharing-iceberg-trino-log.png)

StorageGRID 12.1 audit log seems to indicate STS is used correctly. 

![StorageGRID audit log for Trino with OpenSharing Iceberg STS Assume Role Log](/assets/images/opensharing-sts-assumerole-04-opensharing-iceberg-sts-assumerole-log.png)

STS AssumeRole - and therefore Iceberg sharing - currently works only with StorageGRID and not yet with Versity (and E-Series) because Versity S3 Gateway (now v1.8.0) doesn't support AssumeRole.

But it won't be long before it can, and we'll be able to read Iceberg tables from VGW and use Lakekeeper to upload them to a datalake on StorageGRID. Or use OpenSharing (or Lakekeeper) to read tables from StorageGRID, and copy them to E-Series on edge for local read-only access by analytics, AI or other clients. 

Don't forget that OpenSharing can also share Volumes (for unstructured data, i.e. individual files, which is implemented and doesn't need this update) and AI models (not yet implemented), which should be interesting to the thinking person because we know VGW on E-Series can let us load models from E-Series over S3 [at multiple GB/s per file](/2026/08/17/versity-sequential-s3-put-test.html). Another good use case is read-only OpenSharing Volumes that let you load checkpoint files.

It's not just some contrived scenarios, unless you're determined to work slowly and spend more.

## Conclusion

That's it - zero-copy, zero-replica sharing for analytics in the hybrid cloud.

![OpenSharing in Hybrid Cloud](/assets/images/medallion-architecture-dont-manage-storage.png)

We can access Iceberg and Delta lakehouses on StorageGRID and provide read-only access to any application without unnecessary copying or "replication". If the data is structured, we'll probably use OpenSharing or similar, and if it's unstructured, we can also use plain old read or read-write cache (S3 reverse proxy or a caching engine such as Varnish AI shown in the diagram).

It's secure, fully audited, with tight/granular permissions and it costs next to nothing (including storage management, since there's no cloud storage to manage).

I still need to update the docs. It will take me a few days to update the README and post the new binaries on Github.
