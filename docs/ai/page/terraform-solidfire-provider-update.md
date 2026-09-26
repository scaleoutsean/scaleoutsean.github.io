# Updated Terraform provider for SolidFire

Terraform provider for SolidFire has been updated

- [Introduction](#introduction)
- [What's new in 2025](#whats-new-in-2025)
- [Next steps](#next-steps)

## Introduction

Prior to NetApp's acquisition SolidFire had a Terraform provider for SolidFire for internal use. It was posted on Github, but never promoted to external users.

After SolidFire got acquired, I fought for it to be adopted and kept around as a "community" project, which NetApp has [done](https://github.com/NetApp/terraform-provider-netapp-elementsw) and that's been great. 

As usual with these things, apart from the guys in that "DevOps" team who helped set things up, no one ever contributed except me.

I was also told by some "experts" that "no one ever asked for it". 

Right. That's more than obvious from the stats (screenshot of https://registry.terraform.io/providers/NetApp/netapp-elementsw/latest was taken today)

![Terraform Provider for NetApp ElementSW](/assets/images/terraform-provider-netapp-elementsw-2025-07-25.png)

## What's new in 2025

Today I forked the provider. 

You can find the repo [here](https://github.com/scaleoutsean/terraform-provider-solidfire).

What's new? Nothing, really.

I updated the provider to latest OSS version of Terraform (which is the old v1.5.7).

Why not submit a pull request to upstream? 

There are several reasons. I briefly explained them in the new repo's README.md, but I can't use that file for blog-length post so here goes:

- As the only (albeit minor - just docs and examples) "contributor" to NetApp ElementSW provider, I couldn't know anything that's going on with that repo. That's not anyone's fault, it's simply due to the fact that it's managed by NetApp organization which I'm not part of
- However, that presented problems. As I couldn't know anything, it didn't make sense to try to do more (or anything at all). So I stopped trying.
- I also couldn't do anything crazy in there. Not that I plan to do it here (in my fork): what I really mean is it wasn't a place where one could screw around with experimental stuff, or even have a develop branch and ask the caretakers to spend time to manage my experiments or implicitly endorse my directions

Why now, especially since SolidFire doesn't have that much time left?

I just finished working on some S3/data pipeline (see the previous post, "S3 GO NATS") and Kubernetes was on my to-do list.

I wanted to revisit [Kubefire](/2024/07/05/kubefire-for-failover-failback-of-kubernetes-with-solidfire-backend.html) which kind of got stuck because - unlike Terraform provider for SolidFire - it had even less exposure (the concept, not the code) so, not knowing if anyone would use it (or otherwise get something out of it), I didn't feel the urge to complete the last 10% and publish the code.

As I was looking at it again, I reluctantly agreed in my head that having a better Terraform provider would be helpful.

Of course it'd be helpful, I've always known that - and that's why I contributed before - but who'd do it? That was the problem. 

That's why before I planned to create KubeFire completely outside of Kubernetes, using just a Kubernetes Python or CLI client. But when I looked at it again last night, I thought maybe I should do it better and resurrect that minimal SolidFire Operator example I have on Github.

Then I looked at it and recalled it was based on Ansible and Red Hat-backed [Operator SDK](https://sdk.operatorframework.io). Ouch. 

So I kept looking and hit the other wall - Kubebuilder is focused on Go.

Then I also looked at how I'd make KubeFire work with Trident (as we're talking about a tool that manages Trident resources, among other things) and it wasn't possible to escape the idea that having a Terraform provider for SolidFire would help.

Okay, then! But the problem with current NetApp ElementSW provider is that it's extremely basic and would need "bold" changes to make itself useful.

## Next steps

I need to see if I can do something in this area. Maybe yes, maybe not. I'd need at least the following:

- Cluster pairing
- Volume replication pairs
- QoS Policy
- Nice-to-have
  - Volume resize
  - Volume clone
  - Volume snapshot
  - Schedules

The list obviously goes on - if anything is free, anything is nice to have. But it's not free. It requires an effort.

The first three are the minimum needed for replication i.e. KubeFire. So I may try that. Or QoS Policy, which is unrelated but:

- Needed for anyone who uses the provider as-is
- Probably easier for beginners
- Needed to potentially enable dealing with Trident's lack of ability to [retype](/2024/06/03/pvc-volume-relationships-in-solidfire-trident-part-2.html) SolidFire volumes which has annoyed me for a while. You can do this today only with OpenStack Cinder CSI (in the context of SolidFire)

What I've already done is updated the sucker, which is better than nothing. And it took me seconds to publish because I can simply `git push` as I please. If you use Terraform v1.5, you can maybe fork this and add own stuff. 

If I manage to add anything substantial to it, I'll spin another version and maybe even get to use it in KubeFire. That's the best case scenario.

In addition to that, I have some other ideas and use cases for SolidFire provider, but more on that if I manage to move the needle first.

P.S. If you use Prometheus with SolidFire - [SolidFire Exporter](https://github.com/mjavier2k/solidfire-exporter) has been updated and added a feature related to monitoring of bulk volume jobs. The retype link above explains why that's useful (and that's what reminded me of the this update).
