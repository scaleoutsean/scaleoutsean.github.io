# Snapshot Instaclustr OpenSearch to StorageGRID

It's not cheap, but it may be required

## Introduction

OpenSearch can snapshot to S3. If you're running Instaclustr OpenSearch in your cloud account, it's much cheaper to snapshot to the cloud because you won't pay high egress fees.

But, if you must have a copy of OpenSearch snapshots on-premises, you could sync from cloud S3 to an on-premises StorageGRID bucket, or snapshot directly to StorageGRID.

The latter case isn't just generic data synchronization, so let's see how that works.

## TFM

[TFM](https://docs.opensearch.org/latest/tuning-your-cluster/availability-and-recovery/snapshots/snapshot-restore/) is clear.

Before we continue, I can't help but notice the same warning that Elasticsearch has:

> Don’t back up a cluster by copying the data directories of its nodes. A copy of the data directories is not a consistent backup, and restoring from such a copy can fail or silently lose data. Snapshots are the only reliable way to back up a cluster.

Believe it or not, people out there take hardware snapshots of Elasticsearch and OpenSearch hot volumes. Oh, well. Let's move on.
