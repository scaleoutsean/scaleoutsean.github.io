# NetApp BeeGFS CSI driver 1.4.0

Updates for Kubernetes and BeeGFS CSI, and alpha support for Nomad CSI

This week NetApp released BeeGFS CSI driver v1.4.0 which adds support for newer Kubernetes and BeeGFS.

Apart from these updates, container images are now signed with Cosign so no matter if you install the driver from a copy on public registry or upload copy to own registry, you can easily verify it.

Personally my favorite new feature is alpha level support for Nomad. Nomad CSI-related documentation is [here](https://github.com/NetApp/beegfs-csi-driver/blob/v1.4.0/docs/nomad.md).

![BeeGFS CSI with Nomad](/assets/images/beegfs-csi-monolith.png)

I've written several posts on Hashicorp Nomad. Because it didn't have CSI support Nomad was less popular for stateful workloads, but with the addition of CSI support that issue is largely gone. 

Since this year Nomad users can provision CSI volumes, there's [Helm-like Nomad Pack](https://scaleoutsean.github.io/2022/08/11/nomad-pack-influxdb-beegfs.html) and although in some areas Nomad is behind Kubernetes, it is ahead in others and far ahead when it comes to simplicity. Use the search feature to find other posts on Nomad on this blog.

BeeGFS Community Edition and BeeGFS CSI driver are both open source and can be used for free. Enterprise users who need professional support for software and hardware can buy BeeGFS Enterprise Edition integrated with NetApp E-Series appliances.

## Resources

- BeeGFS CSI v1.4.0 [release notes](https://github.com/NetApp/beegfs-csi-driver/releases/tag/v1.4.0)
- Official [blog post](https://www.netapp.com/blog/kubernetes-meet-beegfs/)
