# EConfig v2

See what's new in tools for no-BS-sizing for certain E-Series use cases

- [WTF is EConfig?](#wtf-is-econfig)
- [What's new](#whats-new)
- [How I use EConfig](#how-i-use-econfig)
  - [DDP](#ddp)
  - [BeeGFS](#beegfs)
- [Troubles](#troubles)
- [Conclusion](#conclusion)
- [Appendix A - BeeGFS sizer](#appendix-a---beegfs-sizer)

## WTF is EConfig?

EConfig is my site with currently two (unofficial) sizing tools (or utilities, or features, whatever):

- BeeGFS tool that he map BeeGFS data and metadata capacity requirement to E-Series RAID (or DDP) configurations.
- DDP tool that calculates capacity for any or either supported RAID level (1 or 6)

In 2022 I created the first version. 

Initially it was just for BeeGFS, based on the idea that, because there aren't a limited number of "good" configurations anyway, one could instead create a brute-force permutation of all "good" configurations and then just search through those, rather than size from scratch. 

Initially I used Jupyter as the UI but that was "too scientific". I had to do it on the Web and with JavaScript, so I did. Then later I added interactive forward sizing as well. 

Even later - may have been 2023 - I also added DDP sizing with the ability to split capacity by RAID 1 and RAID 6, which is highly relevant to NOSQL and analytics use cases that I often blog about here. (Relevant for me - not that I've ever heard anyone said it was relevant to them.)

What I didn't waste time on was design. It was plain and - to my surprise - 2-3 months ago somebody even told me it sucked on mobile. Ouch. I'd never even tried it on mobile!

Other challenges included lack of support for 22 TB drives (E-Series added them a few months ago) and the inability to use more than 10 arrays. I didn't expect I'd hit that limit, but I did - just last month. 

## What's new

- Completely new design - it looks a bit too fancy, but that's not the point: the point is that it still retains the density and doesn't require much scrolling (on desktop)
- It sucks less on mobile
- There were bugs. Bugs were fixed. New bugs were added
- I did a bit of "QA" on DDP sizing tool and accuracy is quite decent, at least for DDP sizer
- 22 TB disk size added to BeeGFS sizer

What about those bugs? 

There were sizing bugs and there were UI annoyances (such as rounding). I don't think it's a big deal - those tools aren't meant to be used for production or purchasing-related sizing in the first place. 

The idea has always been to get an approximate picture of what's a configuration supposed to look like - say we'll go with 7.68 TB drives and 15% in RAID 1. That kind of thing. If you don't need 24 drives to meet that requirement, then even if final "commercial" sizing needs to add an extra drive, that won't force a change from 7.68 to 15.36 TB drives. 

You may need to use 17 rather than 16, but so what? You would have used 17 anyway, but using EConfigs has saved you 20-30 minutes.

## How I use EConfig

### DDP 

Say I need 7 TiB in RAID 1 and 34 TiB in RAID 6.

Most people I know still create classic RAID groups: RAID 1 (2 x 7.68 TB, maybe) and a RAID 5 (8+1, using 7.68 TB disks, etc.).

I go to EConfig and use DDP sizer for NVMe. In approximately 60 seconds I have my answer:

- 20-disk DDP (1 disk worth of preservation capacity is fixed in this tool, given it's for NVMe SSDs). 19 disks also works, if we need no room for growth
- 25% of usable DDP capacity will be allocated to RAID 1 volumes

![](/assets/images/econfig-v2-ddp-nvme-sizer-example.png)

Now compare this to fiddling with classic RAID configurations or other alternatives... 

### BeeGFS

I find out what the objective is - highest performance, lowest cost, etc. 

Say we need 10 PiB with focus on cost.

Then I start with RAID 6 groups and 12 TB disks and see how much I can get from one array. If it's not enough, I go to larger disks (e.g. 22 TB), if it's too much, try smaller (8 TB). 

Since current E-Series models can't configure 10 PB usable even with 22 TB disk drives, I'd probably go for 5 PiB and 2 arrays. 

You can see this output in Appendix A.

The entire process takes around 60 seconds. If satisfied, I would perform "official" sizing, but not before that as the idea is to minimize the time spent on using the official sizing tools.

## Troubles

Cloudflare, where EConfig runs, can be flakey. After this update I often get Error 500 (Internal Service Error) on initial access (hitting F5 "fixes" it, but most people probably just leave at that point).

Before EConfig v2 I used to get a "frozen" site with EConfig v1 (also required F5 to "fix" it) and I thought that was bad. Well, now is worse. 

The same app running on NodeJS locally runs without any problem, so I'm sure it's not the app. And I noticed that this year other Cloudflare Web site owners have complained about this problem, too.

## Conclusion

EConfig probably still has some bugs, but the sad truth about sizing is you never do it just once. 

Using official sizing tool only as the last sizing tool before hand-over lets me iterate using my own tools and save a ton of time even if the final configuration is off by a little - a disk or two can be added in the last iteration.

EConfig saves time and cuts down on turnaround time. It's suitable for Web meeting use and solutioning iteration. 

It's not perfect and it has room for improvement, but I don't use it *that* often, so I won't touch it until larger disks come out or some bugs need to be fixed.

## Appendix A - BeeGFS sizer

Screenshot from BeeGFS sizer is vertically large, so I put it here.

![](/assets/images/econfig-v2-ddp-beegfs-sizer-example.png)

Most HPC environments use RAID 6 (as in this screenshot), so BeeGFS sizer in EConfig defaults to RAID 6 and does not allow arbitrary RAID group widths - it's fixed to 10 (8D2P).

If DDP is selected, you can choose 11-60 drives which is common for 60-drive controlles and DE460C expansion enclosures.

Further below that screenshot there's a metadata sizer.

![](/assets/images/econfig-v2-beegfs-sizer-md-example.png)

Here you enter usable BeeGFS capacity in TiB and MD capacity as a percentage of that number.

Using "generic" assumptions for the number of files per unit of metadata storage capacity, metadata sizer gives estimates for RAID 10 capacity (TiB) which can be sized in DDP sizer or looked up in the "brute force sizing" table, and an estimate for the maximum number of files.
