# SolidFire, KVM, Duplicati and S3 Object Storage

Use SolidFire APIs and Duplicati to automate data protection in KVM environments

In the [previous post](https://scaleoutsean.github.io/2021/04/21/solidfire-backup-to-s3.html) I explained how SolidFire's built-in backup/restore to/from S3 works and how we can automate it. This post is about doing less automation and more integration.

## Why

For niche data protection use cases we can take advantage of the friendly SolidFire API features as well as various backup utilities to implement data protection that's better performing and richer than SoldiFire's built-in backup/restore feature that still doesn't cost a lot (it's mostly your time).

This is another manual walk through of how my (never-finished) SolidBackup might have worked, but this time with Duplicati 2.0 Beta.

So, what can this do that SolidFire's built-in Backup/Restore cannot?

- Faster-performing (1 GB/s or more)
- Easier to manage (Web UI is available for certain workflows)
- Less coding and maintenance - SolidFire- and OS-related parts include quiesce/snapshot and mount/unmount - the rest is scheduled in Duplicati
- File based backup and restore makes it possible to easily restore individual files
- Better hybrid cloud support - you can restore your files to any system on-premises or in the cloud

## How

- Optionally quiesce (on the client), and (on SolidFire) snapshot your source volume
- Use SolidFire to create a clone and present it to a backup VM
- Mount the clone volume
  - Consider Ansible
- Configure Duplicati backup jobs to backup to S3-compatible storage
- Schedule unmount/logout from crontab
  - Consider Ansible
- Repeat by taking another snapshot and syncing data from Src to Bkp volume using SolidFire's VolumeCopy feature
  - The advantage of doing this rather than re-creating the backup volume every day is it's faster and your backup volume remains consistent, which is why Ansible scripts would be largely static - you'd update them when new volume is added

SolidFire volumes are thin-provisioned by default. While SolidFire volumes can be expanded (sized up), resizing filesystems isn't fun, plus you may need to resize clone volumes in exactly the same way. I therefore recommend to use larger volumes to minimize the need to resize, and when you do need to resize, perhaps it's easier to recreate the clone volume. But it's up to you - manual filesystem expansion sure can work - just make sure that it does!

## How to restore production data

- First line of defense: restore production volume from latest SolidFire snapshot
- Second line: clone latest snapshot, mount it somewhere, and restore individual file(s). Or if clone volume that can be mounted on Backup VM isn't too old, `scp` file(s) you need to your server/application
- Third line: if original volume, its snapshots and clones are all destroyed, you can restore a backup from S3. You can restore directly from S3 (even w/o the original Duplicati instance).

## Web-based storage management in a SolidFire-KVM environment

SolidFire has a nice UI but CopyVolume isn't exposed through it so you'd have to use sfcli or PowerShell to take advantage of it. Backups are supposed to run unattended, so that is not a big deal.

In a KVM - on indeed any Linux-based - environment, Cockpit can be used for some simple operations such as mount, format, unmount and basic storage performance monitoring (for advanced storage monitoring see the community projects HCICollector and SolidFire Exporter (for Prometheus and K8s)).

So the "hard part" - snapshots and clones - would be done in the CLI or even with Ansible, and almost everything else can be done from a Web UI if you'd like that. But you can also use the CLI for everything including Duplicati's backup and restore operations (see the first two videos).

## Demo: Ubuntu KVM, SolidFire, Duplicati and Object Storage

- [Duplicati and StorageGRID S3](https://youtu.be/9O3wXeD51IU) - 2m36s - shows just backup and restore with Duplicati and StorageGRID
- [KVM, SolidFire, Duplicati and Minio S3](https://youtu.be/wP8nAgFo8og) - 8m19s - shows key steps from the workflow section above
- [Visual storage management of SolidFire-KVM enviroment with Cockpit](https://youtu.be/8cYk2gNnMo8) - 2m01s - shows SolidFire and Cockpit Web UI and snapshot in a KVM environment
