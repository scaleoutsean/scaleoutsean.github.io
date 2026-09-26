# GA of NetApp Trident v21.04

Rancher Kubernetes with NetApp HCI and SolidFire

- [What](#what)
- [Upgrade procedure](#upgrade-procedure)
  - [Before](#before)
  - [Out with the old, in with the new](#out-with-the-old-in-with-the-new)
  - [Verify success](#verify-success)
- [Trident for ARM64 and other non-AMD64 architectures](#trident-for-arm64-and-other-non-amd64-architectures)

## What

NetApp Trident v21.04 was released yesterday. Notable Kubernetes-related enhancements:

- Added recreate strategy in Trident Operator deployment
- Added an images sub-command to tridentctl to display the container images required for a Trident installation on a specific Kubernetes version
- Added support for Kubernetes 1.21
- Added support for Trident backend creation using kubectl
- Added startup, liveness and readiness probes for Trident node pods
- Mirantis Kubernetes Engine (formerly Universal Control Plane (UCP) 3.2.11 is now supported (I wonder if it's by ONTAP-based back-ends, or all Trident-supported back-ends; follow up post can be found [here](/2021/05/02/mirantis-mke-netapp-trident-solidfire))

This release includes various improvements related to NetApp Public Cloud services and bug fixes.

The images sub-command is something that will be welcome by many, especially for those who deploy offline. It makes it easy to see what images are required to deploy Trident with different Kubernetes releases.

```sh
$ tridentctl images
+--------------------+---------------------------------------------------------+
| KUBERNETES VERSION |                     CONTAINER IMAGE                     |
+--------------------+---------------------------------------------------------+
| v1.11.0            | netapp/trident:21.04.0                                  |
+--------------------+---------------------------------------------------------+
| v1.12.0            | netapp/trident:21.04.0                                  |
+--------------------+---------------------------------------------------------+
| v1.13.0            | netapp/trident:21.04.0                                  |
+--------------------+---------------------------------------------------------+
| v1.14.0            | netapp/trident:21.04.0                                  |
|                    | netapp/trident-autosupport:21.01                        |
|                    | quay.io/k8scsi/csi-provisioner:v1.6.1                   |
|                    | quay.io/k8scsi/csi-attacher:v2.2.1                      |
|                    | quay.io/k8scsi/csi-node-driver-registrar:v2.1.0         |
[...]
```

Complete set of changes and improvements in v21.04 is available at the [expected place](https://github.com/NetApp/trident/releases/tag/v21.04.0).

## Upgrade procedure

How to upgrade? You'd better RTFM for that, because it's simple but not trivial. If you're careless you can actually screw things up.

One of my clusters runs a prehistoric OCP 3.11 (OKD aka Community Version, to be exact).

Because it's a pre-CSI version of Kubernetes it can't use any CSI features so there isn't much to worry about. You can see that from the output of `tridentctl images` above - there's just one Doc... excluse me, Mirantis Container Runtime. 

### Before

```sh
$ ./trident-installer/tridentctl get backends -n trident
+---------------------------------+-------------------+--------------------------------------+--------+---------+
|              NAME               |  STORAGE DRIVER   |                 UUID                 | STATE  | VOLUMES |
+---------------------------------+-------------------+--------------------------------------+--------+---------+
| ontap-iscsi_svm2_105            | ontap-san         | 99099ec4-dcbc-4bb6-bf70-da734c9e9c5f | online |       1 |
| ontap-nas_192.168.1.55          | ontap-nas         | 118bcc5e-25a2-4ec9-b0da-6fd96c18f4a5 | online |       1 |
| ontap-nas-economy-vserver3-ocp4 | ontap-nas-economy | a6cc5bdd-9b6b-4822-90b1-643074695e9d | online |       0 |
| ontap-iscsi-103-105             | ontap-san         | ea00237b-379e-4c66-b9a1-aedad47e3491 | online |       0 |
| ontap-nas-economy-vserver3      | ontap-nas-economy | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online |       4 |
| solidfire_192.168.103.30        | solidfire-san     | eb0411b6-223b-40dd-a250-962104423012 | online |       0 |
| ontap-iscsi_192.168.1.54        | ontap-san         | 77b61815-ab1f-4f4b-96b4-13f999c2500b | online |       0 |
+---------------------------------+-------------------+--------------------------------------+--------+---------+
[vagrant@m ~]$ ./trident-installer/tridentctl get volumes -n trident
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|          NAME           |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| default-forresize-af4cd | 1.0 GiB | ontap-iscsi   | block    | 99099ec4-dcbc-4bb6-bf70-da734c9e9c5f | online | true    |
| default-q1-5cb3b        | 1.0 GiB | first         | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-18043        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-5e5ed        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-b585b        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q3-2daed        | 1.0 GiB | third         | file     | 118bcc5e-25a2-4ec9-b0da-6fd96c18f4a5 | online | true    |
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
[vagrant@m ~]$ ./trident-installer/tridentctl version -n trident
+----------------+----------------+
| SERVER VERSION | CLIENT VERSION |
+----------------+----------------+
| 21.01.1        | 21.04.0        |
+----------------+----------------+
```

### Out with the old, in with the new

For this simplest upgrade case, I don't have to do much - I only need to reinstall Trident. I run this using tridentctl v21.04.

```raw
$ ./trident-installer/tridentctl uninstall -n trident
INFO Deleted Trident deployment.                  
WARN Trident daemonset not found.                  error="no daemonsets have the label app=node.csi.trident.netapp.io" label="app=node.csi.trident.netapp.io"
WARN Trident service not found.                    error="no services have the label app=controller.csi.trident.netapp.io" label="app=controller.csi.trident.netapp.io"
WARN Trident secret not found.                     error="no secrets have the label app=controller.csi.trident.netapp.io" label="app=controller.csi.trident.netapp.io"
INFO Deleted cluster role binding.                
INFO Deleted cluster role.                        
INFO Deleted service account.                     
INFO Deleted pod security policy.                  podSecurityPolicy=tridentpods
INFO The uninstaller did not delete Trident's namespace in case it is going to be reused. 
INFO Trident uninstallation succeeded.            

$ ./trident-installer/tridentctl install -n trident
INFO Starting Trident installation.                namespace=trident
INFO Created service account.                     
INFO Created cluster role.                        
INFO Created cluster role binding.                
INFO Trident tridentsnapshots.trident.netapp.io CRD present. 
INFO Trident tridentversions.trident.netapp.io CRD present. 
INFO Trident tridentbackends.trident.netapp.io CRD present. 
INFO Installer will create a fresh tridentbackendconfigs.trident.netapp.io CRD. 
INFO Created custom resource definitions tridentbackendconfigs.trident.netapp.io.  namespace=trident
INFO Trident tridentstorageclasses.trident.netapp.io CRD present. 
INFO Trident tridentvolumes.trident.netapp.io CRD present. 
INFO Trident tridentnodes.trident.netapp.io CRD present. 
INFO Trident tridenttransactions.trident.netapp.io CRD present. 
INFO Created custom resource definitions.         
INFO Created Trident pod security policy.         
INFO Added finalizers to custom resource definitions. 
INFO Created Trident deployment.                  
INFO Waiting for Trident pod to start.            
INFO Trident pod started.                          namespace=trident pod=trident-9fb55565b-7d7sq
INFO Waiting for Trident REST interface.          
INFO Trident REST interface is up.                 version=21.04.0
INFO Trident installation succeeded.              

$ ./trident-installer/tridentctl version -n trident
+----------------+----------------+
| SERVER VERSION | CLIENT VERSION |
+----------------+----------------+
| 21.04.0        | 21.04.0        |
+----------------+----------------+
```

### Verify success

Check that everything is up and running:

```sh
$ oc get nodes
NAME      STATUS    ROLES                  AGE       VERSION
m         Ready     compute,infra,master   58d       v1.11.0+d4cacc0

$ oc get pods -n trident
NAME                      READY     STATUS    RESTARTS   AGE
trident-9fb55565b-7d7sq   1/1       Running   0          7m

$ ./trident-installer/tridentctl get volumes -n trident
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
|          NAME           |  SIZE   | STORAGE CLASS | PROTOCOL |             BACKEND UUID             | STATE  | MANAGED |
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+
| default-forresize-af4cd | 1.0 GiB | ontap-iscsi   | block    | 99099ec4-dcbc-4bb6-bf70-da734c9e9c5f | online | true    |
| default-q1-5cb3b        | 1.0 GiB | first         | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-18043        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-5e5ed        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q2-b585b        | 1.0 GiB | second        | file     | 63a98879-4f19-4c5c-8a39-3b9718685a77 | online | true    |
| default-q3-2daed        | 1.0 GiB | third         | file     | 118bcc5e-25a2-4ec9-b0da-6fd96c18f4a5 | online | true    |
+-------------------------+---------+---------------+----------+--------------------------------------+--------+---------+

```

Again, this is probably the easiest case, but Trident running on newer Kubernetes clusters isn't difficult to upgrade either.

## Trident for ARM64 and other non-AMD64 architectures

If you want to build v21.04 for ARM64 or other architecture by yourself, refer to previous posts on this topic (find it in blog Archive).

If you're a K8s-on-ARM64 user, I have an unofficial `arm64` build on [Docker Hub](https://hub.docker.com/r/scaleoutsean/trident-arm64/tags?page=1&ordering=name) but you may still need to ensure other images are also ARM64 as explained in that ARM64-related post.

Trident v21.04 on ARM64:

```sh
$ kubectl get nodes
NAME   STATUS   ROLES                  AGE   VERSION
k1     Ready    control-plane,master   73d   v1.20.2
k2     Ready    <none>                 36d   v1.20.2
k3     Ready    <none>                 73d   v1.20.2

sean@k1:~/trident/trident-installer$ tridentctl version -n trident
+------------------------+------------------------+
|     SERVER VERSION     |     CLIENT VERSION     |
+------------------------+------------------------+
| 21.04.0-custom+unknown | 21.04.0-custom+unknown |
+------------------------+------------------------+

$ kubectl describe pod trident-csi-5c98ff74fb-rwj4f -n trident
Name:         trident-csi-5c98ff74fb-rwj4f
Namespace:    trident
Priority:     0
Node:         k2/192.168.1.19
Start Time:   Sat, 01 May 2021 13:02:42 +0000
Labels:       app=controller.csi.trident.netapp.io
              pod-template-hash=5c98ff74fb
[...]

$ ssh k2 uname -a
Linux k2 4.9.241-69 #1 SMP PREEMPT Tue Feb 16 03:06:52 UTC 2021 aarch64 aarch64 aarch64 GNU/Linux
```

It seems to run fine just like it did with 21.01 but I spotted the following error in Trident logs - likely not new:

> Failed to watch *v1.TridentBackendConfig: failed to list *v1.TridentBackendConfig: tridentbackendconfigs.trident.netapp.io is forbidden: User "system:serviceaccount:trident:trident-csi" cannot list resource "tridentbackendconfigs" in API group "trident.netapp.io" in the namespace "trident".

I suppose I will need to let "system:serviceaccount:trident:trident-csi" access that resource. This is on vanilla Kubernetes, by the way.

You can run Kubernetes & Trident on arm64 and connect to SolidFire Demo VM 12.3 running on your VMware 6 or 7.0 or Virtualbox (including your Windows or Linux laptop with VirtualBox 6.1 and 24 GB RAM or better). SolidFire Demo VM itself needs 16 GB RAM to run.
