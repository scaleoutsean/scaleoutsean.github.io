# Containerized BeeGFS with NetApp E-Series

How E-Series owners can take advantage of containerized BeeGFS

## Introduction

Sometimes we want to run BeeGFS in containers. 

It's possible and, since the recent efforts by the BeeGFS vendor ThinkParQ, easy.

## Why

Why deploy containerized BeeGFS?

As I demonstrated in [BeeGFS in VMs](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html):

- BeeGFS in VMs can be deployed in minutes (including VMs, 10 minutes)
- Virtualized BeeGFS can deliver a decent performance even on VMFS
- vSphere can be used to provide HA to BeeGFS services
- If you need 1-20 GB/s, you may be able to get away with Ethernet-based, virtualized BeeGFS on a VI platform

BeeGFS in containers is useful for the same reasons. 

We expect that deployment would be faster, HA probably less good, and the cost lower because there's no vSphere in the picture.

If you run analytics, AI or similar workloads based on Kubernetes workflows, you may not even have VMware in your environment.

[ThinkParQ took over development of BeeGFS CSI driver](/2023/09/08/beegfs-csi-driver-lives-on.html), so client-side provisioning is supported by them as well.

## How

Basically it's three big steps: deploy underlying infra, deploy BeeGFS, and connect clients.

### Deploy and configure OS, storage and network

Deploy OS, E-Series, and a high speed network (25 Gbps or better). 

In a Kubernetes environment we'd have to use static host paths or a CSI driver for the storage array. 

We don't want BeeGFS containers (or VMs with BeeGFS containers) to randomly move around among compute nodes, so static host paths should be enough, but HA among compute hosts would have to be manual (unmount storage on one host, mount on another, fire up the migrated container). 

There are [CSI drivers](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) that we can use with E-Series, but they also don't support HA failover among compute nodes. And with some other storage arrays you may be able to h handle compute node failures without hypervisor failover, and just with CSI drivers.

If you run Docker in VMs on on bare metal hosts, you wouldn't need Kubernetes but only Docker, so we'd just create regular filesystem mount points that BeeGFS needs.

For optimal HA, using Docker containers with VMware HA is still appropriate for those who need enterprise-level uptime. If BeeGFS is deployed for temp or scratch space, manual HA with Kubernetes or Docker may be good enough.

Each BeeGFS host would [mount and format a volume or volumes for persistence](https://doc.beegfs.io/latest/quick_start_guide/quick_start_guide.html), and containers would use those persistent volumes to store data that survives restarts. 

Normally, with a dynamic CSI provisioner those volumes would be created on the fly, but if you use Kubernetes with E-Series the ones I mentioned above would have to be created semi-automatically as they don't talk to the SANtricity API and cannot create LUNs and present them to hosts without administrator's involvement. It's the same for Docker.

### Containerized BeeGFS

[Clone this repository](https://github.com/ThinkParQ/beegfs-containers/), read the instructions (including [the BeeGFS documentation](https://doc.beegfs.io/latest/advanced_topics/containers.html)) and start BeeGFS containers. Note that the BeeGFS documentation has its own docker-compose.yml which is slightly different from the one on Github. Maybe take a look at the both and pick whichever you like.

The only thing you may need to create is one or two Docker bridge interfaces, if you don't want to use the default one. If you use Docker Compose on a single host, that should be automatic. If you use "`docker run`" or use several hosts, then you may need to create them separately.

Based on the simple example from the repository, my host mount points were as follows and all the BeeGFS containers were deployed with docker-compose in this VM:

```sh
$ df 
/dev/vdf                           270M   25k  226M   1% /mnt/meta_01_tgt_0101
/dev/vdg                           1.1G   42M  1.1G   4% /mnt/stor_01_tgt_101
/dev/vdh                           1.1G   42M  1.1G   4% /mnt/stor_01_tgt_102
/dev/vde                           511M   25k  474M   1% /mnt/mgmt_tgt_mgmt01
# double-check path for docker-compose.yml management volume path - it may be /mnt/mgmt_tgt (Github version)
```

### Deploy and configure BeeGFS clients

BeeGFS client(s) wouldn't run in containers. 

Inside of application/workload containers we could use BeeGFS CSI driver (find the link at the top) for dynamic, or host paths for static, PVCs.

We'd deploy BeeGFS client(s) in VMs or physical hosts and connect to BeeGFS running in containers.

docker-compose.yml from the Github repository does not map host ports to any containers as it's meant for local host experimentation. You'd have to add ports that you want to expose over network(s).

If you map container ports to the host (see the product documentation), you should see a couple of ports from the 8003-8008 range open like this (all containers are on one host, so management, metadata and storage nodes are all present).

```sh
$ netstat -ant 
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State      
tcp        0      0 127.0.0.1:2019          0.0.0.0:*               LISTEN     
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN     
tcp        0      0 0.0.0.0:8005            0.0.0.0:*               LISTEN     
tcp        0      0 0.0.0.0:8003            0.0.0.0:*               LISTEN     
tcp        0      0 0.0.0.0:8008            0.0.0.0:*               LISTEN     
tcp6       0      0 :::80                   :::*                    LISTEN     
tcp6       0      0 :::22                   :::*                    LISTEN     
tcp6       0      0 :::8005                 :::*                    LISTEN     
tcp6       0      0 :::8003                 :::*                    LISTEN     
tcp6       0      0 :::8008                 :::*                    LISTEN     
tcp6       0      0 :::8086                 :::*                    LISTEN     
```

Obviously you couldn't run two of the same services on the same node without creating port conflicts, but you wouldn't want to anyway.

We'd want to spread storage node containers around different physical hosts or maybe VMs (probably not more than two per physical server).

We could also change BeeGFS configuration files to eliminate collision, but done properly each BeeGFS storage node would be on a different host. Small clusters would have just one metadata server, so that and management node wouldn't be a problem.

BeeGFS clients would run on hosts or VMs different from those where BeeGFS servers run. Mixing multiple clients and servers across several shared physical hosts may be possible, but I wouldn't do it - it could be difficult to troubleshoot. If you have just one host with all BeeGFS containers on it, and one client (the host), that works fine with "host" type network in docker-compose.yml.

## Other notes

Networking-wise, RDMA is supported, but I didn't try it because I don't have it and I'd think this containerized approach wouldn't be targeting extreme levels of performance in any case. 

But RDMA should work without any changes - just use the compose example from the official documentation to map network hardware to the containers - there's nothing else to "enable" if your host is properly configured. You may *disable* RDMA if it's available on the host and you don't want it - the same as with a non-containerized BeeGFS.

Startup time for a small cluster (1 x Mgmt, 1 x MD, 1 x Storage (2 disks)) is mere seconds.

- Docker start time: 2023-12-02 08:50:44
- Services up and running: 08:50:47

For this I used docker-compose.yml from Github.

![Docker Compose with BeeGFS up and running](/assets/images/beegfs-docker-00.png)

Although the examples from Github and BeeGFS documentation technically do work, some of it is left as "an exercise for the reader". For example, the client part is missing, and when I tried to configure it I encountered various network-related problems that I wasn't able to solve for several hours. 

In part that's because `beegfs-utils` isn't available inside of the containers, so if you want to look from *within* any Docker container, that's inconvenient. I eventually spent hours building a customized management container, changing network configuration, etc. This [part from the official documentation](https://doc.beegfs.io/latest/advanced_topics/containers.html#running-beegfs-in-containers-using-docker-run) is very relevant:

> For containers it is important to always use -S and specify the string ID. By default BeeGFS uses the hostname, which for containers can change when they are recreated, or if the network mode is set to “host” will match the base OS hostname which would break things if multiple containers of the same type are running on the same server.

![Docker Compose with BeeGFS client connected](/assets/images/beegfs-docker-01.png)

Another odd thing I spotted is that I created very small volumes for the host (because I don't have much free space left), but `beegfs-df` reported a larger capacity. I don't recall if that's the maximum size possible or a bug.

```sh
root@a3cf0ae2dc85:/# beegfs-df
METADATA SERVERS:
TargetID   Cap. Pool        Total         Free    %      ITotal       IFree    %
========   =========        =====         ====    =      ======       =====    =
       1         low      22.5GiB       5.9GiB  26%        1.5M        1.2M  81%

STORAGE TARGETS:
TargetID   Cap. Pool        Total         Free    %      ITotal       IFree    %
========   =========        =====         ====    =      ======       =====    =
     101   emergency      22.5GiB       5.9GiB  26%        1.5M        1.2M  81%
     102   emergency      22.5GiB       5.9GiB  26%        1.5M        1.2M  81%
```

My disks (management, metadata, storage) were much smaller (I should have used > 2 GiB to avoid hitting the emergency limit).

```raw
Disk /dev/vde: 512 MiB, 536870912 bytes, 1048576 sectors
Disk /dev/vdf: 614.4 MiB, 644245504 bytes, 1258292 sectors
Disk /dev/vdg: 1 GiB, 1073741824 bytes, 2097152 sectors
Disk /dev/vdh: 1 GiB, 1073741824 bytes, 2097152 sectors
```

For the EF300 I would start with 2-4 storage node containers with 1 target each and for the EF600, 4 storage nodes with 2-4 targets each, but since it's easy to experiment in this environment it would be best to try several scenarios that emulate your workload and pick the most suitable one.

Backup and restore can be done in many ways - see some older posts on this topic. The same goes for monitoring, replication and other topics I've written about. 

Data synchronization and copying from and to BeeGFS can be done with [any POSIX-compatible utility](/2022/06/14/batch-copy-files-beegfs.html). Users who use NFS or S3 for persistence and use BeeGFS as temp/scratch space can take advantage of this.

ARM64 is also supported, but as of now container images aren't posted, so you need to use the Github approach which builds them from scratch, rather than the official documentation which downloads ThinkParQ-made images.

## Conclusion

Containerized BeeGFS has the same benefits - some more pronounced, some less - as BeeGFS in VMs.

Users who run BeeGFS this way and need data persistence would benefit from VMware HA for workers/Docker nodes, and those who use BeeGFS for scratch space could run with manual HA and simply restart upon failure.

Small E-Series-based deployments could use this approach with 4 directly-attached uniprocessor servers. 

I should have created some drawings to make this post easier to understand, but I guess this will have to do for the first one. I'll write more about containerized BeeGFS if I come across customers interested in this approach.
