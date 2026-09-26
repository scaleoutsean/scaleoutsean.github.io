# Boot OpenShift RCOS from NetApp SolidFire iSCSI target

Install and boot RCOS using SolidFire iSCSI device

- [Introduction](#introduction)
- [How](#how)
- [Other SolidFire-related tips](#other-solidfire-related-tips)
- [Conclusion](#conclusion)

## Introduction

I'll make this a short one because I haven't actually tried any of this.

So, starting with OpenShift 4.16, Red Hat OpenShift can boot RCOS from iSCSI devices.

Does SolidFire support that?

Simple answer: Who cares! There's nothing that SolidFire needs to do here. RCOS swap must be disabled so IO requirements are basic and there's nothing special here: SolidFire has to present iSCSI target to client and that's it. The rest is client-side work.

Complicated answer: ask NetApp Support.

## How 

I posted a [this "boot from iSCSI" video](https://www.youtube.com/watch?v=JVZoMGxte4c) to YouTube several years ago. It worked then and it ought to work now.

From OpenShift [4.16 documentation](https://docs.openshift.com/container-platform/4.16/installing/installing_bare_metal/installing-bare-metal.html#rhcos-install-iscsi-manual_installing-bare-metal):

> RHCOS supports multipathing on the primary disk, allowing stronger resilience to hardware failure to achieve higher host availability.

You don't need that. 

If you follow this blog or have read other content, I recommend against using multipath because it complicates things and doesn't add much value *if* you can use LACP. 

SolidFire uses single fabric SAN, so LACP is the logical choice and doesn't require any complex setup. It's likely configured by default on your SolidFire nodes and switch ports, so you need to do the same on your iSCSI clients and can avoid dealing with multipath daemon, settings and bugs. 

> While postinstallation support is available by activating multipathing via the machine config, enabling multipathing during installation is recommended.

Don't listen to them if you can use LACP (which has been the recommended by SolidFire for many years).

The page also mentions how to specify paths to non-multipath boot disks:

```sh
coreos-installer install /dev/disk/by-id/wwn-<wwn_ID> \ 
--append-karg rw
...
```

I have a [sample path](https://github.com/scaleoutsean/solidbackup/blob/develop/ansible/01-iscsi-login.yaml) in my SolidBackup project.

```raw
/dev/disk/by-path/ip-10.128.56.50:3260-iscsi-iqn.2010-01.com.solidfire:nfgj.solidbackup-70.175-lun-0"
```

I haven't verified the last item, but here's what each part means:

- `/dev/disk/by-path/ip-` - fixed
- SolidFire SVIP - find it in the UI or via the API (`10.128.56.50`)
- Port - standard iSCSI port (fixed) (`:3260`)
- Target prefix - fixed (`-iscsi-iqn.2010-01.com.solidfire`)
- Cluster ID - cluster-dependent; find it in the UI or with API (`nfgj`)
- Volume name - whatever you give it (`solidbackup-70`)
- Volume ID - (`175`)
- `-lun-0` - this could be the first partition, but is likely the entire LUN (I never partition Linux volumes and this has worked for me)

You can find detailed steps on this [Fedora page](https://docs.fedoraproject.org/en-US/fedora-coreos/bare-metal/). Note the `\` (escape) is needed before `:` in device path:

```sh
coreos-installer iso customize \
    --pre-install mount-iscsi.sh \
    --dest-device /dev/disk/by-path/ip-10.128.56.50\:3260-iscsi-iqn.2010-01.com.solidfire\:nfgj.solidbackup-70.175-lun-0 \
    --dest-ignition config.ign \
    -o custom.iso fedora-coreos-40.20240701.3.0-live.x86_64.iso \
    ...
```

You can reference [this Flatcar post](/2021/12/07/flatcar-linux-with-solidfire-iscsi.html) for SolidFire-specific network and iSCSI configuration examples, as well as for mounting additional disks that are not needed for workloads, but may be needed for other things. 

For example, you may have a common boot disk for all workers, and an additional OS disk with some large and complex application which could be mounted at /opt (which is also related to [this post](/2023/11/22/genai-with-netapp-solidfire.html#ready-to-clone-pvs-for-tools-applications-models) about rapid volume provisioning in inferencing or software build environments; there's no need to run multi-GB `git` clone/pull and wait 3 minutes when you can pick a pre-cloned volume and just mount it to /data in 10 seconds).

## Other SolidFire-related tips

You can use either 512b (512e=True) and 4kB sectors on a SolidFire volume setup for RCOS boot from SAN. The former is the default for both RCOS and SolidFire and there's no real practical difference (that I know of), so I'd just go with 512b.

You can't (or at least, shouldn't) use the same device for multiple RCOS (or other OS). SolidFire will let you do it, but updating one VM would likely break others. It's also useless for the purpose of saving space since SolidFire deduplicates all repeated blocks anyway. Create a separate volume for each OS and name it accordingly (e.g. os-worker01 or whatever).

Should we use CHAP or Volume Access Group (VAG)? You can use either. If you can set and control IQNs, VAG is fine because you wouldn't need to deal with passwords, which is an advantage especially if boot disks are read-only and don't contain any secrets (as they shouldn't).

QoS is likely unimportant. We need enough to boot not-too-slowly, but not much so that 32 OS boot disks take out 100K IOPS. I'd go with something like:

- 10 GiB size - way too much, but it doesn't matter because of Thin Provisioning. You can pick a smaller size if you want
- Min 1000 IOPS which is around 4 MiB/s - probably 30s boot in the worst case?
- Max 3000 IOPS - around 10s boot time, I figure (add another 10 for BIOS splash screen, PXE, etc.)
- Burst 5000 IOPS - if available, let it go faster than 3K, but not too fast because it's just one-off activity and we probably don't want 32 VMs bursting to 200K at the same time
- Enable 512e (i.e. use the "default" RCOS setting, 512b sector size)
- Monitor and adjust as necessary

To create 8 volumes with PowerShell, create an account and VAG (if you won't use CHAP) first, then - assuming Account ID is 3:

```powershell
For ($i = 1; $i -le 8; $i++) {New-SFVolume -Name os-worker0$i -AccountID 3 -TotalSize 5 -GB -Enable512e:$true -MinIOPS 1000 -MaxIOPS 3000 -BurstIOPS 5000}
```

Storage replication of boot volumes can be simplified with [Longhorny](/2024/06/11/introducing-project-longhorny.html), but it's not hard to do it from the Web UI either. The only reason I mention it for 12 nodes you'd have to do the UI workflow 12 times and without automation it's likely you'll make mistakes. How we'd create replicated boot volumes with Longhorny:

- Use the above PowerShell command to create 12 volumes on "primary" cluster
- Use Longhorny's `volume --prime-dst` action to prime the destination cluster based on count and size of these 12 volumes. This spares you from creating volumes on the remote cluster and changing them to `ReplicationTarget` access mode
- Setup replication with with something like `volume --pair --data "1,11;2,12;3,13;4,14;5,15;6,16;7,17;8,18;9,19;10,20;11,21;12,22"` which would pair 1-12 from the primary site with 11-22 from the secondary.

## Conclusion

To boot, a slim OS needs to read some 100 MBs which even at 10 MB/s takes 10 seconds. Boot from SAN doesn't represent a heavy workload when swapping is disabled, and SolidFire's global deduplication means dozens of nodes can use it without taking up much disk space - I suspect 20x or 30x deduplication ratio for the "OS boot" account should be routine with dozens of nodes.

Having OS boot from iSCSI may be useful and simplifies IT operations including disaster recovery.

I'd use LACP (no multipath), especially because with LACP we can also avoid multipath in Trident CSI-backed containers that run on top of OS.

You can get SolidFire Demo VM to practice this in both single and replicated (2 SolidFire VMs as "two sites") scenarios. It's an OVA image so in order to using it on KVM, find an old ESXi 7 ISO, install it on KVM and install SolidFire Demo VM in it.
