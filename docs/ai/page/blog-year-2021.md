# This blog in 2021

About this blog in 2021

<!-- TOC -->

- [Top posts](#top-posts)
  - [Number one](#number-one)
  - [Number two](#number-two)
  - [Number three](#number-three)
- [Top referrers](#top-referrers)
- [Top countries](#top-countries)
- [Personal favorites that have and haven't been written in 2021](#personal-favorites-that-have-and-havent-been-written-in-2021)
  - [solidbackup](#solidbackup)
  - [Structured SolidFire logging](#structured-solidfire-logging)
  - [MIA](#mia)
- [Other](#other)

<!-- /TOC -->

As noted in [About](/about.html#privacy), I use privacy-orientated log analytics which collects some vary basic details about what's going on here.

I don't see - and don't want to have - the visitors IPs, domains and other details, but I can see what roughly matters to me, and that is what posts are visited and where (country-level coarseness) the visitors are coming from.

I don't blog with the objective to maximize the number of visitors and such - I really just want to see if something is or isn't necessary to blog about. So as 2021 is about to expire, here's what I see.

## Top posts

### Number one

Surprisingly, the [post on SolidFire SNMP v3, Telegraf, Prometheus and Grafana](/2021/08/13/solidfire-snmp-v3-grafana.html) is my most visited post. I suspect that is completely unrelated to SolidFire, but related to Telegraf, Prometheus and Grafana which people search a lot for troubleshooting purposes and how-to notes.

It is useful for old school SolidFire monitoring (with SNMP), but I doubt that many SolidFire customers use that, and my ["megapost"](/2021/07/19/solidfire-mib-snmp-monitoring.html) on SolidFire and SNMP - which explains some very necessary details related to SolidFire monitoring with SNMP - had 70% fewer visitors. But hey - anyone who wants to read the blog is welcome, that's why it's here rather than sitting on some company-internal Web site!

### Number two

The [Velero with SolidFire post](2021/02/08/use-velero-with-netapp-solidfire-and-trident-csi.html) was close second. Also not related to SolidFire as much as it is to Velero with Trident CSI - I didn't look, but I may be the only person out there who blogs about this.

[Velero with StorageGRID S3](/2021/02/02/use-velero-with-netapp-storagegrid.html) was number five, as NetApp no doubt has StorageGRID customers who don't use SolidFire, but have Tanzu or other Kubernetes.

### Number three

Further down the line, about [NGINX ingress for Rancher on NetApp HCI](/2020/12/14/netapp-hci-rancher-ingress-nginx-plus-lets-encrypt.html). I guess this is the same thing - that stuff is still too hard to configure. And there are many ways to do it, so even if you find a post with the notes that work, it may not be about the exact way you want to configure it, so once you start searching you need to read ten different how-to's and documents to get anywhere. Really sad, but yes - welcome to Kubernetes...

Other than this post, other Kubernetes posts that got some attention were those on Kasten K10 and SolidFire site failover for Kubernetes.

## Top referrers

- Google - 59%
- Unknown - 13%
- Bing - 7%
- DDG - 5%

Unknown means email or other sources. As mentioned above, I don't know (and don't care to know).

## Top countries

- USA - 25%
- Germany - 8%
- India - 7%
- Japan - 6%

I'm in APAC so I hope to see more APAC visitors, that's why I care about that one and I'm happy to see India and Japan among the top four countries.

## Personal favorites that have and haven't been written in 2021

### solidbackup

I'm very happy with [solidbackup](/2021/05/08/revisiting-solidbackup.html)-related work and resulting scripts written in PowerShell and Ansible (finally, a use case for Ansible).

I think that's a pretty decent approach for building a Web based DIY backup service for SolidFire in small to medium on-prem Linux and Kubernetes environments. Not that the code shouldn't be rewritten for production use, but the approach is good and works okay as-is. Of course, with popular and well tested free solutions like Velero already doing that and more for Kubernetes, there's little reason to use solidbackup over that. But solidbackup can be used with KVM and possibly OpenStack, and it can be easily customized without the knowledge of Go, which can't be said of Velero when using a comparable (non-CSI) approach (Velero with Restic).

In the process I also worked out a mega-post on SolidFire's Backup-to-S3 feature, together with API examples and two decent PowerShell scripts.

### Structured SolidFire logging

The other group of posts that I'm very happy about are Elastic-related posts, especially for SolidFire.

Last year as I did demos with syslog forwarding to Graylog and ELK, I just didn't have the time and a reason to look into structured logging, but this year I finally got the both and took care of this when I heard of a customer who needed this in their environment.

And leveraging that work (I already had ELK in place) I added a post on StorageGRID-related logging and the rewritten [SGAC](/2021/10/20/sgac-storagegrid-audit-log-converter-v0.2.1.html) came extremely handy for that (as well as half a dozen other situations in past last eight weeks) - excellent ROTI (return on time invested)!

Last summer I picked another chance to get involved in helping a customer with SolidFire (NetApp HCI, in fact) monitoring, which was for SNMP-related stuff. That gave me a reason to research and document SolidFire's SNMP-related integrations - another necessary but very neglected area that I'd been wanting to revisit for two years. And some of those posts are among top 10 popular posts on this blog which shows they also have some appeal to non-SolidFire users. Great!

### MIA

I wish I've had the time and a reason (that is, a customer who needed this) to do more with SolidFire failover for Kubernetes. I wrote a post on that, but it was a very long "research style" post and "part two" - for which I had the scripts almost done, but never published them - was supposed to condense that research-style content into an easy-to-digest post with PowerShell failover scripts, but that hasn't happened.

I hope I'll be able to find a recent copy of those scripts and publish part two sometime in 2022, because SolidFire is such a great iSCSI storage platform for Kubernetes.

## Other

I can't see absolute numbers because I deliberately limit data collection in both scope and duration, so above is based on previous 30 days.

Aside from this blog I've managed to add content to my YouTube channel, stand up a dedicated "Kubernetes with SolidFire" micro-site, and maintain a handful of Github repositories with various scripts and curated SolidFire resources (`awesome-solidfire` gets visitors almost every day).

In terms of reaching my personal goal for this blog - which is to help people get more out of their investment by throwing additional light on under-documented or novel integrations and use cases - I am happy with what I've achieved in 2021.

To paraphrase the motto of this blog - improvements happen when individuals engage in purposeful behavior. More to come in 2022!
