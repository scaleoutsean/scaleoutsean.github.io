# SolidFire Backup to S3 with Object Lock

SolidFire Backup to S3 with Object Lock-enabled Object Store

- [How would we use SolidFire Backup to S3 with Object Lock-enabled buckets](#how-would-we-use-solidfire-backup-to-s3-with-object-lock-enabled-buckets)
- [Practical observations](#practical-observations)
  - [How many S3 objects or accounts do we need](#how-many-s3-objects-or-accounts-do-we-need)
  - [Determine suitable access policy](#determine-suitable-access-policy)
  - [Backup job tagging and Object Locks](#backup-job-tagging-and-object-locks)
  - [Compliance vs. governance mode](#compliance-vs-governance-mode)
  - [How to get to a point-in-time version of an object](#how-to-get-to-a-point-in-time-version-of-an-object)
- [Conclusion](#conclusion)

## How would we use SolidFire Backup to S3 with Object Lock-enabled buckets

In the post about [SolidFire Operator](/2022/04/28/solidfire-operator-kubernetes.html) for Kubernetes I wrote about using SolidFire Operator and Ansible to invoke SoliFire's Backup to S3.

In this post I just want to quickly note that SolidFire's Backup to S3 has the optional "tag" argument which originally served a a way to keep multiple backups of a volume (e.g. bucket/vol1/[bkp1,bp2]).

SolidFire backups can be space efficient (the native format option), but tagged backups aren't globally space-efficient (e.g. if vol1 is 3GiB, space-efficient bkp1 is 1GiB, and bkp2 taken a week later is 1.1GiB, these will consume 2.1GiB on S3). 

Still, given the low cost of S3, this can be used to keep several backups of a volume.

![SolidFire Operator - backup tags](/assets/images/solidfire-operator-05-s3-backup-tag.png)

In this post I want to examine if we can use these to take advantage of Object Lock. If you're simply intested in lowering the cost of backup to S3, then check the Archive - there are how-to's for Velero, Duplicati, Restic, Restic Server, etc.

So, like the UI says, a non-empty valid tag string gets appended to the (fixed) prefix value. Well, that's not entirely true: what gets appended to prefix is `'/' + ${TAG} + '/'`:

- without tags: PROD-mn4y/pvc-1something-2something-604
- with tags: PROD-mn4y/pvc-1something-2something-604/[bkp1,bkp2]

Having taken three backups - two without a tag and another with the tag `fri` (today is Friday), here's what I see in the bucket solidire-native-backup:

![SolidFire Operator - backup with valid tag](/assets/images/solidfire-operator-05-s3-backup-tag-in-bucket.png)

Two manifests for "tagless backup" can be seen in $BUCKET/$VOL_NAME-$VOL_ID path, while the tagged one is in the `fri` "subdirectory".

This gives me the ability to tag my Ansible or PowerShell or other backup scripts with a day-of-week string.

As noted above, S3 capacity-wise it doesn't make difference if I used buckets [mon,tue,wed,thu,fri,sat] and changed my bucket, or used tags. I'd consume the same amount of S3 resources.

- [mon,tue,wed,thu,fri,sat]/PROD-mn4y/pvc-1something-2something-604 - daily backup to day-of-week-named buckets
- /PROD-mn4y/pvc-1something-2something-604/[mon,tue,wed,thu,fri,sat] - daily backup with dynamic day-of-week tags

Next, check your Object Storage documentation to see what can work for you.

In the case of StorageGRID, we can see some key points in [TFM](https://docs.netapp.com/us-en/storagegrid-116/s3/using-s3-object-lock.html#enable-s3-object-lock-for-bucket):

> If the global S3 Object Lock setting is enabled for your StorageGRID system, you can create buckets with S3 Object Lock enabled and then specify default retention periods for each bucket or specific retain-until-date and legal hold settings for each object version you add to that bucket.

That's what we want.

> The StorageGRID S3 Object Lock feature provides a single retention mode that is equivalent to the Amazon S3 compliance mode. By default, a protected object version cannot be overwritten or deleted by any user. The StorageGRID S3 Object Lock feature does not support a governance mode, and it does not allow users with special permissions to bypass retention settings or to delete protected objects.

Sounds good!

> You cannot add or disable S3 Object Lock after the bucket is created. S3 Object Lock requires bucket versioning, which is enabled automatically when you create the bucket.

We probably want to use different buckets rather than "subdirectory" style tags, so that we can remove each of [mon,tue,wed,thu,fri,sat] buckets when they're >7 days old. Deleting a bucket with expired Object Lock (that is, on same day next week) would also delete all the versioning stuff inside of it and allow us to recreate it.

Otherwise, if we kept the buckets but only deleted their content (after Object Lock expires in 6-7 days), these buckets would keep growing because of [versioning](https://docs.netapp.com/us-en/storagegrid-116/s3/object-versioning.html). Because versioning must be enabled on Object Store-enabled buckets, we can't just turn it off and if the bucket is retained, versioning can keep up to 1,000 versions of each object.

I haven't tried to use Backup to S3 with Object Lock-enabled S3 yet, but it seems that using separate day-of-week buckets should work. One thing that I need to remember to check is what happens to Object Lock'ed items when they're overwritten 1,001 times. 

SolidFire's Backup to S3 doesn't understand versioning (it always works with latest/current version) so it'd be bad enough having to figure out which version of which object from the same backup to use, which is why I blog a lot about other approaches (Velero, Restic, etc.). To prevent that, it may be worth checking if append-only ACL rules could be created to ensure no multiple versions of objects get created in those buckets, but at the same time keep in mind that ACLs can be changed by the person who set them, so in this case we should use another tenant account to set those - not the account whose S3 credentials are used to backup to S3.

SolidFire's Backup to S3 is a very basic backup feature similar to what you might get for free in the public cloud, but those who consider it good enough may want to store weekly or daily backups to Object Lock-enabled buckets.

## Practical observations

In June of 2022 I found some time to play with this in practice.

I went back to Wasabi, which I [evaluated](/2022/01/19/solidfire-backup-restore-wasabi-s3.html) with SolidFire Backup to S3 in January 2022.

Create an S3 Object Lock-enabled bucket, and a dedicated backup account that you plan to use for SolidFire Backup to S3. 

- Bucket: `solidfire-object-lock-backup`
- First account, for production cluster: `arn:aws:iam::100000153021:user/solidfire-prod-tw-1`

### How many S3 objects or accounts do we need

Should we have one bucket per cluster, or per volume, or per backup account? I think there's no right or wrong way here - it depends on how you plan to use S3 Object Lock. 

If you have independent users (say, application owners) who run own backups, there's no reason to use one account or one bucket for everyone. If there's one team or person in charge of all backup for all services, it may not make much sense to have hundreds of buckets and accounts, so maybe use one account and one bucket per cluster.

In my example above, I have one S3 Object Lock-enabled bucket for all SolidFire-to-S3 backup, and one account per cluster (solidfire-prod-tw-1, solidfire-test-tw-1, solidfire-dr-tw-2, etc.).

The Wasabi KB has good [articles](https://wasabi-support.zendesk.com/hc/en-us/articles/360000016712-How-do-I-set-up-Wasabi-for-user-access-separation-), [FAQs](https://wasabi-support.zendesk.com/hc/en-us/articles/360058293052-Wasabi-Veeam-Object-Lock-Integration-FAQ) and best practices on how to use bucket access policies to let multiple users use the same bucket without risks: "main" admin manages the Wasabi account, and while backup admins can access only their own bucket or path within a bucket. In my case, I use paths like ${BUCKET_NAME}/${CLUSTER_NAME}-${CLUSTER_UUID}:

- Production cluster: solidfire-object-lock-backup/PROD-mn4y
- DR cluster: solidfire-object-lock-backup/DR-t2zk

Object Lock can't be enabled for existing buckets - it has to be done when a bucket is created.

![Wasabi - create Object Lock-enabled bucket](/assets/images/object-lock-01-create-bucket.png)

Enable Versioning and then Object Lock.

![Wasabi - create Object Lock-enabled bucket step 2](/assets/images/object-lock-02-create-bucket-step2.png)

If all objects within a bucket need locking, we can apply versioning and Object Lock to all buckets.

![Wasabi - enable bucket-level Object Lock](/assets/images/object-lock-03-enable-on-bucket-level.png)

### Determine suitable access policy

We need a policy that allows access to that path and optionally denies access to IPv4 addresses other than my on-prem IP address (2.2.2.2). You may want to be able to access the bucket from at least two IPs for DR purposes.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUserToSeeBucketListInTheConsole",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketCompliance"
      ],
      "Resource": "arn:aws:s3:::solidfire-object-lock-backup"
    },
    {
      "Sid": "AllowRootAndHomeListingOfCompanyBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::solidfire-object-lock-backup",
      "Condition": {
        "StringEquals": {
          "s3:delimiter": "/",
          "s3:prefix": [
            "",
            "PROD-mn4y/"
          ]
        }
      }
    },
    {
      "Sid": "AllowListingOfUserFolder",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::solidfire-object-lock-backup",
      "Condition": {
        "StringLike": {
          "s3:prefix": "PROD-mn4y/*"
        }
      }
    },
    {
      "Sid": "AllowAllS3ActionsInUserFolder",
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::solidfire-object-lock-backup/PROD-mn4y/*"
    },
    {
      "Sid": "IPAllow",
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::solidfire-object-lock-backup/PROD-mn4y",
        "arn:aws:s3:::solidfire-object-lock-backup/PROD-mn4y/*"
      ],
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": "2.2.2.2/32"
        }
      }
    }
  ]
}
```

I haven't tested accessing this bucket from other IPs or by other users, but I tried to make other buckets and was unable to do so (as expected):

```
Unable to make bucket `test`. 
  User: arn:aws:iam::100000153021:user/solidfire-prod-tw-1 is not authorized to perform: 
  s3:CreateBucket on resource: arn:aws:s3:::test
```

What follows is some screenshots of the process.

First, create an account.

![Create dedicated backup user account](/assets/images/object-lock-06-create-dedicated-backup-user.png)

Then optionally a group, or join existing.

![Create dedicated backup group](/assets/images/object-lock-07-create-dedicated-backup-group.png)

If you have ready-made policies, apply them to the account. You can also apply a policy on the bucket.

![Create or assign access policies](/assets/images/object-lock-08-assign-access-policies.png)

Create account credentials.

![Create access/secret key pair](/assets/images/object-lock-09-create-access-key-for-backup-account.png)

Get account details to use it in new bucket policy, for example.

![Get account details](/assets/images/object-lock-10-get-backup-account-details-for-policies.png)

Admin account cannot delete bucket data from the Web UI.

![Atttempt to delete bucket with Object Lock](/assets/images/object-lock-16-delete-bucket-attempt.png)

Account admin cannot delete backup bucket from the Web UI.

![Error when deleting bucket with Object Lock](/assets/images/object-lock-17-delete-bucket-attempt-nope.png)

### Backup job tagging and Object Locks

SolidFire Backup to S3 also worked as expected. Related to the choice of paths, I added a nametag `sat` (for Saturday) to the first volume (Name: ephemeral, ID: 571) I backed up, which made the bucket look "cleaner" as there was nothing but a VOL_NAME-VOL_ID sub-path to see (backup metadata and data was inside this path) at first level underneath solidfire-object-lock-backup/PROD-mn4y/.

```
$ mc ls wasabi/solidfire-object-lock-backup/PROD-mn4y/
[2022-06-25 15:10:42 CST]     0B ephemeral-571/
```

Without that nametag, backup metadata (for volume solidbackup-sb04, volume ID: 414) appears in the same level, and multiple backups of the same volume done this way would obviously overlap (current backup would overwrite last).

```
$ mc ls wasabi/solidfire-object-lock-backup/PROD-mn4y/
[2022-06-25 15:51:27 CST]     0B solidbackup-sb04-414
[2022-06-25 15:52:17 CST]     0B ephemeral-571/
[2022-06-25 15:52:17 CST]     0B solidbackup-sb04-414/
```

So, the first approach with tags lets you keep multiple backups, but uses more space in the bucket.

Backup step:

![Backup SolidFire volume to Wasabi](/assets/images/object-lock-11-run-solidfire-backup-to-s3.png)

Review backup job:

![Review backup job results](/assets/images/object-lock-12-review-solidfire-backup-to-s3.png)

Check the backup bucket in the  Wasabi Web UI:

![Backup bucket](/assets/images/object-lock-13-review-solidfire-backup-bucket-content.png)

Now, can the backup account delete these "locked" objects? Of course - we allow that in bucket permissions. Here I deleted SFManifest.2022-06-25T07.41.23Z from one of the backups, and the original object got versioned `v1`, while deleted object (empty object) became `v2`.

```
[2022-06-25 15:41:26 CST]     0B 001656142885838221279-3H9ZjwCPvu v1 PUT SFBackupStartRecord.2022-06-25T07.41.23Z
[2022-06-25 15:53:09 CST]     0B 001656143588544925576-yew8KcbBsr v2 DEL SFManifest.2022-06-25T07.41.23Z
[2022-06-25 15:51:27 CST]  90KiB 001656143486994920876-PV7bDzMG_Y v1 PUT SFManifest.2022-06-25T07.41.23Z
[2022-06-25 17:44:30 CST]     0B segments/
```

This is and isn't a problem.

Imagine taking seven daily backups to the same path (which happens when tags aren't used): many objects will have seven versions. Not these "date-in-object-name" objects, but objects with backup data. 

Also imagine someone deleting some of the objects. Restores would obviously fail because SolidFire can't read any but current version of an object. This can be fixed by restoring old versions, but who's going to do the fixing and figure out which of 128 versions of one object, and 125 versions of the other object should be restored? 

We could also restore older versions to get to a specific version of older backup (if we didn't use tags, and let latest backup overwrite the previous one), but that would be just as painful and any interference (through malicious overwrites) would make this recovery more complex and harder to automate.

For what it's worth, even Veeam seems to be unable to handle such tampering. While S3 Object Lock ensures objects can't be deleted before they expire, it does break software that relies on being the sole manipulator of objects and versions.

Earlier we saw that other accounts cannot delete the bucket or data in path that belongs to this account, so the risk seems very limited, and - with some work - you can get to old versions of deleted or chagned objects.

Screenshot of a deleted object:

![Delete object with Object Lock](/assets/images/object-lock-14-delete-locked-object-as-backup-user.png)

View deleted object:

![Version of deleted object](/assets/images/object-lock-15-view-deleted-locked-object.png)

You're right, we can't! Because, as explained earlier, the current version of the object has been deleted, it's not viewable. You'd need to use the CLI as above, or S3 browser that can show older versions.

### Compliance vs. governance mode

To illustrate the point about compliance mode, here's the difference:

![Wasabi - difference between compliance and governance mode](/assets/images/object-lock-04-compliance-vs-governance.png)

Compliance lock can be enabled at a later time (if the case of a lawsuit, for example):

![Wasabi Compliance Lock](/assets/images/object-lock-05-compliance-lock.png)

What does Wasabi Compliance lock do?

![What does Compliance lock do](/assets/images/object-lock-055-what-compliance-lock-does.png)

As some decisions made here can have a significant impact down the road, I'd triple-check my intended scenario with internal stakeholders and object storage software (or service) to make sure it works how everyone expects it to work.

### How to get to a point-in-time version of an object

At this point it seems Object Lock isn't that useful. Why not just enable versioning and call it a day?

Well, if you use Compliance mode, Object Lock *guarantees* that objects won't get deleted sooner than specified. In Compliance mode, that can't be changed. In Governance mode (if supported; StorageGRID 11.6 doesn't support it, for example), specific users (such as Wasabi account admin, for example) can change Object Lock retention period. Compliance mode is therefore safer, but it can result in very high costs that can't be reduced except by moving to another account and terminating existing account (if that's legally and technically possible).

The Wasabi Web UI can show older versions of objects (screenshot below, with no versions present), but to see deleted objects you probably have to use low level tools (which isn't [very pleasant](/2021/01/19/storagegrid-versioning-example.html)).

![Enable object version viewing in the Wasabi Web UI](/assets/images/object-lock-19-object-versions-in-wasabi-web-ui.png)

Older versions of overwritten or deleted objects can be also accessed with various user-friendly utilities and commands which parse object version information to be able to show objects as they were at some specific point in time. 

Say a backup bucket gets hacked on Sunday. Next Monday we use the "rewind" feature to the view the bucket as it was last Saturday afternoon, and copy point-in-time backup data to another bucket. But that may or may not work. 

In this screenshot "rewind" with point-in-time argument didn't work (could be a bug) so I had to use a simpler approach, which was to get to get all objects to the same version, in this case `v1` and that was easy because only one object had `v2`. This wouldn't be as much fun if I had 500,000 backup objects overwritten multiple times, resulting in thousands of different versions. This problem affects all backup software, not just SolidFire Backup to S3: the assumption is no one but backup software will mess with object versions.

Anyway, once v1 of all objects was restored, I refreshed S3 browser and see the formerly deleted object. At this point I knew I would be able to restore data to SolidFire volume as well.

![View older object version after versioning un-do](/assets/images/object-lock-18-rewind-object-version.png)

Interestingly, another attempt using relative time argument (`--rewind 1d`) did work (open in a new tab for a better view):

![Rewind view that works](/assets/images/object-lock-20-rewind-that-works.png)

With this working, I no longer need to care how many additional object versions may have been created or deleted by the hacker *after* last good backup was taken. I just want a rewind view of solidfire-object-lock-backup/PROD-mn4y/ephemeral-571/sat. I'm writing this on Sunday, so `--rewind 1d` shows the state of the `sat` subdirectory which is how I tagged my Saturday backup; tomorrow I'd use `--rewind 2d` to get the same result.

If a rewind data view of that path is recursively copied to another "rescue bucket" without Object Lock enabled, access to original backup bucket can then be frozen and its lock duration extended by a week or two, so that it doesn't get additionally messed up or have its data expire. At the same time, we can run antivirus and consistency checks on backup data restored from the "rescue bucket", prior to restoring that data to production systems. 

## Conclusion

I'd say that this for all practical purposes works - buckets and data cannot be deleted by other users, and even the backup user cannot delete them before retention period is over.

The way SolidFire Backup to S3 works is not space efficient - data from one backup are completely independent from data from another backup. But this also makes it possible to easily use S3 Object Lock, especially if we employ backup tags to store different backups to different (sub)directories. 

In the worst case stolen backup user credentials (to S3 bucket where SolidFire backs up data) can require a fair amount of effort to recover from, so it is probably a good idea to use multiple buckets and multiple S3 accounts (maybe even multiple S3 key sets, a different pair for each day in week).

Jobs that run SolidFire backup could store their credentials in Hashicorp Vault and be otherwise protected (run from a trusted and isolated "management" system, similar to what we discussed in the [post on Restic](/2022/04/03/restic-server-netapp-eseries.html)).

If you need efficiency or more advanced features, you can always use commercial backup solutions such as Commvault, Veeam, Kasten and so on.
