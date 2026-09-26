# Versity S3 Gateway with BeeGFS

Use VersityGW with BeeGFS on E-Series

- [What](#what)
- [Config](#config)
- [How](#how)
- [Using](#using)
- [Conclusion](#conclusion)
- [Appendix - External performance test](#appendix---external-performance-test)

## What

I've [blogged about VersityGW before](/2023/06/14/versity-s3-posix-gateway.html) and concluded that for some users it's a promising alternative to MinIO GW. 

That includes the users of NetApp's [BeeGFS](https://doc.beegfs.io/latest/index.html)-E-Series solution. Usually the goal is to be able to download files via S3.

S3 doesn't even need to scale-out, as a single BeeGFS client can serve data at many GB/s.

The first post was "generic", and this one is with BeeGFS.

## Config

- OS: Ubuntu 22.04
- BeeGFS: 7.4.1
- VersityGW: v0.7

## How

Find a BeeGFS client, get the source code and edit its runtests.sh so that it uses a BeeGFS location suitable for testing.

```sh
git clone https://github.com/versity/versitygw
cd versitygw
# make # (or download versitygw from Releases, to this directory or /usr/local/bin/)
# create test dir /mnt/beegfs/gw
mkdir /mnt/beegfs/gw
# server side of test suite, in terminal 1
ROOT_ACCESS_KEY=myaccess ROOT_SECRET_KEY=mysecret versitygw posix /mnt/beegfs/gw
# client side of test suite, in terminal 2
versitygw test -a myaccess -s mysecret -e http://127.0.0.1:7070 full-flow
```

Assuming you're using the default mount point /mnt/beegfs, the top of runtests.sh look like this.

In my case I built versitygw from the source (simply use `make`) and executable (versitygw) was created in the root directory of the cloned repository. 

Run tests as a sudoer if you didn't chown BeeGFS directories for a non-sudoer.

```sh
$ sudo ./runtests.sh  # in versitygw repo

 ┌───────────────────────────────────────────────────┐ 
 │                     versitygw                     │ 
 │                   Fiber v2.49.2                   │ 
 │               http://127.0.0.1:7070               │ 
 │       (bound on host 0.0.0.0 and port 7070)       │ 
 │                                                   │ 
 │ Handlers ............ 25  Processes ........... 1 │ 
 │ Prefork ....... Disabled  PID .............. 2554 │ 
 └───────────────────────────────────────────────────┘ 

RUN  Authentication_empty_auth_header
08:14:41 | 400 |     108.413µs |       127.0.0.1 | GET     | /my-bucket           
PASS Authentication_empty_auth_header
... # bunch of rows

```

You may some errors, especially if your BeeGFS is Community Edition (without ACL support, which means POSIX support would be incomplete), but this test is a quick way to determine which tests and S3 APIs work. 

Another useful resource is the Wiki, and [this page](https://github.com/versity/versitygw/wiki/POSIX-Backend) shows which functions ought to work on a POSIX back-end. Which means any discrepancies between ACLs-enabled BeeGFS and what you see here should be confirmed by using another POSIX fileystem (such a XFS).

**NOTES**: 
- After you're done, delete test directories. If you run tests again without doing it, then several may fail because data is already in place.
- I enabled ACLs on BeeGFS; without it you'll get ACLs-related errors in these tests. The gratis BeeGFS edition does not support ACLs, but the supported version sold by NetApp and ThinkParQ in general does.

## Using

VersityGW v0.7 was released yesterday so used that version. Decompress the archive and move cmd/versitygw to /usr/local/bin/ or whatever.

You can follow this [official Quickstart](https://github.com/versity/versitygw/wiki/Quickstart) or try this "version" with BeeGFS mount paths.

```sh
versitygw -h

# create "root" + bucket
mdkir -p /mnt/beegfs/versity/bucket
# if you want to not run as root:
# sudo chown -R some:guy /mnt/beegfs/versity

# change admin name and secret key (-a, -s)
# last row is VersityGW's "root", don't start from a bucket
versitygw --debug --access-log '/var/log/versitygw.log' \
  -a admin -s NetApp123$ \
  posix /mnt/beegfs/versity/

```

Access log /var/log/versitygw.log looks tidy. Several rows for your pleasure:

```raw
admin bucket [20/September/2023:09:05:52 +0000] 127.0.0.1 admin 9AE29DD2F1806839 GetObject multipart.junk http://localhost:7070/bucket/multipart.junk 200 - 0 0 8 8 - aws-cli/2.13.19 Python/3.11.5 Linux/5.15.0-84-generic exe/x86_64.ubuntu.22 prompt/off command/s3.cp - - SigV4 - AuthHeader s3.us-east-1.amazonaws.com - arn:aws:s3:::/bucket/multipart.junk Yes
admin bucket [20/September/2023:09:06:42 +0000] 127.0.0.1 admin A21D8104B2D1CE3B ListObjectsV2 - http://localhost:7070/bucket?list-type=2&prefix=&delimiter=/&encoding-type=url 200 - 749 0 4 4 - aws-cli/2.13.19 Python/3.11.5 Linux/5.15.0-84-generic exe/x86_64.ubuntu.22 prompt/off command/s3.ls - - SigV4 - AuthHeader s3.us-east-1.amazonaws.com - arn:aws:s3:::/bucket Yes
log starts 2023-09-20 09:16:36.425835158 +0000 UTC m=+0.009717841

```

Compared to early on when VersityGW was a baby, now (`--debug`) log is clean with no errors during simple (ls, cp) operations that I tried.

```raw
2023/09/20 09:06:42 Request query arguments: 
2023/09/20 09:06:42 list-type: 2
2023/09/20 09:06:42 prefix: 
2023/09/20 09:06:42 delimiter: /
2023/09/20 09:06:42 encoding-type: url
SDK 2023/09/20 09:06:42 DEBUG Request Signature:
---[ CANONICAL STRING  ]-----------------------------
GET
/bucket
delimiter=%2F&encoding-type=url&list-type=2&prefix=
host:localhost:7070
x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
x-amz-date:20230920T090642Z

host;x-amz-content-sha256;x-amz-date
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
---[ STRING TO SIGN ]--------------------------------
AWS4-HMAC-SHA256
20230920T090642Z
20230920/us-east-1/s3/aws4_request
f4112fc98335cf1f6092fcee42f65634360437d48b14dac5603a6bf7eab11075
-----------------------------------------------------

2023/09/20 09:06:42 Request Body: 

2023/09/20 09:06:42 Path parameters: 
2023/09/20 09:06:42 bucket: bucket

2023/09/20 09:06:42 Response Headers: 
2023/09/20 09:06:42 Content-Type: application/xml
2023/09/20 09:06:42 Server: VERSITYGW

2023/09/20 09:06:42 Response body 
09:06:42 | 200 |    5.793518ms |       127.0.0.1 | GET     | /bucket       
```

I tested this on a VM, so I didn't attempt any benchmarking. 

VersityGW is written in Go, so unless they're incompetent (which is extremely unlikely, as they [know](https://www.versity.com/products/scoutfs/) their stuff) VersityGW should perform good enough.

I got close to 200 MB on PUTs and close to 300 MB on GETs for a *single* file. With parallel access gigabytes per node per second should be possible (as a reminder, I get [around 3-4 GB/s with a single MinIO server](/2022/10/21/minio-performance-netapp-e-series.html) connected to E-Series).

![VersityGW on BeeGFS](/assets/images/versitygw-s3-gateway-on-beegfs-01.png)

Unrelated but far more interesting to me is the `ls` output at the bottom: the multipart-orientated 5.2G file `multipart.junk` did not get chunked by VersityGW.

## Conclusion

In my first post on Versity done in mid June 2023 I said:

> Within 2-3 quarters Versity S3 Gateway could be enough for several basic use cases

I was wrong: only 90 days later VersityGW is more than good enough for basic use cases!

VersityGW continues to advance and is already a very nice piece of software that does exactly what it says on the tin.

Permissively licensed OSS, single binary, works well, decent documentation, does what MinIO no longer will.

Users of the free BeeGFS may want to test without ACLs to see if that presents any problems. Enterprise customers of BeeGFS who need S3 gateway functionality should test VersityGW now.

## Appendix - External performance test

In early 2024 Versity performed performance tests that demonstrated continued progress of their S3 Gateway.

- [Comprehensive performance tests with Versity S3 gateway](https://www.versity.com/versity-s3-gateway-performance/)
