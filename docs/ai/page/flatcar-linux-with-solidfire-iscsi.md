# Flatcar Container Linux with SolidFire iSCSI

Flatcar Container Linux (and similar distributions) with SolidFire

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

If you're into containers you've probably heard of [Flatcar Container Linux](https://www.flatcar-linux.org/), popular community fork of CoreOS.

I don't think any Flatcar Container Linux user would encounter a problem configuring SolidFire (SolidFire configuration for iSCSI clients is pretty hard to screw up), but some NetApp HCI or SolidFire users may not be used to Flatcar Linux, CoreOS or similar distributions. I'm not either.

### Deploy Flatcar Linux

For this, just click on the link above and RTFM - I can't make it simpler or more accurate.

Well, actually maybe I could, there are some typos and omissions in the official Flatcar documentation, but I will submit corrections over Github rather than post a corrected version here. I'll do this in coming days.

But it can be useful to understand what needs to be done (at minimum) iSCSI-wise, so that you don't have to read all the docs:

### Prepare SolidFire for Flatcar Container Linux nodes

Create an account and possibly one or more (e.g. one for each Flatcar Linux VM) volumes.

Why "possibly"? Because you may want to have NetApp Trident (dynamic CSI provisioner) create volumes for you.

Otherwise, you may also want to create and provision some or all volumes statically, for example you want ephemeral iSCSI devices that aren't managed by Kubernetes, or you're using Docker and not Kubernetes.

In the case you're setting up Kubernetes or just want to script and automate the SolidFire part, you can work by the NetApp Trident documentation or chose my [SolidFire-focused Trident setup guide here](https://solidfire-kubernetes.pages.dev/docs/intro) (recommended).

For this occasion I assumed that I need one emphemeral volume, so I created that volume manually. (The real reason is I don't have a Flatcar Container Linux-based Kubernetes cluster and I'm lazy to install it and Trident for this post.)

### Deploy Flatcar Container Linux with iSCSI service configuration

You can also first deploy Flatcar and add iSCSi components after - configure it once OS is up and running and network ready - but if you automate, then you'll probably configure everything before you deploy by using a Flatcar Container Linux provisioning template. How to configure iSCSI initiator? RTFM [here](https://www.flatcar-linux.org/docs/latest/setup/storage/iscsi/).

Because most people want to use iSCSI over a dedicated NIC or two, you'd need to configure network first, and iSCSI after that.

I configured the second NIC through automation and also iSCSI initiator file (simply tell Flatcar to write stuff to iscsid.conf), while initiatorname.iscsi is random if you don't set it. By the time you log in, both the network and iSCSI initiator configuration should be ready. In fact the entire Kubernetes cluster can be ready in minutes.

I deployed the official Flatcar OVA image to vSphere 7 using 2 a vNIC configuration (one of which was connected to iSCSI vSwitch where SolidFire can be reached). That took about 20 seconds and after that I logged in:

```sh
$ cat /etc/lsb-release 
DISTRIB_ID="Flatcar Container Linux by Kinvolk"
DISTRIB_RELEASE=2983.2.1
DISTRIB_CODENAME="Oklo"
DISTRIB_DESCRIPTION="Flatcar Container Linux by Kinvolk 2983.2.1 (Oklo)"
```

I had the second NIC, ens224, defined for iSCSI under `nic2.network` (your NIC names may be different; ens192 and ens224 is what this Flatcar Linux edition got on VMware ESXi 7):

```yaml
networkd:
  units:
    - name: nic1.network
      contents: |
        [Match]
        Name=ens192
        [Network]
        Address=192.168.1.215/24
        Gateway=192.168.1.1
    - name: nic2.network
      contents: |
        [Match]
        Name=ens224
        [Network]
        Address=192.168.103.215/24
        LinkLocalAddressing=no
        IPv6AcceptRA=no
```

Flatcar lets you hard-code MTU in NIC configuration file, but I didn't do that. But if your iSCSI network supports jumbo frames, configure it that way.

Flatcar configuration file reflected in OS network configuration:

```sh
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: ens192: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:0c:29:fc:31:c9 brd ff:ff:ff:ff:ff:ff
    altname enp11s0
    inet 192.168.1.215/24 brd 192.168.1.255 scope global ens192
       valid_lft forever preferred_lft forever
    inet6 fe80::20c:29ff:fefc:31c9/64 scope link 
       valid_lft forever preferred_lft forever
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default 
    link/ether 02:42:7e:65:fc:4b brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
4: ens224: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:50:56:98:b5:73 brd ff:ff:ff:ff:ff:ff
    altname enp19s0
    inet 192.168.103.215/24 brd 192.168.103.255 scope global ens224
       valid_lft forever preferred_lft forever
```

I would recommend against multipathing - if you want 2 NICs for HA, create an LACP bond (Flatcar lets you do that in network configuration file) - you'll get your HA but you won't need to deal with MPIO configuration (and bugs). As you can see (from docker0) I also deployed Docker in the same go.

My iscsid.conf was created on the first try - great!

```sh
sean@fcl1 ~ $ sudo cat /etc/iscsi/iscsid.conf 
isns.address = 192.168.103.30
isns.port = 3260
node.session.auth.username = flatcarlinux
node.session.auth.password = flatcarlinux
discovery.sendtargets.auth.username = flatcarlinux
discovery.sendtargets.auth.password = flatcarlinux
```

How to do that?

```yaml
storage:
  files:
    - path: /etc/iscsi/iscsid.conf
      filesystem: root
      mode:       0644
      contents:
        inline: |
          isns.address = 192.168.103.30
          isns.port = 3260
          node.session.auth.username = flatcarlinux
          node.session.auth.password = flatcarlinux
          discovery.sendtargets.auth.username = flatcarlinux
          discovery.sendtargets.auth.password = flatcarlinux
```

I manually started iscsid, discovered and logged in to the target (an ephemeral volume I created for this account).

Once I confirmed everything was fine, I enabled iSCSI service and performed other follow up steps (create a filesystem, [mount storage](https://www.flatcar-linux.org/docs/latest/setup/storage/mounting-storage/), [use attached storage for Docker](https://www.flatcar-linux.org/docs/latest/setup/storage/mounting-storage/#use-attached-storage-for-docker), etc.).

![Deploy Flatcar Linux with SolidFire iSCSI](/assets/images/flatcar-linux-with-solidfire-iscsi.png)

Remember that in order for iSCSI to start, network service must be up!

### Automate

As you login to SolidFire SVIP (Storage Virtual IP), you'll be able to list device by one unique path followed by unique cluster UUID and volume details:

```sh
$ sudo ls -lat /dev/disk/by-path/
total 0
lrwxrwxrwx. 1 root root   9 Dec  7 07:25 ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.ephemeral.571-lun-0 -> ../../sdb
```

What's what:

- Storage VIP is 192.168.103.30 and always the same in one cluster (four or 40 nodes)
- Cluster UUID you can see from the Web UI or obtain from the API or CLI. Mine is `mn4y`
- You just need to append the name you gave and volume ID that returned when you created it, in my case the name is `ephemeral` and volume ID 571

```sh
ip-{SVIP}:3260-iscsi-iqn.2010-01.com.solidfire:{CLUSTERUUID}.{VOLUMENAME}.{VOLUMEID}-lun-0
```

That's all it takes to map SolidFire to Linux iSCSI clients (remember, I didn't partition LUNs - one problem less to worry about).

![Mount SolidFire iSCSI target from Flatcar Linux](/assets/images/flatcar-linux-with-solidfire-iscsi-mount.png)

There's no FS tab in Flatcar, so we wouldn't add something like this to /etc/fstab:

```sh
# /dev/disk/by-path/ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.ephemeral.571-lun-0 /mnt/docker xfs discard,noatime 0 0
```

Instead you'd add a section like this to your Flatcar configuration file and this section could also be dynamically created from a template that creates N LUNs for N Flatcar nodes and prepares storage section details for each node's ephemeral volume.

(The systemd section below that is there just to give you an idea of what Flatcar's "fstab" looks like; to make this volume used by Docker for graph storage, you'd have to use the right path for your Docker, or change Docker configuration file to use /mnt/docker. Either way is fine, but if you make such changes better check the Docker documentation.)

```yaml
storage:
  filesystems:
    - name: ephemeral
      mount:
        device: /dev/disk/by-path/ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.ephemeral.571-lun-0
        format: xfs
        wipe_filesystem: true
systemd:
  units:
    - name: var-lib-docker.mount
      enable: true
      contents: |
        [Unit]
        Description=Mount ephemeral to /mnt/docker
        Before=local-fs.target
        [Mount]
        What=/dev/disk/by-path/ip-192.168.103.30:3260-iscsi-iqn.2010-01.com.solidfire:mn4y.ephemeral.571-lun-0
        Where=/mnt/docker
        Type=xfs
        Options=discard
        [Install]
        WantedBy=local-fs.target 
```

Also notice there's a `discard` option in mount service - highly recommended if you're using SolidFire for ephemeral volumes, as it'll help you save (release) deleted space and keep these volumes thin.

Before you reboot make sure your iSCSI service is enabled, or update your configuration file and redeploy, otherwise iSCSI initiator may fail to start and connect to target.
