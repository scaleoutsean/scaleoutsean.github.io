# Kasten 8, SANtricity CSI 1 and NetApp E-Series

Backup your SANtricity CSI volumes with Kasten by Veeam

## Introduction

Just like with IBM Block CSI with SANtricity patch, the first "warm-up" backup test for SANtricity CSI would be a simple filesystem backup test that doesn't require snapshots and clones.

Since I have SANtricity CSI deployed on MicroK8s, I thought to try Kasten right away. I started blogging about Kasten years ago, and like it very much.

## Part one: Kasten with MicroK8s and SANtricity

Latest & greatest version 8.5.8 was released in late April, 2026. Perfect! I have MicroK8s v1.3.5. Let's go!

Installation went fine. Then problems begun.

I didn't run the usual pre-flight check because it's such a simple situation. Singleton MicroK8s running a stable (not even "latest", because v1.36 came out before Kasten 8.5.8) version - what could possibly go wrong?

The first issue was several pods were crashing. After some unsuccessful troubleshooting I realized the host-path Storage Class plugin was default Storage Class - the same as my SANtricity CSI (that is, I had two default SCs without knowing). I uninstalled Kasten, deleted the host-path Storage Class and re-installed Kasten. Same problem. But at least I could see Kasten was using my storage class without any glitches. Yay!

![Installation](/assets/images/kasten_santricity_csi_00_install.png)

The second time around I spotted an error in one of the containers was "Failed to change state owner... mkdir //mnt/k10state/kasten-io/: permission denied". Okay, so it seems to run as a non-root UID/GID and that doesn't work. I changed ownership of all those volumes from a sidecar container. I thought that was it, but then I hit another problem.

It seemed as if some Kubernetes components were missing. This was purely speculative, but as I mentioned in the previous post, that's hardly an unreasonable thought if you work with MicroK8s or any slim Kubernetes distribution. I enabled some of the extra stuff (ingress and Prometheus (hidden in "observability")) that was related to errors in the failing Kasten pods, and restarted those pods.

```sh
$ microk8s status
microk8s is running
high-availability: no
  datastore master nodes: 127.0.0.1:19001
  datastore standby nodes: none
addons:
  enabled:
    dns                  # (core) CoreDNS
    ha-cluster           # (core) Configure high availability on the current node
    helm                 # (core) Helm - the package manager for Kubernetes
    helm3                # (core) Helm 3 - the package manager for Kubernetes
    host-access          # (core) Allow Pods connecting to Host services smoothly
    hostpath-storage     # (core) Storage class; allocates storage from host directory
    ingress              # (core) Ingress controller for external access
    metrics-server       # (core) K8s Metrics Server for API access to service metrics
    observability        # (core) A lightweight observability stack for logs, traces and metrics
```

That didn't help either. I uninstalled Kasten again. This time I decided to run Kasten's pre-flight check before I install again. Lo and behold...

![Kasten K10 pre-flight check](/assets/images/kasten_santricity_csi_01_preflight_check.png)

Yes, that's right!

- (1) Kubernetes v1.35 is not yet supported!?
- (2) Kubernetes v1.33 is the highest supported version!?

That's unbelievable! It's been *over a year* since [v1.33](https://kubernetes.io/blog/2025/04/23/kubernetes-v1-33-release/) came out!

That's disappointing. Kasten 8.5.8 was released almost 370 days after Kubernetes v1.33. 

The good news:

- SANtricity CSI was recognized
- One error did appear in that section, but that's related to the missing VolumeSnapshot CRDs which were indeed not installed *and* the reason for that was there's no use for them - SANtricity CSI does not yet support Volume Snapshots or Clones.

So, nothing can be tested at all. This failed miserably. I should have checked TFM before trying, but being more than one year behind is totally weird. It's also weird that even v1.35 - which was released **last year** - is not supported in mid-May. You're supposed to keep up, Kasten! 

I'm going to post this now, and update this post at a later time, when I either install an ageing Kubernetes version or Kasten wakes up from their winter (and spring) hibernation. (**UPDATE:** I just noticed the [press release](https://www.veeam.com/blog/veeam-kasten-v9-enterprise-kubernetes-resilience.html) - Kasten 9 has been announced earlier this week, so they haven't been sleeping.)

In the meantime, it wouldn't hurt to implement snapshots and clones in SANtricity CSI, so that more than just filesystem backup can be demonstrated.

## Part two: Kasten with SANtricity and vanilla Kubernetes

Later I tried the other cluster, which I featured in the recent posts on IBM Block CSI with SANtricity patch. It's also v1.35, but Kasten installed without issues. Strange.

Since SANtricity CSI won't have snapshots *that* soon, I thought I'd wrap up this Kasten post using IBM Block CSI with SANtricity patch instead.

There I created a new namespace with a SANtricity-backed PVC and a pod and protected it with a snapshot and backup policy.

![Setup with IBM Block CSI and vanilla Kubernetes](/assets/images/kasten_santricity_csi_03_ibm_block_csi.png)

Secondly, I had that Versity S3 Gateway (used in recent posts) around, so I configured that as my S3 backup repository (S3 is one of the destinations Kasten can "backup" stuff to).

![Kasten with Versity S3 Gateway](/assets/images/kasten_santricity_csi_04_versity_s3.png)

To set that up, I simply created a bucket (`kasten`), disabled TLS validation to overcome my snake-oil certificates, and this basic setup just worked.

![VGW configuration for Kasten](/assets/images/kasten_santricity_csi_07_kasten_versity_s3_gateway.png)

What's relevant to SANtricity or IBM Block CSI with SANtricity patch here?

First, the driver fully passes Kasten's pre-flight checks. Initially it did not - there was a bug in my CSI patch and that was fixed. (Notice that Kasten nicely used the sole default SC (based on IBM Block CSI with SANtricity patches), so all Kasten K10 volumes were on E-Series.)

![Kasten 8.5.8 with IBM Block CSI with SANtricity patch](/assets/images/kasten_santricity_csi_06_kasten_ibm_block_csi_validation.png)

Second, it may help you if you create (and use) a custom Storage Class just for backups (from SANtricity Linked Clones), so that - after backup to S3 is done - the Linked Clone volume is dropped. This applies to all CSI - I [used that with SolidFire as well](/2023/09/15/velero-csi-snapshot-data-movement-with-netapp-solidfire.html), because it can have up to 32 snapshots per volume - but SANtricity is [much worse](/2026/03/21/shocking-truth-netapp-santricity-snapshot-schedules.html) so I'd say this isn't optional.

When configuring Export jobs, go to advanced settings and add such a custom Storage Class (the main thing is, its reclaim policy should be "Delete").

![Custom SC](/assets/images/kasten_santricity_csi_08_kasten_custom_sc_for_backup.png)

One nice thing you can do is specify a non-default prefix to those volumes, so that - despite the horrendous naming strings - you can still tell Kasten-generated Read-Only Linked Clones from regular volumes and non-Kasten-generated Linked Clones.

![Custom SC prefix](/assets/images/kasten_santricity_csi_12_kasten_sc_rolc.png)

And thirdly, I did discover a CSI bug that I did not see with Velero - Linked Clones weren't getting deleted, and that was fixed. 

`demo-kasten-santricity-sc` is the custom SC used for backup/cloning (set to `Delete` abandoned Linked Clones), with a copy stored in the Github repo for this project. The k10 volume snapshot class was automatically created by Kasten, shadowing your VSC with reclaim changed `Retain`.

```sh
$ kubectl get sc
NAME                           PROVISIONER                    RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
demo-kasten-santricity-sc      santricity.block.csi.ibm.com   Delete          Immediate           false                  26h
demo-storageclass-santricity   santricity.block.csi.ibm.com   Retain          Immediate           true                   28h

$ kubectl get volumesnapshotclass
NAME                                            DRIVER                         DELETIONPOLICY   AGE
demo-volumesnapshotclass-santricity             santricity.block.csi.ibm.com   Delete           26h
k10-clone-demo-volumesnapshotclass-santricity   santricity.block.csi.ibm.com   Retain           31h
```

As snapshots are taken and backups (to S3) exported, data shows in the `kasten` bucket.

![Kasten data in VGW bucket](/assets/images/kasten_santricity_csi_11_kasten_vgw_data.png)

In Kasten UI, we can see new restore points. Some say "Snapshot" (those are CSI snapshots), others "Export" (those are backups to S3, and ephemeral snapshots and Linked Clones that were involved in their creation have been deleted).

![Kasten restore points](/assets/images/kasten_santricity_csi_05_restore_points.png)

You can right-click on those and run validation. 

![Kasten validation](/assets/images/kasten_santricity_csi_10_kasten_validation.png)

I did that multiple times (on different items) and didn't have any issues. You can see the top item here is a successfully passed validation run.

![Kasten action log](/assets/images/kasten_santricity_csi_09_kasten_actions.png)

What's more, at the top of of that screenshot - just below "Action Durations" - you can see almost 200 actions have completed by then, across snapshots, backups, restores and validation.

Restore workflows can be tricky: 

- Early on, they were succeeding (according to Kasten), but not really, because they were happening on Linked Clones. Not the right place! Restores should go to a **new** volume, not happen in-pace.
- There are different ways to restore - from a snapshot, from an export (backup to S3, here), in place, etc. Some of those may be suitable for only some use cases. I think for SANtricity - due to the way snapshots work - the way to go is (a) keep just one snapshot per volume, and (b) ship everything else to S3 ASAP and immediately delete ephemeral Linked Clone and snapshot (done by Kasten, but you need to create those protection policies)

The whole thing (Kubernetes backup and restore) is actually not very simple once you add snapshots to the mix. They are efficient, but not native to Kubernetes. Kubernetes has no concept of in-place snapshot restore, for example. Given that SANtricity snapshots aren't particularly good to begin with, that makes it easier to stick to the established pattern of making copies to S3; snapshots (and thin/linked clones) are helpful, but used very sparingly.

As you can see in the VGW data screenshot, Kopia is used to copy data to S3, so it has to re-read all data chunks every time to export (backup) data, but it doesn't read tiny chunks - it's sequential workload and SANtricity is very good with those, so this is all good stuff.

I haven't done much restore testing yet, but knowing that backups pass validation *and* there's no dependency on "restore from snapshot" working (rather, the way it works is "copy and unpack Kopia backup to a new PVC"), I'd say I don't expect big problems in common restore operations. (It should be possible to manually restore backups from S3 using just the Kopia CLI and `kubectl`.)

In brief, this is what works for me:

### Restore a snapshot

It seems best to delete all non-PVC resources within the namespace, execute a SANtricity rollback-from-snapshot using a SANtricity CLI or the Web UI. Then use Kasten to restore non-PVC namespace resources and start the application. 

Using just Kasten, I'd only restore from snapshot to a *new* namespace.

In the "common-sense" scenario (keep the namespace and even the PVC, and then run restore-from-snapshot in Kasten), one wouldn't *have* a restorable snapshot unless the PV exists (with a damaged filesystem, or whatever). But snapshot data can't be restored in place here, so that wouldn't help you with in-place restore. There would *have to be* be a new PVC.

If, alternatively, you destroy a PVC with a damaged filesystem, it still won't be gone because you need `Retain` on it. Not having `Retain` would also nuke the snapshot which you intend to restore.

So, presently there's no way to work around this - it must be a new volume unless you use that manual step which I think is trivial compared to the complexity of CSI. It's literally one CLI command outside of Kubernetes. The only downside is the command must be executed by a storage admin (against SANtricity API endpoint) and not a Kubernetes user.

The CSI driver could be improved to fight Kubernetes and restore in place. But that is a bad idea. IBM Block CSI would have to be butchered, getting more bugs and complexity in the process. It's just not how CSI is supposed to work. Even for SANtricity CSI, it'd be an unnecessary overhead and I don't want to add such "features".

And - while we're on this topic - this is why every snapshot should be exported to S3. It's not inefficient and once you have it there, your restore PVC fully from backup, and don't need that extra step by the admin. Then, for smaller PVCs, every snapshot is also available as export/backup, and for sub-TB PVCs, it becomes convenient enough to just restore from backup and keep array snapshot there just in case that fails, or the PV is very large.

### Restore a backup

Restore S3 backup: works fine by restoring to a new PVC. I haven't tried advanced options which may be used when PVC remains.

As I've just mentioned in the "restore a snapshot" comments, restoring from a backup is the recommended approach for:

- Self-service approach (no need to have direct admin access to storage)
- Good for smaller volumes or when storage admin isn't around

The assumption is that every snapshot recovery point is copied to S3, which means there's no difference in RPO between the two approaches - only in RTO. Restore from backup would be slower, but the difference for sub-100 GB volumes wouldn't be significant. 

## Tools 

It's not like there's a bunch of them but:

- My santricity-client repository has a PVC-to-SANtricity mapping script that maps PVC names to the weird IBM Block CSI "codes". That can help you find orphaned volumes and Linked Clones. You still have to be careful when deleting physical resources because there may be other Kubernetes clusters using the same storage array, or even another CSI in the same Kubernetes cluster (I ran into this as SANtricity CSI used to be deployed as well, and some orphaned PVs were created there; of course, I could not delete them from kubectl after the CSI driver was no longer there)
- My SANtricity clients (PowerShell, Python) can help you perform simple workflows faster or create CLI reports like the sample Kubernetes script

Here's a Kubernetes-to-SANtricty mapping example with IBM Block CSI to give you an idea:

![K8s-SANtricity Mapping](/assets/images/kasten_santricity_csi_13_k8s-santricity-report.png)

It does make it easier to figure out those cryptic IBM names, in addition to aiding regular maintenance of both Kubernetes and storage.

For the "restore from snapshot" scenario where we delete namespace resources to clean up everything except PVC, roll-back from latest snapshot using storage API, wait until it's done, and finally complete recovery restoring non-PVC resources in Kasten:

```sh
$ santricity snapshots list-snapshots
                                                                                                                      
  Snapshot Group   Pit Ref                                    Seq #    Timestamp   Created By   Repo Use %   Status   
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
  vol1_SG_01       3233343536373839303134323600000000000000       1   1778824596   user                  5   optimal  
  vol1_SG_01       3233343536373839303134323700000000000000       2   1778825370   user                  5   optimal  

$ PIT='3233343536373839303134323700000000000000'
$ santricity snapshots restore ${PIT} \
    --base-url https://a.santricity.dev:8443/devmgr/v2 \
    --username storage \
    --password "" \
    --no-verify
Rollback initiated successfully. Result: "ok"
```

We just need these 2 steps in the CLI or UI and can complete the Kasten restore steps (non-PVC part).

If your Kasten policy takes snapshots every 60 minutes, it may take a minute to roll back depending on the amount of CoW data. 

As for roll-back progress, we can monitor it in the UI or CLI. When you get nothing back like this, you know it's finished running (hopefully successfully). 

```sh
$ sleep 30; santricity volumes copy-status
[]
```

Realize that SANtricity roll-backs to active volumes **consume**, rather than reduce, CoW data. Because of that, a roll-back usually creates *more* CoW data! I think that, once the PIT (snapshot) has been deleted, CoW data from snapshot *and* roll-back is finally released. (And so - in theory at least - a very large snapshot restored to a busy (write-wise) volume might take so long to roll back as to max out the repo group capacity unless you watch its progress and expand the repo group as required.)

Sadly, [TFM](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/start-snapshot-image-rollback-for-base-volume.html) misses to explain any of that...

> The host can immediately access the new rolled-back base volume, but the existing base volume does not allow the host read-write access after the rollback begins. 

![Confused Math Lady](/assets/images/confused_math_lady.gif)

More on the topic of SANtricity snapshots can be found in [The shocking truth about SANtricity snapshots](/2026/03/21/shocking-truth-netapp-santricity-snapshot-schedules.html)and the [TR](https://www.netapp.com/media/17167-tr4747.pdf) does touch on the topic of running out of repo space while restoring a snapshot.

## Conclusion 

Kasten 8.5 works well (in Part Two at least). Compared to 3-4 years ago, it does feel more complicated. Of course, it also works better for all those uses who needed those extra capabilities.

I set out to evaluate SANtricity CSI with Kasten, but ended up evaluating the other CSI driver for E-Series. That was fortunate because I discovered two-three code bugs and several documentation bugs in my patch. I think IBM Block CSI with SANtricity patch for upstream 1.13.2 is now "finished" (until next time IBM updates their Block CSI). I also realized that IBM Block CSI does not support Volume Group Snapshots, so I won't try to implement Consistency Groups in the patch, which is what I thought I'd do.

The SANtricity patch leverages `santricity-client` (my Python client library for SANtricity) and that library may add some extra features as we wait for IBM to add Volume Group snapshots, it's just that I won't rush to include them into the CSI driver. The Python client library would benefit from:

- Volume Copy wrapper/automation - this is for thick (thicc?) copy-volumes, not thin (aka linked) clone volumes. Volume Copy is actually [a thing in CSI as well](https://kubernetes.io/docs/concepts/storage/volume-pvc-datasource/), it's just that `dataSource: PersistentVolumeClaim` is relatively rarely used by the average user. Still, we want this for non-CSI uses as well, so we want it in the library. (Note: Volume Copy was added to SANtricity Library on May 15).
- Read-Write Linked Clones - these are not yet implemented in santricity-client, but also not urgently needed. Read-Only Linked Clones seem to work great for backup-to-S3 and - as I've mentioned earlier - restores should go to a new volume, not a linked clone. But it may be useful for use cases outside of CSI, so that's on my to-do list as well

Block volume mode is something that would be very nice to have and purely a CSI feature. IBM Block CSI already supports it, but I'll look into that after next IBM's release - in this release (1.13.2) SANtricity added support for snapshots and linked clones - it's a big step forward and what it possible to use Kasten this way.

SANtricity CSI - supposedly the topic of this post - doesn't support CSI snapshots yet, but that's on my to-do list and with IBM Block CSI with SANtricity patch currently (for practical purposes) feature-complete, I'll probably spend time on SANtricity CSI this month. It is not expected to work differently with Kasten because SANtricity always works the same. SANtricity CSI may implement Volume Group Snapshots before IBM Block CSI if I beat IBM to it.
