# Azure Linux with SolidFire iSCSI targets

How to use Azure Linux as iSCSI client with SolidFire

Now that [Azure Linux is out](https://www.theregister.com/2023/05/26/microsoft_azure_linux_container/), maybe some SolidFire users wonder if Azure Linux iSCSI can connect to SolidFire targets?

I don't think there are many such users out there because although Azure Linux can run anywhere, it's probably going to be rare in on-premises environments. 

Because of that I'm not going to look too hard into that. Instead I'll do a quick documentation sweep.

First, iSCSI initiator is [available](https://packages.microsoft.com/cbl-mariner/2.0/prod/base/x86_64/Packages/i/):

- iscsi-initiator-utils-6.2.1.4+20210729.2a8f9d8-2.cm2.x86_64.rpm
- iscsi-initiator-utils-devel-6.2.1.4+20210729.2a8f9d8-2.cm2.x86_64.rpm
- iscsi-initiator-utils-iscsiuio-6.2.1.4+20210729.2a8f9d8-2.cm2.x86_64.rpm

While this seems like a no-brainer, don't take it for granted. Slim distributions often don't have iSCSI initiator built in.

Second, based on the information from [CBL repository](https://github.com/microsoft/CBL-Mariner), it seems some VMware Photon SPEC files have been reused in Azure Linux. 

I blogged about [iSCSI on Photon](/2022/03/11/vmware-photon-iscsi-solidfire.html) and got it to work with SolidFire. It wasn't trivial and without issues.

I haven't attempted to compare iSCSI from Azure Linux with Photon, but if anyone tries Azure Linux with SolidFire, maybe referencing that post on Photon may help them.
