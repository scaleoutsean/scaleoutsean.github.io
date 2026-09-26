# EPA version 3.4.0

E-Series Performance Analyzer v3.4.0

## How it started ...

This came as a little unexpected detour in my recent attempts to upgrade E-Series Performance Analyzer to version 4.

Surprisingly, this "simple" refresh from 3.3 to 3.4 took me several days of work. I still can't believe it. I mean, I couldn't believe it after 2 days of work. How is that even possible?

Well, for one, I don't have E-Series systems that I use. So I don't (can't) use EPA myself.

Secondly, when I do use it - which is when I happen to have access and run some unrelated tests, I may, if I need it use it a little. But even then, I may not be able to deploy the entire Docker stack. I have a stand-alone Grafana and stand-alone InfluxDB v1 (both of which I also use like this with SolidFire Collector), which means I just create a DB, import dashboards, and run EPA Collector as a CLI application.

As far as I could tell, previous EPA versions worked fine for my purpose. What I could not tell was that the stack (Collector, InfluxDB, Grafana) did not work quite well.

And EPA never had any bug reports except a handful of issues I created myself, so there was nothing to fix except make small updates for 3rd party CVEs.

Right? Right?

## ... and how it's going

Well, so recently someone tried to use the entire EPA 3.3.2 stack and it wasn't a happy experience.

I was able to help them get Collector and InfluxDB going in minutes, and what was left was the easy part - the dashboards.

Except they struggled to get that going as well. Damn. Okay, I knew those were quirky, and that part of the code was the old pre-fork code that used Ansible to deploy dashboards to Grafana. I had a tip on that in the FAQs or someplace - but it wasn't easy.

Okay, so it's painful. I got like five obvious bug fix candidates out of that one attempt. Ouch!

## Fixes and improvements

I really hoped they would have asked me about EPA a week later - by then maybe I would have finished [EPA 4](/2025/08/11/epa-4-beta.html) that's already posted on Github, but wasn't released. 

It seemed that fixing half a dozen small issues would take a day, so I decided to fix them in v3.4.0. Then it was two, then three, and finally four days.

I didn't plan to make significant changes to version 3, but since I just did in version 4, I figured I should while my memory of the problems I've seen while working on version 4 was still fresh.

So some of the "big ticket" items made it to v3.4.0. No new "features", but big changes nevertheless.

I tested the entire stack because that's where the problems were, and specifically related to the legacy code (I mean, the parts coded before I forked it, but then probably made worse after my changes to Collector). 

Rather than fixing that old code, I completely removed it, practically duplicating the effort from version 4, only with less drastic changes to Collector itself. 

Then I also drastically simplified my own code and merged my post-fork docker-compose.yaml (where I had EPA Collector and DB Manager) into pre-fork (where InfluxDB and Grafana were). 

Then I added two new containers to replace the removed legacy containers.

And, since I removed the legacy Ansible container that deployed (or not) EPA's Grafana dashboards, I simply had to make them work well, which meant more work on that although every time I say I won't touch those damn dashboards... 

And in every step I'd discover more small bugs.

Well, v3.4.0 is out now and the entire stack does work correctly in every detail that I could check.

I crammed SSD wear level (the green thing) into the Disks dashboard as I really, really don't want to be in dashboarding business.

![EPA v3.4.0 volumes screenshot](/assets/images/epa_v340_volumes_screenshot.png)

I haven't added temperature sensors anywhere because they should use their own dashboard (I suppose) and even if you're lazy, they should be easy to add as a panel to the System dashboard the same way I added that SSD thing to the Disks dashboard.

## Oh, and another thing

I also used this opportunity to update InfluxDB v1 to version 1.11.8. Even better, version 1.12 is going to come out soon and then I'll update EPA 3 again.

I am really happy how I skipped InfluxDB 2 in favor of waiting for InfluxDB 3. InfluxDB 1 is a gift that hasn't stopped giving!

Back in 2023 people were telling me "yeah, InfluxDB v1 is better, but there are no updates, so who's going to use it?" and in here we are in H2 2025 and updates are *still* coming out. Fantastic!!!

## And now back to version 4

I don't expect additional deployment crises or major bugs in version 3, so next I focus on version 4 again.

I've [written about version 4.0.0 beta](/2025/08/11/epa-4-beta.html) some two weeks ago, and since then - because I'd been working on the entire (Docker Compose) stack - I have realized it's going to be even better than I hoped. That's why [release notes for v3.4.0](https://github.com/scaleoutsean/eseries-perf-analyzer/releases/tag/v3.4.0) suggest to skip updating v3.4.0 (if there are any users out there).

Version 4 is much better and also a bit more complex than the bare-bones version v3.4.0 because that was unavoidable due to the major improvements related to security (security doesn't exist in version 3, but that's how it was developed before I forked it).

But the real gems are a consequence of InfluxDB 3. You can get a decent overview of that in that post on version 4.0.0 beta, but I'll add a few extra bullets on that:

- users are be able to create triggers and alerts directly in InfluxDB 3 (or externally, but internal alerts are way more powerful)
- users can use the included InfluxDB Web UI to create queries using natural language and gen AI assistants
- users can directly export such queries to Grafana 
- users can run other workloads - such as anomaly detection - directly in InfluxDB 3 (or externally)
- EPA 4 collects more metrics than EPA 3, some of which are important and not some obscure metrics no one needs

EPA 4 Beta is already on Github, but a recipe for the stack (EPA Collector and all the other containers) is not yet completed although I have the stack running right now. (Anyone could create their own before or after I complete mine, of course.)

Once that stack is tested and documented, v4.0.0 will be released and then real exploration begins. Alerting, down-sampling, anomaly detection... Exploration will keep me busy.

I mentioned on X the other day: there's no need to focus on better dashboards. The trend is making data accessible to AIs.

That's what EPA 4 is about. With the extra measurements we'll be able to spot issues faster, optimize sooner, and discover ways to get more out of E-Series with much less human effort.

Skipping InfluxDB 2 was such a great move because EPA is now AI-ready. And the security improvements make it Post-Quantum-ready.
