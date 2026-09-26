# SolidBackup with alternative backup clients

How to modify SolidBackup to use another backup client

As I mentioned in one of previous posts on the topic of SolidBackup, we first use SolidSync to sync SolidFire Source volume(s) to Clone volume(s), and then SolidBackup generates scripts to run backup off those Clone volume(s). The first example I shared uses Restic, but it can be anything you fancy. How?

Given two volume pairs, (Src/Dst 398/401 and 399/402) and assuming volume (image) backup, we just need to adjust the SolidBackup function that generates backup commands.

In order to use Minio client I replaced `restic backup` with `minio pipe` in SolidBackup-generated backup script. Minio object tags can be set in `minio pipe` or separately with `mc tag`.

```bash
#!/bin/bash
sudo dd if=/dev/disk/by-path/ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.solidbackup-sb01.401-lun-0 \
  bs=256kB status=none | gzip | mc pipe s3/s3backup/mn4y.solidbackup-sb01.401.gz; \
  mc tag set s3/s3backup/mn4y.solidbackup-sb01.401.gz "src=398&tgt=401"
# or
sudo dd if=/dev/disk/by-path/ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.solidbackup-sb02.402-lun-0 \
  bs=256kB status=none | gzip | mc pipe --tags "src=399&tgt=402" s3/s3backup/mn4y.solidbackup-sb02.402.gz
```

![SolidBackup with MinIO client](/assets/images/solidbackup-with-minio-client-01.png)

The S3 bucket was populated with two compressed volume image files. Most of the time taken was to read the entire volume (2 GiB) - approximately 3 minutes (the curve in the screenshot above) because I use SolidFire Demo VM.

The actual contents (about 50 MB per volume/image) took seconds to compress and seconds to upload from my home lab to a GCP-based VM with S3 service.

![SolidBackup with MinIO client](/assets/images/solidbackup-with-minio-client-02.png)

The first time I tried my backed up objects were 30 MiB each, but subsequently 48 MiB each. Strangely, `mc` reported different sizes from one run to another and this was observed with both StorageGRID and Minio S3 object stores. Minio server-side figures from the UI weren't consistent with what `mc` client was showing. That's likely related to how object overwrite works (it takes an hour or two for eventual consistency to kick in and utilization to look like expected) but in any case, if the sum of backup jobs is 10 TB you may always need to have 10 TB free to be able to handle overwrites if temporary quota overruns aren't allowed.

Just like with SolidBackup and Restic, you can do file backup (not just image backup) and your S3 target doesn't have to be Minio. Here is the same thing with a StorageGRID cluster running version 11.5.

![SolidBackup with Minio client and StorageGRID 11.5](/assets/images/solidbackup-with-minio-client-03.png)

The bottom line is we need to edit just one function (`NewSbBackupCommand`) to make SolidBackup work with a backup client of your choice.
