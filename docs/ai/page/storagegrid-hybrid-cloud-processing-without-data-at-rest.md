# StorageGRID S3 in Public Cloud workflows without Data-at-Rest

Processing StorageGRID data in Public Cloud without Data-at-Rest

This week I heard of a StorageGRID customer who had a query about data processing in the cloud. Probably instinctively, their first idea was to copy data to the cloud.

Sometimes that's okay, another time it's unavoidable, etc. But in this case it was completely unnecessary ("Because that's how we've always done it"?).

In order to keep this post more generic, I won't go into the details about the use case or file (object) format. Instead, let us assume the following requirements:

- Data is created or collected on-prem 
- Data needs to be processed in the cloud (insufficient resources on-prem, rush jobs, etc.)
  - File/object sizes aren't huge - let's say 1GB comes in, 1GB goes out (although output is usually, but not always, smaller than the input)
  - Each compute job is self-contained
  - There's no merit or need - technical or business - to storing input data in the Public Cloud 
- Result is copied back to on-premies (< 1GB file/object)

Now, rather than focus on just this scenario, let's generalize and say different requirements would result in different approaches. 

This is a random and incomplete collection of approaches, products and services that are known to work or should work with StorageGRID S3.

<!-- TOC -->

- [Varnish HTTP Cache](#varnish-http-cache)
- [RAM disk](#ram-disk)
- [Alluxio](#alluxio)
- [NetApp FlexCache](#netapp-flexcache)
- [Cloud Sync](#cloud-sync)
- [Related tools and services](#related-tools-and-services)
  - [Spot Ocean for Apache Spark](#spot-ocean-for-apache-spark)
  - [Amazon SNS](#amazon-sns)
  - [NetApp DataOps Toolkit](#netapp-dataops-toolkit)
- [Conclusion](#conclusion)

<!-- /TOC -->

## Varnish HTTP Cache

If you can't or prefer not to have [Data-at-Rest](https://en.wikipedia.org/wiki/Data_at_rest) in the public cloud, you can keep it in memory and never save it in the first place.

[Varnish HTTP Cache](http://varnish-cache.org/) can act as your cloud-based read cache for StorageGRID buckets located on-premises.

In the case described above, we wouldn't need to read an object multiple times, but we can still take advantage of Varnish. Before we kick off our job, we simply read the file first, and seconds or minutes later, kick off our compute job. By then the object should be cached.

Job result can be PUT directly to StorageGRID - there's no need to PUT it through Varnish.

There's a Technical Report on StorageGRID with Varnish on the NetApp Web site - find it with a search engine.

## RAM disk

This is another way to avoid Data-at-Rest in the cloud.

[`tempfs`](https://www.kernel.org/doc/html/latest/filesystems/tmpfs.html) lets you create a RAM based disk. There are similar solutions for Windows.

As our input is around 1GB, all we need to do is create a VM with slightly more RAM, then create a RAM disk and do our processing there. We can write job result to RAM disk and upload in background while the next input file is being downloaded.

This screenshot shows how a data processing job with data in RAM didn't use any disk IO:

![Processing without disk IO with tempfs](/assets/images/storagegrid-hybrid-cloud-tempfs-processing.png)

This approach can be used in combination with Varnish. (Varnish caches data in RAM so we wouldn't configure it to use a RAM disk. Instead, we could have worker VMs or containers copy cached files from Varnish server to their local RAM disk so that the Varnish can expire those objects ASAP - if we need to read them just once there's no need to bloat Varnish cache.)

What if a VM with RAM disk or Varnish crashes? The same thing that you do if a VM *without* RAM disk or Varnish crashes - you rerun the job. The only extra cost is you need to re-download that file (which costs next to nothing, because to cloud-based clients it's just a bit of extra ingress traffic).

Software-wise you don't need anything else but Linux and one of the mainstream S3 clients.

## Alluxio 

This is like Varnish, but much more suitable for Big Data applications. It can work in a scale-out-manner and supports Hadoop, HBase, Presto, Spark.

If your application is one of these (but also other, generic applications), you could use S3A with StorageGRID, but Alluxio is very feature-rich and will likely do a much better job. For example, the scale-out feature means you could process a TB-sized working set in the RAM of four VMs with 256GiB RAM.

If you'd like to find out more, I wrote several posts about [Alluxio](https://scaleoutsean.github.io/2021/11/12/alluxio-storagegrid-s3.html). Find the other two in Archive.

Alluxio has a Community Edition which you can try out for free.

## NetApp FlexCache

I wrote about FlexCache (including what it's good for) in one of the Alluxio posts, so you can find that content there or read the ONTAP docs.

Long story short, it's an excellent NFS and SMB caching feature in ONTAP which all cloud-based ONTAP services support, but StorageGRID S3 isn't a supported back-end (where data is stored) - FlexCache currently supports ONTAP back-ends (NFS, SMB) so it doesn't apply in this situation. 

## Cloud Sync

Cloud Sync is a data replication service by NetApp. I recently [blogged about it](https://scaleoutsean.github.io/2022/01/17/using-netapp-cloudsync-api.html).

Now you may be wondering why I mention Cloud Sync if I don't intend to copy data (i.e. no Data-at-Rest in the cloud). Two reasons:

- you may want to copy it anyway
- if you realize you don't need to copy it, you still can use Cloud Sync - just copy data to a `tempfs` disk exported via generic NFS server which will make data disappear on VM shutdown

Admittedly it'd be a hassle to set a relationship for every job in every VM, but you could have a VM with RAM-based NFS server and keep this VM online at all times. Job runners would mount this share, process the file, PUT data to StorageGRID S3 and delete the input file to release space.

Cloud Sync has a free trial as well (see the blog posts linked above - there are links and info on how to subscribe and unsubscribe).

## Related tools and services

### Spot Ocean for Apache Spark

Spot has a product called [Ocean for Apache Spark](https://spot.io/products/ocean-apache-spark/) (formerly Data Mechanics). You can use Alluxio in Ocean for Apache Spark. 

Spot.io provides a free trial for all of its products.

### Amazon SNS

SNS doesn't process data, but can be used to drive workflows even if you don't use AWS for processing.

If StorageGRID grid administrator enables platform services, SNS Notifications may be used to notify us about changes that happen in the bucket.

If a new file lands into the StorageGRID bucket we use in hybrid cloud workflow, we can use SNS to examine object metadata and kick off our job: if the object meets certain criteria (specific metadata value, size, S3 key, etc.) we can initiate read via Varnish proxy or `wget`it to RAM disk.

### NetApp DataOps Toolkit

There are many popular data workflow tools (JFGI) that could be used, so I'll instead mention a less obvious one: the NetApp DataOps Toolkit which I call DOT (not the official acronym).

> The NetApp DataOps Toolkit is a Python library that makes it simple for developers, data scientists, DevOps engineers, and data engineers to perform various data management tasks, such as near-instantaneously provisioning, cloning, or snapshotting a data volume or JupyterLab workspace. 

As of recently, DOT supports [S3](https://github.com/NetApp/netapp-dataops-toolkit/blob/83c3b00cc406f964212750fef90dae18e0aeb0ee/netapp_dataops_traditional/netapp_dataops/traditional.py#L101), which lets us do this (and more):

```sh
$ netapp_dataops_cli.py pull-from-s3 object \
  --bucket=cloudbatch \
  --key=out/data1.dat \
  --file=/ramdisk/in/data1.dat

Downloading object 'out/data1.dat' from bucket 'cloudbatch' 
and saving as '/ramdisk/in/data1.dat'.
Download complete.
```

DOT pulls s3/cloudbatch/out/data1.dat and saves it to RAM disk (/ramdisk/in/data1.dat).

Then we can run our compute job and use DOT to PUT the result to s3/cloudbatch/in/data1_result.dat.

```sh
$ cd /ramdisk
$ netapp_dataops_cli.py push-to-s3 file \
  -b cloudbatch \
  -f in/data1_result.dat

Uploading file 'in/data1_result.dat' to bucket 'cloudbatch' 
and applying key 'in/data1_result.dat'.
Upload complete.
```

Two noteworthy things:

- pushing /ramdisk/**in/data1_result.dat** from **/ramdisk** directory PUTs it to s3/cloudbatch/**in/data1_result.dat**. That is, S3 KEY consists of relative path-to-file and full file name (including file extension, if any)
- the DOT integrates with ONTAP and can help you take snapshots, make clones, etc. but for S3 pull/push operations it works with common filesystems and on that topic while running DOT configuration wizard I provided made up details for ONTAP and that didn't cause me any troubles when running the above, as I only used DOT's S3-related functions

To some of you two RAM disks mounted at /in and /out or different subdirectory names may be more intuitive - feel free to use whatever works for you (/raw and /results or /job_${id}, perhaps).

In the case you are wondering why use the DOT: there may be situations where input files need to be picked in an interactive, on-demand manner (as Data Scientists might do) so not having to leave one's JupyterLab environment may be helpful.

And we can also use it from the CLI as I did above - without writing our own S3 CLI wrapper. Why would we want to do that? In certain cases - depending on what's going on on-premises - DOT can help you with other routine but time-consuming steps that may need to happen before that S3 object appears and completely eliminate the need to code the rest of the workflow (if you don't have existing workflow that can be expanded).

Let's say your inputs are generated in an on-prem Kubernetes cluster and saved to an ONTAP NFS share in a closed LAN environment. Your workflow might look like this:

- ONTAP NFS RWM PVC to StorageGRID's "cloudbatch" bucket (on LAN)
- SG to Public Cloud (pull from VM/container)
- Public Cloud VM to SG (push from VM/container)
- SG to another ONTAP NFS share for safekeeping (on LAN)

You'd need add just one line (to run your compute job) - everything else would be DOT. Since we already have several steps that involve StorageGRID and ONTAP, it can be easier to use DOT for the S3 push/pull steps than - for an example - write this entire workflow in Ansible.

The [DOT](https://github.com/NetApp/netapp-dataops-toolkit) is free.

## Conclusion

NetApp is the leader in shared storage solutions for the Public Cloud, but that doesn't mean you should save everything to disk. Once you save that file, you may need to audit access to it, back it up, snapshot it, tier its cold blocks to an object store, etc. If there's no advantage to it, don't do it!

There are many ways to avoid Data-at-Rest in the Public Cloud and for suitable use cases there are no trade-offs. 

In fact in many such cases Data-at-Rest avoidance is convenient, performs faster, requires less administration, and has other advantages.
