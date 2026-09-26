# Trident CSI REST API

Some details on the Trident CSI API

- [Why access Trident API](#why-access-trident-api)
- [Controller routes](#controller-routes)
- [Trident resources](#trident-resources)
- [Expose the Trident REST API](#expose-the-trident-rest-api)
- [Examples](#examples)
- [What about it](#what-about-it)
- [Appendix: List of Trident Resources](#appendix-list-of-trident-resources)

## Why access Trident API

Why would one want to access the Trident API? Maybe there's a bug in the CLI, maybe something's not readily available through the CLI, maybe [using the CLI increases your workload](https://github.com/NetApp/trident/issues/670), etc.

The official documentation is [still very basic](https://docs.netapp.com/us-en/trident/trident-reference/rest-api.html) and I've been sitting on a bunch of my disorganized Trident API-related notes for over a year so I thought to put together a page with some extra information for amateurs such as myself.

I may update this post later on if I make noteworthy discoveries in while using the API.

## Controller routes

First, where do we get a list of controller routes? [Here](https://github.com/NetApp/trident/blob/966349f49f6913e063d2e5bfd85dcb5f94ef38dd/frontend/rest/controller_routes.go):

- AddBackend
- AddOrUpdateNode
- AddSnapshot
- AddStorageClass
- AddVolume
- DeleteBackend
- DeleteNode
- DeleteSnapshot
- DeleteStorageClass
- DeleteVolume
- GetBackend
- GetCHAP
- GetNode
- GetSnapshot
- GetStorageClass
- GetVersion
- GetVersion
- GetVolume
- ImportVolume
- ListBackends
- ListNodes
- ListSnapshots
- ListSnapshotsForVolume
- ListStorageClasses
- ListVolumes
- UpdateBackend
- UpdateBackendState
- UpgradeVolume

That's fine, but how to use it?

## Trident resources

We can use Kubernetes proxy or other method to access the Kubernetes API and with it the Trident API endpoint at http(s)://IP:PORT/apis/trident.netapp.io/v1/. If you access it directly, go to IP:PORT of the Trident controller pod.

Here's what we see for a recent version (v22.01). The full list with all API details for this version is in Appendix.

- tridentbackendconfigs
- tridentbackendconfigs/status
- tridentbackends
- tridentmirrorrelationships
- tridentmirrorrelationships/status
- tridentnodes
- tridentsnapshotinfos
- tridentsnapshotinfos/status
- tridentsnapshots
- tridentstorageclasses
- tridenttransactions
- tridentversions
- tridentvolumepublications
- tridentvolumes

## Expose the Trident REST API

As of v24.06 [here](https://docs.netapp.com/us-en/trident/trident-reference/rest-api.html) it says:

> For better security, the Astra Trident REST API is restricted to localhost by default when running inside a pod. To change this behavior, you need to set Astra Trident's -address argument in its pod configuration.

Aside from the mistyped configuration argument (`--address`, not `-address`) there's a conflicting information [on the linked page](https://docs.netapp.com/us-en/trident/trident-managing-k8s/tridentctl.html) which is supposed to contain helpful details:

> Trident REST interface can be configured to listen and serve at 127.0.0.1 (for IPv4) or [::1] (for IPv6) only. 

Go figure...

Looking for `--address`, that can be changed by modifying `trident-deployment.yaml`.

By default, your Trident CSI namespace services may look like this.

```sh
$ kubectl get services -n trident
NAME          TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)              AGE
trident-csi   ClusterIP   10.43.58.152   <none>        34571/TCP,9220/TCP   5d14h
```

However, what we're interested in is trident-controller and 10.42.0.7:

```sh
[sean@s194 setup]$ kubectl describe pod trident-controller-98ffcbc55-92kcr -n trident
Name:             trident-controller-98ffcbc55-92kcr
Namespace:        trident
Priority:         0
Service Account:  trident-controller
Node:             s194/192.168.1.194
Start Time:       Tue, 02 Jul 2024 19:30:35 +0100
Labels:           app=controller.csi.trident.netapp.io
                  pod-template-hash=98ffcbc55
Annotations:      openshift.io/required-scc: trident-controller
Status:           Running
IP:               10.42.0.7
IPs:
  IP:           10.42.0.7
Controlled By:  ReplicaSet/trident-controller-98ffcbc55
Containers:
  trident-main:
    Container ID:  containerd://f571965ecfd4c5194ffe2afa65d0f905abd2975b184801636164da615e1f981f
    Image:         netapp/trident:24.06.0
    Image ID:      docker.io/netapp/trident@sha256:cdb0f68a639eccea30aa66accfe9ed205a0fab97b1ae58b8096dff02bf18574a
    Ports:         8443/TCP, 8001/TCP
    Host Ports:    0/TCP, 0/TCP
    Command:
      /trident_orchestrator
    Args:
      --crd_persistence
      --k8s_pod
      --https_rest
      --https_port=8443
      --csi_node_name=$(KUBE_NODE_NAME)
      --csi_endpoint=$(CSI_ENDPOINT)
      --csi_role=controller
      --log_format=text
      --log_level=info
      --log_workflows=
      --log_layers=
      --disable_audit_log=true
      --address=127.0.0.1
      --http_request_timeout=1m30s
      --enable_force_detach=false
      --metrics
    State:          Running
    ...
```

Funny thing is: accessing this IP at port 8001 gives me Prometheus metrics. Wait, wut?

```sh
$ curl -s http://10.42.0.7:8001/apis/trident.netapp.io/v1/tridentstorageclasses

# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 4.391e-05
go_gc_duration_seconds{quantile="0.25"} 7.5119e-05
...
# TYPE trident_operation_duration_milliseconds summary
trident_operation_duration_milliseconds{operation="backend_add",success="true",quantile="0.5"} NaN
trident_operation_duration_milliseconds{operation="backend_add",success="true",quantile="0.9"} NaN
trident_operation_duration_milliseconds{operation="backend_add",success="true",quantile="0.99"} NaN
...
```

Okay, then, we can get Trident CSI Prometheus metrics with `curl -s http://10.42.0.7:8001/`. The correct URL is `http://10.42.0.7:8001/metrics`, but it appears there's a universal redirect in place.

To get to the rest, we need to change `--address` or use Kube proxy (`kubectl proxy`) and work through that proxy IP:PORT.

```sh
# curl http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentsnapshots
{
  "apiVersion": "trident.netapp.io/v1",
  "items": [],
  "kind": "TridentSnapshotList",
  "metadata": {
    "continue": "",
    "resourceVersion": "156946"
  }
}
```

## Examples

I reckon performing actions like Create and Patch may not help you get NetApp Support when you break something, but if you wanted to use actions other than Get and List, you could.

But getting the info out can't harm you as long as you take precautions such as not posting the output from your mission critical cluster to Github Gist, so I'll post examples of that.

Where is it installed and what version?

```sh
$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentversions | jq .items[0].metadata.namespace
"trident"

$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentversions | jq .items[0].trident_version
"22.01.1"
```

Where does Trident controller run? There's a bunch of IPs, but if we look closer, it's just three nodes.

```sh
$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentnodes | jq .items[].ips
[
  "192.168.1.156",
  "192.168.103.11",
  "192.168.105.11"
]
[
  "192.168.1.158",
  "192.168.103.12",
  "192.168.105.12"
]
[
  "192.168.1.161",
  "192.168.103.13",
  "192.168.105.13",
  "192.168.122.128"
]

$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentnodes | jq .items[].metadata.name
"k8s-m-1"
"k8s-n-1"
"k8s-n-2"
```

Names of Trident PVCs:

```sh
$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentvolumes | jq .items[].metadata.name
"pvc-6afc6c07-aad3-4513-ab68-51577092621c"
"pvc-7f41ab55-b99b-4c03-878c-62dfb7c138c7"
"pvc-ced42f23-e95e-48ca-9017-1c7b27cd3f35"
```

The other other name (they happen to be the same but that's not always the case - see the linked articles below for a deep dive):

```sh
$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentvolumes | jq .items[].config.internalName
"pvc-6afc6c07-aad3-4513-ab68-51577092621c"
"pvc-7f41ab55-b99b-4c03-878c-62dfb7c138c7"
"pvc-ced42f23-e95e-48ca-9017-1c7b27cd3f35"
```

I have one Trident storage class. All my SolidFire volumes are therefore using the same storage class:

```sh
$ curl -s http://127.0.0.1:8001/apis/trident.netapp.io/v1/tridentstorageclasses | jq .items[].spec
{
  "attributes": {
    "IOPS": "300",
    "backendType": "solidfire-san"
  },
  "name": "csi-trident-bronze",
  "version": "1"
}
```

Regarding the last example, I do have multiple storage classes, but Trident has only one.

This cluster happens to have [BeeGFS CSI](/2022/04/09/beegfs-csi-introduction.html) as well, which is where the other SC is coming from.

```sh
$ kubectl get pvc -n sfc
NAME                       STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS         AGE
grafana-pvc                Bound    pvc-e703c3de                               1Gi        RWO            csi-beegfs-dyn-sc    45h
pvc-volume-in-another-ns   Bound    pvc-ced42f23-e95e-48ca-9017-1c7b27cd3f35   1Gi        RWO            csi-trident-bronze   76m
```

This means we'd have to filter this CLI output by STORAGECLASS(es) or PVC name patterns to get only the Trident CSI volumes, then inspect them and finally use the Trident CLI to find out more about them. Or we can access the Kubernetes and Trident APIs and get all the volume details we need.

This post doesn't have anything about gathering Trident performance metrics via the Trident API, but I [wrote about that before](/2021/05/25/external-access-to-netapp-trident-solidfire-metrics.html).

## What about it

What can we do with this, if GET is the only thing we do?

Like I said earlier, this information can help us better do things such as configuring a replica SolidFire cluster, or setting up a backup back-end (just look at the trouble I went through to come up with [something that sort-of works for SolidFire cluster failover and Trident CSI](/2021/03/20/kubernetes-solidfire-failover-failback.html) in a scenario with a single (stretched or not stretched) Kubernetes cluster is connected to two SolidFire clusters. 

Secondly, we can automate better if we don't always have to use the Trident CLI. For example, last year I wrote [PowerShell scripts for back-end failover](/2021/03/28/manage-netapp-trident-with-powershell.html) that worked really well, but I didn't like that they completely relied on the Trident CLI because (see the other linked post) the CLI still doesn't seem able to [remove a failed Trident CSI back-end](https://github.com/NetApp/trident/issues/718#issuecomment-1106779833) which makes it (as of now) impossible to nicely fail-back because the old Primary Trident back-end remains stuck even if the back-end recovers. For this we could Trident resources and on fail-back patch and possibly redirect Trident to a secondary SolidFire cluster with completely identical configuration; while that isn't officially supported,at least we could avoid some known downsides making it a matter of trade-offs. If we don't mind to reinstall Trident on fail-back we already have a "supported" solution that "works" (i.e. reinstall Trident pointing to the primary SolidFire cluster; see the two links in this paragraph for more).

The third use case is backup and restore of storage-related configuration. If you use a commercial solution (such as Astra Control) or maybe even some freeware (such as Velero) you will probably focus on protecting higher level logical Kubernetes constructs (deployments, replica sets, etc.), but having a detailed picture of everything in a handful of JSON files isn't too bad to have. And we don't have to use that to restore anything - we can use it to create an almost identical replica of the production environment with three VMs and one SolidFire Demo VM.

My fourth use case is if I really want to all the way and bypass the CLI for certain actions, objects or properties that aren't *directly* exposed via the CLI, I can. Again, this is a recipe to break Trident and not get Support for it, but if I'm testing or experimenting in a VM environment using SolidFire Demo VM, I can't get support for it in any case. And it's easier to access these API resources than do CLI wrapping for multiple commands.

Another case is to list or watch for Trident snapshots (snapshots can be taken directly with the Trident CLI or API, but also from Astra Control, Kasten K10, Commvault, Velero with CSI plugin, etc.) and perform direct Backup to S3 from that SolidFire volume snapshot. The advantage is if any of those data protecton applications takes application consistent snapshots that's better than using backup-to-S3 from on-demand crash consistent snapshot taken from Trident or directly via the SolidFire API. If you're not familiar with SolidFire's Backup to S3 feature, it takes an ad-hoc snapshot and performs backup from that snapshot if no snapshot ID is specified, but if it is specified then it will backup that snapshot to S3. Why use Backup to S3 when we already have Astra Control or Kasten? I don't know, maybe there are people who like to have a another copy of their data on premises (which may be desired if your backup software sends backups to S3 in the public cloud and when pulling 10TB of data from the cloud takes many hours?).

There's probably more, but this should be enough to realize that almost everyone should be using the Trident API - at least with GET requests. 

I'll explore other "verbs" (delete, patch, update) in a future post.

## Appendix: List of Trident Resources

List of resources and actions that can be performed:

```json
{
  "kind": "APIResourceList",
  "apiVersion": "v1",
  "groupVersion": "trident.netapp.io/v1",
  "resources": [
    {
      "name": "tridentstorageclasses",
      "singularName": "tridentstorageclass",
      "namespaced": true,
      "kind": "TridentStorageClass",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tsc",
        "tstorageclass"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "FaJ433K+bxo="
    },
    {
      "name": "tridenttransactions",
      "singularName": "tridenttransaction",
      "namespaced": true,
      "kind": "TridentTransaction",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "ttx",
        "ttransaction"
      ],
      "categories": [
        "trident-internal"
      ],
      "storageVersionHash": "+4b6wV9cg3o="
    },
    {
      "name": "tridentsnapshots",
      "singularName": "tridentsnapshot",
      "namespaced": true,
      "kind": "TridentSnapshot",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tss",
        "tsnap",
        "tsnapshot"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "68xIlPlOUXg="
    },
    {
      "name": "tridentnodes",
      "singularName": "tridentnode",
      "namespaced": true,
      "kind": "TridentNode",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tnode"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "8NM7T7fZIwE="
    },
    {
      "name": "tridentversions",
      "singularName": "tridentversion",
      "namespaced": true,
      "kind": "TridentVersion",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tver",
        "tversion"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "Nfqf4lZopAg="
    },
    {
      "name": "tridentsnapshotinfos",
      "singularName": "tridentsnapshotinfo",
      "namespaced": true,
      "kind": "TridentSnapshotInfo",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tsi",
        "tsinfo",
        "tsnapshotinfo"
      ],
      "categories": [
        "trident",
        "trident-internal",
        "trident-external"
      ],
      "storageVersionHash": "2sdQM7KXTJs="
    },
    {
      "name": "tridentsnapshotinfos/status",
      "singularName": "",
      "namespaced": true,
      "kind": "TridentSnapshotInfo",
      "verbs": [
        "get",
        "patch",
        "update"
      ]
    },
    {
      "name": "tridentmirrorrelationships",
      "singularName": "tridentmirrorrelationship",
      "namespaced": true,
      "kind": "TridentMirrorRelationship",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tmr",
        "tmrelationship",
        "tmirrorrelationship"
      ],
      "categories": [
        "trident",
        "trident-internal",
        "trident-external"
      ],
      "storageVersionHash": "uojB8oKV20w="
    },
    {
      "name": "tridentmirrorrelationships/status",
      "singularName": "",
      "namespaced": true,
      "kind": "TridentMirrorRelationship",
      "verbs": [
        "get",
        "patch",
        "update"
      ]
    },
    {
      "name": "tridentvolumepublications",
      "singularName": "tridentvolumepublication",
      "namespaced": true,
      "kind": "TridentVolumePublication",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tvp",
        "tvpub",
        "tvpublication",
        "tvolpub",
        "tvolumepub",
        "tvolpublication",
        "tvolumepublication"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "xyFV4ExF7Ko="
    },
    {
      "name": "tridentbackends",
      "singularName": "tridentbackend",
      "namespaced": true,
      "kind": "TridentBackend",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tbe",
        "tbackend"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "T1qel53qfPI="
    },
    {
      "name": "tridentvolumes",
      "singularName": "tridentvolume",
      "namespaced": true,
      "kind": "TridentVolume",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tvol",
        "tvolume"
      ],
      "categories": [
        "trident",
        "trident-internal"
      ],
      "storageVersionHash": "cskDTG4rEX8="
    },
    {
      "name": "tridentbackendconfigs",
      "singularName": "tridentbackendconfig",
      "namespaced": true,
      "kind": "TridentBackendConfig",
      "verbs": [
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "create",
        "update",
        "watch"
      ],
      "shortNames": [
        "tbc",
        "tbconfig",
        "tbackendconfig"
      ],
      "categories": [
        "trident",
        "trident-internal",
        "trident-external"
      ],
      "storageVersionHash": "gw6E6pH3Zpw="
    },
    {
      "name": "tridentbackendconfigs/status",
      "singularName": "",
      "namespaced": true,
      "kind": "TridentBackendConfig",
      "verbs": [
        "get",
        "patch",
        "update"
      ]
    }
  ]
```
