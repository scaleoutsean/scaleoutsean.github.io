# Replicate volume data from Digital Ocean to SolidFire and back

Steps for moving or copying data from Digital Ocean to SolidFire and back

Digital Ocean is a no-nonsense cloud provider that you've probably heard of.

SolidFire and Digital Ocean users may sometime want to migrate volume data without using application-level replication. That may involve activities such as Backup & Restore (each action on one side) or offline data synchronization or replication.

In this post I want to describe how to migrate or protect volume images from Digital Ocean to SolidFire. I already described the approach and demonstrated it [SolidBackup](/2021/05/08/revisiting-solidbackup/) [posts](/2021/06/18/solidbackup-with-alternative-backup-clients) and demos, so this post will be short and just focus on Digital Ocean-specific details as they apply to native Linux and Windows volumes (NTFS, ext4, etc.). If you have no idea what I'm talking about, it's raw volume backups - please check the second link (SolidBackup with alternative backup clients) to see.

If you're interested in file-level replication or backup-restore, that's not Digital Ocean-specific so you can just search the Internet or check the first of those SolidBackup posts I mentioned above.

## Volume size units on Digital Ocean and SolidFire

This is one of the first things to check because when copying raw data from one volume to another, it's best when they're exactly the same.

Currently Digital Ocean volumes use binary units, so when you create a 50 "gig" volume, that volume is going to be 50*1024^3 bytes (50 GiB) large. `fdisk` output for a 50 GiB volume on Digital Ocean:

```raw
Disk /dev/sda: 50 GiB, 53687091200 bytes, 104857600 sectors
Disk model: Volume          
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
```

Using their CLI, you could see that volume size GiB:

```sh
$ doctl compute volume list | grep -E 'uploader|Droplet IDs'
ID                                      Name                      Size      Region    Filesystem Type    Filesystem Label    Droplet IDs    Tags
e1fec965-42b2-11ec-ac33-0a58ac14a1d1    uploader                  50 GiB    sgp1      xfs                                    [273172181]  
```

The SolidFire API in versions 12 and 11 uses the same units, so we just use the same size in bytes in `CreateVolume` (adjust account ID and QoS values as necessary; it appears 512 byte emulation is in place in Digital Ocean so we use it here as well):

```json
{
    "method": "CreateVolume",
    "params": {
        "name": "uploader",
        "accountID": 8,
        "totalSize": 53687091200,
        "enable512e": true,
        "attributes": {},
        "qos": {
            "minIOPS": 100,
            "maxIOPS": 300,
            "burstIOPS": 500,
            "burstTime": 60
        }
    },
    "id": 1
}
```

## Volume sizing and resizing

In the example above we aim to have volumes with identical sizes.

Of course, if we were to copy just the content on file or application level, Destination would have to be large enough to fit all the data, but perhaps not as large as Source. But if you copy volume data byte for byte (image backup or image replication), then you'd prefer to have identical capacity because it's easier and better and you can copy back and forth without issues (it's possible to restore a volume image to a larger volume, but I don't like the thought of doing that).

If you want to go *back and forth* over a medium term (say, you have a DR/BC setup for hybrid cloud) and volume sizes grow over time, you may use doctl `compute volume-action resize` and `ModifyVolume` method on SolidFire (you can also grow volume size from the Web UIs or CLIs) to handle that.

```json
{
    "method": "ModifyVolume",
    "params": {
        "volumeID": <Volume ID>,
        "totalSize": <Optional New Volume Size in Bytes>,
        ...
    }
}
```

If you need or already have the volume size that one side cannot support, then volume image backup isn't the way to go; you should probably use another approach to spread data across several volumes (see the SolidBackup read-me file).

## Use `dotctl` to clone a snapshot and attach a volume to droplet

Copying data from SolidFire to Digital Ocean would work as explained in the older SolidBackup posts linked above. What about copying volume images from Digital Ocean to SolidFire? Well, you would use the same backup utility that you prefer to leverage from SolidBackup. For example, Restic.

To get started, you'd take a snapshot of your Digital Ocean volume. For a crash-consistent snapshot, just do it online. For an application-consistent you'd probably have to run a step on the application side or OS level, take a snapshot with `doctl` and then resume normal processing in your application or OS. That's off topic here so we'll move on to taking a Digital Ocean snapshot:

```sh
doctl compute volume snapshot e1fec965-42b2-11ec-ac33-0a58ac14a1d1 --snapshot-desc mig-to-sf --snapshot-name uploader-snap
```

You'll get a new Snapshot with unique ID. Use `compute snapshot list` and `compute snapshot get` to find about this snapshot and check if it's ready (seeing how slow that works even on SSDs, reminded me how nice Element OS is!).

Stand up a new VM ("droplet"), deploy and configure your backup utility and attach the snapshot to the VM:

- `doctl compute droplet list | grep <droplet-name>` - find your Droplet ID
- `doctl compute volume-action attach <volume-id> <droplet-id>` - attach a Volume snapshot to a Droplet

That should be similar to this:

```sh
doctl compute volume-action attach e9fec965-42b2-11ec-ac33-0a58ac14a1d1 283172781
```

## Backup & restore volume image

With a clone of a snapshot attached to the new droplet, now you need to manually mount the volume, take image backup and restore it to an identically sized SolidFire volume. A more sophisticated approach would start a ready-made container or use cloud-init (can be provided during droplet creation) to do this automatically and clean up after itself.

For regular use we could maintain a pair of VPN-connected VMs on each side (SolidBackup on prem, Restic in the cloud) and stream 50GiB-sized images over VPN in both directions as necessary, without raw image files ever landing on disk (except when extracted to be written to devices).

Another option - that leaves a low-cost copy (also known as a backup) behind it - would be to first make a backup to an object store (S3 or similar) located in a different cloud region, then unmount and detach that volume from the droplet as well as delete the volume and the original snapshot if you no longer need it (either on SolidFire or Digital Ocean). An S3 “bucket” is the equivalent of an individual Space in Digital Ocean, so because some marketing guys got carried away now we have to explain how Digital Ocean's object storage works...

### Digital Ocean Spaces: they have a different term for everything

I installed `s3cmd` and configured it like this (I mention only the parts that I changed from defaults *and* that were different from what you might use with AWS S3 or NetApp StorageGRID):

```raw
access_key  =        # <= get it from DO UI/API
secret_key  =        # <= get it from DO UI/API
bucket_location = US # <= this was weird, but it worked with sgp1!
host_base   = sgp1.digitaloceanspaces.com           # <= SGP1 location
host_bucket = %(bucket).sgp1.digitaloceanspaces.com # <= A Space is really a bucket
```

Replace `sgp1` (Singapore 1) with your `${region}{region-number}` in both `host_base` and `host_bucket`). Assuming your Space (bucket) is `https://backup-bucket.sgp1.digitaloceanspaces.com`, you could work with it like so:

```sh
$ s3cmd ls s3://
2021-11-09 08:36  s3://backup-bucket
2021-11-09 08:36  s3://random-crap
$ s3cmd put db-vol.tar.gz s3://backup-bucket/do-backups/
```

Wow, wow, wow - what's that random crap? Glad you've asked!

It turns out when it comes to Spaces, sharing is caring: one set of credentials works for all buckets (Spaces) that belong to your account! As a consequence you **should** encrypt your backups (Restic and many backup and compression utilities can do that for you) if you have users with different access requirements.

After the above `PUT` completes you should be able to see the backup (aka "snapshot", in Restic speak) with on-prem Restic (or other tool) on-prem to restore that big image to the SolidFire volume of the same size. Please check the SolidBackup posts for examples and demos.

## Detach and delete unnecessary clone volume

After backup workflow is done we no longer need the volume we can detach it with `compute volume-action detach ${VolumeID} ${DropletID}`:

```sh
doctl compute volume-action detach e9fec965-42b2-11ec-ac33-0a58ac14a1d1 283172781 
```

If you used the above process to restore data from a SolidFire clone in order to use it in Digital Ocean, now you could attach this volume to another Droplet ID where you want to access it. But if the detached volume is a clone volume created from a Droplet volume snapshot, you may want to delete it (and also the snapshot, perhaps):

```sh
doctl compute volume delete e9fec965-42b2-11ec-ac33-0a58ac14a1d1
```

## Automate volume-to-volume replication

How can we automate set up of Digital Ocean <=> SolidFire volume pairings?

I haven't had a reason to try, but here's how I'd go about it if I needed to:

- Use Digital Ocean and SolidFire provider for HashiCorp Terraform to create volume pairs, or
- Use Ansible with Digital Ocean (community.digitalocean) and SolidFire (netapp.elementsw), or
- Use SolidFire Tools for PowerShell and doctl (Digital Ocean CLI) with solidbackup, or
- Combination of the above

[SolidBackup](https://github.com/scaleoutsean/solidbackup) already leverages Ansible and it should be easy to modify the backup binary to use a binary rsync tool such as diskrsync. Additional role for verification could be added if desired.

## Demo

- Create 1GiB volume on SolidFire and Digital Ocean (whole GibiByte units are identical, so if you use those, you don't need to convert them)
- Create a small VM on each side (512MiB or 1GiB RAM is enough)
- Install a binary sync utility
- Create filesystem and a 100MiB file at Source (VM attached to SolidFire volume), then unmount the volume (normally we'd make a clone and sync data from a clone as we do in solidbackup)
- Sync Source volume with Destination volume attached to (but not mounted on) a VM in Digital Ocean 
- At both Source and Destination, the entire volume will be read and chunks of it checksumed and compared. Any difference will be compressed and transferred over SSH
- Activity on Source VM (constrained by read speed (20 MB/s) in SolidFire Demo VM) as we begin: 

```
----system---- -dsk/total- --total-cpu-usage--
     time     | read  writ|usr sys idl wai stl
20-02 15:22:18|  52k   32k|  1   0  99   0   0
20-02 15:22:19|  19M 8192B|  2   0  97   1   0
20-02 15:22:20|  18M   16k|  1   1  88  11   0
20-02 15:22:21|  19M  460k|  1   0  88  10   0
20-02 15:22:22|  18M   52k|  1   0  89  10   0
20-02 15:22:23|  19M    0 |  1   0  88  10   0
20-02 15:22:24|  20M 8192B|  1   1  89  10   0
```

- Activity at Destination; the entire volume is read quickly (300 MB/s with 1 CPU only 50% busy)

```
----system---- -net/total- -dsk/total- --total-cpu-usage--
     time     | recv  send| read  writ|usr sys idl wai stl
20-02 07:22:18|4193B 3501B|  16k   20k|  3   3  94   0   0
20-02 07:22:19|1550B 1996B|  92M    0 | 55  21  21   2   1
20-02 07:22:20| 132B  396B| 300M    0 | 46  23   0  32   0
20-02 07:22:21| 132B  396B| 300M    0 | 45  22   0  33   0
20-02 07:22:22| 132B  396B| 300M    0 | 50  20   0  29   1
20-02 07:22:23| 198B  562B|  31M    0 |  4   4  91   1   0
20-02 07:22:24| 132B  396B|   0    44k|  0   0  99   1   0
```

- After both volumes are read, checksums are compared and only compressed difference between 1MiB chunks is transferred. In this case it was a resync with a small differential so network transfer to Digital Ocean was very small

```
----system---- -dsk/total- --total-cpu-usage--
     time     | read  writ|usr sys idl wai stl
20-02 15:23:13| 188k    0 |  0   0 100   0   0
20-02 15:23:14|   0  8192B|  0   0  99   0   0
20-02 15:23:15|   0    24k|  0   0 100   0   0
20-02 15:23:16|   0    16k|  1   0  99   0   0
20-02 15:23:17|   0    28k|  0   0  99   0   0
20-02 15:23:18|   0     0 |  0   1  99   0   0
20-02 15:23:19|   0  8192B|  1   0  99   0   0
```

- To verify correctness of replication, we mount and checksum the files at source and destination to ensure they match 
- Digital Ocean VMs are billed even when powered off, so you may as well leave the "sync VM" on. If you need to failover to the cloud, detach the volumes from the "sync VM" and attach to your workload VM (`doctl compute volume-action detach|attach` takes less than a minute)

## Demo

- [Binary sync of SolidFire volume to Digital Ocean volume](https://rumble.com/vvhqjz-binary-replication-of-solidfire-volumes.html) - 3m35s

## Conclusion

The approach taken by SolidBackup works with both Digital Ocean virtualization and object storage, which was one of the reasons it was made that way (general purpose, open approach).

However, both the Digital Ocean CLI (`doctl`) and Spaces take some getting used to - it took me too much time to find the exact commands and ways to configure Spaces - so I hope this post will save some time to those who read it.

The entire process is simple and repetitive enough to automate with mainstream automation tools and languages.
