# Directly access BeeGFS RST data on NetApp StorageGRID

## Introduction

You know there are NAS or filesystem gateways that can transparently tier to back-end S3, right?

![NAS gateway with transparent S3 tiering](/assets/images/beegfs-rst-access-03-traditional-tiering.png)

When you want to read a file that's fully or partially parked on S3, you still do the same thing as always - read it over NFS or SMB or from filesystem (like with your Documents folder tiered to Azure by OneDrive).

Good! 

This isn't that.

I blogged about the BeeGFS RST feature [here](/2026/07/18/beegfs-84.html). Basically, we use `push` and `pull` commands to "manually" copy a directory or file to S3.

![BeeGFS RST with push and pull to S3](/assets/images/beegfs-rst-access-04-beegfs-rst-tiering-storagegrid.png)

"Other S3 clients" in this diagram is meant to show that other buckets on the same object store can also be used by other applications.

RST is a new feature in BeeGFS 8 (current version is 8.4) so it's not very mature. For example, currently it's not accessible to users. It's operated by the BeeGFS administrator. 

At some point it will become more transparent to users, but until then - and possibly after - we can get creative and make it work better.

One way to do that is direct access to BeeGFS data on S3:

- Your file has been copied or tiered (pushed with a stub) off to S3 and it's not set for automated restore. You need it now. What to do? You could copy it to another path on BeeGFS, but if only you could get to it
- You want to work on files on S3, without having to copy them to BeeGFS
- You want to quickly download BeeGFS-tiered data to [BeeOND](/2026/06/05/above-and-beeond-beeond.html) for batch processing using `rclone`
- Maybe your BeeGFS is on-premises with E-Series and you tier files to AWS S3. Accessing them over S3 from EC2 (maybe a BeeOND cluster, even) is much cheaper if you don't need to repatriate

## Direct access to S3 data on StorageGRID

Files (objects) are there in our bucket, ready to be accessed. There's nothing we need to do as we already have an S3 key, why not just access them?

Because the S3 key was issued to the BeeGFS administrator. And we shouldn't use the same S3 keys that can delete everything.

We should create a separate set of keys, or even separate tenant groups. For example:

| Path     | Bucket | StorageGRID Tenant Group |
| -------- | -------| ---------- |
| /mnt/beegfs/project1 |    beegfs  | Group1 |
| /mnt/beegfs/tiered-stuff | beegfs | BeeGFS Users |

Inside of a bucket used by RST, "paths" reflect BeeGFS filesystem layout. It's very simple to find your way around.

With this, assuming a well organized BeeGFS tree, we can easily create bucket ACLs to allow different users to access bucket paths more securely, without everyone seeing or downloading other people's data.

Create a tenant group. You can make it very limited, because it needs very limited access.

![Create a group](/assets/images/beegfs-rst-access-00-create-group.png)

Create a limited access policy. You could go with Custom, to make it granular.

![Create access policy](/assets/images/beegfs-rst-access-01-create-limited-access-policy.png)

My tenant ID is 26296085394235545212 and the group is "BeeGFS Users" as per that table above. I could limit this group to only objects below that "path" that belongs to them:

```json
{
    "Effect": "Allow",
    "Principal": {
    "SGWS":[ 
      "urn:sgws:identity::26296085394235545212:group/BeeGFS Users"]
    },
      "Action": ["s3:GetObject", "s3:ListBucket", "s3:ListBucketVersions", "s3:GetObjectVersion", "s3:GetObjectTagging"],
      "Resource": [
        "urn:sgws:s3:::beegfs/tiered-stuff/*",
        "urn:sgws:s3:::beegfs/tiered-stuff"]
}
```

Create users and add them to the group, if you want to create keys for each. It might be a good idea for StorageGRID with federated authentication where you automate ADS or LDAP groups so that access can be kept uniform across BeeGFS and StorageGRID RST location.

![Create additional users and add to group](/assets/images/beegfs-rst-access-02-create-users.png)

I issued S3 keys to `BeeGFS-Ah` and used that to access the BeeGFS bucket.

Now, this is my current /mnt/beegfs/tiered-stuff. I want `stub.file`, but you can see it's been tiered out - it's a stub.

```sh
$ ls -lat /mnt/beegfs/tiered-stuff
total 14818
-rw-r--r-- 1 sean sean       32 Aug  7 12:57 seans.file
drwxr-xr-x 2 root root        5 Aug  7 09:09 .
-rw-r--r-- 1 root root      566 Aug  6 04:24 steps.txt
-rw-r--r-- 1 root root       31 Aug  6 04:20 stub.file
drwxrwxrwx 6 root root    84750 Aug  6 04:17 ..
-rwxr-xr-x 1 root root     7353 Aug  1 14:50 test.py
-rwxr-xr-x 1 sean sean 15077496 Aug  1 11:19 old.file

```

This is how an RST stub looks like.

```sh
$ cat stub.file 
rst://1:tiered-stuff/stub.file
```
 
`1` in that link is an RST ID, defined by a target (endpoint, in this case my StorageGRID cluster) and bucket (`beegfs`).

Not everything from that BeeGFS path has been tiered or pushed to S3, but the file I need *is* on S3.

Since `BeeGFS-Ah` has access to the bucket, he should be able to get to that file. (By the way, notice that `old.file` is both on BeeGFS, and on S3 - it was `push`-ed, but not stubbed, so it exists in both places.)

```sh
$ mc ls s3/beegfs/tiered-stuff/
[2026-08-01 19:19:49 CST]  14MiB STANDARD old.file
[2026-08-01 22:28:29 CST]  14MiB STANDARD stub.file
[2026-08-01 21:20:23 CST] 7.1KiB STANDARD test.py
```

Good. Let's see if we can delete an object to cause some damage.

```sh
$ mc rm s3/beegfs/tiered-stuff/test.py 
mc: <ERROR> Failed to remove `cosib/beegfs/tiered-stuff/test.py`. Access Denied
```

It doesn't work. Good. Let's read one.

```sh
$ mc head s3/beegfs/tiered-stuff/test.py 
#!/usr/bin/env python3

import argparse
import os
```

It works. Also good!

## RST vs. `rclone`

How is this different from "simply" pushing and pulling files with `rclone`?

It's different because RST is integrated with BeeGFS (including stubs, optimal parallel push/pull, auto-recall [and more](/2026/08/02/eke-update.html)), while `rclone` has to be manually operated and the users (the administrator and/or end usrs) need to keep track of what's what. As you can imagine, that's not fun for PBs of data.

Both can be used in the same cluster and `rclone` can be used by end users, but for repetitive and stable use at scale, `rclone` requires a lot more effort to operate.

RST is somewhere between `rclone` and commercial offerings and it's focused on BeeGFS.

If you manage data from an S3-centric perspective (S3 as the SSoT), maybe you wouldn't use RST, but I think it's useful even in that case.

## Conclusion

Direct access to BeeGFS RST-tiered data is great. It gives us more flexibility and has no disadvantages. 

If you enable ACLs on BeeGFS and use LDAP integration, I assume you could even sync permissions across BeeGFS and StorageGRID (access policy JSON), but for most users that won't be necessary. Most BeeGFS clusters with RST will have just a few users who need this and it could greatly improve their RST experience.

You can read RST data located on StorageGRID from anywhere.

If you need to work on it from public cloud, you don't even need to copy it to the cloud - it's enough to have it tiered and it's already accessible directly via S3, from OneLake or via OpenSharing (if you prefer building your own). 

![Universal access to RST data](/assets/images/beegfs-rst-access-05-beegfs-rst-universal-access.png)

- Direct access to StorageGRID from Azure OneLake is possible today - see [this](/2026/08/02/data-sharing-problem-myth-onelake-storagegrid.html)
- An example of an OpenSharing server for StorageGRID can be found [here](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html)
- COSI for StorageGRID exists, but I'd suggest to stay away from it. The COSI spec is still [garbage](/2026/06/07/cosi-v1alpha1-is-garbage.html)
- BeeGFS RST tiering doesn't even have to be manual. It can be automated today, it's just that automation is not yet complete. Automation based on BeeGFS filesystem notifications is done as explained and demonstrated [here](/2025/06/22/data-pipeline-with-beegfs-file-system-notifications-and-versity-s3-gateway.html) and in the BeeGFS documentation (including in the RST-related documentation from BeeGFS 8.4.0, as automated RST file recall already relies on notifications)

If you look at that OneLake post (the OneLake roadmap screenshot), within months, it will be possible to generate or process data on BeeGFS, `push` to StorageGRID and have OneLake "convert" those objects to (datalake) tables in OneLake, for example.
