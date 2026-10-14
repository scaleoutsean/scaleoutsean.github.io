# Dump Elasticsearch 9.5 snapshots to shared NetApp filesystem

Dump Elasticsearch 9 snapshots to NetApp BeeGFS with E-Series

## Introduction

In my opinion, S3 is the only valid choice for Elasticsearch snapshot destination.

Some users of on-premises Elasticsearch prefer to use a shared filesystem. Maybe they think the cost is lower (it's likely not), or don't want to have on-premises S3 (that's fine, but [there's no other place big data should go](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html) and by delaying they just increase technical debt in their infrastructure).

Do you think Elasticsearch serverless or AWS OpenSearch serverless use shared POSIX storage? Or could they be doing something that [Splunk SmartStore](/2023/11/06/netapp-eseries-sizing-for-splunk-smartstore.html) does on-premises and in the cloud?

In 2023, I blogged about taking [Elasticsearch 8snapshots to StorageGRID](/2023/11/30/elasticsearch-ilm-netapp-eseries.html). This post is for the POSIX hold-outs: Elasticsearch 9 supports taking [snapshots to a shared POSIX filesystem](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/shared-file-system-repository#filesystem-repository-settings), so here's how I'd do it if I had to use a shared POSIX filesystem.

## Workflow

- [Configure shared filesystem in all Elasticsearch instances](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/fs-repository-settings#path-repo) in the cluster and do a rolling restart
- [Verify compatibility](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-snapshot-verify-repository) - this is so that you don't use an unsupported configuration
- Snapshot and check

Configure:

![Configure shared filesystem](/assets/images/elasticsearch-snapshot-shared-filesystem-00-configure.png)

Check the containers to make sure the shared filesystem is mounted and accessible:

![Docker inspect of BeeGFS](/assets/images/elasticsearch-snapshot-shared-filesystem-01-fs-view.png)

Notice that, in the screenshot above, Elasticsearch Docker Compose is also on BeeGFS. But the images and main volumes are in the usual Docker store. Only the *shared filesystem* path (for snapshots) is on BeeGFS (BeeOND). BeeOND is used because it's easier to set up (I have a nice script, it takes me 30 seconds to stand it up), but normally you'd use the non-BeeOND BeeGFS. Functionally they're the same.

Verify shared filesystem:

![Verify shared filesystem](/assets/images/elasticsearch-snapshot-shared-filesystem-02-shared-fs-verify.png)

Configure with `_snapshot/<target>`:

```http
PUT _snapshot/beegfs
{
  "type": "fs",
  "settings": {
    "location": "/mount/backups/beegfs"
  }
}
```

Response:

```json
{
  "acknowledged": true
}
```

Verify `/_snapshot/<target>/_verify`:

```http
POST /_snapshot/beegfs/_verify
```

Response:

```json
{
  "nodes": {
    "Tvo0Dzj8RjWK3ixFHpyTWA": {
      "name": "71f8e2b8a6b0"
    }
  }
}
```

Upload some data.

I uploaded 300K records from [SGAC](/2026/09/20/sgac-storagegrid-audit-v030.html), my "StorageGRID audit log to JSON (or Parquet)" converter.

![Index discovery](/assets/images/elasticsearch-snapshot-shared-filesystem-03-index-entries.png)

The SGAC input collection wasn't large (170MB JSONL), but it was more than just a blip.

The snapshot was taken with `wait_for_completion=true`, global state was included to make more data get dumped to disk, and `ignore_unavailable` was set to false to report any errors.

```http
POST /_snapshot/beegfs/01-sean-snap?wait_for_completion=true 
{
    "ignore_unavailable": false,
    "include_global_state": true,
    "indices": "sgac",
    "metadata": {
        "taken_by": "scaleoutSean",
        "taken_because": "LFG"
    }
}
```

Like with [Ray checkpointing](/2026/09/19/ray-framework-beegfs-storagegrid-checkpoint.html), I/O lagged due to OS write buffering, but seconds later it appeared in disk I/O measurements and was nicely distributed across all constituent volumes.

![Elasticsearch snapshot performance](/assets/images/elasticsearch-snapshot-shared-filesystem-04-dump-to-disk-performance.png)

Elasticsearch snapshot dump to disk worked. Over 400 MB was dumped to BeeGFS. Response from that call is lengthy so I put it in Appendix A at the bottom (of the second snapshot, because I forgot to preserve output of the first).

![Dump to shared file system OK](/assets/images/elasticsearch-snapshot-shared-filesystem-05-dump-ok.png)

## Conclusion

NetApp doesn't have this BeeGFS solution featured, but the fact that it passes Elasticsearch validation makes it supported by Elasticsearch and ThinkParq.

With BeeGFS, we can dump Elasticsearch to disk at whatever speed you can get from the storage. With E-Series E4000, that can be 10 GB/s to NL-SAS is possible and more with EF-Series EF50 and EF80 (which also have a NL-SAS-based hybrid option).

In fact, with hybrid EF-Series there's no reason to use other storage for Elasticsearch because you can solve Hot Tier in the same array(s). You can move [Elasticsearch to Kubernetes](/2026/04/13/elasticsearch-eck-kuberntees-netapp-santricity-csi.html) (or keep it on bare metal or in VMs), you can dump snapshots to a shared filesystem on NL-SAS, and you can get [best NVMe performance possible from a NetApp disk array](/2023/02/25/elasticsearch-eseries-performance.html) (see about [the EF80 here](/2026/03/21/netapp-ef-series-ef80-ef50.html)).

BeeGFS can run [out of VMs](/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html) and for large Elasticsearch clusters you could put BeeGFS into own cluster and run Elasticsearch in Kubernetes (use BeeGFS CSI to mount shared filesystem). If you have dozens of Elasticsearch nodes and need to dump data at tens of GB/s...

BeeGFS 8 has [RST](/2026/08/02/eke-update.html), a feature that syncs BeeGFS files to/from S3. RST lets you ship ("push") BeeGFS contents to S3 (e.g. some public cloud with ILM set up to move it to a low cost tier). Even if BeeGFS gets destroyed, snapshot data can be recovered from another BeeGFS cluster, or even [accessed directly](/2026/08/07/simple-access-to-beegfs-rst-data.html) from authorized S3 clients.

## Appendix A: API response (snapshot)

I didn't get the response for the first snapshot. This is the second snapshot to shared filesystem which completed quickly as no new data was added since the first. You can see Elasticsearch is v9.5.5, latest as of today.

```json
{
  "snapshot": {
    "snapshot": "02-sean-snap",
    "uuid": "bjBbwd6RRc-S89FzE2GfaA",
    "repository": "beegfs",
    "version_id": 9111000,
    "version": "9.5.2-9.5.5",
    "indices": [
      ".kibana_locks-000001",
      ".security-7",
      ".workflows-workflows-000001",
      ".security-profile-8",
      ".chat-agents-000001",
      ".kibana_alerting_cases_9.5.5_001",
      ".kibana_task_manager_9.5.5_001",
      ".ds-.kibana_change_history-2026.10.13-000001",
      ".ml-notifications-000002",
      ".async-search",
      ".ds-.workflows-events-2026.10.13-000001",
      ".kibana_streams-000001",
      ".ml-inference-native-000002",
      ".kibana_security_session_1",
      ".ml-annotations-000001",
      ".inference",
      ".apm-custom-link",
      "sgac",
      ".ml-inference-000005",
      ".kibana_ingest_9.5.5_001",
      ".kibana_security_solution_9.5.5_001",
      ".secrets-inference",
      ".apm-agent-configuration",
      ".kibana_usage_counters_9.5.5_001",
      ".kibana_9.5.5_001",
      ".integration_knowledge-7",
      ".kibana_search_solution_9.5.5_001",
      ".kibana_analytics_9.5.5_001"
    ],
    "data_streams": [
      ".workflows-events",
      ".kibana_change_history"
    ],
    "include_global_state": true,
    "metadata": {
      "taken_because": "LFG!",
      "taken_by": "scaleoutSean"
    },
    "state": "SUCCESS",
    "start_time": "2026-10-13T19:39:10.309Z",
    "start_time_in_millis": 1791920350309,
    "end_time": "2026-10-13T19:39:10.509Z",
    "end_time_in_millis": 1791920350509,
    "duration_in_millis": 200,
    "failures": [],
    "shards": {
      "total": 28,
      "failed": 0,
      "successful": 28
    },
    "feature_states": [
      {
        "feature_name": "fleet",
        "indices": [
          ".integration_knowledge-7"
        ]
      },
      {
        "feature_name": "async_search",
        "indices": [
          ".async-search"
        ]
      },
      {
        "feature_name": "security",
        "indices": [
          ".security-7",
          ".security-profile-8"
        ]
      },
      {
        "feature_name": "kibana",
        "indices": [
          ".kibana_9.5.5_001",
          ".kibana_usage_counters_9.5.5_001",
          ".apm-agent-configuration",
          ".kibana_security_session_1",
          ".kibana_task_manager_9.5.5_001",
          ".kibana_streams-000001",
          ".ds-.workflows-events-2026.10.13-000001",
          ".workflows-workflows-000001",
          ".kibana_analytics_9.5.5_001",
          ".kibana_search_solution_9.5.5_001",
          ".kibana_ingest_9.5.5_001",
          ".kibana_alerting_cases_9.5.5_001",
          ".apm-custom-link",
          ".ds-.kibana_change_history-2026.10.13-000001",
          ".kibana_locks-000001",
          ".chat-agents-000001",
          ".kibana_security_solution_9.5.5_001"
        ]
      },
      {
        "feature_name": "inference_plugin",
        "indices": [
          ".secrets-inference",
          ".inference"
        ]
      },
      {
        "feature_name": "machine_learning",
        "indices": [
          ".ml-inference-native-000002",
          ".ml-inference-000005"
        ]
      }
    ]
  }
}
```

## Appendix B: Video demo

- [Dump Elasticsearch 9 to BeeGFS 8 with Hybrid NetApp EF-Series](https://rumble.com/v7gu3h6-elasticsearch-9-snapshot-to-posix-filesystem-with-beegfs-8.html) - 2m49s
