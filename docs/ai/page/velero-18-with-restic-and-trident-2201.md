# Velero V1.8 with Restic, SolidFire 12.3 and StorageGRID 11.5

Update of Restic-driven backup with Velero 1.8, SolidFire 12.3 and StorageGRID 11

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

- [Introduction](#introduction)
- [Backup and restore Kubernetes application data and metadata to S3](#backup-and-restore-kubernetes-application-data-and-metadata-to-s3)
- [Is this "good enough" or ...](#is-this-good-enough-or-)
- [Using Velero and Restic to backup regular SolidFire volumes](#using-velero-and-restic-to-backup-regular-solidfire-volumes)
- [Summary](#summary)

## Introduction

I wrote about Velero & Trident CSI (also about [Velero and StorageGRID](/2021/02/02/use-velero-with-netapp-storagegrid.html)) before, but since Velero V1.8 came out last month I've been wanting to write about it again.

My setup consists of one of the Kubernetes clusters used in previous post [Elasticsearch 8 with NetApp storage](/2022/03/06/elastic-elk-stack-on-netapp.html)), a three-node vanilla Kubernetes v1.23.4 running on ARM64 hardware. I looked forward to using [OpenStack-based Kubernetes cluster with Cinder CSI](/2022/03/02/openstack-solidfire-part-2.html) for this (specifically because Trident CSI isn't required for Restic-based backups), but due to a power loss incident yesterday part of my home lab was corrupted. So now I have to mention again that NetApp Trident currently works with x86_64 systems and other architectures can work if you [build it from source](/2021/02/24/netapp-trident-on-arm64.html) by yourself.

In any case, you need a Kubernetes cluster and Trident CSI isn't mandatory in this case because this post is about the non-CSI approach. You can also try the [CSI approach](/2021/02/08/use-velero-with-netapp-solidfire-and-trident-csi.html) if you're interested in that.

## Backup and restore Kubernetes application data and metadata to S3

- Prepare a bucket on StorageGRID and store your bucket credentials into a credentials file (or otherwise pass them to velero install command). My bucket is solidfire-velero and my credentials file is sg.velero:

```sh
[default]
aws_access_key_id=AAAAAAAAAAAAAAAAAAA
aws_secret_access_key=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
```

- Deploy Trident CSI and create a storage class to be used by Kubernetes pods. If Trident CSI is used, obviously you can use any back-end, whether it's SolidFire or any of several supported ONTAP-based products and services. E-Series users could try BeeGFS CSI.

- [Install Velero V1.8](https://velero.io/docs/v1.8/basic-install/) by telling it how you want it to work, where to find S3 credentials, what bucket you want to use and some S3-specific settings. Again, I'm not using volume snapshots here. That's why I `--use-restic` and do not `--use-volume-snapshots`.

```sh
velero install \
  --provider aws \
  --secret-file ./sg.velero \
  --plugins velero/velero-plugin-for-aws:v1.3.1 \
  --bucket solidfire-velero \
  --use-restic \
  --restic-pod-cpu-request=1000m \
  --restic-pod-cpu-limit=5000m \
  --restic-pod-mem-request=512Mi \
  --restic-pod-mem-limit=1024Mi \
  --use-volume-snapshots=false \
  --backup-location-config region=us-east-1,s3ForcePathStyle="true",s3Url=https://s3.com.org
```

Next, create a backup and try to restore it.

Here there aren't any NetApp-specific steps. I deployed Elasticsearch 8.0.1 (see the linked Elasticsearch on NetApp storage post for more on that), but this time into its own namespace. That resulted in a Stateful Set with one Elasticsearch pod (I had only one) in the namespace elastic-system. It also automatically created a PVC that landed on a PV on SolidFire.

I annotated the Elasticsearch pod to have it included in backup.

```sh
$ kubectl describe pod/elasticsearch-master-0 -n elastic-system | grep Annotations
Annotations:  backup.velero.io/backup-volumes: elasticsearch-master-elasticsearch-master-0
```

Then I created a backup. Annotations make it easier to exclude PV's and other resources that we do not want to have backed up.

```sh
$ velero backup create elasticsearch-demo --include-namespaces elastic-system
Backup request "elasticsearch-demo" submitted successfully.
Run `velero backup describe elasticsearch-demo` or `velero backup logs elasticsearch-demo` for more details.
```

Logs indicate the pod and PV data were backed up:

```sh
$ velero backup logs elasticsearch-demo
time="2022-03-15T06:24:26Z" level=info msg="Setting up backup temp file" backup=velero/elasticsearch-demo logSource="pkg/controller/backup_controller.go:556"
...
time="2022-03-15T06:24:27Z" level=info msg="Backing up all pod volumes using restic: false" backup=velero/elasticsearch-demo logSource="pkg/backup/backup.go:228"
...
time="2022-03-15T06:24:35Z" level=info msg="Backed up 33 items out of an estimated total of 33 (estimate will change throughout the backup)" backup=velero/elasticsearch-demo logSource="pkg/backup/backup.go:399" name=elasticsearch-master-headless-5swbj namespace=elastic-system progress= resource=endpointslices.discovery.k8s.io
time="2022-03-15T06:24:36Z" level=info msg="Backed up a total of 33 items" backup=velero/elasticsearch-demo logSource="pkg/backup/backup.go:424" progress=
```

Backups:

```sh
$ velero backup get
NAME                 STATUS      ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
elasticsearch-demo   Completed   0        1          2022-03-15 06:24:26 +0000 UTC   29d       default            <none>
```

Some interesting parts from the job details (abbreviated output):

```sh
$ velero backup describe elasticsearch-demo --details
Name:         elasticsearch-demo
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/source-cluster-k8s-gitversion=v1.23.4
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=23

Phase:  Completed

Errors:    0
Warnings:  1

Namespaces:
  Included:  elastic-system
  Excluded:  <none>

Resources:
  Included:        *
  Excluded:        <none>
  Cluster-scoped:  auto

Label selector:  <none>

Storage Location:  default

Velero-Native Snapshot PVs:  auto

<SNIP>

Backup Format Version:  1.1.0

Started:    2022-03-15 06:24:26 +0000 UTC
Completed:  2022-03-15 06:24:36 +0000 UTC

Expiration:  2022-04-14 06:24:26 +0000 UTC

Total items to be backed up:  33
Items backed up:              33

Resource List:
  
  <SNIP>

  v1/Namespace:
    - elastic-system
  v1/PersistentVolume:
    - pvc-88918eb7-c4e4-4838-bc42-936a93689be6
  v1/PersistentVolumeClaim:
    - elastic-system/elasticsearch-master-elasticsearch-master-0
  v1/Pod:
    - elastic-system/elasticsearch-master-0
  <SNIP>

Velero-Native Snapshots: <none included>
```

As you can see, PVC and PV were backed up without snapshots.

The bucket solidfire-velero on StorageGRID got two "subdirectories" one "restic" which stores Restic backup data, and another "backups" where various metadata and K8s application backup data goes. List of objects in this second (K8s data and metadata) tree, solidfire-velero/backups/elasticsearch-demo:

```sh
[2022-03-15 14:24:37 CST]    29B elasticsearch-demo-csi-volumesnapshotcontents.json.gz
[2022-03-15 14:24:38 CST]    29B elasticsearch-demo-csi-volumesnapshots.json.gz
[2022-03-15 14:24:36 CST] 4.4KiB elasticsearch-demo-logs.gz
[2022-03-15 14:24:38 CST]    29B elasticsearch-demo-podvolumebackups.json.gz
[2022-03-15 14:24:38 CST]   502B elasticsearch-demo-resource-list.json.gz
[2022-03-15 14:24:38 CST]    29B elasticsearch-demo-volumesnapshots.json.gz
[2022-03-15 14:24:37 CST] 138KiB elasticsearch-demo.tar.gz
[2022-03-15 14:24:36 CST] 2.0KiB velero-backup.json
```

![Velero backup in StorageGRID S3 bucket](/assets/images/velero-restic-solidfire-storagegrid-bucket-listing.png)

Now we can wipe Elasticsearch (the entire namespace, which would also destroy the PVC and PV in it) and try to restore everything from this backup. I also had a scheduled backup in place so I used a specific backup instance:

```sh
velero restore create --from-backup elastic-daily-20220315010024
```

This recreated the namespace, PVC and PV on SolidFire. The new PVC was named the same, and Trident recreated PV that was destroyed before. We have new volume that's visible in tridentctl and kubectl output.

```sh
$ ./tridentctl -n trident get backend 
+--------------------------+----------------+--------------------------------------+--------+---------+
|           NAME           | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+--------------------------+----------------+--------------------------------------+--------+---------+
| solidfire_192.168.103.34 | solidfire-san  | 246879c3-3738-4893-8174-138e75d0610b | online |       1 |
+--------------------------+----------------+--------------------------------------+--------+---------+

$ kubectl get pvc -n elastic-system
NAME                                          STATUS   VOLUME                                     CAPACITY    ACCESS MODES   STORAGECLASS   AGE
elasticsearch-master-elasticsearch-master-0   Bound    pvc-88918eb7-c4e4-4838-bc42-936a93689be6   1953125Ki   RWO            iscsi-bronze   73m
```

## Is this "good enough" or ...

It depends.

First, a simplified approach like the one from this post may not work well for databases and database-like applications that span multiple volumes. If Elasticsearch Stateful Set spanned several pods, extra steps would be required to minimize RPO (such as freeze and unfreeze hooks).

Second, in some cases Velero would benefit from CSI snapshots, especially if we could take several snapshots at the same time (which SolidFire can do with Group Snapshots and ONTAP with Consistency Groups). Example:

![SolidFire Group Snapshot](/assets/images/solidfire-group-snapshot.png)

Third, about backup destinations. I used StorageGRID for this demo and have tried Velero with both StorageGRID and MinIO. The Velero documentation has convenient examples with Kubernetes-based MinIO, but backing up Kubernetes apps to MinIO running on the same Kubernetes cluster doesn't sound very reassuring to me. I know MinIO can be installed elsewhere, but if one wants a reliable object store to keep their data for months or years, they may as well buy StorageGRID appliances and get worry-free object storage.

In some cases we'd probably be better off with the CSI approach (to the extent that it works in Velero - currently generic CSI support is still in beta; I haven't tested CSI backup in V1.8 yet) and in other cases you may want to simply buy something that works, such as [NetApp Astra Control Center](https://docs.netapp.com/us-en/astra-control-center/) and get everything you need to protect your business-critical K8s data and applications.

Last week I blogged about [VMware Photon OS with iSCSI and SolidFire](/2022/03/11/vmware-photon-iscsi-solidfire.html) because Photon OS with iSCSI client would give us the ability to run Trident CSI on Photon OS and backup PV data with Velero CSI. vSphere CSI supports Velero, but that doesn't use Trident CSI (it seems vSphere CSI Plugin is the only supported CSI provisioner, which can work with SolidFire (creates PVs as VMDKs on VMFS) and if you wanted to use Velero CSI with Trident you could, but without VMware support). So this remains another area of investigation into native Trident CSI integrations.

## Using Velero and Restic to backup regular SolidFire volumes

Last year I created a PoC project for SolidFire backup to S3 called "solidbackup" that uses SolidFire clones to make copies from SolidFire volume snapshots, and takes advantage of Restic or other backup utility (it's customizable) to backup that clone-from-snapshot data to S3. It runs from Linux VM and can't handle non-Linux filesystems.

One of the reasons I wanted to try Velero again was to understand if Velero scheduled backups could replace the bulk of solidbackup. While solidbackup targets non-Kubernetes workloads on Linux (KVM, generic Linux, Trident Docker volumes), it could be improved:

- Create (or update) Solidfire clone volumes as usual ([this step](/2021/05/08/revisiting-solidbackup.html#create-configuration-and-keep-src--dst-clone-volumes-in-sync) using solidsync script from solidbackup). solidsync could also run from Kubernetes.
- Then, instead of running backup from a dedicated VM (the next step in that post above), reassign clone volume ownership to a Trident account of a small Kubernetes cluster with Velero Restic (this involves just one cmdlet (Set-SFVolume -VolumeID 1 -AccountID 2) in PowerShell)
- Now that clone volume is owned by the Trident user, import it to Kubernetes

```sh
$ tridentctl import volume <backendName> <volumeName> --no-manage
```

As an example, I have an Elasticsearch data volume from a Docker container from that recent post on Elasticsearch 8. Let's pretend a took a cold snapshot or "smart" snapshot from which I can clone that data volume and name it "sb-test". I need to reassign its tenant account ownership from "elk" (which is what Trident Docker Volume Plugin used) to "arm64" (which is what Trident CSI is using in this Velero environment).

![Clone a non-K8s volume for backup by Velero](/assets/images/velero-restic-solidfire-solidbackup.png)

This costs me almost nothing capacity-wise.

Now I can import that clone to a K8s namespace such as "solidbackup".

```sh
$ cat pvc-basic-import-for-sb.yml 
---
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: sb-test
  namespace: solidbackup
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: iscsi-bronze-xfs

$ ./tridentctl import volume solidfire_192.168.103.34 sb-test -f pvc-basic-import-for-sb.yml --no-manage -n trident
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|                   NAME                   |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| pvc-3e284148-e984-447e-b3c1-9080d68a943d | 3.0 GiB | iscsi-bronze  | block    | 246879c3-3738-4893-8174-138e75d0610b | online | false   |
+------------------------------------------+---------+---------------+----------+--------------------------------------+--------+---------+

$ kubectl get pvc -n solidbackup
NAME      STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
sb-test   Bound    pvc-3e284148-e984-447e-b3c1-9080d68a943d   3Gi        RWO            iscsi-bronze   24s

```

- Create a dummy pod (I just used NGINX because it was handy, but it shouldn't be something that shares data), attach it to the imported volume and annotate (abbreviated):

```sh
Name:         sb-pod
Namespace:    solidbackup
Priority:     0
Node:         k2/192.168.1.19
Start Time:   Tue, 15 Mar 2022 09:34:49 +0000
Labels:       <none>
Annotations:  backup.velero.io/backup-volumes: sb-test
...
Containers:
  sb-container:
    Container ID:   docker://9bbbf296ff8612b8d318f44aab29946f48c228e20fff6b308e0efc1784c66b3e
    Image:          nginx
    ...
    Mounts:
      /usr/share/nginx/html from sb-test (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-sgbhv (ro)
Conditions:
  Type              Status
  Initialized       True 
  Ready             True 
  ContainersReady   True 
  PodScheduled      True 
Volumes:
  sb-test:
    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)
    ClaimName:  sb-test
    ReadOnly:   false
```

- Create a Velero backup schedule for the clones to backup applications and data to StorageGRID S3

```sh
$ velero backup create sb-demo --include-namespaces solidbackup
Backup request "sb-demo" submitted successfully.
Run `velero backup describe sb-demo` or `velero backup logs sb-demo` for more details.

$ velero backup get 
NAME                 STATUS      ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
elasticsearch-demo   Completed   0        1          2022-03-15 06:24:26 +0000 UTC   29d       default            <none>
sb-demo              Completed   0        1          2022-03-15 09:10:53 +0000 UTC   29d       default            <none>
```

The above backup command clearly wasn't scheduled because I didn't want to have a schedule, but a schedule could be created like this:

```sh
velero schedule create sb-demo-daily --include-namespaces sb-demo --schedule="0 1 * * *"
```

Either way, that pod and persistent volume would be backed up. From detailed job description:

```sh
Resource List:
  ...
  v1/PersistentVolume:
    - pvc-3e284148-e984-447e-b3c1-9080d68a943d
  v1/PersistentVolumeClaim:
    - solidbackup/sb-test
  ...
Restic Backups:
  Completed:
    solidbackup/sb-pod: sb-test
```

So both a backup and restore completed successfully. Unlike the first Elasticsearch demo that was created from scratch and didn't have a lot of data in it, this volume used to be attached to Elasticsearch that ran for hours contributing to growth of used space in the Velero backup bucket.

![Velero Restic-backed bucket with 420 MB of data](/assets/images/velero-restic-solidfire-storagegrid-solidbackup-restic-data-00.png)

Restic-related data directory for the job was populated with directories created by Restic:

![Velero Restic backup data directory](/assets/images/velero-restic-solidfire-storagegrid-solidbackup-restic-data-01.png)

Individual files from the compressed Elasticsearch data (we can't see the original files because of Restic compression) is what drove backup bucket utilization up:

![Velero Restic backup files](/assets/images/velero-restic-solidfire-storagegrid-solidbackup-restic-data-02.png)

Something I hadn't noticed last year is that restore jobs are logged in a restores "subdirectory" of the Velero bucket, here solidfire-velero/restores/sb-demo-20220315095143/:

```sh
[2022-03-15 17:55:46 CST] 1.9KiB restore-sb-demo-20220315095143-logs.gz
[2022-03-15 17:55:46 CST]   244B restore-sb-demo-20220315095143-results.gz
```

Restore workflow wouldn't be more complex than with original solidbackup. As solidbackup README.md says:

 - The first line of defense is volume snapshots (of the original volume)
 - The second is recreate the volume from clone assigned to K8s, and assign it to the original Linux/KVM/Docker account
 - The third is to restore data to a PV with Velero/Restic (similar to these screenshots right above), and then make a clone while assigning clone ownership to the Linux/KVM/Docker storage account

Some of the benefits this would have compared to the all-in-one approach originally taken by solidbackup:

- solidbackup users can get unified backup and restore for KVM, K8s, Docker with Velero - we just need to create and import clones to a Kubernetes cluster with Trident CSI
- solidsync jobs could run in Kubernetes, getting a better protection for SolidFire API credentials
- backup jobs would be Velero-based, giving you improved security and full auditing (use Kubernetes namespaces for clones from different teams, and per-backup-storage-location credentials to address security issues, and use ELK for auditing and logging)
- solidbackup cannot scale (it's constrained by single VM performance), but Velero on Kubernetes can - we get better performance via scale-out (automatically add new worker nodes if you need to run more backup jobs at the same time)
- get self-service data protection with RBAC from both the CLI and UI, albeit a more complex workflow than what you get with commercial data protection software

In short, this approach is the same as the original solidbackup approach, but moves everything - from the handling of secrets over logging to monitoring and auditing to Velero on Kubernetes, and provides a way to scale out backup and restore performance.

Only the first step (cloning of volumes in backup configuration file) needs to be done outside of Velero, but that is SolidFire API-specific and would have to be done anyway to make non-K8s volumes accessible to Velero. Current cloning script (solidsync) could run out of a Kubernetes container to create a fully Kubernetes-based backup solution for SolidFire. The only "cost" is extra utilization of metadata capacity on SolidFire, so as long as you're below 40% of maximum metadata capacity (90% of clusters likely are), this approach can be useful.

Let's not forget that any volume cloning and other API calls are registered in SolidFire API logs which can be sent to ELK for auditing, so that volume owners can always review what happened in each step, both before the clones were assigned to K8s (solidsync) and after (Velero/Restic). Everything can be logged and audited.

## Summary

Non-CSI Velero V1.8 feels more mature (documentation, behavior) and user-friendly than the version I tested over a year ago and has additional features compared to Velero V1.5 tested back then. 

While the backup to S3 feature is almost identical to features from the Velero-with-StorageGRID post I did a while ago, now Velero can use per-back-end credentials which is interesting to general users but also niche use cases like solidbackup. It would be interesting to try StorageGRID's Object Lock policy with Velero backups, but I couldn't try that on the StorageGRID cluster used in this demo.

I would prefer to see Velero's [CSI support](https://velero.io/docs/v1.8/csi/) become GA so that it can be used with CSI-native snapshots in Trident CSI to cover additional use cases.

Users with enterprise-grade data protection requirements should still consider a commercial solution such as NetApp Astra Control or other.
