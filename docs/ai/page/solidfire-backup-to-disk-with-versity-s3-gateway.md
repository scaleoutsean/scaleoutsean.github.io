# SolidFire backup to disk with Versity S3 Gateway

It's storage and it ought to work

This is more appropriate for a tweet, but anyway... 

I've blogged about SolidFire's rather basic "backup to S3" feature many times. 

As far as S3 targets are concerned, I've tried a bunch, including experiments with S3 storage appliance compression vs. source-side (that is, SolidFire) compression (I quite liked that thought, to sacrifice "efficiency at source" for greater storage cost savings down the road, although there were downsides, too.)

But it has somehow escaped me that Versity S3 Gateway would be an interesting endpoint to backup to.

The interesting part is it's a gateway. That means whatever you PUT, you can `ls` and `cat` as you see it... 

![SolidFire Backup to S3 is backup to disk with Versity S3 Gateway](/assets/images/solidfire-backup-to-disk-with-vgw.png)

It's not that anyone is asking, but with a simple Versity S3 Gateway container or VM (we could create any number of them, e.g. one per SolidFire volume) we can create a sufficiently fast S3 target for SolidFire's "backup to S3" feature. 

What does "sufficiently fast" mean? It means that an entry level E-Series array (E4000) should be be faster than SolidFire's backup-to-S3 write requirements. 

Then, after you've backed up volume 37 to https://s3.company.com/vol37 (which may be the directory `/data/vol37` if your VGW runs out of `/data/`), you could see those files on the Linux host. Those "files" would be either garbled, post-efficient blobs, or "raw" (if you chose to not use any source-side efficiencies) 4MiB blobs identical to what you'd get with this:

```sh
dd bytes=1M if=/dev/sdb of=/data/vol37.bin
cat vol37.bin | split --bytes=4MiB --numeric-suffixes=0 --suffix-length=3 - vol37.bin.part-
# VGW's data could thus be recovered by dd-ing to a any block device of the same size
```

In the latter case, such backups would be wasteful in terms of backup time as even zeros from empty space would be sent and stored as backup objects, so you'd need to have compression in S3 or underlying storage. Previously I tested this with MinIO, but with Versity S3 Gateway we'd need to use some storage with compression, such as ZFS. 

As number (2) points out, such inefficient backups could be recovered to same-sized volumes anywhere by simply `cat`-ing them to raw disks of the same size. 

We could also copy these buckets - when they're not changing, or otherwise on storage level - to another location for DR or BC purposes. 

## Why nobody uses this

Few people use SolidFire's backup to S3 because restores are "all or nothing" and while one can create a new "temporary" file-system for restoring to a place to allow selective restoration of data, there's no backup catalog and SolidFire never built the tools to make these backups more efficient which means despite there being the option to apply "at source" efficiency to every single volume, there's no efficiency between consecutive backups or across volumes unless you use "Backup to SolidFire" which is similar to SolidFire snapshot replication that takes advantage of SolidFire's global efficiencies.

It's still a good tool for "just in case" and *ad hoc* backups, as well as a secondary backup tool for users who try to economize.

## Note

Note that in the past SolidFire's backup-to-S3 had issues with MinIO's incompatible S3 API, so it may be possible that this wouldn't work on Versity Gateway. 

I haven't tested and no one is asking, so for now it's just an idea that should work as long as SolidFire's S3 client can create backups on Versity S3 Gateway.
