# KubeVirt backup, restore with NetApp SolidFire & Kasten K10

Move and protect small VMs to Kubernetes with NetApp SolidFire and Trident CSI

- [Introduction](#introduction)
- [KubeVirt VMs](#kubevirt-vms)
- [Snapshot and Backup](#snapshot-and-backup)
- [Restore](#restore)
- [Demo](#demo)
- [Summary](#summary)
- [Update](#update)

## Introduction

KubeVirt is still early in its development, but it's getting better.

Some SolidFire users are eager to move their VMs to Kubernetes and since I've been playing with Kubernetes to test several other things, I decided to take a look at this again (last time I just couldn't make it work).

## KubeVirt VMs

See the documentation on what they are and how they work.

It's Virtual Machines on Kubernetes. 

Here my CSI provisioner is NetApp Astra Trident v23.01 and my back-end is SolidFire. Kubernetes is v1.26.1 and KubeVirt v0.59.0-rc.1.

![KubeVirt VM with Trident and SolidFire](/assets/images/kubevirt-solidfire-00.png)

```sh
$ kubectl get vm -n vm
NAME     AGE   STATUS    READY
seanvm   15m   Running   True

$ kubectl get pvc -n vm 
NAME            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
solidfire-pvc   Bound    pvc-d0e6feda-e9a8-4890-975a-fa193315fcde   1Gi        RWO            bronze         15m

$ kubectl get sc
NAME                        PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
bronze                      csi.trident.netapp.io   Delete          Immediate           false                  23h

$ kubectl describe sc bronze
Name:                  bronze
IsDefaultClass:        No
Annotations:           <none>
Provisioner:           csi.trident.netapp.io
Parameters:            IOPS=300,backendType=solidfire-san,fsType=xfs
AllowVolumeExpansion:  <unset>
MountOptions:          <none>
ReclaimPolicy:         Delete
VolumeBindingMode:     Immediate
Events:                <none>
```

It's funny that this works - it's actually not supposed to (as far as I understand it) - but if you watch the demo you will see it did work. Or maybe the KubeVirt documentation isn't up to date. 

```sh
$ kubectl describe vm seanvm -n vm
Name:         seanvm
Namespace:    vm
Labels:       <none>
Annotations:  kubevirt.io/latest-observed-api-version: v1
              kubevirt.io/storage-observed-api-version: v1alpha3
API Version:  kubevirt.io/v1
Kind:         VirtualMachine
...
      Volumes:
        Container Disk:
          Image:  quay.io/kubevirt/cirros-container-disk-demo
        Name:     containerdisk
        Cloud Init No Cloud:
          userDataBase64:  SGkuXG4=
        Name:              cloudinitdisk
        Name:              solidfire-pv
        Persistent Volume Claim:
          Claim Name:  solidfire-pvc
...
  Volume Snapshot Statuses:
    Enabled:  false
    Name:     containerdisk
    Reason:   Snapshot is not supported for this volumeSource type [containerdisk]
    Enabled:  false
    Name:     cloudinitdisk
    Reason:   Snapshot is not supported for this volumeSource type [cloudinitdisk]
    Enabled:  false
    Name:     solidfire-pv
    Reason:   2 matching VolumeSnapshotClasses for bronze
```

From this we see the SolidFire PV is snapshot-able.

## Snapshot and Backup

As the VM above is running in the `vm` namespace, I can protect it with Kasten v5.5.4 (the same version as in the previous blog post).

![KubeVirt Applications](/assets/images/kubevirt-solidfire-02.png)

Notice the disk icon, that's the 1Gi SolidFire volume assigned to `seanvm`.

Without creating a policy we can take an on-demand snapshot which - because the Trident CSI SC supports snapshots - will create a SolidFire snapshot on storage back-end. 

The Kasten documentation states:

> If it's not acceptable to have the Virtual Machine's guest filesystem frozen for the time that creating the snapshot takes, K10 can be instructed to abort the snapshot operation and unfreeze the Virtual Machine. 

It seems some storage can freeze VMs for several minutes while it takes a snapshot... It takes a second with Trident and SolidFire.

I didn't export snapshot to external Kasten repository - because [I've blogged about that](/2023/02/09/veeam-eseries-nfs-storage-provider.html) earlier this week.

## Restore

To restore, follow the same process as for any Kasten-protected app: find the app, click on Restore and find a recent backup.

![KubeVirt Restore](/assets/images/kubevirt-solidfire-03.png)

This screenshot shows outcome of this restore action (and the backup that preceded it).

![KubeVirt on-demand snapshot](/assets/images/kubevirt-solidfire-01.png)

## Demo

- [KubeVirt with Trident and SolidFire](https://rumble.com/v29h9sw-kubevirt-with-trident-solidfire-and-kasten.html) - 4m8s

## Summary

KubeVirt is still immature and inconvenient to use (even if you compare it with KVM, which isn't exactly the gold standard of usability).

But if you'd like to move some lightweight VMs - I wouldn't even say lightweight databases - to Kubernetes in 2024, it's a good time to start evaluating this stuff. 

For more mature VMware-to-freeware VM migration, consider [OpenStack](/2022/03/02/openstack-solidfire-part-2.html), which can also integrate with Kubernetes using Cinder CSI.

Or - if you don't want to deal with OpenStack, just KVM - especially when managed by HashiCorp Nomad which [works well](/2022/03/23/nomad-solidfire-hostpath-volumes.html) with static SolidFire volumes: there's no shared storage HA in this scenario, but there's no shared storage HA with stand-alone KVM boxes either.

To save time and trouble, containerize what can be containerized. I wouldn't use OpenStack or KubeVirt just because I don't want to containerize a workload. But if you can't do it, OpenStack works well now, and KubeVirt may soon for "basic" VMs. 

## Update

- 2024/02/23 - Kasten blog [describes](https://veeamkasten.dev/ocpv-migration) their process for VM-to-KubeVirt migration to OpenShift
