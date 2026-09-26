# This blog in 2025

About this blog and personal projects in 2025

## This blog in 2025

I can't resist and have to make some comments on general "blogosphere" in 2025.

AI was a big topic among not-for-profit bloggers this year. Some concerns that I've observed among bloggers:
- Bots and scraping can consume more resources than actual users.
  - Valid concern. This was bad a decade ago. This currently doesn't personally impact me on Github since I don't pay hosting expenses, but it is annoying.
  - It's not entirely true that this doesn't affect me. I'd host this blog on a proper full-service VM but don't precisely because I know 80% of the cost would be spent on serving bots. So, for example, I now use CloudFlare for hosting econfig.pages.dev - which I'd prefer to run on my blog/site rather than elsewhere - and I do not have 2-3 other similar sites because it'd be just more CloudFlare sites and more maintenance. Because of bots and scraping, I have a minimal, static site and so do many others.
- Search engines and AIs recycle content without sending users to authors' sites.
  - This started with Google's caching and summaries, but is much worse now.
  - This isn't always the case as main AIs provide links to sources, but I think not even 10% of users follow click on such links when they get the information they need up front. This isn't a big factor for me because I don't collect ad revenue, followers, leads, etc. 
- Tons of sites and blogs with AI-generated content - sometimes scraped by bots - "competes" for readership and SEO ranking. It's not new, it's just worse than before.

In short, things are worse, but not much worse because I've seen it coming some time ago. 

Bloggers who try to recover the cost of the time they put in maintenance and writing (and don't use AI to generate junk content) are probably not very happy with how this year went down. Although I don't host on CloudFlare, I like CloudFlare's anti-bot features which don't solve the problem, but cost nothing and help more than nothing.

On the personal side, I'm happy that I've managed to do some of the things I'd wanted to do for years, including not just an update of E-Series Performance Collector, but also a "special" (and extra-large) version of it, E-Series SANtricity Collector.

I also like that I managed to take a closer look at Proxmox 8 and its plugins, released Firemox - a CLI tool for Proxmox with SolidFire - and forked and improved Terraform Provider for SolidFire (I posted just one post about that, but the Github repository is making progress).

BeeGFS also got enough attention in 2025. After version 8 came out, I covered its advanced features including notifications, implemented antivirus scanning, wrote some analytics/pipeline related posts (gRPC-related) and so on. I also published a Docker Compose stack with all-in-one BeeGFS, S3 and NFS - something I'd wanted to do since I blogged about it years ago.

One very nice "full-stack" piece of work was [S3 GO NATS!](/2025/07/23/s3-vector-search-02-diy.html), but I never recorded any live demos of applications *searching* those indexes. I don't even remember where that source code is - somewhere in a git repository, in some shut-down VM or elsewhere, but I'll try to find it and do more with it. It's been five months since I created that and I haven't seen any better vector search-related solution for StorageGRID, either official or community-made.

What didn't work out:

- Kubefire - my site failover for SolidFire-backed Trident CSI. I almost finished it last summer, but it wasn't "nice" enough, so I paused and decided to do it differently. I'm trying to see if I can use Terraform SolidFire Provider to make that a bit more reliable and faster.
- One big annoyance of no practical significance was Bing. Months ago it simply [dropped this blog](/2025/08/11/bing-index-issue.html) from 99% of searches. After that I overhauled SEO which didn't help, so I just gave up. This week I noticed several referrals from Bing and realized it has partially recovered, many months after the fact. Notice how it kept showing this blog in search results, but maybe just once or twice a week. Funny.

![Bing is back](/assets/images/meta_04_seo_bing_2025.png)

### Popular posts in 2025

The top post was [this post](/2024/05/10/remove-password-complexity-ubuntu-2404-lts.html) about removing the annoying password complexity requirement on Ubuntu. Completely unrelated to anything, but apparently I wasn't the only one annoyed by this idiotic "feature". (I have to say again, my favorite RHEL and Rocky feature is that I can use simple passwords.)

[This](/2022/03/17/ontap-s3-performance-test.html) post about ONTAP S3 performance with small files got a lot of hits. Official NetApp blogs have similar content, but it focuses on large sequential workloads.

After that comes a variety of posts on E-Series, Velero, BeeGFS, MinIO, SolidFire - all sorts of stuff, really. It's nice to see that a lot of "niche" content got decent exposure.

## Topics of interest for 2026

Some topics I'm eager to explore in 2026:

- Automation with E-Series
  - Ansible. I don't like it, but it exists and BeeGFS with E-Series uses it as well, so maybe I'll do something with it outside of BeeGFS
  - MCP (I've created a working prototype, [Easy-E](/2025/09/13/mcp-for-netapp-eseries.html) (which also powers [MCP TAPOUT](/2025/10/15/mcp-tapout.html)) and will build upon it)
  - Agentic AI
  - I have a few other ideas...
- Virtualization and containerization on E-Series and SolidFire
  - Complete and publish Terraform SolidFire Provider and Kubefire
  - Explore VI, K8s, and SDS (S3, NFS and other) with E-Series
- BeeGFS and E-Series
  - Integrate BeeGFS monitoring with E-Series Performance Analyzer or E-Series SANtricity Collector
- Databases on E-Series
  - NOSQL, NuSQL
  - K8s operators for RDBMS 
  - E-Series in data lakehouse solutions

### Automation and integrations

I want to bootstrap automation (without Ansible, if possible), get some help from AI and iterate with that. 

Earlier today I [wrote a separate post](/2025/12/22/reautomating-eseries.html) on that part. A lot more could be done if just half a dozen people contributed, but I don't remember ever seeing anything since I've started this blog so I won't hold my breath. 

### Databases

Databases on E-Series are laughably neglected, given how well E-Series works with modern databases. E-Series does lack some quality-of-life features, but at the same time provides awesome performance and doesn't miss any important fatures. Lots to explore in 2026! 

Modern databases have compression enabled by default, run 2 or 3 replicas and don't rely on snapshots for recovery. Where we need some help, we can get it from OSS or AI. We don't need anything else.
