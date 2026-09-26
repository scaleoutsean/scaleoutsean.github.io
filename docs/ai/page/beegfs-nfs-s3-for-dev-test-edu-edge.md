# Containerized BeeGFS with NFSv4 and S3

It's finally done - fully containerized BeeGFS with NFSv4 and S3

## Introduction

Almost a year and a half ago I [blogged](/2023/12/02/containerized-beegfs-with-netapp-eseries.html) about a combined dockerized BeeGFS/NFS/S3 stack for E-Series. 

As anyone who follows this blog can notice, I haven't been idle... The idea was meant mostly for dev/test environments and as such I put in on a lower-priority personal wish list.

But then NetApp joined [OPEA](/2025/05/21/opean-ai-with-netapp-eseries.html), so I figured I might revisit this and do my job, which is solutioning. 

## Mission accomplished

I got it done today.

![SolidFire WAC Gateway](/assets/images/beegfs-8-nfsv4-s3.png)

What's inside:

- In-Docker BeeGFS cluster, inherited from [upstream](https://github.com/ThinkParQ/beegfs-containers))
- In-Docker BeeGFS client, a complicated addition with inevitable limitations (see README.md in the Github repository)
- In-Docker NFSv4 kernel-based server: exports BeeGFS client's mount via NFS
- In-Docker S3 gateway: an [S3 gateway from Versity](https://github.com/versity/versitygw) that makes BeeGFS accessible via S3

(Adding these extras was in fact painful. If it wasn't, someone would have done it by now.)

NFS and S3 are exposed on the Docker host, but for local experimentation it is recommended to simply close those firewall ports (111, 2049, 7070) and you'll be fine. But if you want to provide services externally, open those ports and they'll be available on LAN.

This is a combined mode, where NFS and S3 run in the same BeeGFS client container.

```sh
$ docker compose ps 
NAME                     IMAGE                                      COMMAND                  SERVICE                  CREATED       STATUS       PORTS
beegfs-client-combined   beegfs-containers-beegfs-client-combined   "/combined-entrypoin…"   beegfs-client-combined   2 hours ago   Up 2 hours   
beegfs-meta              ghcr.io/thinkparq/beegfs-meta:8.1          "/root/start.sh stor…"   beegfs-meta              5 hours ago   Up 5 hours   
beegfs-mgmtd             ghcr.io/thinkparq/beegfs-mgmtd:8.1         "/root/start.sh --db…"   beegfs-management        5 hours ago   Up 5 hours   
beegfs-storage           ghcr.io/thinkparq/beegfs-storage:8.1       "/root/start.sh stor…"   beegfs-storage           5 hours ago   Up 5 hours   

```

## What this has to do with OPEA?

Nothing directly, but the benefits of what I blogged about last year are the same and very pertinent.

If you read the OPEA post you'll see why E-Series is a good choice for OPEA: folks who run heavily Linux-focused stacks (which OPEA most certainly is) like the simplicity of E-Series. 

I don't need anyone to tell me that. I know that because I *am* a Linux guy.

Anyway, the idea is you get disks that are fast, protected and available, and you take care of the rest.

What is seemingly "missing" in  E-Series file/object service and you get "just" the block storage. 

But, as I wrote in the OPEA post lined above, that's not true. You can deploy NetApp StorageGRID in KVM VMs, for example, and even ONTAP Select as a KVM-based NFS/SMB/S3 storage appliance. And you can deploy BeeGFS and use it natively from Kubernetes containers, or export it via NFSv4.

But you may also want something like this: `git clone` this "All-in-One" BeeGFS-NFS-S3 repo, `docker compose up` in under 60s, and then you move on to deal with other problems. The OPEA approach.

What's "best"? It depends. What I'd look for for OPEA use cases:

- Edge AI (factories, remote sites)
- High-performance inferencing (e.g. 20 GB/s in 2U)
- High-performance vector databases 
- Compact deployments (5RU for 3 x 1U server + 1 x 2U E-Series array)
- OPEA deployments with hybrid storage requirements (e.g. 1 PB with 95% NL-SAS, but 500K IOPS needed for vector and other databases)
- Servicable OPEA deployments (E-Series has infrequent security updates, once configured, no management access from client is required)
- S3-centric external access (where staging and replication is S3-dominated; whether you use Versity S3 gateway or NetApp StorageGRID)

## Support

Let's continue with concern trolling. 

Support! OMG!

First, let's see what comes from where:

- OS container: Ubuntu (commercial support available)
- BeeGFS: ThinkParQ (commercial support available)
- NFS kernel server: Ubuntu (commercial support available)
- S3 gateway from Versity (commercial support available)

The funny (or maybe not funny) part is NetApp itself doesn't support this approach, as this is based on BeeGFS version 8 and runs in containers. The NetApp BeeGFS solution for E-Series still deploys old version 7. Also, it doesn't deploy it to VMs, let alone containers. 

But the stack is free and doesn't enable any features that require special licenses (both BeeGFS and Versity S3 Gateway), so this makes the problem less significant.

It's a good idea to buy support from the software vendors, but you don't need anything to be "supported". 

What I am *not* saying is that they support or not support this specific combination/integration. It happens to work and Versity generally supports any POSIX-compatible filesystems and so far I haven't seen major problems with this combination.

Exporting BeeGFS filesystems via NFS v4 is officially supported by ThinkParQ. 

If you need both (NFS and S3), it's safest (in terms of protocol limitations) to not share the same directories via both S3 and NFS (and BeeGFS). If you do use them on same data, I would recommend to use one protocol for read-based workload and another for write. That way you're less likely to encounter NFS/S3 cross-protocol limitations which simply cannot be "resolved" by some "workarounds".

What I would do in production might be exactly this stack, but in case of any problem, I'd deploy the same services in 3 VMs on KVM:

- VM1: BeeGFS management-meta-storage - direct BeeGFS access by containers, with BeeGFS CSI
- VM2: NFSv4 server (and BeeGFS client) - for data upload (ingress)
- VM3: Versity S3 gateway service (and BeeGFS client) - for data upload and replication/backup

Notice that this All-in-One "template" is easy to change and swap out any component or use it to create separate services (such as containerized BeeGFS cluster, container with Versity S3 Gateway), so you end up having doing the same thing that OPEA stack does - mixing and matching OSS containers to build services you need.

If you think that's not supportable, how could OPEA be supportable?

## What's missing

- **No TLS for S3 gateway**: that's deliberate. TLS should be terminated on a reverse proxy sitting in front of Vesity S3 Gateway. Kubernetes has theirs, VMs have theirs, etc. Use whichever you like. Versity S3 Gateway can provide TLS natively, but I didn't want to do it because in this All-in-One mode that shouldn't be done that way
- **No special attention paid to NFSv4 ACLs**: this is because I'd have to set up Kerberos and come up with some "scenarios", but I don't know what those "scenarios" in which NFS is required might be. In my mind, S3/TLS should be used for ingress (upload of data from inferencing clients) and egress (e.g. replication of data to the HQs with `rclone` or similar) and native BeeGFS (including Kubernetes with BeeGFS CSI) for inferencing and other OPEA workloads. If you need it here and there, the way it's set up is probably good enough. Or you could set up a stand-alone VM with (contanierized or native) NFS v4. 

Note on OS firewall configuration: as I've mentioned above, NFS and S3 services are already listening on host ports, but those ports should be closed on OS firewall if there's no intent to expose them. To expose them:

- Open ports 111 and 2049 for NFSv4. Of course, you should examine if LAN clients are trusted or if you want to apply Kerberos and other security measures
- Add a reverse TLS-terminating HTTP proxy on (say) port 8443 and forward to Versity S3 gateway port on 127.0.0.1:7070 (no need to serve S3 over HTTP)

## Takeaways

This all-in-one approach makes testing and development easy. 

Depending on the use case and environment, it may be even usable in production. But even if it's not deployed exactly the same way (say, we use All-in-One for dev/test, and VMs for production), the ability to do dev/test at will is precious.

Combine that with hybrid E-Series arrays (EF300, EF600), and you can serve decently big inferencing workloads with this stack. Need a fast RAID 10 on SSDs for vector DB workloads? [Sure!](/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html). Need RAID 6 on NL-SAS for 10 GB/s of BeeGFS workloads? [Easy](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html).

The other big win is (in my opinion) is S3. It lets you eliminate traditional file sharing and you get TLS encryption for free (simply add an NGINX HTTPS reverse proxy in front of Versity S3 service). 

Then you create buckets for individual users or groups and you don't have to manage filesystem either. Replicate data with `rclone` to infrequent access S3 archives with Object Lock daily and you have a DR replica. (BeeGFS )

Once files are uploaded to a directory, job schedulers [can move or copy them](/2022/06/14/batch-copy-files-beegfs.html) elsewhere but in many cases you may be able to just leave them there. 

If you need "traditional" block services for databases or even "regular" NFS on XFS or ext4, just create regular iSCSI devices for KVM VMs. With [ZFS](/2024/02/28/incus-zfs-netapp-eseries.html) you can also offload cloning and other tasks from storage. If Pacemaker/Corosync are too hard to set up for KVM HA, consider KubeVirt or [LXD](/2022/09/02/lxd-containers-vms-on-beegfs.html).

My All-in-One BeeGFS/NFSv4/S3 stack will be posted to Github this weekend.

## Next steps

I've been using Versity Gateway with BeeGFS in [data pipeline](/2025/06/22/data-pipeline-with-beegfs-file-system-notifications-and-versity-s3-gateway.html) scenarios and also with "single-host" filesystems and Versity S3 Gateway has shown [good performance](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html) even with small files. Most recently I also got InfluxDB with tiering to S3 (Versity S3 Gateway), and my experience with it has been good. I plan to do some stress testing with InfluxDB and Versity S3 Gateway, which would be the 3rd kind of workload tried with Versity S3 gateway (native data pipelines, small object workloads, and lately data analytics (with InfluxDB tiering to/from S3)).

This gives me the flexibility of deploying the same container/service on BeeGFS or single-host file system for different workloads. All I need to do is decide what's most suitable for my use case.

I'd like to do some testing with OPEA solutions, but they require high-end Intel CPUs which I do not have. But I'll take a look at that as well - as long as services can start, that's already something!
