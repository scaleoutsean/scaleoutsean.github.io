# Limit CSI provisioner's blast radius for ONTAP storage

Limit blast radius of Trident CSI with ONTAP storage systems

- [Problem](#problem)
- [Solutions](#solutions)
- [Demo](#demo)

## Problem

"We'd like to automate, but we don't expose storage management interface to workload nodes".

## Solutions

There are several.

For the maximum security in management, don't use CSI. Provision manually. Problem solved! There's no dynamic storage provisioning, that's true, but you *could* automate out-of-band with Ansible and use static or host-path provisioning.

Another way is to use Storage Virtual Machine(s) or SVMs, which are conceptually similar to hypervisor VMs:

- virtual data network
- virtual management network
- virtual management account
- virtual storage (RAID group)

An ONTAP Storage VM (SVM) doesn't always have to have all these, but it can. To keep the post shorter, let's say we configure all four. What are the benefits of SVMs for [Trident CSI](https://netapp-trident.readthedocs.io/en/latest/search.html?q=svm+vsadmin&check_keywords=no&area=default#) users?

- Each container cluster (Kubernetes or other) can use its own SVM(s)
  - Container (worker) nodes use virtual data network(s) to access an SVM's storage resources (NFS, iSCSI)
  - Because the SVM data network is exposed only to selected orchestrator (Kubernetes cluster), worker from other clusters cannot access this SVM's data interfaces
  - Because the SVM "owns" only designated RAID group(s), it cannot access other "cluster level" (I don't mean KVM/vSphere, but ONTAP Cluster) storage resources
- Each container cluster has its own Trident CSI instance (which, being one of the containers running on its worker nodes, can access designated SVM's Management IP)
  - Trident can use its own account (with minimal privileges) or an SVM admin (Vsadmin) account (highest SVM privileges) - it's up to you
  - Because the worker nodes can access the SVM Management IP, we can set up two SVM management accounts for more flexibility: one for Trident CSI (HTTPS + API; minimum privileges) and one for the SVM admin (SSH, or HTTPS, or SSH and HTTPS; maximum SVM-scoped privileges) and use the SVM admin account for non-CSI purposes such as Ansible automation
- ONTAP Cluster
  - Retains its cluster management interfaces which are exposed to a completely different network (highly secure "corporate management LAN")
  - Has its own cluster management account
  - Haa one or more SVMs
  - Has one or more RAID groups, each of which can be placed under an SVM's control

In an environment with one ONTAP cluster, multiple container clusters could each have their own SVM Service Network, SVM Data Network, and SVM Management VLAN(s). An example of one container cluster with one SVM on one ONTAP cluster:

| Who?          |  Corp Mgmt LAN |Service VLAN |SVM Data VLAN| SVM Mgmt VLAN| Backup VLAN |
| :---          |  :---:         |        :---:|:---:        | :---:        | :---: |
| K8s Masters   |                |         Y   |             |  Optional*   |   Y   |
| K8s Workers   |                |         Y   |   Y         |     Y        |   Y   |
| K8s Infra-N** |                |         Y   |   Optional* |     Y        |   Y   |
| ONTAP SVM     |                |             |   Y         |     Y        |   Y   |
| ONTAP Cluster |   Y            |             |             |              |   -   |

\* We can have the Masters connected to SVM Mgmt VLAN for Ansible or other purposes, but one can also run Ansible from a user shell account on Worker nodes
\** K8s Infra-N is an option recommended for [Red Hat OpenShift](https://netapp-trident.readthedocs.io/en/stable-v21.01/dag/kubernetes/deploying_trident.html#deploy-trident-to-infrastructure-nodes-openshift-3-11) if you have "infrastructure" nodes (two or more) for infrastructure workloads and want to avoid Trident on `node-role.kubernetes.io/compute=true`.

In my demo (link at the bottom) I cheated in the sense that ONTAP Cluster was in fact connected to External/Service VLAN, but from the demo it is clear that SVM Data and Management LANs are the only way Trident and Workers could use to reach SVM interfaces.

![K8s, and SVM-based Trident CSI provisioning with ONTAP Select](/assets/images/k8s-ots-network.png)

With this setup (multiple and independent) container cluster administrators can automate their storage without being able to impact anyone else.

They can't get 100% of ONTAP API functionality this way - because some actions require ONTAP Cluster admin account and access to ONTAP Cluster admin IP - but that's what security is about.

As I hinted earlier, a container cluster can be configured to simultaneously connect to several Trident back-ends, so we can fine tune and intermix various approaches even within one container cluster.

For example, we configure Trident CSI to use an SVM admin-level account for one SVM (a Trident CSI back-end for which we want more convenience and less security), add a more limited dedicated SVM account for iSCSI on another SVM where we won't more security and less flexibility, and add yet another SVM which isn't dynamically provisioned at all.

There are other settings not directly related to ONTAP, such as orchestrator-level RBAC and Storage Class settings, which can help us limit access or set resource consumption limits to achieve an even finer balance between security and convenience.

## Demo

Find it [here](https://youtu.be/UCNziUG19bg) (1m51s).
