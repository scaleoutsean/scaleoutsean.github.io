# Nomad batch jobs with BeeGFS and E-Series

IO-intensive Nomad batch jobs on an E-Series-backed BeeGFS Host Volume

- [Introduction](#introduction)
- [Setup](#setup)
- [Generic batch job with I/O to parallel filesystem](#generic-batch-job-with-io-to-parallel-filesystem)
- [File format conversion](#file-format-conversion)
- [Summary](#summary)
- [Demo](#demo)

## Introduction

When I wrote about [HashiCorp Nomad with NetApp SolidFire](/2022/03/23/nomad-solidfire-hostpath-volumes.html) last week I mentioned how BeeGFS CSI with NetApp E-Series is of to-do items.

This post isn't about CSI, but an intermediate step. 

Now, there are many batch job schedulers out there. Some are HPC-focused and extremely good for that use case. 

But there are non-HPC use cases for BeeGFS, such as - for the sake of an example - data cleansing, video conversion and even backups (we could run [Restic backup](/2022/04/03/restic-server-netapp-eseries.html) jobs for generic hosts and containers using Nomad).

Some folks must use workflows specific to their organization or solution, but sometimes they can be initiated from another system, and other times they're still executed the old way (crontab-driven shell scripts?).

BeeGFS with E-Series provides extreme scale-out in terms of performance and number of files.

As noted in the first Nomad post, HashiCorp Nomad can schedule batch jobs, containers, VMs and more. It can also allocate desired resources to each job.

The other point I made is we don't always need CSI storage (and I am not saying this because I haven't done it yet!). 

## Setup

These simple example is about running such jobs at a high speed. Normally we'd have multiple clients, but here I have just one.

- BeeGFS cluster (VMs)
  - b1 - manager
  - b2 - metadata server
  - b3 - storage node 1
  - b4 - storage node 2
  - b5 - BeeGFS and Nomad client
- Nomad servers (VM)
  - es1 
- Parallel filesystem
  - BeeGFS mounted at /mnt/beegfs on BeeGFS client (b5)
- Block storage
  - NetApp E-Series 5760

On Nomad client with BeeGFS, configure Host Volume that points to a BeeGFS mount point or its subdirectory (e.g. /mnt/beegfs/nomad-mysql). beegfs-ctl gives us a view of our BeeGFS cluster. 

```sh
$ sudo beegfs-ctl --listnodes --nodetype=meta
b2 [ID: 1]
$ sudo beegfs-ctl --listnodes --nodetype=storage
b3 [ID: 3]
b4 [ID: 4]
$ beegfs-ctl --listnodes --nodetype=client
A83C-624BAFAC-b5 [ID: 101]
```

Visually:

![Nomad with BeeGFS and E-Series](/assets/images/nomad-batch-beegfs-eseries.png)

## Generic batch job with I/O to parallel filesystem

On Nomad server, create a batch task such as this:

```sh
    task "script"{
    driver = "raw_exec"
    config {
      command = "/usr/bin/fio"
      args = ["/mnt/beegfs/nomad-mysql/fio.txt"]
      }
    }
```

I currently have just one BeeGFS client, but with multiple BeeGFS/Nomad clients this job would be scheduled *to any* BeeGFS client with the same Host Volume. In fact - because BeeGFS is a *parallel* file system - you could schedule jobs on several clients at once (for example, N jobs that process 1/N-th of the input file each).

And - as demonstrated in the [post about NetApp HCI with BeeGFS VMs on EF280 array](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html#performance) - this gives you the ability to run such jobs at multiple [GB/s per second per job](https://www.beegfs.io/c/beegfs-now-supports-nvidia-magnum-io-gpu/).

```sh
$ nomad job run batch.nomad 
==> 2022-04-05T05:09:55Z: Monitoring evaluation "17e84b74"
    2022-04-05T05:09:55Z: Evaluation triggered by job "batch"
    2022-04-05T05:09:55Z: Allocation "4293eab4" created: node "71a25827", group "example"
==> 2022-04-05T05:09:56Z: Monitoring evaluation "17e84b74"
    2022-04-05T05:09:56Z: Allocation "4293eab4" status changed: "pending" -> "running" (Tasks are running)
    2022-04-05T05:09:56Z: Evaluation status changed: "pending" -> "complete"
==> 2022-04-05T05:09:56Z: Evaluation "17e84b74" finished with status "complete"
```

It took 1 second to complete this job.

Job output is a 500 MiB file (rand-read.0.0). Although the workload was read-only, the file was created anew when the job executed.

```sh
$ sudo dir -lat /mnt/beegfs/nomad-mysql/
total 512002
-rw-r--r-- 1 nomad nomad 524288000 Apr  5 05:09 rand-read.0.0
drwxrwxr-x 2 nomad nomad         2 Apr  5 05:09 .
-rw-r--r-- 1 root  root        202 Apr  5 04:39 fio.txt
drwxrwxrwx 3 root  root          7 Apr  5 03:33 ..
```

BeeGFS client (b5) with a successfully completed batch job:

![BeeGFS/Nomad client](/assets/images/nomad-batch-beegfs-eseries-client.png)

Job overview:

![Completed batch job](/assets/images/nomad-batch-beegfs-eseries-job.png)

## File format conversion

Another example is video conversion - because recently somebody asked me about this. Our input is a video we want to convert to MP4.

```sh
$ ll
total 540906
drwxrwxr-x 2 nomad nomad         3 Apr  5 05:36 ./
drwxrwxrwx 3 root  root          7 Apr  5 03:33 ../
-rw-r--r-- 1 root  root        202 Apr  5 04:39 fio.txt
-rw-r--r-- 1 nomad nomad 524288000 Apr  5 05:09 rand-read.0.0
-rw-r--r-- 1 nomad nomad  29597941 Mar 29 16:13 sample_1280x720_surfing_with_audio.m2v
```

When job gets allocated to b5, it consumes CPU (as expected), but very little IO (because it's CPU-constrained).

```sh
$ dstat -tcn
----system---- --total-cpu-usage-- -net/total-
     time     |usr sys idl wai stl| recv  send
05-04 05:39:46|  1   1  98   0   0|   0     0 
05-04 05:39:47|100   0   0   0   0|1034k  261k
05-04 05:39:48|100   0   0   0   0| 868B  514k
05-04 05:39:49|100   0   0   0   0| 516k  958B
05-04 05:39:50| 99   1   0   0   0| 517k  514k
05-04 05:39:51| 99   0   1   0   0| 163k  514k
05-04 05:39:52|100   0   0   0   0| 517k 2658B
05-04 05:39:53| 99   1   0   0   0| 804B  514k
05-04 05:39:54|100   0   0   0   0| 516k  760B
```

Because this BeeGFS filesystem uses storage devices on both storage nodes (b3,b4), each has 50% of that IO activity.

```sh
----system---- --total-cpu-usage-- -net/total- -dsk/total-
     time     |usr sys idl wai stl| recv  send| read  writ
05-04 05:39:33|  1   0  99   0   0| 130B  110B|   0     0 
05-04 05:39:34|  0   0  99   1   0|  66B  118B|   0    20k
05-04 05:39:35|  1   0  99   0   0|1406B  513k|   0     0 
05-04 05:39:36|  0   0 100   0   0| 514k  161k|   0     0 
05-04 05:39:37|  0   0 100   0   0| 130B  110B|   0     0 
05-04 05:39:38|  0   0 100   0   0| 434B  282B|   0     0 
05-04 05:39:39|  0   0 100   0   0| 514k  513k|   0     0 
05-04 05:39:40|  0   0 100   0   0| 345B  110B|   0    20k
```

Output (MP4 file sample_1280x720_surfing_with_audio.mp4):

```sh
$ ll
total 547563
drwxrwxr-x 2 nomad nomad         3 Apr  5 05:39 ./
drwxrwxrwx 3 root  root          7 Apr  5 03:33 ../
-rw-r--r-- 1 root  root        202 Apr  5 04:39 fio.txt
-rw-r--r-- 1 nomad nomad 524288000 Apr  5 05:09 rand-read.0.0
-rw-r--r-- 1 nomad nomad  29597941 Mar 29 16:13 sample_1280x720_surfing_with_audio.m2v
-rw-r--r-- 1 nomad nomad   6815792 Apr  5 05:39 sample_1280x720_surfing_with_audio.mp4
```

I hard-coded video conversion parameters in the job (target resolution was smaller so the file name should have been sample_640x480...) - it's not something to write home about but it worked for the purpose of this demonstration.

## Summary

Nomad makes it easy to schedule all sorts of jobs on various platforms. Some may even be jobs that run in (say) DB VMs and require complex steps that can benefit from other Nomad features such as the ability to integrate with Vault to avoid hard-coded passwords in your scripts.

If you have a workflow that can benefit from a better scheduler, you could dispatch jobs to Nomad which would schedule them for you. 

You may be tempted to try Kubernetes and that's fine, but from a job scheduling perspective all you need is a single binary (nomad) that runs as server and client depending on its role. The entire setup for a VM-based cluster (provision and configure VMs, BeeGFS, Nomad clients and servers) - can be done in less than 20 minutes.

BeeGFS with E-Series gives you the ability to access data from any client - whether it's a VM, container, physical host - at a very high speed. Jobs in this post did not use Docker - I used the simplest approach, Nomad's generic exec driver (which has "isolate" option for better security if you need it).

BeeGFS CSI - a CSI-compatible driver for BeeGFS maintained by NetApp - is our next stop on this journey. BeeGFS CSI doesn't officially support Nomad (as of April 2022), but BeeGFS CSI driver should be able to work with Nomad CSI. More on that in next Nomad-related post. Until then, you may be interested in [BeeGFS CSI with Kubernetes](/2022/04/09/beegfs-csi-introduction.html).

## Demo

- [IO-intensive batch jobs with HashiCorp Nomad, ThinkParQ BeeGFS, and NetApp E-Series](https://rumble.com/vzrphv-hashicorp-nomad-batch-jobs-with-beegfs-and-netapp-e-series.html) - 3m6s
