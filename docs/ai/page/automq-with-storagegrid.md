# Containerized AutoMQ with NetApp StorageGRID

## What's AutoMQ

It's a Kafka clone and one of its "diskless" variants at that.

It's not entirely diskless, of course. Like most "diskless" *data* services it needs a small disk for log and cache. The rest is in S3 buckets.

## How does it work with StorageGRID

It needs two buckets, with StorageGRID potentially stretched across sites (if you need cross-site availability similar to Amazon's AZs).

First, RTFM [here](https://docs.automq.com/automq/getting-started/deploy-multi-nodes-test-cluster-on-docker).

Second, setup two buckets with required ACLs. If you look at the Docker demo, you'll see it uses rug-pull S3 (MinIO). Remove that junk from the Compose file, and also remove `mc` service, too (you don't need it). I used HTTP with StorageGRID as well, since Compose uses MinIO the same way, which helped me avoid TLS issues.

Third, create two buckets on StorageGRID and - if you want to do it fast - use the same approach the Compose uses for MinIO S3 - create two buckets open to public. Do that in each Bucket's `Bucket access` tab (`Bucket policy`). I added `Condition` and with it limited access to my Docker host's `SourceIP`, just for practice. Normally you'd want proper permissions/ACLs, which may require some trial and error.

AutoMQ buckets:

- `automq-data`
- `automq-ops`

![AutoMQ buckets](/assets/images/storagegrid-with-automq-00-buckets.png)

Since MinIO URL was `http://minio:9000`, I replaced all instances of that with `http://192.168.1.211:10080` (my StorageGRID S3 API) and `us-east-1` and `pathStyle` remained unchanged as I had them the same way. Example:

```sh
--override s3.wal.path='0@s3://automq-data?region=us-east-1&endpoint=http://192.168.1.211:10080&pathStyle=true'
```

One last thing: the demo Compose isn't well maintained. I wasted time screwing around with an old version (1.5.5 set in Compose) while latest version is 1.7.2. Check what's latest and change to that in Compose before you start.

Start the darn thing.

```sh
$ docker compose up -d
[+] Running 4/4
 ✔ Network automq_net                 0.1s 
 ✔ Container automq-server3 Started   1.8s 
 ✔ Container automq-server2  Started  1.8s 
 ✔ Container automq-server1  Started  1.9s
 ```

Now, what I experienced with my grossly under-resourced StorageGRID 12.1 SDS was one of the AutoMQ nodes would usually drop. I couldn't see anything wrong with that particular node, so I can't tell why it happens, but two other would continue and remain online.

My unconfirmed theory is this may be due to slow response, which causes a node to drop out of cluster.

Service keeps running (as two nodes is a valid quorum) and objects are created in AutoMQ buckets on StorageGRID.

![AutoMQ nodes](/assets/images/storagegrid-with-automq-01-service.png)

## Summary

There are no obvious incompatibility issues, as far as I can tell, but I'd like to do a test with proper StorageGRID hardware.

AutoMQ is a good idea, but the company is focused on providing services in the public cloud (with AWS S3, for example) because that is where "diskless" Kafka currently makes a lot more commercial sense (due to the expensive cross-AZ bandwidth that affects block but not S3). On premises, you mostly want the same bugs (the way Rocky Linux delivers them) and while the simplicity is a big plus, I think most on-premises users appreciate the "standard and consistent" Kafka bugs more than the simplicity of a clone. In the cloud, it's different because of the economics.

If you need Kafka on premises, I'd say just use Kafka. If you need something *like* Kafka on premises, use [NATS](/2026/06/21/nats-server-on-netapp-eseries.html).
