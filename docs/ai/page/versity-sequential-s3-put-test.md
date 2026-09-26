# Single-volume sequential PUT test with Versity S3 on BeeGFS

## Introduction

Two months ago I did a "sequential" GET test with Versity S3 Gateway on EF600. That post is [here](/2026/06/25/versity-sequential-s3-get-test.html).

I had better control over hardware, but not much of it, so the test was single-client-single-server-single-volume.

This time I had a chance to run a similar PUT test in another environment.

- Versity S3 Gateway server v1.7.0 on BeeGFS v8.4.0 client (serving data from `/mnt/beegfs/`)
- S3 client: Ubuntu 24.04 with latest MinIO Warp
- NVMe/RoCE network with wire throughput 16 GB/s (tested) between server and client

I wanted to see if results in this environment align with what I saw in the previous test.

## PUT

In order to GET, I had to PUT first, so I ran a PUT test (3 minutes).

This test went fine. I observed over 3 GiB/s with a single VGW client (standard S3).

![VGW on BeeGFS](/assets/images/vgw-beegfs-00-put.png)

I also tried S3/RDMA, but result was consistent with the [observations in the S3/RDMA post](/2026/08/08/versity-s3-rdma-with-netapp-eseries.html#appendix-c-additional-fiddling) - barely 1 GiB second as S3/RDMA backed by DRAM runs slowly due to the various overheads.

I know the S3 server (which is a BeeGFS client) can write to BeeGFS faster than 3 GiB/s, but this is a very nice result because it's just one instance of Versity S3 Gateway. We can run multiple if we need to, because any BeeGFS client can see the same BeeGFS data.

## GET 

I hit a "hardware problem" here - both S3 client and S3 server had 1TiB of RAM...

The read performance was ridiculous.

![VGW on BeeGFS](/assets/images/vgw-beegfs-01-put-and-get.png)

Another attempt after dropping OS cache on both S3 server and S3 client followed by an S3 service restart:

![VGW on BeeGFS](/assets/images/vgw-beegfs-02-get.png)

I think it was BeeGFS *server* that had data in cache and I couldn't restart this shared hardware.

Well, at least we know that, serving S3 from cache is close to wire speed, and this is without any tuning.

I even tried with a 4.5 TB data set and still couldn't get less. The most I got was 15.05 GiB/s.

I think all data came from some cache between EF80 and BeeGFS client because storage showed barely any disk read IO after write tests. There's just one tiny blip after the two large PUT tests.

![GET on in SANtricity UI](/assets/images/vgw-beegfs-03-storage.png)

I've no idea why I failed to see disk reads on storage even with a 4 TB data set, but I couldn't reboot servers or restart BeeGFS to investigate further.

## Bonus tests

I tried GDS (from the S3 client system to `/mnt/beegfs` it was mounting).

```sh
# /usr/local/cuda-13.2/gds/tools/gdsio -D /mnt/beegfs/sean/fio/ -w 8 -d 1 -I 1 -x 1 -s 16G -i 1M
IoType: WRITE XferType: CPUONLY Threads: 8 DataSetSize: 129411072/134217728(KiB) IOSize: 1024(KiB) Throughput: 9.677219 GiB/sec, Avg_Latency: 804.543220 usecs ops: 126378 total_time 12.753252 secs

# /usr/local/cuda-13.2/gds/tools/gdsio -D /mnt/beegfs/sean/fio/ -w 8 -d 1 -I 0 -x 1 -s 16G -i 1M
IoType: READ XferType: CPUONLY Threads: 8 DataSetSize: 131591168/134217728(KiB) IOSize: 1024(KiB) Throughput: 10.642912 GiB/sec, Avg_Latency: 734.074935 usecs ops: 128507 total_time 11.791427 secs
```

I also tried the NIXL benchmark. I got about 2 GiB/s with 4 MiB requests (standard S3). 

The same benchmark is currently outdated (pre-CuObject CUDA) but even updates it didn't work for S3/RDMA because it requires vendor-specific code which doesn't yet exist for Versity's S3/RDMA server. Only standard S3 worked.

## Conclusion

In the previous throughput test conducted in a different environment I got close to 5 GB/s in read throughput from a single client accessing Versity S3 Gateway sharing data from one XFS-formatted LUN. PUT test on that storage was affected due to a failed cache battery. 

With faster hardware and no hardware issues, I was able to get 3 GiB/s PUT from a similar configuration and - knowing I could get around 6 GiB/s with `fio` (single process, multi-threaded) read tests, I think I would have gotten over 5 GiB/s GET here as well if it wasn't for the caching effect.

In any case, the results seem consistent: the Versity S3 Gateway seems capable of 5 GiB/s GET and at least 3 GiB/s PUT throughput using MinIO Warp with the default 20 threads and an 8 MiB object size. 

If your workload can benefit from OS cache, you may be able to get a lot better read performance, as I've observed 12-15 GiB/s GET performance in this environment where wire speed was 16 GiB/s.
