# NetApp SolidFire with GenAI and inferencing workloads

Some ideas on how to make use of SolidFire in GenAI scenarios

- [Introduction](#introduction)
- [Inferencing with SolidFire](#inferencing-with-solidfire)
  - [Examples](#examples)
- [Making use of iSCSI](#making-use-of-iscsi)
  - [Share data with a parallel file system](#share-data-with-a-parallel-file-system)
  - [Share data without a parallel file system](#share-data-without-a-parallel-file-system)
  - [Use SolidFire from Jupyter](#use-solidfire-from-jupyter)
  - [Ready-to-clone PVs for tools, applications, models](#ready-to-clone-pvs-for-tools-applications-models)
- [Conclusion](#conclusion)
- [Appendix A - volume templates and fast clones](#appendix-a---volume-templates-and-fast-clones)

## Introduction

As I've mentioned several times, SolidFire isn't suitable for workloads with high disk performance requirements (meaning roughly 30K IOPS or 500 MB/s per volume).

You may be able to squeeze out more from a volume, and you can use various tricks like LVM to concatenate or stripe across multiple volumes, but I wouldn't recommend it.

What works well? Let's see...

## Inferencing with SolidFire

Normally you won't need huge performance for block devices running inferencing workloads.

Even for GenAI, unless you have a large amount of compute power. When I tried [H2O AI](/2023/08/04/h2o-storage-notes-h2ogpt.html) I maxed out my GPU and disk IO was negligible.

In most cases you need Docker and Kubernetes support, for which SolidFire uses NetApp Trident.

NetApp HCI (and SolidFire) had inferencing documented in [this solution](https://docs.netapp.com/us-en/hci-solutions/hciaiedge_use_cases.html). 

An example of NVIDIA Triton inference server deployment on Kubernetes is given [here](https://docs.netapp.com/us-en/hci-solutions/hciaiedge_deploy_nvidia_triton_inference_server_automated_deployment.html). 

The inferencing deployment example above uses a PVC on an NFS share served by ONTAP Select (a VM version of ONTAP that used to ship with NetApp HCI). 

Sure, that's one way to do it and it works great for ReadWriteMany i.e. many pods can access the same NFS share on ONTAP Select which, when deployed with multiple SolidFire volumes, can spray IO request across all of them and get around the performance limit of a single volume mentioned above. 

But not all SolidFire users have ONTAP, and not all use NFS.

Is there a role for iSCSI block devices provisioned directly by SolidFire?

### Examples

While doing unrelated research related to sizing for Deep Learning (not inferencing) I came across this example which illustrates how even Deep Learning on text data can be light on storage:

> In this sample, you will use Intel® Distribution of Modin* to ingest and process U.S. census data from 1970 to 2010 in order to build a ridge regression-based model to find the relation between education and total income earned in the US.
> Time to complete: 20 minutes

Source: [Intel](https://github.com/oneapi-src/oneAPI-samples/tree/master/AI-and-Analytics/End-to-end-Workloads/Census)

I tried running several inferencing programs and the heaviest IO happened during container startup when container is loaded and the model which may be few GB large needs to be read from disk. Since this model is usually part of read-only container image and stored on local disk, it has no impact on SolidFire workload. 

I also used [Helsinki-NLP](https://huggingface.co/Helsinki-NLP) to translate small text files. Each job used 45% of RTX 2K GPU and the additional disk IO was barely measurable.

Medium-large and large GenAI workloads [can](/2023/11/28/postgres-pgvector-instacluster-eseries.html) require a lot of IO, but one would need more than half a dozen big GPUs to get there.

## Making use of iSCSI

Let's see about some other approaches:

- Use SolidFire iSCSI to create parallel file system (permanent or "scratch" space)
- Use on-prem or cloud S3 storage if your application can natively support S3
- Mount S3 bucket and use it as local device - I've [blogged](/2022/03/10/s3-select-vs-remote-csv-over-fuse.html) about goofys, s3fs, MountPoint S3 and other ways to do this

Only the first of these three can make use of SolidFire, so I'll skip the other two which aren't directly related, although you could [download](/2023/08/04/h2o-storage-notes-h2ogpt.html) S3 data to a PVC backed by SolidFire, if you wanted to keep data or get lower latency access for the duration of your work and the size wasn't larger than SolidFire can handle.

### Share data with a parallel file system

We can deploy BeeGFS or GPFS inside of VMs that use SolidFire iSCSI (pRDM, but VMDKs on VMFS work as well). Containers can use these filesystems' CSI drivers for storage access. VMs can install BeeGFS or GPFS client to mount these filesystems. This can be deployed with Ansible on demand in less than 8 minutes (see this example [here](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html#how-do-automation-and-virtualization-help)) and can be destroyed if you don't intend to keep these filesystems for longer than jobs last.

You can also deploy BeeGFS in containers (see [here](https://github.com/ThinkParQ/beegfs-containers/)) and use it "natively" from within each container. NetApp Trident CSI can be used to present iSCSI devices to containers using [block volume mode](/2023/09/01/kubernetes-solidfire-block-volumemode.html) and then BeeGFS can be deployed. I haven't tried this last step yet, but I don't think it would fail.

This provides access to shared data without NFS or SMB shares. Of course, it still won't be faster than SolidFire storage underneath it.

My notes on running BeeGFS in containers can be found [here](/2023/12/02/containerized-beegfs-with-netapp-eseries.html).

### Share data without a parallel file system

If performance requirements are modest (say, 500 MB/s read):

- Kubernetes allows multiple pods on the same worker access the same PVC. All you need is to schedule jobs (or Jupyter notebooks) to the same namespace and use the same worker (may require sub-GPU allocation on Kubernetes, if you have one GPU and several CUDA users)
- Use Linux VM to export data via NFS: this is simpler and more flexible. If you need > 1 GB/s the VM can use LVM to stripe across multiple SolidFire volumes.

### Use SolidFire from Jupyter

I've blogged about [NetApp DataOps Toolkit](https://github.com/NetApp/netapp-dataops-toolkit) so I won't repeat any of that, but you can check my archives or see the documentation: it's a wrapper that makes some frequent data management operations simple. 

It supports ONTAP and BeeGFS, but it could be expanded to work with SolidFire - we'd just need to add 3-4 functions (create volume, snapshot, clone). This could be a great approach for SolidFire users who also have ONTAP or BeeGFS. You could even go wild and add the SolidFire SnapMirror to ONTAP (to copy/backup SolidFire volumes to ONTAP, for example).

Otherwise it may be easier to simply include these SolidFire API methods and Trident CLI commands in [Jupyter to use with SolidFire](/2022/03/29/manage-solidfire-jupyter-powershell.html).

If you're concerned about giving users' access to the API, check out the [RBAC](/2022/02/14/middle-class-rbac-solidfire-ansible.html) post. Maybe you can use Ansible to prevent accidents and control what users can do with volumes that don't belong to them.

### Ready-to-clone PVs for tools, applications, models

Why would one want to clone a SolidFire volume? For the same reason we clone Trident CSI volumes backed by ONTAP NFS shares - that lets you create dozens of clones without client-side copying, while saving space and time.

Tools and applications can be installed on a PVC that can be cloned and mounted when NVIDIA or other containers are started. 

If users don't write to these volumes, dozens of clones won't take any extra data capacity on SolidFire. 

People usually use RWX PVCs on NFS shares for this purpose and that does work very well (volumes don't have to be cloned, for example), but NFS server must exist and be managed. If you don't have other uses for NFS server, you don't need to stand up one just to efficiently share applications (or even small amounts of static data) in containers.

One complaint I've heard about this idea from someone who got it from an end user is that cloning on-demand takes a long time.

That may be true if your jobs run for less than 100 seconds and the container is then destroyed. In that case waiting for 15 seconds for every job is significant. But you can see [here](/2023/08/30/monitoring-solidfire-clone-and-backup-jobs.html#faster-multiple-clones-from-a-single-volume) that it's not *that* slow. 

Like I said I heard that from a colleague. If I had that problem, I would have come up with some tricks. It did take me a while, but my idea for this is pre-cloning. 

Let's say I have a PVC with scripts, utilities and AI models. I can setup a simple container that periodically ensures that this PVC has at least 5 unused clones and creates them when there's less than that. 

How to check if a PV is "unused"? It won't have any iSCSI sessions, it will have certain volume attributes (in the SolidFire Volume API object), etc. I can also check all my PVCs from Trident CSI side and see if those "unused" volumes are known to Trident.

Then from Jupyter or my deployment script I simply pick one of those idle volumes and assign it to my storage account that uses Kubernetes, and use that volume in my container by importing it with Trident. 

Before I needed 15 seconds to get this 100 GiB clone created. Now that's done in advance and I need just 1 second to use it.

This approach can be made even less "expensive" by reverting discarded (unused) volumes to a snapshot created immediately after cloning, so that no new clone needs to be created. If I import a clone to Trident as "unmanaged" volume, once the container is destroyed I can restore the volume to the first snapshot and have it "as good as new" without making a new clone.

## Conclusion

GenAI and inferencing workloads often don't need a lot of storage bandwidth or IOPS. 

I'm not writing this because I want you to buy new SolidFire arrays (you can't, it's no longer sold). 

I'm writing this because those who *already have it* may wonder if it makes sense to consider it for GenAI and inferencing and I think the answer is yes.

SolidFire users who keep most of their data in object stores may prefer to work with large data sets on external (S3) and use iSCSI for the rest. 

In these situations SolidFire iSCSI storage can be used very effectively either by taking advantage of the SolidFire API from Jupyter or own scripts, or by using it with a parallel filesystem solution such as BeeGFS which provides shared data and can be used like a shared "scratch" space. 

If data needs to be saved, we can use use one of the "S3 mount" approaches mentioned above. There are also specialized, [AI-focused approaches](https://docs.lakefs.io/quickstart/launch.html) to do that, which could be used to save data to [NetApp StorageGRID](https://www.netapp.com/data-storage/storagegrid/) or [MinIO with E-Series](/2022/10/21/minio-performance-netapp-e-series.html).

These approaches don't *require* SolidFire, but SolidFire makes them easier to implement.

## Appendix A - volume templates and fast clones

The **first** step is to prepare your "gold" template volume.

You can prepare this "gold" image by working "in reverse" or forwards.

In reverse: create an idling container with a solidfire-san PVC set to Retain the volume after container deletion. Enter the container, deploy packages and other data to the PVC path. Alternatively, build a Dockerfile with a startup script to automate that. Then stop the container and the volume will remain (as PVC was set to Retain). Now may clone or reassign to some other account not used by Kubernetes.

Or, starting from the storage side, create a new account for volume preparation, let's say we name it "prepper".

Get its Account ID (9), get available QoS policies. 

```powershell
PS /home/sean> (Get-SFAccount -Username prepper).AccountID                              
9
PS /home/sean> Get-SFQoSPolicy                                             

QosPolicyID Name   VolumeIDs        Qos
----------- ----   ---------        ---
          1 basic  {2}              {"MinIOPS" = 100, "MaxIOPS" = 800, "BurstIOPS" = 1000, "BurstTime" = 60}
          2 backup {1, 36, 37, 38…} {"MinIOPS" = 100, "MaxIOPS" = 1500, "BurstIOPS" = 3000, "BurstTime" = 60}
          3 tester {}               {"MinIOPS" = 200, "MaxIOPS" = 500, "BurstIOPS" = 2000, "BurstTime" = 60}

```

Next, create a volume that uses one of these QoS policies.

```powershell
PS /home/sean> New-SFVolume -Name gold -AccountID 9 -TotalSize 5 -GiB -QoSPolicyID 3 -Enable512e $False

VolumeID                    : 79
Name                        : gold
AccountID                   : 9
CreateTime                  : 2023-11-22T14:25:36Z
...
```

Prepare the volume by [importing it as an unmanaged](https://docs.netapp.com/us-en/trident-2307/trident-use/vol-import.html) Trident volume, entering the container and deploying tools, models or applications to the PVC mount path. Then exit and remove the container.

```sh
tridentctl import volume backendName volumeName -f pvc-file.yaml --no-manage
```

The **second** step is to create a cron job or a simple service that watches if this volume has at least X - let's say 5 - unused clones. 

From the above we know our account ID is 9 and our volume ID 79. We'd clone the volume like this:

```powershell
New-SFClone -VolumeID 79 -NewAccountID 9 -Name RandomName
```

But rather than manually cloning it, we should simply create a "checker" as we need to do that anyway.

```powershell
While ($True) {Start-Sleep 10; $volQty = ((Get-SFVolume -AccountID 9).AccountID).Count; if ($volQty -le 5) {New-SFClone -VolumeID 79 -NewAccountID 9 -Name UNIQ; Write-host "Created!"} else {Write-Host "No need"}}
```

This above is simple but it works fine for demo purposes. Notes:
- There should be a search condition to avoid volumes with the name "gold" or even "template*" for the situations where there are many gold template volumes
- `-Name UNIQ` doesn't create unique names. You need to randomize those names - use random digits, or whatever works for you. But as far as whether this works, it does. The last 3 volumes were created automatically
- *If* unmanaged Kubernetes volumes needed to be "refreshed" we could watch for those as well, change their ownership to this account and restore them to their earliest snapshot. You'd need to create a snapshot immediately after creating the clone in this code above

![Pre-created clones](/assets/images/solidfire-clone-precreation-01.png)

Now in step **three** executed before container provisioning I just need to look if I can find any unused volumes of the kind I need. 

What if there's 10 different "kinds" of clones owned by this account? Nothing. Find a way to differentiate between them. Team A can use volumes from Account ID 9, Team Z can use volumes from Account ID 10, so you could also create different template-making accounts for different teams.

```powershell
PS /home/sean> $floater = @{ "type"="cuda"; "dept"="team2"}                              

PS /home/sean> Set-SFVolume -VolumeID 84 -Attributes $floater -Confirm $False

VolumeID                    : 84
Name                        : UNIQ
AccountID                   : 9
CreateTime                  : 2023-11-22T15:07:10Z
...
LastAccessTimeIO            : 
SliceCount                  : 1
TotalSize                   : 5368709120
BlockSize                   : 4096
VirtualVolumeID             : 
Attributes                  : {[dept, team2], [type, cuda]}

```

That's one of the ways to find my volume without using an external database. Now to find volumes from Team 2 I can check the value of that key.

```powershell
PS /home/sean> $volLIst = (Get-SFVolume -AccountID 9).VolumeID

PS /home/sean> foreach ($vol in $volList) { $volData = Get-SFVolume -VolumeID $Vol; $volId = $volData.VolumeID; $volAttrs = $volData.Attributes; $volName = $volData.Name; if ($volAttrs['dept'] -eq $floater['dept']) {Write-Host "Vol ID and name", $volId, $volName}}
Vol ID and name 84 UNIQ

```

If multiple volumes are found, pick one or use additional criteria to find the right one. We should filter out (avoid) volumes with the name "gold" or "template*" if that's what we used for template creation.

We could store this in SQLite and create a simple PowerSHell or Python API, but why complicate things? 

One reason why you may not want to use volume attributes is if you're afraid you may create a conflict with Trident itself. As explained in other posts on this blog, Trident sets and reads SolidFire volume attributes as well. 

![Pre-created clones](/assets/images/solidfire-clone-precreation-02.png)

In my opinion this is safe - we just need to pick different keys, and as long as there's no conflict with Trident keys, that's okay. We set our attributes *before* the clone is used by Trident, and we can reset or update them after they're abandoned by Trident - there's no concurrent modification and key names are different. Also, if Trident uses `--no-manage`, maybe it won't even set volume attributes to begin with (it's been a while since I tried that).

Step **five**: compose a PVC YAML from a template and pick this volume name to import it to Kubernetes with Trident:
- Remember to randomize volume names during clone creation (should have been done earlier, in step two)
- For Trident/Kubernetes to access and import a volume, the volume should be owned by the Kubernetes storage account, so remember to change account ID (Set-SFVolume -VolumeID 84 -AccountID 100) before running the Trident volume import step

Depending on whether you import them with `--no-manage` and the PVC reclaim policy, you may want to delete the volume or "recycle" it by re-assigning it to the account "prepper" who can then automatically revert it to the first snapshot
