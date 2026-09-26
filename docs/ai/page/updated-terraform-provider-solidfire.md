# Terraform provider for SolidFire update for Feb 2026

Big updates to Terraform provider for SolidFire

## Introduction

[Last July (2025)](/2025/07/25/terraform-solidfire-provider-update.html) I forked the dead Provider for ElementSW for the reasons explained in that post.

Anything come out of it? Let's see.

## What's new in Feburary 2026 (and since July 2025)

Last July I started working on that fork by building things from scratch. Upstream had several basic resources, so I didn't start completely from nothing. Still, I had to add new API calls one by one and test. That was fine for incremental improvements, but not much more than that.

By late 2025, I didn't feel very happy about the progress of that, or the progress of Trident CSI's solidire-san backend-related features (which was one of the main use cases for Terraform Provider for SolidFire: I wanted to use in a failover/failback solution (Kubefire) for Trident CSI, as I explained in the post linked at the top).

In 2026, I revisited the old SolidFire Go SDK (more on that in another post) and [revitalized it](https://github.com/scaleoutsean/solidfire-go).

This weekend I've just completed a refresh of Terrform Provider for SolidFire. Now, it uses SolidFire Go SDK and that has been a huge improvement.

Not only does it serve as a solid base for the provider, but it also makes development faster. And beucase of the same Go SDK that I share across multiple projects, a **major** difficulty has been overcome. If there's a problem (I've seen very few), I simply update the SDK and it's fixed for all my downstream projects.

So, specific to my Terraform Provider for SolidFire:

- Additional SolidFire "resources" have been added to the provider, making the provider not just a "one trick pony" that it's been for close to a decade.
- Official [Terraform Plugin Testing](https://github.com/hashicorp/terraform-plugin-testing) has been integrated in the repository, making testing easy and functionality provable.
- Various tests run smoothly, **including** cluster and volume pairing, something that's been my personal holy grail of DIY solutioning ever since I realized that [10s site failover](/2021/03/20/kubernetes-solidfire-failover-failback.html) was possible.
- Provider documentation has been created. The main repository README itself is out of date, but the documentation isn't.
- Examples: several real-life examples have been added, including a recipe for SolidFire cluster failover/failback (with cluster and volume pairing).
- See change log for version v0.3.0 in the Github repository to find out more.

In short, we have (basically) everything for Day 1+ terraforming with SolidFire API endpoint 12.5 now.

This screenshot shows volume pairing has been set up and initial sync is in process.

![Terraform Provider SolidFire setting up volumeReplication](/assets/images/terraform-solidfire-2026-02-replication.png)

On my SolidFire Demo VM, this takes a few minutes (approximately two), but that's because volumes are empty and normally it'd take longer, but I don't have to concern myself with that when testing.

Once volumes are in sync (or idle, in case of snapshot-only replication), I can reverse the direction of replication in seconds, and the new "active" side is ready for read-write access as soon as that API call returns. This is why - even when a Kubernetes pod start up time is counted - failover takes mere seconds.

## Next steps

Last year, I just wanted to add several resources to get that KubeFire thing done.

Now, things are looking better than ever. Even failover and failback work. Several seconds in either direction.

My main objective has been Kubernetes, but a volume is a volume.

Want a solution for site replication and DR for Hyper-V or Proxmox?

That's probably just a day of work now, with Terraform Provider for SolidFire!

If you use another tool to manage storage (such as my fork of [SolidFire Collection for Ansible](https://github.com/scaleoutsean/netapp.solidfire), or [Firemox](https://github.com/scaleoutsean/firemox)), you wouldn't use this Terraform provider. You'd use Ansible for the whole thing in the former, and something like [Longhorny](https://github.com/scaleoutsean/longhorny) in the latter case. But if you manage your entire (compute and storage) stack with Terraform and "manually" consume storage, Terraform Provider for SolidFire can probably manage storage volumes for you.

By the way, today I've updated Longhorny's "volume report" feature that shows replication status between sites. Even if you use Terraform Provider for SolidFire to manage volume pairings, you can still use Longhorny to view their status (you don't need to use the management features to avoid conflicts with Terraform state). You can also monitor replication with [SolidFire Collector](https://github.com/scaleoutsean/sfc/) that stores data in InfluxDB 3 and can be visualized anywhere (Grafana, for example).

![Longhorny Replication Report from February 2026](/assets/images/longhorny_report_202602.png)

What about Kubernetes, you might ask? More on that in another post.

Terraform Provider for SolidFire is no longer a toy. Get the provider here: [Terraform Provider for SolidFire](https://github.com/scaleoutsean/terraform-provider-solidfire/).
