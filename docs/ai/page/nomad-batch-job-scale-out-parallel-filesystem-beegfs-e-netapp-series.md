# Scaling out Nomad batch jobs with BeeGFS and NetApp E-Series

Disaggregate and scale out your storage-intensive media jobs with Nomad, BeeGFS and E-Series

- [Introduction](#introduction)
- [Setup](#setup)
- [Scaling-out IO-intensive batch jobs](#scaling-out-io-intensive-batch-jobs)
- [Shared file system vs. file server vs. internal disk](#shared-file-system-vs-file-server-vs-internal-disk)
- [Scale-out batch jobs with Nomad I/O and BeeGFS](#scale-out-batch-jobs-with-nomad-io-and-beegfs)
  - [Getting data in and out of the cluster](#getting-data-in-and-out-of-the-cluster)
  - [Scaling out batch jobs](#scaling-out-batch-jobs)
- [File format conversion](#file-format-conversion)
  - [Simple approach for small clusters](#simple-approach-for-small-clusters)
  - [Medium and large scale](#medium-and-large-scale)
- [Getting the files out (or in)](#getting-the-files-out-or-in)
- [Summary](#summary)
- [Demo](#demo)

## Introduction

## Setup

These simple example is about running such jobs at a high speed. Normally we'd have multiple clients, but here I have just one.

- BeeGFS cluster (VMs)
  - b1 - management node
  - b2 - metadata server
  - b3 - storage node 1
  - b5 - client
  - b6 - client
- Nomad servers (VMs)
  - b5 - Nomad server, Nomad client
  - b6 - Nomad client
- Parallel filesystem
  - BeeGFS mounted at /mnt/beegfs on BeeGFS client (b5, b6)
- Block storage
  - NetApp E-Series, used by BeeGFS storage node 1 (b3)

On Nomad client with BeeGFS, set Host Volume to a BeeGFS mount point or its subdirectory (e.g. /mnt/beegfs/nomad). This beegfs-ctl output shows the client nodes in the cluster. 

```sh
$ sudo beegfs-ctl --listnodes --nodetype=client
74EA-62643165-b5 [ID: 73]
36C-6264331C-b6 [ID: 75]
```

Normally we'd have redundancy and availability for BeeGFS Management (VMware or other), Metadata (physical) and Storage (physical) servers. Nomad servers use Raft for HA.

![HA Nomad cluster with BeeGFS and E-Series](/assets/images/nomad-batch-scaleout-beegfs-eseries.png)

Both Nomad and BeeGFS clients are disposable. Failed jobs can be retried from any client with a similar profile.

## Scaling-out IO-intensive batch jobs

Scale-out of the compute and networking resources used to run jobs depends on the job-running servers, and here we can use fewer 2U dual-socket servers or more 1U uniprocessor servers. That's out of scope for this post, as any combination will do.

As far as storage performance is concerned, we usually scale out in "pod" increments - one pod being something like BeeGFS servers and one E-Series array.

As we add storage servers and arrays, total aggregate performance of shared filesystem increases due to file striping across multiple servers and/or arrays, while per-client performance can easily saturate each individual BeeGFS client. 

As an example, here's how we'd scale from 10 to 30 or 50 Nomad/BeeGFS clients that have concurrent IO of 1 GB/s per client:

| # Client (QTY) |  # Servers (QTY) | Mixed R/W (GB/s) | E-Series (QTY) | 
| :---: | :---: |  :---:|  :---: |
| 10-20 |  2    |  20   |  1    |
| 20-40 |  4    |  40   |  2    |
| 40-60 |  6    |  60   |  3    |

Let's say we process images or videos for DL/ML or stitch many images into video files. That can be very compute-intensive, so BeeGFS client-to-server ratio would likely be higher than in this table, because not every client would always use 1 GB/s. But for video streaming we may need fewer clients.

## Shared file system vs. file server vs. internal disk

Both b5 and b6 have the same view of the filesystem and can read and write to it.

![Nomad cluster with two BeeGFS clients](/assets/images/nomad-batch-scaleout-beegfs-eseries-01-topology.png)

The same volume is exposed to Nomad from the BeeGFS client b6:

![Host Volume from b5](/assets/images/nomad-batch-scaleout-beegfs-eseries-04-b5.png)

And from b6:

![Host Volume from b6](/assets/images/nomad-batch-scaleout-beegfs-eseries-03-b6.png)

```sh
@b5$ dir -lat /mnt/beegfs/nomad/transcode/
-rw-rw-r-- 1 vagrant vagrant 11968151 Apr 23 07:37 beegfs-csi-k8s.mp4
-rw-r--r-- 1 vagrant vagrant 23169766 Apr 22 14:41 velero-solidfire-storagegrid-s3.mp4

@b6$ dir -lat /mnt/beegfs/nomad/transcode/
-rw-rw-r-- 1 vagrant vagrant 11968151 Apr 23 07:37 beegfs-csi-k8s.mp4
-rw-r--r-- 1 vagrant vagrant 23169766 Apr 22 14:41 velero-solidfire-storagegrid-s3.mp4
```

This means we can upload data from any client, dispatch compute jobs to any client, and read the result from any client. It can be all the same client, or we can use dedicated clients or groups of BeeGFS clients for particular jobs:

- upload data through dedicated multi-homed gateway-style clients at 50 MB/s
- run 3D video simulation on 100 GPU-enabled clients consuming 10 GB/s
- view high resolution output from a developer workstation reading at 3 GB/s

There are other approaches that may be worse or better, depending on the requirements and environment.

Sometimes it is better to use local disks. This can come in multiple variants: each client could use own disks, or a parallel filesystem (even BeeGFS) could be created across many clients in RAID0-like fashion. Sometimes this works well, other times it performs poorly and causes unplanned downtime (RAID0-like). Some approaches add storage mirroring (increases the cost by a factor of 2) or erasure coding (increases the cost by 30-50%) but that doesn't entirely fix the problem.

There's also a DAS approach combined with Object Stores, where an Object Store is used to persist data, and anything local is temporary. I blogged about this approach in [this post](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html) which talks about leveraging S3 storage for workloads in the public multi-cloud.

Other times it makes more sense to use network sharing such as NFS and SMB. To paraphrase that politician, you'll know it when you need it. We could pick a BeeGFS client and export/share BeeGFS data through NFS server or Samba, but if you need extensive management features that Linux doesn't have, that may be insufficient.

There's no "best approach" across all use cases and situations.

Many IO-intensive workloads can benefit from using a parallel file system and there's nothing that says that if you use BeeGFS with E-Series you cannot also use some other approach in the same cluster. As an example, we can use BeeGFS for processing and sharing of hot Big Data, have a storage backend for [some block workloads](/2022/04/09/beegfs-csi-introduction.html#options-in-a-mixed-environment), and use S3 for infrequent access to unstructured data.

## Scale-out batch jobs with Nomad I/O and BeeGFS

I wrote about using Nomad batch jobs with Nomad/BeeGFS clients [here](/2022/04/05/nomad-beegfs-eseries.html), emphasizing the ability to access same data from at high performance. In this post I'll only talk about scaling-out jobs mentioned in that post, both in terms of compute, but also in terms of getting data in and out in parallel.

### Getting data in and out of the cluster

There are many ways to do that, such as running S3, NFS, or SMB on selected BeeGFS clients (mentioned earlier), concurrent Nomad client connectivity to NFS/SMB/BeeGFS, fetching data from S3, replicating it in and out with [CloudSync](/2022/01/18/using-netapp-cloudsync-api.html), rsync, and more.

But, to stay on the previous topic (media conversion), I intend to use SRT - one of popular media transfer protocols. 

There's nothing that prevents us from using several at the same time, but since I've covered NFS and S3 in other posts, I'm not going to write about those (or FTP).

Or, to put it bluntly, Nomad and BeeGFS client don't care what you run as long as you have the resources: it's all just jobs - one-off download/upload batch job, NGINX-proxied Web portal, SRT media streaming or file transfer service, or something else.

### Scaling out batch jobs

What's different compared to that previous Nomad/BeeGFS post is that here we use parametrized batch jobs advantageous to this use case. 

That is, previous post was about simple batch jobs which are usually used for a different thing every time (one time we may patch the OS, another time backup a database). For repetitive jobs in which only parameters change, it makes sense to start a "batch job service" and then let it sit there and wait for repetitive jobs, so that it can evaluate, allocate and dispatch them faster.

Another interesting feature offered by Nomad and BeeGFS is the ability to run workloads across different availability zones. We can use Nomad to tag nodes with location (such as the 3rd and 4th floor of DC1, or DC1 and DC2), while BeeGFS can use remote clients or - for selected or all filesystems - buddy mirroring to make storage available locally at each site.

In my example I have each client located on a different floor of DC1:

![Nomad, BeeGFS, E-Series](/assets/images/nomad-batch-scaleout-beegfs-eseries-01-topology.png)

## File format conversion

As mentioned earlier, we run parametric batch jobs so that we can dispatch many repetitive jobs to clients.

### Simple approach for small clusters

Some simple Nomad demos out there use Object Stores: data is downloaded to the client, converted, and uploaded back to Object Store. How is that not better, but different?

It must be said those are simple demos focusing on front-end features and do not represent production-worthy configuration for medium or large scale deployments.

### Medium and large scale

For medium and large deployments I'd probably have 1-2 BeeGFS clients that can get out to Object Storage, while the rest of BeeGFS clients would be used for workloads. There's no need to waste CPU and GPU resources downloading and uploading files. Compute nodes should run conversion or otherwise be shut down.

The other difference is if a client with ephemeral disk fails, we need to download the file again which is sometimes fine, but other times expensive. BeeGFS with E-Series uses protected storage (RAID6, for example) and BeeGFS storage service is highly available, so failures can be handled with ease - failed download or upload job would be retired elsewhere.

Our transcode job is configured to run in a batch-style task group that balances jobs across clients on two floors. 

![Parametric task group on Nomad with BeeGFS](/assets/images/nomad-batch-scaleout-beegfs-eseries-02-transcode.png)

Individual jobs are then submitted to this task group (called transcode) from the CLI, via the API, from the Nomad Web interface. Let's say I needed a high resolution video for social media and a lower resolution preview for administrative approval.

```
$ nomad job dispatch -detach \ 
    -meta profile="large" \
    -meta input="/mnt/beegfs/nomad/transcode/beegfs-csi-k8s.mp4" transcode
$ nomad job dispatch -detach \
    -meta profile="small" \
    -meta input="/mnt/beegfs/nomad/transcode/beegfs-csi-k8s.mp4" transcode
```

Some may wonder how do we find the right file name. You could get it from SSH shell on a client, but normally you'd get it from a workflow application somewhere in your environment. The same application could dispatch these jobs for you without you doing it manually, as it's common in media workflows.

Individual jobs are sent and processed on one of the available nodes from this gruop. Although, due to the fact that in my small environment node b5 was both Client and Server and I could have only 2-3 conversion jobs running at the same time, most jobs would go to the other client (b6).

![Parametric job runs on Nomad with BeeGFS](/assets/images/nomad-batch-scaleout-beegfs-eseries-05-transcode-jobs.png)

I've added a twist to this process. Rather than just convert the file, which I already did in the non-scale-out demo, I added SRT streaming upon job completion.

What that gives me is the ability to review a job in real-time. In a situation where hardware or network resources are limited this could be effective for lower quality content.

In any case, here's how that looked in practice:

- Run a job, check where it was dispatched (e.g. b6, which is 192.168.1.196)
- Open Network Stream from the player on the client to be ready
- As soon as media conversion is done, SRT begins to stream content which may be viewed in video player (if it's running and connected)

![Parametric media conversion and SRT steam with Nomad and BeeGFS](/assets/images/nomad-batch-scaleout-beegfs-eseries-09-srt-streaming.png)

In comparison, that simple approach that uses S3 (mentioned earlier) first downloads input file, then renders the file locally, and then uploads the converted files to S3. To view a converted file, we'd need to wait until it's uploaded and then play it from the S3 bucket which may involve additional wait and incur egress charges. Of course, professional media workflows that us S3 have additional tricks in their sleeve. My point is that basic or naive DIY approaches can become complicated or expensive at scale.

One thing I like about this workflow is if you don't have a player that's has that SRT stream open, no bandwidth will be consumed.

There are many ways to make this better, one of which is we could open video player and connect to SRT stream automatically, depending on job parameters (preview=True).

What can be further improved, though, is preview, download and upload of large media files. For that I built anther demo.

## Getting the files out (or in)

I use SRT to transfer files independently of conversion. This part may feel a bit fake, but this is a PoC so it's simple. Obviously, real life use cases have authentication and authorization and such transfer may be exposed only on private network, while more traditional Web based services or S3 may be used in general upload and download workflows.

But even this basic process showcases advantages of Nomad with BeeGFS and E-Series:

- Pick a file name you want to download
- Submit file transfer batch job to Nomad
- On the remote client, start file download 

This could be done better and offer a choice of download protocols (HTTPS, SRT, etc.). 

But this could be used by an astronomer trying to get a high resolution video for local viewing.

Similarly to transcoding, we submit a job that takes some parameters such as the path and file name (example: /mnt/beegfs/nomad/transcode/out-16a44ad493d264909b1ffea8b5445e03-large.mp4). I could have used more descriptive file names in transcoding, but then I'd have to devise a naming convention for input files so I just kept this checksum-based output file names.

![SRT file transfer submission](/assets/images/nomad-batch-scaleout-beegfs-eseries-10-srt-file-transfer-submit.png)

After job has been submitted we check where to (`b6`) and run a client-side script (such as "./download.sh b6 out-16a44ad493d264909b1ffea8b5445e03-large.mp4"). This can be automated, but I haven't done it.

![Running SRT file transfer batch job](/assets/images/nomad-batch-scaleout-beegfs-eseries-07-srt-file-send.png)

This screenshot below is repetitive and from another job, but I had to re-run this and capture it with client-side (shell) output.

![When seconds matter, SRT takes less than one second](/assets/images/nomad-batch-scaleout-beegfs-eseries-08-srt-file-receive-done.png)

Abbreviated shell output for easier viewing:

```sh

$ bash srt-get.sh
Source connected (caller), id []
Writing output to [/home/sean/Temp/srt/./out-16a44ad493d264909b1ffea8b5445e03-large.mp4]
Connection closed, reading buffer remains
Download COMPLETE.

$ du -sh /home/sean/Temp/srt/./out-16a44ad493d264909b1ffea8b5445e03-large.mp4 
42M	/home/sean/Temp/srt/./out-16a44ad493d264909b1ffea8b5445e03-large.mp4
```

My client was on the same 1GigE L2 network as BeeGFS client, but data was transferred from a BeeGFS client VM running on another physical host to my notebook and it took 1 second to download that 42 MB file. Later I tried larger files and got about 87 MB/s which is slower than S3, but I wonder if SRT may be better over larger distances and lossy networks.

```sh
----system---- -net/total- -dsk/total-
     time     | recv  send| read  writ
24-04 06:23:18|3705B 4161B|   0     0 
24-04 06:23:19| 490B  646B|   0     0 
24-04 06:23:20|  42M   44M|   0     0 
24-04 06:23:21|2114B 4100B|   0    56k
```

The same could be done for file uploads *to* BeeGFS. And it can be done at scale - the combined ingress and egress speed can be many gigabytes per second.

![Nomad scale-out batch job farm with BeeGFS and E-Series](/assets/images/nomad-batch-scaleout-beegfs-eseries-11-batch-job-farm.png)

## Summary

As I concluded in the non-scaleout post on the same topic, there are highly specialized job schedulers that are unbeatable for certain workloads or verticals, but there are also plenty of DIY workflows built in-house on outdated technology from 20 years ago.

They're slow, limited, hard to maintain and can't cater to new workloads. Often they also use storage or workflows that are too slow or perform data copying that could be avoided with BeeGFS and E-Series. 

Such worklaods can be moved to Nomad with BeeGFS and E-Series in days, and expanded to host not just batch jobs, but also rescue struggling containerization and virtualization efforts.

## Demo

- [Scaling-out IO-intensive batch jobs with HashiCorp Nomad, ThinkParQ BeeGFS, and NetApp E-Series](https://rumble.com/v12vy7f-scaling-out-io-intensive-parametrized-jobs-with-nomad-and-beegfs.html) - 4m03s
