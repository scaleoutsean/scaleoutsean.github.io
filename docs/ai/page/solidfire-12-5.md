# GA of SolidFire 12.5

What's new in NetApp SolidFire 12.5

SolidFire and eSDS (containerized SolidFire for 3rd party x86 servers) version 12.5 just came out. 

I haven't tried it yet - I'm downloading the SolidFire Demo VM 12.5 as I write this - so I can't share my personal findings about it, but it has a bunch of small improvements and also bug fixes.

I'll write more about it as I deploy that demo VM and get access to physical clusters with version 12.5 (Protection Domains can't work on single-node clusters such as the Demo VM).

The SDKs, PowerShell Tools and so on have been updated as well.

### Main improvements

- Enhancements in manageability and supportability including related to Protection Domains in the SolidFire Web UI and OS upgrades
- NetApp HCI-related improvements related to scaling, vSphere 7 support, and VMware VVOLs 
- Updated Windows VSS plugin for hardware consistent snapshots
- Enhanced data consistency checking and updated KB on the use of iSCSI clients with CRC32 consistency checksum enabled
- Security updates and vulnerability fixes (Log4j fixes now in by default)

### SolidFire 12.5 Demo VM

The SolidFire Demo VM (OVA for VMware 6.7 and 7.0) has been posted to [the Tools section of the NetApp Support Web site](https://mysupport.netapp.com/site/tools/tool-eula/element-demonode) (registration required).

Among non-supported Demo VM options that work: [when v12.3 came out I noted](https://scaleoutsean.github.io/2021/04/20/solidfire-12.3.html) I made it work on VirtualBox 6 (both Linux and Windows; a [video demo can be seen here](https://youtu.be/6SXa-0Amhx0)), while recently I discovered on Proxmox it can't run natively - there the OVA can run inside of ESXi VM runnign on Proxmox. Just remember that management and iSCSI MTU must be at least 1500 bytes. See the post on SolidFire 12.3 for additional details.

It seems crazy in hindsight, but in versions 10 and 11 the Demo VM was almost 30GB. The OVA for 12.3 was 7GB, and SolidFire OVA 12.5 is under 6GB. If you download the OVA, make sure you compare checksums; I had to re-download five times because four times I ended up with an incomplete or corrupt OVA file.

**Note:** SolidFire Demo VM doesn't need VirtualBox Extension Pack (which may require a commercial VirtualBox license)
