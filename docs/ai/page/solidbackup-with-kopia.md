# SolidBackup with Kopia

Use Kopia to backup cloned SolidFire volumes to S3/B2

- [Objectives and tools](#objectives-and-tools)
- [Steps to set up backup with Kopia](#steps-to-set-up-backup-with-kopia)
  - [Steps on OS and SolidBackup](#steps-on-os-and-solidbackup)
  - [Steps related to Kopia](#steps-related-to-kopia)
  - [Ensuring SolidBackup and Kopia schedules don't overlap](#ensuring-solidbackup-and-kopia-schedules-dont-overlap)
  - [Refresh source volumes for next round of SolidBackup cloning](#refresh-source-volumes-for-next-round-of-solidbackup-cloning)
- [Steps to restore a volume or file](#steps-to-restore-a-volume-or-file)
- [Alternative approaches to using Kopia](#alternative-approaches-to-using-kopia)
  - [One Kopia per VM](#one-kopia-per-vm)
  - [Use Kopia server](#use-kopia-server)
- [Security](#security)
  - [SolidFire](#solidfire)
  - [Kopia](#kopia)
- [Demo](#demo)
- [Summary](#summary)

## Objectives and tools 

We have a bunch of Docker, Kubernetes, or Linux VM volumes and we want to backup them using Kopia.

We can install Kopia on all those systems, or we can install it on one VM and clone all volumes that need protection into that VM. Then we just run Kopia on that one VM - our "backup server", if you will.

Kopia has a CLI and UI. Either way, you first need to set thing up.

![Kopia UI](/assets/images/solidbackup-with-kopia-00.png)

After that, we can prepare and run our backup jobs. 

But we need to clone and mount those volumes from other systems. You can write your own scripts, use SolidBackup, or even do this manually (although it would quickly drive you nuts, re-syncing and remounting volumes every week or even every day).

[SolidBackup](https://github.com/scaleoutsean/solidbackup) is a PoC type of project of mine that does three things: 

- snapshot and clone a list of SolidFire volumes
- mount them all in one VM
- backup data to S3 (by default using restic, but I also tried a few other tools)

I'll simply do more of the same here and try yet another (Kopia).

Restic doesn't have a UI, so schedule would be created using the CLI. Kopia does, so it's a bit easier to divide two tasks:

- Snapshot/clone volumes and mount them in the VM - use SolidBackup (CLI)
- Create backup schedules, try to backup & restore - use Kopia (UI or CLI)

After backup jobs are done running, we'd unmount the volumes in order to refresh them for next backup. But this is easy to schedule and simply re-run SolidBackup, so we'll just ignore this routine step.

## Steps to set up backup with Kopia

I'll write down high level steps that show SolidBackup with Kopia.

### Steps on OS and SolidBackup

Deploy a Linux VM with iSCSI client, git, XFS tools, and (for Kopia UI) X-Windows of your choice; I used Rocky 8 with Xfce.

Deploy [Kopia](https://kopia.io/docs/getting-started/), start Kopia UI (screenshot at the topi) and set up a repository; I used Backblaze (see this [recent post](/2023/09/02/solidfire-backup-to-s3-backblaze-b2.html))

Use own or [SolidBackup scripts](https://github.com/scaleoutsean/solidbackup) to clone ext[3,4] or XFS volumes from SolidFire. Present them to SolidFire storage account used by your backup VM, login and mount them. In SolidBackup I use a config file (see the repository's read-me instructions). You'll need PowerShell (try [7.3](https://learn.microsoft.com/en-us/powershell/scripting/install/install-rhel?view=powershell-7.3)?) and SolidFire.Core PowerShell module for SolidBackup, by the way!

Additionally, install Ansible with `community.general` and `ansible.posix` collections and make sure your backup account can run as sudoer. 

This can get complicated, but it's well documented in SolidBackup and Ansible documentation, so I'll just show a walk-through.

We'll protect these three Source volumes: they are owned by the user "sean".

![](/assets/images/solidbackup-with-kopia-01.png)

In Kopia VM we plan to use a different user, "s198", so when sean's volumes are clones we'll change the owner to s198.

![](/assets/images/solidbackup-with-kopia-02.png)

We want to use a higher QoS for faster backup on those cloned volumes, so QoS ID 2. (The here is a high Max for fast backup, but also a low Min, to not squeeze out production volumes!)

![](/assets/images/solidbackup-with-kopia-03.png)

Now that I have these inputs, SolidBackup Account ID and QoS ID, I save them to SolidBackup script and set the maximum snapshot age to 6 hours (see more on snapshots further below).

![](/assets/images/solidbackup-with-kopia-04.png)

SolidBackup scripts directory has a simple volume cloning script, but I manually cloned the three volumes that belong to "sean" to get Destination volume IDs. Notice that clone account ownership is assigned to "s198", as I want to change the Account ID as well.

![](/assets/images/solidbackup-with-kopia-05.png)

Now can create a SolidBackup configuration fil to automate this. 

Backup type (file or image) exists so that we can create appropriate backup commands for backup utility (Kopia or other). We'd use the image type for non-native filesystems on Linux.

```powershell
@{
  Backends = @{
    prod = @{
      name         = "SF-PROD-192.168.1.30"
      mvip         = "192.168.1.30"
      username     = "admin"
      password     = "admin"
      }
  }
  Namespaces = @{
    projecta     = @{
      app1         = @{
        SrcId      = 36
        TgtId      = 47
        Part       = 0
        FsType     = "xfs"
        BkpType    = "file"
      }
    }
    projectb     = @{
      web          = @{
        SrcId      = 37
        TgtId      = 48
        Part       = 0
        FsType     = "xfs"
        BkpType    = "file"
      }
      db           = @{
        SrcId      = 38
        TgtId      = 49
        Part       = 0
        FsType     = "xfs"
        BkpType    = "file"
      }
    }
  }
}
```

When use `solidsync.ps1` to sync Source to Destination volumes (the latter are accessed by Kopia), and its log looks like this. If snapshots younger than 6 hours exist, they'll be used as Source. In this case there are no recent snapshots.

![](/assets/images/solidbackup-with-kopia-07.png)

SolidFire event log shows this created clone jobs (Src-to-Dst, as per our configuration file).

![](/assets/images/solidbackup-with-kopia-08.png)

The second script, solidbackup.ps1, logs into (clone) volumes, mounts them and creates backup commands (by default for restic, which we won't need today). 

Solidbackup.ps1 also creates Ansible plays and stores them to "ansible" subdirectory, so that we can remount volumes with `ansible-playbook` and without running solidbackup.ps1 again as long as volume configuration doesn't change.

After running these Ansible scripts, our backup VM has clone volumes mounted at /mnt/${SRC_VOL_ID}. I use Source rather than Destination volume IDs because I usually need to start working with Source ID and prefer to know which *Source* volume I'm working with. Of course, if you want to change this, you can - for example, if you use unique volume names, you could mount clones using the original name under `/mnt/{VOLUME_NAME}`.

```sh
$ df
Filesystem               1K-blocks     Used Available Use% Mounted on
...
/dev/sda                   1038336   768304    270032  74% /mnt/36
/dev/sdb                   1038336   768304    270032  74% /mnt/37
/dev/sdc                   1038336   768304    270032  74% /mnt/38

```

If I want to quickly look up Src->Dst mapping in the SolidFire UI, use Reporting > iSCSI sessions. ("Source" Volume IDs (and names) are visible because that's how I named my clone volumes. The same can be viewed in the CLI.)

![](/assets/images/solidbackup-with-kopia-09.png)

In your Linux shell, check nodes under `/dev/disk/by-path/` or use the SolidFire API to GET iSCSI connections.

### Steps related to Kopia

Kopia has a UI version, which is the one I used. The first thing was to create a bucket on Backblaze and connect to it from Kopia.

![](/assets/images/solidbackup-with-kopia-10.png)

Next, create Kopia backup job(s) and run them once to create baseline backups. During this step your clone volumes must be mounted, obviously, but we did that with Ansible scripts and you can add those to Kopia as "pre" and "post" scripts (with post script being the one that dismounts volumes to prepare them for the next round of cloning).

![](/assets/images/solidbackup-with-kopia-11.png)

My baseline backup (~750 MiB of on-disk data for each of 3 volumes) took 2 minutes per snapshot (=run of a backup job).

Notice how subsequent runs take mere seconds, if nothing has changed after a refresh:

![](/assets/images/solidbackup-with-kopia-12.png)

In a recent post I compared the storage efficiency of SolidFire's Backup to S3 with Simple Backups (tar.gz) and found them to be very similar *for the synthetic data sample I used*. Kopia offers several compression methods and I generally found them to be within a few percent of SolidFire's Backup to S3 and Simple Backups. It may be very different for different data sets, so do your own diligence. By the way, I compared "uploaded bytes" (500.7 MB).

![](/assets/images/solidbackup-with-kopia-13.png)

Unmount clone volumes after you're done, to be ready for next run of solidsync.ps1.

Schedule Kopia "snapshots" (i.e. backup jobs) to run *after* solidsync.ps1 is done refreshing volumes by copying sources to targets, and make sure that completes *before* next volume refresh - if Kopia backup runs while volumes are being unmounted or have old data, backup results won't be valid. 

Example schedule: 

- run snapshot scheduled by application owners: between 07:00pm and 01:00am
- run solidsync.ps1 at 01:05am
- run Kopia snapshots (backup jobs) at 02:00am
- clones unmounted at 07:00am (or make the unmount command part of Kopia backup job's post-backup command) 

Pre- and post- scripts for Kopia can take care of that - more on that below.

Unlike SolidFire's Backup to S3 feature which creates an object for every 4096kB logical chunk of volume, Kopia packs most data in large blobs (there are also small files, but not many). This is better for object stores and it also decreases per-API call charges.

![](/assets/images/solidbackup-with-kopia-17.png)

If you're curious how a snapshot (i.e. backup job) retains your data, click on a snapshot to view Retention.

![](/assets/images/solidbackup-with-kopia-18.png)

You can go to Policies to adjust job properties or create a shared Policy. 

### Ensuring SolidBackup and Kopia schedules don't overlap

Maybe you think it's hard to ensure one completes before the other one starts, but only baseline backup should take some time while subsequent runs should be fast. 

Cloning takes literally minutes as well. Consider this:

- SolidFire with 3:1 storage efficiency: 50TiB before Helix (2x replication) is around 17TiB on-disk
- Daily change of files 5% or 870 GiB
- Metadata is 1/256 of that, so 3.5 GiB changes every day. Even if we consider that all of slice data is copied (i.e. entire cluster is backed up so all MD must be re-synced every day), that's 50TiB / 256 or 200 GB. At 200 MB/s copying speed, that's 1000 seconds to copy all volumes.

So even worst case scenario for daily volume copy of all volumes in a 100 TiB cluster would take around 15-20 minutes.

Second, you can create schedules that leave hours between jobs. Kopia doesn't have to start just 60 minutes after solidsync.ps1.

Third, you can use Kopia or own scripts to create custom checks. For example, as most backup tools, Kopia lets you run pre- and post-job scripts. 

![](/assets/images/solidbackup-with-kopia-14.png)

Examples of jobs we could configure here:

- pre-job script: check that clone filesystem is mounted
- post-backup job: unmount filesystem and log out of its iSCSI target.

### Refresh source volumes for next round of SolidBackup cloning

Obviously, the first thing to make sure is that Kopia has finished all jobs by then. 

Backup VM must unmount all volumes and SolidBackup can refresh them by either copying Source volumes (which creates a temporary internal source volume snapshot in SolidFire) or by using a specific snapshot of a source volume (say, if there's a snapshot of the volume ID that has a special keyword in its name, such as "solidbackup", and is less than 6 hours old, use that snapshot. Otherwise, just copy from the source as required.)

Then it's up to the app owner if they want to set up scheduled (possibly application-integrated) snapshots or just let SolidBackup use crash-consistent snapshots in a Just-in-Time manner. Most databases don't need application-integrated snapshot these days. 

Here's an example of the three source volumes' snapshots: each is named the same, `solidbackup`, as that's the snapshot name keyword I supplied in the volume sync script.

![](/assets/images/solidbackup-with-kopia-06.png)

When I create these, I set them to expire within a day, and in SolidBackup I let it ignore snapshots older than 6 hours, which gives SolidBackup enough time to pick the latest matching snapshot of a Source volume, but ignores those that are old. If I run backup at 2am, I'd schedule these snapshots for midnight, for example. 

If you're interested in SolidFire snapshots, see [this](/2023/04/01/using-solidfire-snapshot-attributes.html) post. If you want to get fancy you can inject Kopia (or other) backup preferences in snapshot attributes for more complete backup automation.

One opportunity for automation would be to let the volume owner define preferred job parameters such as compression method or paths to avoid backing up (temporary directories and similar).

Speaking of temporary directories, you may notice "Maintenance Tasks" and wonder if they try to read data from volumes to backup.

![](/assets/images/solidbackup-with-kopia-16.png)

They don't. They access Kopia's cache, so if they run when volumes are not mounted, that's not a problem.

![](/assets/images/solidbackup-with-kopia-15.png)

## Steps to restore a volume or file

Remember that volumes backed up by Kopia are clone volumes. That means the original volume can be restored without Kopia as long as clone volume is available (or snapshot of the original volume). So some scenarios can be handled locally, using standard SolidFire features.

If both source and clone (used in Kopia) are gone, then we need to use Kopia. Create a new volume, mount it to some temporary path, and then restore data from the repository to this new volume. After that simply unmount and log out of this volume and present it to the VM or import to container where it is needed.

From Kopia UI, there are two main options to restore:

- [Recommended; green rectangle] - mount remote repository locally
- [Not recommended] - restore all backup job data to Kopia host

![](/assets/images/solidbackup-with-kopia-19.png)

Notes:

- The first, mount option is much faster and lets you restore individual files. The second option may kick off a full download of volume data from S3, which may take a while.
- By default SolidBackup mounts cloned volumes read-only, which is required so that backups are same as source volumes. Because of that we can't really use the second option (restore repository data to clone volume) without remounting volume as read-write.

In my opinion, if it comes to that it's easier to copy some or all files to anywhere (/home/user/temp) and then scp or rsync data to the Source volume's VM (where they are presumably needed). Restoring a remote backup to local *clone* volume doesn't seem logical or necessary. If you don't like this approach, you can change mount options for cloned volumes inside of Kopia VM or remount it read-write before choosing the second option.

## Alternative approaches to using Kopia

### One Kopia per VM

I often write about "one Kopia per VM" because I figure everyone thinks of it.

Why not deploy a Kopia instance to every VM and let the user self-manage their backup?

Because they don't want to self-manage their backup. Or the organization doesn't want the same user be in charge of data and its copies.

Cluster administrator would have to do the cloning and syncing unless we want to give the VM owner the ability to access the SolidFire API. 

Uses would have to have own buckets, or access to different paths in a shared bucket. "Own buckets" is another problem, as others may not be able to get to backup data if the owner wasn't there (especially since Kopia repository is encrypted, so no owner, no data!).

And finally, backups from different instances on Kopia would take up a bit more space on storage as they wouldn't be deduplicated among themselves.

If you're comfortable with these characteristics, then one Kopia per VM is fine.

### Use Kopia server

Another approach is [Kopia server](https://kopia.io/docs/repository-server/), which is like our centralized approach but many users use Kopia server and each can see only their own backups (or "snapshots", as Kopia calls them).

I haven't given this much thought, but I wrote about [Rest Server](/2022/04/03/restic-server-netapp-eseries.html), which is a similar concept for restic. 

As one of the challenges of using Kopia with SolidFire is snapshots (we need a way to get a "stable picture" of the files we backup), we want to use SolidBackup or something that lets us clone and mount volumes for backup. 

We could do the clone-and-mount *for* VM owners *in the VMs*, but in my experience running own scripts on live production VMs is generally not appreciated among application owners. Then, it is more likely that we'd clone-and-sync on the Kopia machine, which means Kopia clients would have to run on the same system as Kopia server. 

It appears the only advantage would be that Kopia server could be administered by some storage admin, while application owners would login to Kopia VM and create and run Kopia jobs based on their own preferences. 

But, how to ensure user A can't see or mount volumes that belong to user B? At the same time, because all these users need to mount/unmount filesystems, they'd all have to have such capabilities. It would be hard and even less secure. 

So I think Kopia server could be used in "one Kopia server per team" scenario, where a team would operate just a Kopia server, solidsync.ps1 would be for each VM, and VM owners would create and schedule Kopia jobs to send data to Kopia server. That seems very complicated.

## Security

You need to be very careful about restricting access to that VM, so it's best to disable SSH, apply 2FA, etc. 

### SolidFire

iSCSI target scan and login, filesystem mount, and access to possibly root-only files on cloned volumes may all require sudo to run Solidbackup or Kopia scripts. 

Because this VM also has credentials to SolidFire, it must be well guarded. It must be able to access the SolidFire MVIP, and Kopia must be able to access backup repository (outgoing DNS and HTTPS access should be enough for S3 and B2, although NAS repos are available as well). This is quite restricted and no inbound connections except SSH from the administrator are required.

### Kopia

Kopia keeps S3 (or B2) repository credentials in plain text in its configuration directory *while connected* to a repo. That's fine as long as:

- You disconnect it when jobs don't run, and
- Keep the VM secure

Long story short, restrict access to that VM and make sure scripts and credentials have tight permissions. Maybe you'd find some of the recommendations in [Rest server](/2022/04/03/restic-server-netapp-eseries.html) post useful.

## Demo

- [SolidBackup with Kopia](https://rumble.com/v3evzxc-solidbackup-with-kopia.html) - 6m40s

## Summary

This post shows how a consolidated Kopia backup can be achieved in a SolidFire environment. See the SolidBackup readme and Kopia documentation for additional details. 

This involves no commercial components and can be a nice low-cost solution for smaller environments with Linux VMs and containers.

If you're looking for a commercial service based on this approach, consider Simple Backups [which I reviewed yesterday](/2023/09/03/simplebackup-with-solidbackup.html).
