# Role of SolidFire networks in SolidFire storage replication

Which network(s) is/are used for SolidFire storage replication

Everyone should get the hard-to-find [TR-4741](https://www.netapp.com/pdf.html?item=/media/10607-tr4741.pdf) (NetApp Element Software Remote Replication), but to answer the simple question: "all of the above".

- Management network is used for management traffic
- Storage (iSCSI) network is used for storage traffic (including storage replication traffic)

Similarly to what I did in [this post](/2021/05/19/solidfire-exporter-monitor-solidfire-network-interfaces-with-prometheus-and-grafana), I configured `solidfire-exporter` to watch a replication Target cluster's network traffic on Management and iSCSI interfaces.

This cluster, called `thin`, was a replication Target for another SolidFire singleton cluster, called `thick`.

I paired the clusters, created two equally sized volumes (2GB, one on each cluster), set the one on `thin` to be Replication Target, paired the volumes for asynchronous replication, and used a Linux client to perform I/O to the volume on the Source cluster (`thick`).

I wanted to see which type of traffic - Management or Storage - will increase on the cluster hosting *the Replication Target* volume when bursts of I/O activity happen on the cluster hosting the Replication Source volume. (The image may be open in new tab.)

![SolidFire node NICs during replication](/assets/images/solidfire-replication-iscsi-vs-mgmt.png)

As you can see, traffic peaks on the storage network were significant. Three `fio` runs resulted in three pronounced peaks seen in the chart on the right.

However, the management network is still used, and must be redundant (and its traffic cannot fail-over to storage network).

## Demo

- [Management and Storage network traffic resulting from async replication](https://youtu.be/F3lqv-PLXLM) (2m31s)
