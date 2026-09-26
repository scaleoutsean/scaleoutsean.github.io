# What's new in NetApp Trident v23.07

What's new in NetApp Trident v23.07

## Introduction

Trident v23.07 hasn’t been officially released or announced, but the code seems finalized.

Rather than wait for the official announcement and republish some of its highlights, I’ll simply comment on the details I find noteworthy.

Notably, while I use Trident, I don’t deep dive into it with ONTAP backends. It’s mostly just to satisfy my PVC requests.

So, while there are more new fixes and enhancements than my highlights give on, my post is short because many are not noteworthy to me personally.

Let’s see, then!

## New

- Tech preview support for NVMe over TCP for the ONTAP-SAN driver

This is surely going to be welcome by users who want to get that last bit of performance from their TCP/IP SAN. It may help with random IO workloads.

I’d test NVMe/TCP but I doubt my home NICs and networks can support it and in any case, any differences vs. iSCSI would be likely invisible. But if you’re interested in general requirements for networks, see [this](https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/white-paper-c11-743772.html) Cisco white paper.

## Deprecations

- Removed support for pre-CSI volumes and storage classes

“Pre-CSI” Trident was used years ago, and unless you stood up your Kubernetes more than 3-4 years ago, it’s unlikely you have these. If you have a very old cluster and Kubernetes, you may want to check before upgrading.

- Updated minimum supported Kubernetes to 1.22

This is easy to check. Don’t upgrade Trident if your Kubernetes version is > 1.22.

- Removed support for v1beta1 snapshots

This may affect much more people than pre-CSI volumes. If you deployed Trident snapshots 2-3 years ago, maybe you’re using v1beta1 snapshots so better check (by using "describe" on snapshot SCs or checking from dashboard). You may have additional dependencies (e.g. old Kasten K10), which would require several updates to get end-to-end snapshots work again.

## ARM64 is still not easier

This isn’t related to official notes, but I’ll use this opportunity to comment on Trident on ARM64.

I used to maintain an [ARM64-focused fork of Trident](https://github.com/scaleoutsean/trident/) with the purpose to eliminate the hassle of building and deploying Trident on ARM64 nodes.

I stopped doing it after NetApp Trident v23.04 came out because ARM64 has become officially supported in that release.

What I didn’t know - because I use Trident mostly with SolidFire, and had no reason to upgrade Trident to v23.04 - that this stuff is still difficult!

### Build

Yesterday I spent <em>hours</em> trying to build and deploy Trident v23.07 on ARM64. It was harder than ever!

The experience seems to be the same or worse than before (v23.01 and earlier). There have been improvements in:

- the Makefile (supposedly it's been improved; in my experience it works worse than before)
- the two Dockerfile’s ($ARCH is passed on to Docker and the right multi-arch distroless base image is automatically loaded based on that variable - no need to patch the Dockerfile’s)
- the deployment and daemonset YAML files (these files contain lists with arch choices that consist of ARM64 and AMD64)
- trident-autosupport container has an [ARM64](https://hub.docker.com/r/netapp/trident-autosupport/tags) build since v23.04 (good for those who use ASUP)

But, the process of building and deploying seems harder than v23.01 or my ARM64-focused fork.

For example, "make all" defaults to pushing images to registry even though the default is "load" (i.e. don’t "push"). If you aren’t building on a system which can push, that means build process breaks after the first image is built and fails to be uploaded (i.e. Trident Operator won’t be built). This also happens when `BUILDX_OUTPUT` is set in shell - the setting simply doesn’t work. A workaround would be to set a temporary local registry (or login to Docker Hub despite not wanting to push your builds there, and delete them afterwards), but why?

Similarly, PLATFORMS variable supposedly allows us to set only a subset of all platforms available (Win, Lin, OS X), but PLATFORMS=”linux/arm64” won’t work because it seems linux/amd64 is required.

Honestly, it’s easier to just build ARM64 images manually from the Dockerfile’s: if I build tridentctl and other key binaries with simple commands (see BUILD.md) such as "go build -o tridentctl ./cli", then I can build Trident images from the two Dockerfile’s and move on to installing Trident with tridentctl. No need to fight the Makefile!

After several hours, I gave up on the included Makefile. I did manage to build ARM64 containers on my Linux x86_64 system, but just one image (Trident, without Trident Operator), and in the process I was also getting errors related to Darwin OS and whatnot, so I wasn’t sure if that Trident container image was going to work well.

```sh
bin/linux/amd64/tridentctl
bin/linux/amd64/trident_orchestrator
bin/linux/amd64/chwrap
bin/linux/arm64/tridentctl
bin/linux/arm64/trident_orchestrator
bin/linux/arm64/chwrap
Successfully packaged chart and saved it to: /go/src/github.com/netapp/trident/trident-operator-23.07.0-custom.tgz
cp: cannot stat 'bin/darwin/amd64/tridentctl': No such file or directory
make: [Makefile:381: installer] Error 1 (ignored)
WARNING: Using default BuildKit config in /home/sean/.docker/buildx/buildkitd.default.toml
ERROR: invalid duplicate endpoint unix:///var/run/docker.sock
make: [Makefile:324: images] Error 1 (ignored)
...
```

Then I used a cloud-based Debian 11 (Bullseye) ARM64 instance. I still saw Makefile-related errors similar to what I saw on x86_64, but at least this was on native ARM64 so I downloaded, signed and posted these images to Docker Hub.

- [Trident](https://hub.docker.com/layers/scaleoutsean/trident-arm64/v23.07/images/sha256-1a24f4719413b622e1fd07e3b948977ee00ec0ba3293b141d9a6c726f6e4f59d?context=explore)
- [Trident Operator](https://hub.docker.com/layers/scaleoutsean/trident-operator/23.07.0-custom/images/sha256-dba3c2e79570ba4b7eb9f708e2d157e491e7f79904a6ace5f74a4f682ac65d3c?context=explore) - I think I have no use for this container because I deploy with tridentctl

They work for me, but it was a very trial-and-error work and I didn’t take any notes when building:
- Building natively on a small Pi-like ARM64 at home: complete fail, suspected Go bug or something else that consumes all resources
- Building for ARM64 on a x86_64 system with Docker: works for Trident (not repeatable for Trident Operator), but with Makefile-related errors
- Building natively in the cloud (Debian 11 on GCP’s ARM64 servers with Docker): same as on x86_64 - some Makefile-related errors could be fixed by editing Makefile, but others remained. I wasn’t possible to repeatably build Trident Operator (I didn’t take notes, so maybe wasn’t consistently repeating build steps)

My K8s on ARM64 environment now:

- K3S on Debian 11.7 (Bullseye)
- Trident v23.07 with SolidFire iSCSI and ONTAP NFS backends

![Trident v23.07 on ARM64](/assets/images/netapp-trident-v2307-arm64.png)

## Deploy

While deploying with tridentctl (which should be easy to build, use "go build -o tridentctl ./cli"), I had this transient Trident pod appear and get stuck trying to download ARM64 container from docker.io/netapp (which of course can’t work since NetApp hasn’t yet published images for v23.07). That’d make "trident install -n trident" hang for minutes, and ultimately timeout (fail).

I’ve no idea what that was about - I couldn’t find any documentation on that transient pod and I also couldn’t find where to set its container image location.

After five-six attempts to edit that pod while Trident install was stuck/waiting for REST service to come up, and change its container image location to docker.io/scaleoutsean/trident-arm64:v23.07, one of the installation attempts finally worked. As edited the pod and it successfully retried with a working image link, the transient pod did its thing and disappeared. I was left with three running pods in Trident namespace as in that screenshot above.

This failure in “transient pod” will presumably go away for users (if only for those who don’t use private repos) once multi-architecture images for v23.07 are released, but that won’t fix the documentation. If you can’t specify that this transient pod downloads a local image, real-time editing will be required even after v23.07 has been released.

Anyway, this is what I ended up with:

```sh
$ sudo kubectl get pods -n trident
NAME                                 READY   STATUS    RESTARTS      AGE
trident-operator-595855b959-xthdq    1/1     Running   0             19h
trident-controller-6cf64dc9f-dzz9b   6/6     Running   1             19h
trident-node-linux-czln6             2/2     Running   0             19h

sudo ./trident-v23.07/bin/linux/arm64/tridentctl -n trident version
+---------------------------------------------------------+---------------------------------------------------------+
|                     SERVER VERSION                      |                     CLIENT VERSION                      |
+---------------------------------------------------------+---------------------------------------------------------+
| 23.07.0-custom+e2344922b27d1aec8c2574153962ef7ea49e390d | 23.07.0-custom+e2344922b27d1aec8c2574153962ef7ea49e390d |
+---------------------------------------------------------+---------------------------------------------------------+
```

Later on I deployed PostgreSQL using a Trident/SolidFire SC and didn’t notice any issues, so it appears it works.

I haven’t tried to restart… Who knows if it will fall apart next time I reboot. Update: it came back… Fortunately Trident appears to work okay.

![Transient pod fails after restart](/assets/images/netapp-trident-v2307-arm64-transient-pod-error.png)

### Other attempts to deploy

As I failed many times using tridentctl, I tried to use Trident Operator. Either I couldn’t understand the instructions or the instructions are bad (or maybe the code/containers were?). After 30-45 minutes, I gave up (but I built and uploaded a Trident Operator image to Docker Hub on that occasion).

I also tried Helm and couldn’t even attempt to use the Trident chart. It appears the chart URL in the documentation (v23.04) is invalid and I couldn’t even try to do something with the chart file. I was thinking about creating my own site for the chart, but it was just too much work. Then I went back to using tridentctl which - after 10-15 attempts - worked when one of the attempts to edit image URL in that “transient” running pod worked.

I wish these steps worked better as I have no desire to deal with this in the future, or maintain a fork.

## Conclusion

Trident improvements are steady and new features (NVMe over TCP) are being added every release.

Some of the improvements also improve the products and services that make use of Trident (Astra Control, mostly), but almost all of them stand to benefit generic Kubernetes users of ONTAP storage systems on premises or in the cloud.

Trident on ARM64 has been officially supported since v23.04, but it still doesn’t appear well-documented or well-tested.

The complete change log for Trident v23.07 can be found [here](https://github.com/NetApp/trident/blob/stable/v23.07/CHANGELOG.md). The full list of commits in v23.07 may be viewed [here](https://github.com/NetApp/trident/commits/stable/v23.07).
