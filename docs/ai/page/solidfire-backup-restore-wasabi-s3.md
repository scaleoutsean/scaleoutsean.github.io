# SolidFire v12 Backup and Restore with Wasabi S3

How to configure SolidFire to backup to S3 with Wasabi S3

It's very easy and works as you expected:

- Create a usable bucket (get region, account, access/secret key pair details and make sure it works from another client)
- Get S3 [API endpoint](https://wasabi-support.zendesk.com/hc/en-us/articles/360015106031-What-are-the-service-URLs-for-Wasabi-s-different-regions-) FQDN for your bucket from the Wasabi help pages
- Backup (or restore) SolidFire volumes as usual

I am in APAC so I picked one of two Wasabi APAC regions (ap-northeast-2) and my S3 API endpoint was s3.ap-northeast-2.wasabisys.com.

Both backup and restore worked fine. If you'd like to automate SolidFire backup to S3, check [this post](/2021/04/21/solidfire-backup-to-s3.html) that has enough information to get you started with PowerShell and Python.

There's also a reference backup automation workflow for SolidFire backup to S3 called [solidbackup](https://github.com/scaleoutsean/solidbackup) which you can use or reference for more complex automation. Its default "engine" uses Restic which works with Wasabi.

## Update

[This post](/2022/05/06/solidire-backup-to-s3-with-object-lock.html) examines SolidFire Backup to S3 with Wasabi S3 Object Lock.

## Demo

- [SolidFire Backup/Restore to/from Wasabi S3](https://rumble.com/vsvis6-solidfire-backup-and-restore-with-wasabi-s3.html) - 2m58s
