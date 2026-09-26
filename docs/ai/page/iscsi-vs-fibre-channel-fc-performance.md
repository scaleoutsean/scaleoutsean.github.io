# How much slower is iSCSI vs. Fibre Channel

About iSCSI and iSCSI vs. FC performance with NetApp HCI H615C and EF280 array

If you search for "iSCSI vs FC performance" it's not easy to find a recent like-for-like comparison from enterprise vendors. I've been puzzled by this and I have some theories as to why, but regardless - the fact is there aren't that many comparisons out there.

Last time I looked really hard for such material from NetApp I found an old PDF with a comparison for ONTAP systems (FAS, at the time, if I recall correctly). I have this link in the Awesome SolidFire repository, but to save you time, FC was slightly faster (single digit percentage figure.) There's a nice [presentation](https://www.snia.org/sites/default/files/ESF/FC_vs_iSCSI_Jan2018_Final.pdf) with (only) protocol comparison over at SNIA, but it's vendor- and hardware-neutral, so you won't find specific examples for servers and storage you can buy today.

If you have an environment that supports or can support both FC and iSCSI protocols and have no strong opinion about going either way, you probably wonder about trade-offs in terms of cost and performance. Sometimes the cost is roughly the same and you just want more IOPS or throughput for the buck. Other times the cost is not a concern but you'd like to know if the array can deliver more than bare minimum required for your workload.

### NVA-1152-DESIGN

I sometimes work with NetApp E/EF-Series arrays and for a while now I've been waiting to find out how well it works with 25 GigE iSCSI, especially since NetApp has added Mellanox Ethernet switches to its solutions. That has finally happened in NetApp NVA-1152-DESIGN. In this document a NetApp HCI server and the EF280 all-flash array were tested to provide an idea of how these building blocks perform and for comparison purposes (NetApp HCI servers don't come with FC HBAs) FC was tested with the same server and array as iSCSI.

[NVA-1152-DESIGN](https://www.netapp.com/pdf.html?item=/media/21016-nva-1152-design.pdf) isn't long (just the way I like it!), so give it a quick look. It answers precisely that question.

In summary, iSCSI is **not** slower. iSCSI did well in both sequential and random performance. And depending on the way you calculate, some folks might say it's faster. How so? If you already have NetApp HCI for your VI and need to add a 5 GB/s workload to your environment, with iSCSI you don't have to buy FC switches and can use that money to buy a EF300 or two additional H615C servers, which would get you *more performance per dollar spent*. (In my opinion you'd also get better DevOps and automation integrations and one less protocol to deal with, which represents additional savings and/or value.)

![iSCSI vs FC Performance with NetApp HCI H615C and EF280](/assets/images/netapp-hci-ef-e-series-iscsi-vs-fc-nva-1152-design.png)

In these tests iSCSI was slower in sequential read performance but that's not unexpected - 2 x 25 GigE has less bandwidth than 4 x 16 Gbps used in the FC test (or 2 x 32 Gbps, if FC used 32 Gbps common these days.) If you need more performance per server with iSCSI, read on!

In the case you're not familiar with NetApp HCI compute node models ("H Series servers") all H615C models come with 2 x 25G and H410C has twice as many 25G NICs (4 x 25G; also 2 x 1/10G but those are usually used for Management), so if a higher sequential performance is desired it is possible to get it with one of the H-Series H410C models.

If we use one of the H410C models, even if we team (or "bond") only the 25G interfaces and use the remainder (2 x 1/10G) for management, that's still 100G of aggregate bandwidth for application & iSCSI workloads. And you can still use those systems in a NetApp HCI environment (you'd need VMware Distributed Switch to aggregate 4 x 25G) and avoid creating management islands, which you'd likely end up with if you were to have a HCI system for VI and another cluster for a "high throughput" application. Note that H410C models have several CPU configurations and - generally speaking - Xeon Gold CPUs with more cores tend to deliver better performance than Xeon Silver CPUs with fewer cores.

When I say "for application & iSCSI workload" I mean your application could consume up 50% of that network bandwidth (when data comes in from other applications and is written to storage at the same time), but it could also use 1% (when data is queried, a 10 byte JSON search query can result in 100 Gbps of iSCSI throughput with H410C & the EF300, for example.)

Which reminds me: if you need even more performance from your iSCSI array consider the latest mid-range EF (all-flash) model, EF300 (or the E5760, if you want HDDs or hybrid HDD/SSD storage). You can find more about E- and EF-Series ararys at their respective product pages:

-  [EF-Series (all-flash, SSD or NVMe)](https://netapp.com/data-storage/ef-series) is about the all-flash (SSD, NVMe) models.
-  [E-Series](https://www.netapp.com/data-storage/e-series/) - HDD and Hybrid models (datasheets are at the bottom of the page) 

The second approach to getting more performance out of your iSCSI storage is to scale out, by adding additional arrays (with additional network ports, storage controllers, and disks - which generally improve the performance) to your applications server(s).

### Scaling out

Another thing to note is many apps are **not** limited to the performance of a single H-Series server or E/EF Series array. If the application itself is scalable, you can consider using its native scale-out features (example: Splunk). If it's not, you can consider using [BeeGFS](https://www.google.com/search?hl=en&q=netapp%20beegfs) with multiple servers or disk arrays to get a high performance to/from a single namespace.

Among other things, BeeGFS allows you to get to your data in a scale-out manner. An example for an HCI environment: say we have a small NetApp HCI cluster with three H615C compute nodes and we need to ingest IoT data at 5 GB/s. If data is coming from different sources, we don't need to buy a pair of servers each of which (for High Availability) can do 5 GB/s, or even worse (for many other HCI environments) - three such servers. Enterprise users would be much better off with a BeeGFS support contract and a fast enough E/EF array (or two slower arrays, as those too can scale out with BeeGFS.)

- 3 x (existing) H615C servers; only 2 x H615C are necessary for 5 GB/s, we can tolerate the loss of one node (N+1)
- 1 x BeeGFS support contract; to let VMs running on HCI compute write to shared file system
- 1 x E/EF array (E5760 or EF570, for example) to share data to BeeGFS VMs

This approach also makes it easier to scale your workloads. If you need 8 GB/s, just add another server. If you need 20 GB/s, add several servers and one or two additional array(s).

Some applications scale out without a shared file system because they can parallelize their workload and do not require shared data. To scale HCI performance with such apps you'd just add servers or storage, as necessary.

### Networking

Don't forget to use proper Ethernet switches such as NVIDIA Networking (Mellanox) SN-2010, SN-2100, and SN-2700, to get a network setup that can handle high throughput and low latency workloads, whether it's [backup](https://www.youtube.com/watch?v=SCzk3ZpfT-Y), analytics, video streaming or any other non-HPC workload that can work with iSCSI.

All currently available NetApp HCI servers use Mellanox 25 GigE NICs which means less time wasted on reading compatibility and interoperability documentation.

### HPC

What about HPC?

Many HPC workloads can work with iSCSI, but HPC users will always be better off with custom-configured or even custom-built servers and networks that talk Infiniband or NVMe, but scale-out workloads that consume millions of IOPS or tens of GB/s in sequential throughput appear within reach to NetApp HCI users with externally attached E/EF arrays.

Many enterprises have migrated or want to migrate their workloads to HCI, but high performance workloads can still be e challenge, or - when the scale isn't enough to justify it - cost more to run in dedicated HCI environments. NetApp HCI's disaggregated design makes it possible to easily and economically handle such workloads by adding E/EF-Series arrays to your NetApp HCI, while retaining the agility and convenience of HCI.

It's rarely justifiable to introduce novel or complex protocols or create management islands. Even if your high-throughput applications run in containers, you can still make use of E/EF-Series (NetApp Trident used by NetApp HCI and ONTAP can also [provision iSCSI container storage on E/EF arrays](https://netapp-trident.readthedocs.io/en/latest/support/requirements.html#supported-backends-storage).)
