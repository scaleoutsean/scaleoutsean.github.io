# EPA version 3.5.0

E-Series Performance Analyzer v3.5.0

## What's new in EPA v3.5.0

Several small features have been added in [E-Series Performance Analyzer](https://github.com/scaleoutsean/eseries-perf-analyzer) version 3.5.0.

Like with some of the changes in 3.4, I'd already added some of them in version 4 (currently in public beta), so I again wasted some time repeating the same thing.

At this point I've had enough of version 3, so I crammed even more into it - even some weakly desired features - and from now on I'll just maintain that version.

## More performance and configuration details

EPA is supposed to be about performance, but configuration monitoring options are lacking, so what to do? Do nothing is one option and do something is the other possibility.

While entertaining the latter, I realized the lack of options is not a coincidence, which is a good reason on its own to do it. Now it's no coincidence there *is* a way to conveniently monitor E-Series configuration with free tools.

I've therefore wasted more time re-implementing some configuration-gathering functions from EPA 4 Beta and adding several new ones.

- **Controller configuration**: this is related to performance, but even this was a waste of time since I had to practically re-do it after having done it for version 4
- **Hosts configuration**: there isn't much to this, but we can see things like client ports, IQNs and such. Unfortunately, per-client performance or other details aren't available in the API. Still, we can use this to show configured hosts and potentially cross-reference with other configuration details
- **Volume configuration**: the key parts here are volume names and sizes. InfluxDB doesn't support joins, but one can overlay disk groupings (added in 3.4.0) over the sum of volume sizes to get some idea of how much space is left. This requires care because of non-obvious reasons, such as snapshot reserves which are usually hard to see, even in the SANtricity UI
- **Storage pool configuration**: this covers RAID and DDP groupings. Very important as we need some totals from which we can deduct volumes and find out how much unused disk group capacity is left
- **Drive configuration**: this is interesting mostly because of two things: firmware and disk status. Both were already covered and inserted in other metrics in version 3.4 (for example, SSD wear level), as at the time I hoped having some key metrics would suffice. Drives' configuration is now a stand-alone measurement while SSD wear level is left where it was initially implemented (in disks performance metrics). Drive configuration measurement has more details about configuration and status and less about performance, so it made sense to leave SSD wear level in disk performance metrics

Some less widely-known details:

![EPA Configuration curiosities](/assets/images/epa_350_santricity_config_curiosities.png)

- (1) - `raidDiskPool` - yes, that's DDP
- (2) - yes, we can have RAID 0 on E-Series (except on the pre-crippled EF600C and EF300C). I was using R0 for [ZFS with E-Series](/2024/02/28/incus-zfs-netapp-eseries.html) here, which is one of the several ways ZFS can be [used with E-Series](/2024/02/26/zfs-deduplication-netapp-eseries.html). I also use RAID 0 for apps with EC, such as [MinIO](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html) if/when I need MinIO with EC
- (3) - `repos_<digits>` are internal "volumes" used by SANtricity for CoW snapshots and such. It's better to see them (and account for their size) than hide them although they may confuse us at first

## Experimental Prometheus exporter

As I decided to stop adding features, I added even the least desired one, a Prometheus exporter.

The way it works is Collector runs a Web server where the performance metrics that Collector already collects are exported in the Prometheus format.

Collected configuration details aren't exported because that's not what Prometheus does.

What's exported is performance metrics: system, controllers, volumes, disks, interfaces.

By default, EPA collects and sends output to both InfluxDB and Prometheus, but either can be disabled.

So now I'm done with this as well. There may be some bugs in Prometheus exports, but I can see metrics are available for use. Example with IOPS Other and IOPS Combined on old volumes I used in "MinIO with E-Series" [posts like this one](/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html).

```raw
eseries_volume_iops_total{operation="other",sys_id="600A098000F63714000000005E79C17C",sys_name="EF570",vol_name="CG_MINIO_01_SV_RWC_0002:r0_02"} 0.0
eseries_volume_iops_total{operation="combined",sys_id="600A098000F63714000000005E79C17C",sys_name="EF570",vol_name="CG_MINIO_01_SV_RWC_0002:r0_02"} 0.0
```

If any Prometheus exporter-related bugs get found *and reported*, I'll try to fix them in subsequent 3.5 releases.

## Improvements to existing code

InfluxDB storage bloat was one of the reasons I didn't want to add all those new measurements. But since they got added, that created more related derivative work.

Collector now performs better down-sampling as well as data pruning for old records. That should help keep DB growth in check even for users who enable everything.

By "enable everything" I mean now you don't have to. I've added `--include` in 3.4.1 so that one can include only one or more measurements. That was an unrelated feature request from another user, but it will come handy for the new feature bloat.

For example, to collect only interface performance metrics for Prometheus we can now do `--include interface --output prometheus`. Or include everything except all the new configuration collectors to keep your DB size the same as before.

Does the new approach work better? Who the heck knows? I'll know in about 30 days. What I can tell for sure is that old down-sampling that was in place when I forked probably didn't work *at all*. But I can't be sure, since no one ever complained. For my new implementation, I'll blog about it when I find out.

## What's next

With the added configuration collectors, it should be possible to show Grafana (or other) tables with host-to-volume mapping, capacity and few other things, such as finding volumes that are active on a non-preferred controller.

```sql
SELECT "label", "currentControllerId", "preferredControllerId" 
FROM "config_volumes" 
WHERE "currentControllerId" != "preferredControllerId" 
  AND time >= now() - 1h;
```

I say "should be possible" because I haven't tried to cross-reference the various IDs of these different configuration objects. I think I added all keys that enable that. If some keys that could enable better "end-to-end" mapping turn out to be missing but can be easily added, I'll add them in a minor 3.5 release after that.

Basic "EPA Configuration Template" dashboard was created and is auto-deployed for your fiddling.

![EPA 3.5.0 configuration measurements](/assets/images/epa_350_santricity_config_measurements.png)

Collector's Prometheus endpoint may be welcome by Prometheus users.

Database management (basically "rethinning" of old records) should now work well, but I'll confirm that separately. Also some of the build-in dashboards may need minor edits for time ranges that span into down-sampling time range. I'll take a look at that a month from, now when I inspect how down-sampling/pruning is working.

Other than that, EPA v3 is now in active maintenance. It's now over 2,000 lines long and I don't want to add any new features to it. It should continue to work fine for at least another two-three years, but it's time to focus on version 4.

[Version 4](/2025/08/11/epa-4-beta.html) is based on much better foundations (InfluxDB 3 with S3 tiering, strong security, AI readiness) and should be easier to develop and use. Because InfluxDB 3 is significantly different from InfluxDB v1 (yes, it's backward-compatible, but not fully), any new users looking to use EPA in non-trivial ways should probably start with EPA 4.
