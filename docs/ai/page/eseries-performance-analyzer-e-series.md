# Notes on NetApp E-Series Performance Analyzer

Visualize performance metrics of NetApp E-Series arrays in Grafana

- [Should we use E-Series Performance Analyzer or SANtricity Web UI to monitor E-Series performance](#should-we-use-e-series-performance-analyzer-or-santricity-web-ui-to-monitor-e-series-performance)
- [Various E-Series Performance Analyzer (EPA) notes](#various-e-series-performance-analyzer-epa-notes)
  - [Authentication](#authentication)
  - [Using JWT for EPA collector](#using-jwt-for-epa-collector)
  - [Bypass Web Services Proxy](#bypass-web-services-proxy)
    - [Bypass Web Services Proxy with Graphite (Carbon) instead of InfluxDB v1](#bypass-web-services-proxy-with-graphite-carbon-instead-of-influxdb-v1)
- [Summary](#summary)
- [Demo and resources](#demo-and-resources)

**NOTE:** Credentials in this post are used for demonstration/educational purpose.

## Should we use E-Series Performance Analyzer or SANtricity Web UI to monitor E-Series performance

The other day I ran a simple [performance test with MinIO](/2022/10/21/minio-performance-netapp-e-series.html) backed by an E-Series storage array. 

GET hit over 4 GB/s but SANtricity (E-Series Web UI) averaged less because the benchmark exits after a short time if IO levels are stable, which they were.

![GET Benchmark in SANtricity Web UI](/assets/images/minio-bench-02-mixed-get.png)

For this and other reasons, this week I decided to try [E-Series Performance Analyzer](https://github.com/NetApp/eseries-perf-analyzer) release v3.0.0.

I knew that due to the 30s interval (I did *not* change the defaults) I wouldn't get a better effect with Grafana. The first bump was a GET test (preceded by PUT, to create files) while the second (the second bump with per-node performance in annotation) was the mixed workload test:

![GET Benchmark in Grafana](/assets/images/e-series-performance-analyzer-grafana-minio.png)

(You may open this in a new tab to see a larger image.)

Log of the second (mixed benchmark) run shown in Grafana shows "cluster total" is 3,794.75 MiB/s, but Grafana shows 2,200 MiB/s (aggregate from the four MinIO volumes).

```sh

Throughput 2827.9MiB/s within 7.500000% for 10.003s. Assuming stability. Terminating benchmark.
warp: Benchmark data written to "warp-mixed-2022-10-26[034738]-lI2M.csv.zst"
Mixed operations.
Operation: DELETE, 10%, Concurrency: 20, Ran 35s.
 * Throughput: 63.51 obj/s

Operation: GET, 45%, Concurrency: 20, Ran 35s.
 * Throughput: 2849.26 MiB/s, 284.93 obj/s

Operation: PUT, 15%, Concurrency: 20, Ran 35s.
 * Throughput: 949.28 MiB/s, 94.93 obj/s

Operation: STAT, 30%, Concurrency: 20, Ran 35s.
 * Throughput: 190.05 obj/s

Cluster Total: 3794.75 MiB/s, 632.87 obj/s over 36s.

```

From this we can conclude that Grafana won't give you "better" results for bursty moments because just like SANtricity Web UI, unless it takes samples every second or even every few seconds (which would have helped with this particular workload). When using the default setting (30s metrics-gathering interval) in EPA, SANtricity Web UI can give more precise results.

E-Series Performance Analyzer allows you to set an arbitrary interval for gathering performance metrics, but I wouldn't lower it below 30s. In fact I prefer to set it to 60 seconds as I do with SolidFire Collector. There's no point in overloading the array API endpoint and especially so if you already get the same information from the application or even the filesystem as is the case with [BeeGFS](/2022/08/15/monitoring-beegfs-and-netapp-eseries-grafana.html) and other filesystems.

Performance monitor in SANtricity Web UI isn't as flexible and customizable (layout, averaging, retention, indicators, etc.), but it runs in the controllers. These are the usual pro's and con's for all storage systems.

## Various E-Series Performance Analyzer (EPA) notes

What follows is a few additional notes on E-Series Performance Analyzer.

For those new to E-Series:

- These days SANtricity Web UI/API runs on E-Series controllers
- The E-Series (SANtricity) API can be accessed directly (SANtricity API endpoint on array controller(s)) or - this is more secure and very common - through the SANtricity Web Services Proxy (WSP)
- E-Series Performance Analyzer (EPA) is a sophisticated Docker Compose file which has all services required, including WSP, and it works out of the box

README.md file is good and accurate, although too long for my liking. Still, I won't rehash it here - it is correct and complete so take a look at it on your own.

In the repo's root directory you'll find `.env` and `.auth.env`. The latter has an easy-to-guess WSP password, and you can change it before you build containers, but if you do that you also need to change the password in plugins/eseries_monitoring/collector/config.json (it's documented in README.md, no need to remember, just remember to read README.md).

Core E-Series-related code is in [plugins/eseries_monitoring](https://github.com/NetApp/eseries-perf-analyzer/tree/v3.0.0/plugins/eseries_monitoring):

- Web Services Proxy (aka WSP)
- Python collector

You could use docker-compose.yaml from that directory or even just Python collector container and run it against existing WSP (which may be managed by somebody else), as long as you had the credentials. You could also use it with another Grafana and InfluxDB v1 (in the case you don't want to use EPA's InfluxDB v1 and Grafana 8).

The Python collector script sends data to the older InfluxDB v1. As I described in the BeeGFS performance monitoring post (see that BeeGFS link above), BeeGFS monitor in 7.3.0 can also send data to InfluxDB v1, so maybe you'd want to use that DB or (see that post) you can massage your pipeline and send data to another database (or InfluxDB v2, if you like InfluxDB).

There is a ready-made version of [collector script](https://github.com/NetApp/eseries-perf-analyzer/blob/v3.0.0/plugins/eseries_monitoring/collector/collector-graphite.py) that can send data to Graphite or any Graphite-compatible sink. It gathers less information, but works fine with Graphite-StatsD (which you'd have to stand-up on your own).

Personally I would prefer to run just a Collector container and the rest (metrics database, Grafana, WSP) should be shared services used by the rest of your infrastructure. This is also how I modified SolidFire Collector to work - there's no need to build application and data islands.

### Authentication

E-Series has a read-only monitor role, but it seems it cannot change its own password (i.e. only the administrator can change the monitor account's password). The other challenge is WSP must use a SANtricity administrator account to add E-Series arrays to WSP.

Both of these make the use of EPA with WSP tricky because if SANtricity admin password changes outside of your control (say, there may be an automated admin account password rotation script for E-Series in place), that will break WSP's back-end configuration as WSP won't be able to access E-Series).

At that point EPA can no longer gather E-Series performance data through WSP, and to solve that we'd have to update Python Collector's config.json use EPA's `make rm & make run` to have EPA pick up updated authentication settings.

One way to automate password rotation for WSP (if you're in charge of running your own WSP) is to make SANtricity API interaction part of password change workflow and when the admin password changes, store that updated password in Kubernetes secrets (or a vault) and restart containers whenever that secret changes. But this necessitates changes in EPA source code, Dockerfiles, etc.

Another, similar approach is to use a script that (a) uses SANtricity API to change admin and monitor password, and (b) update EPA's configuration files, and then rebuild and restart EPA. I wrote a PowerShell script that can be used for (a) (for local SANtricity accounts; get it [here](https://github.com/scaleoutsean/eseries/blob/master)). Just two additional steps (search and replace password in EPA config files, and run `make build run` to restart EPA) would be necessary for step (b). The problem is this becomes harder if there are other scripts or programs that depend on these changes.

### Using JWT for EPA collector

JWT or bearer authentication tokens exist in SANtricity 11.74 (but not yet in WSP as of today). I wrote about JWTs in SANtricity [here](/2022/11/08/eseries-santricity-jwt-bearer-tokens.html).

If mandatory password rotation goes on your nerves, you can modify EPA's collector script to use JWTs and go directly to SANtricity API endpoint (because in <=11.74, WSP does not support JWT).

### Bypass Web Services Proxy

InfluxDB v1 is the "default" back-end in EPA 3.0.0, but to by-pass WSP we need to modify collector.py as explained earlier.

Long story short, I created a fork of the original repository [here](https://github.com/scaleoutsean/eseries-perf-analyzer). It works.

My modified collector.py can also be used from the CLI, so we don't even *need* to run EPA. You can do something like this:

- Run InfluxDB v1 where-ever (make sure it listens at 8086/tcp)
- Run N instances of collector.py in N containers to monitor N E-Series arrays, and send data to InfluxDB v1

It is also possible to easily deploy Collector on Kubernetes or Nomad, because it's not entangled with WSP, there's no need for admin accounts, and Collector's `ENV` variables can be stored as Kubernetes or Nomad secrets.

#### Bypass Web Services Proxy with Graphite (Carbon) instead of InfluxDB v1

EPA's collector.py script that sends data to InfluxDB v1 is used by default, but in NetApp's own EPA repo there's also a version of Collector written for Carbon and located in the same folder (collector-graphite.py). 

If you spend one minute to stand-up a Graphite container, you can run this Graphite version and send data to Graphite DB via Carbon port 2003.

![Sending E-Series performance stats to Graphite](/assets/images/eseries-perf-analyzer-graphite-01.png)

E-Series performance statistics in Graphite (you can still chart this in Grafana, it's just that I didn't have it installed):

![Performance Analyzer data in Graphite](/assets/images/eseries-perf-analyzer-graphite-02.png)

There are no ready-made Grafana charts for Graphite source, so you'd have to create your own. With Graphite that's very easy. Below we get data for all E-Series arrays (under `storage.eseries`) and then from volume statistics for all (`*`) volumes we pick `readOps`. That gives us readOps from all E-Series arrays in Graphite.

![Performance Analyzer data in Graphite](/assets/images/eseries-perf-analyzer-with-graphite-dashboarding.png)

Regarding WSP bypass, and this applies to both collector scripts: simply change the "proxy" URL in the script to SANtricity API URL (although SANtricity API endpoint isn't a proxy, API paths are the same except for the WSP "folder" thing) and use a storage monitor account credentials which are read-only. 

Additional tasks include:

- Deploy one "collector" container per each E-Series array
- Create two "shared container services" for many instances of EPA: one DB (Graphite) and one app (Grafana)

collector-graphite.py doesn't require any modifications except for that proxy value (change it to use SANtricity controller IPv4 address, and modify Python script to eliminate "folder"-related code - those are WSP-only APIs, you can simply send hard-coded "folder" data to InfluxDB).

The main downside is you need to build own dashboards because they don't come prepackaged for Graphite and the second, lesser one is: fewer metrics compared to E-Series collector for InfluxDB.

Can we use collector-graphite.py as part of EPA? Yes.

- Copy it over collector.py or change collector Dockerfile to copy that file into the container
- Change dockerfile-entrypoint.sh for Collector (arguments are slightly different for the Graphite version), so that collector container can start properly

Then use `make rm && make run` to rebuild and start. But this doesn't make a lot of sense unless you add Graphite-StatsD to docker-compose.yaml and remove Influx DB from it. In other words, if you've made collector-graphite.py work with Graphite, it's easier to make a new Docker Compose file from scratch.

## Summary

E-Series Performance Analyzer (and E-Series API) have their learning curve, but work well.

Ideas:

- Modify collector-graphite.py to talk to external Graphite or a Graphite-compatible sink
- Use my fork of EPA to remove the need for WSP and the use of SANtricity admin accounts

With a bit of additional work we should be able to upgrade the Python InfluxDB module and use InfluxDB v2, but all built-in Grafana dashboards would have to be reworked as well. If you don't intend to use WSP, this is probably a good idea to consider.

I've worked with Graphite before (with SolidFire Collector) and I like it better. 

For casual users I'd recommend the Graphite version of collector script because Graphite is easier to use and dashboards are easy to build. For advanced users, InfluxDB v2 and advanced busy users as-is (InfluxDB v1).

If E-Series monitoring is critical for you, consider using one of enterprise-grade monitoring solutions such as NetApp Cloud Insights. 

## Demo and resources

- Demo of [E-Series Performance Analyzer v3.0.0](https://rumble.com/v1py88p-netapp-e-series-performance-analyzer-walk-through.html)- 2m26s
- Fork of [E-Series Performance Analyzer](https://github.com/scaleoutsean/eseries-perf-analyzer) which does not use WSP and admin account and can run in Docker/Docker Compose, Kubernetes, Nomad or in the shell (Python 3)
