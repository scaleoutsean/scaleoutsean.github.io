# StatefulSet PVC Retention with Trident and SolidFire

How Stateful Set PVC Retention may benefit SolidFire users

## Introduction

PVC retention has entered beta in Kubernetes v1.27, and some Trident-SolidFire users may be wondering if that's something that can benefit them and how.

As a reminder, the `persistentVolumeClaimRetentionPolicy` section is new:

```yaml
apiVersion: apps/v1
kind: StatefulSet
...
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain
    whenScaled: Delete
```

As you probably figure, these will result in following:
- When a replica is deleted, PVC used by replica will be left in place
- When a replica is scaled, PVC used by replica will be deleted

Each option can be set to either Retain or Delete.

What about it?

## PVC retention with SolidFire 

There are several scenarios in which this can benefit the user. For example:
- Making a copy takes time, so the ability to leave PVC after StatefulSet is scaled from 4 to 3 means later when it has to be scaled from 3 to 4, it will be quick
- Leaving a copy (or PVC in general) in place may not be "expensive". For example, SolidFire has global deduplication, so leaving a MySQL read-only replica around should be almost free
- If you have a replicated workload that scales in and out often, it's cheaper to avoid copying and leave data copies (Stateful Set PVC) in place

Then there are management benefits, due to automated handling of that behavior.

For example, to automate deletion you'd either have to create a storage class with the retention policy Delete, or manually remove volumes. I guess the average user would be afraid to lose data due to accidental removal of the app, so they'd use a storage class with Retain. But then every time autoscaling scales down, you end up with a bunch of volumes that you must manually get rid of.

These new PVC retention give Stateful Sets more options. The user can get the same behavior as before, but they can also get more sophisticated behavior without management overheads.

## Example: MySQL (or MariaDB) Stateful Set with SolidFire

In this scenario I have a read-write MySQL Master and a read-only Replica. PVCs are set to remain after down-scaling.

```yaml
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain
    whenScaled: Retain
```

Replicas are made "automatically" by dumping Master's data to a new MySQL database which is then setup as read-only replica that Master replicates to. 

Even if the DB is empty, that initial process takes around 30 seconds.

```sh
$ kubectl -n mysql get pod -l app=mysql --watch
NAME      READY   STATUS     RESTARTS   AGE
mysql-0   0/2     Init:0/2   0          4s
mysql-0   0/2     Init:1/2   0          13s
mysql-0   0/2     PodInitializing   0          14s
mysql-0   1/2     Running           0          15s
mysql-0   2/2     Running           0          26s
mysql-1   0/2     Pending           0          0s
mysql-1   0/2     Pending           0          0s
mysql-1   0/2     Pending           0          9s
mysql-1   0/2     Init:0/2          0          9s
mysql-1   0/2     Init:1/2          0          18s
mysql-1   0/2     Init:1/2          0          19s
mysql-1   0/2     PodInitializing   0          29s
mysql-1   1/2     Running           0          30s
mysql-1   2/2     Running           0          35s

```

That creates two PVCs on demand, based on PVC template in Stateful Set:

```sh
$ kubectl get pvc -n mysql
NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES
data-mysql-0   Bound    pvc-691dbe9f-7815-475f-8d07-cba490f40dd1   1Gi        RWO         
data-mysql-1   Bound    pvc-aa820d99-4262-491b-90c3-b9cc3e424ca7   1Gi        RWO         

```

Let's scale that down to a single copy:

```sh
$ kubectl scale statefulset mysql --replicas=1 -n mysql
statefulset.apps/mysql scaled

```

In this Stateful Set, it takes over one minute to take down a read-only replica. 

I have `whenScaled: Retain`, so the both volumes remain.

```sh
$ kubectl -n mysql get pod -l app=mysql --watch
NAME      READY   STATUS        RESTARTS   AGE
mysql-0   2/2     Running       0          81s
mysql-1   2/2     Terminating   0          55s
mysql-1   0/2     Terminating   0          82s
mysql-1   0/2     Terminating   0          82s
mysql-1   0/2     Terminating   0          82s
mysql-1   0/2     Terminating   0          82s

$ kubectget pvc -n mysql
NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
data-mysql-0   Bound    pvc-691dbe9f-7815-475f-8d07-cba490f40dd1   1Gi        RWO            nfs-basic      2m39s
data-mysql-1   Bound    pvc-aa820d99-4262-491b-90c3-b9cc3e424ca7   1Gi        RWO            nfs-basic      2m13s

```

I need to run some read-only reports, so I will scale out to two replicas which is something I had before.

```sh
$ kubectl scale statefulset mysql --replicas=2 -n mysql
statefulset.apps/mysql scaled

$ kubectl -n mysql get pod -l app=mysql --watch
NAME      READY   STATUS     RESTARTS   AGE
mysql-0   2/2     Running    0          2m55s
mysql-1   0/2     Init:0/2   0          2s
mysql-1   0/2     Init:1/2   0          3s
mysql-1   0/2     PodInitializing   0          4s
mysql-1   1/2     Running           0          5s
mysql-1   2/2     Running           0          10s

```

This time it took only 10 seconds, because the process was simpler: the PVC was already there and had a filesystem and data on it.

Similarly, going from 2 to 3 replicas in a set that used to have 3 replicas before is also fast: the first scale-out (2->3) took 37s, but going back from 2 to 3 again took only 5s:

![Quick scale-out with retained PVC](/assets/images/kubernetes-1-27-beta-stateful-set-pvc-retention-mysql.png)

Of course, it won't be that fast when Master differs from Replica by 500GiB, but if catch-up method in Stateful Set replication is incremental, syncing 0.5 TiB (differential sync) beats syncing something like 2.5 TiB (full sync).

## Other notes

### Local replication workload

A TB-sized stateful set that requires a replica likely requires 1TB of data copying.

If we have a Master MySQL instance with three replicas and data is being added to Master at 5 MB/s, the replicas may add another 15 MB/s in local write workload.

We need to consider these details when deciding whether to use Stateful Sets, and when we do, whether it's cheaper to retain or delete.

This is also one of the answers to the question "why not leave Stateful Set at max number of replicas at all times?" - we could, but it will constantly consume CPU, RAM and IO resources. If you run SQL reports once a week or month, it may be better to scale out just in time.

### Remote replication workload

With database workloads it is expected that each replica may have at least slightly different data (e.g. transaction log may not be 100% the same on each stateful set member). Replicas in other stateful set workloads  - such as Web applications - may completely deduplicate each other, especially if logging is done to an external location.

Because of these differences it's hard to give a generic estimate for the increase in replication bandwidth with stateful sets. In some cases it may be very low, in others it may be a little higher and in the extreme case using N copies may result in a lot more replication bandwidth. 

I would suggest to analyze larger stateful sets case by case, and if they're often scaled up and down, consider retaining them on scale-down if bandwidth is more scarce than IO or disk space. 

Another thing to consider is volume pairing for stateful sets: if they're deleted every time a stateful set is scaled down, then volume pairing needs to be cleaned up. If there's no automation in place, it may be better to leave unnecessary volumes in place during scale-down periods and remove them only periodically.

### Load balancing

To balance workload with MySQL, Stateful set had the client pick a random server for read queries. This sample query would select server ID and current time:

```sql
SELECT @@server_id,NOW()
```

That worked well. When I scaled out, I had to submit new queries to have the new server (server_id 102 was added last) picked by the client. That wasn't a big deal as client sessions come and go.

```raw
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         100 | 2023-08-20 07:01:47 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         100 | 2023-08-20 07:01:48 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         101 | 2023-08-20 07:01:49 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         101 | 2023-08-20 07:01:50 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         100 | 2023-08-20 07:01:51 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         102 | 2023-08-20 07:01:52 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         102 | 2023-08-20 07:01:53 |
+-------------+---------------------+
+-------------+---------------------+
| @@server_id | NOW()               |
+-------------+---------------------+
|         101 | 2023-08-20 07:01:54 |
+-------------+---------------------+
```

I assume other databases and applications (MongoDB, Elasticsearch) can do similar load-balancing on their own. 

I tried Elasticsearch scaling when [checking DirectPV](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) post, but I didn't pay attention to client-side behavior after.

### Backup and restore

I wonder what would be best practices for backup and restore in this specific case (MySQL with read-only replicas). Most likely we don't need to backup anything but Master, as additional replicas contain repetitive data. For sharded databases we'd definitively want all PVCs that have part of the whole, but for replicas we'd likely filter by Master pod name or tag and backup that while ignoring the rest.

## Conclusion

PVC retention for Stateful Sets is a useful feature. 

Although it doesn't do anything that we can't do manually, it is convenient, offloads work to K8s, and eliminates problems and errors. 

Because of that more people may choose to retain PVCs (or delete them, as they no longer need to do that manually, so they can leave it to Stateful Set).

On SolidFire this is convenient because due to RF2 (or "Helix") write workloads tend to be much slower than read, so being able to avoid unnecessary re-creation of replica volumes in Stateful Sets helps with performance and shortens time to results. If your application resync is differential or incremental, resyncing a StatefulSet volume can help avoid writing TBs of data.

If you do this at scale, writing a custom clone mechanism may save you even more time (by using clone & import, rather than full backup & restore, for example), but I assume many operators out there are smart and can do this well.

Due to deduplication (see [anecdotal evidence](/2022/07/05/kafka-solidfire-efficiency.html)), the cost of leaving a extra PVC around may be very low.
