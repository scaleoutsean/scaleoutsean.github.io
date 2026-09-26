# Ubuntu 22.04 LTS as iSER client to NetApp E-Series

Ubuntu with E-Series iSER? So what if it's not supported!?

- [Problem statement](#problem-statement)
- [E-Series side](#e-series-side)
- [Ubuntu side](#ubuntu-side)
- [Hardware and software stack](#hardware-and-software-stack)
- [Setup workflow](#setup-workflow)
- [Tips and tricks](#tips-and-tricks)
  - [SANtricity Host settings](#santricity-host-settings)
  - [SANtricity iSER settings](#santricity-iser-settings)
  - [OS rescue mode](#os-rescue-mode)
  - [What's what and Mellanox OFED](#whats-what-and-mellanox-ofed)
  - [Netplan and MTU](#netplan-and-mtu)
  - [ifaces](#ifaces)
  - [Multipath](#multipath)
  - [Target discovery](#target-discovery)
  - [Volume partitioning and sanlun command](#volume-partitioning-and-sanlun-command)
- [Conclusion](#conclusion)

## Problem statement

WTF is iSER? [iSER](https://en.wikipedia.org/wiki/ISCSI_Extensions_for_RDMA) aka iSCSI Extensions for RDMA is a computer network protocol that extends the Internet Small Computer System Interface (iSCSI) protocol to use Remote Direct Memory Access (RDMA).

NetApp E-Series supports iSER. Here's an existing image from another blog post that shows EF-Series EF300 and EF600, but E-Series 5700 also has the 100G IB Host Interface Card (HIC) option. See "iSER" in "I/O Interface Options".

![EF300 and EF600 Client Connectivity](/assets/images/efseries-ef300-ef600-technical-specifications.png)

Anyway, with 100G IB you can get low-latency 100 Gbps (per port) iSCSI to the box, which is very nice for many Big Data, analytics and HPC workloads.

The [documentation](https://docs.netapp.com/us-en/e-series/config-linux/iser-ib-verify-linux-config-support-task.html) for Linux with iSER naturally exists, but not for Ubuntu.

Your first choice would be to ask NetApp to qualify Ubuntu (or Debian, or what have you) as a one-off thing. This sometimes happens when you must have the entire stack validated end-to-end.

Your second choice is to **Just Do It (TM)**, if you can. 

Maybe this post can help you to "yes, can do" iSER!

## E-Series side 

There's nothing special about configuring E-Series iSER for Ubuntu. Which is also why Oracle KVM should just work with E-Series - same kernel, same drivers, etc.

So, work by the official docs and check this page for supplemental information.

## Ubuntu side 

This is where it can get tricky. Long story short, there's one major choice to make, and that is "to use or not to use Mellanox OFED?" and the answer I offer is "use it".

Officially, supported Linux seem to be tested with built-in drivers. 

I tried that using Ubuntu iSER with EF570 and my experience was crappy. Since you're using an unsupported OS, you may as well use IB driver that work.

The rest is "common sense with Ubuntu characteristics": follow the E-Series documentation (link at the top) and configure Linux stuff the Ubuntu way.

## Hardware and software stack

- x86_64 server with Mellanox ConnectX-5 (dual-ported 100Gb/ IB HCA; model: MCX556A-ECAT; FW 16.35.2000)
- Ubuntu 22.04 LTS with all updates as of Sep 21, 2023
  - 4 IB IPs, 2 on 192.168.100.0/24 and two on 192.168.101.0/24 network
  - NIC names configured for iSER: ibs1f0, ibs1f1, ibs5f0, ibs5f1
  - Mellanox OFED LTS 5.8-3.0.7.0
- E-Series SANtricity 11.80 (model: EF-Series EF570)
  - Controller A: 192.168.100.1 (Port 1), 192.168.101.1
  - Controller B: 192.168.100.2 (Port 1), 192.168.101.2
- No IB switches (direct attach, aka DAS) 

One note on DAS: usually we connect 1 or 2 servers this way, and 2 servers with 2 ports each consume 4 ports on E-Series IB HICs.

One example of that is BeeGFS node pairs connected E-Series, although that solution by default uses NVMe/RoCE rather than iSER/IB (but it could use iSER/IB, as could IBM Spectrum Scale or other applications).

## Setup workflow

It's helpful to understand what needs to be done. Roughly speaking:

- Install IB drivers
- Figure out how everything is connected (you were supposed to know before you started, but let's assume that's an afterthought)
- Get IB to work (Link Up, etc.)
- Configure iSCSI on top of IB (iSER)
- Discover and login to targets
- Ensure multipathing works, format and mount

## Tips and tricks

The primary objective of this post is to share information related to Ubuntu with E-Series without repeating what's in the official documentation.

I'll make these points in small sections. Some of it is "common sense stuff" that's not documented in the E-Series documentation because it's out of scope, but some of it is missing because Ubuntu is not in-scope.

### SANtricity Host settings

In order to configure E-Series iSER so that a server or cluster can connect to it via iSER, you need to pick iSER in Host settings.

That's obvious, but it's not obvious. 

Remember to pick **iSER** and not the default (iSCSI): you need the other iSCSI - iSER!

![](/assets/images/eseries-iser-06-host-iser-add.png)

Another weird thing is the host type: you'd expect one of the several Linux settings should apply. But they don't if you follow the official documentation (which doesn't tell you how to prepare the client). 

![](/assets/images/eseries-iser-09-santricity-host-settings.png)

(In this screenshot, iSCSI interface is selected. Don't do that for iSER - that **won't** work for iSER!)

The official documentation says the default multipath.conf settings work, but they don't. This is the E-Series default if you don't configure anything in multipath.conf and let it load:

```raw
devices {
	device {
		vendor "(NETAPP|LSI|ENGENIO)"
		product "INF-01-00"
		product_blacklist "Universal Xport"
		path_grouping_policy "group_by_prio"
		path_checker "rdac"
		features "2 pg_init_retries 50"
		hardware_handler "1 rdac"
		prio "rdac"
		failback "immediate"
		no_path_retry 30
	}
}
```

I think what happens is Ubuntu 22.04 (and 20.04) doesn't - or you don't force it to - correctly load a new driver, then - because the E-Series documentation doesn't suggest you blacklist this legacy entry or change it to use a newer driver - it falls back to RDAC.

And then adding the host other than "Factory Default" doesn't seem to work.

While trying to figure out this "Factory Default" nonsense, I realized that the undocumented "default" multipathing algorithm for E-Series is now `scsi_dh_alua`, which - again, in theory - should automatically load on a host connected to E-Series, which would then make it possible to set Host Type to Linux with DM and a post-v3.10 kernel and DM-MP.

Documentation on selecting OS types in SANtricity can be found [here](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/how-do-i-know-which-host-operating-system-type-is-correct.html) and it, too, is misleading:

> Supports Linux operating systems using a Device Mapper multipath failover solution with a 3.10 or later Kernel.

That's wrong. If you use the "default" settings you may very well end up with RDAC like I did, and then this DM-MP host type won't work well. That should say "... and with such-and-such MPIO driver". The entire manual doesn't have anything on what driver is supposed to be used or how `multipath -ll` output is supposed to look like. Totally ridiculous!

With Ubuntu's multipath defaults, RDAC gets loaded and Linux DP 3.10+ SANtricity host type gives me a warning about "suboptimal paths". Factory Default doesn't.

Anyway, that's too much information for what could have been solved by properly documenting it in 50 words.

For newer Linux (kernel >= 3.10), pick Linux DM-MP with kernel 3.10 or later. More on Ubuntu-side multipathing can be found further below.

### SANtricity iSER settings

This isn't hard, but the official documentation doesn't contain screenshots (too damn hard?) so: go to Settings > System and under General you'll find two iSER-related entries.

![](/assets/images/eseries-iser-01-configure-eseries.png)

This is where you pick a controller (A or B) and then can see if the ports are plugged in and Up/Down, as well as assign IPs to them. 

![](/assets/images/eseries-iser-02-configure-eseries-iser-ip.png)

With DAS, there's no switch and ports will be down as long as proper drivers and OpenSM haven't started on the host connected to these ports!

Just below that "Configure iSER over InfiniBand settings" you'll see iSER (and RDMA) statistics. If multiple active volumes are balanced and multipathing is in place, controller ports should be approximately evenly utilized.

![](/assets/images/eseries-iser-08-santricity-iser-stats.png)

This is also the place to look for excessive errors and such.

### OS rescue mode

This is not E-Series-specific, but you may need it. 

Before you start, try to boot your OS to Rescue Mode and make sure you are familiar with it (such as how to change OS configuration files in rescue mode).

The reason is if you screw up *and* make OS hang on boot, you may not be able to get in to unscrew the problem.

I got caught off-guard several times and almost had to re-install the OS...

![](/assets/images/eseries-iser-04-edit-fstab.png)

### What's what and Mellanox OFED

As mentioned in Setup Steps, we need to know what's what:

- Which NICs are IB cards
- How is everything connected - ports, device IDs, switch (if any) ports, E-Series controller, etc.

The E-Series documentation calls for identification of devices, ports, GIDs and what not.

You need to do that in any case (to understand how everything is connected), but because I installed Mellanox OFED, I did **not** have to do configure, create and enable [OpenSM service](https://docs.netapp.com/us-en/e-series/config-linux/iser-ib-configure-subnet-manager-task.html).

But since we should run some diags for proper awareness, here's an example of how ibstat output for one port on one of the HCAs looked like.

```sh
$ sudo ibstat
CA 'ibp134s0f0'
        CA type: MT4119
        Number of ports: 1
        Firmware version: 16.26.1040
        Hardware version: 0
        Node GUID: 0x1c34da03007ca2da
        System image GUID: 0x1c34da03007ca2da
        Port 1:
                State: Active
                Physical state: LinkUp
                Rate: 100
                Base lid: 1
                LMC: 0
                SM lid: 1
                Capability mask: 0x2651e84a
                Port GUID: 0x1c34da03007ca2da
                Link layer: InfiniBand
...
```

How I installed Mellanox OFED:

```sh
$ sudo ./mlnxofedinstall  --umad-dev-rw --all --enable-opensm
```

After I installed Mellanox OFED I enabled and started NVIDIA-packaged OpenSM service (remember, I did **not** create my own despite the E-Series documentation instructing otherwise).

``` sh
● opensm.service - LSB: Start opensm subnet manager.
     Loaded: loaded (/etc/init.d/opensm; generated)
     Active: active (running) since Thu 2023-09-21 17:38:05 UTC; 1h 30min ago
       Docs: man:systemd-sysv-generator(8)
      Tasks: 320 (limit: 115284)
     Memory: 30.1M
        CPU: 3.656s
     CGroup: /system.slice/opensm.service
             ├─2616 /usr/sbin/opensm -g 0x1c34da03007ca283 -f /var/log/opensm.0x1c34da03007ca283.log
             ├─2631 /usr/sbin/opensm -g 0x1c34da03007ca2db -f /var/log/opensm.0x1c34da03007ca2db.log
...
```
Notice the `-g GID` thing in the last two lines? That's one of the nice things Mellanox OFED stack does for us - we didn't have to assemble that configuration by ourselves as the E-Series iSER documentation suggests (and it suggests so because, as I mentioned, it's based on built-in RDMA and IB drivers and OpenSM service must be configured manually).

After installation of OFED you may notice there's a legacy service, `srp_service`, running. You may stop, and later disable it, if you don't need it.

You may want to reboot here and have those rescue mode instructions for Ubuntu 22.04 handy!

### Netplan and MTU

One thing I noticed about this is on unconfigured IB interfaces MTU was 4092.

Once I configured them in /etc/netplan/*.yaml, and they got an IP address assigned, IB MTUs became 2044.

I first tried the easiest (and the most naive approach, but it was too easy and I had to try) - I set Netplan MTU to 4092. Yeah, no. Still 2044.

I this works as expected as I saw some details about it in the Mellanox documentation. Read it if you want to try 4090. 

[Netplan](https://netplan.readthedocs.io/en/latest/examples/) requires very minimal configuration for these two (ibs1, ibs5) dual-ported HCAs.

```yaml
    ibs1f0:
      addresses:
        - 192.168.100.10/24
    ibs5f0:
      addresses:
        - 192.168.101.10/24
    ibs1f1:
      addresses:
        - 192.168.100.20/24
    ibs5f1:
      addresses:
        - 192.168.101.20/24
```

If the server's OFED drivers, OpenSM and links are up, then you may expect to see something like this (example for the first card):

```sh
7: ibs1f0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 2044 qdisc mq state UP group default qlen 256
    link/infiniband 00:00:0c:33:fe:80:00:00:00:00:00:00:1c:34:da:03:00:7c:a2:82 brd 00:ff:ff:ff:ff:12:40:1b:ff:ff:00:00:00:00:00:00:ff:ff:ff:ff
    altname ibp47s0f0
    inet 192.168.100.10/24 brd 192.168.100.255 scope global ibs1f0
       valid_lft forever preferred_lft forever
8: ibs1f1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 2044 qdisc mq state UP group default qlen 256
    link/infiniband 00:00:0d:01:fe:80:00:00:00:00:00:00:1c:34:da:03:00:7c:a2:83 brd 00:ff:ff:ff:ff:12:40:1b:ff:ff:00:00:00:00:00:00:ff:ff:ff:ff
    altname ibp47s0f1
    inet 192.168.100.20/24 brd 192.168.100.255 scope global ibs1f1
       valid_lft forever preferred_lft forever
```

Notice here ibs1f0 has an "altname", ibp47s0f0, which indicates that doing some homework mapping out PCI slots, IB diagnostics output and network configuration may pay back if you get in trouble.

### ifaces

On Ubuntu, those iSCSI configuration files are stored in /etc/iscsi/ifaces/.

Create and edit them as the E-Series documentation suggests.

My server had 2 HCAs, each with 2 ports, so I created four files here. You can name these files any way you want.

```sh
$ dir -lat /etc/iscsi/ifaces
iface-ibs5f1
iface-ibs5f0
iface-ibs1f1
iface-ibs1f0

```

### Multipath

Long story short, E-Series has three choices:
  - `scsi_dh_alua` - in E-Series, host type for that is "Linux DM-MP with kernel 3.10 and newer" (recommended and supported)
  - `scsi_dh_rdac` - in E-Series, select pre-3.10 Linux host type (not recommended, but still supported)
  - `rdac` - legacy MPP/RDAC driver - in E-Series, you probably don't want that one, but if you use it, in SANtricity select Factory Default host type (this isn't documented, but seems to work although it's not supported either)

The first two are supported. How do they differ? 

There's a deep-dive Technical Report with low-level details, but there's nothing on how to get started in the first place (again, unbelievable!).  It seems to go like this:

- If you load and force ALUA, Linux SCSI ALUA driver will be used and "Linux DM-MP (Kernel 3.10 or later)" should be the host type selected in E-Series
- If OS default multipath settings are used, you may end up with and old MPIO driver and may need to set Factory Default or maybe try "Linux DM-MP (Kernel 3.9 or earlier)", although it's better to troubleshoot and get ALUA to work
- If you change MPIO driver and E-Series host type setting for the system, reboot to make sure it doesn't work only until the next reboot

Install these packages, and make the services (multipathd, multipath-tools) enabled and running. 

```sh
sudo apt-get install -y multipath-tools multipath-tools-boot
```

Blacklist the OS root device from MPIO if need be. The official iSER guide for E-Series and Ubuntu documentation suggest to create an initial image with MPIO enabled (`update-initramfs -u -k all`) and this should be repeated every time multipath.conf is changed.

The E-Series docs tell you to use an empty /etc/multipath.conf because the defaults are already correct for E/EF-Series, but you can also modify those values if you want to see what they are or need to accommodate other storage such as ONTAP iSCSI or such. This alone won't change the driver type loaded (see further below).

```raw
defaults {
  failback "manual"
  # See NetApp TR-4737, sometimes you may want "immediate"
}
blacklist {
  devnode "!^(sd[a-z]|dasd[a-z]|nvme[0-9])"
  # maybe you want (or not?) to blacklist other devices, including boot disks, from MPIO
  device {
  }
}
devices {
  # any other devices that use a different algo
}
overrides {
}
```

You can read the [NetApp TR-4737](https://www.netapp.com/media/17144-tr4737.pdf) for the details about various MPIO options. Clearly - in my mind at least - that TR contradicts the official SANtricity documentation ([Multipathing section in Linux Express configuration](https://docs.netapp.com/us-en/e-series/config-linux/iser-ib-configure-multipath-software-task.html) for v11.80 and all v11.70 releases):

> Use the default multipath settings by leaving the multipath.conf file blank.

I don't think so. I had to use `rdloaddriver="scsi_dh_alua"` in GRUB which - after a reboot - loaded the generic Linux SCSI ALUA driver and allowed me to set "Host operating system type" to Linux DP 3.10+ without getting warnings about suboptimal paths.

Now if you log in to your iSER targets, you should be able to see multiple paths to volumes (in theory, you should see `hwhandler="1 alua"` in `multipath -ll` output; otherwise you might see `"1 rdac"` which is either `scsi_dh_rdac` or the deprecated RDAC driver).

```sh
$ sudo multipath -ll
3600a098000e3c1b000002be3620b681e dm-3 NETAPP,INF-01-00
size=399G features='3 queue_if_no_path pg_init_retries 50' hwhandler='1 alua' wp=rw
|-+- policy='service-time 0' prio=50 status=active
| `- 15:0:0:1 sdb 8:16 active ready running
`-+- policy='service-time 0' prio=10 status=enabled
  `- 16:0:0:1 sdq 65:0 active ready running
3600a098000e3c1b000002d14634f47c9 dm-0 NETAPP,INF-01-00
size=100G features='3 queue_if_no_path pg_init_retries 50' hwhandler='1 alua' wp=rw
|-+- policy='service-time 0' prio=50 status=active
| `- 15:0:0:5 sdf 8:80  active ready running
`-+- policy='service-time 0' prio=10 status=enabled
  `- 16:0:0:5 sdu 65:64 active ready running
...
```

In theory, `scsi_dh_alua` is loaded by default. In practice, I think this doesn't happen because RDAC is still in default multpath.conf and it gets loaded before the ALUA driver. I had to add `rdloaddriver="scsi_dh_alua"` to kernel boot command to get it to load before RDAC. That step is also suggested in [ONTAP SAN documentation](https://docs.netapp.com/us-en/ontap-sm-classic/iscsi-config-rhel/task_configuring_dm_multipath.html), while people from the E-Series Team explicitly told me it's not required.

To force-load both supported types use [this](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/6/html/6.3_technical_notes/kernel_issues) syntax: `rdloaddriver=scsi_dh_rdac,scsi_dh_alua`. But if you can't control which gets eventually used, pick one.

And finally, if you don't care about artsy-fartsy (also known as "user-friendly") device names, you could format and mount these devices (or add mount points to /etc/fstab).

Example:

```raw
/dev/mapper/3600a098000f637140000284763a83f44 /mount/data xfs4 _netdev 0 0
```

### Target discovery

Before we mount and use any iSCSI (and also iSER) we need to discover them and login to iSCSI portal. But remember, here we're not discovering iSCSI, but iSER targets ("the other iSCSI").

Two things to say about that:

1) One funny thing that kept happening (although it didn't bother me much) is the stupid 192.168.130.x/24 IPs which were not E-Series controller IPs. I think the reason is the IB HCAs have BlueField functionality included, so it's coming from that. (I haven't used BlueField, but I want to learn enough to be able to disable it!)

```sh
$ sudo iscsiadm -m discovery -t st -p 192.168.100.1 -I iser
192.168.130.101:3260,1 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.131.101:3260,1 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.100.1:3260,1 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.101.1:3260,1 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.130.102:3260,2 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.131.102:3260,2 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.100.2:3260,2 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
192.168.101.2:3260,2 iqn.1992-08.com.netapp:5700.600a098000f63714000000005e79c17c
```

Anyway, the main thing here is you don't want to see any unexpected errors during discovery and login to iSER.

2) The other noteworthy detail - is "`-I iser`" should supposedly be used to scan iSER targets. Using device from /etc/iscsi/ifaces/ worked for me as well ("`-I iface-ibs5f1`", for example). I think that's because iSER is configured in those interface files.

With `-I iser` (and the stupid BlueField IPs that I didn't have time to get rid of):

![](/assets/images/eseries-iser-03-configure-client-iser-ip-and-login.png)

With full iface names:

![](/assets/images/eseries-iser-05-scan-from-limited-ifaces.png)

In the four iface files that I created, I only modified two values in each, `iface.initiatorname` (I used the OS-set iSCSI initiator name for all 4 files) and `iface.net_ifacename` (use iface name from "`ip address`" output, which is different for each interface:  `ibs1f0`,  `ibs1f1`,  `ibs5f0`, and `ibs5f1` for the last one). The latter I think ensures that only IB transport is used during discovery.

I don't know if iSER would work better with more detailed settings (HWADDR, MTU, etc.) in iface files, but it seems it works fine without them.

Anyway, this is another good chance to reboot and see if everything (starting with the OS) can come up again. Have those OS rescue mode instructions ready!

Don't panic if it takes a while for stuff to come up. This step takes long enough to get you start thinking about rescue mode.

![](/assets/images/eseries-iser-07-mellanox-ofed.png)

### Volume partitioning and sanlun command

You can see the [sanlun](https://docs.netapp.com/us-en/e-series/config-linux/fc-create-partition-file-task.html) command mentioned in several places, including iSER-related pages.

First, that command is from one of the optional "utility" packages that NetApp provides for the main SAN products (ONTAP and E-Series). I seem to recall it can't even be natively installed on Ubuntu or Debian, so don't even bother.

Second, you don't really need it anyway.

Maybe it was needed in 2007 when Linux was crappier than it is today, but what it does now is fairly limited. Example:

![](/assets/images/eseries-iser-11-netapp-san-utilities.png)

Why should I care about /dev/sd* names?

What I really want is something that helps me map E-Series volume names to mount points (which should not use /dev/sd* devices). For the rest I can simply use a handful of OS commands.

At first I skipped this scripting stuff alltogether as setups are mostly one-off things, but later on I had to create, delete and configure a whole bunch of LUNs, so eventually I did create a script that does that I want.

![](/assets/images/eseries-iser-10-diy-san-script.png)

- Use the SANtricity API to get volume details
- Use OS (`multipath -ll`) to get path details
- Use shell commands to optionally create mount points
- Use shell commands to create format and mount commands (my use case is "lab testing", otherwise I wouldn't even show those force-mount commands - just copying them is dangerous enough!)

This lets me go to the SANtricity UI, create a bunch of volumes, run the script and in 10 seconds have use all volumes with at pre-determined mount points. Some notes: 

- WWNs don't change, dm-* names can, so WWNs is what we should use in /etc/fstab, but for temporary testing Device Mapper names are easier to inspect
- The last column shows current controller and it's 1 throughout, that's because I assigned all LUNs to Controller A to eliminate path flipping between controllers (i.e. MPIO is not behaving correctly, maybe because of network issues)

What about volume partitioning?

My view is on flash disks I wouldn't even partition LUNs unless I test and see partitioned disks are faster or have some other advantage over non-partitioned (I can't think of any). Maybe they are when they're NL-SAS, but for flash I doubt. So I wouldn't bother with that step. For flash-based disks, I'd just run `mkfs` on the device and move on. 

You can try and create partitioned devices and run a simple synthetic benchmark that resembles your workload to see if it matters.

## Conclusion

Most E-Series users who want to use Ubuntu shouldn't care that it's not supported. 

If you ask NetApp to qualify it for your environment, I suggest asking for Ubuntu LTS *with Mellanox OFED*.

One of the annoying areas is the poorly documented MPIO configuration for Linux - not for iSER or Ubuntu (which isn't documented at all because it's not officially supported although it's known to work), but in general. 

I will use this system in coming weeks and months so I may have new findings, but I don't think there's much that can go wrong here: 

- the mature and well-known components are iSCSI initiator and libraries, Multipath / Device Mapper, and kernel in general
- the sensitive parts are IB and RDMA and with OFED that's solved for you by NVIDIA who, by the way, are **heavy** users of Ubuntu, so it's not like this is something very risky or new

Ubuntu and NVIDIA / Mellanox OFED solve your client-side challenges, and storage-side (E-Series IB uses Mellanox HCAs, as far as I remember) then becomes easy. 

This approach lets you use Ubuntu and iSER with E-Series. While the DIY approach may involve mild shortcuts, this gives you LXD, ZFS and some other solutions and features which work best on Ubuntu. I think it's a decent tradeoff if you need those features or standardize on Ubuntu or Debian-like distros that Mellanox OFED supports.

You could use Ubuntu easier without iSER (FC or 25Gb/s iSCSI), but iSER is fast and may be the right choice for AI, analytics and other environments.
