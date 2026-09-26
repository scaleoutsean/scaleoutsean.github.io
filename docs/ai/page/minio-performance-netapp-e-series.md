# Notes on MinIO performance with NetApp E-Series

Performance-related notes on MinIO with E-Series

I've written about several ways we can take advantage of MinIO with NetApp E-Series back-ends, for example in the post on MinIO on HashiCorp Nomad with BeeGFS I show how BeeGFS/E-Series users can run MinIO to get S3 service without dedicated S3 appliances.

I haven't focused on performance because I don't have a place to run proper performance tests.

But I can run simple tests that may be representative enough.

This week I used a Rocky 9 server with Docker CE to run MinIO server *and* client, and check performance of single-server MinIO backed by the previous generation of all-flash E-Series, EF570.

- Single Linux server with Rocky Linux 9
- iSER (iSCSI over [RDMA](https://en.wikipedia.org/wiki/ISCSI_Extensions_for_RDMA))
- EF570 with less than 20 SAS SSDs (EF570 is not end-to-end NVMe) in a DDP with four R6-like 50G volumes created for MinIO
- No tuning whatsoever

In the case you're wondering "WTF is DDP", take a look [here](/2021/07/06/e-series-ddp-expansion-and-rebalancing.html).

MinIO volumes were four:

![Four volumes on E570 with DDP](/assets/images/minio-bench-01-e570-raid.png)

Mixed workload from one MinIO instance with four volumes achieves around 2.5 GB/s, while GET hits 4 GB/s.

![Mixed and Get Benchmark](/assets/images/minio-bench-02-mixed-get.png)

To test I used MinIO Warp and because the chart above is less precise than benchmark output, here's Warp output.

PUT test: ~2 GB/s (roughly; results are actually in MiB).

```sh
$ warp put --host=localhost:9000
Throughput 1877.7MiB/s within 7.500000% for 10.262s. Assuming stability. Terminating benchmark.
warp: Benchmark data written to "warp-put-2022-10-19[042848]-K9KP.csv.zst"
Operation: PUT
* Average: 1929.19 MiB/s, 192.92 obj/s

Throughput, split into 36 x 1s:
 * Fastest: 1992.9MiB/s, 199.29 obj/s
 * 50% Median: 1929.0MiB/s, 192.90 obj/s
 * Slowest: 1868.9MiB/s, 186.89 obj/s
```

GET test: ~4.5 GB/s.

```
$ warp get --host=localhost:9000
Throughput 4473.2MiB/s within 7.500000% for 10.024s. Assuming stability. Terminating benchmark.
Operation: GET
* Average: 4534.08 MiB/s, 453.41 obj/s

Throughput, split into 35 x 1s:
 * Fastest: 4697.6MiB/s, 469.76 obj/s
 * 50% Median: 4553.1MiB/s, 455.31 obj/s
 * Slowest: 4119.6MiB/s, 411.96 obj/s
```

Mixed test: ~3.7 GB/s.

```sh
$ warp mixed --host=localhost:9000
Throughput 187.6 objects/s within 7.500000% for 10.563s. Assuming stability. Terminating benchmark.
warp: Benchmark data written to "warp-mixed-2022-10-19[042630]-xqfm.csv.zst"
Mixed operations.
Operation: DELETE, 10%, Concurrency: 20, Ran 37s.
 * Throughput: 62.70 obj/s

Operation: GET, 45%, Concurrency: 20, Ran 37s.
 * Throughput: 2820.76 MiB/s, 282.08 obj/s

Operation: PUT, 15%, Concurrency: 20, Ran 37s.
 * Throughput: 940.87 MiB/s, 94.09 obj/s

Operation: STAT, 30%, Concurrency: 20, Ran 37s.
 * Throughput: 188.07 obj/s

Cluster Total: 3759.99 MiB/s, 626.56 obj/s over 38s.
```

I didn't run simple disk tests (without MinIO) to see if Rocky 9 host makes full use of storage performance, but that's also because that didn't interest me enough:

- Both S3 client (MinIO Warp) and server (MinIO server) were sharing resources from the same host
- I knew RAID6 (and DDP) won't let MinIO get "maximum" performance - for that I'd use RAID10 but I didn't have unused disks to try RAID10
- EF570 is no longer sold; for fastest performance with all-flash E-Series array we should consider EF600 which is much faster, or EF300 (in performance similar to EF570, but end-to-end NVMe)
- In summary: this is almost worst-case scenario

Why did I run these test, then?

These "worst case scenario" tests confirm earlier expectations that MinIO backed by E-Series performs fine even with RAID6-like volumes in DDP. DDP has a lower overhead and many users prefer it over RAID6 groups that on E-Series work best in 8D2P (10 disks) configuration. A DDP can have a lot more disks while getting similar performance and faster rebuilds.

It is likely that Warp Mixed workload test with four MinIO servers using the smaller of all-flash E-Series models (EF300) could hit >8GB/s PUT and >16GB/s GET. EF600 is twice as fast so we can probably attach 8-16 MinIO servers to it, depending in hardware (server and network) and software (TLS On/Off, EC, etc.) configuration and workload.

This lowers uncertainty when sizing for high-throughput use cases such as S3 archive tier for iRODS in a BeeGFS environment (I [blogged about that yesterday](/2022/10/20/beegfs-hsm-irods-robinhood.html)). Another use case may be "low cost S3 backup target" where we use NL-SAS-backed S3 to dump backups to E-Series and don't require non-essential features.

If I find time to evacuate data from that DDP, I'll also run tests  with RAID10 and RAID0 to see how they compare against DDP results provided above.

RAID0 isn't very useful, and although MinIO has Erasure Coding that when enabled can heal failed disks, most users I know prefer to not rely on RAID0 because failures cause a lot of network traffic - especially with NL-SAS storage - and increase burden on Operations. Still, I'm curious how it behaves compared to DDP and RAID10.

RAID1 (or RAID10, when 4 or more disks are involved) is more interesting than RAID0 because it gives us the opportunity to use more capacity to get a better performance and still avoid dealing with MinIO healing when any of physical disks fails.
