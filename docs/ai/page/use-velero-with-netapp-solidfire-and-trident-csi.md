# Use Velero CSI Plugin with NetApp SolidFire and NetApp Trident 21.01

Backup your K8s apps and data on NetApp HCI and SolidFire with Velero

## tldr

Using CSI Plugin (currently still in beta) Velero v1.5.3 can help protect Kubernetes apps and data on NetApp HCI or SolidFire (meaning, it can schedule and take Trident/SolidFire snapshots as well as backup application settings and data to a S3-compatible provider such as NetApp StorageGRID).

Since this support is currently in beta, on its own Velero is not suitable for enterprise use with SolidFire, but combined with native Trident/SolidFire snapshots it makes manual data protection tasks easier. If you're looking for a non-CSI approach with SolidFire, see [this brief post](/2021/02/02/use-velero-with-netapp-storagegrid.html) for Velero with Restic and SolidFire.

## Install Velero with CSI feature

Check the Trident, Velero, and AWS Provider (for S3-related stuff) documentation. If you're running a more recent Trident CSI, you'll probably need newer versions of various components including, but not limited to, Kubernetes external snapshotter.

```sh
$ velero install \
    --features=EnableCSI \
    --plugins velero/velero-plugin-for-csi:v0.1.2 \
    ...
```

I also used AWS S3 plugin and configured `--backup-location-config` to point to a NetApp StorageGRID bucket. I blogged about that in a [recent post](/2021/02/02/use-velero-with-netapp-storagegrid) so I won't repeat those details in this post.

Significant differences compared to the earlier backup-related post featuring snapshots (that one was about [Kasten K10](/2020/12/21/kasten-rancher-netapp-hci-solidfire-k8s-backup)):

- Kubernetes Volume Snapshot v1 (backward compatible with v1beta1)
- Velero v1.5.3 with CSI plugin (currently still in beta) v0.1.2

## Backup

Velero CSI plugin can create SolidFire snapshots for you. You can see stuff like this in Velero logs:

```raw
time="2021-02-08T06:42:08Z" level=info msg="volumesnapshot class=csi-trident" backup=velero/nginx-backup cmd=/plugins/velero-plugin-for-csi logSource="/go/src/velero-plugin-for-csi/internal/backup/pvc_action.go:112" pluginName=velero-plugin-for-csi
time="2021-02-08T06:42:08Z" level=info msg="Created volumesnapshot nginx-example/velero-nginx-logs-59hqz" backup=velero/nginx-backup cmd=/plugins/velero-plugin-for-csi logSource="/go/src/velero-plugin-for-csi/internal/backup/pvc_action.go:142" pluginName=velero-plugin-for-csi
time="2021-02-08T06:42:08Z" level=info msg="Backing up item" backup=velero/nginx-backup logSource="pkg/backup/item_backupper.go:121" name=velero-nginx-logs-59hqz namespace=nginx-example resource=volumesnapshots.snapshot.storage.k8s.io
time="2021-02-08T06:42:08Z" level=info msg="Executing custom action" backup=velero/nginx-backup logSource="pkg/backup/item_backupper.go:327" name=velero-nginx-logs-59hqz namespace=nginx-example resource=volumesnapshots.snapshot.storage.k8s.io
time="2021-02-08T06:42:08Z" level=info msg="Executing VolumeSnapshotBackupItemAction" backup=velero/nginx-backup cmd=/plugins/velero-plugin-for-csi logSource="/go/src/velero-plugin-for-csi/internal/backup/volumesnapshot_action.go:58" pluginName=velero-plugin-for-csi
```

Seen from kubectl (not necessarily from the same run):

```sh
$ kubectl get volumesnapshot -n nginx-example
NAME                      READYTOUSE   SOURCEPVC    SOURCESNAPSHOTCONTENT   RESTORESIZE   SNAPSHOTCLASS   SNAPSHOTCONTENT                                    CREATIONTIME   AGE
velero-nginx-logs-59hqz   true         nginx-logs                           1Gi           csi-trident     snapcontent-1f2caa8a-543a-42fd-bcaf-a38c0e713faf   18m            18m
```

And also on SolidFire:

```powershell
PS > Get-SFSnapshot

SnapshotID              : 408
VolumeID                : 192
Name                    : snapshot-1f2caa8a-543a-42fd-bcaf-a38c0e713faf
Checksum                : 0xf2a1e04b664428f8
EnableRemoteReplication : False
ExpirationReason        : None
ExpirationTime          : 
RemoteStatuses          : 
Status                  : done
SnapshotUUID            : b122e0e9-8a47-4697-b74b-3f636dce00b8
TotalSize               : 1073741824
GroupID                 : 0
GroupSnapshotUUID       : 00000000-0000-0000-0000-000000000000
CreateTime              : 2021-02-08T06:42:08Z
InstanceCreateTime      : 2021-02-08T06:42:08Z
VolumeName              : pvc-2f361c68-cfef-41ae-83b3-01990187d061
InstanceSnapshotUUID    : b122e0e9-8a47-4697-b74b-3f636dce00b8
VirtualVolumeID         : 
Attributes              : 
SnapMirrorLabel         : 
```

Application backup according to Velero:

```sh
$ velero backup describe nginx-backup
Name:         nginx-backup
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/source-cluster-k8s-gitversion=v1.19.7
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=19

Phase:  Completed

Errors:    0
Warnings:  0

Namespaces:
  Included:  *
  Excluded:  <none>

Resources:
  Included:        *
  Excluded:        <none>
  Cluster-scoped:  auto

Label selector:  app=nginx

Storage Location:  default

Velero-Native Snapshot PVs:  auto

TTL:  720h0m0s

Hooks:  <none>

Backup Format Version:  1.1.0

Started:    2021-02-08 06:42:03 +0000 UTC
Completed:  2021-02-08 06:42:13 +0000 UTC

Expiration:  2021-03-10 06:42:03 +0000 UTC

Total items to be backed up:  10
Items backed up:              10

Velero-Native Snapshots: <none included>

CSI Volume Snapshots:  2 included (specify --details for more information)
```

If we get the details of those CSI snapshots, we might see something like this:

```
CSI Volume Snapshots:
Snapshot Content Name: snapcontent-17c33032-f85c-4ad0-b0cd-6b77ecc75bc1
  Storage Snapshot ID: pvc-b2d964f9-dbb5-414a-bb7d-7033d099ce27/snapshot-17c33032-f85c-4ad0-b0cd-6b77ecc75bc1
  Snapshot Size (bytes): 1073741824
  Ready to use: true
Snapshot Content Name: snapcontent-1f2caa8a-543a-42fd-bcaf-a38c0e713faf
  Storage Snapshot ID: pvc-2f361c68-cfef-41ae-83b3-01990187d061/snapshot-1f2caa8a-543a-42fd-bcaf-a38c0e713faf
  Snapshot Size (bytes): 1073741824
  Ready to use: true
```

I haven't discovered a way to use snapshot information (or data) from Velero backups. It could be that Velero expects they're available (to read or mount) which is not the case with SolidFire snapshots (they need to be cloned before they can be used), or it could be that it simply isn't smart about non-vSAN snapshots. Either way, it's not a deal breaker for non-enterprise users as we shall see later.

## Restore

 If you nuke an app (or the namespace that contains it) but the volume remains, on restore volume and its snapshot causes a warning like this:

```sh
$ velero restore describe nginx-backup-20210208063937
Name:         nginx-backup-20210208063937
Namespace:    velero
Labels:       <none>
Annotations:  <none>

Phase:  Completed

Started:    2021-02-08 06:39:37 +0000 UTC
Completed:  2021-02-08 06:39:40 +0000 UTC

Warnings:
  Velero:     <none>
  Cluster:  could not restore, volumesnapshotcontents.snapshot.storage.k8s.io "snapcontent-bcd021f1-0ce2-412b-8324-efad9ede4598" already exists. Warning: the in-cluster version is different than the backed-up version.
            could not restore, persistentvolumes "pvc-0b51d0a1-5028-41b9-9773-885bf59ea2c4" already exists. Warning: the in-cluster version is different than the backed-up version.
```

If you delete an app, Velero 1.5.3 with CSI plugin recreates resources such as namespace, service, PVC, and Trident CSI responds to that by assigning a new PV (although the old one remains, in the `Released` state). `velero restore` allows you to `--exclude-resources` such as `persistentvolumes,volumesnapshotcontents` but I couldn't get this to behave the way I expected and/or consistently.

Some of these problems are known issues and I noticed consistency in certain problems (some of which I could duplicate and find in Velero issues on Github).

If an app, PVC and PV are all deleted, `velero restore` can re-create everything from scratch, but I did not make sure if the backup content from PV was properly restored to new PV. It's supposed to be, but obviously we'd want to know that before using it in production. In some cases `kubectl` reported the PVC was `Bound` but the PV wasn't even created.

One of the reasons I didn't verify restores was if we delete an app and its PVC, Trident CSI leaves the PV in `Released` state, and it should have at least one snapshot, too (assuming we used CSI snapshots). That means we can always get to our data (either reuse the volume, or clone the snapshot and import it to Kubernetes): if Velero correctly restored only service, deployment and other resources excluding PV data, that in itself should be quite helpful because SolidFire snapshots, clones and remote replicas deliver good data protection.

In fact we can download Velero backup manifest and see what's in it.

```sh
$ tar fzvx nginx-backup-data.tar.gz 
metadata/version
resources/persistentvolumes/v1-preferredversion/cluster/pvc-bff0a51f-1430-4beb-96d4-1fe668031b66.json
resources/persistentvolumes/cluster/pvc-bff0a51f-1430-4beb-96d4-1fe668031b66.json
resources/persistentvolumeclaims/v1-preferredversion/namespaces/nginx-example/nginx-logs.json
resources/persistentvolumeclaims/namespaces/nginx-example/nginx-logs.json
resources/pods/v1-preferredversion/namespaces/nginx-example/nginx-deployment-66689547d-7k26g.json
resources/pods/namespaces/nginx-example/nginx-deployment-66689547d-7k26g.json
resources/services/v1-preferredversion/namespaces/nginx-example/my-nginx.json
resources/services/namespaces/nginx-example/my-nginx.json
resources/endpoints/v1-preferredversion/namespaces/nginx-example/my-nginx.json
resources/endpoints/namespaces/nginx-example/my-nginx.json
resources/namespaces/v1-preferredversion/cluster/nginx-example.json
resources/namespaces/cluster/nginx-example.json
resources/replicasets.apps/v1-preferredversion/namespaces/nginx-example/nginx-deployment-66689547d.json
resources/replicasets.apps/namespaces/nginx-example/nginx-deployment-66689547d.json
```

From file names (pvc-bff0a51f-1430-4beb-96d4-1fe668031b66.json) it's easy to tell PV name, and if we look inside of these files we can find other useful details:

```raw
"resources":{"requests":{"storage":"1Gi"}},
"storageClassName":"solidfire-silver",
"volumeMode":"Filesystem",
"volumeName":"pvc-bff0a51f-1430-4beb-96d4-1fe668031b66"},
"status":{"accessModes":["ReadWriteOnce"],"capacity":{"storage":"1Gi"},"phase":"Bound"}}
```

With that we can easily find which volume (or snapshot) can be used to restore data from a storage-side backup (SolidFire snapshot or existing volume, which can be cloned).

This approach is currently used by some users who have similar problems (example: create a PVC first, followed by a Velero restore).

## Conclusion

Velero's CSI feature, even in beta, is useful because it can schedule your Trident CSI snapshots and at the same time backup application settings to a remote location (similar to Rancher snapshots I wrote about [here](/2021/02/01/backup-rancher-on-hci-to-storagegrid-s3.html)).

While Velero currently isn't production-ready for use with CSI storage (at least not with NetApp SolidFire), there may be situations where division of labor (or automation, as the case may be) can be put in place so that both Velero and NetApp Trident/SolidFire (snapshot, clone, import) features are used to make the job of data protection easier.

Additional investigation is required to better understand (or maybe TFM is clear and it's just me?) backup and restore behavior in various situations:

- Backup with and without CSI support
- Backup with and without Restic support
- Restore with CSI support when PVC is, and is not, deleted
- Restore with CSI support when PVC and PV are, and aren't, deleted
- The use of Velero exclude and include options
- The effect of "freeze" (quiesce) options
- The use of other Velero options and optimal approaches for various backup and restore scenarios

## Video demo

Find it [here](https://www.youtube.com/watch?v=6RrlK2rmk24).

## Notes

- Kubernetes v1.19.7
  - Kubernetes Volume Snapshot v1
- NetApp Trident 21.01
- NetApp SolidFire 12.2 as Trident back-end
- Velero 1.5.3
  - Velero CSI v0.1.2 (beta)
  - Velero AWS plugin v1.1.0
- NetApp StorageGRID 11.4
