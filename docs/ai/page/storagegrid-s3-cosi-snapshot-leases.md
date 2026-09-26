# Enable PiT backup of NetApp StorageGRID buckets with sg-cosi

Using COSI with StorageGRID snapshots in PiT bucket backup workflows

## Introduction

Let's say I manage a StorageGRID tenant account with dozens of technical users.

Some want to backup their StorageGRID buckets to another on-premises S3 object store.

It must be convenient, easy, affordable. There's no PII or confidential data involved. Some users' data on StorageGRID is already encrypted with client-side encryption.

## Low-cost StorageGRID backup

- I have existing StorageGRID 12.1
  - My source buckets must be versioned for this. I enable that for users who don't need it and for those users I set non-current version expiry to seven days
- Low-cost S3 storage solution for 1PiB and bucket data that dominate my tenant:
  - Versity S3 Gateway (any of: VM, Docker, [Kubernetes](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html), bare metal)
  - NetApp E-Series E4012 (direct attach; iSCSI or SAS)
 
Since I happen to have a [StorageGRID COSI driver](/2026/07/25/storagegrid-12_1-sg-cosi-0_5_4.html#sg-cosi-054) that can create read-only snapshots, I thought that was a good chance to make use of it.

Normally, bucket leases are created for COSI users to access them from Kubernetes. However, StorageGRID doesn't run on Kubernetes, so we can create **snapshot** leases for the purpose of taking a backup *from anywhere*.

These snapshots are point-in-time - see my other posts about StorageGRID [bucket snapshots](/2026/06/13/storagegrid-sg-cosi-branch-snapshots.html) - exactly what we need while we are copying S3 data to another bucket.

This is what a SnapshotLease created for such use cases looks like. It's meant for the `bucketshop` bucket.

```yaml
apiVersion: cosi.scaleoutsean.github.io/v1alpha1
kind: SnapshotLease
metadata:
  name: bucketshop-backup-source
  namespace: sg-cosi-coke
spec:
  driverName: coke.sg.cosi.dev
  sourceBucket: bucketshop
  duration: 24h
  # Optional point-in-time and filter settings:
  beforeTime: "2026-09-15T00:00:00Z"
  filterType: before
  credentialsSecretName: cosi-backup-source-credentials
```

- source bucket: `bucketshop`
- duration: keep it around for 24 hours
- before time: give me a point-in-time view as of September 15 UTC
- credentials secret name: StorageGRID credentials for **the user account** (who "owns" `bucketshop`) in the Minikube namespace dedicated to this account. Each user uses own COSI driver (it consumes very little resources) in own namespace. There's nothing new here, I'm just reiterating how COSI works

Minikube doesn't do anything else - it just creates and destroys these snapshots and (temporary) S3 credentials.

I can run it in a VM or I can deploy sg-cosi to issue snapshot leases on existing Kubernetes. The deployment must be able to reach my tenant management API (obviously).

Let's apply that.

```sh
$ kubectl apply -f examples/my-snapshotlease-test.yaml

$ kubectl describe snapshotlease bucketshop-backup-source -n sg-cosi-coke
Name:         bucketshop-backup-source
Namespace:    sg-cosi-coke
Labels:       <none>
Annotations:  <none>
API Version:  cosi.scaleoutsean.github.io/v1alpha1
Kind:         SnapshotLease
Metadata:
  Creation Timestamp:  2026-09-17T15:49:41Z
  Finalizers:
    cosi.scaleoutsean.github.io/snapshotlease-cleanup
  Generation:        1
  Resource Version:  10193467
  UID:               e4c92cf3-6432-4a7b-b5c5-76553092deac
Spec:
  Before Time:              2026-09-15T00:00:00Z
  Credentials Secret Name:  cosi-backup-source-credentials
  Driver Name:              coke.sg.cosi.dev
  Duration:                 24h
  Filter Type:              before
  Source Bucket:            bucketshop
Events:                     <none>

```

And my snapshot is ready.

![Bucket snapshot](/assets/images/sg-cosi-snapshot-leaases-00-bucket-snapshot.png)

What we have here is:

- (1) Source bucket, and
- (2) Snapshot bucket, with "best before" date as specified

Get access details:

```sh
$ SECRET=$(kubectl get snapshotlease bucketshop-backup-source -n sg-cosi-coke \
  -o jsonpath='{.status.resources.credentialsSecret}')

$ kubectl get secret "$SECRET" -n sg-cosi-coke \
  -o jsonpath='{.data.BucketInfo}' | base64 -d | jq
{
  "metadata": {
    "name": "bc-8cb7c627-3123-46ad-bdd4-3d601863beab",
    "creationTimestamp": null
  },
  "spec": {
    "bucketName": "sl-3618def8-bc3586bf5b-0444-49ee-82d7-f15d2f0ac3e4",
    "authenticationType": "Key",
    "secretS3": {
      "endpoint": "https://192.168.1.211:10443",
      "region": "us-east-1",
      "accessKeyID": "F4MT3V8TGAM0ABHMFZ9K",
      "accessSecretKey": "bla-bla-bla"
    },
    "secretAzure": null,
    "protocols": [
      "s3"
    ]
  }
}

```

One of the (very few) nice things about COSI is all the information required to connect is contained in a lease.

Create a bucket on the destination object store.

![Bucket destination empty](/assets/images/sg-cosi-snapshot-leaases-01-bucket-destination.png)

Define both the source and destination in your backup tool.

```sh
# StorageGRID S3 API endpoint for SG-Coke Tenant
mc alias set --path auto --api S3v4 bucketshop-source https://192.168.1.211:10443 F4MT3V8TGAM0ABHMFZ9K bla-bla-bla
# Versity S3 Gateway
mc alias set --path auto --api S3v4 bucketshop-target https://192.168.1.100:7070 bucketowner bucketpass
```

Copy/backup however you wish. You could backup your bucket to a different destination or rotate 3 destinations, for example. You could also enable versioning and ObjectLock on the destination.

```sh
mc mirror --exclude "images/" --older-than 3d \
   bucketshop-source/bucketshop \
   bucketshop-target/bucketshop
```

We can compare buckets and inspect content to confirm.

The source:

```sh
$ mc ls cosi/bucketshop
[2026-09-07 03:53:10 CST]  37KiB STANDARD log.jsonld
[2026-09-07 04:17:03 CST] 3.3KiB STANDARD trino-query.py
[2026-09-20 22:00:19 CST]     0B documents/
[2026-09-20 22:00:19 CST]     0B images/
[2026-09-20 22:00:19 CST]     0B videos/

```

The target:

```sh
$ mc ls bucketshop-target/bucketshop/
[2026-09-18 00:23:51 CST]  37KiB STANDARD log.jsonld
[2026-09-18 00:24:46 CST] 3.3KiB STANDARD trino-query.py
[2026-09-18 01:18:17 CST]     0B documents/
[2026-09-18 01:18:17 CST]     0B images/
[2026-09-18 01:18:17 CST]     0B videos/

$ mc ls bucketshop-target/bucketshop/images
[2026-09-18 00:25:27 CST] 6.8MiB STANDARD cat.gif
[2026-09-18 00:25:27 CST] 3.0KiB STANDARD church.jpeg
[2026-09-18 00:25:27 CST] 3.0KiB STANDARD couple.jpg
[2026-09-18 00:25:27 CST]  12KiB STANDARD easy.png
[2026-09-18 00:25:27 CST] 3.0KiB STANDARD job.jpeg
[2026-09-18 00:25:27 CST] 6.2KiB STANDARD only.gif
[2026-09-18 00:25:27 CST] 6.2KiB STANDARD such.gif
[2026-09-18 00:26:09 CST]     0B etl/
[2026-09-18 00:26:09 CST]     0B home/
```

Backup is done! (I don't have versioning and ObjectLock enabled on the target, but VGW does support it.)

![Bucket destination done](/assets/images/sg-cosi-snapshot-leaases-02-bucket-destination-done.png)

Once the maximum or set time is up, sg-cosi deletes the snapshot and S3 keys for it.

![Deleted Snapshot Lease](/assets/images/sg-cosi-snapshot-leaases-03-snapshot-lease-deleted.png)

## Things to be aware of

Bucket owners need to remember they're in charge of making sure they picked the right options and made copies to their satisfaction.

Whether they use `rclone` or `mc` or `aws s3 api`, it doesn't matter - it's up to them. 

Readers with a sharp eye may have noticed I had to use `--exclude "images/"` to get around the fact that I had an object named "`images/`" at the source. That's up to the user and has nothing to do with snapshot leases.

Likewise, StorageGRID *allows* more metadata than AWS S3, so if you do use more than AWS S3 allows and replicate, that may fail. `rclone` has almost 1000 [open issues](https://github.com/rclone/rclone/issues) and `mc` is no longer maintained, so you need to keep an eye on that, too. That is the cost of low cost.

If there's a lot of data and the user needs more time, they may extend their snapshot lease. The hard-coded sg-cosi maximum lease is seven days.

```sh
kubectl patch snapshotlease project1-backup-source -n sg-cosi-coke \
  --type=merge \
  -p '{"spec":{"renewUntil":"2026-09-18T12:00:00Z"}}'
```

You can create two active leases - there are legitimate use cases for that, such as backup to different destinations - but if an "update" runs before previous backup has completed, you can create a mess at the destination. 

Then, remember use the appropriate destination for the job. StorageGRID can have 100 million objects with the same prefix. The Versity S3 Gateway may not work well as a target for backup from such buckets (although you could use something else than rclone, and chunk data into 4GiB tar files, but you'd have to find a way to avoid retransmitting everything every time you backup this way). An option is to use something to mount S3 bucket as filesystem and Kopia to backup to an S3 target (with more things in the process that can go wrong).

Finally, not all StorageGRID buckets are suitable for replication to Versity S3 Gateway. If you have large buckets, or large objects, or many objects, you must carefully evaluate your destination object store options.

Depending on your needs, you could choose to replicate to another StorageGRID or some other S3 object store. Even to the public cloud. 

## What else can be done

Originally I thought to create a backup job scheduler in Kubernetes that would be deployed to COSI user's namespace. But then I'd have to make many choices for the user and own those choices, so I gave up on that idea.

If your situation is relatively simple and predictable, you can use SnapshotLeases from the same namespace where you run backup/replication and take advantage of Kubernetes security, logging, auto-scaling and more.

I know having all that done would be nice, but I leave that as an exercise for the user. COSI already does enough for this workflow. It's nice and simple use case for an otherwise failed concept ([I mean COSI](/2026/06/07/cosi-v1alpha1-is-garbage.html)).

Because snapshot and credentials lifecycle are automated, it is easy to consume them from commercial tools for S3, in the case you think the free tends to end up being more expensive.

## Conclusion

This is a neat and practical use case for StorageGRID bucket snapshots. I haven't heard of anyone making use of that feature yet, and while no one is using sg-cosi *in production*, the concept of snapshot leases is production-worthy can can be expanded to run managed backup and replication jobs in namespaces where snapshot leases are created.

Snapshot leases enable effortless low-cost - but not *just* low-cost - automation of bucket snapshots and S3 credentials vendoring for the purpose of data protection.

Commercial tools can gain access to a point-in-time view of a bucket without any awareness of StorageGRID, making it possible to take consistent backups of buckets with any data - from datalakes to unstructured datasets that rapidly change.
