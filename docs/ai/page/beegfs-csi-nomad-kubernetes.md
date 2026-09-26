# Speed of volume creation with BeeGFS CSI

Fast creation and deletion of CSI volumes

While reading the excellent article [Why We Migrated from Kubernetes to Nomad](https://thenewstack.io/conductor-why-we-migrated-from-kubernetes-to-nomad) (2021) it occurred to me I spotted some of the same advantages while working on Nomad [posts](/2022/04/24/nomad-batch-job-scale-out-parallel-filesystem-beegfs-e-netapp-series.html) for this blog.

I then thought to do a simple experiment to quantify one of the things I noticed, which is faster volume creation with Nomad CSI compared to Kubernetes.

| Test  | Nomad 1.3.0 | Kubernetes v1.23.5 |
|  :--- |  ---:       | ---:|
| Create 100 PVCs|  8s| 22s |
| Delete 100 PVCs| 19s| 11s |

In both cases commands were executed on a singleton Server/Worker cluster, respectively, and to observe a similar effect you'd need a fast CSI driver.

If you're not familiar with BeeGFS, which is the underlying parallel filesystem used here, these "volumes" are just directories on the filesystem.

Nomad creates PVCs a lot faster. But is this apples to apples?

It's not:

- Both are running out of small VMs with slightly different specs, but not low on RAM
- There's one Nomad Server
- There's one Kubernetes Master

My Nomad cluster consists of a single server (b5) and single client (b6) node:

```sh
$ nomad operator raft list-peers
Node       ID                                    Address             State   Voter  RaftProtocol
b5.global  90abf6de-ca2e-edb5-c8cc-ae401b41f172  192.168.1.195:4647  leader  true   3

$ nomad agent-info
client
  heartbeat_ttl = 17.085690119s
  known_servers = 192.168.1.195:4647
  last_heartbeat = 14.301982699s
  node_id = 67b64e4d-9d6f-3122-808c-50aaa85460fc
  num_allocations = 3
nomad
  bootstrap = true
  known_regions = 1
  leader = true
  leader_addr = 192.168.1.195:4647
  server = true

$ nomad node status
ID        DC   Name  Class   Drain  Eligibility  Status
70d83013  dc1  b6    <none>  false  eligible     ready
67b64e4d  dc1  b5    <none>  false  eligible     ready
```

BeeGFS cluster: both Nomad Server and Client are BeeGFS clients:

```sh
$ sudo beegfs-check-servers 
Management
==========
b1 [ID: 1]: reachable at 192.168.1.191:8008 (protocol: TCP)

Metadata
==========
b2 [ID: 1]: reachable at 192.168.1.192:8005 (protocol: TCP)

Storage
==========
b3-8003 [ID: 1]: reachable at 192.168.103.193:8003 (protocol: TCP)
```

Kubernetes has also one master, but two workers:

```sh
$ kubectl get nodes
NAME      STATUS   ROLES                  AGE    VERSION
k8s-m-1   Ready    control-plane,master   171d   v1.23.5
k8s-n-1   Ready    <none>                 171d   v1.23.5
k8s-n-2   Ready    <none>                 171d   v1.23.5
```

Kubernetes is probably worse-off in terms of BeeGFS configuration - Kubernetes Master is both Management and Metadata node for BeeGFS, while it's first Worker is BeeGFS Storage node.

```sh
$ beegfs-check-servers 
Management
==========
k8s-m-1 [ID: 1]: reachable at 192.168.105.11:8008 (protocol: TCP)

Metadata
==========
k8s-m-1 [ID: 2]: reachable at 192.168.105.11:8005 (protocol: TCP)

Storage
==========
k8s-n-1 [ID: 1]: reachable at 192.168.105.12:8003 (protocol: TCP)
k8s-n-2 [ID: 2]: reachable at 192.168.105.13:8003 (protocol: TCP)
```

While it's clear the two clusters aren't very similar, I am not going to reconfigure everything to make it apples-to-apples - instead I'll just decide that Nomad is faster in what matters when running short-lived jobs, which is PVC creation. As mentioned in that blog post, seconds saved are dollars saved.

I know that's not scientific at all, but the difference is significant. And although Kubernetes "completes" `create pvc` commands, PVs aren't actually ready immediately after that.

Instead they be "pending" for a minute or so. Here we see volume 71 was just bound, and volume 74 is in getting bound.

![Pending create PVC command](/assets/images/beegfs-csi-nomad-kubernetes-volume-creation-01.png)

It takes around 60-70 seconds for all 100 volumes to become "bound".

Compared to Nomad where there's very little server activity during CSI volume creation, Kubernetes API server is relatively busy (considering there's no other activity).

![Kube API seems slow](/assets/images/beegfs-csi-nomad-kubernetes-volume-creation-02.png)

This binding happens after volume creation, so to keep things fair, I did not include this time in Kubernetes' volume creation time.

For comparison, after a Nomad volume has been created it simply becomes "schedulable". "Allocs", or allocations, happen only after work that requires these volumes is dispatched to Nomad clients.

![Nomad volumes aren't bound by default](/assets/images/beegfs-csi-nomad-kubernetes-volume-creation-03.png)

I could have measured and compared long it takes to start 100 containers attached to those PVs, but I did not. Why?

- My hardware resources are already constrained and the slowness would likely impact outcomes
- Should we measure the average delay from volume create until a pod is up, time until pod 100 is up and running, or something else? We can't tell without knowing the workload. Some workloads may need all pods to start before they can work, some won't.
- If we wanted to analyze these details we should use a like-for-like configuration which would mean I'd have to setup a new cluster or two new clusters and the blog post at the top already did a great real-life comparison for us
- My objective was to check one step in a workflow that I can measure reasonably well without a lot of resources, which is the speed of CSI API response

Considering that Kubernetes volumes are bound automatically after creation, maybe 100 pods would start faster on Kubernetes. But unlike on Nomad, we'd have to wait until a PV has been bound before we could start a pod that uses it. As the API server is already busy during parallel volume creation, throwing more requests to check PVC status could also extend the time required to bind all PVs, etc.

This 15s animated GIF shows an instance of a PVC create test running on each cluster. Nomad in the tab before the last, Kubernetes in the last tab. Nomad test completes in <9 seconds and Kubernetes doesn't within 15 seconds. The animation loops so don't watch it twice!

![Nomad CSI vs Kubernetes CSI](/assets/images/beegfs-csi-nomad-kubernetes-volume-creation-03.gif)

While this isn't a scientific comparison of like-for-like clusters, it measures one specific step that may be important for users who run tens or hundreds of thousands of batch jobs that use PVs.

It doesn't surprise me that Nomad was faster - the moment you install and start using it, it doesn't take long to realize 90% of the Kubernetes bloat is gone.
