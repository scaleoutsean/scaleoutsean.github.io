# Reporting SolidFire cluster and volume pairing relationships

Creating reports for SolidFire cluster pairs and volume replication pairs

## Introduction

This week I [released](/2024/06/11/introducing-project-longhorny.html) Longhorny, my simple tool for SolidFire volume replication management and while there's a "list" action for both cluster and volumes, I mentioned that these are meant to list relationships for a Longhorny-supported setup the user is working with, which is 1-to-1 exclusive pairing.

Longhorny can also find mismatched volumes, so given that Longhorny won't even pair clusters with an existing relationship, the only problem that can happen with careful management is a mismatched volume or two.

I did notice two things, though: if a cluster is already paired, Longhorny doesn't particularly care why and who, it just exits. Figuring out why is out of scope. The second is that if there's more than a handful of mismatched volumes, which may happen in large clusters, it may be hard to figure out what's what.

That made me think about creating the report action that would report on anything it sees - for both cluster relationships and volume relationships - and potentially be useful to non-Longhorny users with multiple clusters as well.

## Matrices

It took me a while to figure out what I'd like to see and how to display it. 

For now I'm using a basic approach - 2D matrix with N elements where N = (number_of_clusters + 1). The one extra cluster is for unconfigured/pending relationships.

In the case of Longhorny, which supports two (1-to-1) clusters, that would be 3x3.

I examine relationships from each cluster and when it's all good, I get a matrix like this.

```sh
CLUSTER CONNECTIONS

              PROD  DR  UNCONFIGURED
PROD             0   1             0
DR               1   0             0
UNCONFIGURED     0   0             0
```

If it's not good, then UNCONFIGURED may have more than 0 relationships or one of the other clusters has more than 1. Example:

```sh
CLUSTER CONNECTIONS

              PROD  DR  UNCONFIGURED
PROD             0   1             0
DR               1   0             0
UNCONFIGURED     1   0             0

UNCONFIGURED CLUSTERS

PROD
```

The same approach works for 3, 4 and 5-way pairs.

In this case we can figure the problem (PROD) and determine where the problem is. This isn't hard to do without a matrix, but it may be for volumes because there may be hundreds or thousands and comparing them the traditional way would be slow and maybe need a lot of RAM.  

For volumes, it's going to be same approach, but I'm still thinking if I should try a multi-dimensional matrix with each item being a collection of more properties (number of cluster pairing relationships, number of paired volumes, number of all volumes). That seems more useful, but also more difficult to deal with.

These simple 2D matrices are easy to work with, and easy export to CSV or visualize. Example for the bad case (PROD is paired with UNCONFIGURED):

![](/assets/images/cluster_pairing_relationships_cluster_pair.png)

Similar can be done for volumes, but I may need to do that in another matrix because that seems easier. 

Because there may be hundreds of paired (and dozens of unilaterally paired) volumes, it seems HTML volume ID pairs linked to volume details in SolidFire management UI would be a nice way to show that, but also require more work. 

For up to 10-20 unilaterally paired volumes it'd be nice to be able to see names and maybe even accounts, so it appears "what's better" is relative and needs experimentation.

If HTML is used, then plain old tables - especially if they can be filtered and sorted by column - may be valuable, too.

## Tables

As I progressed with volumes, it quickly became clear this is harder than clusters. And also, that hacking without a plan isn't the best approach when you're working on something not very simple.

Volume pairings can be screwed up in many ways, which makes it more complex than clusters.

Because I don't want to spend a week on this, I abandoned the goal of adding cluster dimensions beyond 1-to-1 (two clusters). That would have to be another "level" of recursion, so nothing challenging, just more complicated and would need 3 or more clusters for testing, which I can't run due to limited RAM in my lab.

So, with two mutually paired clusters, it is important to scan paired volumes twice and in both directions. That may seem strange at first, but unlike two clusters which are either paired or not paired, a volume pair can be paired and not paired at the same time (depending on the direction), and on top of that if a pair isn't symmetrically paired one of the volumes may not even exist (which is important to know because re-pairing them in isn't possible and corrective actions are different in different cases).

To put this in a matrix seems rather complicated (at least to me), so I'll try using tables here.

I'm sure there is some "famous algorithm" out there that solves this and everyone but me knows about it, but we also need to check volume properties, so...

I produce a report (Appendix A) on a cluster pair with messed up not just relationships, but also volumes (see Appendix A).

## `isPaired` in SolidFire ListVolumes parameters

Here's how that works:

```python
>>> params = {'isPaired': True}
>>> len(sfe_a.invoke_sfapi(method='ListVolumes',parameters=params)['volumes'])
5
>>> params = {'isPaired': False}
>>> len(sfe_a.invoke_sfapi(method='ListVolumes',parameters=params)['volumes'])
35
```

> is_paired (bool) – Returns volumes that are paired or not paired. Possible values are: true: Returns all paired volumes. false: Returns all volumes that are not paired. ([source](https://solidfire-sdk-python.readthedocs.io/en/latest/solidfire.html#solidfire.models.ListVolumesRequest))

In order to get *all* volumes, we simply use `None`, right? Right?

Wrong. But I spent 1 day troubleshooting my own code because I didn't notice (the default value is not documented, as per above) that the trouble was in the SolidFire API responses.

```python
>>> params = {'isPaired': None}
>>> len(sfe_a.invoke_sfapi(method='ListVolumes',parameters=params)['volumes'])
35
>>> len(sfe_a.invoke_sfapi(method='ListVolumes')['volumes'])
40
```

The documentation doesn't say `False` is the default and anything but `True` is also `False`. In order to get *all* the volumes, one must use `isPaired` in parameters at all. That is ridiculous!

## Conclusion

I don't know how many people have 2 clusters, let alone 3 or 4, but it's an interesting problem in any case.

Unlike with one-to-many and any-to-any relationships that may be present on networks, these relationships seem easier to understand with matrices and especially so in 2-cluster situations.

The problem of "optimal" visualization requires some experimentation as I usually don't deal with problems of this nature. For example, the image in this post would ideally use specific colors for anything that's >2 and for any non-0 value in UNCONFIGURED, but the software I used can't do that.

Approximately half the time I spent unnecessarily "debugging" my own code, whereas I was unknowingly not getting the right responses from the API due to that isPaired thing above. And because of that the script is now an incredible mess and requires a complete rework. If I find the energy to deal with that stuff again, I may add it to Longhorny. I thought to do a bit more, but I've had enough of dealing with this stuff!

## Appendix A - tabular report

Pairings on this cluster are truly messed up - different directions, sizes, accounts, missing one-side relationships, missing volumes...

Longhorny has a simple `--list` action for paired relationships only. For this same cluster pair with the same pairing issues, it returns this:

```sh
MISMATCHED PAIRED VOLUMES ONLY:

[{'DR': {'volumeID': 397,
         'volumePairUUID': 'd0970043-322d-442c-bbaa-7f87a79b82db',
         'mismatchSite': 'PROD',
         'remoteVolumeID': 158}},
 {'PROD': {'volumeID': 169,
           'volumePairUUID': '2484f857-9f7b-4d43-af86-8663774072a4',
           'remoteSite': 'DR',
           'remoteVolumeID': 410}},
 {'PROD': {'volumeID': 170,
           'volumePairUUID': '602c3630-ad30-4b2a-b03c-e9165f45d574',
           'remoteSite': 'DR',
           'remoteVolumeID': 411}}]
```

The new `--report` action could provide information more detailed than just pairing-related information. Here's what I get my my garbage code now.

```python
{'PROD': [{'localVolumeID': 135,
           'remoteVolumeId': 395,
           'localAccessMode': 'readWrite',
           'remoteAccessMode': 'replicationTarget',
           'localAccountID': 13,
           'remoteAccountID': 3,
           'localSize': 20000538624,
           'remoteSize': 20000538624,
           'volumeSizeDiff': 0,
           'localReplicationMode': 'SnapshotsOnly',
           'remoteReplicationMode': 'Async',
           'direction': 'Local -> Remote'},
          {'localVolumeID': 164,
           'remoteVolumeId': 400,
           'localAccessMode': 'readWrite',
           'remoteAccessMode': 'readWrite',
           'localAccountID': 13,
           'remoteAccountID': 14,
           'localSize': 3001024512,
           'remoteSize': 3001024512,
           'volumeSizeDiff': 0,
           'localReplicationMode': 'Async',
           'remoteReplicationMode': 'Async',
           'direction': 'Local <-!!!-> Remote'},
          {'localVolumeID': 167,
           'remoteVolumeId': 401,
           'localAccessMode': 'readWrite',
           'remoteAccessMode': 'readWrite',
           'localAccountID': 13,
           'remoteAccountID': 3,
           'localSize': 10000269312,
           'remoteSize': 10000269312,
           'volumeSizeDiff': 0,
           'localReplicationMode': 'Async',
           'remoteReplicationMode': 'Async',
           'direction': 'Local <-!!!-> Remote'},
          {'localVolumeID': 169,
           'localAccessMode': 'readWrite',
           'localAccountID': 13,
           'localSize': 4000317440,
           'localReplicationMode': 'SnapshotsOnly'},
          {'localVolumeID': 170,
           'localAccessMode': 'readWrite',
           'localAccountID': 17,
           'localSize': 2000683008,
           'localReplicationMode': 'Async'},
          {'localVolumeID': 171,
           'remoteVolumeId': 412,
           'localAccessMode': 'readWrite',
           'remoteAccessMode': 'readWrite',
           'localAccountID': 13,
           'remoteAccountID': 7,
           'localSize': 2147483648,
           'remoteSize': 1073741824,
           'volumeSizeDiff': 1073741824,
           'localReplicationMode': 'SnapshotsOnly',
           'remoteReplicationMode': 'Async',
           'direction': 'Local <-!!!-> Remote'},
          {'localVolumeID': 158,
           'localAccessMode': 'replicationTarget',
           'localAccountID': 13,
           'localSize': 2000683008}]}
```

I'd also output that in tables for folks who want to view that output and not paste it into some program.

In this case the first table created at the "source" site shows the same thing as that long output above. View from local "SRC":

```sh
+---------------+----------------+-------------------+-------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
| localVolumeID | remoteVolumeId |  localAccessMode  | remoteAccessMode  | localAccountID | remoteAccountID |  localSize  | remoteSize  | volumeSizeDiff | localReplicationMode | remoteReplicationMode |      direction       |
+---------------+----------------+-------------------+-------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
|      135      |      395       |     readWrite     | replicationTarget |       13       |        3        | 20000538624 | 20000538624 |       0        |    SnapshotsOnly     |         Async         |   Local -> Remote    |
|      164      |      400       |     readWrite     |     readWrite     |       13       |       14        | 3001024512  | 3001024512  |       0        |        Async         |         Async         | Local <-!!!-> Remote |
|      167      |      401       |     readWrite     |     readWrite     |       13       |        3        | 10000269312 | 10000269312 |       0        |        Async         |         Async         | Local <-!!!-> Remote |
|      169      |                |     readWrite     |                   |       13       |                 | 4000317440  |             |                |    SnapshotsOnly     |                       |                      |
|      170      |                |     readWrite     |                   |       17       |                 | 2000683008  |             |                |        Async         |                       |                      |
|      171      |      412       |     readWrite     |     readWrite     |       13       |        7        | 2147483648  | 1073741824  |   1073741824   |    SnapshotsOnly     |         Async         | Local <-!!!-> Remote |
|      158      |                | replicationTarget |                   |       13       |                 | 2000683008  |             |                |                      |                       |                      |
+---------------+----------------+-------------------+-------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
```

But, since some local volumes may be missing, we also need to look and report from remote cluster (DST). Of course, we could have "`-`" (empty) in localVolumeID value at the source when a volume from a relationship at the remote site does not exist but that seems un-actionable, when stuff is simply missing and all local values are "`-`".

That should also serve as a reminder that nothing can replace log retention. [SFC](https://github.com/scaleoutsean/sfc) doesn't do it (yet), but [if you forward SolidFire API events to Elasticsearch](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html#get-events-and-faults-completely-from-api-logs) then should be able to see what that "`-`" used to be up to the moment it disappeared and who removed it.

In terms of Longhorny CLI I think it's better to have two views which can be done by simply swapping `--src` and `--dst`. View of the same pairing relationships from the remote site ("DST"):

```sh
+---------------+----------------+-------------------+------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
| localVolumeID | remoteVolumeId |  localAccessMode  | remoteAccessMode | localAccountID | remoteAccountID |  localSize  | remoteSize  | volumeSizeDiff | localReplicationMode | remoteReplicationMode |      direction       |
+---------------+----------------+-------------------+------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
|      395      |      135       | replicationTarget |    readWrite     |       3        |       13        | 20000538624 | 20000538624 |       0        |        Async         |     SnapshotsOnly     |   Remote -> Local    |
|      397      |                |     readWrite     |                  |       3        |                 | 2000683008  |             |                |        Async         |                       |                      |
|      400      |      164       |     readWrite     |    readWrite     |       14       |       13        | 3001024512  | 3001024512  |       0        |        Async         |         Async         | Local <-!!!-> Remote |
|      401      |      167       |     readWrite     |    readWrite     |       3        |       13        | 10000269312 | 10000269312 |       0        |        Async         |         Async         | Local <-!!!-> Remote |
|      412      |      171       |     readWrite     |    readWrite     |       7        |       13        | 1073741824  | 2147483648  |  -1073741824   |        Async         |     SnapshotsOnly     | Local <-!!!-> Remote |
|      411      |                |     readWrite     |                  |       7        |                 | 2000683008  |             |                |                      |                       |                      |
+---------------+----------------+-------------------+------------------+----------------+-----------------+-------------+-------------+----------------+----------------------+-----------------------+----------------------+
```
