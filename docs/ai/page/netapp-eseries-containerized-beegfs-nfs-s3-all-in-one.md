# NetApp E-Series with containerized BeeGFS, NFS, S3

Get started in minutes: E-Series, BeeGFS, S3 and NFS 4

- [Introduction](#introduction)
- [Reinventing the wheel](#reinventing-the-wheel)
- [Components](#components)
- [Workflow](#workflow)
- [Expected outcome](#expected-outcome)
- [Next steps](#next-steps)
- [Security](#security)
  - [Quotas and ACLs](#quotas-and-acls)
- [Monitoring](#monitoring)
- [Conclusion](#conclusion)

## Introduction

Everyone likes to say their storage platform makes AI easy to automate, get started in no time, and so on.

Well, I am 100% sure that is the case with NetApp SolidFire. Related to (Gen)AI, I gave some examples in a post where I went beyond the usual "create disks" stuff and showed how easy it is to make SolidFire do exactly what you need such as, for example, keep a stash of 5 freshly cloned data volumes, so that users don't even need to wait for a few seconds until their data volume is cloned.

On the other hand, E-Series has an API exists, but I'll be the first to say - it isn't a DevOps paradise.

But very recently I realized I don't need a paradise. I just need to create a few of LUNs, and that has to be done once. 

Why is that? Because when we use BeeGFS with E-Series, the rest of automation and workflows don't involve E-Series. 

We create (or remove) volumes when we make changes to BeeGFS, which is rare. That's all. The rest is BeeGFS, BeeGFS CSI, and so on.

## Reinventing the wheel

I wouldn't suggest what I recommend here is good for production use, but it's a start and likely good enough for functional Dev/Test.

In fact, many E-Series users who new to AI want to start somewhere. Others already use AI in production, but need another environment for testing (preferably fast and economical).

Previously I explained (not that it wasn't explained by ThinkParQ, but I hope I explained it a bit better) how to stand-up containerized BeeGFS. So, that's already "solved".

But why not go a step further, and solve it even more? Say, add NFS and S3 services. 

With that, all you need is two E-Series volumes, and once that is done you can have a singleton BeeGFS cluster with NFS and S3 ready-to-use.

## Components

From bottom up:

- NetApp E-Series
- ThinkParQ BeeGFS
- Linux NFS 4.1 (kernel-based) server
- Versity S3 Gateway

What to expect?

- BeeGFS, a parallel file system
- Ability to deploy BeeGFS CSI (if you're a Kubernetes user) or use BeeGFS locally on the Docker host
- Ability to upload or download data from external clients using NFS or S3, which makes synchronization with production environments easy

What to not expect?

For scale-out BeeGFS you'd need a bit more work, to make the BeeGFS containers work with external, preferably RDMA-enabled, networks. See the BeeGFS containers-related documentation, or just use non-containerized BeeGFS.

Our singleton BeeGFS approach can ignore external networks aside from non-BeeGFS services, which need to be exposed over plain TCP/IP which is easy.

## Workflow

1) Create E-Series volumes (on DDP or traditional Disk Group, for testing either is fine)

2) Create E-Series hosts (this lets the array know which clients (FC, iSCSI, etc.) are out there, and map LUNs to selected host(s))

3) Map volumes to hosts

4) Configure multi-pathing or, if it's already in place, rescan storage to detect new disks

5) Edit YAML and Docker configuration file

6) Go! `docker compose up`

7) Install BeeGFS client and mount BeeGFS from containers

Steps 1-4 are routine for most E-Series users. You can complete them from the SANtricity UI (5 minutes of work) or or via the API (10 seconds of staring). The NetApp BeeGFS deployment scripts for Ansible (find 'em on Github) may be used if you're not in the mood for writing to the SANtricity API.

You can see screenshots of some of the steps 1-4 in my post about Ubuntu with iSER.

Steps 5-7 are explained in my post about containerized BeeGFS.

## Expected outcome

Maybe this heading will eventually be changed to "result", but until I get that done I'll refer to it as "expected outcome".

![Containerized BeeGFS, NFS and S3](/assets/images/netapp-eseries-containerized-beegfs-nfs-s3.svg)

## Next steps

Mild stress test for your stack (S3, NFS, filesystem) would be a good first step.

In order to install Kubernetes and ThinParQ BeeGFS CSI driver on the host we may need to deploy these containers on Kubernetes. As-is, it's meant for Docker, but if your environment and workflows depend on Kubernetes, you can modify the YAML to suit your needs.

## Security

If you handle sensitive data, just use the plain BeeGFS container set as explained in that earlier post. You can still use WinSCP or SCP to get your data in and out.

NFS and S3 expose data on LAN, so users with sensitive data need to restrict access, especially to NFS. S3 is probably easier and harder to make mistakes with, as key pairs need to be created and provided to users. 

### Quotas and ACLs

BeeGFS users with (commercial) enterprise support get quotas and ACLs. 

Versity S3 gateway may be able to provide some quota control as well, but it won't apply to local (BeeGFS) users on the host.

## Monitoring

You can throw in a few more containers to get BeeGFS monitoring, and 3-4 more from my EPA project to get E-Series monitoring as well.

As this setup is for Dev/Test and demo environments, it's likely not necessary to add all the gizmos one would want in Production.

## Conclusion

Production deployments and integrations usually require a lot of work, but non-production do not.

This approach aims to make it easy to get an idea of how BeeGFS with E-Series works and uses more batteries than the previous post on BeeGFS containers. Now even upload and download to this environment should be convenient. 

Although this example requires just a single server attached to one E-Series, if your server and storage has enough IO resources you can run hundreds of Dev/Test containers on it. Even the entry-level EF-Series EF300 - given enough disks - can give you over 10 GB/s in mixed read-write performance.

And it takes less than minutes to get started.
