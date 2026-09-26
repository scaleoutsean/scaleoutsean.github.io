# Kubernetes failover and failback with Trident CSI and SolidFire

Use Trident CSI and SolidFire to protect data and provide failover and failback to Kubernetes clusters

- [UPDATE](#update)
- [Summary](#summary)
- [Introduction](#introduction)
  - [Comparison between PV Patching and Trident Volume Import approach](#comparison-between-pv-patching-and-trident-volume-import-approach)
  - [Why only Scenario 1](#why-only-scenario-1)
- [Failover (PROD=\>DR)](#failover-proddr)
  - [Steps to failover a SolidFire cluster](#steps-to-failover-a-solidfire-cluster)
    - [Configure Kubernetes and Trident CSI for the SolidFire cluster PROD](#configure-kubernetes-and-trident-csi-for-the-solidfire-cluster-prod)
    - [Notes about restoring workloads on the remote SolidFire cluster](#notes-about-restoring-workloads-on-the-remote-solidfire-cluster)
  - [Steps to configure SolidFire volume replication in the opposite direction](#steps-to-configure-solidfire-volume-replication-in-the-opposite-direction)
- [Failback (DR=\>PROD)](#failback-drprod)
  - [Steps for a SolidFire cluster failback](#steps-for-a-solidfire-cluster-failback)
    - [Notes on failback](#notes-on-failback)
- [Conclusion](#conclusion)
- [Appendix](#appendix)
  - [SolidFire replication and switch-over under the hood](#solidfire-replication-and-switch-over-under-the-hood)
  - [SolidFire Volume Names and IDs](#solidfire-volume-names-and-ids)
  - [Fail PROD cluster](#fail-prod-cluster)
  - [Configure replication](#configure-replication)
  - [Restore read-write access to target replica volumes](#restore-read-write-access-to-target-replica-volumes)
  - [Why use Retain for replicated volumes](#why-use-retain-for-replicated-volumes)
  - [SolidFire replication and Kubernetes Snapshot Volume Class](#solidfire-replication-and-kubernetes-snapshot-volume-class)
  - [Dealing with different types of storage cluster failures](#dealing-with-different-types-of-storage-cluster-failures)
  - [Conduct failover and failback testing](#conduct-failover-and-failback-testing)
  - [Automate storage failover steps](#automate-storage-failover-steps)
  - [Video demo](#video-demo)

## UPDATE

I notice people visit this post often. Please note:

- In **2026**, I recommend evaluating and using [SolidFire CSI](/2026/03/06/solidfire-csi-driver.html) instead of Trident if you don't have to use Trident (OpenShift-on-SolidFire users may not have other supported choice than Trident, for example). Trident CSI with SolidFire still can't properly fail back.
- This post describes a scenario for a single Kubernetes/Trident CSI instance with two SolidFire clusters which is **NOT** recommended (this posts explains why) 
- Additional background can be found in the post [Kubernetes, Trident and SolidFire configuration visibility](/2024/06/01/pvc-volume-relationships-in-solidfire-trident-part-1.html) and other posts in that series. There's a Kubernetes-to-Trident-to-SolidFire mapping script in that post, there's a [SolidFire replication management CLI](/2024/06/11/introducing-project-longhorny.html) and SolidFire replication monitoring is now available in [SFC v2](/2024/06/15/sfc-adds-volume-replication-monitoring.html). It's all permissively licensed and you can reuse and improve all of them, so make sure to check the recent posts for the latest and greatest in this area.
- Since February 2026, [Terraform Provider for SolidFire](https://github.com/scaleoutsean/terraform-provider-solidfire) can also [be used for replication and failover](/2026/02/15/updated-terraform-provider-solidfire.html#whats-new-in-feburary-2026-and-since-july-2025) orchestration.

## Summary

This post describes my preferred personal workflow for setting up SolidFire storage cluster replication, failover, and failback in a single-cluster Kubernetes environment using NetApp Trident v21.01.

The process is simple and works similar to SolidFire failover for physical servers: we use SolidFire storage replication to replicate data (sync, or async, or async with snapshots), and the Trident Volume Import feature to access volumes on the remote storage array.

Due to the relative scarcity of related information (including the official Trident documentation) this post is long and touches upon most relevant details architects and solution designers need to consider when planning and executing storage replication, failover and failback in a single-cluster Kubernetes environment.

In an attempt to provide additional details while keeping them separate from core content, that information can be found in Appendix.

If you'd just like to skim through a video, I recorded two versions:

- [fast & simple version](https://youtu.be/aSFxlGoHgdA) (2m56s) - uses PostgreSQL and all CLI commands are executed from scripts to make the video shorter)
- long version (10m55s) - focus on the details of Trident v21.01 behavior, whys and hows (I don't recommend it, but the link is provided at the bottom)

## Introduction

Previously I created two videos related to the topic of SolidFire replication: one about [configuring SolidFire array & volume replication using SolidFire PowerShell Tools](https://youtu.be/LdKBYJhvwrU) in which I demonstrated how SolidFire replication can be configured in mere seconds, and another about manual [failover and failback of Kubernetes with SolidFire](https://www.youtube.com/watch?v=f-PJGCtEojQ) which used an old approach with patching of Kubernetes PV objects.

The Trident documentation v21.01.01 doesn't have much on the topic of Kubernetes failover with SolidFire storage, so I've been wanting revisit this topic.

There are several scenarios one could use to protect Kubernetes data on SolidFire across sites. I'd expect 90% of SolidFire users use these three:

| Scenario | K8s clusters | SF clusters  | Protects from failure of | Switch-over required |
|  :---:   |    :---:     | :---:        | :---:                    | :---:                |
|  1       |       1      |   2          | SF cluster               | SF                   |
|  2       |       2      |   2          | K8s or SF cluster        | Both K8s & SF        |
|  3       |      1,3     |  1,3         | AZ                       | None                 |

In **Scenario 1** we assume SolidFire replication is in place. There is only one Kubernetes cluster, so we just need to make Kubernetes to switch to the backup storage backend.

In **Scenario 2** there's one Kubernetes and one SolidFire cluster *at each site*. If either Kubernetes or SolidFire cluster fails, we switch both Kubernetes and SolidFire to the surviving site.

The difference compared to Scenario 1 is the remote site is likely to have a Kubernetes cluster that is unaware of the existence of the PROD site. As soon as we promote the remote SolidFire cluster to Read/Write, replica volumes at the remote SolidFire can come online for read-write access by the remote Kubernetes cluster. Note that the remote Kubernetes cluster could also have a configuration fully or partially imported from the cluster at the production site which would make that situation similar to Scenario 1: technically it'd be a separate cluster, but logically it could be almost like the same cluster, depending on the extent of similarities in configuration (in terms of storage we obviously think about PVCs).

**Scenario 3** is about more complex combinations. One of them (single Kubernetes cluster, single SolidFire cluster, spread across three sites connected by a low-latency L2 network) involves SolidFire Protection Domains (PDs). What do PDs do?

They're similar to Availability Zones in Public Coud. A SolidFire cluster with six or more nodes can be logically segregated into three Protection Domains, so that redundant copies of each data block that SolidFire makes to protect data from disk or node failures never land in the same Protection Domain (in this example that'd mean two copies would never be stored in the same Protection Domain).

If your Kuberetes cluster is spread spread over multiple buildings in a campus environment, you could deploy six or more SolidFire nodes to provide redundancy within each PD, but also protect data and services in the case one building loses power or network connectivity. This approach has a zero RTO and RPO because there is no SolidFire cluster failover involved.

PD failover is just a failover of a node or domain. Unlike Public Cloud AZs, SolidFire PDs don't and can't limit access to or even prefer local iSCSI clients: whether it's one or three Kubernetes clusters connected to a SolidFire v12 cluster with PDs, all workers need to access all PDs as long as SolidFire PDs are up and running. Should one PD fail, Kubernetes workers would find their iSCSI volumes available in one of the the remaining two PDs.

### Comparison between PV Patching and Trident Volume Import approach

To me these would be most significant differences (it's been a while since I looked at the PV patching/replacement approach so I'm not entirely sure about that column):

|  Feature                                 | PV Patching|  Trident Volume Import  |
|               :---                       |  :---:     |  :---:                  |
|  Works with CSI-compatible Trident       |  x (?)     |  o                      |
|  Static Kubernetes PV names              |  o         |  x                      |
|  Same Kubernetes PV name across sites    |  o         |  x                      |
|  Same SolidFire Volume name across sites |  o         |  o                      |
|  Relies on Trident CSI for volume import |  x         |  o                      |
|  Requires Trident backend changes        |  x         |  o                      |
|  Easy integration with external tooling  |  o         |  o                      |

I suppose that those who like consistent and static PVC names in Kubernetes and SolidFire strongly prefer PV patching but I really don't know what's more or less important to whom, and I probably can't think of some other reasons why one or the other may be more suitable for you.

### Why only Scenario 1

**This post considers only Scenario 1** because Scenario 2 is either similar (when some or most of Kubernetes configuration from Source is applied on Destination) or easier (when Kubernetes clusters are completely independent). Scenario 3 requires no special considerations because there's no SolidFire site or cluster failover (and we can imagine that anyone with the main site running Scenario 3 would have another site which would make it Scenario 2).

High level steps for each phase of Scenario 1:

- Failover:
  - SolidFire DR cluster: delete volume replication pairs to stop replication. Make SolidFire replica volumes Read/Write
  - Kubernetes: delete the backend PROD to prevent its use by Trident that side comes up, then create a new Trident backend for the SolidFire DR cluster, use Trident import volume to import replicated volume and finally recreate PVC
  - SolidFire PROD & DR cluster:
    - SolidFire PROD cluster (once it becomes accessible): delete volume pairs, make replicated volumes replication targets
    - SolidFire DR cluster: configure and start DR=>PROD replication to prepare for failback
- Failback:
  - Kubernetes: stop workloads using the remote SolidFire cluster
  - SolidFire DR cluster: stop and delete replication pairings
  - SolidFire PROD cluster: delete replication pairings
  - Kuberntes: reinstall Trident and recreate backend PROD, delete stale PVs, then import volumes from PROD and recreate PVCs

SolidFire users in Scenario 2 may be able to apply most, if not all, SolidFire-related steps and ignore Trident-related steps that involve backend changes or reinstallation (just `import volume`, managed or unmanaged, should be enough). I may write a post about Scenario 2 in the future.

## Failover (PROD=>DR)

My setup:

- One K8s cluster with Trident CSI v21.01.1 (just in the case you have a newer version, check its change log)
- Two SolidFire storage clusters paired for volume replication named PROD and DR (SolidFire version 12.2 and 11.7, respectively)
- One (default) storage class configured to use `solidfire-san` configured in Kubernetes

In order to use different storage clusters you must use two backends (why, see Appendix for details).

We start with a backend that uses PROD and to failover switch to a backend that uses the cluster "DR". To fail back we again set up replication, this time in the opposite direction.

SolidFire Volume Names and IDs in Failover and Failback belong to the same (successful) workflow, while names from Appendix are from different situations so don't try to "map" the stuff from Appendix to other steps or processes.

High level steps before site failover is attempted:

- Prepare Kubernetes and two SolidFire clusters:
  - pair PROD & DR clusters
  - install Trident on your only Kubernetes cluster
  - create Storage Class(es) for the SolidFire, NetApp HCI or eSDS back-end (`solidfire-san`) and with `reclaimPolicy: Retain`
  - create a storage account on each SolidFire cluster and ensure both backends work with Trident

- Production site:
  - Trident: create a CHAP-based backend configuration file for "PROD"
  - Kubernetes: create a PVC, identify resulting PV on SolidFire by its Volume ID

- DR site:
  - SolidFire: Create a target volume with same properties (size, 512e emulation, storage account owner), set access mode to `replicationTarget`
  - SolidFire: Create a CHAP-based backend configuratino file for "DR"
  - Kubernetes: make sure you have a copy of PVC or other YAML files with PVCs from the production site

- Production site:
  - SolidFire: configure SolidFire volume pairs and replication (PROD=>DR) for that PV (complete it by approving the step on the remote SolidFire cluster)

### Steps to failover a SolidFire cluster

- Production site:
  - SolidFire: power off or reboot SolidFire array at the PROD site (to simulate unplanned site failure)

- Production site:
  - SolidFire: delete volume replication (pairs) to stop replication, change replica volumes' mode from `replicationTarget` to `readWrite`
  - Trident: delete backend "PROD" (we'll create it again after we fail back), create the DR backend
  - Kubernetes: delete stale PVC from the PROD site (we need to remove them in order to recreate them with `import volume`)
  - Kubernetes: delete stale PV from the PROD site (this will delete it only from Kubernetes, not from the backend PROD because we removed it earlier)
  - Trident: use `tridentctl import volume` to import replica PV and recreate PVC configuration

#### Configure Kubernetes and Trident CSI for the SolidFire cluster PROD

Create backend for the production site.

```sh
$ ./trident-installer/tridentctl create backend -n trident -f be-prod.json 
+----------------------+----------------+--------------------------------------+--------+---------+
|         NAME         | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+----------------------+----------------+--------------------------------------+--------+---------+
| SF-PROD-192.168.1.30 | solidfire-san  | 57883f01-94ba-48aa-8acd-e7330c128bce | online |       0 |
+----------------------+----------------+--------------------------------------+--------+---------+
```

We need a Storage Class which we'll use on both sites. Use `ReclaimPolicy: Retain` to prevent automatic deletion of PVs after PVC release.

```sh
$ kubectl get sc
NAME              PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
basic (default)   csi.trident.netapp.io   Retain          Immediate           true                   4h20m

$ kubectl describe sc 
Name:                  basic
IsDefaultClass:        Yes
Annotations:           storageclass.kubernetes.io/is-default-class=true
Provisioner:           csi.trident.netapp.io
Parameters:            IOPS=300,backendType=solidfire-san,clones=true,fsType=ext4,snapshots=true
AllowVolumeExpansion:  True
MountOptions:          <none>
ReclaimPolicy:         Retain
VolumeBindingMode:     Immediate
Events:                <none>
```

This storage class is not site-specific so we can leave it in place and just manipulate backends. There may be other approaches (more complex, too).

Request a PV in the `pg` namespace:

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: pg
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: basic
```

Now we have a PVC, and a PV to protect. Maintain an off-site copy of PVC-related configuration files because you'll need to recreate PVCs on the remote site to failover.

```sh
$ kubectl get pvc -n pg
NAME   STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
pg     Bound    pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb   1Gi        RWO            basic          106m

$ kubectl get pv -n pg
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM   STORAGECLASS   REASON   AGE
pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb   1Gi        RWO            Retain           Bound    pg/pg   basic                   106m
```

New PVC:

```sh
$ kubectl describe pv pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb -n pg
Name:            pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb
...
Source:
    Type:              CSI (a Container Storage Interface (CSI) volume source)
    Driver:            csi.trident.netapp.io
    FSType:            ext4
    VolumeHandle:      pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb
    ReadOnly:          false
    VolumeAttributes:      backendUUID=57883f01-94ba-48aa-8acd-e7330c128bce
                           internalName=pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3
                           name=pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb
...
```

`internalName=pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3`: this is the SolidFire volume name. It is stored by Trident in SolidFire volume attributes at creation or (managed) import.

`backendUUID` is Trident's internal, non-deterministic unique identifier for storage backends. Here it's `57883f01-94ba-48aa-8acd-e7330c128bce`, but if we recreated the same backend its backend UUID would be different.

Replicate this volume to SolidFire on the remote site (more on that in Appendix, if you wish to use the CLI or automate), wait until the pair is in sync, and then fail the PROD cluster to simulate a site failure. Repeat the procedure for multiple volumes if you have them.

#### Notes about restoring workloads on the remote SolidFire cluster

Once you decide it's time to fail over, the first thing you do is delete volume pairing configuration used PROD=>DR replication, while noting Volume IDs of volume pairs - we will have to replicate reverse once PROD comes back online!

You probably don't want to make such notes during failover. It's better to create a CSV, JSON or YAML file and keep it in an object storage bucket or private Github repository so that you can always access it from both sites. That table can be simple (example below) or sophisticated, but as long as it is correct and up to date, it will work well.

| ns/pod |  src  |  dst  |  replicate  |
| :---:  |  :---:| :---: |    :---:    |
| pg/pg  |  476  |  126  |    true     |
| pg/logs|  477  |  128  |    true     |
| pg/bkp |  478  |  130  |    true     |
| pg/dmp |  481  |   -   |    false    |

As you create new PVCs - whether they require replication or not - update that table in the same go. When we pair volumes in either direction or import volumes, we pull/download the table and use its fields as inputs to Ansible, PowerShell, or some other tool. Have a similar procedure for when you delete PVCs.

Having deleted stale volume pairs on the remote SolidFire cluster we can promote all its replica volumes from `replicationTarget` to `readWrite` in order to make them writeable and turn them into Sources of replication. This can be easily automated but for a handful of volumes you could also use the SolidFire Web UI.

Then we delete PROD from Trident backends. This is necessary in order to make Trident forget about the failed SolidFire cluster. Because if PROD comes back online, a `kubectl delete pv` could accidentally purge a Source volume. And `kubectl create pvc` could create new volumes off-site - also not desirable. Virtual Storage Pools, topology-aware CSI and multiple Storage Classes may be able to help us do that smarter, but at the cost of more complex configuration and I haven't yet found a way to apply such features to this use case.

Let's go ahead and delete "PROD" using `tridentctl delete backend`. It's offline (failed) as we do this, so a delete will likely leave it in the `deleting` state like this:

```sh
$ ./trident-installer/tridentctl get backend -n trident
+----------------------+----------------+--------------------------------------+----------+---------+
|         NAME         | STORAGE DRIVER |                 UUID                 |  STATE   | VOLUMES |
+----------------------+----------------+--------------------------------------+----------+---------+
| SF-PROD-192.168.1.30 | solidfire-san  | 57883f01-94ba-48aa-8acd-e7330c128bce | deleting |       1 |
+----------------------+----------------+--------------------------------------+----------+---------+
```

We could also reinstall Trident to be sure. But in my testing I noticed that the `deleting` state is sufficient to ensure that new volumes don't get created on such a backend even if it is online.

While we're here, we can create a new Trident backend that uses the remote cluster (we *must* do this before we can import volumes, but not too early - such as before storage failover - because you could end up creating and using DR volumes from more remote Kubernetes workers (close to PROD storage) which may be undesirable for several reasons):

```sh
$ ./trident-installer/tridentctl create backend -n trident -f be-dr.json 
+--------------------+----------------+--------------------------------------+--------+---------+
|        NAME        | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+--------------------+----------------+--------------------------------------+--------+---------+
| SF-DR-192.168.1.34 | solidfire-san  | 38455724-54ad-4d6d-a1dc-7437ab56803b | online |       0 |
+--------------------+----------------+--------------------------------------+--------+---------+
```

After that we can delete the stale PVC and PV without actually deleting the PROD PV on the SolidFire PROD cluster (and that is because its backend is already in the `deleting` state). If you have more than one PVC, rinse & repeat.

```sh
$ kubectl delete pvc pg -n pg
persistentvolumeclaim "pg" deleted

$ kubectl delete pv pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb -n pg
warning: deleting cluster-scoped resources, not scoped to the provided namespace
persistentvolume "pvc-fdd499f6-14f3-4280-bdef-35d84c5794bb" deleted
```

Because our Storage Class uses the `Retain` reclaim policy, removing a PVC will still leave us with the PROD PV in place. If you've deleted the production site backend (PROD) by now, you may delete that PV from Kubernetes as well (`kubectl delete pv`) - it won't be deleted from PROD.

To recap our current situation:

- Removed from SolidFire at the DR site: replication pairs
- Removed from Kubernetes: backend "PROD", old PVC and old PV
- Added to Kubernetes: backend "DR"

We're ready to import the replica with `tridentctl import volume` (using managed import). To that end we provide the names of the remote back-end (`SF-DR-192.168.1.34`), remote volume (`dr-$VOLNAME`), and the original PVC YAML created while using the PROD cluster (this tells Kubernetes what the volume is used for):

```sh
$ ./trident-installer/tridentctl import volume -n trident SF-DR-192.168.1.34 dr-pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3 -n trident -f pvc-simple.yaml
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|                   NAME                   |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| pvc-d24cf316-496a-4807-aa54-08999f712f9d | 1.0 GiB | basic         | block    | 38455724-54ad-4d6d-a1dc-7437ab56803b | online | true    |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
```

As you can see we created the remote SolidFire target volume we prefixed the source name with `dr-` (`dr-` + `pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3`). Use any SolidFire Volume Name you like when creating replica volumes, but don't lose track of which Volume ID you need to use - Volume Names are easy to look up (see Appendix).

Let's examine the recreated PVC and imported PV:

```sh
$ kubectl get pvc -n pg
NAME   STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
pg     Bound    pvc-d24cf316-496a-4807-aa54-08999f712f9d   1Gi        RWO            basic          13m

$ kubectl get pv -n pg
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM   STORAGECLASS   REASON   AGE
pvc-d24cf316-496a-4807-aa54-08999f712f9d   1Gi        RWO            Retain           Bound    pg/pg   basic                   13m

$ kubectl describe pvc pg -n pg
Name:          pg
Namespace:     pg
StorageClass:  basic
Status:        Bound
Volume:        pvc-d24cf316-496a-4807-aa54-08999f712f9d
Labels:        <none>
Annotations:   pv.kubernetes.io/bind-completed: yes
               pv.kubernetes.io/bound-by-controller: yes
               trident.netapp.io/importBackendUUID: 38455724-54ad-4d6d-a1dc-7437ab56803b
               trident.netapp.io/importOriginalName: dr-pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3
               trident.netapp.io/notManaged: false
               volume.beta.kubernetes.io/storage-provisioner: csi.trident.netapp.io
...
```

Imported PV:

```sh
$ kubectl describe pv pvc-d24cf316-496a-4807-aa54-08999f712f9d -n pg
Name:            pvc-d24cf316-496a-4807-aa54-08999f712f9d
Labels:          <none>
Annotations:     pv.kubernetes.io/provisioned-by: csi.trident.netapp.io
Finalizers:      [kubernetes.io/pv-protection]
...
Source:
    Type:              CSI (a Container Storage Interface (CSI) volume source)
    Driver:            csi.trident.netapp.io
    FSType:            ext4
    VolumeHandle:      pvc-d24cf316-496a-4807-aa54-08999f712f9d
    ReadOnly:          false
    VolumeAttributes:      backendUUID=38455724-54ad-4d6d-a1dc-7437ab56803b
                           internalName=dr-pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3
                           name=pvc-d24cf316-496a-4807-aa54-08999f712f9d
...
```

CSI gave the imported volume its own name (`pvc-d24cf316-496a-4807-aa54-08999f712f9d`) although the SolidFire Volume Name is `dr-pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3`.

Well, at least we can still find the SolidFire Volume Name in `internalName` value, and make use of it in storage management outside of Kubernetes. For example, when we need to create a new destination volume and setup volume pairs, we can name it `$NS-$POD-$PVC` and later use that to setup backup or simply know what volume is what without having to look it up in Kubernetes. But we can't decide volume name for Kubernetes-created volumes, and shouldn't change those names either so we'd probably be better off if we just focused on that chart with Volume IDs and used that as a basis for storage and Kubernetes management.

`backendUUID` from the SolidFire DR cluster is expectedly different from that of the PROD cluster.

Our current situation:

- Removed from SolidFire at the DR site: replication pairs
- Removed from Kubernetes: backend PROD, old PVC and old PV
- Added to Kubernetes: backend DR, and (using `tridentctl import volume`) PV and PVC

We're back in business, but we must not forget to protect our data and get ready for failback, as soon as the PROD cluster is accessible:

### Steps to configure SolidFire volume replication in the opposite direction

- Production site:
  - SolidFire: go to Data Protection > Volume Pairs, delete volume pairs for outbound (PROD=>DR) replication while taking note of Volume IDs in replication pairs (we need to recreate pairs for inbound replication)
  - SolidFire: go to Manage > Volumes, find each Volume that was replicated and change it from `Read/Write` (`readWrite` in the API and PowerShell) to `replicationTarget`
  - SolidFire: if new PVCs have been created while operating at the remote site (DR), create matching volumes on PROD (set them to access mode: `replicationTarget`) and update your volume pairs document
- DR site:
  - SolidFire: using notes from failover plus any new volumes (created at on DR cluster), use Src & Dst Volume ID pairs (DR=>PROD) to configure and initiate reverse replication for DR=>PROD failback

When completing volume pairing for reverse replication the last step is done at the Destination as usual: in this screenshot we can see in this last step PROD refers to DR as Source of replication:

![Trident-inserted SolidFire volume attributes in SolidFire UI at Active site](/assets/images/solidfire-kubernetes-replication-failover-failback-07-complete-replication-pairing-at-destination.png)

As we pair volumes from DR to PROD, if volumes paired on the PROD cluster are set to `replicationTarget` replication should kick off in two-three minutes.

SolidFire replication is efficient in both directions. Only the changed blocks will need to be copied between the sites (and even those will be compressed and deduplicated).

## Failback (DR=>PROD)

We reversed storage replication in the Failover section (see the previous paragraphs), so DR=>PROD replication is already taking place.

There is a symmetry in SolidlFire failover and failback, as far as amount of data and workflow are concerned. The main difference between SolidFire failover and failback is that failback is (usually) planned and both sites are online.

Therefore, in this part we skip repetitive details and focus on what's different (Trident failback).

### Steps for a SolidFire cluster failback

- DR site:
  - Kubernetes: scale in to 0, to make workloads stop
  - SolidFire: observe replication status of replicated volumes, they need to be in sync (with async, delay should become `00:00:00.000000`) and any snapshots that are supposed to be replicated should be visible on the Destination cluster
  - SolidFire: assuming all workloads were stopped earlier, there's nothing new in replication queues - delete all volume replication pairs
  - SolidFire: change all volumes that have been Source, to Replication Target, to make them ready for PROD=>DR replication (once we successfully failback)

- Production site:
  - SolidFire: delete volume pairs (DR=>PROD), make volumes readWrite
  - SolidFire: configure and initiate PROD=>DR replication (last step is performed at the destination when the SolidFire Web UI is used)
  - SolidFire: delete volume replication (pairs) to stop replication, change replica volumes' mode from `replicationTarget` to `readWrite`
  - Kubernetes: uninstall and then install Trident to clean backends and volume configuration (this also deletes the backend DR)
  - Kubernetes: create a new backend PROD using the same configuration file from before. Its backendUUID will be unique
  - Kubernetes: delete "stale" PVC from the site DR and any stale PVs (this will delete them from Kubernetes but not from SolidFire, because all backends which provisioned them were wiped when we reinstalled Trident)
  - Trident: use `tridentctl import volume` to import replica PV and recreate PVC configuration
  - SolidFire: configure storage replication (PROD=>DR)

#### Notes on failback

How to tell all replicas are up to date, and it's safe to fail back? We can use the Web UI for visual inspection and PowerShell, Ansible, Python CLI, JSON-RPC for automated checks to make sure all data changes at Source ("DR") have been replicated to Destination ("PROD").

![Monitor replication delay in SolidFire](/assets/images/solidfire-kubernetes-replication-failover-failback-05-async-replication-status.png)

The Trident reinstall step may be controversial - it's certainly not officially recommended, but then again there's no recommendation of any kind and I think it makes the process easy. Where things can get dangerous is if multiple backends are used - then re-installation may become complicated or at the very least require additional planning.

```sh
./trident-installer/tridentctl uninstall -n trident
./trident-installer/tridentctl install -n trident
```

In Scenario 2 with one Kubernetes cluster per site we wouldn't have two backends on either of those Kubernetes clusters and wouldn't benefit from reinstalling Trident. But I have one cluster that's switching sites and backends multiple times.

What should those users who also have *other* Trident volumes which weren't replicated do? Those volumes could be imported too, and it'd be seamless if we maintained PVC-Volume ID pairings as mentioned earlier. Otherwise - in Scenario 1 at least - we also couldn't delete backend PROD upon failover, and couldn't prevent Trident from creating volumes on the remote backend. So in order to avoid having to reinstall Trident and maintain PVC-VolID pairs we'd need to make substantial changes for Scenario 1.

As we create "PROD" for the second time, its randomly generated UUID is different (now: `1a474ae1-...`, before: `57883f01-...`).

We import the old-new volume (SolidFire Volume Name `pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3`) and it gets a new name, assigned to the new backend:

```sh

$ ./trident-installer/tridentctl import volume -n trident SF-PROD-192.168.1.30 pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3 -n trident -f pvc-simple.yaml
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|                   NAME                   |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| pvc-f5cda73c-98d2-441a-9296-93f841a5cde8 | 1.0 GiB | basic         | block    | 1a474ae1-6559-472a-a5ae-74d8c220a8b2 | online | true    |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
```

Like with failover, we must delete the PVC in order to use `import volume`:

```sh
$ kubectl delete pvc pg -n pg
persistentvolumeclaim "pg" deleted
```

At this point we haven't yet imported any volumes, so any `kubectl get pv` output is likely to contain (at most) stale PVs from the site DR.

You can use `./trident-installer/tridentctl get volumes -n trident` (assuming Trident is installed in that namespace) to narrow down the list to only Trident-provisioned volumes, but `kubectl get pv` will likely know of stale Trident volumes that `tridentctl` doesn't know (because we reinstalled Trident).

So use `kubectl` to check any PVs for their backend information and, if their backend UUIDs are from "DR" or the old "PROD", delete them (`kubectl delete pv`). They won't be removed from SolidFire, either PROD or DR, because Trident has no way to map these stale volumes to backendUUIDs it knows nothing about: that is why we reinstalled Trident!

All the newly imported volumes should come back and have the latest PROD's backendUUID.

```sh
$ kubectl describe pv pvc-f5cda73c-98d2-441a-9296-93f841a5cde8 -n pg
Name:            pvc-f5cda73c-98d2-441a-9296-93f841a5cde8
...         
Source:
    Type:              CSI (a Container Storage Interface (CSI) volume source)
    Driver:            csi.trident.netapp.io
    FSType:            ext4
    VolumeHandle:      pvc-f5cda73c-98d2-441a-9296-93f841a5cde8
    ReadOnly:          false
    VolumeAttributes:      backendUUID=1a474ae1-6559-472a-a5ae-74d8c220a8b2
                           internalName=pvc-b4ad4998-05ce-46ab-9f67-a6e972805fa3
                           name=pvc-f5cda73c-98d2-441a-9296-93f841a5cde8
...
```

We have already configured and initiated PROD=>DR replication, so failback is now complete.

## Conclusion

Kubernetes failover and failback with Trident and SolidFire are cleaner than the "old school" approach that used patching. Trident's volume import feature makes the proces much more convenient.

While the reinstallation of Trident prior to failback is not required in the official documentation, there's no failover and failback recipe in the official documentation and my approach works nicely and takes just 30 seconds. I didn't notice any downsides to it except that PVCs from the PROD cluster get new PV names in Kubernetes, but if you use Volume IDs to manage replication and import, that shouldn't be a problem. If, on the other hand, you have other data protection software in place, or have many volumes that aren't replicated, you should evaluate a more suitable approach.

Kubernetes' PV names are unsuitable for human consumption so SolidFire's primary focus on Volume IDs makes it possible to forget Volume Names and stick to managing Volume IDs. If we store Kubernetes configuration YAMLs and SolidFire volume IDs in a repository, we can use that to automate everything (the creation of remote volumes, the pairing of Src-Dst and Dst-Src volumes, Trident-related failover and failback operations including volume import).

Because Trident deletes SolidFire volumes by *purging* them, it is important to ensure that storage classes for replicated volumes have reclaim policy for volumes (and possibly for volume snapshots; see in Appendix for additional notes on that) set to Retain.

Topology-aware CSI configurations may be able to simplify the management of multiple back-ends in the scenario where one Kubernetes cluster can access two SolidFire back-ends, but I have not found a way to effectively use it with SolidFire. NetApp Trident is constantly evolving so check the latest features and newer blog posts out there to find about latest improvements in SolidFire-related features.

## Appendix

### SolidFire replication and switch-over under the hood

Assuming your network configuration is symmetric (that is, your volume X isn't exposed on VLAN 100 and VLAN 200, respectively), you only need to worry about the following differences between sites:

- Storage VIP (one per SolidFire cluster) (example: `192.168.1.30`)
- Unique cluster ID (example: `mn4y`)
- Volume ID (example: `270`)

Of course, there's also a Volume Name, which can be consistent across sites, prefixed with a unique site-specific or Kubernetes cluster-specific string, or entirely different.

Example:

|  Cluster  |  Svip        | uniqueId    | volumeName                                |  volId  |
|  :---     |  :---:       | :---:       | :---:                                     | :---:   |
|  PROD     |  192.168.1.30| mn4y        | pvc-ba229a61-6026-44bd-8b39-29863261469a  | 270     |

When an iSCSI client connects to a volume like that, this is what we see in Reporting > iSCSI Sessions in the SolidFire Web UI:

- `iqn.2010-01.com.solidfire:mn4y.pvc-ba229a61-6026-44bd-8b39-29863261469a.270`

The same can be observed with `Get-SFIscsiSession` (PowerShell):

```powershell
> Get-SFIscsiSession

DriveIDs               : {1}
AccountID              : 14
...
InitiatorPortName      : iqn.1993-08.org.debian:01:9dbcf2ddfb75,i,0x23d000001
TargetPortName         : iqn.2010-01.com.solidfire:mn4y.pvc-ba229a61-6026-44bd-8b39-29863261469a.270,t,0x1
InitiatorName          : iqn.1993-08.org.debian:01:9dbcf2ddfb75
...
TargetName             : iqn.2010-01.com.solidfire:mn4y.pvc-ba229a61-6026-44bd-8b39-29863261469a.270
TargetIP               : 192.168.103.29:3260
VirtualNetworkID       : 0
VolumeID               : 270
```

Now we know how to put together our SF iSCSI target:

- `iqn.2010-01.com.solidfire:` + `${CLUSTER-UNIQUE-ID}` + `.` + `${VOLUME-NAME}` + `.` + `${VOLUME-ID}`

We can get Svip (Storage Virtual IP) and UniqueID using `Get-SFClusterInfo`, which means we have everything required to transform iSCSI device paths from PROD and swap them with Target device paths (which is what storage site failover would require), and back.

And now also understand why Kubernetes cannot transparently switch bewteen two SolidFire clusters, even with identical SVIPs (there would be a router in betwween): UniqueId makes device names different and PV patching is required if you don't choose to use the volume import feature. If you are interested in the patching approach you can consider using the script linked at the bottom of this post.

### SolidFire Volume Names and IDs

On SolidFire, a Volume Name is just a tag for the volume object uniquely identified by Volume ID. Volume ID is unique within a cluster, while Volume Names can be duplicate (which can create confusion among people and scripts, so when we create clones or new volumes in the same cluster we try to avoid doing that).

We can't decide Kubernetes volume names when they are created, and we shouldn't change them once they are created. Across clusters, each volume in a pairs can have the same Name (as in the example above) and some people may find that easier to work with.

Because names of volumes at the remote site are decided by us when we create replica volumes we can pick any allowed, but I assume most folks would prefer one of these approaches:

| Approach|  SF Vol Name at PROD site |  SF Vol Name at DR site  |
| :---    |  :---  |  :---  |
| Symmetric             |  pvc-ba229a61-6026-44bd-8b39-29863261469a      | pvc-ba229a61-6026-44bd-8b39-29863261469a     |
| Asymmetric            |  prod-pvc-ba229a61-6026-44bd-8b39-29863261469a | dr-pvc-ba229a61-6026-44bd-8b39-29863261469a  |
| Asymmetric for Humans |  pvc-ba229a61-6026-44bd-8b39-29863261469a      | pg-data                                      |

Kubernetes picks its own volume names, but we pick the names of remote volumes that we create before we set up replication.

I'm not convinced that naming the remote volume `pg-data` would be helpful but sure, you could use that or have your own schema (`$SITE-$NS-$POD-$DISK` or whatever works for you) for replica volumes. But I suggest to try to manage Volume IDs in Git or S3 and automate.

What's partially replicated with Volume is its other tags (called Attributes). Among other things we note the volume is formatted with XFS, origin cluster was Kubernetes v1.20.2 on ARM64 - all important details for CSI are in there.

![Trident-inserted SolidFire volume attributes in SolidFire UI at Active site](/assets/images/solidfire-kubernetes-replication-failover-failback-01-volume-attributes.png)

Form the Trident documentation: "When a volume is imported, an annotation is added to the PVC and PV that serves a dual purpose of indicating that the volume was imported and if the PVC and PV are managed. This annotation should not be modified or removed."

### Fail PROD cluster

To simulate SolidFire cluster failure I simply shut down PROD (SolidFire cluster at the primary site). The command can be used to shut down all SolidFire nodes at once (use `-Node` to pass all node IDs in a comma-separated list).

```powershell
> Invoke-SFShutdown -Option halt
```

If you don't have a way to power it up again (IPMI or physical access), don't use `halt`. I used `halt` because I wanted to ensure the failed cluster doesn't come up again, and `reboot` when I didn't mind that.

If you test failover in a production environment, there's no particular reason to power off anything - see the last part at the very bottom of this post.

### Configure replication

As stated at the beginning, we assume no one screwed with the volume names or attributes so we can query the API for that name to get one and only one VolumeID that matches it.

If we had this information out-of-band information (externally stored YAML or CSV files) we could work with SolidFire Volume IDs and pick random volume names at the DR site.

```powershell
> Get-SFVolume -Name "pvc-a410d978-c346-4322-912d-5323571020b3"

VolumeID                    : 273
Name                        : pvc-a410d978-c346-4322-912d-5323571020b3
AccountID                   : 21
CreateTime                  : 2021-03-15T08:47:59Z
VolumeConsistencyGroupUUID  : 18bd234c-e333-499e-87b7-92de29a8b52f
VolumeUUID                  : ab7c5eb2-0138-4f40-9b7d-d32570bc1dee
EnableSnapMirrorReplication : False
Status                      : active
Access                      : readWrite
Enable512e                  : True
Iqn                         : iqn.2010-01.com.solidfire:mn4y.pvc-a410d978-c346-4322-912d-5323571020b3.273
ScsiEUIDeviceID             : 6d6e347900000111f47acc0100000000
ScsiNAADeviceID             : 6f47acc1000000006d6e347900000111
Qos                         : {"MinIOPS" = 200, "MaxIOPS" = 390, "BurstIOPS" = 600, "BurstTime" = 60}
QosPolicyID                 : 
VolumeAccessGroups          : {}
VolumePairs                 : {}
DeleteTime                  : 
PurgeTime                   : 
LastAccessTime              : 
LastAccessTimeIO            : 
SliceCount                  : 1
TotalSize                   : 1073741824
BlockSize                   : 4096
VirtualVolumeID             : 
Attributes                  : {fstype, provisioning, trident, docker-name}
CurrentProtectionScheme     : singleHelix
PreviousProtectionScheme    : 
```

On the remote cluster if we wanted the same name and size, while storage AccountID (used by Kubernetes) would likely be different and QoSPolicy ID also. The SF API won't let us use `Access: replicationTarget` right away, so first we just need to create it and then change it. Both of these below are executed against the DR cluster.

```powershell
 > New-SFVolume -Name "pvc-a410d978-c346-4322-912d-5323571020b3" -AccountID 30 -Enable512e:$True -TotalSize 1073741824 -QoSPolicyID 6                           

VolumeID                    : 223
Name                        : pvc-a410d978-c346-4322-912d-5323571020b3
AccountID                   : 30
CreateTime                  : 2021-03-15T08:59:35Z
...
Status                      : active
Access                      : readWrite

> Set-SFVolume -VolumeID 223 -Access replicationTarget -Confirm:$False

VolumeID                    : 223
Name                        : pvc-a410d978-c346-4322-912d-5323571020b3
AccountID                   : 30
...
Status                      : active
Access                      : replicationTarget
```

Use `Start-SFClusterPairing` (source) and `Complete-SFClusterPairing` (target) to pair clusters (do this just once per pair) and `Start-SFVolumePairing` (source) and `Complete-SFVolumePairing` (target) to pair volumes (once per each volume pair).

`Set-SFVolumePair -Mode Async|Sync|snapshotOnly` can be used to configure volume replication mode.

Once done, you'll have a cluster and volume pair(s) like this:

```powershell
> Get-SFClusterPair       

ClusterName     : DR
ClusterPairID   : 10
ClusterPairUUID : 4aa9be97-c396-4de7-9bbb-2515c7d998f3
Latency         : 1
Mvip            : 192.168.1.34
Status          : Connected
Version         : 11.7.0.76
ClusterUUID     : 72k4

> Get-SFVolumePair 

VolumeID                    : 291
Name                        : pvc-6de28b98-343f-45f5-9810-da795a81306f
AccountID                   : 21
CreateTime                  : 2021-03-21T05:15:07Z
VolumeConsistencyGroupUUID  : 2caf356f-81ac-41f5-b4f5-3923d4dc4a70
VolumeUUID                  : d40cce76-aea1-4cad-b4fd-e1baa0c037c1
EnableSnapMirrorReplication : False
Status                      : active
Access                      : readWrite
Enable512e                  : True
Iqn                         : iqn.2010-01.com.solidfire:mn4y.pvc-6de28b98-343f-45f5-9810-da795a81306f.291
ScsiEUIDeviceID             : 6d6e347900000123f47acc0100000000
ScsiNAADeviceID             : 6f47acc1000000006d6e347900000123
Qos                         : {"MinIOPS" = 200, "MaxIOPS" = 390, "BurstIOPS" = 600, "BurstTime" = 60}
QosPolicyID                 : 
VolumeAccessGroups          : {}
VolumePairs                 : {pg}
DeleteTime                  : 
PurgeTime                   : 
LastAccessTime              : 
LastAccessTimeIO            : 
SliceCount                  : 1
TotalSize                   : 1073741824
BlockSize                   : 4096
VirtualVolumeID             : 
Attributes                  : {docker-name, provisioning, fstype, trident}
CurrentProtectionScheme     : singleHelix
PreviousProtectionScheme    : 
```

What about Volume Resizing? Yes both SolidFire and Trident CSI support it, but consider the benefit of Thin Provisioning before that. Why?

What happens when you resize a replication Source, forget to resize its paired Target and need to failover? I'd rather not have to know. If you don't want either, better plan and test resizing of paired volumes or (better yet) provision larger volumes from the beginning to minimize or eliminate that activity.

If you want to compare Volume Names and do other time consuming and error prone tasks, automate. An example that checks if two SolidFire Volume IDs have consistent Volume Names (not that I necessarily recommend using identical names for replicated volume pairs - but if wanted to check here's how easy that'd be):

```powershell
> if ( ((Get-SFVolume -VolumeID 273 -SFConnection $connp).Name) -eq ((Get-SFVolume -VolumeID 223 -SFConnection $connd).Name) ) { Write-Host "Good!"}
Good!
```

It takes just one second to compare 50 volume names with PowerShell, and you'll make zero mistakes (if your Volume IDs come from a correct, up-to-date config file; in this simple example Volume IDs are hardcoded).

Once volumes are paired, we can connect to Source cluster to obtain pairing details (`Get-SFVolumePair`). Or you can see replication status in the Web interface - see the second screenshot in the Failback-related content above.

Async replication delay can be obtained with `Get-SFVolumeStats` in SolidFire PowerShell Tools.

```powershell
> (((Get-SFVolumeStats -VolumeID 291).AsyncDelay) -eq "00:00:00.000000")
True
```

### Restore read-write access to target replica volumes

Whether it's failover or failback, we delete volume pairing at the site we failing over *to* and make replica volumes writeable:

![Make SolidFire Volume writeable](/assets/images/solidfire-kubernetes-replication-failover-failback-04-make-replica-volume-writeable.png)

You must have noticed I say "delete volume pairings" rather than "pause replication". The reason is in Scenario 1 we don't expect to ever need to resume replication after failover. A contrived counter-example might be "We failed over too early before all changed data made it to the other site". Well, don't do that! As a reminder, replication is paused on a per-volume basis (for a pair), not for the entire cluster.

Example of a paused volume replication on the destination cluster (which we can tell by the direction of the arrow, `<=`):

![Pause SolidFire replication for a volume](/assets/images/solidfire-kubernetes-replication-failover-failback-06-paused-replication.png)

### Why use Retain for replicated volumes

We could use Delete, too. If your protected volumes use Delete, you don't have to deal with Retain'ed PVs. Very convenient! Buuuut, when you release a PVC its PV gets both deleted *and* purged. Annnnd ... it's gone!

If replication is active, you still have a good copy at the remote site (at least you had when you last checked three weeks ago). You may need to replicate that data back and within hours you'll recover from that mistake. What you don't want is to to make two mistakes at the same time (lose a volume *after* you've already lost a site).

The second thing to consider is snapshots. If you use CSI snapshots, presumably you want to be able to recover from data loss. In order to protect snapshots, PV should be Retain'ed so that released PVC don't purge PVs and effectively invalidate snapshot protection.

So there are multiple reasons why Retain is a safer approach to critical data, especially when there's a lot of it and you can't instantly re-replicate mistakenly reclaimed volumes.

### SolidFire replication and Kubernetes Snapshot Volume Class

For important data, Volume Snapshot Class could also be set to Retain. But you'd be unable to expire such Snapshots (they'd remain Retain'ed, just like PVs with reclaimPolicy set to Retain).

Also note that Trident doesn't include snapshots into replication configuration of underlying volume, so what you could do is:

- schedule snapshots in SolidFire independently of Kubernetes (which would make them crash-consistent snapshots) and include them in replication if the underlying volume is replicated (which know it is). This is easy and convenient. You don't get application-consistent snapshots (unless you suspend the app that uses that volume), but you don't have to deal with Kubernetes and it's extremely easy to automate (both schedules and retention) with tools like PowerShell or Ansible.
- make snapshot replication part of your snapshot workflow: take a Kubernetes snapshot, find its snapshot ID on SolidFire, and enable its replication with the underlying volume
- use external application and data protection solution that understands Kubernetes and leverages CSI snapshots to do this for you

Mind the maximum number of snapshots per volume (30-ish).

Example of a Snapshot ID 1830 of a Volume ID 221:

![SolidFire snapshot at Standby site](/assets/images/solidfire-kubernetes-replication-failover-failback-02-volume-snapshot-replication.png)

### Dealing with different types of storage cluster failures

This is another can of worms, but we assume that for asynchronous replication all Source volumes failed (stopped being updated) at the same time and all paired volumes at the Destination received updates to the same time point.

If that assumption isn't accurate and that matters, use synchronous replication or use async replication with a separate schedule for group snapshots included in replication. 

In the latter case you'd have a common point-in-time state for a bunch of related replica volumes, and with such snapshots replicated to the remote site you could first revert all related volumes to the same snapshot, and then continue failover. Of course, you'd miss some latest changes as snapshots take minutes to get replicated and can be scheduled to 5 minute or higher intervals. There's no group snapshots in Kubernetes, but as far as I know (I'm lazy to check now), so configure and schedule - including for replication - group snapshots in SoldiFire if you need them.

### Conduct failover and failback testing

With SolidFire that is very easy. With only a few hours of work you could create an end-to-end (storage, pods, applications) automated test plan that runs on its own every day.

Before modern storage people used to pause replication, promote replicas to read-write mode for testing, and revert to resume replication once they're done. You can pause replication with SolidFire, but you don't have to.

![Pause SolidFire volume replication](/assets/images/solidfire-kubernetes-replication-failover-failback-03-pause-volume-replication.png)

SolidFire is space-efficient and easy to automate, so personally I'd prefer this:

- clone replicated volume (give it a unique name, such as the current name prefixed with `test` so that `$NAME` becomes `test-$NAME`)
- assign that volume to another SolidFire storage account (`trident-test`, for example). Now Kubernetes can't even see it. You can serve this iSCSI clone volume over a different iSCSI VLAN, if you want to ensure additional segregation for security or performance
- stand up a Kubernetes test cluster and add a new Trident back-end to it (to use the `trident-test` account), so that it can see the cloned volume to be used for running various tests
- run `tridentctl import volume -n $TRIDENT-NAMESPACE test-$NAME` to import cloned volume

Optionally:

- adjust QoS on this (or all `test-*` volumes) to give it less performance (you could create a set of low performance policies for testing, so that you can simply apply them in one second with `Get-SFVolume -Name test* | Set-SFVolume -QoSPolicyId 7)`, for example)
- use a SC with the retention policy Delete, if you don't want to hang onto deleted test volumes and their snapshots
- when you're done, you can delete all PVCs (and PVs) of your *test* clones, but you can also leave them - they cost you (essentially) nothing! If you want to save IOPS, set all `test-*` volumes to Min/Max/Burst 50/50/100 IOPS when not using them, and `Get-SFVolume -Name test* | Set-SFVolume -QoSPolicyId 7)` when you need them
- when you want to test with latest replica data, use the SolidFire Copy Volume (not Clone Volume) method to eliminate the need to clone again (`Copy-SFVolume`). This command copies the difference between volumes so in less than a minute you'll have latest data and won't have to clone and import again
- evaluate whether it makes sense to use non-managed volume import (see the Trident documentation) and set reclaimPolicy to Delete (for test/dev)

Finally, SolidFire Demo VM (free download from the NetApp support Web site) is excellent for this type testing in a VMware environment.

You can develop automation and run replicated test clusters without dedicated physical hardware - all you need is 4 VMs (2 Kubernetes and 2 SolidFire). That is what I used to write this post (apart from the ARM64 screenshot which is just a screenshot taken while working on the [Trident-on-ARM64](https://scaleoutsean.github.io/2021/02/24/netapp-trident-on-arm64.html) post).

### Automate storage failover steps

- Using `tridentctl import volume` (CSI-compatible approach): TODO
- Using PV patching approach with pre-CSI K8s: evaluate and adjust [this script](https://github.com/scaleoutsean/sf-failover-k8s) if possible

### Video demo

- SolidFire storage cluster failover using PostgreSQL: [quick version](https://youtu.be/aSFxlGoHgdA) (2m56s) - PostgreSQL failover and failback, with scripted CLI commands
- SolidFire storage cluster failover with the focus on Trident CSI behavior, using a PVC/PV pair: [detailed version](https://youtu.be/kvy9I7rwfn8) (10m55s) - features just a PV failover/failback, with detailed CLI commands
