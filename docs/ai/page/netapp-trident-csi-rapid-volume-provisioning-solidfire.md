# Rapid PVC provisioning with NetApp Trident and SolidFire

Rapid volume provisioning on Kubernetes

## Introduction

While browsing random Trident CSI issues I found [this one](https://github.com/NetApp/trident/issues/860):

> It took more than 10 minutes to create 200 PVs at once and pod mount them. First of all, it took over 8 minutes to create 200 PVs. And it took about 2 minutes for the pod to mount. (STATUS: ContainerCreating)

Damn... I couldn't quite believe it, so I had to try.

## Speed of volume provisioning with Trident CSI v24.06 and SolidFire 12.3 (VM)

This is a simple NGINX stateful set with 10 pods, each has a basic 1Gi volume.

It's not good. 

```sh
$ kubectl get pvc -n ss
NAME        STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
www-web-0   Bound    pvc-07c12f21-2ea1-499b-b157-e8a6daf53451   1Gi        RWO            bronze         <unset>                 2m4s
www-web-1   Bound    pvc-0397b0e8-eab9-4465-bf28-b264827b8c72   1Gi        RWO            bronze         <unset>                 110s
www-web-2   Bound    pvc-058ae4c4-8999-4518-9694-d15a6e998d4c   1Gi        RWO            bronze         <unset>                 99s
www-web-3   Bound    pvc-5bad65cf-0249-4813-b3a2-1419f2d8f840   1Gi        RWO            bronze         <unset>                 89s
www-web-4   Bound    pvc-ab9d532b-7142-4981-9da1-8900008ba1ac   1Gi        RWO            bronze         <unset>                 79s
www-web-5   Bound    pvc-d2cc124f-7c16-436b-b2c9-c9a0ea44568f   1Gi        RWO            bronze         <unset>                 69s
www-web-6   Bound    pvc-7093b147-4e65-4074-a59d-fe90f9393c02   1Gi        RWO            bronze         <unset>                 58s
www-web-7   Bound    pvc-9bd0bfdb-c818-4679-b8dd-37dda4625ee1   1Gi        RWO            bronze         <unset>                 48s
www-web-8   Bound    pvc-b0812d18-6f7b-4476-b5a3-36151bfdbaf4   1Gi        RWO            bronze         <unset>                 38s
www-web-9   Bound    pvc-047208ef-d9b8-4aef-af0e-a2813923a4fd   1Gi        RWO            bronze         <unset>                 28s

```

One volume every 10-11 seconds.

## Why so slow

I didn't even look at any logs because it seems logical that after each volume is created (which takes milliseconds), there's an OS rescan and login, followed by Trident- and Kube node-driven formatting and finally binding. 

But that still seems too slow!

The reason it's *that* slow is I have one K8s worker node and my SolidFire is really just a demo VM. If I had 10 workers, I assume it would take less:

- Trident controller creates a bunch of volumes
- Each worker does its rescan, etc. 

Assuming 10 seconds per volume, 10 workers should finish in 10-15 seconds.

But with 200 volumes, each worker node would still have to do 10x as much, so we'd be back to where we started. 

Maybe not 8 minutes, but 2-4 minutes at best.

## Can it be made to run faster 

Before trying to figure out how to do it, we need to "qualify". 

What's the workload like, what kinds of PVCs it requires, etc.

There are probably some use cases that disqualify certain approaches. 

I don't know what the guy from that issue was trying to do, so I'll assume it's a bunch of volumes in one namespace, i.e. trusted environment.

## Making it faster

I actually wrote about this before in [NetApp SolidFire with GenAI and inferencing workloads](https://scaleoutsean.github.io/2023/11/22/genai-with-netapp-solidfire.html#ready-to-clone-pvs-for-tools-applications-models).

The idea is to pre-create volumes and keep them parked there for import by Trident. That's all.

You can see in Appendix A of that post, I create a loop that checks if there are X spare volumes and provision `(X - actual_number)` if there aren't. That way every 15 seconds the number of idle volumes is "refilled".

Kubernetes and CSI make that even easier because rescan, login, etc. is all automatic. We just need to make sure the sufficient number of idle volumes is parked for instant use.

![Precreated PVCs](/assets/images/solidfire-clone-precreation-01.png)

Trident [`import`](https://docs.netapp.com/us-en/trident/trident-use/vol-import.html) is used to import existing volumes created externally.

## Other approaches

If the user can recycle volumes on their own, then it may be faster to deploy application into existing idling pods with PVCs already mounted. That would be more elaborate, but it would allow volumes to be preserved and we'd need to create them just once. SolidFire uses Thin Provisioning by default, so the main limits are storage capacity i.e. metadata and data (use `discard`!) space, and number of iSCSI connections (400 per SolidFire node). It's fine to create 200 volumes larger than the largest size you need and use them as necessary - just keep an eye on those three constraints which you can do with [SFC](https://github.com/scaleoutsean/sfc) or similar. (Note that SolidFire capacity information is updated after each hourly GC run.)

"Automatic" recycling in Trident isn't available: `Recycle` was deprecated and isn't available to Trident CSI users. Only `Retain` and `Delete` (default) are available.

But, if Storage Class recycle policy is set to Retain, volumes are already in place before the next deployment, so we can Reuse them. If I create the same Stateful Set, Kubernetes just start the containers and even though they start one by one, this takes only 90 seconds using one worker node.

```sh
NAME    READY   STATUS    RESTARTS   AGE
web-0   1/1     Running   0          101s
web-1   1/1     Running   0          92s
web-2   1/1     Running   0          83s
web-3   1/1     Running   0          72s
web-4   1/1     Running   0          62s
web-5   1/1     Running   0          52s
web-6   1/1     Running   0          42s
web-7   1/1     Running   0          31s
web-8   1/1     Running   0          21s
web-9   1/1     Running   0          11s
```

Data cleansing, if required, has to be done separately from a sidecar container, for example. A basic scrub ("`rm -rf /data/*`") can be enough if secure deletion isn't required. That's how [Recycle did it](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#recycle).

Another approach is to do rapid cloning host-side, e.g. by leveraging [ZFS](/2024/02/29/ubuntu-2404-lts-with-netapp-solidfire.html) or other filesystem on SolidFire volumes. In this case we'd have two CSI drivers, Trident CSI and whatever filesystem you use. This "solves" the problem by not using Trident CSI.

From one of the older posts, here's a comparison of the speed of PVC creation: Hashicorp Nomad CSI vs. Kubernetes CSI using BeeGFS CSI driver (which creates directory-based PVs): Nomad can create 100 volumes in 9 seconds. Kubernetes barely got to 30 by the time Nomad was done with 100.

![](/assets/images/k-vs-n-pvc-creation-animated.gif)

This goes to show that different approaches have different advantages. If the speed of volume creation is critical and "workarounds" don't help, there's no need to hassle with Trident CSI. Use what works.

## Conclusion

The problem is real, although maybe not as severe in `solidfire-san` environments as reported in that issue. 

The old post was focused on situations where cloning of volumes for experimentation takes significant amount time. This one is specific to Kubernetes, but the solution or workaround is the same.

There are various approaches we can use to mitigate this issue. 

Worker-side, filesystem or volume manager-driven provisioning ought to be the fastest way to deploy many PVCs (without Trident, in that case), but it lacks the granularity of individual PVC management that may be required for storage replication or things of that nature.
