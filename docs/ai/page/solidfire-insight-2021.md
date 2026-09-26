# SolidFire highlights from NetApp INSIGHT 2021

SolidFire from NetApp INSIGHT 2021

In the case you missed NetApp INSIGHT 2021 and want to catch up with latest SolidFire developments, I recommend to consider some of the following sessions.

I can't reproduce any content without the written permission of NetApp, so no screenshots or verbatim details in this post - sorry!

## BRK-1096-1 - Building YOUR Cloud with NetApp SolidFire

SolidFire product managers introduce and demonstrate new features in SolidFire and eSDS ([link](https://www.netapp.tv/details/28332)).

Why: I wrote about SolidFire Protection Domains [here](https://scaleoutsean.github.io/2021/07/06/solidfire-protection-domains-data-path.html), and the feature isn't exactly new, but the session contains newer and different information. Also some good information if you're interested in eSDS (those who build infrastructure on Dell & HPE servers, for example).

Highlights: SolidFire Protection Domains and what's new in eSDS.

## CSS-1447a-1 - ProSiebenSat.1 Media SE: A View on Content-related Workflows

ProSiebenSat.1 shares how they use SolidFire, ONTAP FabricPool, and StorageGRID in their environment ([link](https://www.netapp.tv/details/28202); [auf Deutsch](https://www.netapp.tv/details/28188)).

Why: it is interesting to see how media customers make use of SolidFire and StorageGRID. Normally we wouldn't associate SolidFire with media workloads, but media workloads can require a lot of applications and batch jobs and  with media stored on StorageGRID, one still needs a place to runs container-based applications. I like how ProSiebenSat.1 addressed their requirements and for the same reason I've been such a big fan of [attaching E-Series to NetApp HCI](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html): at a certain point having more than one storage solution begins to save money and labor. Separately, if you're interested (especially readers from Germany), the last slide of the presentation contains a link to current ProSiebenSat.1 openings (as of October 2021).

Highlights: SolidFire QoS, Astra Trident, Kubernetes, Fabric Pool and StorageGRID.

## BRK-1137-2 - Higer, Faster, Stronger: CloudOne Embraces Speed-first Mindset

How NetApp approaches Private Cloud with end-to-end automated DevSecOps workflows and tools and the positive results observed from two years of operations ([link](https://www.netapp.tv/details/28202)).

Why: developers, developers, developers, developers! Get your infrastructure and workflows right to get most out of your most valuable resource (developers). It contains detailed information about tools and workflows used in NetApp's own hybrid cloud.

Highlights: ServiceNow, Red Hat Ansible, Red Hat OpenShift, Azure DevOps.

## BRK-1055-2 - Practical SolidFire Automation

Invest 25 min of your time to find out how to get started with SolidFire automation, then save much more than that and get more out of your investment ([link](https://www.netapp.tv/details/28319)).

Why: this presentation packs a lot in 25 minutes - from getting started with Postman to Ansible, PowerShell, Python and Terraform - and all source code used in the scripts is available, so you can easily recreate those examples. Only two examples weren't shown:

- Terraform example (because there are several files involved), but the good news is you can get it [here](https://scaleoutsean.github.io/2021/09/18/using-terraform-1-with-solidfire-12.html)
- Set-SFQoSException module (because its source code is too long to retype by looking at the screen) - you can find about it [here](https://scaleoutsean.github.io/2020/11/28/powershell-set-sfqosexception.html) and the source code is in [Awesome SolidFire](https://github.com/scaleoutsean/awesome-solidfire/tree/master/scripts) on Github

Highlights: Postman, Ansible, Python, PowerShell, Hashicorp Terraform.

## Customer Stories

In alphabetic order:

- [Calligo](https://www.netapp.tv/details/25366)
- [Carrenza](https://www.netapp.tv/details/25368)
- [Darz](https://www.netapp.tv/details/25369)
