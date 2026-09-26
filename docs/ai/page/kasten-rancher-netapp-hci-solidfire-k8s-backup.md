# Protect your Kubernetes with Kasten and SolidFire

How Kasten leverages Netapp Trident to manage data protection on NetApp HCI and SolidFire

Rancher and other Kubernetes users want to protect their applications and data. NetApp HCI and its underlying SolidFire storage are used by NetApp Trident to provide a CSI-compatible API to Kubernetes-based orchestrators.

## Kubernetes CSI Snapshots

NetApp Trident lets Kuberntes users take snapshots and import existing volumes to Kubernetes. In order to not wipe the snapshots together with deleted parent volumes, we set Storage Classes that will support snapshot to `ReclaimPolicy` to `Retain`. Snapshots themselves do have the policy set to `Delete` because we do want them to be deleted on reclaim (so that we avoid hitting the SolidFire limit of 32 per volume, and just lessen the sprawl in any case).

Kubernetes [external snapshotter](https://github.com/kubernetes-csi/external-snapshotter) "*watches Kubernetes Snapshot CRD objects and triggers CreateSnapshot/DeleteSnapshot against a CSI endpoint*" (such as NetApp Trident.)

In the case of the snapshot feature, Kubernetes v1.20 would need a VolumeSnapshotClass such as this one:

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-trident
driver: csi.trident.netapp.io
deletionPolicy: Delete
```

We could use it to take a snapshot of PVC `db01` (again, using API v1 for K8s v1.20):

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: db01-snap01
spec:
  volumeSnapshotClassName: csi-trident
  source:
    persistentVolumeClaimName: db01
```

NetApp Trident v20.10 doesn't support Kubernetes v.1.20, but K8s v1.20 just came out and Trident will support it in next release. Check [the Trident documentation site](https://netapp-trident.readthedocs.io/) for YAML files suitable for pre-v1.20 snapshots APIs. 

SolidFire snapshots are read-only. We can use them two ways:

- Restore a volume from a snapshot - mainly for dealing with unplanned screw-ups
- Clone a volume from a snapshot - useful for DevTest, application patching and backups. Say you want to test a new application patch: make a clone from a snapshot or clone a volume (which uses snapshots on the fly) and give it a try in a test environment.

In a Kubernetes environment, you'd spin a new volume from a snapshot `db01-snap01` like this:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db01-clone-from-db01-snap01
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: solidfire-bronze
  resources:
    requests:
      storage: 3Gi
  dataSource:
    name: db01-snap01
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
```

Trident can import such volumes as long as SolidFire Volume Name is unique (so rename the volume when making a clone). 

For example a `db01` replica clone on DR site could be imported to Trident like so:

```sh
tridentctl import volume ${SOLIDFIRE-BACK-END} -f db01-dr.yaml
```

Where `db01-dr.yaml` is:

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: db01-dr
  namespace: dbaas
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: solidfire-silver
```

If we wanted to fail-over Rancher-on-NetApp HCI from Site A to Site B:

- We'd replicate data from NetApp HCI storage on Site A to NetApp HCI storage on Site B
- In the case of a site failure, we would make NetApp HCI (and SolidFire) on Site B active (meaning stop replication and convert SolidFire volumes from ReplicationTarget to Read/Write), use the SolidFire UI (or CLI or API) to create a clone from each storage snapshot, and finally on K8s workers do a rescan, and use Trident to import the clone as explained above

This isn't very hard to automate either.

## Kasten K10 + CSI Snapshots with NetApp Trident

While the above all works, sometimes you just want an nice application to take care of all that for you. Or there's a backup guy who takes care of 10 different environments and can't deep dive into the subtleties of each.

We can script our own VMware site failover, but we rarely do - we buy Cleondris HCC or VMware SRM for that. Likewise, most will want to leave backup and recovery of Rancher-on-NetApp HCI data to Veeam and Kasten - the latter makes use of CSI and other features to manage application and data protection in Kubernetes environments. (Veeam is already frequently used to protect VMware with NetAPp HCI; a demo of scale-out backup of a NetApp HCI VMware environment with Veeam can be seen [here](https://www.youtube.com/watch?v=SCzk3ZpfT-Y).)

Kasten supports NetApp Trident but thanks to the many moving parts in Kubernetes it can be tricky to get everything to work together.

First make sure Trident snapshots to work with SolidFire *without* Kasten (read the Trident documentation for that), and then annotate the Trident VolumeSnapshotClass to include the Kasten snapshot class annotation. With that you should be able to pass Kasten's pre-flight check script and deploy Kasten using Helm.

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-trident
  annotations:
    k10.kasten.io/is-snapshot-class: "true" # K10 annotation
driver: csi.trident.netapp.io
deletionPolicy: Delete
```

Then just follow the Kasten documentation [here](https://docs.kasten.io/latest/install/storage.html). 

### Things to watch out for

I may be wrong about this but it seems that - thanks to how Kubernetes CSI snapshots work (maybe there are other factors too) - one has to be careful about volume and snapshot sprawl.

For example, if your application protection policy protects a database app with a PV `db01-32428` and a "take and keep three snapshots" policy results in snapshots named db01-snap1, db01-snap2, db1-snap3, if you drop a wrong table and need to restore data from one of those snapshots:

- Kasten uses that snapshot to create a new volume (e.g. `db01-738000`)
- Kasten applies existing app protection policy to bind to the new volume

This means your `db01-32428` remains. Also its three snapshots. While new snapshots are being taken on `db01-738000` too. So now you have two db01 volumes, and each has three snapshots.

After a failed restore (due to my deliberate mistake), I ended up with three volumes (one original, one from a failed restore, and another from a successful restore), and - because they weren't cleaned - three snapshots per each of those volumes.)

- `cf0`: original volume
- `4ea`: (deliberately) failed restore attempt from a `cf0` snapshot
- `a05`: successful restore attempt from a `cf0` snapshot

![Released PVs can probably be removed](/assets/images/kasten-rancher-pv.png)

The Kasten documentation reminds to set a limit to the maximum number of snapshots per volume, but Kasten doesn't seem to have the ability to tell what should be deleted and just remove those snapshots. To be fair to Kasten, it doesn't seem obvious how they could know what should be cleaned- you'd probably have the same problem without Kasten.

In any case, if you spot too many old volumes and snapshots (screenshot below), you can remove them starting with Kasten application policies (first expire the snapshots there), followed by K8s/Trident snapshots, underlying PVs (remove PVCs first) and finally SolidFire. If you reverse this order you could end up with a mess.

![Watch out for Snapshot Sprawl](/assets/images/kasten-solidfire-snapshots.png)

It's not a big problem if you don't have hundreds of protected apps, but if you do, you'd have to pay attention and plan carefully.

Apart from volume snapshots, Kasten can also take snapshots of applications and their settings. That doesn't belong to storage provisioning, obviously, so Trident doesn't attempt to do that.

### Demo

I recorded [a video](https://www.youtube.com/watch?v=zZzWjENgB0g) of the process of protecting an app, its settings and data using Kasten K10, Rancher and SolidFire. It's fairly short (5 minutes), so if you're a visual person give it a quick look. Components I used:

- Kubernetes v1.19.4 user cluster (Rancher 2.5.3)
- NetApp Trident v20.10 with CSI external snapshotter v2.1 (old, but still supported; v3 is currently mainstream and v4 just came out earlier this week)
- SolidFire v12.2
- Kasten K10 3.0.3

If you protect applications, their settings, and Trident data, you can export such "bundles" to outside of the cluster or to another location (such as the proverbial "Site B") to migrate or recover data and applications. Take a look at [Kanister](https://docs.kasten.io/latest/kanister/kanister.html) to find out more. I didn't have sufficient resources to try those advanced features but they're surely going to be interesting to many users.

## Protect Rancher on NetApp HCI with Kasten

NetApp HCI users interested in evaluating "Rancher on NetApp HCI" may also be interested in protecting that data with the [free Kasten K10](https://www.kasten.io/try-kasten-k10).

That will work - as things stand right now, you can evaluate Rancher on NetApp HCI and use Kasten K10 to protect up to 10 Rancher nodes at no cost. You can buy support/subscription any time you like.
