# iRODS or Robinhood HSM with BeeGFS

External solution to move files between BeeGFS filesystem and external locations such as other BeeGFS FS, NFS shares, or S3 buckets

BeeGFS can work with different storage targets, so just like with Spectrum Scale it is possible to create a filesystem that spans across different disk media and protection schemes.

But sometimes you need to move data to another location, for which different filesystems have different approaches. For example:

- Tier cold *blocks* to a lower cost tier and fetch them on-demand, or
- Move specific files to a lower cost tier (e.g. from /mnt/beegfs to Glacier)

This functionality can be built into storage system or employed externally.

NetApp WAFL (the filesystem of NetApp ONTAP), for example, has this functionality available in its system and can tier to S3-compatible buckets.

BeeGFS and many other filesystems rely on external software, often called HSM (Hierarchical Storage Management) rather than tiering (at least I prefer to use these names, to avoid confusion with block-tiering features present in many enterprise storage systems).

That software usually moves entire files and leaves a filesystem stub, or creates a shortcut, or maybe doesn't (in the case the user is supposed to find the file by querying a database rather than looking the filesystem).

In HPC there are two popular open-source solutions for HSM (and more): iRODS and Robinhood Policy Engine. In general terms filesystem is scanned for matching files which are then copied to the right place and the original is then deleted leaving a replica or replicas as the new original.

Based on a quick read of the documentation, below are my impressions.

## iRODS

- Seems more comprehensive and powerful, but also more complex
- Seems to have more developer resources
- Works with POSIX-y filesystems including BeeGFS and NFS
- S3 plugin
- Docs for current version 4.3.0 can be found [here](https://docs.irods.org/4.3.0/)

I used iRODS briefly because it has an S3 resource plugin. I submitted a pull request with added S3 service included in iRODS demo "stack", so that it's easier for folks new to iRODS to get started without wasting too much time (it wasn't fun!).

Once it's up and running, there's a nice Web UI called ZMT:

![iRODS ZMT](/assets/images/irods-zmt-01.png)

After this pull request, S3 plugin is included, and there's a MinIO container running as well. 

All you need to do is:

- Create a bucket and MinIO user for iRODS provider
- Configure S3 plugin on iRODS

That gives us an S3 resource to work with (here, in cacheless mode):

![S3 resource](/assets/images/irods-s3-resource-02.png)

In this mode you can use an iRODS client to put and get stuff to S3.

![iRODS with S3](/assets/images/irods-s3-bucket-04.png)

Check the bucket:

![S3 bucket contents](/assets/images/irods-s3-03.png)

I haven't had time to try a more meaningful (NFS <=> S3) demo yet.

## Robinhood

- Less complex, and easier to get started
- Seems to have less developer resources
- Works with POSIX-y filesystems including BeeGFS and NFS, but I couldn't find anything on S3
- Docs for v3 can be found [here](https://github.com/cea-hpc/robinhood/wiki/robinhood_v3_admin_doc)

## iRODS and Robinhood Policy Engine with BeeGFS

Please don't take "project has less resources" to mean "stay away from it" - as I said Robinhood seems easier to use and is very popular (e.g. among Lustre users), so I do not think it's risky to adopt it.

A better way to interpret that statement is "if you don't have a full time guru who can become an expert in this stuff, check out Robinhood first". I would also verify whether the plugin (such as S3 or perhaps LTFS) is available for the solution you want to use.

I haven't seen anything that indicates that BeeGFS would have any problem working with either Robinhood or iRODS. Some examples:

- Tier0 on RAM-based BeeGFS filesystem
- Tier1 on NVMe-based BeeGFS backed by NetApp E-Series 
- Tier2 on NL-SAS-based BeeGFS or XFS backed by NetApp E-Series 
- Tier3 on NetApp StorageGRID appliances, ONTAP S3, ONTAP NFS, AWS S3, or MinIO backed by E-Series

To tier from and to BeeGFS, iRODS and Robinhood would have to run on BeeGFS. Or we can export BeeGFS via NFSv4 and mount NFS from iRODS "client".

Depending on which you choose and the size of your environment, you may also need additional VMs or physical servers to run a dedicated database and other services.

In terms of S3 targets, standard targets should work:

- NetApp StorageGRID (disk-based, with optional tiering to lower-cost external S3 storage including Glacier)
- MinIO (disk-based)
- FUJIFILM Object Archive (S3 gateway for tape media that officially supports iRODS)
