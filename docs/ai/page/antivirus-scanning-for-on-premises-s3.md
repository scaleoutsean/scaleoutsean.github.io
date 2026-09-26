# Scan NetApp StorageGRID S3 buckets for viruses and malware

How to scan on-premises object storage for viruses and malware

- [Introduction](#introduction)
- [Problem description](#problem-description)
- [Getting started with a DIY approach](#getting-started-with-a-diy-approach)
- [Example](#example)
- [A smarter approach](#a-smarter-approach)
- [Preempting and deleting trouble-causing uploads](#preempting-and-deleting-trouble-causing-uploads)
- [Consider various limitations](#consider-various-limitations)
- [Use public cloud to scan StorageGRID buckets mirrored to AWS S3](#use-public-cloud-to-scan-storagegrid-buckets-mirrored-to-aws-s3)
- [Optional commercial components](#optional-commercial-components)
- [Conclusion](#conclusion)

## Introduction

Scanning of S3 buckets and their content for viruses and malware is not rocket science.

There are several open source projects that can AWS S3 buckets, but I haven't found anything for on-premises S3 object storage and the current version of [NetApp Technical Report on StorageGRID security features](https://www.netapp.com/media/61688-tr-4645.pdf) has not much on this, so I'll write down my notes and thoughts on this topic.

## Problem description

Say we needed to scan certain buckets daily to meet some compliance requirements. How to do that? 

The same way we'd scan files in a directory, except that in this case we need to copy files to a directory and scan them there:

- List objects in the bucket
- Copy new and updated objects to a temporary filesystem location (/home/user/tmp/bucket_name, for example)
- Scan objects (files, at this time)
- Notify if anything found
- Delete temporary file(s) (rm -rf /home/user/tmp/bucket_name/object_key)

How to perform near real-time scans? We'd have to figure out how to get notified on PUT.

StorageGRID can send notifications to AWS SNS, but it can also send them to Elasticsearch (or OpenSearch). 

Either way, we need to watch for PUTs and the rest is the same.

What else can be done? Can we scan an object *before* it's been uploaded (and downloaded by some unsuspecting user)?

I've seen a feature in which objects are uploaded to a temp bucket, and the AV scanner scans objects and, if nothing is detected. uploads them to another bucket. So yes, it can be done in this round-about way.

Is that really necessary? Well... it depends on what [risks](https://www.securityweek.com/attackers-exploit-critical-imagemagick-vulnerability/) you want to mitigate. 

> An attacker can create an exploit file and assign it an image extension, such as .png, in order to bypass the targeted site’s file type checks. ImageMagick determines the file type based on so-called “magic bytes,” the first few bytes of a file that are specific to each file type. Once it detects that it’s not an actual .png, ImageMagick converts the file and the malicious code is executed in the process, allowing the attacker to gain access to the targeted server.

## Getting started with a DIY approach

The very simplest way - using scheduled scans - is to scan everything in a bucket. That won't work well for large buckets with millions of MS Office files, for example. But it will work for buckets with hundreds or thousands of files.

A smarter way may be to target only suspicious extensions and recently modified objects, such as:

- Look for commonly infected extensions (.com, .exe, .zip, .bat, MS Office and such)
- Look at "lastModified" value and scan only on objects newer than the time of last run
 
That could yield a subset of all bucket objects, such as this:

```raw
{
 "status": "success",
 "type": "file",
 "lastModified": "2024-01-28T21:19:12.261+08:00",
 "size": 70,
 "key": "eicar.com",
 "etag": "aa991d6e29bf8eb4c1b56c599dffce0a",
 "url": "http://192.168.1.1:443/open/",
 "versionOrdinal": 1,
 "storageClass": "STANDARD"
},
{
 "status": "success",
 "type": "file",
 "lastModified": "2024-01-28T20:53:47.939+08:00",
 "size": 20,
 "key": "this-is-ok.com",
 "etag": "8a91715f0e9ce267a6449a59220075ea",
 "url": "http://192.168.1.1:443/open/",
 "versionOrdinal": 1,
 "storageClass": "STANDARD"
}
```

We'd need to look at the following values:

```raw
"key":"eicar.com", "lastModified":"2024-01-28T21:19:12.261+08:00"
"key":"this-is-ok.com", "lastModified":"2024-01-28T20:53:47.939+08:00"
```

The next thing we want to address is scanning. If we scan files one by one, it will take longer than if we did it in parallel.

To do it in parallel we can do several things:

- Download objects to a scale-out filesystem and run a batch job from many containers, where each picks 10-20 files at a time, or
- Fire up a container which downloads 10-20 objects and scans them all

In the first case we'd also have to remember to delete objects after scanning them. Temporary containers with ephemeral filesystem would be deleted as they exit and get garbage-collected.

The last step is to do something with the results of all (or just positive) scans. 

- If our script has modify permissions, it could add "Scanned OK" to object metadata, or
- It could store job summary to a database or send a notification to Slack

## Example

This poor man's scanner (avscan.py) works as follows:

- List objects in the target bucket
- Download objects one by one to /tmp/ directory
- Each object is downloaded and immediately scanned 
- Log infected files to console or elsewhere

Here's how it works on the bucket called "open" which has 2 objects, one of which is infected:

```raw
$ mc ls df/open
[2024-01-28 21:19:12 CST]    70B STANDARD eicar.com
[2024-01-28 20:53:47 CST]    20B STANDARD this-is-ok.com

$ mc cat df/open/eicar.com
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*

$ mc cat df/open/this-is-ok.com
dafd
as
dfas
fsa
df

$ python3 ~/Documents/demos/s3-bucket-size/avscan.py

Scanning: df/open/eicar.com

===> FILE: /tmp/eicar.com
Scan output:
Scanning /tmp/eicar.com
/tmp/eicar.com: Eicar-Signature FOUND
/tmp/eicar.com!(0): Eicar-Signature FOUND

----------- SCAN SUMMARY -----------
Known viruses: 8683538
Engine version: 1.0.0
Scanned directories: 0
Scanned files: 1
Infected files: 1
Data scanned: 0.00 MB
Data read: 0.00 MB (ratio 0.00:1)
Time: 8.899 sec (0 m 8 s)
Start Date: 2024:01:28 21:21:03
End Date:   2024:01:28 21:21:12

AV signature: daily.cld: version 27167, sigs: 2051667, built on Sat Jan 27 17:40:34 2024

Scanning: df/open/this-is-ok.com

===> FILE: /tmp/this-is-ok.com

INFECTED FILES: 1
```

Here's a screenshot of this script. It's less clean than the text version above, but some folks may find it easier to view:

![StorageGRID antivirus scan](/assets/images/s3-av-scan.png)

As you can see in the summary of eicar.com job, that scan took 9 seconds which is extremely long (considering the tiny file size) due to ClamAV scanner start-up time.

A smarter approach would be to scan both objects at once, to minimize the number of engine initializations, or even run an AV engine at all times and just use it as a service. 

For frequent and/or near real-time scanning we'd simply asynchronously send jobs to a queue and work on that queue by running scans in parallel. 

I've blogged about various batching solutions here, but the common benefit to all approaches is they scale out and with asynchronous approaches there's no blocking. If you have a good batching setup - whether containerized or other - you may be able to scan several medium-sized objects per second using a dozen of CPU cores.

I wonder - but I haven't had time or reason to experimentally verify - how effective it would be to use BeeGFS to create batched parallel downloads of target files from a bucket and rely on [filesystem change notifications](https://doc.beegfs.io/latest/advanced_topics/filesystem_modification_events.html) to automatically trigger scanning from a random BeeGFS client. Technically - since we know which files need to be scanned and we have to download them first - we can likely work faster if we don't wait for filesystem change notifications but start scanning as soon as each object is downloaded. As far as download of objects is concerned it's likely that BeeGFS would allow us to download bucket contents at many GB/s (as long as object storage allows it), so at least that part should work faster than other approaches and also allow scale-out access to many instances of AV scanner without I/O contention. 

I don't expect that many users would consider using a parallel filesystem right away, but at certain scale (100TB buckets, etc.) that may become a good choice. And in the case of very large object stores it may be better to host those on a parallel filesystem and share them through an S3 gateway such as [Versity S3 Gateway](/2023/09/20/versity-gw-s3-posix-gateway-beegfs-eseries.html), so that we can completely avoid the need to download objects.

## A smarter approach

A smarter approach would consist of something like this:

- enable StorageGRID notifications or indexing on buckets we want to scan
- receive notifications (SNS) or recent changes (Elasticsearch, OpenSearch) on dispatchers and create scan jobs to run on scanner systems/containers
- use scanner systems or containers to download objects in batches and run scan jobs on downloaded files
- store results in a database or notify via email, Slack, etc.

Optionally we could move objects around or do something similarly proactive in addition to notifying.

We'd also gather metrics from main steps to be able to monitor and observe the entire stack.

Mature AWS S3 workflows work similar to this, but they tend to depend on AWS infrastructure and would require modifications to work the same way on-premises.

An on-premises stack for StorageGRID could look like this. Obviously this is just one of many possible approaches.

![StorageGRID antivirus scan architecture](/assets/images/s3-av-scan-example.png)

## Preempting and deleting trouble-causing uploads 

Some approaches decide to delete infected objects. If AV scan is executed by a StorageGRID tenant, that may be possible (if the object is not locked or immutable), but otherwise it may not be possible. 

That is also risky. It's risky enough to let scanner List/Get (required to download all objects), but to give AV scanner the ability to also delete them is even more dangerous. Maybe such functionality should be combined with versioning to prevent outright deletion (as long as it's discovered before it's too late).

A milder corrective action is to modify ACLs to deny GETs on infected files. Obviously, this may prevent legitimate users from overwriting infected file with a non-infected file and cause all sorts of troubles to applications, but in some cases it may be a better approach than outright deletion by the scanner. A variant of disallowing downloads is to move infected files to another bucket.

Another good idea is to avoid troublesome extensions. I don't know what could possibly justify allowing .com or .exe files. I'd disallow those extensions with bucket policies in the first place.

## Consider various limitations

We need to be remember that AV scanners often have various limitations and even when that is not the case, not all infected objects will be identified.

Almost all AV scan engines have a maximum file size they can scan, so for very large files it may not be possible to scan them easily.

Some scanners may not be able to decompress certain extensions. 

Most scanners can scanning compressed archives, but not an unlimited number of levels deep.

If only new objects are scanned when they appear, latest viruses and malware may remain undetected so I'm not sure if scanning objects just once is enough. It is probably necessary to periodically re-scan all objects (or at least MS Office).

Similar concern exists for buckets with versioning enabled - even if infected objects be "deleted", they'll remain available by referring their version until they expire or until someone who is allowed to `s3:DeleteObjectVersionTagging` deletes that specific version. Locked objects cannot be deleted, so maybe using ACLs to prevent access to infected objects may be an acceptable workaround in isolated cases. With many files in ACLs JSON that bucket policy would probably hit a limit; on AWS S3 I think the limit is 20KB. I'm not sure how much StorageGRID allows.

## Use public cloud to scan StorageGRID buckets mirrored to AWS S3

I mentioned StorageGRID supports AWS SNS notifications. That means we could run an AWS-based S3 scanner, but we'd have to copy objects to the cloud. 

If you don't mind doing that you could set up AWS S3 antivirus scanner (or use the one from AWS) and configure StorageGRID CloudMirror to replicate buckets to AWS S3. As long as you don't mind your objects being copied over, that would work fine, except that your notifications would look "funny" (bucket + key would be correct, but the URL will point to AWS S3 rather than your StorageGRID API endpoint).

And of course, you wouldn't be able to use that approach remove objects from on-premises StorageGRID bucket. Maybe it would be possible with some modifications of open source solutions for S3, by making changes in their AWS Lambda functions (to manipulate the URL and delete or move on-prem objects). Still, this would be relatively easy compared to coding own solution for on-premises, and easier than modifying an open source solution for AWS S3 to work with on-premises-based software.

You may also be able to modify open source Lambda functions to access and read objects off your on-premises StorageGRID, and let everything run in AWS. But again, this copies objects to the public cloud so it may not be for everyone and may require more Internet bandwidth than you have available.

## Optional commercial components

I don't know who provides commercial S3 scanning software for on-premises customers, but if you have to build your own then you may want to consider using at least some commercial components such as:

- File scanning engine and subscription to latest updates (Sophos and such)
- Content management database with batching and reporting features (Elasticsearch, [Starfish](https://starfishstorage.com/), etc.)

## Conclusion

Antivirus scanning on-premises doesn't have to be reinvented. It can be implemented using established workflows with many workflow tools, from the CLI to scale-out microservices on a parallel file system.

To make it enterprise-y it'd take a week or two, but then you'd have a good scanner that can deal with millions of new or changed objects every day.

It is very important to secure the entire solution to prevent theft of S3 credentials or data.

If you implement StorageGRID bucket scanning (either commercial, forked or own), you should probably implement strict data management policies to eliminate unwanted objects, and scan objects before upload (and maybe also after download, in case of in-house applications which you can control).

If you intend to be able to delete infected objects, make sure to rigorously protect your S3 scanning cluster, and that versioning, Object Lock and such are not unnecessarily enabled and used on buckets that don't need such features. Or, if there's no other way, implement upload via an intermediate bucket as explained earlier.
