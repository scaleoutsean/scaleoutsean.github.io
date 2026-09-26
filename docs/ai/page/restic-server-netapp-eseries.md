# Rest Server with NetApp E-Series

Use Restic to protect data on Rest Server with NetApp E-Series storage

- [Introduction](#introduction)
- [How it works](#how-it-works)
- [Rest Server](#rest-server)
- [E-Series](#e-series)
  - [Dealing with the risk of storage-side snapshot rotation](#dealing-with-the-risk-of-storage-side-snapshot-rotation)
  - [Storage efficiency](#storage-efficiency)
  - [Thin vs thick SANtricity volumes](#thin-vs-thick-santricity-volumes)
- [Limiting backup window](#limiting-backup-window)
- [Other use cases](#other-use-cases)
- [Summary](#summary)

## Introduction

Restic is one of several popular open source backup-and-restore applications. 

Restic can be executed manually or from other scripts or programs such as solidbackup, a script I wrote to automate backup of Docker containers and general (non-LVM, formatted with ext3, ext4, xfs) Linux volumes. If you run Kubernetes, then you can use it from [Velero](/2022/03/15/velero-18-with-restic-and-trident-2201.html). Restic also works on Windows.

Where does Rest Server come in? It's one of the backup destinations supported by Restic.

When would I recommend to use Rest Server and not, for example, NetApp Storage GRID (S3-compatible storage)?

Maybe you don't have the budget, for example. Or want something simple that doesn't require S3-related skills. There may be other reasons - you can see some additional use cases and examples in the Restic documentation.

In any case, the way this could work is as follows:

- Segregated VM or BM host attached to E-Series (why, because it's most economical backup target). This can be direct-attached (SAS, FC) or a well-segregated VM attached to E-Series via iSCSI
- [E-Series storage](https://www.netapp.com/data-storage/e-series/) with RAID6 disk group or DDP style pool (for 18+ disks, for example)

![Rest Server with E-Series](/assets/images/restic-server-with-eseries.png)

## How it works

I won't go through the process of explaining how things are put together, the official Restic and Rest Server documentation is good enough.

Instead, I'll provide screenshots that illustrate how Restic can work with Rest Server backed by E-Series.

On Rest Server, we mount an E-Series volume and run Rest Server with a non-default data directory setting (here: /mnt/test/restic). Then on the client(s) we initialize each client's **individual** backup repository by pointing the client to that Rest Server's IP:PORT:

![Initialize restic repo](/assets/images/restic-server-e-series-05.png)

As you can see, each client has its own repository encryption password (which is unrelated to Rest Server HTTP(S) authentication, if configured). What I did **not** do - and that's how solidbackup works, for example (because all backup is done from one VM worker using volume clones) - is use a unique path (and unique per-account authentication) when connecting to Rest Server. Why? Because I have just one client in this demo.

## Rest Server

Rest Server lets you create multiple accounts, and in that case it is possible to use per-account authentication on each Restic client. That can provide user data segregation. But deduplication does not span across different Restic repositories (user accounts). (Again, solidbackup backs up data on behalf of all clients - so there's an element of trust in that Restic server running it - which is why deduplication is "global" across all volumes it handles.)

After the repo has been initialized, we run our first backup (or "snapshot" in Restic terms). If Restic cannot read a files (such as root-owned files), it will throw an error. But if Restic was executed by a sudoer such as root, it could also read root-owned files. Anyway, this is normal behavior and exclude/include filters can be set to avoid errors when access to some files is limited.

![Backup home directory from restic to restic-server](/assets/images/restic-server-e-series-10.png)

During backup (which I executed over WAN), the performance was decent, over 10MB/s, while CPU utilization was <1%. I don't know how well Rest Server scales, but if it could scale to over 100x that wouldn't be too much for any of the current E-Series models.

![Ongoing backup from restic to restic-server](/assets/images/restic-server-e-series-06.png)

End result is some data was skipped and some was probably deduplicated, resulting in approximately 9GB used to backup my home directory with 9.8GB of data.

![Restic backup result](/assets/images/restic-server-e-series-07.png)

Because backup data is encrypted *at source*, Rest Server can run over HTTP like we did in this proof-of-concept test.

User with shell access to Rest Server would see chunks of client-side encrypted content (/mnt/test/restic/data/4d):

```sh
$ dir /mnt/test/restic/ -lat
total 16
drwx------.   2 root root    6 Apr  3 00:45 locks
drwx------.   2 root root   78 Apr  2 23:48 snapshots
drwx------.   2 root root  222 Apr  2 23:48 index
drwxr-xr-x.   7 root root   87 Apr  2 23:29 .
-rw-------.   1 root root  155 Apr  2 23:29 config
drwx------.   2 root root   78 Apr  2 23:29 keys
drwx------. 258 root root 8192 Apr  2 23:29 data
drwxr-xr-x.   4 root root   90 Apr  2 23:24 ..

$ dir /mnt/test/restic/data/
00  07  0e  15  1c  23  2a  31  38  3f  46  4d  54  d9  e0  e7  ee  f5  fc
01  08  0f  16  1d  24  2b  32  39  40  47  4e  55  da  e1  e8  ef  f6  fd
02  09  10  17  1e  25  2c  33  3a  41  48  4f  56  db  e2  e9  f0  f7  fe
03  0a  11  18  1f  26  2d  34  3b  42  49  50  57  dc  e3  ea  f1  f8  ff
04  0b  12  19  20  27  2e  35  3c  43  4a  51  58  dd  e4  eb  f2  f9
05  0c  13  1a  21  28  2f  36  3d  44  4b  52  59  de  e5  ec  f3  fa
06  0d  14  1b  22  29  30  37  3e  45  4c  53  5a  df  e6  ed  f4  fb

$ dir -ll /mnt/test/restic/data/4d
total 59264
-rw-------. 1 root root 4293329 Apr  2 23:41 4d06b39457ac14fae03283053f740aaa5ede79f70feeb81c543e95dd9b5b6cac
-rw-------. 1 root root 4388799 Apr  2 23:44 4d2754d139e34942eaed642a3091fff48b2353652086c9c41ed9294baa608ade
-rw-------. 1 root root 5644335 Apr  2 23:40 4d80d87fe90cc35636ecf7c00efacb92b833a65642aebe85a20abb3e575e8b39
-rw-------. 1 root root 4400741 Apr  2 23:42 4d9d312e24e30e24426c8598e4be79a242f9167de6a5164742ad2f90899884e1
-rw-------. 1 root root 5117208 Apr  2 23:46 

# these chunks are encrypted/gibberish
```

This means that Restic backups secured with sufficiently complex passwords cannot be decrypted by Rest Server admin.

Still, we should secure the system running Rest Server:

- Restic can be deployed to run as dedicated user without login
  - Use a non-root account (unlike in my example above)
  - You may deploy Rest Server in Docker with non-privileged access
  - On Restic clients Restic can generate job logs and it should be wrapped in non-naive wrapper script that properly logs successful and failed runs
  - Forward system and Restic logs (and other, of course) to a centralized SIEM environment
- On Rest Server's service network, allow access only on service port (e.g. 80 for HTTP, 443 for HTTPS)
  - Proper FQDN and valid TLS certificate are required for secure HTTPS
- Monitor Rest Server for failed authentication attempts and clients for failed backup jobs
  - Use the --private-repos flag on Rest Server
  - With an NGINX TLS-terminating reverse proxy with WAF in front of Rest Server, you could precisely control which Restic account can connect from which source IP or FQDN
  - The --append-only flag is available but of limited effectiveness
- On Rest Server's management network, limit SSH access to Rest Server and possibly use MFA
  - E-Series (SANtricity OS) management network could be on a separate management network/VLAN
- Set up end-to-end logging to monitor restic logs from clients, Rest Server and even E-Series (SANtricity)

If you don't mind to manage multiple volumes (which I think would be required to properly segregate access), it's possible to setup multiple Rest Server instances for different internal organizations (teams, workloads), and expose each on a different IP and VLAN. (This is the only  case that I can think of where it may be helpful to run Rest Server instances in containers on that bare metal or VM box - it's easy to set them up and tear down, and limit each instance's resources, and avoid mistakes during repeated manual provisioning in complex environments where security is important.)

[E-Series SANtricity Ansible modules](https://docs.ansible.com/ansible/latest/collections/netapp_eseries/santricity/index.html#plugins-in-netapp-eseries-santricity) may come useful here if you need to configure and maintain more than half a dozen users (and volumes on E-Series) and restic-server instances. You could use DDP instead of RAID6 as the base for these volumes.

Restic restores are easy to perform. You can see them in Velero/Restic, solidbackup and other demos out there. I'll just highlight the fact that all you need is that Rest Server URL and credentials (if access to Rest Server is protected) to restore data. Obviously, Restic backup to S3 gives you more flexibility (you restore from any site, even [from the cloud](/2021/05/08/revisiting-solidbackup.html#restore-from-s3)), but Rest Server can do that as well if you expose it externally (say via NGINX reverse proxy, mentioned earlier).

## E-Series 

What use E-Series here? Why not just use LVM with JBOD? Some reasons:
- reliability
- performance (including during rebuild)
- security
- manageability

Earlier I mentioned some users want to use E-Series as a way to lower costs compared to distributed object stores that may require multiple appliances. One can go even further and use a JBOD, but if you want backups and restores to work and work well, that may not necessarily be cheaper. And when management overhead is added to that, it can turn out to be more expensive. So E-Series is often used over JBODs and S3 storage because it's cost-effective without cutting corners.

E-Series can reliably create arbitrarily large volumes and [quickly recover from multiple disk failures](/2021/01/04/elasticsearch-on-netapp-h615c-ef280.html#elasticsearch-data-protection-with-ef-series) (especially with DDP).

And even though users are in charge of ensuring security of their own backups - as long as they don't share the password used to encrypt their backup - we need to consider the risk of the Restic client being taken over. 

There's no feature to prevent Restic server or client takeover from E-Series, but we can use some E-Series features to decrease the risk of data loss when that happens to Restic server.

The first thing we can do to protect the volume used to create a snapshot schedule on E-Series.

Notice that this is done in the SANtricity (E-Series storage OS) Web UI, which is not accessible to Rest Server VM/BM server. We may be able take filesystem snapshots host-side, but if the attacker gains access to Rest Server root account, that may not be useful. SANtricity, on the other hand, has [excellent security](https://www.netapp.com/pdf.html?item=/media/17079-tr4712pdf.pdf) and out-of-band management.

![Create snapshot schedule on E-Series](/assets/images/restic-server-e-series-01.png)

Second, we can reserve some volume capacity for snapshots, to minimize administrative hassle. If our daily change rate is 2.5% and we plan to keep 7 daily snapshots (2.5 * 7 = 17.5%) we can reserve 20% of volume capacity. My volume size is 200GB so that reserve is 40GB.

![Reserve volume capacity for snapshots](/assets/images/restic-server-e-series-02.png)

Separately - in a Grafana instance that monitors SANtricity or elsewhere - I could create an alert for Rest server's disk capacity utilization >= 150GB (because in this scenario at 160GB SANtricity's 200GB volume could become full). Alternatively, we could also use SANtricity-side alerts which can be received through SNMPv3, for example. 

Third, we can customize this behavior.

At the top of the screenshot below we choose to keep 7 daily snapshots as planned, and at the bottom we choose what to do if we miss to react on "low capacity remaining" alerts.

Now, I did **not** choose to reject writes to Restic LUN, but you could choose that if you wanted to prevent a scenario in which an attacker gains control of a Restic client's password or credentials required to access Rest Server (if either is hard coded or otherwise available on the client) and repeatedly runs Restic backup jobs with the purpose to rotate-out Restic backups or E-Series LUN snapshots, or even wipes (re-initializes) the entire repository.

![SANtricity Reserved Snapshot Capacity setting](/assets/images/restic-server-e-series-03.png)

Obviously, there are two strategies (and multiple scenarios) here. What I selected would not prevent the purging of existing snapshots, but it would take days to purge all snapshots because they are taken daily. Also - notice that Activate/Suspend button - if we realized we're under attack, we could Suspend that snapshot schedule before it's too late.

If we elected to reject new writes and "lock" snapshots in, that would work for that, but it would also prevent Restic users from taking additional backups during infestation, which may or may not be desirable. Teams that monitor their infrastructure well and can spot an intrusion within hours could consider that to be a good option. 

With that, my daily snapshot schedule for volume used by Rest Server in in place.

![Active SANtricity snapshot schedule](/assets/images/restic-server-e-series-04.png)

We could stop Rest Server at 11:59pm and start it at 12:01am to get a 100% consistent snapshot at midnight without quiescing the VM. Another approach - if Rest Server runs in a VM and its E-Series volume is not a RDM but a VMFS datastore - is to take a quiesced VM snapshot with VM RAM saved to disk at 11:59, and delete it the next day before doing this again.

This lets you get a consistent snapshot from a two-step restore (first restore volume from a snapshot, then restore the VM from a VM snapshot).

If needed, we can manually create SANtricity snapshots on-demand by clicking on the Create (snapshot) button:

![Create SANtricity snapshot](/assets/images/restic-server-e-series-08.png)

To delete a SANtricity snapshot:

![Delete SANtricity snapshot](/assets/images/restic-server-e-series-09.png)

Four, SANtricity supports MFA and SAML 2.0 so organizations can limit access to SANtricity features based on RBAC. (You may read about it in the SANtricity security-related PDF linked earlier). For scheduled rolling snapshots no login or manual deletion would be required.

### Dealing with the risk of storage-side snapshot rotation

This deserves a few additional comments.

Note that the dialog box related to snapshot reserve capacity says "Policy for *full reserved capacity*". I haven't tested this, but I'm pretty sure that merely deleting (re-initializing a repo or doing a `sudo rm -rf /mnt/restic-server-data`) if Rest Server's filesystem mount setting doesn't have `discard` enabled would *not* invalidate snapshots when Purge is selected. 

Rest Server's filesystem data would have to be overwritten for changes to register in SANtricity's change tracker. If your SANtricity volume isn't thin-provisioned and filesytem discard is not enabled, the attacker would have to rewrite a significant amount of volume which would result in a surge in writes that can be easy to spot *on E-Series SANtricity* performance (not necessarily on the network or clients, if the attacker is writing from Rest Server itself). 

SANtricity performance can be monitored with SNMP, [Grafana](https://github.com/NetApp/eseries-perf-analyzer) and more. Once you have that in place, set IO surge alerts. Even if the attacker deleted repo contents and enabled `discard`, or even tried to encrypt (the encrypted) restic backups, it'd take some time to discard (or encrypt) that data. Meanwhile, *client-side restic backup jobs would start failing* because the repo would be damaged.

So "Purge oldest snapshot image" may not necessarily be a very risky approach, but you can certainly choose the more conservative "Reject writes to base volume" which is similar to what ONTAP 9.10 can do automatically if it figures there's something funny happening on its file shares. If you go with this option, maybe have a fallback destination (say, S3 in the public cloud) where users can backup to in the case your environment is under attack and Rest Server rejects new writes.

### Storage efficiency

As mentioned earlier, Restic does not deduplicate data across user accounts (which is why solidbackup by design uses just one account).

As most users would probably use multiple accounts (per application, or per team/department), this would result in lower data efficiency.

We also mentioned that backups are encrypted client-side, which means there's little hope of getting any "storage efficiency" with storage-side deduplication and compression. E-Series doesn't implement storage-side deduplication or compression, so that won't consume resources on trying to compress or dedupe data on volumes used by restic-server.

This approach usually translates to a lower efficiency (i.e. higher backup storage utilization) than with modern enterprise backup software which tends to deduplicate globally, and the loss of ability for backup administrators to look for files by name and date (Restic provides this feature from the client, which can decrypt its repository data and query it).

But this approach with E-Series lowers risks associated with penetration of backup/media server or insider threats related to access to backup server. As long as the user doesn't leak their own password or have it stolen, there's no other way data to access data from a Restic backup. This also means that you can easily replicate this data to a remote untrusted environment, either by using E-Series storage replication, or by cloning E-Series volumes, presenting them to an rsync server and copying data to another location.

Storage configuration-wise this means you don't need SSDs for restic-server (see the big size of chunks in /mnt/test/restic/data/4d, above). E-Series with HDDs is a fast and economical back-end for restic-server.

### Thin vs thick SANtricity volumes

Normally Restic server would use (thick) volumes on SANtricity RAID6 and - because we don't care about unmap - discard wouldn't be necessary.

Thin volumes are available on DDP style protected disk groups (pools). To rethin thin volumes `discard` or equivalent would be required.

[Check the docs](https://docs.netapp.com/ess-11/index.jsp?topic=%2Fcom.netapp.doc.ssm-cli-115%2FGUID-BD9A17EF-4B4F-463F-AB5F-46679EA974B8.html) for advantages and disadvantages of each approach. 

Related to Restic server, DDP and thin volumes may be advantageous in multi-server environments, such as when one runs a bunch of containerized Restic server instances managed by different teams. In an environment that has a handful of Restic servers, I'd go with RAID6 and thick volumes. Make sure you also consider the snapshot policy and the role of the `discard` filesystem mount option mentioned earlier.

## Limiting backup window

I don't know if that's a viable measure, but some people ask for that. 

With Rest Server and E-Series we could use a scheduler to start Rest Server daily at 00:05 (that is, minutes after my SANtricity snapshot was taken), and stop it at 08:00am.

A problem with this is Rest Server would still be accessible for many hours every day, and Rest Server administrator would have to assist in attempts to restore data outside of backup window.

If multiple Rest Server instances are used and the administration of those instances is delegated to teams, this may be viable as every instance administrator probably wouldn't get many requests (especially if - for example - your primary data resides on SolidFire or other array which can easily take a snapshot every 15 minutes and retain it for 1-2 hours, restores from Rest Server should be rare).

Another helpful trick may be performance alerts as a proxy indicator of unusual activity on Rest Server. To configure those in Grafana, watch your normal activity and configure an alert above that. Some SIEM platforms such as [Elasticsearch](/2021/01/04/elasticsearch-on-netapp-h615c-ef280.html) could watch Rest Server and E-Series system activity for other unusual indicators and have ML plugins that may be able to automatically find the right level of unusual activity to create alerts.

E-Series is an [ideal](/2022/03/06/elastic-elk-stack-on-netapp.html#elasticsearch-and-netapp-storage-systems) storage back-end for Elasticsearch and could use the same E-Series system that you use for Rest Server. Obviously, we'd use another host (not Rest Server) and possibly a different RAID disk group or DDP pool to run Elasticsearch.

## Other use cases

Some readers may be familiar with the fact that the E-Series team maintains a CSI driver for BeeGFS.

BeeGFS filesystems tend to be large, and Restic is single-threaded, but if BeeGFS Persistent Volumes are not huge or don't have many small files, Velero/Restic could be used to backup these PVs to Rest Server. I haven't tried this yet, so I can't provide specific recommendations at this time.

## Summary

Restic and Rest Server are popular and reasonably proven tools that can help you protect your data. At the same time they can be more labor-intensive to deploy and manage if you do not use automation.

Restic can backup data to S3 - and indeed, we could run StorageGRID or MinIO in VMs that consume E-Series storage and get some S3 features - but if you want simplicity and low cost, consider the approach described here.

NetApp E-Series provides several features - secure access, RBAC, scheduled snapshots, quick recovery (DDP), automation - that add value to this approach.

Additionally, E-Series delivers enough performance and features to host other critical infrastructure storage services (monitoring, logging, enterprise backup applications) that benefit from running in a segregated environment and a separate storage array. Like I said the other day, the advice to backup Kubernetes PVs to S3 containers running on the same Kubernetes cluster may not be the greatest way to protect your data.
