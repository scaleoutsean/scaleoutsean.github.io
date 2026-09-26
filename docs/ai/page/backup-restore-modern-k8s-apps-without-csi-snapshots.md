# Backup and restore modern Kubernetes applications without CSI snapshots

## Introduction

After writing the previous [post on Kasten 9.0](/2026/07/29/kasten-k10-90.html), I was puzzled that backup workflows without CSI snapshots are still neglected and not made easier even as they improved pre-backup hooks.

I thought the expanded Blueprint Hooks were meant to ease backup without CSI snapshots, but that was wrong. "Logical" backups can do that, but Kasten doesn't recommended them except in trivial cases:

> As a guideline, logical blueprints remain practical for databases up to approximately 50 GiB.

You can read the previous post for additional context, but the summary is:

- Backups without CSI snapshots (what I call snapshotless backups) have not been made easier
- Logical backups aren't recommended 

I blogged about [Kasten blueprints](/2021/09/09/kasten-v4-with-solidfire-logical-and-snapshot-assisted-data-protection.html) almost **five years** ago, but at the time I thought about them from a perspective of storage efficiency compared with CSI snapshots. Which approach runs faster? What consumes less space? Those questions are important, but only for a minority of single-host databases and use cases. 

## Snapshotless CSI backups

### Backups vs. DIY copies

Automated data dumps to an external disk, NAS or S3 are also "backup copies", but often of *ad hoc* nature and not centrally managed. We can create such backups by simply [uploading snapshotted SolidFire volumes to S3](/2023/09/02/solidfire-backup-to-s3-backblaze-b2.html). Even with NoSQL, you can put a bunch of volumes in a SolidFire Consistency Group and have SolidFire upload those to a bucket. We could do that on E-Series from a backup worker with some SANtricity API automation, too. But that's not easy to manage and has many limitations when it's used at scale.

This post focuses on centrally managed data protection on Kubernetes.

### CSI snapshot-assisted vs. snapshotless backup to S3

This subtitle above is a fake dilemma. It doesn't matter what advantages CSI snapshots have if your application does not support backup and restore from filesystem backups. End of story.

But let's engage in a fake argument specific to a hideously un-recommended use case: NoSQL database running on 10 Kubernetes worker nodes with approximately 1TB per PVC. This scenario is grossly outside of the 50GB limit recommended by Kasten.

Let's see:
- Your application creates over 200 GB of changed data *per node* every day, so your snapshot reservation should be at least 1-2 TB (30% or 40% of 10TB would be even better; 1TB assumes two backups per day done quickly and followed by immediate deletion of snapshots while for daily frequency you'd need well over 2 TB in snapshot reservation capacity)
- Your on-premises S3 can read/write (GET/PUT) at 5 GB/s

You probably won't backup faster with CSI backups because they need to be throttled, and you'll probably have 2TB of flash capacity reserved for backup of that one application.

Or, you could take application "snapshots" (full or incremental asynchronous dumps) to NL-SAS-backed S3 object store and use Kasten blueprints to backup that data. At current prices, 20TB of S3 capacity may be cheaper than 3TB of SSD capacity, so even full data dumps to S3 wouldn't be more expensive.

Kasten does make a point regarding application support, where they note some applications don't even support CSI snapshots. I would say most of what we'd run on E-Series (databases, message brokers, etc.) **does not support CSI snapshots** at all or not well enough to be preferred over S3, so the right **order** is to look at whether snapshotless backup S3 makes more sense and not the backup size.

### How to do it

While writing yesterday's post on Kasten 9.0 I checked their documentation and did not find any examples of intermediate backup-to-S3. 

But after posting I kept looking and found that, although Kasten seems to be discouraging this approach, logical Kanister backups for large NoSQL databases are already a thing. 

So let us consider Elasticsearch. Let's [RTFM](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore#other-backup-methods):

> There are no supported methods to restore any data from a filesystem-level backup.

That one sentence should be enough to tell you what to do: use Elasticsearch'es snapshot-to-S3. 

Incremental Elasticsearch backup is a logical backup blueprint that doesn't require CSI snapshots. It dumps data to a landing zone on S3, after which it's "exported" to Kasten backup repository. That is exactly what I wanted.

There's another variant of this where you backup directly to Kasten S3 bucket, which is more efficient because it avoids an extra GET and PUT for backup data, but I don't like that idea. Moving several extra TB per day is trivial in on-premises S3 environments and having applications direct access Kasten S3 repository has its risks.

Kasten's Web site provides a Kanister blueprint for Elasticsearch, but not the one that uses S3 (that one isn't listed).

I found [the S3-based blueprint](https://github.com/kanisterio/blueprints/tree/main/elasticsearch-incremental) in Kanister's blueprints on Github. This is the backup task (see the entire blueprint on Github):

```yaml
- func: KubeTask
    name: snapshotElastic     
    args:
    namespace: ""                
    image: ghcr.io/kanisterio/kanister-kubectl-1.18:0.81.0
    command:
    - bash
    - +x
    - -o
    - errexit
    - -o
    - pipefail
    - -c
    - |                               
        ES_URL="https://-es-http:9200"
        PASSWORD=""
        REGION=""
        BUCKET=""
        ENDPOINT=""
        if [[ -z $ENDPOINT ]] 
        then 
            ENDPOINT="s3.amazonaws.com"
        fi
        REPO_PATH=""
        SNAPSHOT_NAME=""
        # reload the secure settings to access the S3 profile
        curl -k -u "elastic:$PASSWORD" -X POST "${ES_URL}/_nodes/reload_secure_settings?pretty" -H 'Content-Type: application/json' -d'
        {}
        '
        echo "Creating the repo"
        curl -k -u "elastic:$PASSWORD" -X PUT "${ES_URL}/_snapshot/k10_repo?pretty" -H 'Content-Type: application/json' -d'
        {
        "type": "s3",
        "settings": {    
            "bucket": "'$BUCKET'",
            "endpoint": "'$ENDPOINT'",
            "region": "'$REGION'",
            "base_path": "'$REPO_PATH'"
        }
        }
        '
        echo "creating the snap $SNAPSHOT_NAME" 
        curl -k -u "elastic:$PASSWORD" -X PUT "${ES_URL}/_snapshot/k10_repo/$SNAPSHOT_NAME?pretty"

        while curl -k -u "elastic:$PASSWORD" -X GET "${ES_URL}/_snapshot/k10_repo/$SNAPSHOT_NAME/_status?pretty" | grep -P "(IN_PROGRESS|STARTED)"
        do 
        echo "snapshot $SNAPSHOT_NAME still in progress"
        size_in_bytes=$(curl -k -u "elastic:$PASSWORD" -X GET "${ES_URL}/_snapshot/k10_repo/$SNAPSHOT_NAME/_status?pretty" |grep size_in_bytes)
        echo $size_in_bytes
        sleep 4
        done 

        if  curl -k -u "elastic:$PASSWORD" -X GET "${ES_URL}/_snapshot/k10_repo/$SNAPSHOT_NAME/_status?pretty" | grep SUCCESS
        then 
            echo "snapshot $SNAPSHOT_NAME was successful"
        else
            echo "snapshot $SNAPSHOT_NAME was not successful"
            reason=$(curl -k -u "elastic:$PASSWORD" -X GET "${ES_URL}/_snapshot/k10_repo/$SNAPSHOT_NAME/_status?pretty")
            echo $reason
            exit 1
        fi
```
   

If you try this at home (or in office) before I do, you can use stand-alone Elasticsearch or Elasticsearch Operator for Kubernetes (tested with E-Series [here](https://scaleoutsean.github.io/2026/04/13/elasticsearch-eck-kuberntees-netapp-santricity-csi.html)). I'd first pick the exact same version (not Elasticsearch 9) as the blueprint targets Elasticsearch version 8 and that version is more forgiving in any case.

NetApp StorageGRID 12 is known to work with both Elasticsearch 8 and 9 snapshots to S3. I blogged about StorageGRID with Elasticsearch ILM [here](/2023/11/30/elasticsearch-ilm-netapp-eseries.html), by the way.

## Conclusion

As a side note, I have two CSI drivers with CSI snapshot support - one for E-Series and another for SolidFire. 
- IBM Block CSI with SANtricity Patch
- SolidFire CSI

But that's not a sufficient reason to use them if there's a better way.

On-premises S3 object stores give you practically unlimited capacity, unlimited sequential performance and work nicely across physical locations. That's why everyone uses them for backup data stores, including Kasten. So, why not avoid CSI snapshots and use S3 in situations where that is clearly better?

And it's not even a matter of choice.

Most applications we'd want to run on E-Series-backed Kubernetes do not even support CSI snapshots. Feel free to check [Qdrant](/2026/05/26/multi-node-qdrant-vector-db-netapp-eseries-santricity-csi.html#qdrant-backups), Milvus (let me save you time, [CSI backup is not supported](https://milvus.io/docs/milvus_backup_overview.md)), [Splunk](/2026/04/21/splunk-kubernetes-operator-netapp-eseries-santricity.html) and what-have-you.

Even when an application supports CSI snapshot-assisted backup and S3 buckets, you're likely to be better off backing them up to an external on-premises Object Store (that is to say, not to a MinIO pod running in Elasticsearch namespace, like "home enthusiasts" do).

[PostgreSQL](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html#e-series-csi-and-barman-cloud-cnpg-i-backup) is a good example. As I described in that article, rotating short-lived snapshots for the sake of having a snapshot may be a good idea, but I believe that, for modern applications on Kubernetes, backups that use CSI snapshots must have entered irreversible decline.

There are interesting, but fundamentally flawed arguments in favor of CSI snapshots:

- Backup volumes are incremental and therefore backup is always manageable, regardless of size
- Data restore can be done in seconds, which one can never achieve with backup-to-S3

These used to be almost valid 10 years ago, but both of them fall apart these days.

With everything interconnected, data loss in one place may require a lot of recovery actions elsewhere. Convenience can't justify data loss but, unless you replicate or take snapshot once every second, non-insignificant data loss is inevitable.

We want to replicate application data to a fully redundant replica and from there *continuously* backup to S3 using application-native API (see the [first CNPG post](/2026/05/01/cloud-native-postgres-kuberntes-netapp-eseries-csi.html#fail-over-and-fail-back) to see what I mean, how seamlessly failover and failback work in that setup). Not only do we have close to zero data loss, but switch-over to replica is also faster than recovery from a snapshot. And even if we need to use a backup, that can be any Point-in-Time, not just the times when snapshots were taken.

And, as goes Postgres, so goes the rest of analytics and [data lakehouses on Kubernetes](/2026/06/20/lakekeeper-iceberg-rest-catalog-netapp-eseries.html) stacks.

## Appendix A: logical blueprint for snapshotless Elasticsearch B&R

Not having any concrete requirement that would lead me to use some other application, I continued with Elasticsearch.

To make this proof-of-concept less disruptive, I stuck with the same version the Kanister blueprint (8.4.1) was tested with. It's an old version, but we're interested in general applicability of the pattern and not even which application is used.

I wanted to use Kasten 9 (installed while writing [the previous post](/2026/07/29/kasten-k10-90.html#appendix-a-deploy-kasten-902-with-solidfire-csi-102)) and add that blueprint to Kasten, but I did not have enough resources for all those things (and Elasticsearch Operator). 

I ended up using Kanister 0.119.0 and a stand-alone instance of Elasticsearch based on recipe forked from [here](https://github.com/bon10/simple-k8s-elasticsearch/), but set to v8.4.1 and fixed to run on my Kubernetes.

Here we see `kasten-io`, as Kasten was installed, but I was using blueprints from the `kanister` namespace (not built-in Kanister blueprints).

```sh
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   37d   v1.35.1

$ kubectl get namespaces
NAME                              STATUS   AGE
ais                               Active   31d
container-object-storage-system   Active   37d
default                           Active   37d
elasticsearch                     Active   3h59m
kanister                          Active   3h10m
kasten-io                         Active   27h
kompromise-system                 Active   35d
kube-node-lease                   Active   37d
kube-public                       Active   37d
kube-system                       Active   37d
operator-system                   Active   24d
sg-bucketshop                     Active   31d
sg-cosi-coke                      Active   6d5h
solidfire-csi                     Active   12h
```

About that CSI snapshot point - I used SolidFire CSI for this. CSI snapshots were available, but I did not use them.

```sh
$ kubectl get pvc -n   elasticsearch
NAME                      STATUS   VOLUME             CAPACITY   ACCESS MODES   STORAGECLASS       VOLUMEATTRIBUTESCLASS   AGE
es-data-elasticsearch-0   Bound    elasticsearch-pv   2Gi        RWO            solidfire-bronze   <unset>                 4h26m

$ kubectl get volumesnapshotclass
NAME                  DRIVER              DELETIONPOLICY   AGE
solidfire-snapclass   csi.solidfire.com   Delete           13h
```

Using Kanister's CLI, as I didn't use Kasten, I created a profile for StorageGRID bucket called `snapshotless`:

```sh
kanctl create profile s3compliant --access-key k....e....y \
        --secret-key abc....123 \
        --bucket snapshotless --region us-east-1 \
        --endpoint http://192.168.1.211:10080 \
        --skip-SSL-verification \
        --namespace elasticsearch
```

There's some corner-cutting going on, like no TLS validation, and using HTTP, which we wouldn't do in production.

That command created a profile and secret in my application's namespace:

```sh
secret 's3-secret-64gbq9' created
profile 's3-profile-cbpmt' created
```

Then I installed a modified blueprint that doesn't rely on Elasticsearch operator, which I wasn't running. But the rest is the same.

```sh
kubectl apply -f blueprint-standalone/elasticsearch-standalone-incremental-blueprint.yaml -n kanister
```

Elasticsearch and Kanister pods:

```sh
$ kubectl get pods  -n elasticsearch
NAME                      READY   STATUS    RESTARTS        AGE
elasticsearch-0           1/1     Running   0               3h28m
kibana-674fc6b6c7-t4j8h   1/1     Running   1 (3h41m ago)   3h50m

$ kubectl get pods  -n kanister
NAME                                         READY   STATUS    RESTARTS   AGE
kanister-kanister-operator-d66f876dd-9trq6   1/1     Running   0          3h11m

```

With that we could test create-backup-delete-restore.

Elasticsearch "snapshot-to-S3" worked fine with StorageGRID 12.1. Nothing unexpected.

![Elasticsearch backup on SG 12.1](/assets/images/snapshotless_csi_backups_to_s3_00_elasticsearch.png)

Here's a log of Kanister's delete-restore action:

```sh
[2026-07-31T12:06:22,933][INFO ][o.e.c.m.MetadataDeleteIndexService] [elasticsearch-0] [.geoip_databases/kgsYlD5XTlGUA156VL4nGA] deleting index
[2026-07-31T12:06:22,964][INFO ][o.e.c.s.ClusterSettings  ] [elasticsearch-0] updating [action.destructive_requires_name] from [false] to [true]
[2026-07-31T12:06:23,041][INFO ][o.e.s.RestoreService     ] [elasticsearch-0] started restore of snapshot [k10_repo:snap_2026-07-31t12:04:32z07:00/Tri_EN1OSq6-xEKJG9AfvQ] for indices [my-index-000002, .kibana_8.4.1_001, .kibana_task_manager_8.4.1_001, .apm-custom-link, my-index-000001, .geoip_databases, test01, .apm-agent-configuration, .ds-ilm-history-5-2026.07.31-000001, .ds-.logs-deprecation.elasticsearch-default-2026.07.31-000001, .kibana-event-log-8.4.1-000001, demo-snap]
[2026-07-31T12:06:23,158][ERROR][o.e.i.g.GeoIpDownloader  ] [elasticsearch-0] exception during geoip databases update
org.elasticsearch.ElasticsearchException: not all primary shards of [.geoip_databases] index are active
[2026-07-31T12:06:24,646][WARN ][r.suppressed             ] [elasticsearch-0] path: /.kibana_8.4.1/_doc/telemetry%3Atelemetry, params: {index=.kibana_8.4.1, id=telemetry:telemetry}
org.elasticsearch.action.NoShardAvailableActionException: No shard available for [get [.kibana_8.4.1][telemetry:telemetry]: routing [null]]
Caused by: org.elasticsearch.transport.RemoteTransportException: [elasticsearch-0][10.244.1.5:9300][indices:data/read/get[s]]
Caused by: org.elasticsearch.index.shard.IllegalIndexShardStateException: CurrentState[RECOVERING] operations only allowed when shard state is one of [POST_RECOVERY, STARTED]
[2026-07-31T12:06:28,037][INFO ][o.e.s.RestoreService     ] [elasticsearch-0] completed restore of snapshot [k10_repo:snap_2026-07-31t12:04:32z07:00/Tri_EN1OSq6-xEKJG9AfvQ]
```

There's some noise in the middle as Elasticsearch is **not shutdown** while index is being restored.

Complete view:

![Noise during restore](/assets/images/snapshotless_csi_backups_to_s3_01_restore_noise.png)

That is completely normal, as index data is coming online.

It's like recovering a SQL Server instance - restore, then attach. Other "instances" (indexes) are all online while we're restoring a failed index.

Kanister action log shows completed restore actions.

![Restore action log](/assets/images/snapshotless_csi_backups_to_s3_02_restore_complete.png)

Compared to restoring from CSI snapshots where *all* pods would have to be restarted, notice that my Elasticsearch pod wasn't restarted even once on the node where the index lived.

```sh
$ kubectl get pods -n elasticsearch
NAME                      READY   STATUS    RESTARTS        AGE
elasticsearch-0           1/1     Running   0               4h9m
kibana-674fc6b6c7-t4j8h   1/1     Running   1 (4h23m ago)   4h31m

$ kubectl get pods -n kanister
NAME                                         READY   STATUS    RESTARTS   AGE
kanister-kanister-operator-d66f876dd-9trq6   1/1     Running   0          3h53m
```

I conclude that having a Kasten or Velero or other wrapper around application-native APIs isn't a bad idea when you need centralized control and data protection management.

There is one "it depends" answer, to the question of whether we should use logical backups to PUT/POST data directly to the backup application (Kasten, Veeam, etc.) bucket, or first dump to an intermediate/ephemeral bucket. I don't think there is one answer to this because:

- In some cases (compliance, security and other concerns), only backup application itself can have access to its S3 repository. So you can't upload directly
- In other cases, it is physically impossible to dump a backup to one "ephemeral" bucket and use wrapper to copy or "move" it to another (Kasten's). Incremental backup may have 8PB of data, or backup data created by the application may be very complex (see below). Some applications create easy-to-understand snapshot archives and those can probably be nicely managed from the wrapper before uploading them to the final backup repository. Elasticsearch isn't one of them.

```sh
$ mc ls s3/snapshotless
[2026-07-31 19:35:27 CST] 4.6KiB STANDARD index-1
[2026-07-31 19:35:27 CST]     8B STANDARD index.latest
[2026-07-31 19:35:21 CST]  25KiB STANDARD meta-4W-t93r1TrKmXwzJ-uy9IQ.dat
[2026-07-31 19:35:27 CST]  25KiB STANDARD meta-VzeLXHEnSPiR5jJ_VqpLXg.dat
[2026-07-31 19:35:22 CST]   640B STANDARD snap-4W-t93r1TrKmXwzJ-uy9IQ.dat
[2026-07-31 19:35:27 CST]   644B STANDARD snap-VzeLXHEnSPiR5jJ_VqpLXg.dat
[2026-07-31 22:30:43 CST]     0B indices/
[2026-07-31 22:30:43 CST]     0B k10/

$ mc ls s3/snapshotless/indices
[2026-07-31 22:30:51 CST]     0B 1OWrlZTgQ9O0RcH-wrwjHA/
[2026-07-31 22:30:51 CST]     0B ExBHBuTXRaSYYWTwPPF7Rw/
[2026-07-31 22:30:51 CST]     0B MWJwos33TieLYgwOoOfplw/
[2026-07-31 22:30:51 CST]     0B Mk8h7BXeSVCXu_V5iFPz-w/
[2026-07-31 22:30:51 CST]     0B MtdUhIToSr6FU-MfKsrt_Q/
[2026-07-31 22:30:51 CST]     0B _MiuWCUBS72DgX8cX4oPDw/
[2026-07-31 22:30:51 CST]     0B eBLUtctDQs2MxedktsxWMA/
[2026-07-31 22:30:51 CST]     0B ezYxelonRRy6x214D_x43Q/
[2026-07-31 22:30:51 CST]     0B ghfpuIoUR06KuNZsjX0SQA/
[2026-07-31 22:30:51 CST]     0B qYdmvgzlR1mwbGYzBs8AOg/
[2026-07-31 22:30:51 CST]     0B qzomnfvDQp2nG79xcYdacA/
[2026-07-31 22:30:51 CST]     0B t5oGP3PFQomGka5fiBvUjg/

$ mc ls s3/snapshotless/indices/t5oGP3PFQomGka5fiBvUjg/0/
[2026-07-31 19:35:24 CST]   456B STANDARD index-kMZMF51ZRwq99Vvsg0LZsQ
[2026-07-31 19:35:10 CST]   460B STANDARD snap-4W-t93r1TrKmXwzJ-uy9IQ.dat
[2026-07-31 19:35:24 CST]   457B STANDARD snap-VzeLXHEnSPiR5jJ_VqpLXg.dat
```

Monkeying around with these would be complicated and error-prone. Not worth the trouble!

That's why I think there's no one best way. A decent way might be:

- Create a path within the Kasten S3 repo-bucket for each of these applications with direct access
- Since these represent non-Kasten applications (Kanister), create separate ACLs for this path to prevent access to the rest of data in the bucket. If you use Kasten blueprints, you'd just use blueprints to backup directly to Kasten S3 repository - that would be simpler
- Have versioning and ObjectLock enabled
- Collect, [analyze](https://github.com/scaleoutsean/storagegrid-audit-analysis) and retain StorageGRID audit log

For applications where snapshot-to-S3 is easier to work with, I still prefer the two-hop approach, but that is not workable in all cases.

We should prefer the approach that uses Elasticsearch operator and try it with a multi-node cluster, but as far as the question of CSI snapshot-less Kubernetes backups is concerned, it seems obvious to me these - whenever possible - are vastly superior to CSI snapshots, especially in Cloud-Native deployments.
