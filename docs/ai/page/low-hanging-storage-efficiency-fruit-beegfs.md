# Low-hanging BeeGFS efficiency fruit

Identifying low-hanging fruit in BeeGFS storage efficiency

Following my previous post on TensorStore with BeeGFS I thought I should revisit another item from my lengthy to-do list: filesystem compression.

## E-Series and storage efficiency

Even many NetApp customers aren't familiar with E-Series so I'll just say this quickly:

- E-Series aims to have a lean data path and deliver ease of use, performance, reliability
- Hence, no compression or deduplication

This works great in many use cases. Let's see:

- Data that was compressed on creation (say, video recordings uploaded by artists)
- Data that is compressed by application or host connecting to E-Series (say, Kafka or Elasticsearch)
- Data is compressed by host filesystem (say, btrfs)

The first two cases don't matter here (data doesn't need to be additionally compressed) and BeeGFS doesn't do compression on its own, but an old trick related to the third bullet is we can create and mount single-host filesystems on top of BeeGFS and mount the btrfs images as loop devices. 

## Compressed loopback volumes

Create two files, vo1 and vol2, on BeeGFS. Format them with a Linux filesystem of your choosing.

I picked btrfs. I mounted vol1 as compressed (zstd, level 2), while vol2 was not.

```sh
$ ll /mnt/beegfs/btrfs
total 907581
drwxrwxr-x  2 sean sean         2 Sep 23 16:12 ./
drwxrwxrwx 18 sean sean           18 Sep 23 17:00 ../
-rw-rw-r--  1 sean sean 524288000 Sep 23 16:11 vol1.img
-rw-rw-r--  1 sean sean 524288000 Sep 23 16:31 vol2.img
```

Then I created the same files that I generated in the TensorStore post - basically compressible content - on each btrfs file(system) mounted as loop device.

This didn't work too well - loopback slowed down performance  even in the scenario with compression disabled. How about the savings?

```sh
$ sudo compsize vol1 vol2
Processed 5602 files, 3770 regular extents (5000 refs), 602 inline.
Type       Perc     Disk Usage   Uncompressed Referenced  
TOTAL       71%       26M          37M          44M       
none       100%       15M          15M          22M       
zstd        51%       11M          22M          22M       

$ du -sh vol1
23M   vol1

$ du -sh vol2
23M   vol2
```

Compression did provide 50% savings on the compressed volume (vol1), so if we can save a lot of capacity by compressing and don't need it to be fast, this may be useful.

In summary, with this approach we lose multi-client access (as btrfs should be concurrently mounted on only one BeeGFS client) and the overhead of writing many small files to a loopback filesystem seems more significant than writing them directly to BeeGFS. 

Additionally, the "over-provisioning" of btrfs images results in wasted space on BeeGFS, so even though internally data may be compressed, externally (on BeeGFS) the image file occupies whatever size was used to create it. At the same time, the constant right-sizing would be very cumbersome.

A better way for BeeGFS to use btrfs would be to allow btrfs-formatted devices to be used for the underlying Data disks. That would let us create compressed pools (in BeeGFS filesystems where Data resides on both XFS and btrfs), but BeeGFS would have to be patched to allow the use of btrfs for Data volumes.

## S3 compression with MinIO

I wrote about MinIO on BeeGFS before. At the time I didn't have time or reason to try the new compression feature.

Deploy MinIO and enable compression. It's based on file extensions (and the common ones are already pre-defined for you) but TensorStore files have random numeric extensions like .5831 so that was out of question (which is interesting in itself). 

I haven't tried to find out if MinIO "probes" objects with unregistered extensions to check if they're compressible - I simply uploaded some other junk I had at hand, about 60 MB of it.

![Bucket with compressible objects](/assets/images/beegfs-compression-loopback-s3-01.png)

On BeeGFS, the bucket directory:

![Filesystem data was compressed and 70% smaller](/assets/images/beegfs-compression-loopback-s3-02.png)

70% saving is in line with expectations and what one would expect from such data (and by the way, MinIO currently uses a modified Snappy algorithm - check their documentation to find out more).

Because buckets data is compressed by MinIO, one must access it over the S3 API and not from the filesystem because they'd see something like this:

```sh
$ head compressed/sgac.json 
�S2sTwO�e�Xϻ��@�{"Timestamp": "2020-10-30T07:48:57.285547", "RSLT&
VRGN<AVER": 10, "ATIM 604044137	7�YP6 L116692895320033498}
...
```

We see that MinIO compression removes the main advantage of BeeGFS with MinIO - unified access to S3/BeeGFS data.

We should therefore consider if it is necessary to run MinIO on BeeGFS at all.  E-Series users could run MinIO off regular E-Series volumes (ext4, XFS). MinIO itself could run on a BeeGFS client which could serve as a "data mover" node. This sounds fine as well, although HA failover becomes harder (if it's not addressed by VM failover using hypervisor HA features, for example) and results in two separate storage namespaces to manage.

In summary, MinIO S3 compression is good, although it doesn't seem effective at all for my initial use case (TensorStore). But such situations are rare and it should work well for most other use cases where objects have predictable extensions - either running on BeeGFS or a dedicated XFS/ext4 volume(s).

## Conclusion

The loop device idea kind of failed (although it nominally works with TensorStore zarr content), but MinIO S3 with compression is viable - it's convenient, fast and doesn't interfere with data sharing (when data sharing with other users is necessary).

As I wrote in [this post on MinIO on BeeGFS](/2022/08/09/nomad-beegfs-minio-s3.html) it's not convenient to access data by unnecessarily going through an S3 API endpoint when we can already see data on BeeGFS client, but when data is compressed by the application (MinIO) there's no other way.

And as I said in that post, individual users (such as researchers) could run a personal instance of MinIO (say, in shell, Docker or [Apptainer](/2022/08/30/apptainer-beegfs-software-bom-sbom.html#build-data-app-container-and-check-its-inventory) and access it over local network interface) which is less inconvenient than mounting a filesystem image, and doesn't require special privileges.
