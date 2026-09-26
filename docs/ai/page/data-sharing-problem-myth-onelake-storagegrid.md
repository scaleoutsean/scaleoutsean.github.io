# Object stores solved problems with data sharing in hybrid cloud years ago

## Introduction 

For over a decade now, I've been hearing about "challenges" of data sharing in hybrid cloud environments. Yes, it used to be difficult ten years ago, but that's no longer the case. Why are we still hearing about that? That problem has been solved for the most part.

In the 2010s, file sharing across locations was a problem that needed solving. Usually there would be human users working on SMB or NFS shares. Vendors were inventing ways to replace chatty SMB protocol over WANs (often with WAN accelerators), implementing global caching and locking, and making other improvements interactive users required.

Today, we have data sharing in global workflows. Usually, unstructured and semi-structured data is stored in object stores and databases we query to find metadata about this data are backed by object storage, too.

Today, most users are machines (agents, automated workflows) and they use S3 over HTTPS (sometimes HTTP or RDMA) to accomplish that. Sharing usually happens over HTTPS (with post-quantum encryption already in place), real-time event notifications, auditing, read caching, and data generated in the process of sharing data is integrated in data lakehouse workflows to improve them with knowledge graphs, intelligent caching and other features traditional file sharing can't even dream of. It happens at large scale in near real-time and generally works very well.

Even for "traditional" (POSIX-only) clients, S3 access works fine. There's AWS Mountpoint S3, there's [ObjectiveFS](/2026/07/08/objectivefs-storagegrid-eseries.html) and other ways that enable data sharing in for POSIX clients in hybrid cloud environments backed by S3.

"Re-platforming" was a big issue with a variety of file serving implementations and anyone who dealt with WAN accelerators or other useful extras knows those sometimes interfered and introduced own incompatibilities.
- Compared to NFS and SMB, S3 is a much simpler protocol that's easy to test.
- HTTP caching and proxying is very well understood
- If you have Object Storage XYZ on premises and access it from public cloud, it's the same XYZ object storage you use on-premises. You're not using another S3 implementation
- Growing number of modern applications default to S3 as the preferred and sometimes the only supported protocol. Consistent file sharing service may help you avoid re-platforming, but you'll have issues onboarding and supporting new applications. I [blogged about this - related to data protection - days ago](https://scaleoutsean.github.io/2026/07/30/backup-restore-modern-k8s-apps-without-csi-snapshots.html)

For databases, S3 has been an even better enabler than for unstructured data. For over half a decade now, databases have been using external tables located on S3. I blogged about [SQL Server PolyBase](/2023/08/28/sql-server-polybase-s3.html) years ago. On the front-end, it's SQL Server, on the back end, it's Parquet. We can run SQL Server anywhere and still get to our data, as long as SQL Server can reach S3.

In 2022, I blogged about [PostgREST](https://docs.postgrest.org/en/v14/) which allows RESTful access to on-premises databases using HTTPS, freeing us from the need to use VPNs with ODBC drivers, or replicate data for Tier 3 and Tier 2 applications in the cloud. I ran my front-end application in CloudFlare and my back-end was PostgreSQL located on-premises, attached to SolidFire.

![PostgreSQL on premises from CF](/assets/images/cloudflare-restful-database.png)

Iceberg and Delta tables on S3 are accessed the same way. Or one can query "raw" Parquet files (recent example [here](/2026/07/05/eke-smarter-workflows-for-beegfs-netapp-eseries.html)) over WAN. It's not a science project or niche use case - it's how [large-scale S3-backed OLTP database services work today](https://docs.databricks.com/aws/en/oltp/projects/).

There are many ways to do this more reliably for use cases that need that, by caching a replicated subset, directing writes to on-premises, and more. These are all solved problems. 

These days, we have datalakes in which databases fully live in object stores. Both databases and file/object content is in the same place. It works from anywhere and it's even better than with file sharing because we need just one storage protocol to cover structured, semi-structured and unstructured and access that from anywhere. Caching can be done on massive scale from various query engines (Trino or Presto with [Alluxio](/2021/11/12/alluxio-storagegrid-s3.html) cache), reverse caching proxies and more. 

Snowflake external tables that make it easy to use StorageGRID data have been available since 2022.

![Snowflake external tables with StorageGRID S3](/assets/images/hybrid-cloud-sharing-00-snowflake-external-tables-storagegrid.png)

> This screenshot is from a [Snowflake-StorageGRID solution brief](https://www.netapp.com/pdf.html?item=/media/78098-SB-4218_StorageGRID-Snowflake_solution-brief.pdf). I like that misspelling!

DeltaSharing made data sharing *on your own terms* very easy, because entire open source-based stacks could be built for shared access to object stores without even having to manage S3 credentials to every user. Now we have [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) and there are free reference servers anyone can use. There's no need for S3 credentials for every user or application that needs access to object store, no need to reinvent the wheel for any of the S3-related features I mentioned above (event notifications, audit logs, encryption, read caching...). 

Aside from the obvious (what's been possible in Snowflake and SQL Server), you can, for example, run OpenSharing and Versity S3 Gateway **on Windows**, sharing tables and files to your cloud-based applications running anywhere. You don't even need to use Linux servers. It has become almost trivial - place your data to Windows server with OpenSharing, and it becomes available to OAuth-authorized users in public cloud.

![OpenSharing on Windows](/assets/images/hybrid-cloud-sharing-04-opensharing-versity-widows-eseries.png)

> I'm not encouraging anyone to use my implementation or even use OneLake shortcuts or OpenSharing. I'm just showing that these things work today, even in various freeware and open-source implementations.

Malware (S3 ObjectLock, versioning) is a solved problem, lineage is too (S3 checksums are stored with objects and we have versioning, object tags, and workflow logs and access history all stored in immutable datalake tables), and so is tiering (ILM), and pretty much anything else one can think of when it comes to data sharing.

So what exactly is the problem? What kind of sharing in hybrid cloud is hard?

I don't get it. I haven't seen a problem in this entire decade.

I only see improved S3-based solutions appear every month, making existing S3-based solutions better for a vertical or use case.

Some new (in preview) and upcoming (roadmap items) features in Azure OneLake are good examples of that.

## Azure OneLake with NetApp StorageGRID 

Azure OneLake has what appears like DeltaSharing that's in the process of implementing OpenSharing to expand its reach to other clouds and on-premises.

First, you need something called ODG (On-premises Data Gateway).

![Connect to On-premises Data Gateway](/assets/images/hybrid-cloud-sharing-05-on-premises-data-gateway.png)

> Credit (images): [Microsoft](https://learn.microsoft.com/en-us/fabric/onelake/create-s3-compatible-shortcut)

In OneLake, create a shortcut. 

![Create OneLake shortcut](/assets/images/hybrid-cloud-sharing-01-onelake-create-shortcut.png)

Pick AWS S3-compatible storage.

![Pick AWS S3-compatible storage](/assets/images/hybrid-cloud-sharing-02-onelake-pick-aws-s3-compatible.png)

Enter shortcut properties, including endpoint of reverse proxy or StorageGRID load balancer.

![Enter StorageGRID properties and reverse proxy endpoint](/assets/images/hybrid-cloud-sharing-03-onelake-enter-sg-s3-props.png)

We have to use S3 keys because of this limitation, which will likely go away in a quarter or two.

> Currently only key or secret authentication is supported for S3-compatible sources. Microsoft Entra-based OAuth, Service Principal, and RoleArn are not supported.

This is the same "limitation" my OpenSharing Server for StorageGRID and Versity S3 with E-Series has. There are many moving parts that aren't easy to deal with even in this case where OneLake plans to support only Entra-based OAuth (at least initially), let alone implementing a bunch of supported OAuth services (for Entra and other [OAuth that StorageGRID 12.1 supports](/2026/07/25/storagegrid-12_1-sg-cosi-0_5_4.html#storagegrid-121)).

But, in Azure, almost everyone uses Entra and StorageGRID supports it as well. *If* you connect to OneLake with OAuth *and* OneLake authenticates with StorageGRID using Entra, you have end-to-end authentication and authorization.

OneLake shortcuts [support even Iceberg tables](https://learn.microsoft.com/en-us/fabric/onelake/onelake-iceberg-tables). I blogged about Iceberg table support in the OpenSharing Server post [here](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html#notes).

For small (edge) sites, current approach (no Entra and Assume Role) works today even on Windows. Example: [OpenSharing for Windows](https://github.com/scaleoutsean/opensharing-server/releases/tag/v0.1.0) and [Versity S3 Gateway for Windows](https://github.com/versity/versitygw/releases/tag/v1.7.0).

## Conclusion

OneLake shortcuts for on-premises S3 are in preview, but it's only matter of months before it graduates to GA.

Since OpenSharing was announced, I knew its implementations would take data sharing in hybrid cloud environments to the next level, which is why I've spent time on it myself. It's an evolutionary change that builds upon S3. 

A solution for an already solved problem becomes even better:
- Structured way to share different content types, from tables to regular files and AI models
- OAuth avoids micromanagement of S3 credentials, centralizes access, security, auditing and more

Just file-to-table is going to be huge, but there's a lot more coming and I think it will work with shortcut objects as well. Near-term OneLake roadmap:

![OneLake roadmap](/assets/images/hybrid-cloud-sharing-06-onelake-roadmap.png)

There's no hybrid cloud data sharing problem that any other approach solves better than S3. There's nothing that comes even close in hybrid cloud. No one bothers with Azure's and GCP's object APIs. Swift has been deprecated in StorageGRID because there was barely anyone who was using it.

What we need for data sharing in hybrid cloud is the same thing we needed in 2020: an on-premises S3-compatible object store.

Certain problems can still be solved better with various file serving solutions, "global" and other, but I'd suggest to not *expand* legacy platforms and increase technical debt.
