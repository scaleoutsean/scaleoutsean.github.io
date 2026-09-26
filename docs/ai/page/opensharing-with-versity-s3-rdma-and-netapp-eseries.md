# OpenSharing Server with S3/RDMA-based Versity S3 Gateway

- PART ONE: [Does OpenSharing have anything for NetApp E-Series?](/2026/06/14/netapp-eseries-opensharing-deltasharing.html)
- PART TWO: [IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series](/2026/06/16/netapp-eseries-iot-compaction-opensharing.html)
- PART THREE: [NetApp volume content sharing with OpenSharing and Versity S3 Gateway](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html)
- PART FOUR: [OpenSharing demo server for NetApp StorageGRID and E-Series with Versity S3 Gateway](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html)
- **PART FIVE:** OpenSharing Server with S3/RDMA-based Versity S3 Gateway

## Introduction

In yesterday's post we saw how the Versity S3 Gateway with S3/RDMA support works with a single-host (XFS) and parallel file system (BeeGFS):

![VGW RDMA with BeeGFS or XFS](/assets/images/versity-s3-rdma-03-vgwrdma-beegfs-eseries-storagegrid.png)

I also have an [OpenSharing Server implementation](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) that supports NetApp StorageGRID and Versity S3 Gateway, so why not enable it for S3/RDMA when VGW is setup for RDMA?

## OpenSharing with S3/RDMA backend

S3/RDMA uses RDMA URLs to GET and PUT (although in case of OpenSharing, it's all read-only, so just GET), so we need to be able to return those links.

![OpenSharing](/assets/images/versity-s3-rdma-00-opensharing.png)

And then it's up to the client to deal with it.

![OpenSharing Tables with VGWRDMA](/assets/images/versity-s3-rdma-06-vgwrdma-opensharing.png)

This implementation supports Tables and Volumes, so I tried Volumes, too.

![OpenSharing Volumes with VGWRDMA](/assets/images/versity-s3-rdma-07-vgwrdma-opensharing-volumes.png)

They both work. 

### Application integration challenge

I am not aware of other OpenSharing server implementations with S3/RDMA support. There probably are some, but I haven't heard of them.

Existing OpenSharing servers need small modifications to work with S3/RDMA, but clients need more work because it's not a matter of "downloading" a file/object using RDMA, but using it in an application, and for that an RDMA-capable S3 client needs to be part of the the application to avoid copying.

As you can see in the screenshots, I had "a" client, but as I mentioned before, I have no plans to open the source code for either the server or S3/RDMA client because it's simply easier for me that way - I have much less maintenance work to do and I don't miss any community contributions because I don't get any anyway. It is enough for functional and performance evaluation as-is.

Until some popular open source S3 client library implements S3/RDMA and applications start including it by default, everyone has to build their own or get it from a vendor (I think some S3 vendors forked PyTorch and other popular frameworks for GPU computing and enabled them for their S3/RDMA).

So, the client challenge is:

- being able to "download", which is what's demonstrated above, shows the server responds correctly, but
- If you "download" to disk, you lose most benefits from RDMA. For meaningful use, you need S3/RDMA client that works with your CUDA-enabled application

There are ongoing efforts to make this seamless rather than an exercise for each individual user, so check with your S3 vendor...

### Is it worth it?

Creating your own modified S3 client library makes sense if you deal with large amounts of data every day, especially if it's time-sensitive, too.

- [Here](/2026/06/25/versity-sequential-s3-get-test.html), I could get close to 5 GB/s GET with Versity sharing a single EF-Series volume using standard S3
- With S3/RDMA and GPU hardware, maybe I could get 10 GB/s or more from the exact same setup

Someone who downloads or queries many TBs every day and can save time and resources may find it easy to justify moving this workload to S3/RDMA.

## Summary

No matter how your data is generated - by POSIX applications, S3 clients who upload to Versity Gateway using direct S3 approach, or other protocols that send data to applications sharing same data volume - you can get to it with S3, S3/RDMA both directly and using OpenSharing.

![Use cases with OpenSharing](/assets/images/versity-s3-rdma-05-vgwrdma-opensharing.png)

Use cases for OpenSharing are the same as before, but - once Versity S3 Gateway releases a version with these commits that support S3/RDMA - we'll be able to get data faster and with much lower CPU utilization on S3/RDMA clients with Versity S3 Gateway with RDMA.
