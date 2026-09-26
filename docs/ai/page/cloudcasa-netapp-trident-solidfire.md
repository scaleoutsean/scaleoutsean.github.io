# CloudCasa, Velero, NetApp Trident, and SolidFire

Commercially supported Web UI for Velero

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Conclusion](#conclusion)
- [Introduction](#introduction)
- [Does it work with Trident and SolidFire?](#does-it-work-with-trident-and-solidfire)
- [How does it work?](#how-does-it-work)
- [Summary](#summary)

## Conclusion

If you're a Velero user or would like to use Velero if it had a Web UI, give Cloud Casa for Velero a try.

## Introduction

CloudCasa added Velero support in this (April 2023) [release](https://docs.cloudcasa.io/help/relnotes-04-2023.html). Check the link if you're curious about the details.

## Does it work with Trident and SolidFire?

I've no reason to think it doesn't. 

## How does it work?

Unlike Kasten K10, CloudCasa's control plan is a shared managed cloud service. You register for service, and see an empty dashboard.

![Initial CloudCasa dashboard](/assets/images/cloudcasa-01-empty-dashboard.png)

Then you add your clusters - one or more.

![Add cluster button](/assets/images/cloudcasa-02-add-cluster-button.png)

In my case I had a singleton cluster deployed two months ago, so I tried to reuse it.

![Add cluster modal](/assets/images/cloudcasa-03-add-cluster-modal.png)

Then you get a command that deploys a CloudCasa agent and hooks it into cloud service.

![CloudCasa agent installation](/assets/images/cloudcasa-04-agent-install-with-kubectl.png)

My cluster with NetApp Trident and Cloud Casa agent installed:

![CloudCasa agent installed](/assets/images/cloudcasa-05-installed.png)

Within seconds results of that action start appearing in the Web UI.

![Cluster registration successful](/assets/images/cloudcasa-07-registered-cluster.png)

Where does Velero come in? 

I installed it on my own before I installed CloudCasa agent. During that time I also installed Velero S3 plugin and registered on-prem S3 storage. That's why the same is now visible in CloudCasa Web UI.

![Registered Velero backup storage](/assets/images/cloudcasa-07-registered-storage.png)

Create one or more backup policies to be able to run backup jobs.

![Create backup policy](/assets/images/cloudcasa-08-backup-policy-create.png)

CloudCasa also has detailed RBAC support with very granular details. Two roles are pre-created, but they can be cloned and literally tens of different roles could be created from a cloned User template.

![CloudCasa RBC](/assets/images/cloudcasa-09-role-rbac-example.png)

I suspect this may be a bug, or an assumption that flew right above my head: "Velero Snapshot Location" doesn't do much, but it seems it's supposed to do something.

Similar to other Kubernetes backup solutions, CloudCasa can also backup an entire cluster. This screenshot shows a backup of an individual namespace confined to Deployments and PVCs. 

(I did not select Snapshot because I did not install Velero with CSI plugin, and I would expect CloudCasa to dim the Snapshot option because it should be able to "see" that CSI snapshots are not available.)

![CloudCasa backup job options](/assets/images/cloudcasa-10-backup-cluster-example.png)

As a reminder, with Trident CSI and SolidFire, snapshots could be cloned and then mounted for backup which would export (save) them to S3. But it's hard to tell what this is supposed to do.

![VSL - Velero Snapshot Location](/assets/images/cloudcasa-11-backup-velero-snapshot-location-weirdness.png)

Here's an example of Velero-Kopia-based backup of the entire cluster.

I wrote about Velero & Kopia [here](/2023/02/17/velero-1-10-with-trident-solidfire.html) and as far as CloudCasa is concerned, I only expect it to surface Velero logs in the UI, so I didn't spend much time on trying to find out where the two errors came from - I'm sure it wasn't from CloudCasa.

![Kopia-based backup](/assets/images/cloudcasa-12-backup-kopia-done.png)

There's an interesting-sounding Security Scan feature, but sadly it's supported only on AWS.

![Security Scan is AWS-only](/assets/images/cloudcasa-13-security-scan-aws-only.png)

After some activity, dashboard looks a bit more interesting, with alerts, activity details, storage utilization, etc.

![CloudCasa Dashboard](/assets/images/cloudcasa-14-dash.png)

Notice how "Size of protected DBs" shows Google, Azure, AWS but not my local S3 storage configured for Velero. I assume this is another "Work-in-Progress" item.

Similar to that VSL setting, this below is another strange-looking setting. Presumably this should show whatever I registered in Velero (I registered my local Object Store), but it doesn't. 

I suppose most CloudCasa customers user CloudCasa-managed AWS S3 buckets, so CloudCasa haven't spent much effort testing custom storage options.

![User-defined storage option](/assets/images/cloudcasa-15-settings-non-default-storage-options.png)

CloudCasa-manged AWS and Azure options appear to work fine, so it's only User-Provided Storage options that are problematic.

![CloudCasa S3](/assets/images/cloudcasa-16-storage-options.png)

## Summary

CloudCasa makes Velero usable by non-experts and makes it easier to manage multiple Velero clusters. 

Among NetApp storage arrays, Trident CSI supports SolidFire and ONTAP, but E-Series works with vSphere CSI and all I tested E-Series with some Direct CSI community plugins as well. Velero should work with all these CSI providers, so all NetApp arrays ought to work as well.

This is CloudCasa's first release with Velero support, so I guess the two problems I spotted are likely "v1.0" (in terms of Velero integration) issues.

The installation is easy, their UI is responsive, RBAC is good, and Velero is sufficiently exposed to not "lose" power users. 

I didn't do much experimenting with various Velero settings to see how they're recognized (or not) in CloudCasa, but it appears there isn't much distinction between CSI vs. non-CSI approaches although there should be, because when I installed Velero I didn't even enable CSI (I could have, see my older Velero-related posts) and yet CloudCasa appeared to assume CSI was used and that maybe what caused the empty "Velero Snapshot Locations" drop down list.

I assume these details will be improved in subsequent versions. Cloud Casa is already an interesting option for Velero + Kubernetes users on premises and in the cloud.
