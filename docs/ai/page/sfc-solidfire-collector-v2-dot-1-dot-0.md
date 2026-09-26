# SolidFire Collector v2.1.0

SolidFire Collector v2.1.0

## SFC v2.1.0

[I wrote about SFC 2.1 here](/2025/06/18/sfc-2-dot-1.html), which was in June when Collector and a simple Grafana dashboard (with InfluxQL queries) were done.

Since then, nothing new has happened with Collector features, but I was busy with other projects and I thought maybe someone would want to test and give feedback.

That did not happen as expected, so as soon as I released EPA v3.5.0 (that was today) I finalized SFC's Docker Compose packaging which was already in good shape and I just [tagged](https://github.com/scaleoutsean/sfc/releases/tag/v2.1.0) v2.1.0. It's done!

## SFC stack

InfluxDB 3 ecosystem is developing rapidly, so although the earlier "what's new" post is more on that, here are some quick remarks related to what has changed since June:

- **InfluxDB v3**: when I started modifying SFC v2 for InfluxDB 3, it was in Alpha. A lot has improved since then, and I blogged about it in E-Series Performance Analyzer posts. Today I use version 3.3 and version 3.4 came out last week (although with not many changes relevant to SFC)
- **InfluxDB Explorer**: I also wrote about this before, but I haven't shared any SolidFire-specific screenshots. Here's how you can view and query SFC data in latest InfluxDB Explorer 1.2.0. Very nice!

![SFC database in InfluxDB Explorer](/assets/images/sfc_2.1.0-influxdb-explorer.png)

- (1) Manage databases from the UI
- (2) Install plugins (there's a bunch of them!) to analyze metrics, prune data, etc.
- (3) Excellent UI for querying and charting
- (4) AI-assisted interface available with commercial LLMs

- **Grafana**: when I started migrating SFC 2 from InfluxDB v1 to InfluxDB 3 I retained InfluxQL which InflxuDB 3 supports, and a sample dashboard uses that. Recently I also added SQL-related examples for those who want to use the new default query language of InfluxDB 3
- **Versity S3 Gateway**: InfluxDB 3 can tier to S3, and tiering to Versity S3 Gateway is enabled by default. Users may change to existing on-premises S3, of course, or continue using Versity S3. I wasn't sure if I'll have time time and patience to add this, as many users probably prefer to not tier at all and MinIO is the usual line of least resistance, so I'm happy that I've done it! I've been using Versity S3 in my projects and testing for over two years now ([recent example](/2025/06/22/data-pipeline-with-beegfs-file-system-notifications-and-versity-s3-gateway.html)). It is also possible to change 2-3 lines in InfluxDB container configuration and not use any S3 or use your own InfluxDB 3
- **Utils**: utilities container for easy CLI management and/or troubleshooting of database and S3 in case you use the SFC stack
- **TLS/HTTPS**: Docker Compose and Collector itself make it very easy to use TLS. While other projects still make security optional, SFC is secure by default

## What's still missing

Down-sampling was missing in v2.1.0, because I thought it wasn't important. I still think that, because I see just 30 MB per day collected from my Demo VM. Even at 200 MB/day, that's not a lot.

But updates for v2.1.1 have been posted to `master` on September 6 and contain built-in down-sampling for the most sensitive measurement (`volume_performance`), a sample dashboard that works with down-sampled data, and detailed instructions on how to expand down-sampling to other measurements for those who need it. It uses the official InfluxDB down-sampling plugin.

The main benefit should be faster Grafana performance, I suppose.

## Conclusion

I like SFC because it was my first OSS "project" (I didn't start it, but I took on myself to rescue and improve it).

The second reason is version 2 was a complete re-write with Influx LP done completely "by hand" (very time consuming, but with fewer dependencies). Few people do that these days. SolidFire's API has its [quirks](/2025/07/09/the-shocking-truth-about-createschedule.html), but it's by far the best storage API I've worked with, so I didn't mind to put extra effort into it.

The entire stack is now future-proof for next several years, which means it'll outlive SolidFire's [End of Support](/2022/09/23/eoa-solidfire.html) date.

On top of that, I don't know of anyone who uses SFC, so there's no reason to release 2.2.0.

That means no major changes for SFC from now on. Users (if any) may create issues on Github in case of any problems with v2.1.0.

I don't mind if I'm the only guy who uses SFC. I still hope to find time to explore SFC's features, especially SFC-related database management and analytical features. In terms of personal projects, I want to finish E-Series Performance Analyzer 4.0.0 and then revisit Kubernetes with SolidFire (and SFC, and KubeFire, and Terraform for Provider for SolidFire - tie it all together!), so I'm not even close to done developing and solutioning for SolidFire.

I also plan to a performance test of InfluxDB with Versity S3 Gateway, as I use this approach in both SFC and EPA now.

**Update (September 06, 2025):** I just posted updates for v2.1.1 and disabled S3 tiering by default. I also disabled SFC's internal metrics (which also added to processing time), just to make sure SFC runs as fast as it possibly can. Versity S3 Gateway remains included, default S3 option and can be enabled with a small change in InfluxDB configuration (if you want to do this, reference container setup from v2.1.0). This makes SFC complete collections within seconds and should be able to handle 1,000 volume clusters even on the shortest high-frequency interval supported (60s).
