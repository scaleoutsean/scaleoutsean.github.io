# Versity S3 Gateway

Promising free S3 gateway for POSIX filesystems

## What

As some may recall, over a year ago MinIO stopped supporting its gateway deployment type (aka MinIO Gateway).

I blogged about that topic [here](/2022/08/09/nomad-beegfs-minio-s3.html).

Since then several things have happened in this are, such as the MinIO-WEKA licensing spat (or maybe more, but I haven't heard that it progressed further) in which MinIO accused WEKA of violating its license and WEKA responded that it hasn't. 

What seems to have taken place is WEKA forked MinIO Gateway and respected the license - I don't recall now whether they forked an original/older Apache-licensed release or later AGPL code, but it also doesn't matter: the point is some MinIO users didn't like that Gateway went away.

The ScoutFS vendor Versity is another such user. Unlike WEKA, they took a different path and launched a community project [VersityGW](https://github.com/versity/versitygw), a permissively-licensed S3 gateway.

Versity S3 Gateway is a single Go binary, which makes it easy to deploy and even containerize.

## Why

Why blog about it?

- Versity GW may eventually by adopted by some E-Series users
- You can probably use this S3 gateway in your E-Series environment

First, Versity S3 Gateway supports Versity ScoutFS which is what some E-Series users have in their environment.

Second, Versity S3 Gateway also supports generic POSIX filesystems, which is what  some other E-Series users have.

How does Versity S3 Gateway work? I encourage you to [visit the repo](https://www.versity.com/products/versitygw/), but I'll borrow this image that shows a Versity S3 Gateway deployment in a ScoutFS environment:

![Versity S3 Gateway architecture](/assets/images/versity-s3-gateway.png)

This is expected to work the best, obviously, but other POSIX file systems can work as well. If you wanted to deploy it in a BeeGFS or XFS environment, that could work.

## Test, contribute and be patient

Versity S3 Gateway is very early in its development (alpha v0.2) and it has only some most basic features.

MinIO client couldn't work (I used AWS S3 client instead).

When I PUT files only small (< 100 MB) uploads completed, while larger had various multipart (even at 1 GB size) errors.

Sometimes errors would be inconsistent (one error after a try, another error on a retry).

Uploading a file via POSIX and trying to GET it via S3 didn't work either. Server-side log:

```raw
walk iso: get etag "8cr.pdf": xattr.get iso/8cr.pdf user.etag: no data available
05:42:41 | 200 |      0s |    192.168.1.13 | GET     | /~��c3�&���#zƶ�n�i��8��#=�-��{L�w��8ѱ-4@��Y�U�
```

Basically the only thing that worked for me was PUT and GET for sub-100 MB files. 

That seems bad if you're looking to replace MinIO Enterprise Edition with something free, but if you have existing filesystem which you want to share to anonymous users via S3 in a read-only fashion (say, an ISO repository) that may be very close to all the features you need. Well, almost.

Versity seems to have some large users collaborating on this project, but the larger and more active the community becomes the faster its progress be. So give it a try and submit any bugs you find. Don't miss the Versity S3 Gateway [Wiki](https://github.com/versity/versitygw/wiki)!

## Conclusion

I have no doubt that ScoutFS integrations will work relatively better because that's what paying customers use. But others should benefit from this S3 gateway project as well.

Within 2-3 quarters Versity S3 Gateway could be enough for several basic use cases and, being permissively licensed, it's likely to fill some of the gap left by the end of MinIO Gateway.

It may take longer to address the more demanding use cases, but I wouldn't even say that is the objective here. 

My guess is for Versity the objective is to have a workable scale-out S3 gateway solution for ScoutFS customers. For folks with data on generic POSIX filesystems, the objective may be to identify use cases where Versity S3 Gateway works good enough.

There's a scarcity of open source S3 gateways, so it would be valuable even if Versity S3 Gateway could satisfy 2-3 use cases with generic filesystems.
