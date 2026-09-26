# BeeGFS and BeeGFS CSI on ARM64

BeeGFS for ARM64 is out... and not only that!

- [BeeGFS 7.3.0 for ARM64](#beegfs-730-for-arm64)
- [Attempt 1](#attempt-1)
- [Attempt 2](#attempt-2)
- [Video walk-through](#video-walk-through)

## BeeGFS 7.3.0 for ARM64

ThinkParQ recently released BeeGFS 7.3.0. You can read about it in this [press release](https://thinkparq.com/wp-content/uploads/2019/08/ThinkParQ_7.3_final.pdf). The technical types can check [the release notes](https://doc.beegfs.io/7.3.0/release_notes.html).

For me the most exciting novelty is support for ARM64. Why? Well, ARM64 systems are becoming popular and not just for low-powered devices. For the same reason I've been building Trident CSI for ARM64.

## Attempt 1

7.3.0 for ARM64 packages were posted a few days after AMD64 bits - 2022-04-29 13:16 UTC to be exact, which was approximately 23 hours ago. I spotted the update last night and immediately got to work.

I have some small ARM64 devices with Ubuntu 20.04 so I hoped those would be fine. Sadly, latest kernel version I can run on those is a 4.9 variant and it simply couldn't work (for module build for BeeGFS client, that is).

I have Kubernetes and all sorts of crap installed on those systems, so I didn't want to completely reinstall multiple servers for that. I gave up after two hours.

## Attempt 2

Today I moved my efforts to AWS EC2 with the following plan:

- Stand up two ARM64 systems, one to act as BeeGFS Management, Metadata and Storage server, and another to act as BeeGFS client and all-in-one Kubernetes node
- [Download](https://www.beegfs.io/c/download/), [install and configure BeeGFS](https://doc.beegfs.io/latest/quick_start_guide/quick_start_guide.html#)
- Download BeeGFS CSI source code
- Build ARM64 version of BeeGFS CSI container
- Deploy Kubernetes
- Adjust BeeGFS configuration and deploy

Everything was looking very promising (I suspect that was simply because Amazon's ARM64 servers are much faster than my own) until the moment BeeGFS client kernel module build failed again. Ouch!

But after some copy-pasting of tips from various sites I overcame that problem by removing latest AWS kernels and installing linux-image-5.4.0-1072-aws and linux-image-aws-lts-20.04. With that, I was able to get past this potential show-stopper.

```sh
$ uname -a
Linux master 5.4.0-1072-aws #77-Ubuntu SMP Thu Apr 7 19:16:16 UTC 2022 aarch64 aarch64 aarch64 GNU/Linux

$ cat /etc/lsb-release 
DISTRIB_ID=Ubuntu
DISTRIB_RELEASE=20.04
DISTRIB_CODENAME=focal
DISTRIB_DESCRIPTION="Ubuntu 20.04.4 LTS"
```

Next I installed Go 1.17 to build BeeGFS CSI. As I expected, this wasn't too hard because BeeGFS CSI is well documented and I have experience with ARM64 and [Trident CSI for ARM64](/2021/02/24/netapp-trident-on-arm64.html). 

You may want to add `-arm64` to container base image (see BeeGFS CSI Dockerfiles). I think this should be unnecessary, but thanks to Minikube (see below) I made multiple changes in the process of trying to get everything to work, so if I tried again I'd first try *without* this change. Docker (or whatever else you're running - I was using Docker CE) should be able to get the right base image for you.

- Before: `FROM gcr.io/distroless/static:latest`
- After: `FROM gcr.io/distroless/static:latest-arm64`

The second change is related to Kustomize, namely just follow the BeeGFS documentation and make changes to use your own container rather than the official x86_64 (I don't want to use AMD64 to avoid confusion). If you like Kustomize (I find it to be unnecessarily complicated), the idea is to replace the default files with an "overlay" of your own. 

I uploaded what I built to Docker Hub, so you could [use mine](https://hub.docker.com/repository/docker/scaleoutsean/beegfs-csi-driver) as per below, but you can also build your own container and put it someplace else (remember to use the correct tag). If you're reading this months from today, best get latest official release as this will become outdated.

With Kustomize you'd make changes in an overlay file such as deploy/k8s/overlays/arm64/kustomization.yaml so that you can always easily apply this customization to a future version or next time you install. 

```yaml
images:
  - name: netapp/beegfs-csi-driver
    newName: docker.io/scaleoutsean/beegfs-csi-driver 
    newTag: v1.2.1-arm64
```

I did that and I get it - it's great for devs. But I spent more time figuring out how to use it (I was using it correctly but didn't know that at the time) than I'll save thanks to Kustomize in all of 2022. If you want to try installing without Kustomize, just edit the container image and tag in all YAML installation files and don't use Kustomize (`apply -k`) but `apply -f` to install without using Kustomize YAML files.

Next: Minikube. I thought to give it a try because it's "easy". Riiight... Two hours later I removed it and just used kubeadm. What's worse, I *didn't know* Minikube didn't work properly, so I did three probably completely unnecessary rounds of rebuilding BeeGFS CSI and fiddling with Kustomize overlays.

![BeeGFS CSI for ARM64](/assets/images/beegfs-arm64-beegfs-csi.png)

The rest was uneventful - it worked exactly the same as in my (lengthy) [introduction to BeeGFS CSI](/2022/04/09/beegfs-csi-introduction.html).

I followed the Dynamic PVC example from BeeGFS CSI:

```sh
$ kubectl get nodes
NAME     STATUS   ROLES                  AGE    VERSION
master   Ready    control-plane,master   3h6m   v1.23.6

$ kubectl get sc
NAME                PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
csi-beegfs-dyn-sc   beegfs.csi.netapp.com   Delete          Immediate           false                  58m

$ kubectl get pvc
NAME                 STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS        AGE
csi-beegfs-dyn-pvc   Bound    pvc-5542c5f2   1Gi        RWX            csi-beegfs-dyn-sc   57m

$ dir -lat /mnt/beegfs/k8s/pvc-5542c5f2/
total 1
drwxrwxrwx 2 root root 1 Apr 30 14:56 .
-rw-r--r-- 1 root root 0 Apr 30 14:56 touched-by-b749a647-0080-42cc-8a70-3573dd3b40dd
drwxrwxrwx 4 root root 2 Apr 30 14:55 ..
```

What I haven't tested is concurrent *heterogeneous* access to the same BeeGFS from ARM64 and AMD64 clients, but I was told that is supported.

Keep in mind that ARM64 is not officially supported by BeeGFS CSI. But now that we know that it can work, if you want it supported please upvote [this issue](https://github.com/NetApp/beegfs-csi-driver/issues/5) or contact NetApp.

## Video walk-through

- BeeGFS and BeeGFS CSI on ARM64 - [CLI-walk through of changes in Docker files and Kustomize](https://rumble.com/v13qq81-beegfs-on-arm64-with-beegfs-csi.html) - 4m48s
