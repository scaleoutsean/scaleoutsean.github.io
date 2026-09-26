# Trident concurrency with SolidFire

Explore the new concurrency feature in Trident

[Here](/2024/07/26/netapp-trident-csi-rapid-volume-provisioning-solidfire.html) I blogged about the speed of PVC provisioning of PVCs with Trident and SolidFire.

If you're interested in BeeGFS CSI and Nomad CSI (as opposed to Kubernetes), check [this post](/2022/09/27/beegfs-csi-nomad-kubernetes.html).

Lately there's a new "concurrency" feature in NetApp Trident CSI.

To enable it, install with `--enable-concurrency`.

```sh
sean@s159:~/trident-installer$ ./tridentctl -n trident install -h | grep conc
      --enable-concurrency                      Enable concurrency for Trident's controller **TECH PREVIEW**

```

Let's see how well it works!

I installed Trident CSI 25.10 and then prepared my backend definition.

```sh
$ ./tridentctl -n trident create backend -f backend-solidfire.json  
Error: could not create backend: backend type solidfire-san is not yet supported by concurrent Trident (400 Bad Request)
command terminated with exit code 1
Error: exit status 1
```

Noice...

For what it's worth, creating volumes in a loop in "standard" mode may now be faster than it used to. 

I don't have the old result (from the post at the top), but just creating 10 volumes takes less than 3 seconds.

```sh
$ date; for i in `seq 0 9` ; do kubectl apply -f sf-bronze-${i}.yaml ;date; done
Wed Dec 24 10:25:56 PM CST 2025
persistentvolumeclaim/sf-bronze-0 created
Wed Dec 24 10:25:56 PM CST 2025
persistentvolumeclaim/sf-bronze-1 created
Wed Dec 24 10:25:56 PM CST 2025
persistentvolumeclaim/sf-bronze-2 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-3 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-4 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-5 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-6 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-7 created
Wed Dec 24 10:25:57 PM CST 2025
persistentvolumeclaim/sf-bronze-8 created
Wed Dec 24 10:25:58 PM CST 2025
persistentvolumeclaim/sf-bronze-9 created
Wed Dec 24 10:25:58 PM CST 2025
```

The post at the top included "binding", which is async and likely independent of storage (the regular iSCSI rescan-and-login steps), and NGINX pod startup.

So, no concurrency for the fast SolidFire backend, but maybe a bit faster PVC provisioning compared to before.
