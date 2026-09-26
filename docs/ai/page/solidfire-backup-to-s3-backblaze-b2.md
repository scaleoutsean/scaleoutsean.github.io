# SolidFire backup-to-S3 with Backblaze

Backup SolidFire volumes to Backblaze buckets

I've written a dozen posts about SolidFire's ["backup to S3"](/2021/04/21/solidfire-backup-to-s3.html), so I'll just skip all that and focus on Backblaze.

To test if SolidFire's backup to S3 feature can work with Backblaze, I create a new bucket `solidfire-backup` (bucket name must be unique service-wide, so pick another name!).

![Backblaze bucket for SolidFire backup](/assets/images/backblaze-solidfire-backup-to-s3-b2-01.png)

I didn't use any special bucket settings. 

I've blogged about Object Lock with SolidFire's Backup to S3 before - I think it can be used, but you need to come up with a plan that is suitable for your needs.

Create the keys and you may limit the keys to have access **only** to your backup bucket. 

![Backblaze keys for SolidFire API access](/assets/images/backblaze-solidfire-backup-to-s3-b2-02.png)

You could have another bucket and another set of keys in another region, so that you can run another backup schedule for additional protection.

Now pick a volume fill in S3 API endpoint (it works without https:// or :443) for the bucket, bucket name and credentials and you're good to go.

![SolidFire backup to S3 with Backblaze details](/assets/images/backblaze-solidfire-backup-to-s3-b2-05.png)

Backup of volume "log" was successful:

![Backblaze backup from SolidFire worked](/assets/images/backblaze-solidfire-backup-to-s3-b2-03.png)

`solidfire-backup` is now no longer empty:

![Backblaze backup with SolidFire data](/assets/images/backblaze-solidfire-backup-to-s3-b2-04.png)

The volume I backed up was a 1GiB empty volume and because I used Native data format (which compresses and deduplicates) backup data in the bucket is <100 kB. 

Because I use a SolidFire Demo VM at home, reads are usually storage-constrained. I was able to backup at 20+ MB/s (Max IOPS-constrained; you can see that Burst is higher but lasts a short time).

![Backup to Backblaze maxed out SolidFire Demo VM](/assets/images/backblaze-solidfire-backup-to-s3-b2-12.png)

## Restore-related notes

We can use a dedicated read-only pair of keys for restore. This is to prevent deletion as well as tampering with backup images.

![Backblaze key pair for restore](/assets/images/backblaze-solidfire-backup-to-s3-b2-07.png)

Earlier I mentioned "pairing" of pre-created empty volumes and volume IDs with what we have in our backup bucket. 

As I restore PROD-wcwb/log-2 (ClusterName - ClusterUuid / VolumeName - VolumeID) to new volume PROD-wcwb/test-25, I need to override the default path in the bucket to another volume. 

- PROD-wcwb/log-2 => PROD-wcwb/test-25

![Backblaze key pair for restore](/assets/images/backblaze-solidfire-backup-to-s3-b2-08.png)

If restore destination (cluster) was different, I would have changed that part (PROD-wcwb) as well. Restore was successful.

![Backblaze restore to SolidFire volume successful](/assets/images/backblaze-solidfire-backup-to-s3-b2-09.png)

Here we can see the both volumes. Notice that the second volume is larger, so we know a backup of a smaller volume can be restored to a larger volume size.

![SolidFire source and destination volumes](/assets/images/backblaze-solidfire-backup-to-s3-b2-10.png)

That shows that it's possible to create 10 16TiB volumes and use them to restore arbitrarily sized SolidFire volume backups (up to SolidFire maximum which is 16TiB).

## Is Backblaze supported?

There's no official compatibility list for S3-compatible services. If it works, it works. 

Backblaze's S3 API compatibility [isn't super-high](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api), so I was a bit worried (that I'd waste time), but it worked very nicely: I backed up 10 volumes (1GB of data, 75% full, ~3X global efficiency, 2x in-volume efficiency) and restored them. All 20 jobs successfully completed.

If you test it yourself, I'd recommend to create the largest SolidFire volume you plan to backup to Backblaze, fill it up to 90%, and then try to both backup and restore. Why?

Because some services may have obscure limitations that may not be readily visible. 

For example, earlier today I found one S3 service (not Backblaze) where the maximum number of objects per bucket is limited to a very low figure. In fact it's so low that you'd have to have very small SolidFire volumes, and use one bucket per each volume! (To make this worse, SolidFire's backup-to-S3 always works with 4 MiB source volume chunks, so it can create thousands of objects per backed up volume, which is not good cost-wise if you're charged for each S3 API call.)

So far I've tried SolidFire's Backup to S3 with StorageGRID, ONTAP S3, MinIO (there was/is a bug in MinIO's S3 APIs, it was worked around in one of SolidFire v12 updates), Wasabi, and Backblaze.
