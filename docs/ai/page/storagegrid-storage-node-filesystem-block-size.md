# Filesystem block size used by NetApp StorageGRID

Should we care about filesystem block size on NetApp StorageGRID

So, what filesystem block size does StorageGRID 11.8 use?

It's yet another of those questions you can answer by yourself.

Login to a storage node. List filesystems.

```sh
admin@DC1-S1:~ $ df
Filesystem     1K-blocks     Used Available Use% Mounted on
overlay         20464208 11002652   8396700  57% /
tmpfs              65536        8     65528   1% /dev
shm                65536        0     65536   0% /dev/shm
/dev/sda1       20464208 11002652   8396700  57% /config
tmpfs             524288      544    523744   1% /tmp
tmpfs            4068212        0   4068212   0% /proc/acpi
tmpfs            4068212        0   4068212   0% /sys/firmware
tmpfs             813644       40    813604   1% /run
tmpfs               5120        0      5120   0% /run/lock
/dev/sdb       104805380  1032544 103772836   1% /var/local
/dev/sdc       209612800  1504516 208108284   1% /var/local/rangedb/0
/dev/sdd       209612800  1499104 208113696   1% /var/local/rangedb/1
/dev/sde       209612800  1499096 208113704   1% /var/local/rangedb/2
tmpfs              65536        0     65536   0% /var/local/nginx/spool
```

Check one or two for `bsize`.

```sh
admin@DC1-S1:~ $ sudo xfs_info /var/local/rangedb/0

meta-data=/dev/sdc               isize=512    agcount=4, agsize=13107200 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=1        finobt=1, sparse=1, rmapbt=0
         =                       reflink=1    bigtime=0
data     =                       bsize=4096   blocks=52428800, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0, ftype=1
log      =internal log           bsize=4096   blocks=25600, version=2
         =                       sectsz=512   sunit=0 blks, lazy-count=1
realtime =none                   extsz=4096   blocks=0, rtextents=0

admin@DC1-S1:~ $ sudo xfs_info /var/local/rangedb/1

meta-data=/dev/sdd               isize=512    agcount=4, agsize=13107200 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=1        finobt=1, sparse=1, rmapbt=0
         =                       reflink=1    bigtime=0
data     =                       bsize=4096   blocks=52428800, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0, ftype=1
log      =internal log           bsize=4096   blocks=25600, version=2
         =                       sectsz=512   sunit=0 blks, lazy-count=1
realtime =none                   extsz=4096   blocks=0, rtextents=0
```

The answer is obviously not documented because it's not particularly relevant and StorageGRID may change it as required.

Also, the slowness with small objects does not come from filesystem block size, so the question is likely wrong on the most fundamental level.

A more pertinent question is does it even matter?

StorageGRID by default saves two copies of every object (default ILM policy). 

If you stored billions of 1 byte files, you'd waste 8 KB per each (due to there being two copies).

But you probably *shouldn't* store billions of 1 byte files in S3. You should probably store such files in a database file (such as Parquet) on S3.

If you need to do store billions of tiny files on S3, then don't use object storage, or maybe use ONTAP S3 which has something called [data compaction](https://docs.netapp.com/us-en/ontap/volumes/deduplication-data-compression-efficiency-concept.html) - if file data is smaller than filesystem block size, multiple files can be packed into a single 4 kiB block.

In conclusion, StorageGRID will do fine with small files (4kB or more) as far as filesystem-level behavior is concerned. If you have a ridiculous amount of even smaller files that you want to store as objects, consider ONTAP S3.

For larger objects (>1 MB, for example), you can use StorageGRID ILM to save them with Erasure Coding (2+1, 4+1, 6+3, etc.).

Other object storage vendors may not be as lucky. Some use [Erasure Coding](/2023/09/03/minio-erasure-coding-and-netapp-e-series.html) which supposedly eliminates the need for "expensive RAID controllers", but with millions of tiny files that approach may not end up saving a lot of money. You may even need to use [tricks](https://blog.min.io/minio-optimizes-small-objects/) which ... don't really store small files. 

As to the claims that metadata DB represents and overhead, it's of course an overhead. But in most cases you will have that overhead - the only question is where, and how many times.

If you want to find files, or perform management actions, that works much faster with metadata in a database. Many users will have more than one (even MinIO users, which would populate such databases with Kafka or other notifications or hooks) - it's just a matter whether you want to maintain the first DB island by yourself (and be responsible for its consistency), or use the vendor's DB. Even StorageGRID customers may have another one for search, and yet another for other purposes.

StorageGRID objects are stored on the proven XFS filesystem with sane defaults for both block size and ILM. It's not designed for small objects - most object stores aren't - but doesn't waste space if objects aren't extremely tiny.

Most enterprises have a mix of workloads and object sizes, and StorageGRID - especially appliances with flash storage - will work fine with small file workloads.

ONTAP S3 performs very well with small and tiny files, whether they're on NFS or S3. For S3, due to the more significant protocol overheads, sub-32KB objects accessed over S3 will be a lot slower compared to NFS.

## Where the slowness is coming from

It's nothing to do with filesystem block size for object contents. With NL-SAS appliances, of course those are expected to perform poorly with tiny IO because to get to non-cached data on NL-SAS storage, disk has to spin, and NL-SAS doesn't even spin fast. 

But that's not where the slowness is coming from:

- There's a replicated metadata database that needs to make at least two copies 
- There are HTTPS protocol overheads plus TLS if your connection is encrypted (most are)
- There's network-level back-and-forth for everything

Both of these slow down writes and reads with tiny objects even if you use an SSD appliance. Filesystem block size rarely matters in StorageGRID performance.
