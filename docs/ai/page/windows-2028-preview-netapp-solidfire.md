# Windows Server 2028 (Preview) with NetApp SolidFire

Touch test of Windows Server 2028 (Preview; build 29706_1000) iSCSI with SolidFire 12

## Introduction

Unlike most people in customer-facing roles, I always look after products I recommend to customers and I do it for as long as I can.

- SolidFire Collector (old NetApp HCI Collector) is still [around and maintained](https://github.com/scaleoutsean/sfc)
- SolidFire Ansible collection is [still around](https://github.com/scaleoutsean/netapp.solidfire) and maintained
- SolidFire CSI driver was [released this year](https://github.com/scaleoutsean/solidfire-csi) and has been maintained since
- Terraform Provider for SolidFire was [greatly improved](/2026/02/15/updated-terraform-provider-solidfire.html) early this year and [has been maintained since](https://github.com/scaleoutsean/terraform-provider-solidfire)

Similarly, major OS releases have been checked with SolidFire regardless of what NetApp did or didn't do. 

I wrote about Windows Server 2025 [here](/2024/03/31/windows-server-2025-with-solidfire-part-one.html) as well as in other posts. Similarly for Ubuntu 26.04 and 24.04 LTS.

## Windows Server 2028

Windows 2028 [Insiders Preview](https://www.microsoft.com/en-us/windowsinsider/getting-started#preview) is now available and we can try it out.

NetApp is unlikely to do anything with it, but if you still use SolidFire and wonder if you should evaluate or even use Windows Server 2028, this may save you some time or at least encourage you to try.

I used `Windows_InsiderPreview_Server_vNext_en-us_29706_1000.iso`.

![Installation of Windows Server 2028 Preview on KVM](/assets/images/windows-server-2028-preview-04-windows-2028-install.png)

## iSCSI client

That's the part that matters the most. Thankfully, there's nothing new there.

I have not tried iSCSI MCS as I had just one network. I don't think it'd work.

![iSCSI MCS](/assets/images/windows-server-2028-preview-05-windows-2028-iscsi-mcs.png)

Detailed properties for MCS:

![iSCSI MCS details](/assets/images/windows-server-2028-preview-06-windows-2028-iscsi-mcs-details.png)

On SolidFire, I created two volumes: one 1GiB, with emulated 512 sectors, and one 2GiB, with native 4096 sectors.

![Windows Server 2028 with SolidFire iSCSI](/assets/images/windows-server-2028-preview-07-windows-2028-iscsi-solidfire-12.png)

CHAP and VAG both worked. I used CHAP here. I enabled the CRC/Checksum options that are disabled by default.

![Windows Server 2028 CHAP iSCSI with SolidFire](/assets/images/windows-server-2028-preview-08-windows-2028-chap.png)

I got greedy and tried to enable MTU 9000 although I knew my network wasn't ready, and I had to re-install SolidFire because I fubared the network by changing MTU on a live cluster.

After that, I re-installed and logged in with CHAP.

![Windows Server 2028 iSCSI connected to SolidFire](/assets/images/windows-server-2028-preview-09-windows-2028-iscsi-connected.png)

After connecting, I brought the two volumes online.

![Windows Server 2028 disk intialization](/assets/images/windows-server-2028-preview-10-windows-2028-disk-initialize.png)

NTFS and ReFS, both with 64KB unit allocation size, were used to try non-default options:

![Windows Server 2028 disk ReFS and NTFS on SolidFire](/assets/images/windows-server-2028-preview-11-windows-2028-solidfire-refs-ntfs.png)

I downloaded some software, saved it to the SolidFire volumes and installed from there. I did not notice any problems.

## PowerShell and SolidFire.Core

PowerShell 7.6.9 is included, but it will likely be updated by the time Windows Server 2028 ships.

You don't need to run SolidFire PowerShell Tools (SolidFire.Core) on Windows Server 2028, but at this time, it can be installed.

Install it from [PowerShell Gallery](https://www.powershellgallery.com/packages/SolidFire.Core/12.3.0.81):

```powershell
Install-Module -Name SolidFire.Core 
```

And it worked.

![SolidFire.Core PowerShell module](/assets/images/windows-server-2028-preview-01-solidfire-powershell.png)

## Windows Admin Center

The good news is the worst-maintained piece of Microsoft software I've seen in my entire life has been modernized.

The bad news is [the SDK is still not ready](https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/extend/develop-gateway-plugin).

![WAC SDK](/assets/images/windows-server-2028-preview-03-solidfire-wac.png)

Why is this a topic? 

Because [SolidFire WAC Gateway](/2025/07/26/solidfire-windows-admin-center-gateway.html) was among the better ideas I had for SolidFire. But WAC was so hard to work with, so eventually I [abandoned](/2025/09/08/solidfire-wac-gateway-client-powershell.html) the idea to build a WAC plugin and that PowerShell approach became the only way to access the gateway API. It's still a great idea, though, as it fixes RBAC and improves multiple aspects of SolidFire experience.

If the new SDK was ready, I'd be willing to give it a try. At the same time, I've received zero feedback for the previous work, so there's no reason to keep an eye on this.

## Conclusion

Still the best NetApp block storage system.

And it appears to work fine with Windows Server 2028 Preview.

![Windows Server 2028](/assets/images/windows-server-2028-preview-12-windows-2028-solidfire-powershell.png)
