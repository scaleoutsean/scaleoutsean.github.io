# IBM Block Storage CSI driver patched for NetApp E-Series

Another CSI driver for NetApp E-Series (SANtricity) systems

## What is IBM Block Driver CSI (patched for E-Series SANtricity)

It is my patch of IBM Block Storage CSI driver v1.13.0 ([IBM Block CSI driver](https://github.com/ibm/ibm-block-csi-driver/) on Github).

## Why?

Just like NetApp Trident CSI, [IBM Block Storage CSI driver](https://www.ibm.com/docs/en/stg-block-csi-driver/1.13.0?topic=requirements-features-capabilities) is a decent CSI driver. 

Neither of them supports NetApp E-Series SANtricity systems, but one of them makes that *easy*. That is IBM Block Storage CSI driver, where array adapters are written in Python.

Some 60 days ago, I set out to [reautomate E-Series/SANtricity](/2025/12/22/reautomating-eseries.html).

A CSI driver for SANtricity was high on my wish-list, but I wasn't sure how to best "attack" this problem. When I saw IBM Block Driver CSI, I knew that was what I was looking for - well-respected developers, OpenShift focus, and array-facing code written in Python. Perfect! 

I started playing with it and soon realized testing it was just too hard without knowing where all the various "landmines" and gotchas were. As a temporary workaround, I switched to building it for SolidFire, which is something I can test at home (with SolidFire Demo VM) and SolidFire has a great Python SDK, so at least one side of the equation was known.

But I didn't make much progress with SolidFire due to home "infrastructure" and Kuberntes issues and, frustrated with that situation, I switched to creating a CSI driver from scratch. Last week I released [SANtricity CSI](/2026/01/19/netapp-eseries-santricity-csi.html), but this week I thought to revisit this patched driver because I really liked its aproachability. 

The other reason was - see my recent blog posts to get the idea - it had been almost two months of "re-automating" and since then I had improved [santricity-client](https://github.com/scaleoutsean/santricity-client) (Python client library for SANtricity) enough to approach this in a better way: plugin into that CSI driver rather than build from within. That was expected lessen uncertainties and difficulties.

There's more to like about IBM's Block CSI driver. For example, it's witten for "old school" storage (SVC, XIV, DS8000) and some of them are similar to SANtricity. I worked with some of those arrays many years ago. It seemed like a great fit. And I saw value in that upstream is focused on testing and certification with OpenShift, unlike some other community CSI drivers (I already have one of those!).

What my SANtricity CSI driver does **not** do (and does not want to) is touch Fibre Channel, get certifications, test with OpenShift, or use operators. Amazingly, IBM Block Storage CSI does all of that. Aren't we lucky!

This fork obviously does not inherit any of IBM's certifications and doesn't get IBM's (or Red Hat's) support. But if you think you'd rather try this than my SANtricity CSI, you can.

So, this driver is a great match for E-Series integration, especially if you'd rather use a patched IBM CSI driver than a fully custom one (SANtricity CSI).

## What's not implemented 

Portset host definer setting is something my patch ignores, the reason being SANtricity arrays don't have *that* many ports to require micro-management. And in Kubernetes environments you will probably have an all-see-everything situation in any case. It can be done, but I don't see much value in it. 

Other things not included: 

- Call home (don't call me, I'll call you!) 
- SVC Enhanced Stretch Cluster (no can do)
- Snapshots and clones (same reason as Portset; can be implemented, though) 
- Policy-based replication (doesn't seem important enough; I think Kubernetes users should use native application replication and clustering)
- NVMe+FC support (no hardware to test, and not interested. It might work out of box, who knows!) 
- IO group support, HyperSwap and other features specific to IBM storage hardware
- Topology awareness - this what portsets enable and probably not very relevant for Kubernetes with SANtricity (which isn't a scale-out storage array, unlike some of IBM's block storage arrays). (See my first SANtricity CSI post for my opinion on how it should be done for SANtricity; long story short, in a Kuberntes environment that spans racks I'd implement multiple, independent, smaller E-Series arrays rather than one big one, and deploy one SANtricity CSI instance per array.)
- UNIX support (I've no UNIX systems at home, so... As an aside, I built working Trident [binaries for Power and Linux on zOS](/2021/02/24/netapp-trident-on-arm64#notes-on-linuxs390x-feb-25-2021) five years ago, also ARM64 containers for Trident CSI [before](/2021/07/31/netapp-trident-v21.07.html#trident-v2107-on-arm64) it was officially supported)

The patch'es README file has more technical details about differences from upstream.

## How to use it 

### Configuration and deployment 

For this version (v1.13), make sure you have a Kubernetes 1.32-1.34 (or OpenShift 4.16-4.20) cluster on x86 systems and one E-Series array with iSCSI or NVMe/RoCE interfaces (even Fibre Channel might work, it's just that I don't have a way to test it, and wouldn't even if I could).

iSCSI should be the stable one, as NVMe/RoCE is not supported by upstream - only NVMe/FC is, so it's a change but not a big one. Note that SANtricity also supports NVMe/FC, and NVMe/FC discovery already exists in upstream, so that might work as well.

Folks who have IBM storage and use IBM Block CSI driver: this driver aims to install in a different name space (`default`). IBM's CSI driver uses own, non-default namespace. This patch also uses a slightly different CSI driver name (`santricity.block.csi.ibm.com`) to avoid naming conflicts and give credit to upstream. So it should be able to coexist with "real" IBM Block Storage CSI driver within the same Kubernetes cluster.

How to deploy it: 

```sh 
git clone https://github.com/scaleoutsean/ibm-block-csi-driver
cd ibm-block-csi-driver/
cat santricity/README.md

# if you want to build your own 
# sudo apt install make -y
# make vendor-santricity

kubectl apply -f ./deploy/santricity-solidfire/ibm-block-csi-operator.yaml
kubectl apply -f ./deploy/santricity-solidfire/csi.ibm.com_v1_ibmblockcsi_cr.yaml

# edit array details (management API, username, password, and storage pool name).
# I recommend using one large DDP
vim deploy/santricity-solidfire/secret-santricity.yaml
kubectl apply -f deploy/santricity-solidfire/secret-santricity.yaml
```

This gives you a working CSI provisioner.

```sh 
$ kubectl get pods -A
NAMESPACE        NAME                                         READY   STATUS    RESTARTS       AGE
default          ibm-block-csi-controller-0                   8/8     Running   0              42s
default          ibm-block-csi-node-d5vpp                     3/3     Running   0              42s
default          ibm-block-csi-operator-85d5dd55c5-vf9l6      1/1     Running   0              77m
```

Next, create (or identify) a storage pool to use and configure a storage class. 

- Make sure you provide correct authentication details (your IP might get locked out) and TLS verification behavior
- I recommend using DDP pools, just like in SANtricity CSI 

For the latter, edit `./deploy/santricity-solidfire/demo-storageclass-santricity.yaml`, mostly to identify DDP (by name is OK, since storage pool names are enforced to be unique).

#### Checks

To see if array is reachable, check the controller pod. It's not supposed to be crashing, simply speaking.

```sh
$  kubectl get pods -A
NAMESPACE        NAME                                         READY   STATUS    RESTARTS       AGE
default          ibm-block-csi-controller-0                   8/8     Running   0              30s
default          ibm-block-csi-node-65xb5                     3/3     Running   0              74m
default          ibm-block-csi-operator-85d5dd55c5-xd79h      1/1     Running   0              75m

$ kubectl logs ibm-block-csi-controller-0
Defaulted container "ibm-block-csi-controller" out of: ibm-block-csi-controller, csi-provisioner, csi-attacher, csi-snapshotter, csi-resizer, csi-addons-replicator, csi-volume-group, livenessprobe
2026-02-25 09:18:12,282 DEBUG   [125328088737600] [MainThread] (ds8k_volume_cache.py:__init__:11) - creating a new cache
2026-02-25 09:18:12,662 INFO    [125328088737600] [MainThread] (controller_server_manager.py:start_server:44) - Controller version: 1.13.0
2026-02-25 09:18:12,662 DEBUG   [125328088737600] [MainThread] (controller_server_manager.py:start_server:47) - Listening for connections on endpoint address: unix:///var/lib/csi/sockets/pluginproxy/csi.sock
2026-02-25 09:18:12,664 DEBUG   [125328088737600] [MainThread] (controller_server_manager.py:start_server:50) - Controller Server running ...
2026-02-25 09:18:12,860 INFO    [125327011477248] [ThreadPoolExecutor-0_0] (decorators.py:_set_sync_lock:48) - GetPluginInfo
2026-02-25 09:18:12,861 INFO    [125327011477248] [ThreadPoolExecutor-0_0] (decorators.py:_set_sync_lock:54) - finished GetPluginInfo
```

Check your storage class: 

```sh
$ kubectl get sc
NAME                           PROVISIONER                         RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
demo-storageclass-santricity   santricity.block.csi.ibm.com        Delete          Immediate           true                   100s
santricity                     santricity.scaleoutsean.github.io   Delete          Immediate           true                   2d18h
santricity-hdd-raid6           santricity.scaleoutsean.github.io   Retain          Immediate           true                   2d17h
santricity-nvme-raid1          santricity.scaleoutsean.github.io   Delete          Immediate           true                   2d17h
santricity-nvme-raid6          santricity.scaleoutsean.github.io   Delete          Immediate           true                   2d17h

$ kubectl describe sc demo-storageclass-santricity
Name:            demo-storageclass-santricity
IsDefaultClass:  No
Annotations:     kubectl.kubernetes.io/last-applied-configuration={"allowVolumeExpansion":true,"apiVersion":"storage.k8s.io/v1","kind":"StorageClass","metadata":{"annotations":{},"name":"demo-storageclass-santricity"},"parameters":{"csi.storage.k8s.io/controller-publish-secret-name":"santricity-secret","csi.storage.k8s.io/controller-publish-secret-namespace":"default","csi.storage.k8s.io/fstype":"xfs","csi.storage.k8s.io/node-stage-secret-name":"santricity-secret","csi.storage.k8s.io/node-stage-secret-namespace":"default","csi.storage.k8s.io/provisioner-secret-name":"santricity-secret","csi.storage.k8s.io/provisioner-secret-namespace":"default","csi.storage.k8s.io/secret-name":"santricity-secret","csi.storage.k8s.io/secret-namespace":"default","pool":"data","volume_name_prefix":"csi"},"provisioner":"santricity.block.csi.ibm.com","reclaimPolicy":"Delete"}

Provisioner:           santricity.block.csi.ibm.com
Parameters:            csi.storage.k8s.io/controller-publish-secret-name=santricity-secret,csi.storage.k8s.io/controller-publish-secret-namespace=default,csi.storage.k8s.io/fstype=xfs,csi.storage.k8s.io/node-stage-secret-name=santricity-secret,csi.storage.k8s.io/node-stage-secret-namespace=default,csi.storage.k8s.io/provisioner-secret-name=santricity-secret,csi.storage.k8s.io/provisioner-secret-namespace=default,csi.storage.k8s.io/secret-name=santricity-secret,csi.storage.k8s.io/secret-namespace=default,pool=data,volume_name_prefix=csi
AllowVolumeExpansion:  True
MountOptions:          <none>
ReclaimPolicy:         Delete
VolumeBindingMode:     Immediate
Events:                <none>
```

All right, demo-storageclass-santricity is good to go!

### PVCs 

One last thing before "The Moment of Truth": this driver has the "Host Definer" feature to register hosts with storage. This CSI driver should do this for you, so first try to create a PVC and see what happens (whether host(s) get registered or not). The reason I suggest this is your network host name (for Kubernetes workers) may be different from what SANtricity has. My Python client library tries to figure it out, but you may theoretically end up with duplicate host names or some mix up between host groups and hosts. I've seen such bugs in SANtricity CSI (see the blog post).

That should be mitigated by querying hosts by IQN or NQN, but then there are also situations where a client might have both (!) and possibly other edge cases. SANtricity CSI has likely fixed that and I think I've implemented that correctly in this driver so I haven't even seen that bug here, but who really knows?

So just watch out how the first PVC gets created (or not) and how hosts and host groups change (or not). Without topology awareness (i.e portsets) we should want to present volumes to a host group that containers all workers. If provisioning fails, then create a host group and hosts (with NQNs or IQNs (or FC WWNs)) and retry. 

My first try went like this.

```sh 
# kubectl get pvc
NAME                  STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS                   VOLUMEATTRIBUTESCLASS   AGE
demo-pvc-santricity   Bound    pvc-b766ad3e-388b-43c0-b3d1-cc5f4c5fd865   12Gi       RWO            demo-storageclass-santricity   <unset>                 4s
```

Control plane worked. Good. 

The name on E-Series? Don't ask. It's `csi_GkR7FvXS9dqXv3zDQpN7gCQshS`.

![IBM Block CSI (patched for SANtricity) volume name in SANtricity](/assets/images/ibm_block_driver_for_santricity_02.png)

Don't blame me - this patch in charge of the prefix only (adjustable; default: `csi_`)! My SANtricity CSI driver uses (trimmed, due to length) PVC names. Here, I won't interfere. 

What I can - and do - is tag these volumes with SANtricity volume metadata tags. You get these, and can collect them with my [E-Series SANtricity Collector](https://github.com/scaleoutsean/eseries-santricity-collector) or your own API client. 
- pvc_name - from csi.storage.k8s.io/pvc/name  
- pvc_namespace - from csi.storage.k8s.io/pvc/namespace
- pv_name - from csi.storage.k8s.io/pv/name
- fstype - from csi.storage.k8s.io/pv/fstype

Attached PVC, used by a running pod. 

```sh
$ kubectl describe pvc demo-pvc-santricity
Name:          demo-pvc-santricity
Namespace:     default
StorageClass:  demo-storageclass-santricity
Status:        Bound
Volume:        pvc-253086a7-e1da-433a-89bf-4086aa27b972
Labels:        <none>
Annotations:   pv.kubernetes.io/bind-completed: yes
               pv.kubernetes.io/bound-by-controller: yes
               volume.beta.kubernetes.io/storage-provisioner: santricity.block.csi.ibm.com
               volume.kubernetes.io/storage-provisioner: santricity.block.csi.ibm.com
Finalizers:    [kubernetes.io/pvc-protection]
Capacity:      12Gi
Access Modes:  RWO
VolumeMode:    Filesystem
Used By:       first-ibm-csi-pod
Events:        <none>

$ kubectl describe pv pvc-253086a7-e1da-433a-89bf-4086aa27b972
Name:            pvc-253086a7-e1da-433a-89bf-4086aa27b972
Labels:          <none>
Annotations:     pv.kubernetes.io/provisioned-by: santricity.block.csi.ibm.com
                 volume.kubernetes.io/provisioner-deletion-secret-name: santricity-secret
                 volume.kubernetes.io/provisioner-deletion-secret-namespace: default
Finalizers:      [kubernetes.io/pv-protection external-attacher/santricity-block-csi-ibm-com]
StorageClass:    demo-storageclass-santricity
Status:          Bound
Claim:           default/demo-pvc-santricity
Reclaim Policy:  Delete
Access Modes:    RWO
VolumeMode:      Filesystem
Capacity:        12Gi
Node Affinity:   <none>
Message:
Source:
    Type:              CSI (a Container Storage Interface (CSI) volume source)
    Driver:            santricity.block.csi.ibm.com
    FSType:            xfs
    VolumeHandle:      SANtricity:020000006D039EA000493A2600000961699EEF96;020000006D039EA000493A2600000961699EEF96
    ReadOnly:          false
    VolumeAttributes:      storage.kubernetes.io/csiProvisionerIdentity=1772028796876-5291-santricity.block.csi.ibm.com
Events:                <none>
```

The demo storage class above is the default one; XFS and RAID 6. I used a DDP pool named `data` (which can also be set using a `poolId` rather than name). You can also use RAID 1 on DDP. 

What neither this patched IBM block CSI driver nor SANtricity CSI do is create new DDPs or Disk Groups, but SANtricity CSI doesn't want to deal with non-DDP storage pools (I think it should be optimized, so SANtricity supports only DDP pools, although you could point it to any). This patch doesn't do that and isn't picky about underlying storage pools: use any type of storage pool you want - all you need is to provide a `PoolId`.

Other arrays supported by this driver also support different RAID types, this patch follows. If you like to micro-manage low level storage, use RAID 1, RAID 5, RAID 6, or DDP. If you use DDP, your Storage Class choices are RAID 1 or RAID 6, with RAID 6 as the default. The rest ("classic" disk groups) has no choice - a PVC's RAID type follows underlying disk group's RAID type.

For general use cases, DDP is vastly superior and should be used over other types of storage pools.

![First SANtricity PVC with IBM Block CSI driver](/assets/images/ibm_block_driver_for_santricity_01.png)

## Possible improvements 

- Snapshots - highly desirable, but I'm focusing on SANtricity CSI as the "native" SANtricity CSI driver for Kubernetes. If anyone uses this patch and needs snapshots and linked clones (aka "snapshot volumes"), let me know in issues (or ping me on X)
- Clones - slightly less interesting, but interesting 
- Portsets - these aren't really a thing on E-Series arrays, but we could expose them ("portsets" being matching sets of host-facing controller ports), it's just need some work

I haven't updated this CSI from upstream yet but, after v1.14 comes out, I'll see how difficult or easy it is. In the meantime, I assume you can cherry-pick and apply fixes or improvements that appear between IBM's releases. It's not like you'll lose support - this CSI already doesn't have it!

## Demo 

- [IBM Block Storage CSI driver with SANtricity Patch and NVMe/RoCE](https://rumble.com/v76ascc-ibm-block-csi-with-santricity-patch-iscsi.html) - 8m17s

## Conclusion 

It would be best if Trident CSI supported E-Series - I could spend free time on other things E-Series - but since it doesn't, I've created two alternatives for own (and anyone's) use, so now we have a "native" SANtricity CSI on the one side, and this patch of IBM Block Storage CSI with SANtricity support on the other. Both of them are "BOYCSI", but that's how it is.

With two working prototypes that support SANtricity 11.9 and modern storage protocols (NVMe/RoCE, iSCSI) and given how stable SANtricity API is, these should be easy to maintain for years to come, even if you do it yourself. My patched IBM block CSI driver has only minor changes to upstream code, so it should be easy to update once IBM releases a new version.

I recommend SANtricity CSI for NVMe/RoCE and "modern" use cases, and this patch of IBM Block Driver CSI for following use cases and situations: 
- iSCSI environments (although NVMe/RoCE is the one I tested, upstream does not officially support NVMe/RoCE, while my own SANtricity CSI focuses on NVMe/RoCE)
- Self-sufficient OpenShift users with E-Series. I suspect even OpenShift Virtualization (KubeVirt) might work
- SANtricity users already familiar with IBM Block Driver CSI 
- Folks willing to experiment with SANtricity in an FC SAN environment
- Folks who must micro-manage or use classic RAID which SANtricity CSI does not target

You probably shouldn't use it for air traffic control and similar.

Check out the [README](https://github.com/scaleoutsean/ibm-block-csi-driver/tree/santricity/santricity).
