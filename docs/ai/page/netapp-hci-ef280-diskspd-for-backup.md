# DiskSpd performance from NetApp HCI VM to EF280

Backup workload with single VM on NetApp H615C compute node attached to EF280

- [Summary](#summary)
- [Why test EF280 performance from a VM](#why-test-ef280-performance-from-a-vm)
	- [VMFS vs. Raw Devices](#vmfs-vs-raw-devices)
	- [Manageability and iSCSI](#manageability-and-iscsi)
- [Cost of an All Flash backup tier](#cost-of-an-all-flash-backup-tier)
- [Reference](#reference)
- [Appendix: Configuration and DiskSpd logs](#appendix-configuration-and-diskspd-logs)
	- [NTFS striped over two VMDK/Datastores](#ntfs-striped-over-two-vmdkdatastores)
	- [ReFS on Raw Device](#refs-on-raw-device)
	- [ReFS Striped across four Raw Devices](#refs-striped-across-four-raw-devices)

## Summary

- VM running on a NetApp HCI compute node can get about 1 GB/s sequential throughput to/from a Datastore or Raw Device on EF280, making it an effective primary backup storage target
- Per-filesystem (NTFS, ReFS) and per-workload performance can be doubled by striping across Datastores or Raw Devices
- Users who want even more performance can use RAID10 for selected volumes (tests in this post were performed with DDP, a RAID 6-like data protection schema from NetApp E/EF Series arrays)
- Aggregate backup and restore throughput can be increased by using multiple backup repositories (see my earlier [post on iSCSI vs. FC](https://scaleoutsean.github.io/2020/12/05/iscsi-vs-fibre-channel-fc-performance.html) or NetApp EF-Series [data sheet](https://www.netapp.com/pdf.html?item=/media/19339-DS-4082.pdf) to get an idea of potential upper limits) and multiple backup servers

## Why test EF280 performance from a VM

By simply reading the EF-Series data sheet we can tell the current lineup of all-flash models can deliver multiple GB/s. But what about VMware environments? What about the performance we can expect from a *single* VM?

Such information is hard to find and I get the feeling that nobody wants to tests that because you know you'll probably get less than you get with a bare metal server (sometimes you can get more performance from a virtualized environment, but that is rare). So if I wanted to demonstrate storage performance, I wouldn't test the performance of a single VM with modest CPU and RAM resources. The other reason may be that E/EF Series are quite usually used with workloads where performance is top priority, and that doesn't mean Virtual Machines.

I think there's a lot of value in knowing how much you can get from a single VM because not everyone runs bare metal servers, or wants (needs) to max out their storage. Sometimes people just want to know "is one VM-based Backup Server with EF280 (50 TB usable) enough to perform a Full Backup of my NetApp HCI storage (100 TB effective) in under 36 hours?" or something like that. 100 TB over 36 hours is 770 MB/s, so if you knew a VM can write to EF280 at 1 GB/s you'd get a pretty good idea as to whether that's doable or not.

Last year I did a video with Veeam parallel backup using a NetApp HCI cluster attached to an E2800 array (EF2800 is a hybrid version of EF280; I had access to an HDD-only configuration with iSCSI interfaces) in which I got around 700-800 MB/s full backup performance with four Veeam proxy VMs. But I wasn't happy about that test because the environment had some problems that were outside of my control. (That video can be viewed [here](https://www.youtube.com/watch?v=SCzk3ZpfT-Y), if you're interested.)

This time I had access to a non-retail version of NetApp HCI H615C server (equipped with a FC HBA), but none of the tests needed more than 1 x 25G throughput so I think I would have obtained similar results with iSCSI.

I performed four groups of DiskSpd tests with that H615C attached to EF280 (24 SSDs, DDP data protection):

a) Striped NTFS volume (8kB block size, striped across two VMDKs, each on a separate ESXi Datastore/EF280 volume)

b) ReFS (64kB block size, single raw device on EF280)

c) Striped ReFS volume (64kB block size, striped across 4 raw devices, each a separate EF280 volume)

d) [non-DiskSpd test] ReFS read performance (restore native, non-compressed SQL Server backup to SQL Server 2019 with database residing on the NTFS striped volume from (a) above)

No tuning whatsoever was performed for these tests.

I think the results show that a VM connected to EF280 can easily deliver 1 GB/s Full Backup performance to a single Datastore, and more with multiple Datastores (or Raw Devices). That means you can easily take a Full Backup of 86.4 TB in one day, and (for example) twice as much assuming 2x compression of backup data.

Restore (test (d)) demonstrates that Restore performance - even with Target on the same array - can be twice as fast as Full Backup. Assuming you could restore to your production NetApp HCI at 2 GB/s (the smallest, 2-storage node NetApp HCI cluster, can't do that), you could restore 86.4 TB in 12 hours.

### VMFS vs. Raw Devices

I got similar Full Backup performance to and from VMDK/Datastore and Raw Devices, so I wouldn't consider using Raw Devices just for the sake of performance.

But if you have a single VM or application that's very large and has to be backed up (or restored) as quickly as possible, you could back it up to (and restore from) a striped volume located either on VMware Datastores or Raw Devices.

Test (d), for which I don't have logs so I'll explain it here, demonstrates that.

- SQL Server 2019 native backup file (75 GB) on striped ReFS volume (4 raw devices on EF280)
- SQL Server (Data on 2-volume striped NTFS; 2 VMDKs are on 2 Datastores, also on EF280)

![Restore Performance from 4-volume striped ReFS to 2-volume striped NTFS on EF280](/assets/images/ef280-vm-restore-performance-striped-refs.png)

Even with restore Target on the same EF280, we could restore SQL database at 1.6 GB/s and have the entire database up and running in only 45 seconds. Even with iSCSI (all the H615C models come with 2 x 25G), a H615C-based VM could read data from EF280 at 2 GB/s and send it out to a SQL Server VM at 2 GB/s. It's pretty cool that you can do a full restore of a 100 GB database just as fast as it'd take to recover it from a snapshot (assuming it takes 30 seconds to unmount and 30 seconds to mount the volume where snapshot is being restored)!

One significant factor for VMFS vs. Raw Devices is resilience and recoverability: if you want to be able to restore when VMware is down, consider using physical Raw Devices.

### Manageability and iSCSI

Raw Devices make backup VM and data less dependent on VMware (should you need to restore either your Backup application or access its data).

In the case of retail H615C or H410C units (which consume iSCSI, rather than FC HBA block storage), you'd probably want to connect your backup VM(s) to EF280 controllers via iSCSI (pRDM), so that there's no dependency on vSphere. This is in the case you need to restore the VMware cluster itself. You could also make an OS backup of your Backup VM to EF-Series, in the case you needed to restore Backup OS (CommVault, Rubrik, Veeam, or other) to a bare metal environment.

NetApp HCI needs two compute nodes to be reinstalled with NetApp Deployment Engine, so if you had at least three H615C (Compute Nodes) and lost the entire vSphere cluster, you could do this:

- Manually deploy the first ESXi to one of the H615C servers using ESXi ISO and then restore Backup OS (VM) to it
- Deploy NetApp HCI and vSphere to the rest of H615C servers using NetApp Deployment Engine
- Use Backup OS/VM to restore VM data from a EF280-based Backup Repository, then shut down Backup OS and copy the VM to NetApp HCI vSphere cluster you just recovered (remember to remove any CD-ROM from VM configuration beforehand and attach its NICs to the right VSS/VDS networks after that)
- Add the last H615C (which you installed manually from ESXi ISO) to vSphere with NDE, which will re-install ESXi and configure this node to be consistent with the rest of NetApp HCI compute nodes

This sounds complicated, but it's a worst case scenario and sounds easier than dealing with HCI clusters which store backup data on the same HCI cluster - while backups may be on dedicated disk pool, if the entire HCI cluster fails it won't be pretty. 

A simpler way may be to stand up a new OS (even ESXi) and restore Backup VM configuration from your backup application's configuration backup.

## Cost of an All Flash backup tier

All Flash arrays cost more than HDD or Hybrid arrays, but have Backup & Restore-related features that arrays with HDDs simply cannot deliver:

- If your production environment is sized for All Flash storage performance, you need to run Live/Instant VM recovery at All Flash speeds
- If you don't need to instant fail-over for same-site storage recovery, EF280 (or EF300, EF570) can serve as temporary production storage - you need just enough capacity to restore critical workloads and present those volumes to hypervisors
- Compression and deduplication built into backup software can be effective with All Flash backup storage
- EF-Series can offer enough random and sequential performance to economically host other workloads that need a lot of performance and don't require a lot of storage features (such as SIEM and other Log Management and Analytics)

While modern backup software can backup data directly to object storage (whether it's NetApp StorageGRID S3 storage or object storage in Public Cloud), smaller environments don't necessarily have fast on-premises object storage and can't get retrieve backup data from Public Cloud S3 at more than 10-50 MB/s, both of which result in a slow access to full backup data. That is why most users store at least one full backup of critical data on-premises while the rest can be encrypted and tiered off to local or public S3 storage.

## Reference

1) [Veeam KB 2014](https://www.veeam.com/kb2014)

2) [Video demo: DiskSPd Performance from H615C VM to EF280](https://youtu.be/aGIsypwzgyQ)

## Appendix: Configuration and DiskSpd logs

- VM: Windows 2019, 8 vCPU, 12 GB RAM
- Host:
  - H615C (2 x Xeon Gold 6242, 512 GB RAM)
  - ESXi 6.5U3
- Storage: EF280 (24 x SSD, DDP)

Each configuration was subjected to three tests designed to simulate:

- Active full or forward incremental - 100% sequential write
- Reverse incremental - 67% write, 4kB reads
- Transforms, merges, and other synthetic operations - 50% write, 4kB reads

Data set size was 64 GB (larger than EF280 controller cache). DiskSpd uses non-cached IO which effectively disables VM caching.

The second and third test penalize striped RAID configurations and DDP is a variant of that, so if you needed more performance from certain repositories you could consider using RAID 10 for those (the cost is lower usable capacity vs. DDP) and DDP for the rest.

### NTFS striped over two VMDK/Datastores

- Striped NTFS (8kB block size, two VMDKs, each VMDK on a separate Datastore (VMFS6); results were approximately 2x of a single-VMDK, non-striped NTFS - as expected)
- Active full test:

```raw
Command Line: diskspd.exe -c64G -b512K -w100 -Sh -d300 f:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'f:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing write test
		block size: 524288
		using sequential I/O (stride: 524288)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:29:54 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  15.95%|   0.29%|   15.66%|  84.05%
   1|   0.16%|   0.09%|    0.07%|  99.84%
   2|   0.12%|   0.07%|    0.05%|  99.88%
   3|   0.06%|   0.04%|    0.02%|  99.94%
   4|   0.07%|   0.04%|    0.04%|  99.93%
   5|   0.10%|   0.07%|    0.03%|  99.90%
   6|   0.05%|   0.05%|    0.00%|  99.95%
   7|   0.09%|   0.05%|    0.04%|  99.91%
-------------------------------------------
avg.|   2.08%|   0.09%|    1.99%|  97.92%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    546043330560 |      1041495 |    1735.77 |    3471.55 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      546043330560 |      1041495 |    1735.77 |    3471.55

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |               0 |            0 |       0.00 |       0.00 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:                 0 |            0 |       0.00 |       0.00

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    546043330560 |      1041495 |    1735.77 |    3471.55 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      546043330560 |      1041495 |    1735.77 |    3471.55

```

- Reverse incremental test:

```raw

Command Line: diskspd.exe -c64G -b512K -w67 -r4K -Sh -d300 f:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'f:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 33/67)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:35:07 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  12.96%|   0.19%|   12.78%|  87.04%
   1|   0.07%|   0.02%|    0.05%|  99.93%
   2|   0.03%|   0.02%|    0.01%|  99.97%
   3|   0.10%|   0.09%|    0.01%|  99.90%
   4|   0.01%|   0.01%|    0.01%|  99.99%
   5|   0.09%|   0.07%|    0.02%|  99.91%
   6|   0.09%|   0.08%|    0.02%|  99.91%
   7|   0.08%|   0.06%|    0.02%|  99.92%
-------------------------------------------
avg.|   1.68%|   0.07%|    1.61%|  98.32%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    397002407936 |       757222 |    1261.99 |    2523.98 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      397002407936 |       757222 |    1261.99 |    2523.98

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    130902130688 |       249676 |     416.11 |     832.22 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      130902130688 |       249676 |     416.11 |     832.22

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    266100277248 |       507546 |     845.88 |    1691.76 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      266100277248 |       507546 |     845.88 |    1691.76

```

- Synthetic operations test:

```raw

Command Line: diskspd.exe -c64G -b512K -w50 -r4K -Sh -d300 f:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'f:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 50/50)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:40:12 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.00s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  13.64%|   0.22%|   13.42%|  86.36%
   1|   0.10%|   0.05%|    0.05%|  99.90%
   2|   0.04%|   0.03%|    0.01%|  99.96%
   3|   0.12%|   0.08%|    0.04%|  99.88%
   4|   0.06%|   0.02%|    0.04%|  99.94%
   5|   0.05%|   0.02%|    0.03%|  99.95%
   6|   0.11%|   0.09%|    0.02%|  99.89%
   7|   0.06%|   0.02%|    0.04%|  99.94%
-------------------------------------------
avg.|   1.77%|   0.07%|    1.71%|  98.23%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    421741461504 |       804408 |    1340.67 |    2681.35 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      421741461504 |       804408 |    1340.67 |    2681.35

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    210529419264 |       401553 |     669.25 |    1338.50 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      210529419264 |       401553 |     669.25 |    1338.50

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    211212042240 |       402855 |     671.42 |    1342.84 | f:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      211212042240 |       402855 |     671.42 |    1342.84

```

### ReFS on Raw Device

Both ReFS tests used the Veeam-recommended 64kB block size.

- Active full test:

```raw

Command Line: diskspd.exe -c64G -b512K -w100 -Sh -d300 g:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'g:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing write test
		block size: 524288
		using sequential I/O (stride: 524288)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:47:18 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|   7.96%|   0.27%|    7.69%|  92.04%
   1|   0.30%|   0.03%|    0.27%|  99.70%
   2|   0.45%|   0.04%|    0.41%|  99.55%
   3|   0.07%|   0.05%|    0.02%|  99.93%
   4|   0.73%|   0.01%|    0.72%|  99.27%
   5|   0.48%|   0.02%|    0.46%|  99.52%
   6|   0.49%|   0.05%|    0.45%|  99.51%
   7|   0.07%|   0.02%|    0.05%|  99.93%
-------------------------------------------
avg.|   1.32%|   0.06%|    1.26%|  98.68%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    329091907584 |       627693 |    1046.12 |    2092.24 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      329091907584 |       627693 |    1046.12 |    2092.24

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |               0 |            0 |       0.00 |       0.00 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:                 0 |            0 |       0.00 |       0.00

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    329091907584 |       627693 |    1046.12 |    2092.24 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      329091907584 |       627693 |    1046.12 |    2092.24

```

- Reverse incremental test:

```raw

Command Line: diskspd.exe -c64G -b512K -w67 -r4K -Sh -d300 g:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'g:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 33/67)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:52:28 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|   4.62%|   0.15%|    4.47%|  95.38%
   1|   0.09%|   0.03%|    0.06%|  99.91%
   2|   0.09%|   0.03%|    0.06%|  99.91%
   3|   0.10%|   0.08%|    0.02%|  99.90%
   4|   0.15%|   0.05%|    0.10%|  99.85%
   5|   0.19%|   0.02%|    0.17%|  99.81%
   6|   0.19%|   0.08%|    0.10%|  99.81%
   7|   0.08%|   0.06%|    0.02%|  99.92%
-------------------------------------------
avg.|   0.69%|   0.06%|    0.63%|  99.31%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    293183946752 |       559204 |     931.96 |    1863.92 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      293183946752 |       559204 |     931.96 |    1863.92

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |     96698630144 |       184438 |     307.38 |     614.76 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:       96698630144 |       184438 |     307.38 |     614.76

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    196485316608 |       374766 |     624.58 |    1249.16 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      196485316608 |       374766 |     624.58 |    1249.16

```

- Synthetic operations test:

```raw

Command Line: diskspd.exe -c64G -b512K -w50 -r4K -Sh -d300 g:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 'g:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 50/50)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 16:57:38 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|   4.86%|   0.15%|    4.71%|  95.14%
   1|   0.16%|   0.08%|    0.08%|  99.84%
   2|   0.07%|   0.02%|    0.05%|  99.93%
   3|   0.07%|   0.04%|    0.03%|  99.93%
   4|   0.16%|   0.06%|    0.10%|  99.84%
   5|   0.17%|   0.03%|    0.14%|  99.83%
   6|   0.17%|   0.06%|    0.11%|  99.83%
   7|   0.10%|   0.07%|    0.03%|  99.90%
-------------------------------------------
avg.|   0.72%|   0.06%|    0.66%|  99.28%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    293312921600 |       559450 |     932.39 |    1864.77 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      293312921600 |       559450 |     932.39 |    1864.77

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    146432065536 |       279297 |     465.48 |     930.96 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      146432065536 |       279297 |     465.48 |     930.96

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    146880856064 |       280153 |     466.91 |     933.81 | g:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      146880856064 |       280153 |     466.91 |     933.81

```

### ReFS Striped across four Raw Devices

- Active full test:

```raw

Command Line: diskspd.exe -c64G -b512K -w100 -Sh -d300 s:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 's:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing write test
		block size: 524288
		using sequential I/O (stride: 524288)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 17:04:44 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  17.43%|   0.28%|   17.15%|  82.57%
   1|   0.07%|   0.04%|    0.04%|  99.93%
   2|   0.03%|   0.01%|    0.02%|  99.97%
   3|   0.07%|   0.06%|    0.02%|  99.93%
   4|   0.07%|   0.05%|    0.02%|  99.93%
   5|   0.05%|   0.04%|    0.02%|  99.95%
   6|   0.06%|   0.05%|    0.01%|  99.94%
   7|   0.06%|   0.05%|    0.02%|  99.94%
-------------------------------------------
avg.|   2.23%|   0.07%|    2.16%|  97.77%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    543439716352 |      1036529 |    1727.48 |    3454.95 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      543439716352 |      1036529 |    1727.48 |    3454.95

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |               0 |            0 |       0.00 |       0.00 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:                 0 |            0 |       0.00 |       0.00

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    543439716352 |      1036529 |    1727.48 |    3454.95 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      543439716352 |      1036529 |    1727.48 |    3454.95

```

- Reverse incremental test:

```raw

Command Line: diskspd.exe -c64G -b512K -w67 -r4K -Sh -d300 s:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 's:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 33/67)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 17:09:54 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  11.28%|   0.18%|   11.10%|  88.72%
   1|   0.08%|   0.06%|    0.02%|  99.92%
   2|   0.05%|   0.02%|    0.03%|  99.95%
   3|   0.04%|   0.03%|    0.01%|  99.96%
   4|   0.09%|   0.03%|    0.07%|  99.91%
   5|   0.15%|   0.07%|    0.08%|  99.85%
   6|   0.09%|   0.04%|    0.05%|  99.91%
   7|   0.06%|   0.03%|    0.03%|  99.94%
-------------------------------------------
avg.|   1.48%|   0.06%|    1.42%|  98.52%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    320632520704 |       611558 |    1019.21 |    2038.43 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      320632520704 |       611558 |    1019.21 |    2038.43

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    105749938176 |       201702 |     336.15 |     672.31 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      105749938176 |       201702 |     336.15 |     672.31

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    214882582528 |       409856 |     683.06 |    1366.12 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      214882582528 |       409856 |     683.06 |    1366.12

```

- Synthetic operations test:

```raw

Command Line: diskspd.exe -c64G -b512K -w50 -r4K -Sh -d300 s:\veeamTest.dat

Input parameters:

	timespan:   1
	-------------
	duration: 300s
	warm up time: 5s
	cool down time: 0s
	random seed: 0
	path: 's:\veeamTest.dat'
		think time: 0ms
		burst size: 0
		software cache disabled
		hardware write cache disabled, writethrough on
		performing mix test (read/write ratio: 50/50)
		block size: 524288
		using random I/O (alignment: 4096)
		number of outstanding I/O operations: 2
		thread stride size: 0
		threads per file: 1
		using I/O Completion Ports
		IO priority: normal

System information:

	computer name: ads
	start time: 2020/12/29 17:15:04 UTC

Results for timespan 1:
*******************************************************************************

actual test time:	300.01s
thread count:		1
proc count:		8

CPU |  Usage |  User  |  Kernel |  Idle
-------------------------------------------
   0|  12.95%|   0.20%|   12.74%|  87.05%
   1|   0.09%|   0.06%|    0.03%|  99.91%
   2|   0.06%|   0.01%|    0.06%|  99.94%
   3|   0.02%|   0.02%|    0.01%|  99.98%
   4|   0.07%|   0.03%|    0.04%|  99.93%
   5|   0.12%|   0.05%|    0.07%|  99.88%
   6|   0.11%|   0.08%|    0.03%|  99.89%
   7|   0.04%|   0.01%|    0.03%|  99.96%
-------------------------------------------
avg.|   1.68%|   0.06%|    1.62%|  98.32%

Total IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    351124586496 |       669717 |    1116.17 |    2232.34 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      351124586496 |       669717 |    1116.17 |    2232.34

Read IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    175319285760 |       334395 |     557.31 |    1114.62 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      175319285760 |       334395 |     557.31 |    1114.62

Write IO
thread |       bytes     |     I/Os     |    MiB/s   |  I/O per s |  file
------------------------------------------------------------------------------
     0 |    175805300736 |       335322 |     558.86 |    1117.71 | s:\veeamTest.dat (64GiB)
------------------------------------------------------------------------------
total:      175805300736 |       335322 |     558.86 |    1117.71

```
