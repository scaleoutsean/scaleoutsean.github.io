# ThinkParQ takes over NetApp-created BeeGFS CSI driver

Dude, where's my BeeGFS CSI driver

I've written several posts about NetApp's BeeGFS CSI driver.

## BeeGFS CSI for Kubernetes

The Github project has been cleanly transferred to ThinkParQ, so BeeGFS users can keep using it. 

Because of the transfer, the old link still works - it redirects to the new link and both of these links work fine:

- Before: [https://github.com/NetApp/beegfs-csi-driver/](https://github.com/NetApp/beegfs-csi-driver)
- Now: [https://github.com/ThinkParQ/beegfs-csi-driver/](https://github.com/ThinkParQ/beegfs-csi-driver)

The NetApp driver wasn't NetApp E-Series-specific. It was never tied to E-Series arrays and now with ThinkParQ behind it, it is likely to attract even wider interest.

As a reminder, the driver works with ARM64 - as we can see [here](/2022/04/30/beegfs-csi-on-arm64.html).

## Nomad CSI

The driver experimentally supported [Nomad](/2022/03/28/nomad-democratic-csi.html).

I don't know if ThinkParQ intends to continue developing Nomad-related functionality, but contributions are likely welcome. 

Please check out my Nomad-related posts here and give the driver a try. If you like Docker and the simplicity of Docker Swarm, you may prefer Nomad to Kubernetes.
