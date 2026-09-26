# GA of NetApp Trident v21.07

What's new and noteworthy in NetApp Trident v21.07

Latest & greatest NetApp Trident is out!

Version 21.07 says goodbye to OCP 3.11 (and any and all Kubernetes clusters running versions earlier than v1.17).

It also removes support for E-Series back-end. Users can still use Trident v21.04 with E-Series, as well as any other (generic) or specialized drivers such as our [BeeGFS CSI Driver](https://github.com/NetApp/beegfs-csi-driver).

Other noteworthy changes:

## Multipath discovery

`find_multipaths` is now recommended to be set to `no` on all workers, including on workers running previous versions of Trident.

Trident v21.07 contains an improvement related to ONTAP iSCSI MPIO, but older releases in environments that experienced multipathing issues could benefit from flipping `find_multipaths` to `no`. You can see the new code [here](https://github.com/NetApp/trident/commit/2eee92b2f9c29c237e32dab5ec3be86632f8baf0).

I haven't asked because the documentation doesn't differentiate (so it has to be applied for all back-ends), but based on the commit and related Trident issues, this seems to have affected only Trident with ONTAP SAN back-end.

Note that this doesn't mind that you can't use multipath, it only means that we instruct multipathd to not look for it. When one ONTAP controller is down, we will login to it via another controller. When `find_multipaths` is enabled despite the new recommendation, Trident v21.07 will throw a warning.

I previously blogged how I avoid using multipath with SolidFire whenever I can because it's rarely needed and introduces complexity (remember that SolidFire uses single SAN fabric and one Target Portal per LUN). With SolidFire and worker NICs in LACP pair we wouldn't have multipathd *installed*, let alone configured!

## Snapshotter

One of the reasons why I haven't yet reviewed Kasten K10 v4 and latest Velero release is that this snapshot stuff in Kubernetes is such a PITA.

Trident v21.07 selects correct csi-snapshotter version for Kubernetes and snapshot CRD versions.

On Kubernetes v1.20 and later we use the validated `k8s.gcr.io/sig-storage/csi-snapshotter:v4.x` image if only v1 version is serving `volumesnapshots.snapshot.storage.k8s.io` CRD. If v1beta is in use, then snapshotter 3.x will be used.

I'll have to give this a try, so look forward for updated reviews of Kasten K10 and Velero with SolidFire SAN!

## Improvements in ONTAP capacity-related calculation

The way snapshotReserve and LUN sizes were calculated in pre-v21.07 was ... unusual. Now it's more in line how people expect it to be.

- ONTAP-SAN, ONTAP-NAS, and ONTAP-NAS-Flexgroup drivers now regard the snapshotReserve percentage as a percentage of the whole FlexVol size for new volumes
- ONTAP-SAN adds extra 10% to FlexVol size to account for LUN metadata

## Public Cloud stuff

From Release Notes v21.07:

> In Trident versions earlier than 21.07, you could create ANF backend with no valid Capacity Pools corresponding to a Service Level. As a result the volumes were provisioned in the Capacity Pool of different
Service Level type.

I mention this only because it's very similar to what I observed with SolidFire SAN: if you configure overlapping QoS policies (say, Bronze 100-200-300, Silver 200-300-500), Storage Classes without unambiguous QoS policy mapping will get "sprayed around" different QoS policies.

On the one hand it "makes sense" (load balancing!) but if you have services that depend on volumes having same performance characteristics, you may not like that. Seeing that note reminded me of this behavior with SolidFire SAN. You can read more about it [here](https://github.com/NetApp/trident/issues/281#issuecomment-740597377). Best practice for SolidFire SAN: don't overlap QoS ranges.

## Other ONTAP improvements

Among other noteworthy options is support for volume replication in ONTAP NAS driver, as well as REST support for ONTAP NAS driver (the latter as a tech-preview).

These look like features [NetApp Astra](https://cloud.netapp.com/astra) may need: if you look at the Astra documentation, it currently supports NAS back-ends (in the public cloud, it's Azure NetApp Files and Cloud Volume Service (GCP)).

## Next steps

- Check out [release notes for NetApp Trident v21.07](https://github.com/NetApp/trident/releases/tag/v21.07.0)
  - Update [Aug 6, 2021]: v21.07 was pulled because of a new bug related to ONTAP snapshot reserve calculations, see [here](https://netapp.io/2021/08/01/hello-astra-trident/). This does not affect SolidFire users.
- [RTFM](https://netapp-trident.readthedocs.io/en/stable-v21.07/support/requirements.html)
- If you're running Trident in a Kubernetes v1.17 (or newer) environment, you may want to upgrade Trident
  - I'll use this opportunity to update my unofficial Trident images for arm64 (see [this post](/2021/02/24/netapp-trident-on-arm64)). K8s on ARM64 users can get 'em [here](https://hub.docker.com/r/scaleoutsean/trident-arm64) or build their own

## Trident v21.07 on ARM64

If Kubernetes Master nodes are running on x86_64 hardware, we would need Trident ARM64 image just for ARM64 worker nodes. You can get this image and if you upload to your registry, tag it differently from AMD64 images:

`docker pull scaleoutsean/trident-arm64:v21.07.0-custom`

For all-ARM64 clusters, it's a bit more complicated - see archive posts about Trident on ARM64 or the instructions at the [Docker image page](https://hub.docker.com/r/scaleoutsean/trident-arm64).

You may also need [3rd party images](https://netapp-trident.readthedocs.io/en/stable-v21.07/support/requirements.html#container-images-and-corresponding-kubernetes-versions) (csi-snapshotter, csi-resizer, etc.) for ARM64 in your registry, but you already knew that.

Trident v21.07.0 on Kubernetes v1.21.2 (ARM64) connected to SolidFire 12.3:

![NetApp Trident v21.07 on ARM64 cluster with SolidFire 12.3](/assets/images/trident-v21.07.0-arm64.png)
