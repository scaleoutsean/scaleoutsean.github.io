# StorageGRID Audit-log Converter (SGAC) v0.5.0

Post describes why changes were made and with what purpose in v0.5.0

[SGAC](https://github.com/scaleoutsean/storagegrid-audit-analysis) v0.5.0 makes small changes to the table schema.

New columns are `version_id`, `delete_marker_version_id`, and `request_user_urn`.

With that, we can search by S3 object version ID. While I may have several keys named `cat.mp4`, I may care only about one particular version of it.

SGAC Go didn't extract that detail before, so we could end up with many results for a bucket/key, and then have to filter by date or size.

Even other queries on the bucket would not be able to distinguish keys by version, so if you looked for the most abused objects in a bucket (by number of requests - GET/PUT/DEL - since forever), you'd not know which particular version of the key is hammered by `SGET`.

```sql
┌──────────────────────────┬─────────┬──────────┬─────────────┐
│           bucket         │  atyp   │ requests │    bytes    │
│          varchar         │ varchar │  int64   │   int128    │
├──────────────────────────┼─────────┼──────────┼─────────────┤
│ warp-benchmark-bucket    │ SGET    │   153810 │   615188000 │
│ netapp                   │ SGET    │    11526 │ 16776656404 │
│ prod-ml-training-dataset │ SGET    │     9427 │   223113363 │
│ default-bucket           │ SGET    │     7980 │     2649166 │
│ automq-data              │ SGET    │     7511 │    76422317 │
│ automq-data              │ SPUT    │     6781 │    78398587 │
│ automq-data              │ SDEL    │     6535 │    73777513 │
│ warp-benchmark-bucket    │ SPUT    │     5001 │    20000000 │
│ warp-benchmark-bucket    │ SDEL    │     5000 │    20000000 │
│ netapp                   │ SPUT    │     3356 │ 24265299749 │
...
```

This query example comes from the SGAC README, by the way.

Now, the same query can show which versions are heavily used, or the opposite - which versions no one accessed this whole month, for example. It might be useful to know in either case.

Then there are some interesting consequences for [SGII](https://github.com/scaleoutsean/sg-cosi), my StorageGRID incremental (bucket) inventory tool, too. There are "edge" cases where you may rely on a snapshot - which SGII does - or [use SGII output](/2026/11/09/sgii-for-agentic-hybrid-cloud-use-cases.html) [in a workflow](/2026/11/20/sgii-index-storage-grid-inventory-elasticsearch.html) that needs to access an object, but the object is not there due to the tenant admin force-deleting it from the base bucket.

If, for whatever reason, you can't find a file in a snapshot, SGAC (or tenant admin using it on your behalf) can quickly find out why and what happened with that particular object key and version.

As a regular user, you'd probably consult the SIEM team for security-related matters. But for other (unexpected or missing content due to a buggy data pipeline, or other unusual situations) issues, you may not have a canned solution where you can get this answered the same day.

Normally, I recommend forwarding StorageGRID audit logs to a log management system.

But, many StorageGRID users don't have one or they're not allowed to use it. Or, it takes days to get response to low-priority asks not related to security incidents. I don't have a log system for StorageGRID either - I forward logs to a syslog server. I have the logs, but no good way to query them. In cases like these, SGAC may be able to help.
