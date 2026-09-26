# Show per-node performance guarantees of SolidFire storage nodes

Display per-storage node performance guarantees of SolidFire nodes

There’s a PowerShell script `sfvid2nid.ps1` in my Awesome SolidFire repository on Github. It produces a table that shows the mapping of volume IDs to node IDs.

SolidFire users sometimes ask about checking if their volumes are well-balanced.

SolidFire has its own definition of “well” means and users have no direct impact on how it works. It’s impossible to balance based on one factor (such as “average latency in last 60 seconds”) because volumes would bounce around all the time (which is nearly seamless - the effect on the client is like a quick fail-over - but still not good when too frequent).

SolidFire also won’t necessarily re-balance based only on Minimum IOPS. If all nodes in the cluster can satisfy Minimum IOPS and host the volume, then there’s no need to move it. Long story short, volumes are scheduled onto nodes based on Minimum QoS, volume size, node utilization and various other factors not exposed to the administrator or user.

Sometimes users don’t manage QoS settings, which results in predominantly capacity-based placement and distribution. Then, if several busy workloads happen to be on the same volume, they won’t be spread around because nominally the node can satisfy Minimum IOPS for such volumes.

Some best practices:

- Create several storage QoS Policies (even just basic Low, Med, High)
- Assign policies to volumes (rather than set custom storage QoS setting for every volume)
- Monitor storage and client performance and adjust volume settings and create new QoS policies for very granular control

The script just makes it possible to easily see where’s what and whether Minimum IOPS balance across storage cluster members looks sane (see the example below).

We could do better and rewrite this in Python and send it to Elasticsearch or other database, and monitor balancing over time. In my HCI Collector, which I’ve been lazy to rewrite, we could create similar monitors for Max and Burst IOPS, and use QoS Histograms to find volumes which may need to have their QoS changed (already implemented, in HCI Collector v0.7).

I say “may need” because the fact that someone is maxing their QoS (i.e. hitting Max IOPS) doesn’t mean their Maximum IOPS need to be increased: maybe they’re abusing the system, maybe the application behaves wastefully (poorly written SQL queries, etc.), and maybe the cluster is close to overloaded.

Because of that and other reasons (such as: Minimum IOPS setting is a SLO, Maximum is best-effort-no-guarantee) managing storage QoS can be somewhat of an art. To manage even better, we’d monitor individual volume utilization and adjust Maximum and Burst values as well, forming our decisions on potentially more than one factor (storage, compute workload, business priorities…).

Anyway, here’s a sample of committed minimums by node. If you want to check it out and use it, get the source from Awesome SolidFire on Github.

## Sample output from SolidFire 12.5 (five storage nodes)

Changes made today add the first table below, which contains the sum of Minimum IOPS of all volumes scheduled on a storage node (identified by Node ID).

As an example, we can see that node ID 1 carries most performance guarantees (51,000) and is just above the node’s performance rating (50,000 IOPS per node). That is not a big problem (IOPS are over-committed by only 2%). The cluster is reasonably well-balanced, but we should probably start looking into adding a node or lowering Minimum QoS settings for some volumes that don’t need it.

Why aren't Minimum IOPS better balanced? As mentioned above, that's not the only criterion used to balance volumes. Being 2% overcommitted in terms of Minimum IOPS guarantees is probably less bad than having big imbalances in metadata or some other trade-off.

```sh
Min IOPS by node ID:

Name                           Value
----                           -----
13                             43900
10                             43900
4                              43950
2                              43900
1                              51000

Volume-Node pairings by volume ID:

Name                           Value
----                           -----
262                            2
261                            2
260                            2
259                            10
258                            10
...

Volume-Node pairings by node ID:

Name                           Value
----                           -----
92                             1
93                             1
122                            1
135                            1
255                            1
3                              2
4                              2
51                             2
54                             2
...
```

If we added up all the Minimum IOPS for each volume together we should obtain the same figure we see in the SolidFire Web management interface - total Minimum IOPS. This cluster I used showed 226.65k IOPS (or 91% committed; (226.5k / (5 nodes * 50k per node)) in total Minimum IOPS guarantees which equals the sum of values from the first table.

The script doesn’t offer any options, but you can modify the script to suit your needs.
