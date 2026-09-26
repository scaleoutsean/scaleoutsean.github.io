# What's new in Kasten K10 9.0

## What's new in Kasten 9.0

You may see full [release notes for version 9 right here](https://docs.kasten.io/latest/releasenotes/#900).

What's interesting to me is the following parts.

> **VBR Metadata Support:** New policies support the export of both Kubernetes application metadata and volume snapshot data to supported Veeam Backup & Replication repositories

At the [related link](https://docs.kasten.io/latest/install/storage/#vbr-integration):

> Both Filesystem and Block persistent volume modes are supported, however only storage provisioners capable of performing block mode exports are compatible.

SolidFire CSI, SANtricty CSI and IBM Block CSI with SANtricity patches should be fine. I have a post on Veeam B&R 13.0 [here](/2026/03/14/veeam-proxmox-netapp-eseries.html), by the way.

> **Dual Export Policies** (Technical Preview): Users can now configure an additional export location for new or existing policies

You could have multiple export locations, but the key word is [simultaneously](https://docs.kasten.io/latest/usage/protect#configuring-additional-export):

> A multi-export policy exports restore points to multiple location profiles simultaneously

There's no need to re-read what was written, or backup twice. One source, two destinations.

This is interesting as well, especially for E-Series:

> **Expanded Blueprint Hooks:** 
> - Modern Kubernetes data services, including critical AI vector databases, are increasingly adopting custom operator patterns over StatefulSets. To enable consistent, storage-based backup, Kasten now supports pre- and post-snapshot Blueprint actions for custom resource managed workloads by dynamically mapping Pod and PVC ownership at policy runtime.
> - A new post-restore Blueprint action enables additional recovery orchestration following data restore, such as database import operations, that can be applied and managed at the level of individual workloads.

At first I thought this would make it possible to take "fake" snapshots with [Logical Blueprints](https://docs.kasten.io/latest/kanister/reference/action-names#logical-blueprints), but later I found this:

> As a guideline, logical blueprints remain practical for databases up to approximately 50 GiB. 

And that is `backup`, not `backupPrehook`.

Still, the same page also has this:

> Use logical blueprints only when PVC snapshots are not viable, such as managed databases or vendor operator backup APIs. 

That is exactly what I had in mind: run custom backup action (such as dump to S3 bucket or ephemeral PVC), and backup data from that dump volume. No CSI snapshot is required. 

The same page has several other downsides for logical blueprints, but none of them are disqualifying. Some databases support only one backup - dump to disk or S3 - so all of these shortcomings are baked-in and not "extra" downsides that one has to accept if using `backup` hooks. 

It's strange that external S3 object stores are completely ignored in these considerations, although they have no upper scale limit. 50, 500, or 50,000 GB... No matter the size, these can always work and beat not just dump-to-disk, but also CSI snapshot-assisted backups.

I intend to explore logical backups to S3 next time I use Kasten. 

## Appendix A: deploy Kasten 9.0.2 with SolidFire CSI 1.0.2

Back in April, I complained about lagging Kubernetes version support in Kasten 8. Well, 9.0.2 still [does not support Kubernetes 1.35](https://docs.kasten.io/9.0.2/operating/support#supported-kubernetes-versions).

I installed Kasten 9.0.2 on Kubernetes 1.35.1, then SolidFire CSI 1.0.2, and finally CRDs for External Snapshotter 8.6. A SolidFire storage class was made the default. I used the volume snapshot class from the SolidFire CSI repository.

There's an option to define a backup-only storage class, which is something I've [suggested since 2020](/2020/11/28/powershell-set-sfqosexception.html), but I did not make use of that.

```sh
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   36d   v1.35.1

$ kubectl get sc
NAME                         PROVISIONER                RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
solidfire-bronze (default)   csi.solidfire.com          Delete          Immediate           true                   27m
standard                     k8s.io/minikube-hostpath   Delete          Immediate           false                  36d

$ kubectl get volumesnapshotclass
NAME                  DRIVER              DELETIONPOLICY   AGE
solidfire-snapclass   csi.solidfire.com   Delete           6m32s

$ kubectl get pods -n kasten-io
NAME                                     READY   STATUS    RESTARTS      AGE
aggregatedapis-svc-76cbf9cc8b-cgr4w      1/1     Running   0             15h
auth-svc-5fd6874b4b-wm24l                1/1     Running   1 (15h ago)   15h
catalog-svc-58f7565956-qk8pw             2/2     Running   0             15h
controllermanager-svc-57859f79fc-zt6n9   1/1     Running   1 (15h ago)   15h
crypto-svc-8474d6f87-v5wl6               4/4     Running   0             15h
dashboardbff-svc-5898d598f7-bfpcm        2/2     Running   0             15h
executor-svc-5f897cbc8f-85ldr            1/1     Running   0             15h
executor-svc-5f897cbc8f-q27gj            1/1     Running   0             15h
executor-svc-5f897cbc8f-tlgqv            1/1     Running   0             15h
frontend-svc-f44b55df-ljwqs              1/1     Running   0             15h
gateway-5644bc858d-xrqpn                 1/1     Running   1 (15h ago)   15h
jobs-svc-74c9f58498-rxcwt                1/1     Running   0             15h
kanister-svc-69ddc44dbb-lm2qw            1/1     Running   0             15h
logging-svc-5767677f6f-b8qrb             1/1     Running   0             15h
metering-svc-86b6d4dcbd-qd9gm            1/1     Running   0             15h
prometheus-server-579c4679d4-z47p4       2/2     Running   0             15h
state-svc-67d656558d-qdzc6               2/2     Running   0             15h

$ kubectl annotate volumesnapshotclass solidfire-snapclass k10.kasten.io/is-snapshot-class="true"
```

Don't forget to annotate a SolidFire VolumeSnapshotClass.

Run this check and only the Kubernetes version check fails.

```sh
curl -s https://docs.kasten.io/downloads/9.0.2/tools/k10_primer.sh | bash
```

No errors (for now), despite running an unsupported Kubernetes version.

![Kasten 9 with SolidFire CSI](/assets/images/kasten_9_00.png)

The same workflow is expected to work with SANtricity CSI or IBM Block CSI with SANtricity patch, except that you can't take advantage of backup-only Storage Class which requires QoS features on storage array and snapshots are currently available only in the patched IBM CSI driver.

Logical blueprints for snapshotless backup will be examined in the [next post](/2026/07/30/backup-restore-modern-k8s-apps-without-csi-snapshots.html).
