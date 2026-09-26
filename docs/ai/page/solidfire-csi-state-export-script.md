# State export script for SolidFire CSI and SolidFire

Overdue script for SolidFire CSI state export

[SolidFire CSI](https://github.com/scaleoutsean/solidfire-csi) v1 came out recently, so I'm slowly updating overdue recipes related to SolidFire in Kubernetes environments.

Today's updates:
- Add a script that dumps SolidFire CSI and SolidFire state into a JSON file. Find it [in the Kubefire repo](https://github.com/scaleoutsean/kubefire)
- Add a script that uses state file to create Kustomize overlay for DR site
- Remove Trident CSI content from the README

Here's a shortened example of the state export file. Top level keys contain SCs, NSs, PVCs, PVs.

```json
{
  "storage_classes": {
    "solidfire-bronze": {
      "name": "solidfire-bronze",
      "parameters": {
        "csi.storage.k8s.io/controller-expand-secret-name": "solidfire-secret",
        "csi.storage.k8s.io/controller-expand-secret-namespace": "solidfire-csi",
        "csi.storage.k8s.io/controller-publish-secret-name": "solidfire-secret",
        "csi.storage.k8s.io/controller-publish-secret-namespace": "solidfire-csi",
        "csi.storage.k8s.io/fstype": "ext4",
        "csi.storage.k8s.io/node-stage-secret-name": "solidfire-secret",
        "csi.storage.k8s.io/node-stage-secret-namespace": "solidfire-csi",
        "csi.storage.k8s.io/provisioner-secret-name": "solidfire-secret",
        "csi.storage.k8s.io/provisioner-secret-namespace": "solidfire-csi",
        "quota_max_total_capacity": "1099511627776",
        "quota_max_volume_count": "90",
        "storage_qos_policy_id": "56"
      },
      "reclaim_policy": "Delete",
      "volume_binding_mode": "Immediate"
    }
  },
  "namespaces": [
    "s3",
    "qdrant-multi"
  ],
  "persistent_volumes": {
    "pvc-1e4ffe49-44ab-4ea7-800b-9eed7e7d67a0": {
      "name": "pvc-1e4ffe49-44ab-4ea7-800b-9eed7e7d67a0",
      "volume_handle": "5960",
      "capacity": {
        "storage": "10Gi"
      },
      "access_modes": [
        "ReadWriteOnce"
      ],
      "storage_class": "solidfire-bronze",
      "claim_ref": {
        "name": "qdrant-logs-qdrant-multi-0",
        "namespace": "qdrant-multi"
      },
      "dr_replication": {
         "remote_volume_id": 649,
         "remote_volume_name": "s3-replica-vol"
      }
    },
    "pvc-fb2c46fb-159f-459e-8cfd-908671347a4b": {
      "name": "pvc-fb2c46fb-159f-459e-8cfd-908671347a4b",
      "volume_handle": "5968",
      "capacity": {
        "storage": "10Gi"
      },
      "access_modes": [
        "ReadWriteOnce"
      ],
      "storage_class": "solidfire-bronze",
      "claim_ref": {
        "name": "qdrant-logs-qdrant-multi-1",
        "namespace": "qdrant-multi"
      },
      "dr_replication": null
    }
  },
  "persistent_volume_claims": [
    {
      "name": "qdrant-audit-qdrant-multi-0",
      "namespace": "qdrant-multi",
      "storage_class": "solidfire-bronze",
      "volume_name": "pvc-95d56df2-a11c-45bb-9997-3eefe13c40dc",
      "requests": {
        "storage": "10Gi"
      }
    },
    {
      "name": "versitygw-data",
      "namespace": "s3",
      "storage_class": "solidfire-bronze",
      "volume_name": "pvc-81f5dab3-88ba-424a-99ef-bd12171de60d",
      "requests": {
        "storage": "10Gi"
      }
    }
  ]
}
```

It's a very simple script, but it doesn't need to be complex to get you started. 

I also have [Longhorny](https://github.com/scaleoutsean/longhorny) that has not only reporting features, but can also set up and tear down replication relationships, you can also use its code to set up replication. Notice that Longhorny may flip **all** replication relationships (not just for one particular tenant), which is **not** what you want if you're failing over individual Kubernetes clusters and want to leave other tenants active where they are. If you need per-tenant failover, you'd have to create an enhanced version of Longhorny to only work on volumes owned by specific Account IDs (SolidFire CSI tenants) which isn't hard, but I've never heard of anyone doing this so I haven't added that to Longhorny to unnecessarily complicate it.

Such volumes paired for replication will then have volume pairing information like in the example PV entry above:

```json
"dr_replication": {
  "remote_volume_id": 649,
  "remote_volume_name": "s3-replica-vol"
}
```

Once you have a pairing set up, you can create and use a VolumeSnapshotClass that enables replication on the snapshot (a SolidFire CSI feature), so any snapshot you take with that VolumeSnapshotClass will be replicated to DR site. In Asynchronous mode, volume data is replicated at all times, but snapshots can be replicated as well, in both Asynchronous and SnapshotsOnly mode - as long as you tag snapshots for replication. You may have snapshots (e.g. for Velero backup) that you want to keep "local", and others that you want to replicate.

SolidFire CSI does't require special handling or sophisticated scripts for failover. You simply promote replicated volumes to `readWrite` and - since you have Source-Target mapping information both in volume replication relationships or in the output of state export file, and create static PVC imports. Then you can start applications. 

The Kubefire repository has another script that takes that state information and produces a Kustomize overlay for PVCs that can be used to bring up the remote site using replica volumes, so you don't even need to edit YAML manifests from the primary site.

If you use the state file in own scripts, you need to decide how to map Storage Classes and Tenant IDs on the destination and create at least one of each on the target site and remember that secrets need to created as well. For example, if you have five tenants on one site, create five tenants on the remote site as well (rather than replicating volumes owned by five tenants to volumes owned by a single tenant on the remote site).

You also need to be careful with **volume reclaim policy** settings in Storage Classes (`Delete` can be dangerous, especially if volume auto-purge-on-delete is used), so try the entire process once or twice before you need it.

SolidFire CSI is stateless, so failback works exactly the same way as failover. 

I don't think more scripts or recipes are needed, but if anyone needs help - share your issue in the Kubefire repository.

In the past I [created](/2024/06/01/pvc-volume-relationships-in-solidfire-trident-part-1.html) tutorials and scripts for Trident CSI, but the CSI driver was the issue - failback was simply impossible to do right - so it was a waste of time. That problem was finally solved today, by removing Trident CSI failover/failback information from the Kubefire repository.

![Trident CSI - Afuera!](/assets/images/afuera.gif)
