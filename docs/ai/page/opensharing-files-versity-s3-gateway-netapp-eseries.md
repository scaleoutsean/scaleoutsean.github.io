# NetApp volume content sharing with OpenSharing and Versity S3 Gateway

How OpenSharing and the Versity S3 Gateway make NetApp E-Series Volume assets shareable

- PART ONE: [Does OpenSharing have anything for NetApp E-Series?](https://scaleoutsean.github.io/2026/06/14/netapp-eseries-opensharing-deltasharing.html)
- PART TWO: [IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series](/2026/06/16/netapp-eseries-iot-compaction-opensharing.html)
- **PART THREE:** NetApp volume content sharing with OpenSharing and Versity S3 Gateway
- PART FOUR: [OpenSharing server for NetApp StorageGRID and E-Series with Versity S3 Gateway](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html)
- PART FIVE: [OpenSharing Server with S3/RDMA-based Versity S3 Gateway](/2026/08/10/opensharing-with-versity-s3-rdma-and-netapp-eseries.html)

## Introduction

The other day I [blogged about OpenSharing and E-Series](/2026/06/14/netapp-eseries-opensharing-deltasharing.html) and mentioned how Tables are where almost all of the action must be right now, but Volumes are more (positively) disruptive for E-Series because today, if you have data on an E-Series volume and want to share it, you're not in a good spot.

At the time it seemed I needed OpenSharing API to provide S3 proxying. That's actually not true - it only *seemed* that way by reading the low-energy OpenSharing Volume specs and practical examples for Volume assets aren't exactly abundant.

It turns out it's just more of the same. We can do it today!

![Well... That escalated quickly!](/assets/images/well-that-escalated-quickly.jpg)

Let's see how OpenSharing for Volumes disrupts things in a good way.

## Setup

The same thing, an instance of OpenSharing API server and a Versity S3 Gateway. Unlike before, we're sharing regular volume contents - a "read-only Web drive" scenario: 

- File data is gathered by application/service (logging, video surveillance, whatever)
- Data needs to be accessed by consumers for whatever purposes (analytics, inferencing, you name it)

The bucket has several files in it:

![VGW Bucket](/assets/images/opensharing-eseries-15-volume-assets-vgw-bucket.png)

The same view in the CLI using MinIO client:

```sh
$ mc ls vgw/volume-bucket/
[2026-06-17 11:43:52 CST] 312MiB STANDARD big-file-scan-2025-06-01_23.12.05.mp4
[2026-06-17 11:44:50 CST] 449MiB STANDARD metal-amd64.iso
[2026-06-17 11:46:39 CST] 354KiB STANDARD moon.jpg

```

There's nothing special about these files - they haven't been uploaded over S3, there's no object metadata, etc. (That's something that could be used to enrich access, but that's an "accessing objects natively on S3" scenario, not the OpenSharing Volume asset scenario.)

![VGW Object](/assets/images/opensharing-eseries-16-volume-assets-vgw-bucket-object.png)

## OpenSharing API server and client 

My OpenSharing API server prototype does the same thing it does for Tables:

- Confirms API client is authorized to access
- Provides information about assets (volume contents, rather than tables)
- Shares pre-signed file (as object) URLs with API client

Client can therefore discover and access volume contents the same way it uses OpenSharing Tables.

Let's try with that bucket above:

```sh
$ VOLUME=volume-bucket python3 ./test-volume-client.py
Querying Volume: my-share.my-schema.volume-bucket

Discovered 3 files in the Volume root.
  - big-file-scan-2025-06-01_23.12.05.mp4 (319159.19 KB)
  - metal-amd64.iso (460108.00 KB)
  - moon.jpg (353.59 KB)

Requesting S3 download presigned-URL for: big-file-scan-2025-06-01_23.12.05.mp4
Success! Presigned URL generated:
http://localhost:7070/volume-bucket/big-file-scan-2025-06-01_23.12.05.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=admin%2F20260617%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260617T035340Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=dd1370dd553f7a612a626a0beeea809e17c66e23fc677680319d36e4d9c502ec
```

## Conclusion

This may seem no different from running a read-only Web server from the volume root directory. But it is very different. 

We have a free, standards-based, zero-copy, file sharing solution for Volumes (files, really) that works both on single host volumes (XFS, for example) and in various scale-out scenarios (BeeGFS with E-Series) and can run this stuff on Kubernetes if we want to (example: run Versity Gateway on SANtricity CSI or BeeGFS CSI PVCs).

![OpenSharing with Versity S3 Gateway and E-Series](/assets/images/opensharing-eseries-08-opensharing.png)

Tables - done. Volumes - done. My top two use cases now both work!

Authorization is done the same way it's done for all other analytics/AI sharing (JWT tokens, from the same source you get them in your environment today). Use a reverse proxy such as Traefik in front of your OpenSharing app server and Versity S3 Gateway if you want even more control over access (source IP, etc.), request rates, QoS, etc. 

Audit logging is done on OAuth2 server, Traefik API gateway, OpenSharing API server and Versity S3 Gateway. Users don't have direct access to S3, and data is accessed in read-only fashion, so this is trivial to manage.

We no longer *must* move generated or collected data someplace else if parking it on E-Series arrays does the job cost- and performance-wise.

## Appendix A: Word Count example

The "`dir -lat`" example above is deliberately trivial because what we do with data is out of scope. Or how we get 'em.

Which brings me to a more exciting example. Let's say we're recording employees' conversations for, uhm, like, you know, just in case, and storing them in the same bucket (`conversations-*.txt`). 

```sh
$ mc ls vgw/volume-bucket/
[2026-06-17 11:43:52 CST] 312MiB STANDARD big-file-scan-2025-06-01_23.12.05.mp4
[2026-06-17 12:44:08 CST] 1.7KiB STANDARD conversations-2026-06-10.txt
[2026-06-17 12:44:13 CST] 2.1KiB STANDARD conversations-2026-06-12.txt
[2026-06-17 12:44:17 CST] 2.2KiB STANDARD conversations-2026-06-14.txt
[2026-06-17 11:44:50 CST] 449MiB STANDARD metal-amd64.iso
[2026-06-17 11:46:39 CST] 354KiB STANDARD moon.jpg
```

From time to time we want to know what they're up to. Let's see top 10 words from last week:

```sh
$ TOP_N=10 FILE_GLOB="conversations-2026-06-1*.txt" \
  VOLUME=volume-bucket \
  python3 test-volume-hdfs-client.py

============================================================
  OpenSharing Volume Client — MapReduce Word Count
============================================================
  Volume  : my-share.my-schema.volume-bucket
  Pattern : conversations-2026-06-1*.txt
============================================================

[CONTROL PLANE] Listing files matching 'conversations-2026-06-1*.txt'...
  Found 3 file(s), 6.1 KB total

[MAP] conversations-2026-06-10.txt  (1.7 KB)
       → 156 (word, 1) pairs emitted
[MAP] conversations-2026-06-12.txt  (2.1 KB)
       → 197 (word, 1) pairs emitted
[MAP] conversations-2026-06-14.txt  (2.2 KB)
       → 202 (word, 1) pairs emitted

[REDUCE] Aggregating 555 pairs across all files...

────────────────────────────────────────
  Top 10 words across all conversations
────────────────────────────────────────
   1. files                  10  ██████████
   2. api                     8  ████████
   3. file                    7  ███████
   4. object                  6  ██████
   5. like                    6  ██████
   6. data                    6  ██████
   7. s3                      6  ██████
   8. delta                   5  █████
   9. parquet                 5  █████
  1.  use                     5  █████

────────────────────────────────────────
  Total unique words : 348
  Total word count   : 555
  Files processed    : 3
────────────────────────────────────────

```

Yes, we can get that from Hadoop with [Ozone S3](/2026/05/19/apache-ozone-netapp-santricity-csi.html) and so on, but that's when your data is already in your Hadoop environment.

You may not want it there, or parking it on E-Series and making it available via OpenSharing API may be easier, cheaper, faster, etc.

The buzzword ("zero copy") means we don't have to download (copy) objects. In this case we stream data from S3 into client memory and process it there.

```python
with requests.get(presigned_url, stream=True, timeout=30) as response:
    for raw_line in response.iter_lines(decode_unicode=True):
        ... 
```

Similar advantages apply to CCTV recordings and all other sorts of unstructured files that we would share using OpenSharing for Volumes.

Sometimes you'll want direct S3 access, other times you won't, and OpenSharing for Volumes will do the job. If you're a very large-scale hoarder, NetApp StorageGRID (the SG6x60 appliances employ E-Series storage arrays) may work better for you. It's good to have choices.
