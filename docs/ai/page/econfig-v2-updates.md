# E-Config v2 updated for QLC drives

E-Series Performance Analyzer 4 is coming

## Introduction

I don't write much about E-Config (see it in [Projects](/projects.html)), but among my projects I like, this is one of the few that I use on a regular basis.

I also like Firemox very much, for example, but I haven't used it since I posted the source code to Github as I use PVE only if a customer needs something PVE-related, which hasn't happened since I released Firemox. 

E-Config I use at work, so among all the things I work to put out there, this one I get to use every now and then. 

E-Config version 1 started with "brute force sizing" (which was an attempt to remove unnecessary use of official E-Series sizing tool by being able to search all possible configurations in under 1 second).

I initially [implemented that](/2022/09/04/brute-force-sizing-netapp-eseries.html) for CLI and Jupyter, but since no one I know (including myself, although I've built some Jupyter demos like that [PowerShell-based Jupyter for SolidFire](/2022/03/29/manage-solidfire-jupyter-powershell.html) notebook that I share in the Awesome SolidFire repo) uses Jupyter, I moved to a Web-based approach.

In version 2 I improved the UI and added some other stuff, but the brute force sizing table is available in E-Config even today.

One disadvantage it had - which I discovered too late - was that when the page that loads that sizable JSON file would often result in 500 error and that happened only only in production (why, I suspect the NodeJS process gets killed with OoM). A single hit on F5 would fix it as the file would already be cached on the client on second attempt, but it was annoying. Other pages weren't affected, and in testing it never happened either. 

Why fix it now?  

- last week E-28 and E-57 got End-of-Sale'd and those were mainstream models
- earlier this year EF300C and EF600C (both with QLC drives) were launched
- earlier this year 24TB NL-SAS drives were added for EF300 (Hybrid) and EF600 (Hybrid)
- earlier this year E4060 and E4012 were launched

So I not only wanted to fix that error, but also re-generate brute force sizing JSON with the new models, without the End-of-Sale models, and with the three new disk sizes (two QLC and one NL-SAS).

## What's new

### Updated: BeeGFS capacity sizing (and generic brute force sizing)

First, brute force sizing on the BeeGFS sizing page has been refreshed. I did some checking/testing/verfication and they were correct. 

What wasn't correct was the formulas got more complicated due to the silly restrictions in EF300C and EF600C (for example, these allow only DDP and not RAID - super smart!). I think I fixed those, but maybe you'll see an EF600C with 40 drives (impossible configuration, of course) which should be ignored. 

Remember, E-Config isn't an official sizing tool - it serves to do 80% of "ballpark" sizing in seconds, and for final sizing use the official tool. As long as you recognize any obviously wrong examples (which are easy to recognize), the subtle errors should not be there. 

One thing to note - and I do note it on the site - is that brute force sizing generally over-reports usable by around 2% compared to the official tool (I a dozen comparisons to see how big the differences are). I think this is due to actual drive sizes not being "8 TB", rounding errors, and the like. The sizer doesn't exist to give super-precise sizing (although I could do that by tampering with sizing formulas). It serves to narrow down our E-Series sizing to the number of arrays, RAID groups (or DDPs) and disk sizes, and it lets you do that in seconds.

### Updated: DDP capacity splitter

For all EF-Series models, this thing existed before, but now was refreshed with 30.72 TB and 61.4 TB (example of the "rough" sizing which loses 0.04 TB per disk and makes my sizing "wrong") QLC disks.

![NVMe DDP Sizing Splitter](/assets/images/econfig-v2-ezraid6-and-qlc-update-01-qlc.png)

It can be used for any DDP on SSDs (since the capacities are for SSD media), but NVMe on EF-Series is the main use case.

### New: ez-RAID6

This thing is new. While working on disk and model updates, I noticed I had an empty "/raid6" directory on my Web site. It wasn't linked from the menu. I had started working on that some time ago, but never completed it. Well, it's done now.

![ez-RAID6 feature on E-Config](/assets/images/econfig-v2-ezraid6-and-qlc-update-01.png)

Long story short: this is useful to me for sizing RAID 6 capacity and environmental sizing matters. It doesn't matter which E-Series array. All I care is about the boxes - how many DE460C (or controllers based on them, such as E4060) and how many DE212C's (2U, 12 3.5" drive slots).

If I need 400TB in R6 volume groups, I want to see what my options without screwing around with 2FA and having to pick a model/array that I want to use. Many times I *don't know* which model I want to use - that depends on how optimal sizing and other circumstances are - so that selection sometimes just serves to annoy me and waste my time. I can take ez-RAID6 results to the user, discuss the right disk count, capacity and the "boxes", and decide on the controller/model later.

For that, E-Config works better than anything that's out there.

What I see people often do is iterate endlessly in the official sizing tool (5-10 minutes each time) even when they know there's absolutely no chance that the next iteration will produce "final" configuration. But hey, every time they produce an "official" sizing report (which they soon have to change one more time)...

### Privacy

E-Config doesn't collect any stats or even "high level" usage metrics. Nothing.

There are no ads or other crap either.

## Conclusion

E-Config saves me time and does exactly what I want, without any hassle.

I can't say that of many Web apps, especially those used for storage sizing.
