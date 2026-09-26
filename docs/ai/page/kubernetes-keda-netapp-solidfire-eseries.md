# Kubernetes KEDA with NetApp SolidFire and E-Series

Notes on autoscaling Kubernetes workloads backed by E-Series or SolidFire using KEDA

- [Introduction](#introduction)
- [KEDA concepts and components](#keda-concepts-and-components)
- [Scalers](#scalers)
- [KEDA and persistent storage](#keda-and-persistent-storage)
  - [SolidFire](#solidfire)
  - [E-Series](#e-series)
- [Storage-related events](#storage-related-events)
  - [Storage logs](#storage-logs)
- [Conclusion](#conclusion)

## Introduction

WTF is KEDA? From [their site](https://keda.sh):

> KEDA is a Kubernetes-based Event Driven Autoscaler. With KEDA, you can drive the scaling of any container in Kubernetes based on the number of events needing to be processed.

The key word here is "event-driven". 

> KEDA works alongside standard Kubernetes components like the Horizontal Pod Autoscaler and can extend functionality without overwriting or duplication. With KEDA you can explicitly map the apps you want to use event-driven scale, with other apps continuing to function.

This post won't deep dive into KEDA - at least not in its first version - since I haven't gotten any questions about it yet.

But I'll explore some angles related to two NetApp storage arrays, E-Series and SolidFire (NetApp HCI uses SolidFire, too).

The idea is to share some ideas about linking KEDA with these arrays, so that readers can see if there's anything of interest that could help them in their environment.

I haven't *actually* tried KEDA, which is another reason why I won't (can't, really) deep-dive into it.

## KEDA concepts and components

Once deployed KEDA has 3 components and can make use of "scalers":

- Agent — KEDA activates and deactivates Kubernetes Deployments to scale to and from zero on no events (keda-operator)
- Metrics — KEDA acts as a Kubernetes metrics server that exposes rich event data like queue length or stream lag to the Horizontal Pod Autoscaler to drive scale out (keda-operator-metrics-apiserver container)
- Admission Webhooks - API that automatically validates resource changes 
- Scalers - these are KEDA "plugins" that two two things: (a) detect if a deployment should be (de)activated and (b) feed custom metrics for a specific event source

## Scalers

For v2.13 you can find a list of available scalers [here](https://keda.sh/docs/2.13/scalers/).

I won't "recommend" any particular scaler because that always "depends", but I'll highlight two examples of scalers that are *not* application-specific. 

That is to say, you insert a value (0 or 1) by yourself, and based on that "event" or metric, KEDA does its thing. That way we can use these scalers for storage-related stuff, among other things.

The first one is InfluxDB from that same page. The query triggers (or not) KEDA to do stuff if the result is over those threshold values.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: influxdb-scaledobject
  namespace: my-project
spec:
  scaleTargetRef:
    name: nginx-worker
  triggers:
    - type: influxdb
      metadata:
        serverURL: http://influxdb:8086
        organizationNameFromEnv: INFLUXDB_ORG_NAME
        thresholdValue: '4'
        activationThresholdValue: '6'
        query: |
          from(bucket: "bucket-of-interest")
          |> range(start: -12h)
          |> filter(fn: (r) => r._measurement == "stat")          
        authTokenFromEnv: INFLUXDB_AUTH_TOKEN
```

My fork of E-Series Performance Analyzer (EPA) stores data in InfluxDB v1, and the above is for v2, so I'd have to modify "insert" queries to send to InfluxDB v2, and then compose a query based on my requirements.

I've also created a script for SolidFire (I've been slowly updating HCI Collector to change it to work with InfluxDB) and here's an example of SolidFire volume efficiency metrics stored in InfluxDB v1. 

```sql
> SELECT * FROM volume_efficiency;
name: volume_efficiency
time                 account_id cluster_name cluster_uid id  volume_efficiency
----                 ---------- ------------ ----------- --  -----------------
2023-12-19T13:16:22Z 1          PROD         wcwb        1   1
2023-12-19T13:16:22Z 1          PROD         wcwb        2   1
2023-12-19T13:16:22Z 10         PROD         wcwb        108 1
2023-12-19T13:16:22Z 6          PROD         wcwb        36  1.46
```

For a specific volume we'd need to know which volume to query, so the query would have to use the right VolumeID such as `WHERE id='36'` and it would take some additional effort to figure that out. 

We could create the PVC first and use a sidecar that queries Kubernetes to find the PVC and PV name and then SolidFire to find the volume ID. Or, if the application never scaled to less than 1, we could create the first PVC and use the fixed Volume ID by observing PV's ID on SolidFire. 

The second example is Elasticsearch scaler, which also lets you scale applications based on Elasticsearch query results.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: elasticsearch-scaledobject
spec:
  scaleTargetRef:
    name: "deployment-name"
  triggers:
    - type: elasticsearch
      metadata:
        addresses: "http://localhost:9200"
        username: "elastic"
        index: "my-index"
        searchTemplateName: "my-search-template"
        valueLocation: "hits.total.value"
        targetValue: "10"
        parameters: "dummy_value:1"
      authenticationRef:
        name: keda-trigger-auth-elasticsearch-secret
```

This [post](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html) explains how to get SolidFire metrics and/or logs into Elasticsearch.

So we already have all we need to gather storage metrics we need and configure KEDA to use them.

## KEDA and persistent storage

KEDA's connection to storage seems almost irrelevant because it's "indirect" in the sense that if the storage is slow, the application will be slow, too. 

Because of that, one may think that it's simpler and "better" to watch service or application latency (for example), and ignore storage: as application scales out, storage performance increases as well. 

As an [example](https://keda.sh/docs/2.13/scalers/cpu/#example), here's a no-brainer approach for CPU based auto-scaling when CPU utilization hits 70%.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: cpu-scaledobject
  namespace: default
spec:
  scaleTargetRef:
    name: database-deployment
  triggers:
  - type: cpu
    metricType: Utilization # Allowed types are 'Utilization' or 'AverageValue'
    metadata:
      value: "70"
      containerName: "mongodb"
```

Now we just sit and watch. Right? Well, *probably* not. Why?

- Remember the key word from the beginning (event-driven)?
- The other obvious property is auto-scaling, which sometimes may be the best way to auto-scale, but it's not always the best answer 

A no-brainer approach may yield a no-brainer result.

This isn't to say if you completely ignore the storage, KEDA may or may not work well.

In most cases you can ignore storage, watch the application or compute resources and you'll be fine, but in other cases not ignoring storage features may make KEDA work even better, or more efficiently.

Let's consider potential opportunities for storage that I got by RTFM and which I may explored in a future post or future versions of this post if I make updates.

Each of these arrays is quite different:

- SolidFire has storage QoS and works NetApp Trident (CSI driver)
- E-Series does not have storage QoS and works with several non-HA drivers

### SolidFire

As a quick reminder, NetApp Astra Trident CSI can create storage classes which specify the minimum, maximum and burst IOPS (and consequently MB/s) for SolidFire volumes.

SolidFire-aware scaling may be interesting when our custom approach outperforms more generic metrics (Web server's latency or NoSQL cluster's CPU utilization).

When would that be and how can SolidFire-influence scalers help?

**Storage performance**: if your application is IO-intensive, and especially if you constrain it with a narrowly-defined QoS specification, it may be better for KEDA to be driven by storage than application events because it's more likely that the application may be hitting Maximum QoS limit on a sustained basis.

This can happen in the situation where the storage is generally low on unused IOPS, so the admin tries to use a low Minimum IO limit, and a low Maximum IO limit. KEDA can rely on one of SolidFire performance metrics (such as volume *performance* utilization, queue depth, etc) to allow you to use a low-performance storage class but at the same time avoid situations where you have to "re-type" volumes because you misjudged application requirements.

**Storage capacity**: SolidFire thin-provisions by default (and there's no way to thick-provision), but some users like to right-size volumes. 

When you right-size, it can also be dangerous if storage utilization becomes unexpectedly higher. Trident lets you resize volumes, but it can't shrink them.

Sometimes it's better to resize, other times it's better to over-provision, but there are also times and situations where people like to right-size and KEDA could read disk fullness off SolidFire and scale out accordingly. This is not always the best (because full volumes can continue getting even fuller), but it may be best in certain situations.

**Storage efficiency**: sometimes you may have large volumes which you may not want to recklessly scale-out because you could run out of space, but this depends on data - if data is highly efficient (volume storage efficiency factor > 6), we could let the application scale out more. This indicator could also be used as one of components in an aggregate metric. (See that earlier InfluxDB query with SolidFire volume efficiency.)

**Aggregate metric**: SolidFire caps iSCSI clients' IO queue at 32 per connection; while this is normally enough for most small and medium applications, it may be insufficient for larger databases and such.

One common "workaround" is to create multiple iSCSI connections from the initiator, but if your application can scale out (e.g. MongoDB, NGINX...) you may prefer to watch for both fullness and queue depth and if both are critical, scale-out. 

Normally auto-scaling MongoDB should decrease disk fullness due to data rebalancing, but it may not always work the way you want (see [1]). In the case of NGINX, auto-scaling won't decrease content size of NGINX sites, but it may slow down the rate of increase in PVC fullness because the same logs would be spread across more volumes (if you log to disk).

[1] "If the disk fills too quickly, Atlas might not be able to expand the cluster's storage space in time, even if Auto-Expand Storage is enabled." (Source: [MongoDB](https://www.mongodb.com/docs/atlas/reference/alert-resolutions/disk-space-used/#common-triggers))

SolidFire metrics can be easily obtained (one [example](/2021/03/08/hcicollector-v0.7.html)) and inserted into one of KEDA scalers for querying. See my Github [repo Awesome SolidFire](https://github.com/scaleoutsean/awesome-solidfire/) for more on monitoring and metrics options for SolidFire, or search this blog.

### E-Series

E-Series works with BeeGFS CSI (in a BeeGFS cluster file system environment only) and single-host CSI drivers about which I blogged [here](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html): DirectPV, TopoLVM, etc.

You can check the archive or use search to find more about BeeGFS CSI. BeeGFS is a scale-out filesystem that can span across multiple arrays; even a single (sufficiently large) file can be chunked across multiple LUNs and arrays. 

So if you got that kind of an environment, it's easy to scale it out on compute side while "ignoring" storage (as far as KEDA is concerned). 

Here I'll focus on the single-host CSI approach because that that's the more challenging and less popular situation which is insufficiently appreciated. 

As I mentioned in that related post, single-host CSI drivers can work with E-Series LUNs (physical volumes) that are protected or **un**protected (JBOD-style). 

Some people think nobody needs JBOD-style PVs, but I disagree.

You get decent performance, no overhead and if your application scales out *and* replicates data, there's no reason to not consider non-RAID-ed disks for some PVCs, and RAID-protected (1/10, 5, 6) LUNs for other.

For example, you may run Elasticsearch with DirectPV on XFS-formatted JBOD disks using Elasticsearch to make three copies (2-replica)  and at the same time have a big RAID 6 with 5 volumes used by MinIO (EC:1) for tiering to S3 in the same array.

All right, where does KEDA come in? My initial thoughts:

**Disk fullness**: even if the performance is fine, if disk is over 70% full, we may want to scale out and provision additional volumes for the application. This can probably be done by the application, but it may be harder.

**Performance**: we could use KEDA's InfluxDB scaler which lets us specify a query that triggers scaling events; [EPA](https://github.com/scaleoutsean/eseries-perf-analyzer) can collect these metrics for you, or you can gather them yourself: maybe it's total array IOPS, maybe controller CPU utilization, maybe something else. 

If your workload bottleneck is disk performance, this could work better than application metrics.

**Aggregate storage metric**: use weighted value comprised of several metrics to trigger (or not) scaling up/down. 

Combine latency and queue depth, for example, and if their sum goes over or under a certain limit, trigger up- or down-scaling. Or combine capacity, performance and application metrics into one value. This may result in a better decision than just a single value.

## Storage-related events

This applies to both SolidFire and E-Series: we may want to scale-out your horizontally scalable application as long as it can perform faster, with the objective to minimize run time (time to result). This can be risky (scaling out as much as you can) but sometimes that's the first priority. 

On SolidFire you could calculate "Minimum IOPS allocated", and as long as that value is below the total of the cluster, you could scale out: after all, it doesn't cost you anything. 

Let's say your cluster guarantees 200,000 IOPS and there's just one important workload (CI/CD build farm, for example). We could sum up all volumes' Minimum IO value (MIN_IO_TOTAL) and if MIN_IO_TOTAL > (200,000 x 80%), signal 0 (don't scale out), or else 1 (auto scale-out).

On E-Series we could look at the controllers' CPU utilization. If < 80%, auto-scale out, if > 80%, do nothing (in which case we'd drop to `minReplicaCount`, perhaps). 

Another possibility is to look at storage throughput, especially with E-Series which often has just one-two applications per array. If the array performs faster than a single server then we can benefit from scaling that workload out, but also to 0 when there's nothing to do so that other application(s) can consume storage performance.

We could even use storage indicators on filesystem level: determine how much data there is, and based on that configure KEDA's auto-scaling before you run a parallel batch job, for example. For this we may need BeeGFS (and BeeGFS CSI), but if data is replicated to multiple volumes even single-host filesystem could benefit from this approach.

### Storage logs

I have this as a separate category of storage-related events because of two reasons:

- Storage array logs are usually gathered differently (for example, by forwarding them to a syslog server and pre-processing before it can be used)
- It's not just numbers that can be massaged to produce desired outcomes, but text (error messages) and event IDs, that we'd have to use

So this is more challenging, but can let us create unique events. 

For example, we could auto-scale application down to minimum if a volume group is rebuilding, if one E-Series controller is down, or if SolidFire node count is below certain limit (i.e. a storage node went down).

I wouldn't go too crazy on this approach as it can create unpredictable consequences, but advanced users may find it useful. 

If your application will time-out or jobs fail, it may be better to automatically reduce the number of jobs than fail due to I/O timeouts, or cause timeouts on a whole bunch of more important applications using the same array.

## Conclusion

Based on what I've seen in the documentation I came up with some scenarios that seem feasible.

Kubernetes is complicated enough so I wouldn't encourage you to unnecessarily complicate your environment and introduce unpredictability to storage and/or application behavior, but I believe that KEDA can sometimes take advantage of disk array characteristics. 

Again, I haven't actually tried any of these scenarios, but maybe I will. I would also encourage you to come up with your own scenarios and evaluate them on your own.
