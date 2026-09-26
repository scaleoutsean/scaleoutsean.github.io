# k0rdent k0s, SANtricity CSI, NetApp E-Series

How to use k0rdent and k0s with NetApp E-Series (SANtricity) systems

## What is k0rdent and why should E-Series users care?

To be honest, I didn't know either. I did know about k0s and in fact I tried to use it in development with SolidFire CSI some six weeks ago, but I hadn't been aware of k0rdent at the time.

According to [this CNCF press release](https://www.cncf.io/blog/2025/02/24/introducing-k0rdent-design-deploy-and-manage-kubernetes-based-idps/):

> k0rdent is a Kubernetes-native distributed container management environment (DCME) designed to help platform engineers manage infrastructure at massive scale. Built on Kubernetes’ maturity, stability, and wide adoption, k0rdent leverages community-driven standards to minimize adoption risks. Acting as a “super control plane,” it enables centralized, template-driven lifecycle management of Kubernetes clusters and services across on-prem, cloud, and hybrid environments.

Okay, what they said!

There's a bunch of stuff in k0rdent, but let's just say it looks like an RKE successor. And it reminds me of the approach of NKS (NetApp Kubernetes Service) and later RKE on NetApp HCI, which NetApp used to include in NetApp HCI.

Also relevant is [this](https://www.mirantis.com/company/press-center/company-news/mirantis-selected-as-inaugural-partner-in-vast-data-s-cosmos-partner-program/) - k0rdent is backed by Mirantis who aren't some three person startup. Last time I touched upon Mirantis was [in this post about Miirantis Kubernetes Engine with SolidFire](/2021/05/02/mirantis-mke-netapp-trident-solidfire.html) and I know Mirantis and SolidFire had large joint customers, so I'm happy to work with their products again.

Also similar to what NetApp HCI had in NKS and later RKE, k0rdent has a growing catalog of AI and Analytics solutions.

![k0rdent catalog](/assets/images/k0rdent-k0s-santricity-csi-catalog-03.png)

This is what NetApp HCI/SolidFire had **in 2019** (NKS catalog; [source](https://www.netapp.com/blog/creating-simple-and-powerful-hybrid-clouds/)). Even NVIDIA's inference server was available for NeApp HCI H615C compute nodes with Tesla T4 GPUs servers.

![NKS catalog](/assets/images/k0rdent-k0s-santricity-csi-catalog-nks-04.png)

That's another reason k0rdent excites me.

There is a lot to explore there, but the first and most important step is to stand up k0s and hook it into my array(s).

Given k0rdent's focus on AI and Analytics, E-Series SANtricity systems first. You may have your unstructured data on this or that system (S3, NFS, etc) but you'll need fast databases where E-Series arrays are a great match.

So, how does one "install k0rdent"?

You need [k0s](https://docs.k0rdent.io/latest/quickstarts/#supported-operating-systems), which is like "k3s for k0rdent". To get started you need...

> Any linux based os that supports deploying k0s will work, though you may need to adjust the suggested commands.

Supported OS include just Ubuntu Server 24.04 LTS. Unsuprisingly, Red Hat isn't on board (just yet).

But, that is a perfect reason to try precisely that, just to see it can be done!

## Setup k0s with SANtricity CSI 

### k0s on Rocky Linux 10.1

I used Rocky Linux 10.1 which seemed entirely appropriate given that RHEL is not supported. 

I do most of my work with Ubuntu and Debian, and I expected less challenges with those and thought this may be interesting to Rocky Linux users.

You shouldn't follow these steps blindly as they will age anyway, but if you happen to be trying it now, or get stuck, maybe some of them will help you. As the root user:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://get.k0s.sh | sudo sh
k0s install controller --enable-worker --no-taints
k0s start
sleep 60
k0s status 
k0s kubectl get nodes
cat /var/lib/k0s/pki/admin.conf > ~/.kube/k0s.conf
export KUBECONFIG=~/.kube/k0s.conf
```

It appears at least tcp/8132 is mandatory, but I opened both because why spend time on figuring it out when I'm just testing.

```sh
# 8132 comment "konnectivity agents"
# 10250 comment "kubelet from pods"
firewall-cmd --permanent --zone=public --add-port=8132/tcp
firewall-cmd --permanent --zone=public --add-port=10250/tcp
firewall-cmd --reload
```

### CSI steps

Now that our singleton k0s Kubernetes cluster is running, we can do the CSI thing. **Only NVMe/RoCE and iSCSI** are expected to work!   

Go into SANtricity Swagger/Open API interface to figure out `poolId` from `GET /storage-pools` output. I suggest using a DDP storage pool.

If you don't have a DDP you can use, create a small RAID 1 disk group and use that pool ID. Otherwise, you'll have to change the demo Storage Class which uses RAID 1 (or create your own for whatever RAID level you want; supported are R1, R5, R6).

```sh
git clone https://github.com/scaleoutsean/santricity-go 
# create my-values.yaml - see https://github.com/scaleoutsean/santricity-go/blob/master/charts/README.md or
# cat ./santricity-go/charts/README.md
vim my-values.yaml 
# enter santricity-go root directory
cd santricity-go/
# install Helm if you don't have it, make sure this works: helm -h
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash
# node.kubeletDir enables custom kubelet directory path for k0s/k0rdent 
helm install santricity-csi ./charts/santricity-csi -f ../my-values.yaml --namespace santricity-csi --create-namespace  --set node.kubeletDir=/var/lib/k0s/kubelet --kubeconfig ~/.kube/k0.conf
# if it craps out:
# helm delete santricity-csi -n santricity-csi --kubeconfig ~/.kube/k0.conf
# if it installs okay: 
# delete ../my-values.yaml  # or at least remove password from the file
```

Expected result:

```sh
NAME: santricity-csi
LAST DEPLOYED: Sun Mar  1 13:16:39 2026
NAMESPACE: santricity-csi
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
TEST SUITE: None
```

The key (and new) part here is `--set node.kubeletDir=/var/lib/k0s/kubelet`. This fixes the manual hassle of search-and-replace across the Helm charts. When you upgrade, you need to remember this and pass the same parameter again.

When running `kubectl`, it's easier to prefix `kubectl` with `k0s` like so. 

```sh
$ k0s kubectl get pods -A
NAMESPACE     NAME                                         READY   STATUS    RESTARTS   AGE
default       santricity-csi-controller-69fbff77d8-9rg94   4/4     Running   0          8s
default       santricity-csi-controller-69fbff77d8-rz62x   4/4     Running   0          8s
default       santricity-csi-node-rf7gh                    2/2     Running   0          8s
kube-system   coredns-55c758887c-lrrm8                     1/1     Running   0          19m
kube-system   konnectivity-agent-m4cxg                     1/1     Running   0          19m
kube-system   kube-proxy-kjkdr                             1/1     Running   0          19m
kube-system   kube-router-gvlvx                            1/1     Running   0          19m
kube-system   metrics-server-df68c566c-g29vd               1/1     Running   0          19m
```

Notice that when we extracted kubeconfig that was for the Helm command, not for `k0s kubectl`.

K0s has its own "take" on Helm (the catalog thing) and I didn't follow their approach because my immediate concern was to get the CSI thing done. I left that for another time. Anyway, my caveman approach worked without any issue.

Default Storage Class deployed by the Helm chart uses RAID 1, so don't go crazy provisioning with it. I suggest to size PVCs in 4 GB units.

```sh
$ k0s kubectl get sc
NAME                              PROVISIONER                         RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
santricity-nvme-raid1 (default)   santricity.scaleoutsean.github.io   Delete          Immediate           true                   5m36s
```

All rightie! Now we need some PVC and pod stuff to try this out. I found one on the Longhorn Github repo and modified to:
- Use my storage class `santricity-nvme-raid1`
- List the `/data/` path instead of `/data/lost+found`

```yaml 
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: longhorn-volv-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: santricity-nvme-raid1
  resources:
    requests:
      storage: 2Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: volume-test
  namespace: default
spec:
  restartPolicy: Always
  containers:
  - name: volume-test
    image: nginx:stable-alpine
    imagePullPolicy: IfNotPresent
    livenessProbe:
      exec:
        command:
          - ls
          - /data/
      initialDelaySeconds: 5
      periodSeconds: 5
    volumeMounts:
    - name: volv
      mountPath: /data
    ports:
    - containerPort: 80
  volumes:
  - name: volv
    persistentVolumeClaim:
      claimName: longhorn-volv-pvc
```

Use `k0s kubectl apply -f` on that test YAML file. Change from `default` if you don't want to use the default namespace.

A PVC and a pod will be created. 

An abridged version of `GET /volumes` from SANtricity Swagger shows the PV with the less relevant details removed:

```json
{
    "offline": false,
    "extremeProtection": false,
    "volumeHandle": 132,
    "raidLevel": "raid1",
    "sectorOffset": "132",
    "worldWideName": "6D039EA000493A260000096369A479B2",
    "label": "pvc-1f6ac50e-7a82-433_9e33622a",
    "blkSize": 4096,
    "capacity": "2147483648",
    "volumeRef": "020000006D039EA000493A260000096369A479B2",
    "status": "optimal",
    "volumeGroupRef": "040000006D039EA000493A26000004FD6996CBC0",
    "metadata": [
        {
        "key": "fstype",
        "value": "xfs"
        },
        {
        "key": "pvc_namespace",
        "value": "default"
        },
        {
        "key": "pvc_name",
        "value": "longhorn-volv-pvc"
        },
        {
        "key": "pv_name",
        "value": "pvc-1f6ac50e-7a82-4339-9b68-0ce8e39e63c2"
        }
    ],
    "wwn": "6D039EA000493A260000096369A479B2",
    "preferredControllerId": "070000000000000000000002",
    "totalSizeInBytes": "2147483648",
    "listOfMappings": [
        {
        "lunMappingRef": "8800000033000000000000000000000000000000",
        "lun": 1,
        "ssid": 132,
        "perms": 15,
        "volumeRef": "020000006D039EA000493A260000096369A479B2",
        "type": "host",
        "mapRef": "840000006D039EA000493A9C003006A869971530",
        "id": "8800000033000000000000000000000000000000"
        }
    ],
    "mapped": true,
    "currentControllerId": "070000000000000000000001",
    "name": "pvc-1f6ac50e-7a82-433_9e33622a",
"id": "020000006D039EA000493A260000096369A479B2"
}
```

The mapping is there, and so are the Kubernetes metadata for this PVC. Perfect!

Let's do some screenshot pr0n... k0s on Rocky Linux 10.1:

![k0s on Rocky Linux with SANtricity CSI](/assets/images/k0rdent-k0s-santricity-csi-01.png)

k0s with SANtricity CSI:

![k0s on Rocky Linux with SANtricity CSI](/assets/images/k0rdent-k0s-santricity-csi-02.png)

Installation on Ubuntu should be equally uneventful.

In the case something's off with SANtricity CSI, submit an issue on the Github repository. I can't promise anything, but I'll see what I can do.

## Conclusion and next steps

SANtricity CSI is a lightweight, SANtricity-focused CSI provisioner for NetApp E-Series. 

After failing due to the kubelet path issue, it took me a couple of hours on a Sunday evening to improve the Helm chart, test and rework the SANtricity CSI install instructions. This is a common issue that was affecting k3s users, but I needed a reason to justify that extra work, which came in k0rdent/k0s.

k0s provides the flag `--kubelet-root-dir`, but that isn't available to existing k0s users who may want to try SANtricity CSI, and the same change in SANtricity CSI's Helm chart will also benefit Talos Linux users although I haven't gotten to testing that one yet.

I can't say whether SANtricity CSI is stable, reliable, etc. It probably has just one user and it's been around for several weeks. It's not like there are many choices, so it's "one of best" CSI solutions for E-Series there is. ([vSphere CSI](/2022/05/18/vmware-tanzu-netapp-eseries.html) might be "the best", but it comes at a price.)

For a while, Mirantis seemed caught off guard by the shift from OpenStack to Kubernetes. k0rdent and k0s seem like a great pivot and it's highly relevant to E-Series. Back in 2019, I was evangelizing plugging E-Series into NetApp HCI with NKS - basically using SolidFire as "management storage" for AI/Analytics where SolidFire just couldn't meet the price or performance that SANtricity could - and still can - deliver. NKS was replaced by RKE and NetApp HCI ended soon after that and, in 2022, E-Series was dropped from Trident CSI, so the idea of using E-Series in AI and Analytics environments on Kubernetes didn't develop as I had hoped for. 

But now there's k0rdent and there's SANtricity CSI, which looks very promising. There are other [CSI](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html) drivers (native and other) you can use with E-Series, too.

Next steps for SANtricity CSI in terms of k0s:
- Figure out how to register/load SANtricity CSI Helm Chart in k0rdent catalog.
- Try some of the AI and Analytics solutoins from their catalog with SANtricity CSI.
- Investigate k0s with [KubeVirt](https://docs.k0rdent.io/latest/quickstarts/quickstart-2-kubevirt/). SolidFire used to [work closely](https://finance.yahoo.com/news/solidfire-mirantis-extend-partnership-power-155636851.html) with Mirantis due to their (and SolidFire's) OpenStack expertise, so Mirantis is well known for their expertise in OpenStack and virtualization. k0s, KubeVirt, and SANtricity CSI would open up some nice solutions for E-Series users!
