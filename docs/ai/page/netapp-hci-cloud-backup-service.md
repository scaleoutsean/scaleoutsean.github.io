# NetApp HCI with Cloud Backup Service

How to make use of Cloud Backup Service from NetApp HCI

[NetApp Cloud Backup Service](https://cloud.netapp.com/cloud-backup) backs up your ONTAP data to your Object Storage bucket located in the cloud (Amazon, Azure, Google Cloud).

Can NetApp HCI use that service? Indirectly, it can. It is possible to use it directly, too, by leveraging the included ONTAP Select, but as we shall see at the very end, the indirect approach has its advantages.

- [Backup](#backup)
- [Recovery in different situations](#recovery-in-different-situations)
  - [Fast VM recovery from VMware VM snapshots](#fast-vm-recovery-from-vmware-vm-snapshots)
  - [Datastore and VM recovery from NetApp HCI Snapshots](#datastore-and-vm-recovery-from-netapp-hci-snapshots)
  - [SnapMirror restore to NetApp HCI](#snapmirror-restore-to-netapp-hci)
  - [Site Recovery](#site-recovery)
- [Direct use of Cloud Backup Service from ONTAP Select on NetApp HCI](#direct-use-of-cloud-backup-service-from-ontap-select-on-netapp-hci)
- [NetApp HCI storage is iSCSI - what about "2 on-prem copies" for NFS and SMB data](#netapp-hci-storage-is-iscsi---what-about-2-on-prem-copies-for-nfs-and-smb-data)
- [Should I use EF (all-flash E-Series) or E-Series (Hybrid or HDD) for this](#should-i-use-ef-all-flash-e-series-or-e-series-hybrid-or-hdd-for-this)

## Backup

NetApp HCI - or more precisely, its SolidFire storage component - implements a subset of SnapMirror API. That means we can protect native NetApp HCI data by replicating it to an ONTAP system. Many customers already do that, but what we commonly see is replication to FAS 2000 or other HDD-based ONTAP appliance.

But this can work just as well with ONTAP Select ("OTS") VMs running on NetApp HCI.

![OTS on NetApp HCI](/assets/images/netapp-hci-cbs-01.png)

Now, that doesn't mean OTS should use NetApp HCI storage. On the contrary, it should use external storage such as E-Series. When OTS running on NetApp HCI consumes external storage it needs a license for the capacity it "sees" on that storage (in this case, an E-Series array).

![OTS on NetApp HCI using E-Series storage](/assets/images/netapp-hci-cbs-02.png)

Assuming your effective storage (total size of Datastores) capacity on NetApp HCI is 20TB, you could have an after-RAID (or post-DDP) capacity on E-2824 (2U, 24 slots) of 25-30 TB. That post-RAID (or "usable" to VMware) capacity would be the license requirement for ONTAP Select. OTS would stripe data over VMDKs in a [RAID 0 fashion](https://docs.netapp.com/us-en/ontap-select/concept_stor_hwraid_local.html#virtual-disk-provisioning), so create a RAID 6 group(s) or DDP pool on E-Series for ONTAP Select data.

Remember - or read the 2-3 NetApp TRs related to this stuff for gotchas - VVols [cannot be protected](https://www.netapp.com/media/10647-TR-4651-0918-SnapMirror-Element-software-Architecture-Configuration_.pdf) with the NetApp HCI SnapMirror implementation.

Once you configure a SnapMirror relationship and pair the volumes you want to protect, snapshots of SolidFire volumes hosting VMware datastores are periodically synchronized from NetApp HCI to OTS. Now you can deploy Cloud Backup Service in this environment and have ONTAP Select backup data to a public Object Store of your choosing (visit the Cloud Backup Service [home page](https://cloud.netapp.com/cloud-backup) for illustrations that don't suck).

![OTS on NetApp HCI using E-Series storage](/assets/images/netapp-hci-cbs-03.png)

## Recovery in different situations

### Fast VM recovery from VMware VM snapshots

I'd say this makes most sense for short-lived VM snapshots. For example you take a snapshot before doing a vCenter upgrade, and delete it after you're done. You don't want to retain these snapshots longer or have a ton of them, because they slow down the (VMFS) filesystem.

### Datastore and VM recovery from NetApp HCI Snapshots

Say you want to restore some vmx file or individual VM from a scheduled storage snapshot from 5 days ago. NetApp HCI (SolidFire) snapshots need to be cloned to become accessible. As these are space-efficient, the cloning takes seconds or minutes.

If you want to restore the entire snapshot, you don't need to clone it - that takes several seconds but (as usual with iSCSI datastores) you'd have to shutdown any VMs running on the datastore before you restore its snapshot.

Tip: use SolidFire PowerShell plugin or Ansible for ElementSW to create 1-2 snapshot schedules and then just add volume IDs to those schedules. Don't max-out the maximum (32) because you need at least 1 for SnapMirror. And your backup s/w (if you have any additional backup software) may need to take 1-2. I recommend to [create a snapshot schedule](https://www.youtube.com/watch?v=sD4Mb7jVw6w) that consume no more than 20 or so snapshots per volume in order to have 12 left for Snapmirror and any other on-demand requirements. You can use the Web UI for that as well.

### SnapMirror restore to NetApp HCI

A VMware datastore or NetApp HCI volume may become corrupt or you may realize you have no snapshot from which you can recover restore some vmx file or individual VM, you can stop current SnapMirror, break the relationship with ONTAP side of the mirror, change the direction to become ONTAP to NetApp HCI, and sync back.

The second approach is to use ONTAP to create a clone from its copy of data, and mount it via iSCSI from vSphere. You could use Ansible to automate this and have a clone of a recent snapshot always available to be used by vSphere. Because you should have at least several SolidFire snapshots stored locally, this probably wouldn't be that useful for unplanned restores, but could be useful for other things such as weekly testing of backups, Dev/Test and such.

What if you lose the datastore that hosts ONTAP Select VM, as well as some VMs you need to restore? That's a possibility. You can do one of these things:
a) Deploy OTS VM onto its own datastore, or
b) Deploy OTS VM on E-Series datastore

### Site Recovery

In the case the entire setup goes down, you could recover data from cloud backup:

- Cloud-based: stand up a temporary Cloud Volumes ONTAP (which is a cloud-based ONTAP Select on steroids). That takes less than 30 minutes. Then use Cloud Backup Service to restore data onto that system. If this Cloud Volumes ONTAP happens to be on GCP, you could even present replicated NetApp HCI volumes to [Google Cloud VMware Engine](https://google.com/vmware-engine) via Cloud Volumes ONTAP iSCSI
- On-premises: deploy ONTAP Select on another VMware cluster (NetApp HCI or other) location, register it with Cloud Manager (Connector) and recover cloud backup data to it

## Direct use of Cloud Backup Service from ONTAP Select on NetApp HCI

You may be wondering why not simply use ONTAP Select on NetApp HCI and put critical data on ONTAP Select NFS datastores.

That is certainly possible. Advantages of this approach:

- No need to have another storage array (such as the E-2824 mentioned above)
- No need to have extra ONTAP Select licenses (for the E-Series capacity), because ONTAP Select is included with NetApp HCI and includes a license for the entire capacity of NetApp HCI
- One less step in data protection process

A major disadvantage is that should the entire VMware environment go down, you'd first have to recover your vSphere cluster, to be able to redeploy OTS, and finally restore data from object storage using Cloud Backup Service. It could take many hours to resume service.

The earlier approach with E-Series is more robust. Here's a comparison of NetApp HCI with CBS with and without an additional E-Series array:

| 3-2-1 Rule  | HCI + OTS + E-Series with CBS  | HCI + OTS with CBS  |
|  ---        |  ---  |  ---  |
| 3 copies    | Yes (HCI, E-Series, Cloud)   |  No (HCI/OTS and Cloud only)  |
| 2 on-prem   | Yes (HCI, E-Series) |  No (HCI/OTS only)      |
| 1 in the cloud     | Yes   |  Yes |

## NetApp HCI storage is iSCSI - what about "2 on-prem copies" for NFS and SMB data

If we used OTS for NFS/SMB how could we have two copies of our data located on-premises?

As explained above, OTS on NetApp HCI does not need a license for capacity consumed on NetApp HCI storage, and because of native SnapMirror support in OTS, you could set up replication from your "File Serving" OTS instance to the instance that consumes E-Series storage (rather than replicate the underlying NetApp HCI volumes).

That would still give you two copies and instant access to a replica, without restoring data from the cloud.

What if your NFS or SMB data cannot fit on NetApp HCI? Well, your data wouldn't be there to begin with. But let's say you serve this data with the ONTAP instance connected to E-Series. GCP-centric customers with VMware workloads could use SnapMirror to replicate those NFS/SMB shares to Cloud Volumes ONTAP (CVO) on GCP, and enable Cloud Backup Service on that cloud-based CVO. This could be done only for one or two specific workloads, while the rest could be done differently - you don't have to make an either-or choice.

## Should I use EF (all-flash E-Series) or E-Series (Hybrid or HDD) for this

I recommend E-Series. Main reason is we don't need a lot of performance to restore data from a SnapMirror replica, and most restores would be sequential reads, or partial reads.

If you wanted to be able to failover HCI compute workload to OTS with E-Series for production use (in the case NetApp HCI storage cluster failed), you could add few SSDs to that E-Series array, but again - if that's what you'd buy SSDs for, keep these on a separate RAID 5 (3D-1P-1HS, 5 SSDs) or RAID 10 (4 SSDs) group separate from HDDs used for SnapMirror destination volumes:

- One small E-Series SSD volume for ONTAP VM datastore
- One or more E-Series SSD volume(s) for high priority workloads in the case HCI storage is not accessible

In a recent [post](/2020/12/30/netapp-hci-ef280-diskspd-for-backup) on the topic of backup I recommended EF-Series for the use with 3rd party backup software. The reason is you need a fast backup pool to run more complex workloads involved in modern backup applications (see the various performance tests at the bottom of that post).
