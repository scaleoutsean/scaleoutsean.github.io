# Snapshots and ILM with Elasticsearch 8

Notes and observations about snapshots and ILM in Elasticsearch 8 from a NetApp E-Series perspective

- [Introduction](#introduction)
- [Elasticsearch "snapshots"](#elasticsearch-snapshots)
  - [Snapshot to S3 vs. snapshot to Path](#snapshot-to-s3-vs-snapshot-to-path)
  - [Multiple repositories](#multiple-repositories)
  - [Backup performance](#backup-performance)
- [Elasticsearch ILM](#elasticsearch-ilm)
- [Relationship between ILM, snapshots and searchable snapshots](#relationship-between-ilm-snapshots-and-searchable-snapshots)
- [What does any of this have to do with E-Series?](#what-does-any-of-this-have-to-do-with-e-series)
- [Conclusion](#conclusion)
- [Appendix A - selected API responses](#appendix-a---selected-api-responses)

## Introduction

I've written several posts about Elasticsearch (find them in archives or search), but I haven't yet blogged about S3 integrations.

It is widely known Elasticsearch is moving to "stateless" where object storage will play a big role, so I decided to create these notes for Elasticsearch users. 

These notes aren't specific to NetApp E-Series disk arrays, but as I make storage-related observations I will only focus on E-Series as I find this product line of NetApp to be the most suitable for Elasticsearch.

## Elasticsearch "snapshots"

As storage professionals well know, snapshots are not backups. But here they are. Which is wrong.

Elasticsearch uses the wrong terminology picked from inferior storage solutions - Elasticsearch "snapshots" are really backups (dumps) to S3 and not really snapshots. This doesn't mean there's anything wrong with Elasticsearch snapshots or their approach - that's all good. But dumps or backups shouldn't be called "snapshots". 

That aside, the feature is configured in Snapshot and Restore (why not "Backup & Restore", right?).

There we define our S3 back-end which with "snapshots" that land on E-Series usually means the user's NetApp StorageGRID (VMs) or MinIO (VMs or containers) using E-Series NL-SAS volumes. 

I'm not showing any S3 settings here because most of them are done in the CLI and the Elasticsearch documentation tells you how to configure them. 

Then in Kibana we just register S3 repo name and the only setting we need to provide is the bucket which we want to use.

![](/assets/images/elasticsearch-ilm-snapshots-01.png)

With that done, we create a snapshot policy that uses the new S3 repository.

![](/assets/images/elasticsearch-ilm-snapshots-02.png)

That policy includes a schedule, retention, what to dump to S3, and such. 

As you can see here, I keep my backups for 3 days in this test environment. 

I haven't double-checked this, but I think if you use Elasticsearch ILM we'd retain index snapshots at least as long as ILM policies mandate. So, if we use ILM to manage data up to 60 days, we shouldn't delete snapshots before that.

![](/assets/images/elasticsearch-ilm-snapshots-03.png)

As policy runs, or we manually execute on-demand snapshots, snapshots start appearing in their tab.

![](/assets/images/elasticsearch-ilm-snapshots-04.png)

In this case I'm backing up a datastream of custom logs I generate from a client. I had no idea how to custom-name these from Elasticsearch client (more on that later), so they get these "system" names (`.ds-yourname-*`) and Elasticsearch adds a date plus index file integer suffix which is why the date appears twice (my name included the date, and Elasticsearch added its own date stamp).

![](/assets/images/elasticsearch-ilm-snapshots-05.png)

If I wanted to restore data from any individual snapshot, I could pick only selected indexes or index files an index.

This is obviously useful if you want to add data to some old indexes, or if certain index files get lost/deleted/corrupt and need to be selectively recovered.

![](/assets/images/elasticsearch-ilm-snapshots-06.png)

### Snapshot to S3 vs. snapshot to Path

Elasticsearch allows snapshots to be made to an S3 bucket as well as to a directory (path).

I haven't tried using path-based snapshots because for that I'd have to mount another disk (or perhaps an NFS share) and in this time and age having a backup copy on the same servers where Elasticsearch runs doesn't seem like a great idea. 

In my view the biggest difference between on-premises snapshots to a path compared to an S3 bucket is that by setting up StorageGRID SDS or MinIO I make data copies to a different security domain.

In both cases - filesystem paths or StorageGRID / MinIO buckets - data may land on the same E-Series storage array. 

But with S3, if Elasticsearch gets compromised and Object Versioning with some retention (e.g. Snapshot policy retention + 10 days) is configured, I can still get my backups from S3 back, while backup data on filesystems could be more easily compromised ("rm -rf /mnt/snapshots/*", or encrypted) by an attacker.

This isn't to say there's no way to handle filesystem threats on E-Series. We can take Consistency Group snapshots and, as I wrote in the Rest Server [post](/2022/04/03/restic-server-netapp-eseries.html#dealing-with-the-risk-of-storage-side-snapshot-rotation), we can stop writes to base volumes (i.e. stop "rm -rf" from or encryption from rotating out existing valid E-Series array snapshot data) if reserve capacity runs out. But S3 with Object Locking seems like a more elegant solution.

Another argument against using local backup volumes (ext4, xfs, etc.) is that we'd also have to provide HA. If you have Elasticsearch in VMs, that's fine - vSphere can take care of it. If Elasticsearch is containerized, then HA gets more annoying and having RF1 (2 copies) becomes more desirable because with just one copy only one server can get to snapshot data. 

With a copy on two servers, two servers can serve snapshot data but that's still less than from S3 where - similar to Splunk SmartStore - all Elasticsearch servers can access S3. 

One argument in favor of Path-based snapshot repositories is that two servers can get to data faster than when using S3. While we can easily get a few GBs from object stores with data on E-Series NL-SAS, we can get the maximum storage performance with direct block access (using local disks).

### Multiple repositories

It is possible to configure multiple snapshot repositories. For example:

- Two S3 repositories, each on a different site, with two schedules; this can be used to create two backup dump schedules
- One S3 repository, one Path repository; these can be used to dump Elasticsearch to local disk (fast; can be done every 6 hours) and S3 (maybe daily) 

### Backup performance 

By "backup performance" I mean "snapshot performance", but that would sound silly. (I also omit restore (performance) making that subtitle incomplete, but that's deliberate as restores are actually performance-tuned elsewhere, as we shall see shortly.)

The [docs](https://www.elastic.co/guide/en/elasticsearch/reference/8.11/repository-s3.html#repository-s3-repository) show the options supported by S3 snapshot repository settings. The main ones related to object storage performance and capacity, together with some comments:

- chunk_size - as the name says, this is about chunk sizes and I suspect 512MB-1GB could be a good size for SDS running in VMs or containers.
- buffer_size - buffer_size is for individual upload request size; I wouldn't increase the default for S3 running in VMs or containers
- compress - default is ON, and that's a good idea for Elasticsearch or S3 on E-Series because E-Series doesn't have compression
- max_restore_bytes_per_sec - you can increase this if your object store is fast enough; for restores you should also increase `indices.recovery.*` settings (documented elsewhere as those aren't specific to S3 or snapshots in general)
- max_snapshot_bytes_per_sec - see the comment for "restore" bytes per second, above

Regarding maximum bytes per second, those are per-repository settings so I expect that if you have different policies and therefore schedules, several could be sharing the same bandwidth to S3. As I mentioned, a single MinIO can give you 2 GB/s write and 4 GB/s read, but "it depends" so do your testing and then limit the maximum bandwidth to your S3 repository.

## Elasticsearch ILM

In Elasticsearch 8 ILM is not directly related to Elasticsearch Snapshot & Restore. We can configure ILM through the API or Kibana using Index Management and Index Lifecycle Policies menu items from just above Snapshot and Restore.

I created a policy named sean-syslog-ilm and once everything was configured I had it linked to an index template, and linked indexes were many (which is based on index alias, so that all `.ds-sean-*` indices are picked by that alias).

![](/assets/images/elasticsearch-ilm-snapshots-07.png)

This part of the UI is intuitive - Hot, Warm Cold. Set the criteria needed to move indices through this lifecycle and enable/disable the options you need/don't need.

![](/assets/images/elasticsearch-ilm-snapshots-08.png)

One part that I didn't try is related to Searchable Snapshots. Below we can see that Enterprise license is required for this feature. 

![](/assets/images/elasticsearch-ilm-snapshots-09.png)

You could test the feature by running Elasticsearch in evaluation mode which would enable the feature for 30 days.

I haven't tried to use evaluation license because I wasn't sure if I'll have time to test this within 30 days and I didn't want to have the license expire in the middle of testing. 

That aside, "searchable snapshot" is what ties ILM to snapshots.

## Relationship between ILM, snapshots and searchable snapshots

When Elasticsearch first [introduced](https://www.elastic.co/blog/introducing-elasticsearch-frozen-tier-searchbox-on-s3) ILM in v7.12, ILM of Cold Tier data made copied data to S3 and left one replica on disk, while Frozen eliminated local copies and downloaded data from S3 on demand.

> The frozen tier leverages searchable snapshots to decouple compute from storage. As data migrates from warm or cold to frozen based on your index lifecycle management (ILM) policy, your indices on local nodes are migrated to S3 or your object store of choice. The cold tier migrates indices to the object store, but it still retains a single, full copy of the data on local nodes to ensure fast and consistent searches. The frozen tier, on the other hand, eliminates the local copy altogether and directly searches the data in the object store.

Searchable snapshots supported Cold and Frozen from the beginning.

If we visualize the progression of ILM, once it's set up and indices start hitting limits defined in our ILM policy that affects them, "New" and "Hot" will appear immediately, and "Warm" after first buckets hit the ILM criteria (shard size, number of documents, age, etc).

![](/assets/images/elasticsearch-ilm-snapshots-10.png)

As we move on, the number of shards may increase, and oldest may fulfill the criteria for Cold tier.

![](/assets/images/elasticsearch-ilm-snapshots-11.png)

Back to "searchable snapshots" feature that requires enterprise license. From [the docs](https://www.elastic.co/guide/en/elasticsearch/reference/current/ilm-searchable-snapshot.html):

> Takes a snapshot of the managed index in the configured repository and mounts it as a searchable snapshot. If the index is part of a data stream, the mounted index replaces the original index in the stream.

How does it work? From the same page:

> The action uses the index.routing.allocation.include._tier_preference setting to mount the index directly to the phase’s corresponding data tier. In the frozen phase, the action mounts a partially mounted index prefixed with partial- to the frozen tier. In other phases, the action mounts a fully mounted index prefixed with restored- to the corresponding data tier.

I wasn't able to use Frozen tier, or searchable snapshots in the first place, so I won't share anything on that. But related to snapshot (backup) retention and ILM-driven deletes mentioned earlier - what if there's a mismatch in durations? Here's what the same page says about searchable snapshots.

> By default, this snapshot is deleted by the delete action in the delete phase. To keep the snapshot, set delete_searchable_snapshot to false in the delete action. This snapshot retention runs off the index lifecycle management (ILM) policies and is not effected by snapshot lifecycle management (SLM) policies.

I take this to mean that backups ("snapshots") are not impacted by deletion of searchable snapshots in SLM (ILM policies related to snapshots).

## What does any of this have to do with E-Series?

Not much. 

But the relationship between ILM and snapshots is more obvious and while there are many advanced configuration features that require Elasticsearch expertise, we can more easily understand snapshot- and ILM-related requirements and configure E-Series to meet them.

- Elasticsearch snapshots work to both S3 and Path
- A big advantage of S3 is better anti-ransomware features, and - with multi-site StorageGRID deployment - DR for Elasticsearch backup and SLM data - while the advantage of Path based snapshots is a higher performance which shouldn't matter except in largest deployments (few GB/s in object storage performance is usually more than enough for most Cold tiers)
- Since most large environments need both high performance and DR/BC, multi-site StorageGRID (even as dedicated appliances) - may be better for them
- Path-based snapshots in multi-site deployments could rely on E-Series' synchronous replication, but there's no need to do that if we set RF1 (2 copies) and let Elasticsearch replicate by itself, or use Cross-Cluster Replication when network latency between sites is high
- Snapshots and ILM tiers can use same NL-SAS disk tier on E-Series or EF-Series and DDP (pool) is the simplest way to provide this capacity
- Small-to-medium Elasticsearch clusters could use one big SSD pool for all tiers, and configure R1-type LUNs for Hot and R6-type LUNs for the rest (including object storage)

## Conclusion

Elasticsearch snapshots are both powerful and complicated to use. I got that feeling when I first read about it some 1-2 years ago, but I wasn't sure as I didn't have any first-hand experience.

Maybe these features have to be complicated because they are so powerful, but my impression is Elasticsearch features have gotten ahead of the Kibana UI, Beats and Logstash.

Perhaps I shouldn't expect to be able to use such powerful features without RTFM and training and I'm sure that if somebody showed me how to do it, I'd know how to duplicate the procedure, but still... It could be easier.

Specifically:

- Relationship between Beats or Logstash or other clients on the one hand, and Elasticsearch settings on the other is hard to figure out
- Elasticsearch ILM is [on by default](https://www.elastic.co/guide/en/elasticsearch/reference/8.11/index-lifecycle-management.html) which is great because there's no need to configure it, but then Data Streams and other (missing) settings that ILM depends on get in your way
- Index templates, aliases, and so on - it's confusing and not easy to configure them correctly

> Default index lifecycle management policies are created automatically when you use Elastic Agent, Beats, or the Logstash Elasticsearch output plugin to send data to the Elastic Stack.

Now if you're doing this the first time, and don't have aliases, templates and other details in place, good luck figuring it out... 

It'd be nice if Kibana had One Wizard (TM) where you could just configure the whole thing in one go and then paste a config "key" in Beats or Logstash, which would pull all the settings that you need. Maybe there's something like that already, but I didn't see it.

Because of all these moving parts, clicking around all the manual pages (5+ browser tabs for Beats and Logstash, 10+ for Elasticsearch) was overwhelming. 

I got the feeling that Kibana hasn't quite figured out where to put what, so even within Kibana, one has to do a fair bit of clicking around to check all the different settings and going back to a pane or tab where some non-default checkbox is required means you need to check that checkbox again. So eventually I ended up opening multiple tabs for Kibana as well.

For example, if you want to display "hidden" indices (which is what my `.ds-` data stream indices were), you need to do that every single time you visit the page with indices. 

What I'm getting at with these comments is: on the road to [stateless Elasticsearch](https://www.elastic.co/search-labs/blog/articles/stateless-your-new-state-of-find-with-elasticsearch), Elasticsearch seems to be moving faster than Kibana, Beats, Logstash and related documentation.

That aside, everything works and I think enterprise customers should simply pay for some hand-holding and advice to not only eliminate this frustration and trial and error, but to also take advantage of the more advanced features and implement best practices. So it's not a huge problem.

I didn't spend a lot of time on E-Series in this post, but that's in part because I've already written several posts on various aspects of using E-Series with both Elasticsearch and S3 SDS.

This evaluation helped me gain additional clarity in terms of snapshot options, performance- and capacity-related settings and ILM, so I think I've reached the 80/20 rule now, where knowing about 20% of Elasticsearch gets me to 80% of what I need to know/do with it.

## Appendix A - selected API responses 

This isn't meant to be used by those seeking to get ILM or snapshot configured - the exact values will depend on your environment - but I just want to show my ILM policies. 

I have Hot, Cold and Warm, with no replicas because I have just one Elasticsearch node, so there isn't much value in having more than the original (i.e. 0 "additional" replicas). 

But with three or more Elasticsearch nodes normally we'd have 2 (RF=1), or even (multi-DC) 3 (RF=2) replicas of Hot/Warm, and 1 (RF=0) or 2 for Cold.

```json
{
  "sean-syslog-ilm": {
    "version": 5,
    "modified_date": "2023-11-29T14:35:35.983Z",
    "policy": {
      "phases": {
        "warm": {
          "min_age": "6h",
          "actions": {
            "forcemerge": {
              "max_num_segments": 1
            },
            "allocate": {
              "number_of_replicas": 0,
              "include": {},
              "exclude": {},
              "require": {}
            },
            "shrink": {
              "number_of_shards": 1
            }
          }
        },
        "cold": {
          "min_age": "12h",
          "actions": {
            "readonly": {},
            "allocate": {
              "number_of_replicas": 0,
              "include": {},
              "exclude": {},
              "require": {}
            }
          }
        },
        "hot": {
          "min_age": "0ms",
          "actions": {
            "rollover": {
              "max_age": "1d",
              "max_primary_shard_docs": 1000,
              "max_docs": 2000,
              "max_primary_shard_size": "1mb",
              "max_size": "1gb"
            },
            "forcemerge": {
              "max_num_segments": 2
            }
          }
        }
      }
    },
    "in_use_by": {
      "indices": [
        ".ds-sean-syslog-2023-11-29-14-2023.11.29-000002",
        ".ds-sean-syslog-2023-11-28-14-2023.11.29-000002",
        ".ds-sean-syslog-2023-11-28-21-2023.11.28-000003"
      ],
      "data_streams": [
        "sean-syslog-2023-11-29-19",
        "sean-syslog-2023-11-27-17",
        "sean-syslog-2023-11-28-20"
      ],
      "composable_templates": [
        "sean-syslog-template"
      ]
    }
  }
}
```

If we examine the status of an individual index file, we may find its phase is one of `hot`, `warm`, `cold`.

```json
{
  "indices": {
    ".ds-sean-syslog-2023-11-27-05-2023.11.28-000001": {
      "index": ".ds-sean-syslog-2023-11-27-05-2023.11.28-000001",
      "managed": true,
      "policy": "sean-syslog-ilm",
      "index_creation_date_millis": 1701149122864,
      "time_since_index_creation": "1.8d",
      "lifecycle_date_millis": 1701235715870,
      "age": "19.27h",
      "phase": "cold",
      "phase_time_millis": 1701278915885,
      "action": "complete",
      "action_time_millis": 1701279516381,
      "step": "complete",
      "step_time_millis": 1701279516381,
      "phase_execution": {
        "policy": "sean-syslog-ilm",
        "phase_definition": {
          "min_age": "12h",
          "actions": {
            "readonly": {},
            "allocate": {
              "number_of_replicas": 0,
              "include": {},
              "exclude": {},
              "require": {}
            }
          }
        },
        "version": 5,
        "modified_date_in_millis": 1701268535983
      }
    }
  }
}
```

Object storage bucket "native" where I store snapshots has meta and snap objects. Indices are backed up to the bucket's "indices" path.

```sh
 mc ls os3/native
[2023-11-30 09:00:00 CST]  87KiB index-106
[2023-11-30 09:30:02 CST] 127KiB index-107
[2023-11-30 09:30:02 CST]     8B index.latest
[2023-11-29 01:00:00 CST] 112KiB meta--Zn0Q60LQEy0_w4m1PKqoQ.dat
...
[2023-11-30 09:00:00 CST] 114KiB meta-zCwY6hsIRbSi1I3aRMFnTA.dat
[2023-11-29 16:00:00 CST] 114KiB meta-zJ_O7qV3So-lxAN1AmZFIw.dat
[2023-11-29 01:00:00 CST]   901B snap--Zn0Q60LQEy0_w4m1PKqoQ.dat
...
[2023-11-30 04:00:00 CST]   902B snap-smdYNZIxT-iLvC3Mmjkv6w.dat
[2023-11-30 09:00:00 CST]   901B snap-zCwY6hsIRbSi1I3aRMFnTA.dat
[2023-11-29 16:00:00 CST]   903B snap-zJ_O7qV3So-lxAN1AmZFIw.dat
[2023-11-30 09:30:03 CST]     0B indices/

```
