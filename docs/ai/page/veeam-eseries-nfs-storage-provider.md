# Store Kasten backups on NetApp E-Series

How to leverage E-Series for both Veeam and Kasten backup destination

- [Backup repository choices for Kasten with E-Series](#backup-repository-choices-for-kasten-with-e-series)
- [Veeam Repository](#veeam-repository)
- [S3 bucket](#s3-bucket)
- [NFS share](#nfs-share)
- [Which one to use?](#which-one-to-use)
  - [Cost and performance](#cost-and-performance)
  - [Security](#security)

## Backup repository choices for Kasten with E-Series 

Many Veeam users use E-Series. There's a NetApp Technical Report for it, currently a copy can be found [here](https://www.netapp.com/pdf.html?item=/media/79436-tr-4948.pdf).

How about Kasten K10 and Kubernetes?

Also very easy: pick any of the following.

- E-Series as Veeam Repository
- S3 bucket on Linux backed by E-Series
- NFS share on Linux backed by E-Series

## Veeam Repository

If you have Veeam and E-Series, you probably have a Veeam Repository. 

Simply use it from Kasten. That's it.

## S3 bucket

E-Series doesn't have its own S3 server, so we need one. Common approaches:

- Use StorageGRID S3 appliances (suitable for enterprise use, based on E-Series, Veeam certified including for [Object Lock](https://www.youtube.com/watch?v=e79AsPa4FAA))
- Use 3rd party S3 server such as  (can be set up for free)
- Use 3rd party S3 server such as  (can be set up for free) (**UPDATE:** consider Versity S3 Gateway instead - see an example with Kasten 8.5.8 [here](/2026/05/12/veeam-kasten-santricity-csi-netapp-eseries.html))

I've blogged about MinIO with E-Series on several occasions, also about StorageGRID with Kasten. Use search at the top of the page to find those.

## NFS share

This is a new one, which I haven't had a chance to try before.

Today I played with Kasten version 5.5.4 so I thought to give this a try.

The way it works a volume (we'd probably use [DDP](/2021/07/06/e-series-ddp-expansion-and-rebalancing.html) rather than RAID 6) is created and presented to a Linux host - it can be a VM that gets its HA from VI (vSphere, for example).

For lower cost and enterprise support, use Rocky Linux or Ubuntu LTS. 

Format the device and export it to Kubernetes worker IPs using Linux NFS server.

On Kubernetes, create a PVC for the Kasten namespace:

![NFS PVC](/assets/images/kasten-eseries-nfs-repo-00.png)

Also create a PV from that NFS share:

![NFS PV](/assets/images/kasten-eseries-nfs-repo-01.png)

When Kasten repository is being configured, pick NFS. This is where one can alternatively select S3 or Veeam Repository.

![Kasten repository choices](/assets/images/kasten-eseries-nfs-repo-04.png)

Once the PVC is provided, location profiles should show this NFS repository.

![Kasten 5 location profiles](/assets/images/kasten-eseries-nfs-repo-02.png)

Veeam backups now can be exported to this NFS repository.

![Exported Kasten backup](/assets/images/kasten-eseries-nfs-repo-03.png)

On the NFS server (export: /data/nfs/dump) backup data is saved to k10/{cluster-id} on the share.

```sh
$ sudo dir -laR /data/nfs/dump/k10/57eadc84-23bc-4c1b-9c27-6a4138d8bf80
/data/nfs/dump/k10/57eadc84-23bc-4c1b-9c27-6a4138d8bf80:
total 12
drwx------ 3 root root 4096 Feb  9 10:36 .
drwx------ 3 root root 4096 Feb  9 10:36 ..
drwx------ 4 root root 4096 Feb  9 10:36 migration

/data/nfs/dump/k10/57eadc84-23bc-4c1b-9c27-6a4138d8bf80/migration:
total 16
drwx------ 4 root root 4096 Feb  9 10:36 .
drwx------ 3 root root 4096 Feb  9 10:36 ..
drwx------ 3 root root 4096 Feb  9 10:36 export-1675938973343468321
drwx------ 3 root root 4096 Feb  9 10:36 repo
...
```

If LVM is used, snapshots can be scheduled on Linux OS, and independently of that storage snapshots can also be scheduled on E-Series as well (how to choose the right options for various security considerations, see [here](/2022/04/03/restic-server-netapp-eseries.html)).

That's decent enough, but not as good as S3 Object Lock, or ransomware protection available on ONTAP NFS, for example. But it is very affordable and "reasonably" secure from ransomware.

## Which one to use?

It really depends, so I won't deep dive into all scenarios and considerations.

Some rules-of-thumb the way I see them are below.

### Cost and performance

Cost-of-performance-wise Veeam Repository may be the best (my guess based on the fact that it has storage efficiencies, so one could save approximately 50% of capacity cost when compared to NFS, and maybe 75% when compared to S3).

Cost-of-throughput-wise, MinIO may be the fastest, especially if you use the community edition of MinIO. See a sample run of MinIO on E-Series [here](/2022/10/21/minio-performance-netapp-e-series.html).

Cost-of-capacity-wise, I suspect that for large repositories Veeam Repository would be better than NFS, but for small environments (under 50TB) Linux NFS server would have the lowest cost and (single instance, where there's no EC overhead) of free MinIO would be similar.

Assuming 8 hour backup window:

- At 1 GB/s (NFS repository on a 4 CPU VM), backup 28TB in 8 hours
- At 2 GB/s (single MinIO instance), bakcup 50 TB in 8 hours
- At 5 GB/s (medium-sized scale-out Veeam backup repository), 144 TB in 8 hours (and that's after reduction, so probably 300TB on front-end, before global (repo-wide) deduplication and compression)

E-Series has excellent sequential performance, so it's suitable for frequent export runs. Exporting a 10 GB backup can take only seconds, which means it can be done frequently (hourly, for important data) as long as you set your retention carefully to expire old backups and avoid filling up the repository.

There's an example [here](/2020/12/30/netapp-hci-ef280-diskspd-for-backup.html#vmfs-vs-raw-devices) that shows how a 75 GB database can be fully restored in under a minute. The same post has several [examples](/2020/12/30/netapp-hci-ef280-diskspd-for-backup.html#appendix-configuration-and-diskspd-logs) of DiskSpd runs with EF280 (older E-Series entry-level flash model, since replaced by EF300) which may be interesting to Veeam users interested in leveraging Veeam Repository for Kasten.

### Security

Here I'd vote for S3 (features, convenience) and with StorageGRID it can also be multi-site active with read-write access from every site - here replication is done by StorageGRID. 

With MinIO it would probably be better to use Veeam to make another backup to a separate MinIO/E-Series cluster at a DR location.

Similarly, a Veeam Repository can be replicated by [Veeam BR](https://www.veeam.com/vm-advanced-replication.html), so with E-Series you could have one E-Series per site, and use Veeam to take care of replication. Veeam BR's backup repository best practices can be found [here](https://bp.veeam.com/vbr/2_Design_Structures/D_Veeam_Components/D_backup_repositories/).

NFS shares on Linux VMs that rely on VI for HA would likely work fine for a single site, but wouldn't have a good defense against ransomware, so even with Linux and/or E-Series snapshots, it'd be wise to also export all backups to another location where this risk be addressed or lessened (either another NFS or S3 or Veeam Repository).

Having tried all three (Veeam Repository I tried only from Veeam), NFS is the easiest and simplest to use and maintain. But if you're already using Veeam, then there's no extra maintenance or new security concerns to going with Veeam Repository.
