# NetApp SolidFire backup to S3 and MinIO compression savings

Can MinIO compression save space more than native SolidFire compression in backup to S3

- [Introduction](#introduction)
- [SolidFire backup to S3](#solidfire-backup-to-s3)
- [MinIO compression](#minio-compression)
- [Results](#results)
- [Conclusions](#conclusions)

## Introduction

I'm not sure if I used these volumes in [this post](/2023/09/02/solidfire-test-volumes.html) (also related to SolidFire backup/restore to/from S3) or in the [Kopia post](/2023/09/03/solidbackup-with-kopia.html). Probably the latter, as the sizes match.

Anyway, I got 'em, there's 10 of 'em, each 66.67% full and 1GiB in size. So I just used these.

![](/assets/images/solidfire-backup-to-minio-compression-00-volumes.png)

This storage account has no other volumes, and its efficiency can be seen here. We're going to benefit from compression at the source *or* destination, but S3 bucket will not benefit from deduplication at destination. 

![](/assets/images/solidfire-backup-to-minio-compression-01-data-efficiency.png)

We don't know how much of this deduplication reported by SolidFire is "within" each volume, and how much among them, but savings "within" a volume may result in a smaller size after compression vs. just compression. Theoretically, there could be 100 MiB of duplicate data within 667 MiB of data in the volume for an example. But we don't know and can't tell.

In any case, 1.38x on 667 MiB means 483.33 MiB per volume (on average) and minus possibly another 40 MiB or so (1.11x) from deduplication ("on average").

## SolidFire backup to S3

As explained in the many posts related to SolidFire's "backup to S3" feature, SolidFire can use the native and uncompressed format.

- Uncompressed - as-is, basically this just pipes 4MiB chunks in ~2MiB requests (dd if=/dev/disk of=/bucket/segment bs=2m count2) of the volume to S3.
- Native - this includes SolidFire efficiency. I'm not sure if it includes both compression and dedupe *within* the volume, or just compression

This is how these backups look like ("uncompressed" example).

![](/assets/images/solidfire-backup-to-minio-compression-03-uncompressed-backup.png)

## MinIO compression

MinIO's compression is Snappy aka S2. By default it's off. If enabled, it compresses known non-compressed formats like text or JSON.

The problems (for SolidFire backup to S3) with this are:

- SolidFire uncompressed backup format use a weird numeric extension, and
- Both compressed and native use the same numeric extension

![](/assets/images/solidfire-backup-to-minio-compression-02-document-extension.png)

So you can't even whitelist uncompressed chunks - you have to whitelist all such extensions, and then MinIO compresses all matching objects (including both native-compressed and uncompressed chunks). That's bad because you have to either pick one of these (native or uncompressed) for all backups, or waste CPU compressing some native backups (which were already compressed at source) as well as uncompressed. 

But if you add extensions such as ".1024" to the whitelist of what to compress and use "uncompressed" in SolidFire, maybe that's all you need.

The other bad thing is I had issues with SolidFire backup to MinIO not working properly even with SolidFire 12.5 and latest MinIO. I had thought SolidFire 12.5 had a patch that works around non-S3 standard MinIO behavior included, but maybe I misremember. In any case, this ought to work with SolidFire 12.7, so let's assume there's no problem.

As I still wanted to compare MinIO's compression with SolidFire's "native" but couldn't backup to MinIO, I instead backed up SolidFire (uncompressed) to another S3 destination, and from there I copied backup data to a MinIO bucket with compression enabled.

## Results

- Source: Ten 66.67%-full 1GiB volumes (6.67 GiB)
- Uncompressed SolidFire backup to generic S3 (no compression on target) - 10 GiB (even 3.33 GiB of Thin Provisioned 0's were backed up!!!)
- Uncompressed SolidFire backup to MinIO with compression - 5.1 GB (`df /mnt/data` of MinIO disk)
- Native SolidFire backup to MinIO without compression - 4.9 GiB (`df /mnt/data` of MinIO disk)

## Conclusions

Uncompressed SolidFire backups waste even its Thin Provisioning savings as gigabytes of 0s from SolidFire volumes are dumped to S3. It is very important to use discard or fstrim the SolidFire volumes (on the iSCSI clients) before backup to S3 - *especially* so if you use uncompressed backup (when we want MinIO to compress this unallocated capacity to 0).

Uncompressed SolidFire backups to MinIO with compression enabled save 49% of S3 capacity (vs. 33% on of "live" SolidFire volumes, which presumably use light compression to provide low I/O latency).

Native SolidFire backups to MinIO without compression enabled saved 51% (for this particular data type).

I didn't expect that a native SolidFire backup can save that much. I did this on Demo VM and I hope there's no difference vs. appliances or SolidFire SDS.

Using uncompressed SolidFire backups with MinIO compression is a good idea when:

- You want backups that can be restored to any volumes disks. You could read all the 4MiB chunks and use `dd` to restore them to a generic disk device
- You backup often and want to save SolidFire CPU. MinIO's S2 can compress at 1 GB/s, so MinIO compression is very inexpensive to enable for SolidFire backups

You have to be careful with those object extensions, because enabling MinIO compression for virtually all objects would increase CPU consumption on MinIO cluster. Perhaps it's a good approach to backup several volumes and see if extensions are always the same, and if so whitelist only those for MinIO compression.

As that file extension may very well be the same for native and uncompressed SolidFire objects, I'd stick with one approach for all volumes backed up to MinIO.

If you use a "wildcard approach" (add a bunch of extensions to MinIO's "compress these" list), then MinIO will compress everything whch may or may not be what you want. 

- If the MinIO cluster is used for slow workloads, it would waste CPU on compressing compressed data, but this may not matter to you
- You could set up a dedicated MinIO cluster just for SolidFire backup (e.g. a MinIO VM attached to E-Series), which would eliminate those concerns. One such MinIO VM can deliver 1GB/s ([and 4 can deliver 5 GB/s](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html#minio-without-ec)) which is enough even for large SolidFire clusters

I have not measured "ingress" bandwidth taken by uncompressed SolidFire backups on MinIO system but I assume wire traffic is the same as "native" backup and MinIO's disk IO (with compression enabled) is the same as well, because empty blocks sent by SolidFire get compressed to almost nothing. So, the cost of not compressing backups on SolidFire and compressing them on MinIO should be very low and affordable.

Said differently, I would assume that in most cases a 1TB volume that's 60% full and can be compressed down to 500 GB before being shipped to S3 would take around 550 GB to transfer uncompressed. You could test this in your environment, but to me spending an extra 10% in in backup bandwidth on LAN is a good tradeoff for offloading all that CPU utilization from SolidFire.

Native SolidFire compression saves more than MinIO compression, presumably because SolidFire saves something on deduplication within volumes, but MinIO compresses and has no deduplication so anything outside the compression "window" used by S3 does not result in savings.

Another idea that could be considered is MinIO on a filesystem with deduplication enabled, but for that we usually need all flash storage. It's still cheaper and good enough to use NL-SAS on something like E-Series with NL-SAS and DDP for that. I've written several posts on MinIO on E-Series, but [this one](/2022/04/03/restic-server-netapp-eseries.html) talks a bit about dealing with ransomware risks on E-Series as backup storage.
