# Apache Ozone S3 and NetApp E-Series

When to use Apache Ozone with E-Series

I'm supposed to be resting this week and that hasn't been working out... Still, I'll try to keep this one shorter than the previous two posts from this week.

- [WTF is Apache Ozone](#wtf-is-apache-ozone)
- [Why should we use Apache Ozone](#why-should-we-use-apache-ozone)
- [What does an Ozone S3 deployment look like](#what-does-an-ozone-s3-deployment-look-like)
- [S3 gateway](#s3-gateway)
- [Ozone with E-Series](#ozone-with-e-series)
- [To-Do items](#to-do-items)
- [Conclusion](#conclusion)

## WTF is Apache Ozone

Let me get creative and pilfer their [own explanation](https://ozone.apache.org/):

> Apache Ozone is a highly scale-able, distributed storage for Analytics, Big data and Cloud Native applications. Ozone supports S3 compatible object APIs as well as a Hadoop Compatible File System implementation. It is optimized for both efficient object store and file system operations. 

## Why should we use Apache Ozone

Clearly - I mean based on the introduction above - some Hadoop fans love the fact that they can get a modernized HDFS-compatible storage with S3 gateway built right in. Ozone also features an HDFS-compatible OzoneFS and S3A.

If you're one of such folks *and* at the same time realize converged HDFS and compute hasn't worked that well for you, maybe you'd want to both dis-aggregate *and* modernize, which is what you can get from Ozone, but also from E-Series (I wrote about enhancing HDFS-compatible storage with E-Series in [this post](/2022/06/22/e-series-hdfs.html)).

## What does an Ozone S3 deployment look like

Ozone runs on bare metal, VMs or in containers (Docker, K8s, Nomad, etc.). It seems there's a CSI plugin as well.

There are several services involved, but I don't want to rehash the official documentation (look it up if you're interested) so I'll just talk about it from a high-level practical perspective.

First, there's a built-in Web UI which is nice and responsive. I built Ozone from the source and started it with Docker Compose.

![Azure Ozone Web UI](/assets/images/apache-ozone-s3-e-series-01.png)

Once you're in and see that everything's working, you can run some workloads to test it out. There are many different metrics exposed, but they can be scraped from outside of the cluster for centralized monitoring - you are not limited by what you can see in the Web UI (which is 20-30 metrics).

![Azure Ozone metrics dashboard](/assets/images/apache-ozone-s3-e-series-02.png)

RPC metrics are available on its own page, I suppose because that helps you see if you have any network-related issues. I've had no RPC failures, which was expected (given that I ran this cluster in Docker Compose).

![Azure Ozone RPC metrics](/assets/images/apache-ozone-s3-e-series-03.png)

## S3 gateway

Ozone's S3 gateway aims for AWS S3-compatibility. I installed AWS CLI and was able to create a bucket using AWS S3API.

The way S3 on Ozone works is /s3v is the Ozone volume that's available via S3 (if you enable Ozone S3 gateway). If you don't want the Hadoop stuff but just want S3, that would be the only *volume* you'd create, and then buckets within it.

The second noteworthy detail is by default it's HTTP-only. I expected at least a self-signed snake-oil TLS option, but nope... It seems they're still working on it and meanwhile you could add a TLS-terminating reverse proxy in front of Ozone, to get around that.

![Azure Ozone S3 gateway](/assets/images/apache-ozone-s3-e-series-05.png)

## Ozone with E-Series

In that [post](/2022/06/22/e-series-hdfs.html) linked earlier I wrote why I think it makes sense to use Hadoop with external storage - basically the idea is no matter how fancy the software is, it's always easier to manage and maintain storage by using RAID-protected building blocks. The same applies to Ozone so take a look at that link to see what I meant.

Here we see Ozone's data protection schemes: RF1, RF2, RF3, and various EC schemes.

![Azure Ozone settings](/assets/images/apache-ozone-s3-e-series-06.png)

How would we use those with E-Series? Some examples:

| Use case                | Ozone S3 | E-Series      |
|  :---                   |  :---:   |  :---:        |
| Value S3 buckets (bulk)    | RF1      | Wide DDP      |
| Fast S3 Big Data/Analytics | RF2      | RAID6 or DDP  |
| Value S3 Big Data/Analytics| EC       | Wide DDP      |
| HDFS/S3 Big Data/Analytics | any      | RAID6 or DDP  |

Ozone RF1 makes sense only with protected storage, which is how you can get lowest cost with excellent durability due to E-Series's HA architecture and Dynamic Disk Pools (see that Hadoop on E-Series post for more on that) Ozone data is protected from controller failures, dual concurrent disk failures, and even shelf failures (you need to have a handful of shelves) and protection overhead is very low (~10%).

If you need highest performance with Ozone and E-Series, Ozone should use RF2 on top of E-Series volumes protected with RAID6 (better for sequential performance, but higher overhead than DDP) or DDP (better for mixed workloads). As indicated in the post about Hadoop with E-Series, RF3 is unnecessary due to there already being enough redundancy in E-Series, and it doesn't even help with the performance.

If you have enough capacity and performance to require several E-Series arrays, Ozone can use EC to stripe data across multiple E-Series arrays.

Now, what do we need to do to "tune" Ozone for E-Series? Ozone is already tuned for sequential workloads that one would expect to see in Big Data environments, and so is E-Series. You could surely fine-tune both further, but you'd need to know for what workload(s).

Ozone has a ton of settings that can impact performance and can be easily changed.

![Azure Ozone settings](/assets/images/apache-ozone-s3-e-series-04.png)

On E-Series, it's simpler - there's just two-three things to consider - RAID segment size, RAID/DDP configuration, shelf/controller type and connectivity (FC, IB, etc.).

## To-Do items

Some things that I might do with Ozone and E-Series later this year (if I find a reason):

- I haven't investigated how Ozone S3 scales *out* (that is, I haven't checked if localhost:9878 service runs on all nodes, or just one) and whether S3 autoscaling is possible
- I'd like to evaluate HTTPS integration (with NGINX or something like that)
- I'd like to do basic performance testing with Ozone S3 and E-Series to see if Ozone S3 can effectively use storage performance that E-Series can deliver
- Understand how Ozone S3 ACLs compare to AWS S3 ACLs

## Conclusion

There are many ways for S3 SDS to leverage E-Series. Many NetApp customers use StorageGRID because StorageGRID appliances minimize risk, work with a variety of workloads, and are validated for many enterprise applications.

Ozone S3 is a relative newcomer and still very young (current version 1.2.1) and focused on Big Data workloads, so it must be appealing to users with that background. It doesn't provide fancy enterprise features and certifications, it requires more effort to plan, implement and maintain, but it should be very effective in use cases similar to those I outlined above. I wouldn't use it for many small objects, or from S3 clients that make use of many S3 API features. 

It seems some ISVs (at least Cloudera, maybe there are others) provide paid support for Ozone, so E-Series users looking for supported Ozone S3 could get support for Ozone from their Big Data or Kubernetes stack provider, and deploy it with E-Series by simply presenting E-Series volumes (or host-path (static) volumes in the case of Kubernetes) to their Ozone servers/VMs/containers.
