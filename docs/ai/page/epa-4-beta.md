# E-Series Performance Analyzer (EPA) v4 beta

E-Series Performance Analyzer 4 is coming

- [Introduction](#introduction)
- [EPA 4](#epa-4)
- [EPA Collector-specific](#epa-collector-specific)
- [Details related to storage requirements](#details-related-to-storage-requirements)
- [What's next](#whats-next)
- [Appendix A: updates](#appendix-a-updates)

## Introduction

In 2023 [I forked](https://scaleoutsean.github.io/2023/01/14/eseries-performance-analyzer-container-orchestrator-kubernetes.html) the dead (archived) E-Series Performance Analyzer (EPA) v3 to make sure it remains usable and improve it. 

I accomplished all of the goals I set for it at the time:

- Insta-eliminate the SANtricity Web Services Proxy from the equation
- Make command-line execution a first-class citizen in EPA
- Simplify Docker deployments
- Create Kubernetes deployment recipe

Later I added [some small improvements](https://scaleoutsean.github.io/2023/11/04/eseries-perf-analyzer-epa-330.html) and kept dependencies up to date.

I wanted to do more, but [it's not the only under-served area](https://scaleoutsean.github.io/projects.html) so I've been happy with what I've achieved. 

Earlier this year [InfluxDB 3 entered public beta](/2025/01/24/influxdb-3-core-alpha.html), so I knew soon time will come to do the long-awaited step and update EPA for InfluxDB v3. I also have SoliFire Collector that uses InfluxDB and [I updated that one for InfluxDB 3 in June](/2025/06/18/sfc-2-dot-1.html). EPA was next.

Where are we with that?

## EPA 4

I've been cranking and it's been a lot more work than I expected.

The big news is there's nothing new: EPA polls E-Series, massages responses and stores them in InfluxDB. 

That doesn't seem like news at all. But there's a lot more to it than it meets the eye.

InfluxDB 3 even supports InfluxDB v1 APIs and InfluxQL, so one would think you just do a search and replace and you're done. Or not even that - just tell an AI to do it for you! Right.

Here's bit more detail on the whole thing.

I've blogged about sticking with InfluxDB v1 rather than using the (essentially failed) InfluxDB v2, and now I'm reaping rewards:

- No FluxQL client code to migrate to InfluxDB 3
- No Grafana dashboards with FluxQL that need to be rewritten
- While others need work on these two items, we're painlessly deploying the same code with InfluxDB 3 and we're good for another 5 years

One of the immediate benefits is the ability to tier data to S3 and retain more without spending more. 

Now, one can say "that has nothing to do with EPA 4" and that would be true if I left it as an exercise for the user. But I'm not doing that, so it has to do with EPA 4.

EPA 4 will come with an on-prem S3 and InfluxDB 3 tiering-to-S3 out of the box.

![EPA 4 - core services](/assets/images/epa_v4_03_epa-core-services.png)

I aim to do it for [Versity S3 Gateway](/2023/06/14/versity-s3-posix-gateway.html) as well as the stumbling "default on-premises S3 object store" [MinIO](/2025/06/06/whats-minio-up-to.html).

I started with MinIO first as I had been working on the same thing for SolidFire Collector (before the recent MinIO shenanigans), and it's not easy - believe it or not, there are bugs in InfluxDB. But I have InfluxDB 3 and Versity S3 Gateway working in an SFC test environment, and want to make that the default in EPA v4.

The other "easy but hard" area is security. I did the same for SFC: no longer trying to make it easy to get started while sacrificing security. 

That, too, is more work than it seems. Long story short, if you have TLS certificates well automated, you'll be able to quickly and easily create all the "local" TLS certificates (CA in yellow square, local TLS shown as yellow shields). 

Everything is cordoned off and hidden behind a reverse HTTPS proxy which should use your "proper" CA (the green square) although it could use the self-signed one as well (as long as you import that root CA to your browser, you can end up with end-to-end trusted TLS connections).

![EPA 4 - TLS everywhere](/assets/images/epa-v4-tls-diagram.svg)

And that reverse proxy has Quantum Computer-resistant TLS ciphers today!

Of course, the best case is all TLS are issued by your own CA, but inside of Docker you won't use FQDNs anyway. 

The little "UI-like" icons are UIs for InfluxDB (InfluxDB Explorer, screenshot at the bottom) and S3 (MinIO Console, in case MinIO is used). 

The thick, non-dashed, non-animated green lines in the image above indicate the proxy could also serve as QRC API and UI gateway to E-Series:
- EPA can access E-Series through the proxy
- Administrators and non-EPA plugins can access E-Series through that post-quantum proxy

Viewed differently: the same setup can be deployed to hide E-Series SANtricity API behind that HTTPS reverse proxy with Post-Quantum Cryptography: everything goes through the reverse proxy.

![EPA 4 - QRC for SANtricity API](/assets/images/epa_v4_02_epa-qrc-for-eseries-controllers.png)

So that's where a lot of effort went into. Not directly related, but quite important and required.

And of course there are bugs, such as - to give one of the stupidest examples - after you've suffered for days and seemingly got it all to work, after hours of troubleshooting "everything but" you realize Grafana 12 has a bug that prevents it from connecting to InfluxDB over HTTPS when own root CA is used. That's with Grafana correctly configured. I had to temporarily create a HTTP-to-HTTPS proxy on NGINX for that. That and some feature creep is how your 3 day update fest becomes a multi-week marathon.

Okay, so we're we at now? In terms of CLI, EPA 4 collector is complete. The rest is integration and documentation:

- End-to-end TLS is working, but setup and configuration documentation needs to be created.
- InfluxDB 3 is HTTPS-only (tiering to S3 is a TODO item) is working. EPA 4 connects to it only via HTTPS.
- MinIO S3 is also HTTPS-only is working but not yet used by InfluxDB. S3 console is also working as HTTPS-only behind the HTTPS-only proxy.
- InfluxDB Explorer is HTTPS only, working behind the HTTPS proxy and connects to InfluxDB via HTTPS
- TLS 1.3-only for everything, verification enabled by default

Yesterday I made the stupid decision to salvage EPA Grafana dashboards from EPA v3, although I said I didn't want to be in dashboarding business... 

I figured they already existed, so while I'm not going to create new ones, I'll try to confirm the old ones work and adjust them for any changes due to the switch from InfluxDB v1 to 3 Core. So HTTPS-only Grafana has been added to that list and temporarily uses HTTP proxy to connect to InfluxDB 3 as explained above.

But what does work for UI visualization is InfluxDB Explorer. This is the table that holds performance metrics of physical disks.

![EPA - InfluxDB 3 Explorer](/assets/images/epa_v4_01_disk_performance.png)

## EPA Collector-specific 

There isn't much more you can do with E-Series API. Everything that can be *reasonably* collected is collected. 

Yes, even more can be collected, but at what cost in terms of controller CPU utilization and disk space, and to what end? Nothing that's not needed should be collected.

In version 3 I added some of the last remaining low-hanging fruit (power consumption, temperature readings, SSD wear level). In version 4, all have been made more reliable and should correctly handle multi-shelf configurations. 

Other additions in v4 I also collect individual controller statistics. I gather them periodically as aggregate system performance is the main thing (and that's collected in every interval), but periodic controller statistics give us good bang for the buck: by `diff`-ing the two controllers' metrics we can easily spot uneven controller utilization, for example, whereas before that was hidden behind "average system performance". Since LUNs don't rebalance themselves every minute, periodic collection should be fine. Then we just add a Grafana visualization for the difference between `totalIopsServiced` on each controller and such, and watch those 3-4 bars. Maybe set an alert for when relative difference crosses 30% for 10 minutes, or something like that.

Another new one is physical disk drive details. These aren't performance metrics and change very rarely, so I collect them once a week. Some details may loosely be related to performance monitoring, so we have them and it costs us almost nothing to collect them. And - given the high levels of (dis)satisfaction with how AutoSupport for E-Series works - this "out of scope" addition goes out of its way to fix some of that. Now you're two simple queries (and SQL SELECT command samples will be provided, too) from having a full picture of your disk drives and E-Series firmware.

## Details related to storage requirements 

I'll write a whole new blog post on that once the tiering thing is working and I have some figures to report. 

Quick summary:
- In InfluxDB v1 we had no down-sampling (it was an exercise for the user, to down-sample data using InfluxQL) and retention (easier exercise, to simply delete/drop older records)
- In InfluxDB 3 Core, some of this has been solved and some is work in progress. While tiering of all non-cached data to S3 works (I've blogged about it), it still pulls too much data back when you want to see older charts in Grafana, for example: if you're looking at last 30 days 10 minute granularity would be fine, but at 1 iteration per minute we pull 10x as much data if we didn't down-sample. This will be taken care of with down-sampling

More about that after I release the stack (Docker Compose).

## What's next

EPA Collector v4.0 is feature-complete (in terms of my own objectives for it).

I'll post that CLI code first (expect it within days) rather than wait until I solve all the other bugs and write the docs, and add the rest will follow later. 

With just the Collector, anyone who wants to kick tires would have to stand up own InfluxDB 3 Core and generate API Token for EPA Collector. That's all. Then in coming weeks the rest will be added so that people can deploy the entire stack in 5 minutes, and then EPA v4.0.0 will be released.

With that we'll be good for another 5 years. 

What else would be nice to have? I do have ideas...

- it'd be nice to have a recipe for BeeGFS performance collection to the same InfluxDB v3 instance, so that users can overlay BeeGFS and E-Series performance statistics
- the same goes for Versity S3 gateway on E-Series
- OS collector recipes: if you have a functioning InfluxDB 3, there's no reason to not collect performance metrics from E-Series clients: whether it's Hyper-V nodes, Linux running BeeGFS, [Incus with ZFS](/2024/02/28/incus-zfs-netapp-eseries.html), or bare metal Kubernetes. (In fact, for BeeGFS we probably must collect those if we want to know out which storage target is which E-Series disk, unless you happen to be a BeeGFS storage target naming genus).

In fact, I recently realized E-Series is great for Hyper-V clusters, so I'm very interested in that solution - it is architecturally really nice because Hyper-V has Cluster Shared Volumes and the storage array has to do is "show up" and support volume fail-over for Windows clients (both of which E-Series does with ease).

But I have a long list of TODO's for Kubernetes- and AI-related stuff and yet-to-be published SolidFire API Gateway and haven't even finished EPA 4, so that won't happen quickly.

## Appendix A: updates

- Early October 2025: app published in a new repository. Details [here](/2025/10/07/ecp-eseries-performance-analyzer-aka-collector.html)
- Mid August 2025: the source code for Python app v4.0.0 beta was posted to `develop` branch in the repo
- Late August 2025: due to user interest, I spent some time improving version 3, so v3.4.0 will be released before v4. I wish I had version 4 ready, but it's more than two days of work (how much it took me to get v3.4.0 done)
- Late August 2025: InfluxDB with Versity S3 Gateway working, will replace MinIO as EPA 4's default S3 service
- Early September 2025: more feature creep for version 3: added a bunch of new measurements and expertimental Prometheus exporter (v3.5.0)
