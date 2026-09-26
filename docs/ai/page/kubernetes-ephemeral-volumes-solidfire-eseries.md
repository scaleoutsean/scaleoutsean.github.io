# Ephemeral volumes with BeeGFS CSI provisioner on Kubernetes

Create and use inline emphemeral volumes with E-Series (BeeGFS CSI) and SolidFire

One of more obvious characteristics of Persistent Volumes is they persist, i.e. survive pod(s) that use them until the claim for the PV itself is deleted, assuming reclaim policy is set to Delete.

This isn't ideal for workloads where pods need a PVC only as long as they run, because sooner or later every PVC they use still has to be be deleted.

Maybe you run hundreds of batch jobs which don't need persistent volumes, but you want to use BeeGFS backed by E-Series or even SolidFire, for example, and have those "EVCs" wiped out as soon as there's no pod that uses them.

Assuming a BeeGFS CSI with a Storage Class `csi-beegfs-dyn-sc` in place, users of Kubernetes 1.23 can create ephemeral volume claims like so: 

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - image: nginx:alpine
      name: test
      volumeMounts:
      - mountPath: /data
        name: eph
  volumes:
  - ephemeral:
      volumeClaimTemplate:
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 2Gi
          storageClassName: csi-beegfs-dyn-sc
    name: eph
```

That fires up a pod and creates an ephermeral PVC $POD_NAME-eph (here: test-eph):

```sh
$ kubectl get pvc 
NAME                  STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS        AGE
csi-beegfs-dyn-kvol   Bound    pvc-c6a814cf   2Gi        RWO            csi-beegfs-dyn-sc   14d
csi-beegfs-dyn-pvc    Bound    pvc-f5bc5dfe   1Gi        RWX            csi-beegfs-dyn-sc   17d
test-eph              Bound    pvc-f0830157   2Gi        RWO            csi-beegfs-dyn-sc   87s
```

The pod is using test-eph volume:

```sh
$ kubectl describe pod test
Name:         test
Namespace:    default
Priority:     0
Node:         k8s-n-1/192.168.105.12
Start Time:   Fri, 29 Apr 2022 06:26:33 +0000
Labels:       <none>
Annotations:  cni.projectcalico.org/podIP: 192.168.122.45/32
              cni.projectcalico.org/podIPs: 192.168.122.45/32
Status:       Running
IP:           192.168.122.45
IPs:
  IP:  192.168.122.45
Containers:
  test:
    Container ID:   containerd://7b826304e2618ce43987d8bd2f00ab2251320a1018684380863f7b052c8c197e
    Image:          nginx:alpine
    Image ID:       docker.io/library/nginx@sha256:5a0df7fb7c8c03e4158ae9974bfbd6a15da2bdfdeded4fb694367ec812325d31
    Port:           <none>
    Host Port:      <none>
    State:          Running
      Started:      Fri, 29 Apr 2022 06:26:40 +0000
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /data from eph (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-kqj6r (ro)
```

Ephemeral volume test-eph:

```sh
$ kubectl describe pvc test-eph
Name:          test-eph
Namespace:     default
StorageClass:  csi-beegfs-dyn-sc
Status:        Bound
Volume:        pvc-f0830157
Labels:        <none>
Annotations:   pv.kubernetes.io/bind-completed: yes
               pv.kubernetes.io/bound-by-controller: yes
               volume.beta.kubernetes.io/storage-provisioner: beegfs.csi.netapp.com
               volume.kubernetes.io/storage-provisioner: beegfs.csi.netapp.com
Finalizers:    [kubernetes.io/pvc-protection]
Capacity:      2Gi
Access Modes:  RWO
VolumeMode:    Filesystem
Used By:       <none>
Events:
  Type    Reason                 Age   From                                                                Message
  ----    ------                 ----  ----                                                                -------
  Normal  ExternalProvisioning   2m5s  persistentvolume-controller                                         waiting for a volume to be created, either by external provisioner "beegfs.csi.netapp.com" or manually created by system administrator
  Normal  Provisioning           2m5s  beegfs.csi.netapp.com_k8s-m-1_9b56c472-bd1a-4ca9-823d-4f639c9c1f4d  External provisioner is provisioning volume for claim "default/test-eph"
  Normal  ProvisioningSucceeded  2m4s  beegfs.csi.netapp.com_k8s-m-1_9b56c472-bd1a-4ca9-823d-4f639c9c1f4d  Successfully provisioned volume pvc-f0830157
```

On a worker node that can see that filesystem, filesytem path /mnt/beegfs/k8s/name/dyn/pvc-f0830157 exists:

```sh
$ dir -lat /mnt/beegfs/k8s/name/dyn
total 8
drwxrwxrwx 16 root             root     14 Apr 29 06:26 .
drwxrwxrwx  2 root             root      0 Apr 29 06:26 pvc-f0830157
```

And, as we would expect, here's what happens after we delete the pod.

```sh
$ kubectl delete -f nginx-native.yml 
pod "test" deleted

$ kubectl get pvc
NAME                  STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS        AGE
csi-beegfs-dyn-kvol   Bound    pvc-c6a814cf   2Gi        RWO            csi-beegfs-dyn-sc   14d
csi-beegfs-dyn-pvc    Bound    pvc-f5bc5dfe   1Gi        RWX            csi-beegfs-dyn-sc   17d
```

Ephemeral volume test-eph has been deleted as well.

Interestingly, BeeGFS CSI v1.2.1 currently does not claim (CSI driver list and features at kubernetes.io) support for Ephemeral PVCs, although that clearly works. I'll ping the BeeGFS CSI team to verify that.

I tried this with SolidFire iSCSI and Trident CSI and it worked the same way. I assume SolidFire CSI with Cinder CSI would work too, but I don't have it set up at this time.

What about Kubernetes users with pre-v1.23 releases?

Those can be handled with operators, but I haven't found one that works well so I'll stop short of making a recommendation. If you don't have long-running jobs, it may be simpler to schedule jobs to delete all PVCs in defined namespaces that meet certain conditions such as older than 1 hour and no matching pod name.
