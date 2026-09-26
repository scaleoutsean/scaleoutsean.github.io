# Velero 1.10 with NetApp Trident and SolidFire

Velero 1.10 with NetApp Astra Trident v23.01 and SolidFire 12.5

Velero 1.10 came out recently so I tried it with Kubernetes v1.26.1, Trident v23.01, and SolidFire 12.5.

tldr; 

- CSI backup works as it used to
- File-based backup works as well

The main changes in Velero 1.10 are the addition of Kopia (also used by Kasten) and improvements in the robustness of CSI plugin.

I ran several backup jobs on InfluxDB from E-Series Performance Analyzer project.

The first two were CSI and the last two were file (Restic and Kopia, respectively):

```
$ velero get backups
NAME                 STATUS            ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
epa-csi-backup       PartiallyFailed   1        0          2023-02-17 06:56:46 +0000 UTC   29d       default            <none>
influxdb             PartiallyFailed   1        0          2023-02-16 17:55:41 +0000 UTC   29d       default            <none>
influxdb-fsb         Completed         0        0          2023-02-16 18:09:14 +0000 UTC   29d       default            <none>
influxdb-fsb-kopia   Completed         0        0          2023-02-17 06:49:15 +0000 UTC   29d       default            <none>
```

## CSI

It worked, but the first two CSI jobs completed with "Partially Failed".

```sh
$ velero backup logs epa-csi-backup | grep error
time="2023-02-17T06:57:00Z" level=info msg="1 errors encountered backup up item" backup=velero/epa-csi-backup logSource="pkg/backup/backup.go:421" name=influxdb-7c94cc88cd-bzgwp
time="2023-02-17T06:57:00Z" level=error msg="Error backing up item" backup=velero/epa-csi-backup error="daemonset pod not found in running state in node trident"

```

Detailed backup job log reports that everything was backed up:

```
time="2023-02-17T06:57:00Z" level=info msg="Backed up 28 items out of an estimated total of 28 (estimate will change throughout the backup)" backup=velero/epa-csi-backup logSource="pkg/backup/backup.go:388" name=influxdb-lkqmx namespace=epa progress= resource=endpointslices.discovery.k8s.io
time="2023-02-17T06:57:00Z" level=info msg="Backed up a total of 28 items" backup=velero/epa-csi-backup logSource="pkg/backup/backup.go:413" progress=

```

Restores worked as well (delete the EPA namespace, restore).

```sh
$ velero get restores
NAME                            BACKUP           STATUS      STARTED                         COMPLETED                       ERRORS   WARNINGS   CREATED                         SELECTOR
epa-csi-backup-20230217070813   epa-csi-backup   Completed   2023-02-17 07:08:13 +0000 UTC   2023-02-17 07:08:14 +0000 UTC   0        3          2023-02-17 07:08:13 +0000 UTC   <none>
epa-csi-backup-20230217070902   epa-csi-backup   Completed   2023-02-17 07:09:02 +0000 UTC   2023-02-17 07:09:03 +0000 UTC   0        1          2023-02-17 07:09:02 +0000 UTC   <none>

```

If everything is configured as per the Velero and Trident documentation, a snapshot is taken on backup. The volume:

![Velero Trident-managed CSI PVC](/assets/images/velero-1-10-csi-backup-trident-01.png)

The snapshot:

![Velero CSI snapshot of Trident-managed PVC](/assets/images/velero-1-10-csi-backup-trident-02.png)

CSI backup data looks good and each of two restores completed, so that error seemed cosmetic.

![Velero 1.10 CSI backup content](/assets/images/velero-1-10-csi-backup-trident-03.png)

It seems the error can avoided by specifying to use node agent when installing Velero. With node agent installed, backup status was Completed, and there were no warnings:

```
$ velero get backups
NAME                             STATUS            ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
epa-csi-backup                   PartiallyFailed   1        0          2023-02-17 06:56:46 +0000 UTC   29d       default            <none>
epa-csi-backup-daemonset-agent   Completed         0        0          2023-02-17 08:30:51 +0000 UTC   29d       default            <none>
```

I'd almost call the error cosmetic, but without node agent there's 28 items in a backup, and with there's 34. I didn't try to find what's different, but it's safe to say "it's better to install node agent than worry".

```yaml
Storage Location:  default

Velero-Native Snapshot PVs:  auto

TTL:  720h0m0s

CSISnapshotTimeout:  2m0s

Hooks:  <none>

Backup Format Version:  1.1.0

Started:    2023-02-17 08:30:51 +0000 UTC
Completed:  2023-02-17 08:31:04 +0000 UTC

Expiration:  2023-03-19 08:30:51 +0000 UTC

Total items to be backed up:  34
Items backed up:              34

Velero-Native Snapshots: <none included>

```

CSI backups of InfluxDB and other objects helped me recover from a deleted namespace both when node agent was installed and when it wasn't.

![Velero CSI restore with node agent](/assets/images/velero-1-10-csi-backup-trident-04.png)

## File-based backup

You either need to install Velero without CSI plugin or override CSI for select jobs.

There's not much to say about it - it works. Restic and Kopia backups are saved to independent paths in the bucket.

![File backup in S3 repository](/assets/images/velero-1-10-file-backup-trident.png)

I may do some performance testing and comparison between the two, but that's not specific to Velero, Kubernetes, Trident, or SolidFire and there's a lot of (non-Kubernetes) comparisons out there already, so there isn't much value in that.

## Conclusion

Apart from what appears to be a cosmetic error with CSI backup (and which goes away if node agent is deployed), everything works the same way as before.

Those having problems with Restic may want to upgrade to 1.10+ to switch to Kopia.
