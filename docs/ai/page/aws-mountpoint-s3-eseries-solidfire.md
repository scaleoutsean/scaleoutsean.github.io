# Use cases for AWS mountpoint-s3 with NetApp E-Series and SolidFire

Some use cases for AWS mountpoint-s3 with NetApp E-Series and SolidFire

- [AWS mountpoint-s3](#aws-mountpoint-s3)
- [Deploy](#deploy)
- [Use cases for E-Series and SolidFire](#use-cases-for-e-series-and-solidfire)
  - [S3 bucket as backup mountpoint](#s3-bucket-as-backup-mountpoint)
    - [Sub-bucket allocation](#sub-bucket-allocation)
    - [mountpoint-s3 vs application-native backup to S3](#mountpoint-s3-vs-application-native-backup-to-s3)
  - [E-Series as S3 storage](#e-series-as-s3-storage)
  - [Data sharing with single-host filesystem](#data-sharing-with-single-host-filesystem)
  - [Analytics](#analytics)
- [Conclusion](#conclusion)

## AWS mountpoint-s3

[AWS mountpoint-s3](https://github.com/awslabs/mountpoint-s3) lets us mount S3 bucket or its path to a Linux mount point, while supporting a subset of POSIX.

The idea (I guess) is to support sequential IO to eliminate the challenges, excessive chatter and small IO that occurs when a more complete POSIX support is possible and used with small files (or generic workloads).

Currently even plain writes aren't supported but they will be soon, so I write this post as if writes and reads were both supported.

## Deploy

Follow instructions from the README.md and deploy. 

Once mountpoint-s3 is up and running, client(s) running mounpoint-S3 can read S3 bucket data at high speed. Soon writes will be possible as well.

![AWS mountpoint-S3 on Rocky Linux 8](/assets/images/aws-mountpoint-s3-01-working.png)

What can we do with this?

## Use cases for E-Series and SolidFire

NetApp StorageGRID is NetApp's main S3 solution, but ONTAP supports it as well. These could be backing object stores for mountpoint-s3, but this post isn't about that - it's about use cases for mountpoint-s3 with E-Series and SolidFire.

Here are some use cases I have in mind for mountpoint-s3.

### S3 bucket as backup mountpoint

First, we'd create a bucket and apply desired ACLs. For example, we could only allow write and list operations to specific set of S3 keys, so that the user posting data cannot delete it. Restores would be done by a different account (or the same, but it'd require read permissions as well).

On SolidFire client we mount S3 just like in that screenshot above, and now we can dump backups to /mnt/backup. 

Because mountpoint-s3 is supposed to excel and such workloads (sequential writes), we should be able to backup much faster - possibly at several GB/s - than by using SolidFire's "Backup to S3" API.

If we assume that QoS on the SolidFire volume would be adjusted just in time before scheduled backup, and be left in place for its duration, we could read at 500 MB/s and it'd take less than 9 hours to backup a 16 TB database. Not too bad!

In fact we'd need that much time only the first time around, or maybe once a week, while the rest could be incremental, executed every 15 minutes (log archiving for PostgreSQL, for example).

Another, useful distinction compared to SolidFire's "Backup to S3" feature is that "Backup to S3" uses SolidFire's management network (as observed [here](/2021/05/19/solidfire-exporter-monitor-solidfire-network-interfaces-with-prometheus-and-grafana.html)), which can be a problem due to policies and/or network layout. Mountpoint-s3, on the other hand, connects to S3 bucket based on Linux client's routing table which is much more flexible.

We should also recall that SolidFire's "Backup to S3" backs up (and can restore) only an entire SolidFire volume, whereas application-based backup/restore works with application data.

#### Sub-bucket allocation

On S3, we can allocate one bucket per VM (or workload) or per user. But it can be more granular. 

If ACLs are set to protect paths to each workload, so that credentials1 can access only backup-bucket/vm1, it's not necessary to provision too many buckets.

```sh
backup-bucket/vm1
backup-bucket/vm2
```

But one has to watch out for typos and mistakes when creating ACLs.

#### mountpoint-s3 vs application-native backup to S3

If our application can backup to S3, we can eliminate the overhead of mountpoint-s3 and backup/restore directly to/from S3.

But not all applications can do that. It is also simpler to dump DB or tar a directory to /mnt/backup than install and update S3 CLI, especially since mountpoint-s3 can be managed by root, while backup/restore to a mountpoint-s3 path can be performed by a non-root user who doesn't need to have access to S3 credentials.

### E-Series as S3 storage

From [this simple test](/2022/10/21/minio-performance-netapp-e-series.html) I did with MinIO on E-Series EF570 I know a single VM instance of MinIO can write at multiple GB/s, so it's a very affordable way to create a backup repo using NL-SAS storage (using E2800, for example) and a VM.

### Data sharing with single-host filesystem 

This is a bit speculative (mountpoint-s3 is in alpha), but I expect it to work.

With several Linux VMs or containers connected to E-Series, as data is ingested to multiple Linux hosts with ext4 or XFS, it can be moved to mountpoint-s3 and become visible to external S3 clients.

Since no modifications to files are allowed via mountpoint-s3, users can analyze S3 data by reading data directly from S3 (without using mountpoint-s3).

Using the same approach, any S3 client can be configured to synchronize or replicate data from this bucket to other locations.

One example of such a use case is AI in hybrid cloud environments. We may create [checkpoints](/2024/01/10/ai-deep-learning-pytorch-checkpointing-eseries.html) on-premises and read them from any location from which we want to continue computation.

### Analytics

Mountpoint-s3 read performance can be over 5 GB/s.

Individual SolidFire volumes can provide read performance up to few hundred MB/s (which is why my earlier estimate for taking a backup of a 16 TB volume is (16000 GB / 0.5 GB) seconds). Short of applying tricks (such as using LVM), certain read analytics can be sped up by 10x by moving data to S3 mountpoint and analyzing it that way.

We could access S3 data at a local filesystem mountpoint, but if our application can work with S3, we could read it directly without mountpoint S3 (see [this](/2022/03/10/s3-select-vs-remote-csv-over-fuse.html) example). We could also read it from multiple hosts at once, scaling performance on the client side.

E-Series has a much faster single volume performance compared to SolidFire, so this approach would be less interesting, but there are still scenarios in which we'd use the same approach. Mostly it's related to the ability to access S3 bucket natively from multiple S3 clients at the same time, eliminating the need to configure other ways of multi-client data sharing such as NFS.

## Conclusion

AWS mountpoint-s3 makes it easier to make indirect use S3 for special sequential workloads.

Mounting S3 buckets as local devices isn't new, but mountpoint-s3 is focused on specific workloads (sequential write-once, read-many) and should be less buggy and perform better than general approaches.

Application-integrated backup utilities and log archiving, as well as various analytics tools look like interesting use cases for mountpoint-s3.
