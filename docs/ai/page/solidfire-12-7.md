# GA of SolidFire 12.7

What's new in NetApp SolidFire 12.7

SolidFire and eSDS (containerized SolidFire for 3rd party x86 servers) version 12.7 was released in late October, but I haven't blogged about it.

I won't rehash the official [What's new](https://docs.netapp.com/us-en/element-software/concepts/concept_rn_whats_new_element.html#element-12-7), but I'll copy the list:

- Secure CHAP algorithms
- Dynamic block (bin) sync-in rate
- Storage node firmware updates
- Garbage Collection improvement
- Scale improvement
- Storage node firmware update

Most users - especially NetApp Trident users - will benefit from the first improvement. In the past Trident users with RHEL-like OS version 8 or later had to modify iscsid.conf to hard-code CHAP algorithm to MD5. Now that requirement is gone as SHA1, SHA-256, and SHA3-256 are supported, too.

Some users without container workloads may find that a welcome security improvement, especially if they care about compliance rather than security (i.e. if MD5 is no longer allowed for new deployments in their environment).

This release also contains a bunch of bug fixes which can be viewed in [Release Notes](https://library.netapp.com/ecm/ecm_download_file/ECMLP2884468) (NetApp Support login required).

## NetApp Element Plug-in for VMware vCenter Server

The big news is vSphere 8.0 is now supported. Versions 7.0, 7.0U1, 7.0U2, 7.0U3 remain supported.

See the rest at [What’s new in NetApp Element Plug-in for VMware vCenter Server](https://docs.netapp.com/us-en/vcp/rn_whatsnew_vcp.html).

## How to update

Use HCC with Management Services v2.21.61 to download and apply updates. 

See the [Release Notes](https://library.netapp.com/ecm/ecm_download_file/ECMLP2884458) for additional details.

## No SolidFire Demo VM 12.7

Unfortunately Demo VM 12.7 will not be released.
