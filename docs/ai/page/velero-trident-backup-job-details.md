# Velero v1.13 metadata, hooks with NetApp Trident v24.02

A look at the backup job details with Velero v1.13 CSI and NetApp Trident with SolidFire

- [Introduction](#introduction)
- [Backup detail enhancements in Velero v1.13](#backup-detail-enhancements-in-velero-v113)
  - [Mapping Velero jobs to SolidFire volume and snapshot objects](#mapping-velero-jobs-to-solidfire-volume-and-snapshot-objects)
- [How many Velero instances for two sites with a SolidFire cluster on each](#how-many-velero-instances-for-two-sites-with-a-solidfire-cluster-on-each)
- [Conclusion](#conclusion)
- [Appendix A - configuration details](#appendix-a---configuration-details)
- [Appendix B - backup and details](#appendix-b---backup-and-details)
- [Appendix C - restore and delete](#appendix-c---restore-and-delete)
- [Appendix D - using Velero hooks](#appendix-d---using-velero-hooks)

## Introduction

I've been blogging on Velero with NetApp Trident for years (more than three, for now) ever [since Velero v1.5.3](/2021/02/08/use-velero-with-netapp-solidfire-and-trident-csi.html). But because I don't use it day to day, I am not very good at it.

Still -or because of that - I keep an eye on what's going on with Velero.

Six-seven weeks ago Velero [v1.13](https://github.com/vmware-tanzu/velero/releases/tag/v1.13.0) came out so I wanted to take some notes on its changes.

I'll focus on one particular change that's most relevant to me but there are other nice improvements so I encourage you to check the release page.

## Backup detail enhancements in Velero v1.13

Velero backup description now supports showing information of CSI snapshot data movements, which was not supported in v1.12 and earlier.

When v1.12 came out I blogged about Velero's CSI snapshot data movement [here](/2023/09/15/velero-csi-snapshot-data-movement-with-netapp-solidfire.html) and I think it's an underestimated feature, especially for SolidFire users (because it is more limited due to the maximum number of snapshots being 32, whereas ONTAP can take and retain thousands).

In v1.13 those and other details are available in backup job details, making data management easier and more transparent.

If we run `velero backup` and run then `backup describe` on the backup we just created, backup job details describes information for all the volumes and snapshots included in the backup of various backup types, such as whether it's a native (SolidFire) snapshot, CSI snapshot or CSI snapshot data movement.

Originally I had the entire flow in the main body of this post, but I moved that to appendices because there's too much text in it. 

This screenshot - repeated in Appendix B as well - is hopefully enough to illustrate the main details.

![Mapping from Velero to Trident to SolidFire](/assets/images/velero-trident-solidfire-description-00.png)

### Mapping Velero jobs to SolidFire volume and snapshot objects

Going further "down" the stack, we get to SolidFire where PVC names are decided by Trident.

Snapshot names are `snapshot-ID` and tied to volume names, but snapshot UUIDs are completely random. Still, the SolidFire API is very easy to use, so once we get a hold of one of those, the rest are very easy to find.

I wrote about that in various posts, but I'll highlight two.

**OpenStack Xena with Cinder CSI** talks about the [mapping](/2022/03/02/openstack-solidfire-part-2.html#appendix-a---map-kubernetes-pvc-and-pv-to-openstack-volume-name-to-solidfire-volume-name) between OpenStack and SolidFire storage objects. Note that we aren't using NetApp Trident here, but rather Cinder CSI and it works great!

[SolidFire site failover and failback with Trident clients](/2021/03/20/kubernetes-solidfire-failover-failback.html#solidfire-volume-names-and-ids) explains how things get tricky during storage cluster failover and failback because volume names can't be human friendly, and the reason is Trident isn't conductive to SolidFire cluster failover. 

Anyway, that's not a problem as long as you decide to ignore volume names and decide to automate. It's not easy to give up the idea of human-friendly names, but giving up on it gives you the energy to move on and simply automate for scale and care-free storage cluster failover. 

## How many Velero instances for two sites with a SolidFire cluster on each

I don't know. But I wonder about that, because I mentioned that due to the way Trident works (at least with `solidfire-san`), the easiest (and still not easy) way to fail over to another site involves re-installing Trident and importing data from a configuration file. 

I did that once in PowerShell, and it worked great (see the Trident failover/failback post - it took a minute to failover from one SolidFire to another, and back). 

But now I wonder how Velero backup details can help us restore S3 backups at a different site. If we purely rely on namespaces, then it's probably easy as we can ignore storage names. 

But, as I mentioned in those other posts, you may have large volumes that are replicated asynchronously by SolidFire. 

Say you have an 8 TB volume that's replicated that way, by copying over SolidFire snapshot deltas - one every 5 minutes. 

Even if you use Velero to backup four times a day, you may still have hours of data loss if you only rely on Velero backups. 

In that case, if asynchronous replication is configured on SolidFire, it's better to automate that failover as I mentioned in the failover/failback article, and separately, test one (or two, if you have one for each site) Velero instances in such cases to make sure your view of Velero backups does not lose relevance regardless of how sites change, or which SolidFire cluster you use. 

Figuring that out would also help you with "DR to the cloud", or "DR to on-premises" if you want to repatriate some Kubernetes workloads or use on-premises SolidFire for Dev/Test.

Velero backup metadata is stored in Velero's S3 bucket (if that's your backup destination), Kubernetes and Trident information is stored on each Kubernetes cluster, and SolidFire information is stored just on SolidFire. If you want to get a big picture of what's going on, it may be hard to assess or visualize all that information.

Perhaps it would be useful to drive Velero, Trident and SolidFire automation from a job scheduler, and send responses to something like Elasticsearch, so that queries can be created for volume history, or that different data properties can be queried and tracked over time. For SolidFire I've done that many times, including [here](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html) for API log.

We could use SolidFire Demo VMs to prototype that - we'd need just 4 VMs (2 for Kubernetes clusters, and 2 SolidFire VMs to for two storage clusters).

## Conclusion

My objective was to examine the new level of detail related to PVCs, PVS in Velero v1.13.

In the very first CSI post with Velero v1.5.3 from early 2021 I see:

- Backup Volumes > CSI Snapshots: Snapshot Content Name wasn't included
- Backup Item Operations: this section did not exist

The level of detail is now very good and makes it easy to feed those details into a central location where it can be cross referenced with Trident and SolidFire logs or API audit log, for example. 

Even without additional work, just knowing the entire "lineage" of a backup, from SolidFire volume over PV/PVC to CSI snapshot is great - especially when snapshot names that exist in Velero are not visible in `get volumesnapshot` output (which seems to be how it works, to prevent accidental deletion).

If an applications is already gone, being able to trace these things is even more important because there's nothing to see on storage or Kubernetes - at that point all you have may be what Velero backup details can give you. 

Or, if you collected logs and data from Kubernetes and SolidFire, you may even be abel to find out the old Storage Class / QoS settings for the volume, the original efficiency ratio and some other useful details.

Apart from that backup detail, Velero now behaves more in line with expectations. Earlier, and especially early releases, had both bugs and seemingly illogical behavior. 

I'm sure some backup and restore options could be used to make Velero work even better. In Appendix D I give an example of using hooks to suspend filesystem IO before backup, and in my [next post](2024/03/23/velero-netapp-verda-scripts-and-trident.html) I'll show how to use hook scripts from NetApp's Verda repository.

## Appendix A - configuration details

This time I tested on a x86_64 system, but the entire stack also works on ARM64 systems (and you can get pre-built Trident v24.02 for ARM64 [here](/2024/03/21/netapp-trident-v2402-arm64.html) if you want to try that).

```sh
$ cat /etc/lsb-release 
DISTRIB_ID=Ubuntu
DISTRIB_RELEASE=24.04
DISTRIB_CODENAME=noble
DISTRIB_DESCRIPTION="Ubuntu Noble Numbat (development branch)"

$ k3s --version
k3s version v1.28.7+k3s1 (051b14b2)
go version go1.21.7

$ kubectl version -o yaml
clientVersion:
  major: "1"
  minor: "28"
serverVersion:
  major: "1"
  minor: "28"
  platform: linux/amd64

$ ./tridentctl -n trident version
+----------------+----------------+
| SERVER VERSION | CLIENT VERSION |
+----------------+----------------+
| 24.02.0        | 24.02.0        |
+----------------+----------------+

sean@minikube:~/k2$ velero version
Client:
	Version: v1.13.1
	Git commit: ea5a89f83b89b2cb7a27f54148683c1ee8d57a37
Server:
	Version: v1.13.1

```

SolidFire was version 12.5, running in a VM on VMware ESXi 7 (x86_64). There's no ARM64 version of this, but it can be used by ARM64 clients as you can see from previous Velero posts where an ARM64-based stack was used.

Trident has just one back-end, `solidfire-san`, and there's one storage class for which there's also a volume snapshot class.

```sh
$ ./tridentctl -n trident get backend 
+--------------------------+----------------+--------------------------------------+--------+------------+---------+
|           NAME           | STORAGE DRIVER |                 UUID                 | STATE  | USER-STATE | VOLUMES |
+--------------------------+----------------+--------------------------------------+--------+------------+---------+
| solidfire_192.168.105.30 | solidfire-san  | 6ebdc64a-76bd-4e2e-969f-64bcd575e288 | online | normal     |       3 |
+--------------------------+----------------+--------------------------------------+--------+------------+---------+

$ kubectl get sc
NAME                   PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
local-path (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  3h32m
silver (default)       csi.trident.netapp.io   Retain          Immediate              true                   122m

$ kubectl get volumesnapshotclass
NAME                    DRIVER                  DELETIONPOLICY   AGE
trident-snapshotclass   csi.trident.netapp.io   Delete           103m

$ kubectl describe sc silver
Name:            silver
IsDefaultClass:  Yes
Annotations:     kubectl.kubernetes.io/last-applied-configuration={"allowVolumeExpansion":true,"apiVersion":"storage.k8s.io/v1","kind":"StorageClass","metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true","trident.netapp.io/blockSize":"4096"},"name":"silver"},"mountOptions":["discard"],"parameters":{"IOPS":"800","backendType":"solidfire-san","clones":"true","fsType":"xfs","snapshots":"true"},"provisioner":"csi.trident.netapp.io","reclaimPolicy":"Retain"}
,storageclass.kubernetes.io/is-default-class=true,trident.netapp.io/blockSize=4096
Provisioner:           csi.trident.netapp.io
Parameters:            IOPS=800,backendType=solidfire-san,clones=true,fsType=xfs,snapshots=true
AllowVolumeExpansion:  True
MountOptions:
  discard
ReclaimPolicy:      Retain
VolumeBindingMode:  Immediate
Events:             <none>

$ kubectl describe volumesnapshotclass trident-snapshotclass
Name:             trident-snapshotclass
Namespace:        
Labels:           <none>
Annotations:      <none>
API Version:      snapshot.storage.k8s.io/v1
Deletion Policy:  Delete
Driver:           csi.trident.netapp.io
Kind:             VolumeSnapshotClass
Metadata:
  Creation Timestamp:  2024-03-22T08:22:59Z
  Generation:          1
  Resource Version:    3787
  UID:                 68518d1a-a1cb-47ab-9744-efb8a8a1618c
Events:                <none>

```

## Appendix B - backup and details

Let's see how that works. Details of my setup are in Appendix A.

Velero was installed as usual - please see my older posts about this (but note that AWS and CSI plugin versions are newer, so it's best to read the Velero documentation and decide what's relevant for you). 

I have a SolidFire-based Trident Storage Class and Volume Snapshot Class. 

While "warming up" for Velero I "manually" created two test PVCs and a test snapshot using `kubectl`. Then I removed the first volume.

Because my storage class has "retains" deleted volumes, I ended up with three volumes on SolidFire - one deleted and two in my target namespace (of which one was for testing, and the other one was in use by application protected by Velero).

![](/assets/images/velero-trident-solidfire-description-02.png)

There's also a manually-created (not by Velero) snapshot of the testing volume that appears in CLI output, so don't get confused by those.

Our app is NGINX and it runs in the namespace called `important` where it uses just one volume. That's it. 

```sh

$ kubectl get statefulset -n important
NAME   READY   AGE
web    1/1     120m

$ kubectl describe statefulset web -n important
Name:               web
Namespace:          important
CreationTimestamp:  Fri, 22 Mar 2024 16:13:03 +0800
Selector:           app=nginx
Labels:             <none>
Annotations:        <none>
Replicas:           1 desired | 1 total
Update Strategy:    RollingUpdate
  Partition:        0
Pods Status:        1 Running / 0 Waiting / 0 Succeeded / 0 Failed
Pod Template:
  Labels:  app=nginx
  Containers:
   nginx:
    Image:        nginx:stable-alpine3.17
    Port:         80/TCP
    Host Port:    0/TCP
    Environment:  <none>
    Mounts:
      /usr/share/nginx/html from www (rw)
  Volumes:  <none>
Volume Claims:
  Name:          www
  StorageClass:  silver
  Labels:        <none>
  Annotations:   <none>
  Capacity:      2Gi
  Access Modes:  [ReadWriteOnce]
Events:          <none>

$ kubectl get pods -n important
NAME    READY   STATUS    RESTARTS   AGE
web-0   1/1     Running   0          118m

$ kubectl get pvc -n important
NAME        STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
www-web-0   Bound    pvc-9812208f-72f5-41d8-9348-4fb42db8e6af   2Gi        RWO            silver         123m
basic       Bound    pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4   2Gi        RWO            silver         124m
```

`www-web-0` is used by NGINX and that's the one I aim to backup with Velero. (`basic` is the idle test volume that hasn't been deleted and which has a manual snapshot.)

Let's backup the entire namespace:

```sh
$ velero backup create nginx-backup --include-namespaces important
Backup request "nginx-backup" submitted successfully.
Run `velero backup describe nginx-backup` or `velero backup logs nginx-backup` for more details.
```

After I executed the above, I described the backup job.

```sh
$ velero backup describe nginx-backup
Name:         nginx-backup
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/resource-timeout=10m0s
              velero.io/source-cluster-k8s-gitversion=v1.28.7+k3s1
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=28

Phase:  InProgress

Namespaces:
  Included:  important
  Excluded:  <none>

Resources:
  Included:        *
  Excluded:        <none>
  Cluster-scoped:  auto
```

I immediately realized I should have excluded the test volume ("basic") from that namespace, but as you can see "excluded" is "none" - it wasn't done, so both PVCs in the namespace were backed up.

Backup succeeded.

```sh
$ velero get backups
NAME           STATUS      ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION   SELECTOR
nginx-backup   Completed   0        0          2024-03-22 16:32:58 +0800 CST   29d       default            <none>
```

What about the highlight feature - backup details? 

snapcontent-2f7b... in Velero backup maps to SolidFire snapshot ID 281, for example (you may open images in new tab to see the original size).

![Backup details in Velero v1.13](/assets/images/velero-trident-solidfire-description-01.png)

Let's see this with `--details`. (Notice the junk volume "basic" was backed up due to being in target namespace and Velero took a snapshot of it, too.)

```sh
$ velero backup describe nginx-backup --details
...
Name:         nginx-backup
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/resource-timeout=10m0s
              velero.io/source-cluster-k8s-gitversion=v1.28.7+k3s1
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=28

Phase:  Completed

Namespaces:
  Included:  important
  Excluded:  <none>

Total items to be backed up:  49
Items backed up:              49

Backup Item Operations:
  Operation for volumesnapshots.snapshot.storage.k8s.io important/velero-www-web-0-ndwpw:
    Backup Item Action Plugin:  velero.io/csi-volumesnapshot-backupper
    Operation ID:               important/velero-www-web-0-ndwpw/2024-03-22T08:33:06Z
    Items to Update:
              volumesnapshots.snapshot.storage.k8s.io important/velero-www-web-0-ndwpw
    Phase:    Completed
    Created:  2024-03-22 16:33:06 +0800 CST
    Started:  2024-03-22 16:33:06 +0800 CST
  Operation for volumesnapshotcontents.snapshot.storage.k8s.io /snapcontent-2f7b608e-64b2-4a2f-9709-c185ec2fed16:
    Backup Item Action Plugin:  velero.io/csi-volumesnapshotcontent-backupper
    Operation ID:               snapcontent-2f7b608e-64b2-4a2f-9709-c185ec2fed16/2024-03-22T08:33:06Z
    Items to Update:
              volumesnapshotcontents.snapshot.storage.k8s.io /snapcontent-2f7b608e-64b2-4a2f-9709-c185ec2fed16
    Phase:    Completed
    Created:  2024-03-22 16:33:06 +0800 CST
    Started:  2024-03-22 16:33:06 +0800 CST
  Operation for volumesnapshots.snapshot.storage.k8s.io important/velero-basic-cx9b4:
    Backup Item Action Plugin:  velero.io/csi-volumesnapshot-backupper
    Operation ID:               important/velero-basic-cx9b4/2024-03-22T08:33:11Z
    Items to Update:
              volumesnapshots.snapshot.storage.k8s.io important/velero-basic-cx9b4
    Phase:    Completed
    Created:  2024-03-22 16:33:11 +0800 CST
    Started:  2024-03-22 16:33:11 +0800 CST
  Operation for volumesnapshotcontents.snapshot.storage.k8s.io /snapcontent-19977bfb-7652-44d3-ac17-f1b4038bd3e5:
    Backup Item Action Plugin:  velero.io/csi-volumesnapshotcontent-backupper
    Operation ID:               snapcontent-19977bfb-7652-44d3-ac17-f1b4038bd3e5/2024-03-22T08:33:11Z
    Items to Update:
              volumesnapshotcontents.snapshot.storage.k8s.io /snapcontent-19977bfb-7652-44d3-ac17-f1b4038bd3e5
    Phase:    Completed
    Created:  2024-03-22 16:33:11 +0800 CST
    Started:  2024-03-22 16:33:11 +0800 CST
Resource List:
  apiextensions.k8s.io/v1/CustomResourceDefinition:
    - volumesnapshots.snapshot.storage.k8s.io
  apps/v1/ControllerRevision:
    - important/web-66bbffc487
  apps/v1/StatefulSet:
    - important/web
  discovery.k8s.io/v1/EndpointSlice:
    - important/nginx-z4svx
  snapshot.storage.k8s.io/v1/VolumeSnapshot:
    - important/basicsnap
    - important/velero-basic-cx9b4
    - important/velero-www-web-0-ndwpw
  snapshot.storage.k8s.io/v1/VolumeSnapshotClass:
    - trident-snapshotclass
  snapshot.storage.k8s.io/v1/VolumeSnapshotContent:
    - snapcontent-19977bfb-7652-44d3-ac17-f1b4038bd3e5
    - snapcontent-2f7b608e-64b2-4a2f-9709-c185ec2fed16
    - snapcontent-2ffba5b9-b0b9-418b-bc2e-98d1e2c9c77e
  v1/ConfigMap:
    - important/kube-root-ca.crt
  v1/Endpoints:
    - important/nginx
  v1/Event:
    - important/basic.17bf07b8f5c6b4cd
    - important/web-0.17bf0802ec13dedd
    - important/web-0.17bf0802f0235aef
    - important/web.17bf07be5d0d47c1
    - important/web.17bf0800fdfddd52
    - important/www-web-0.17bf07be7808fb85
  v1/Namespace:
    - important
  v1/PersistentVolume:
    - pvc-9812208f-72f5-41d8-9348-4fb42db8e6af
    - pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4
  v1/PersistentVolumeClaim:
    - important/basic
    - important/www-web-0
  v1/Pod:
    - important/web-0
  v1/Service:
    - important/nginx
  v1/ServiceAccount:
    - important/default

Backup Volumes:
  Velero-Native Snapshots: <none included>

  CSI Snapshots:
    important/www-web-0:
      Snapshot:
        Operation ID: important/velero-www-web-0-ndwpw/2024-03-22T08:33:06Z
        Snapshot Content Name: snapcontent-2f7b608e-64b2-4a2f-9709-c185ec2fed16
        Storage Snapshot ID: pvc-9812208f-72f5-41d8-9348-4fb42db8e6af/snapshot-2f7b608e-64b2-4a2f-9709-c185ec2fed16
        Snapshot Size (bytes): 2147483648
        CSI Driver: csi.trident.netapp.io
    important/basic:
      Snapshot:
        Operation ID: important/velero-basic-cx9b4/2024-03-22T08:33:11Z
        Snapshot Content Name: snapcontent-19977bfb-7652-44d3-ac17-f1b4038bd3e5
        Storage Snapshot ID: pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4/snapshot-19977bfb-7652-44d3-ac17-f1b4038bd3e5
        Snapshot Size (bytes): 2147483648
        CSI Driver: csi.trident.netapp.io

  Pod Volume Backups: <none included>

HooksAttempted:  0
HooksFailed:     0

```

That is great!

Now, how does that map to Kubernetes, Trident and SolidFire?

```sh
$ kubectl get pvc -n important
NAME        STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS
www-web-0   Bound    pvc-9812208f-72f5-41d8-9348-4fb42db8e6af   2Gi        RWO            silver      
basic       Bound    pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4   2Gi        RWO            silver      

$ kubectl get volumesnapshot -n important
NAME        READYTOUSE   SOURCEPVC   RESTORESIZE   SNAPSHOTCLASS           SNAPSHOTCONTENT                                 
basicsnap   true         www-web-0   2Gi           trident-snapshotclass   snapcontent-2ffba5b9-b0b9-418b-bc2e-98d1e2c9c77e

$ kubectl get pv
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS     CLAIM                 STORAGECLASS
pvc-fc799089-9559-4d97-84c8-d98e9dfbf884   2Gi        RWO            Retain           Released   default/basic         silver      
pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4   2Gi        RWO            Retain           Bound      important/basic       silver      
pvc-9812208f-72f5-41d8-9348-4fb42db8e6af   2Gi        RWO            Retain           Bound      important/www-web-0   silver      

```

From `get pv` we see that early on (I deleted the AGE column, by the way, to save space) we had the volume `default/basic` and it was deleted. Since the Storage Class uses "Retain", the deleted PV is marked "Released" and still there on SolidFire. 

Volume claim "important/basic" is a test PVC, but "important/www-web-0" is our app's PVC and its PV name is `pvc-9812208f-72f5...`. As seen from `get pvc`, only two claims still exist, and `www-web-0` is the one we care about.

The snapshot `basicsnap` is also a manually created test object. Notice its SNAPSHOTCONTENT is snapcontent-2ffba5b9... That's the manual one. Velero's snapshot ID for the same volume is snapshot-19977bfb, and so "basic" has 2 snapshots.

In the Velero backup description above there's also snapcontent-***2f7b608e*** - that is snapshot of the volume used by NGINX.

So, related to our stateful set and its PVC "www-web-0", Velero details are:

- Velero snapshot operation detail: important/velero-www-web-0-ndwpw/2024-03-22T08:33:06Z
- Snapshot name: snapcontent-**2f7b608e**-64b2-4a2f-9709-c185ec2fed16
- Storage PV and Snapshot ID: pvc-9812208f-72f5-41d8-9348-4fb42db8e6af/snapshot-2f7b608e-64b2-4a2f-9709-c185ec2fed16
- Original PV (and therefore snapshot) size (bytes): 2147483648 (2Gi)
- CSI driver: csi.trident.netapp.io

Notice how the two Velero-created snapshots (snapcontent-2f7b608e... and snapcontent-19977bfb...) are still available on SolidFire, but not listed in "get volumesnapshot" output.

![](/assets/images/velero-trident-solidfire-description-03.png)

Maybe it's worth a mention that our Trident volume snapshot class "trident-snapshotclass" has the retention policy "Delete", but the snapshots are not listed - only the test snapshot "basicsnap" is. Assuming that is by design, that's a good thing because you won't accidentally delete "backups" referenced by Velero.

Other than that, you'd expect that you'd see all snapshots in "kubectl get volumesnapshots", but you don't. 

At the same time, `tridentctl` allows us to see *all* snapshots we took - 19977bfb and 2f7b608e taken by Velero, as well as the manually taken 2ffba5b9.

```sh
$ ./tridentctl -n trident get snapshot
+-----------------------------------------------+------------------------------------------+---------+
|                     NAME                      |                  VOLUME                  | MANAGED |
+-----------------------------------------------+------------------------------------------+---------+
| snapshot-2f7b608e-64b2-4a2f-9709-c185ec2fed16 | pvc-9812208f-72f5-41d8-9348-4fb42db8e6af | true    |
| snapshot-2ffba5b9-b0b9-418b-bc2e-98d1e2c9c77e | pvc-9812208f-72f5-41d8-9348-4fb42db8e6af | true    |
| snapshot-19977bfb-7652-44d3-ac17-f1b4038bd3e5 | pvc-a7b61fe0-7e9d-40f4-bc06-9c1623adade4 | true    |
+-----------------------------------------------+------------------------------------------+---------+

```

As a summary of this section, I'm again sharing that screenshot (which is larger and you can open it in new tab). 

![Mapping from Velero to Trident to SolidFire](/assets/images/velero-trident-solidfire-description-00.png)

It shows the ease of mapping Velero backup details to Kubernetes and SolidFire. (The unmarked snapshot-19977bfb was also taken by Velero, but I didn't mark it because it's a test volume.)

In hindsight I should have deleted those unrelated volumes and snapshots, but I realized that too late. I did that in Appendix C which doesn't have them.

## Appendix C - restore and delete

I performed a few more operations just to see if it behaves consistently with slightly different settings and workflows.

After backup taken in the main content, I deleted the testing volume and its manual CSI snapshot, then deleted the only Velero backup.

```sh
$ velero backup delete nginx-backup
Are you sure you want to continue (Y/N)? y
Request to delete backup "nginx-backup" submitted successfully.
The backup will be fully deleted after all associated data (disk snapshots, backup files, restores) are removed.

```

After that move, SolidFire snapshots were deleted from SolidFire, but the volume (and application) remained as expected.

The next Velero backup took another storage snapshot of the same NGINX volume, so now there was only one.

```raw
  CSI Snapshots:
    important/www-web-0:
      Snapshot:
        Operation ID: important/velero-www-web-0-5gjd2/2024-03-22T14:08:55Z
        Snapshot Content Name: snapcontent-51e370b3-6518-4528-a440-5a9f8416f073
        Storage Snapshot ID: pvc-9812208f-72f5-41d8-9348-4fb42db8e6af/snapshot-51e370b3-6518-4528-a440-5a9f8416f073
        Snapshot Size (bytes): 2147483648
        CSI Driver: csi.trident.netapp.io

```

I then deleted the stateful set and PVC, and restored data from Velero backup. This created a new volume (vol ID 118).

![Data restore creates a new volume](/assets/images/velero-trident-solidfire-description-04.png)

Volume 117 was still there (my Storage Class has Reclaim Policy set to Retain) and SolidFire would let you restore that pvc-9812208f (volume ID 117) from snapshot-51e370b3 (which is snapshot Velero created on that volume, just above).

But Velero instead spun a new volume from snapshot-51e370b3 and created volume 118. 

Then you may wonder what is the purpose of volume ID 117. It appears to be there because snapshot used by Velero is based on that volume.

I did another backup-restore cycle with Storage Class reclaim policy set to Delete.

- Create a new app and take a Velero backup (in which Velero creates a snapshot as well)
- Delete the app and PVC using kubectl. Both remain on SolidFire (despite reclaim policy Delete) but are gone from kubectl output
- After restoring this from velero backup, a new volume was created by Velero, while the old volume (and its snapshot) still remained as backup was referencing them
- After I deleted the backup I used to restore the app, Velero "released" these resources and deleted the old volume and snapshot that only Velero was referencing

That's still a bit unusual, but what's important this oddness doesn't cause data to *unexpectedly* go *missing*.

Early on (Velero v1.5.3), I saw odd behavior which included bugs but also "odd by design" and in possibly harmful ways.

## Appendix D - using Velero hooks

[Hooks](https://velero.io/docs/main/backup-hooks/) are executed in a container in a pod that's being backed up. We can decide which container to use.

Pre-hooks run before a backup, and post-hooks after. 

A pre-hook could for example freeze/suspend the app similar to the functionality available in Kasten's [Kanister](/2022/04/13/backup-restore-beegfs-csi-pv-with-kanister-kasten.html) integrations. 

For NGINX (which I used in this testing), there's an interesting example [here](https://github.com/vmware-tanzu/velero/blob/v1.13.1/examples/nginx-app/with-pv.yaml): although normally we wouldn't expect NGINX to write, if logs are stored locally and not forwarded, that would be something we may want to freeze while performing a backup - *especially* if we're doing doing a CSI-enabled backup (which would take a snapshot in an instant).

A post-hook could unfreeze the app and even send some details to Elasticsearch or other database.

Environmental variables available to a pod are also available to Velero hooks executing in it.

As an example, a user running [E-Series Performance Analyzer (EPA)](https://github.com/scaleoutsean/eseries-perf-analyzer/) could run a post hook `post.hook.backup.velero.io/on-error` that would use ENV variables from EPA collector to create a Grafana notification (or a record in DB used by EPA that is surfaced in Grafana) about the failed job on that particular array, along with other details. 

Now I'm making stuff up, so don't try this verbatim, but to run a post hook in an EPA collector pod we could use Python to leverage ENV vars from the container. `/bin/sh` is required to "pick up" ENV variables, even if the notifier script may be written in another language.

```yaml
post:
- exec:
    container: collector-r24u04-e2824
    command:
      - /bin/sh
      - -c
      - influxwrite.py --password=${PASSWORD} --system=${SYSNAME} --endpoint=${API} --db=${DB_ADDRESS} --token=${TOKEN}
    onError: Fail
```

This would only offer information about the array on which a backup failed. We'd also want to know which backup failed, but I don't see a way to pass that information to a hook. It probably can be hard-coded in each job, but that's inconvenient at scale.

Finally, I decided to bite the bullet and do it...  I used and modified the example from the Velero repository, with hooks configured in annotations.

```yaml
# Copyright 2024 @scaleoutsean (Github).
# Copyright 2017 the Velero contributors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

---
apiVersion: v1
kind: Namespace
metadata:
  name: nginx-example
  labels:
    app: nginx

---
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: nginx-logs
  namespace: nginx-example
  labels:
    app: nginx
spec:
  # Optional: change SC name or remove the line with storageClassName to use default
  storageClassName: silver
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: nginx-example
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
      annotations:
        pre.hook.backup.velero.io/container: fsfreeze
        pre.hook.backup.velero.io/command: '["/usr/sbin/fsfreeze", "--freeze", "/var/log/nginx"]'
        post.hook.backup.velero.io/container: fsfreeze
        post.hook.backup.velero.io/command: '["/usr/sbin/fsfreeze", "--unfreeze", "/var/log/nginx"]'
    spec:
      volumes:
        - name: nginx-logs
          persistentVolumeClaim:
           claimName: nginx-logs
      containers:
      - image: nginx:1.25.4-bookworm
        name: nginx
        ports:
        - containerPort: 80
        volumeMounts:
          - mountPath: "/var/log/nginx"
            name: nginx-logs
            readOnly: false
      - image: ubuntu:noble
        name: fsfreeze
        securityContext:
          privileged: true
        volumeMounts:
          - mountPath: "/var/log/nginx"
            name: nginx-logs
            readOnly: false
        command:
          - "/usr/bin/bash"
          - "-c"
          - "sleep infinity"

  
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nginx
  name: my-nginx
  namespace: nginx-example
spec:
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: nginx
  type: LoadBalancer

```

Apply and make sure it works.

```sh
$ kubectl get pods -n nginx-example
NAME                               READY   STATUS    RESTARTS   AGE
nginx-deployment-f7bb8bd94-lpnvg   2/2     Running   0          25m

$ kubectl get pvc -n nginx-example
NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
nginx-logs   Bound    pvc-a9531e89-7900-4265-9910-030142b4646a   1Gi        RWO            silver         25m

```

Now we can backup:

```sh
$ velero backup create nginx-frozen --include-namespaces nginx-example
Backup request "nginx-frozen" submitted successfully.
Run `velero backup describe nginx-frozen` or `velero backup logs nginx-frozen` for more details.

$ velero backup describe nginx-frozen --details 
Name:         nginx-frozen
Namespace:    velero
Labels:       velero.io/storage-location=default
Annotations:  velero.io/resource-timeout=10m0s
              velero.io/source-cluster-k8s-gitversion=v1.28.7+k3s1
              velero.io/source-cluster-k8s-major-version=1
              velero.io/source-cluster-k8s-minor-version=28

Phase:  Completed
...
Backup Volumes:
  Velero-Native Snapshots: <none included>

  CSI Snapshots:
    nginx-example/nginx-logs:
      Snapshot:
        Operation ID: nginx-example/velero-nginx-logs-ssf6z/2024-03-23T07:14:11Z
        Snapshot Content Name: snapcontent-17afb278-f1e9-4929-8077-7a697e56c97d
        Storage Snapshot ID: pvc-a9531e89-7900-4265-9910-030142b4646a/snapshot-17afb278-f1e9-4929-8077-7a697e56c97d
        Snapshot Size (bytes): 1073741824
        CSI Driver: csi.trident.netapp.io

  Pod Volume Backups: <none included>

HooksAttempted:  2
HooksFailed:     0
```

We had two hooks, freeze before and unfreeze after. No hooks failed, which is good. Check the log and inspect hook-related lines.

Example for post-hook that runs unfreeze:

```raw
time="2024-03-23T07:14:11Z" level=info msg="stderr: 
  " backup=velero/nginx-frozen hookCommand="[/usr/sbin/fsfreeze --unfreeze /var/log/nginx]" hookContainer=fsfreeze hookName="<from-annotation>" 
  hookOnError=Fail hookPhase=post hookSource=annotation hookTimeout="{30s}" hookType=exec logSource="pkg/podexec/pod_command_executor.go:180" 
  name=nginx-deployment-f7bb8bd94-lpnvg namespace=nginx-example resource=pods

time="2024-03-23T07:14:11Z" level=info 
  msg="hookTracker: map[{podNamespace:nginx-example podName:nginx-deployment-f7bb8bd94-lpnvg hookPhase:post hookName: hookSource:annotation container:fsfreeze}:
  {hookFailed:false hookExecuted:true} {podNamespace:nginx-example podName:nginx-deployment-f7bb8bd94-lpnvg hookPhase:pre hookName: hookSource:annotation 
  container:fsfreeze}:{hookFailed:false hookExecuted:true}], hookAttempted: 2, hookFailed: 0" backup=velero/nginx-frozen logSource="pkg/backup/backup.go:436"

```

Our volume name is pvc-a9531e89. Let's do another backup and check if we can see its IO.

![Backup with pre hook fsfreeze](/assets/images/velero-trident-solidfire-description-05.png)

SolidFire registers a small IO burst on fsfreeze (with no throughput asssociated IO, since IOs were likely very few). When Velero mover kicks in to copy data to S3, a small throughput burst is registered as well.

![Backup with pre hook fsfreeze](/assets/images/velero-trident-solidfire-description-06.png)

For applications that shouldn't or can't use fsfreeze, create own scripts or use community resources. 

Many apps don't need any hooks and for those I'd use hooks only for notification purposes.
