# CouplaReleases

Weekends are for fun

## Introduction

I had a fun weekend.

## SolidFire CSI v1.0.0

SolidFire CSI came out in March (as Beta 2 at the time) - but I'd been working a lot on E-Series projects and haven't had time to finish it. Until today.

Today, it occurred to me that I've barely made *any* changes to SolidFire CSI since Beta 2. It was good from the moment it was posted to Github. But the documentation wasn't great and after some polishing over recent weekends, I've:

- Fixed and improved the documentation
- Fixed YAML manifest examples
- Added Prometheus metrics to SolidFire CSI
- ... and once again thought: what an amazing storage system!

What's new in v1.0.0 is SolidFire CSI metrics.

```sh
# HELP solidfire_cluster_info SolidFire cluster information with cluster name
# TYPE solidfire_cluster_info gauge
solidfire_cluster_info{cluster_name="dc2",endpoint="192.168.1.34",tenant="talos"} 1
# HELP solidfire_csi_build_info SolidFire CSI driver build information
# TYPE solidfire_csi_build_info gauge
solidfire_csi_build_info{build_date="2026-05-17T02:26:25Z",version="1.0.0-beta.17"} 1
# HELP solidfire_volume_count Number of volumes per backend/tenant
# TYPE solidfire_volume_count gauge
solidfire_volume_count{endpoint="192.168.1.34",tenant="talos"} 2
# HELP solidfire_volume_info Detailed information about individual volumes
# TYPE solidfire_volume_info gauge
solidfire_volume_info{endpoint="192.168.1.34",fstype="ext4",pv_name="pvc-12fe7384-f3f5-4126-881d-d8b65bab8b34",pvc_name="test-restore-pvc",pvc_namespace="demo-ns",qos_policy_id="56",tenant="talos",volume_id="5827"} 4.294967296e+09
solidfire_volume_info{endpoint="192.168.1.34",fstype="ext4",pv_name="pvc-8d05565e-36f6-4c23-ad18-df26e162dac2",pvc_name="test-pvc",pvc_namespace="demo-ns",qos_policy_id="56",tenant="talos",volume_id="5826"} 2.147483648e+09
# HELP solidfire_volume_total_capacity_bytes Total provisioned capacity bytes per backend/tenant
# TYPE solidfire_volume_total_capacity_bytes gauge
solidfire_volume_total_capacity_bytes{endpoint="192.168.1.34",tenant="talos"} 6.442450944e+09
# HELP solidfire_volume_total_min_iops Total MinIOPS provisioned per backend/tenant
# TYPE solidfire_volume_total_min_iops gauge
solidfire_volume_total_min_iops{endpoint="192.168.1.34",tenant="talos"} 100
```

We can scrape these and cross-reference this information against whatever SolidFire Collector or SolidFire Exporter volume and cluster performance metrics we need.

If your metrics collection uses a Prometheus-compatible database, then [SolidFire Exporter](https://github.com/mjavier2k/solidfire-exporter). [SolidFire Collector](https://github.com/scaleoutsean/sfc) collects volume metadata, so although it uses InfluxDB 3 and has slightly more overhead in setting things up, it may be better from the volume metadata (or "attributes" as they're called) perspective.

SolidFire CSI has a Prometheus exporter for CSI Node as well, but it presently collects... nothing. Why, because that's not what it's supposed to do. SolidFire Collector collects volume performance and with the above it's possible to cross reference everything SolidFire-related. Kubernetes users should get Kubernetes-related information from Kubernetes metrics (nodes/workers). 

It's a CSI driver SolidFire could have had in 2019. It's a CSI driver I've been looking forward to for over half a decade and I like it very much. 

What's next for SolidFire CSI? v1.0.0 works well as far as I can tell (the first link) and is feature-complete (see the second link).

- [SolidFire CSI with Cloud Native Postgres](/2026/05/01/cloud-native-postgres-kuberntes-netapp-eseries-csi.html)
- [SolidFire CSI](/2026/03/06/solidfire-csi-driver.html) - the first, "announcement" post - has the whys and hows and a detailed feature list

## SANtricity CSI v1.0.0

This is another enjoyable project, apart from working with the SANtricity API. But it doesn't implement snapshots and clones, which is why my PTSD levels have been relatively normal. (IBM Block CSI with SANtricity patches is PTSD project of the year - snapshots, clones, patches, upstream bugs... It has it all.)

Like with SolidFire CSI, the recent weeks have been mostly about the documentation. It's been around for weeks, I've featured it in half a dozen blog posts, and looks good by now.

Today, as I was reviewing the documentation, I realized the metrics feature wasn't complete, so I've completed it. Now we can do this:

```sh
$ kubectl exec -it -n santricity-csi deployment/santricity-csi-controller -c csi-driver -- wget -qO- 127.0.0.1:8080/metrics
```

That pulls Prometheus metrics from SANtricity CSI's CSI Controller. What's in them?

Some are SANtricity API metrics. Not hugely important, but good to know, in case we see API timeouts on Kubernetes and wonder if API response is too slow, etc.

```sh
# HELP santricity_api_requests_total Total number of SANtricity API requests
# TYPE santricity_api_requests_total counter
santricity_api_requests_total{method="GET",path="/",status_code="200"} 4
santricity_api_requests_total{method="GET",path="/storage-pools/040000006D039EA000493A26000004FD6996CBC0",status_code="200"} 1
santricity_api_requests_total{method="GET",path="/volumes",status_code="200"} 3
santricity_api_requests_total{method="POST",path="/volumes",status_code="200"} 1
```

There's SANtricity volume information, too. Check it out.

```sh
# HELP santricity_volume_info Physical capacity in bytes allocated on the SANtricity array per PVC.
# TYPE santricity_volume_info gauge
santricity_volume_info{csi_driver="",pvc_name="",pvc_namespace="",volume_id="020000006D039EA000493A9C00000EEF6A06681B",volume_name="csi_H8EySQyWsUN5tHWw7F8jui3Jkg"} 1.073741824e+10
santricity_volume_info{csi_driver="",pvc_name="",pvc_namespace="",volume_id="020000006D039EA000493A9C00000EFB6A07B1C2",volume_name="copysrc"} 1.2884901888e+10
santricity_volume_info{csi_driver="",pvc_name="",pvc_namespace="",volume_id="020000006D039EA000493A9C00000EFC6A07B1C5",volume_name="copyclone"} 1.2884901888e+10
santricity_volume_info{csi_driver="",pvc_name="demo",pvc_namespace="default",volume_id="020000006D039EA000493A9C00000DDA6A033686",volume_name="pvc-8d137d0b-2866-44d_bf329740"} 4.294967296e+09
santricity_volume_info{csi_driver="santricity.scaleoutsean.github.io",pvc_name="santricity-pg-wal",pvc_namespace="prommy",volume_id="020000006D039EA000493A9C00000F316A094DC0",volume_name="pvc-5f92f3ed-9b2e-4ca_cf893d1e"} 1.073741824e+10
```

This is interesting enough to justify several verbose comments:

- `csi_driver` is the CSI driver identity. Trident CSI does that too, other CSI as well. What's comparatively unusual is that Trident wouldn't export metrics for `csi_driver` for volumes it doesn't own. SANtricity CSI exports all volumes it sees. Why's that? Because SANtricity CSI is a stateless driver, it doesn't "own" any volumes and when we use it we don't need to care (we could create static PVCs out of any free PV, without "importing" anything). Only in the last volume in that example is the `csi_driver` SANtricity CSI. What does that mean? It means other volumes weren't created by the driver. They may even be non-Kubernetes volumes. Which makes sense, since a storage pool may not be dedicated to Kubernetes (or there may be multiple CSI drivers, which - if they inject `csi_driver` information as SANtricity CSI does, can be individually identified). This is an improvement over Trident CSI and works the way it should for SANtricity CSI.
- The other, less subtle detail is the "missing" `pvc_name` in some lines. It's for the same reason - those probably aren't PVCs and that's fine - we can ignore them. We may want to use them in static PVCs later. As we scrape these, we can, if we want, simply drop anything with a non-matching `csi_driver`, and these won't bother us. But if you sometimes flip volumes between clusters, or create static PVCs from non-Kubernetes clusters, it's good to be able to see them - after all, if hosts can't access them they won't be able to do anything with them.
- The third is SANtricity `volume_id` is reported. This is awesome because if I monitor SANtricity at all (not Kubernetes, but SANtricity), I can easily correlate that `santricity-pg-wal` with the backing SANtricity volume in my SANtricity metrics. As an aside, SANtricity CSI makes that even easier because it stores these into SANtricity volume metadata to begin with, but not all monitoring utilities parse those. But even then, all you need is to parse `volRef` (from SANtricity `GET /volumes` response) and match it with `volume_id` from SANtricity CSI metrics

So, there's no need to collect volumes' performance stats on Kubernetes. This is the same approach as with SolidFire CSI. Not that we couldn't (I could *easily* query and export those from SANtricity CSI Controller), but we don't have to and don't want to. Kubernetes should get own metrics.

Then there are storage pools.

In this SANtricity CSI instance, I have two. The one with 41 volumes is a DDP, and the other one is a classic RAID group. 

```sh
# HELP santricity_volumes_total Estimated number of volumes managed by this driver instance
# TYPE santricity_volumes_total gauge
santricity_volumes_total{pool_id="040000006D039EA000493A26000004FD6996CBC0",system_id="952103002724"} 41
santricity_volumes_total{pool_id="040000006D039EA000493A9C00000AFD69A67726",system_id="952103002724"} 9
```

Where do I see that? I don't. It's just like with volumes: I monitor E-Series and find out by matching SANtricity's `volGroupRef` with `pool_id` here. And `system_id` is the unique chassis serial number (of the E-Series system) in case we want to group volume count by array to avoid hitting array limits, etc.

This is included in v1.0.0.

What's next for SANtricity CSI?

It has some catching up to do because I'd spent a lot more time working on SANtricity patches and features for IBM Block CSI driver. The plan is to add snapshots, read-only Linked Clones and more to SANtricity CSI.

## IBM Block CSI with SANtricity Patch v1.13.2

Technically, this is not a release because releases are done by IBM. I just create patches.

Still, there's no reason to not highlight this addition to existing patch set for v1.13.2 (which adds snapshots and read-only clones to general support for SANtricity that was first added in patches to v1.13.1).

Since today's updates, if you [get started with Kubevirt](https://kubevirt.io//quickstart_minikube/) and happen to have a SANtricity box lying around, you may as well create a test namespace (`vm`), clone this CSI's repo, deploy IBM Block CSI with SANtricty patch (create SANtricity configuration, deploy example Storage Class) and then run:

```sh
kubectl apply -f deploy/santricity-solidfire/kubevirt-cirros-block.yaml  -n vm
```

Yep, that does exactly what you think it does!

```sh
$ kubectl get pod -n vm
NAME                            READY   STATUS    RESTARTS   AGE
virt-launcher-cirros-vm-ns2fh   3/3     Running   0          6m7s

$ kubectl get pvc -n vm
NAME                   STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS                   VOLUMEATTRIBUTESCLASS   AGE
santricity-block-pvc   Bound    pvc-1ea89fd9-a612-4c9b-a1dc-2d62b60413c6   1Gi        RWO            demo-storageclass-santricity   <unset>                 6m14s

$ kubectl get sc -n vm
NAME                           PROVISIONER                    RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
demo-storageclass-santricity   santricity.block.csi.ibm.com   Retain          Immediate           true                   3d22h
```

IBM Block CSI claims OpenShift certification and block mode support. So - after recently "completing" my patches for their version 1.13.2 - I got greedy and decided to try one more thing (Block mode PVCs). It turned out to be difficult for a feature upstream "supports", but it seems to work now. It looks really nice - I had to take and annotate some screenshots. 

![IBM Block CSI with SANtricity patch running KubeVirt VM](/assets/images/ibm_block_driver_csi_santricity_04_kubevirt_01.png)

VM pod details:

![IBM Block CSI with SANtricity patch running KubeVirt VM](/assets/images/ibm_block_driver_csi_santricity_04_kubevirt_02.png)

What's next for this one? I might add Volume Copy which I [blogged about](/2026/05/16/santricity-client-copy-volume.html) yesterday, but I also consider this one complete:

- IBM Block CSI does not implement Volume Group Snapshots, so that can't be done without major patching which would be out of scope for a patch
- My SANtricity patches work for snapshots and read-only linked clones, which is enough for all practical purposes (both Velero 1.18 and Kasten 8.5.8 work - see the recent posts on these)
- Block mode now also works, so Kubevirt (and various other scenarios) are covered, too

I'm sure there are bugs, maybe in iSCSI and especially FC areas, but I haven't had a chance to test those and can't fix bugs if I don't know they exists to begin with. And it's a community patch, after all: pull requests are just as welcome as bug reports. Just like with the other two, you may also fork it and maintain your own.

## E-Series Performance Analyzer v4.0.0

I wrote about EPA 4 in [this post](/2026/04/23/epa_400_beta.html) some three weeks ago when I released 4.0.0 beta. Since then:

- a Prometheus scraper/DB was added to EPA reference stack
- Traefik has been added for reverse proxying (mostly for better security)
- Most Grafana panels from EPA v3 (for InfluxDB 3) have been re-created for EPA v4 (now they are for Prometheus)

Everything that I had in mind for EPA 4 was delivered, and EPA version 3 is still being maintained.

EPA collects SANtricity volume metadata, so yes - if you use EPA Collector v4 to collect E-Series information and some volumes are from SANtricity CSI, you get Kubernetes file-system type, PVC name and namespace for free. If you also scrape SANtricity CSI controller metrics, you get even more information. Stay tuned for examples in future posts.

## Conclusion

I've mentioned several times this year - you can't play well if there's no playground. The playground is now reasonably complete:

- SolidFire CSI is now the complete released CSI driver for NetApp SolidFire. With SolidFire Collector, it's a provisioning and monitoring solution unavailable in any commercial product without extra integration work
- SANtricity now has two reasonably feature-complete native "HA" CSI drivers for shared storage. Snapshots work for workloads that *usually* run on E-Series to the extent they need to (which is: "just a step in backup-to-S3 workflow", as explained [here](/2026/05/12/veeam-kasten-santricity-csi-netapp-eseries.html#tools)) and even beyond it.
- E-Series CSI drivers are supported by various client libraries I've created more-or-less from scratch (Go, Python, PowerShell) - all these are extra benefits to E-Series and are being downloaded and used for E-Series automation every day
- EPA not just remains relevant, but expands its relevance to Kubernetes environments when used with SANtricity CSI

Current situation with E-Series in the areas of monitoring and [CSI drivers](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html) space is rather good.

There are enough good choices, each does something better than others and, together, they cover everything one needs for the workloads and use cases that have always used to gravitate toward E-Series. There may be no good solution for VDI on Kubernetes with E-Series, but there's *never* been a good solution for VDI with E-Series. What works well on vSphere with E-Series likely works well (for less) on Kubernetes with E-Series, whether it's with TopoLVM or SANtricity CSI. This is the best E-Series news of the 20s so far.
