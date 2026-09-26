# Comparison between S3 object versioning and WORM with NetApp StorageGRID

What is S3 versioning, what is WORM and can they be used for the same purpose

## Terms

- Versioning in the S3 API is a means of keeping multiple variants of an object in the same bucket, according to AWS.
- WORM is a generic concept and stands for "Write Once, Read Many". In data storage it describes the ability to create indelible files and directories. Obviously, with S3-compliant storage, that translates to paths/keys.

What's common to both is it's possible to use them to prevent accidental deletion.

## Versioning

Versioning is allows keeping and access to previous revisions of an object (e.g. `GET object.mp3?v=2` gets revision #2 of the object). 

*If* users are allowed to overwrite objects, but are *not allowed* to delete old versions (not the default!), then objects practically become indelible to general users.

But each revision is a copy that takes up disk space, so the benefit of versioning should be higher than its cost. Otherwise we should consider WORM or some other approach.

One popular feature used in conjunction with S3 versioning is S3 Object Lock with specified retention, which guarantees retention until a certain date, but unlocks and allows deletion of older objects - very useful for backups that need to be ransomware-resistant as long as they're needed.

But even without any of these tricks, the versioning feature protects files from accidental deletion or change, as you can always GET object.mp4?v=2 and re-upload it to recover from deleting the object or uploading a wrong revision 3.

### Versioning and compliance

Can a user delete a non-current version of an object? Sure!

As mentioned earlier, S3 versioning prevents accidental deletion of S3 data:

- Original (and current) revision is overwritten by another object, or even "deleted"
- The original object version now becomes revision #1, while the new object becomes revision #2 and "current" version of the object. Even if the original object was deleted, revision #2 would become current (non-existing object).
- If we delete revision #1 now, it's no longer possible to recover it

That's what's happening in this screenshot. 

We can see that s3access.txt was deleted, so the current version (revision #2) doesn't exist, while the first/original revision #1 is also being deleted. After that it will no longer be possible to recover s3access.txt.

![Deleting older version](/assets/images/storagegrid-versioning-delete-old-version.png)

Compliance is another feature that *ensures* that non-current versions cannot be deleted. Versioning enables the creation of revisions, while compliance prevents the deletion of revisions.

If you're wondering about the relationship between Object Lock with S3 versioning and how it compares with legacy "Compliance" feature of StorageGRID, see [the docs](https://docs.netapp.com/us-en/storagegrid-117/ilm/managing-objects-with-s3-object-lock.html) for that.

Versions allow other interesting features, such as the ability to easily restore an object from an older version (as soon as you know there is an older version). We may also use download older revisions for local processing, which is similar to using files from filesystem snapshots.

![Other operations with versions](/assets/images/storagegrid-versioning-restore-old-version.png)

## WORM

"Software WORM" or ACLs-based WORM is simpler: it aims to prevent users from modifying and deleting existing objects.

To do that we craft a bucket policy that denies the use of those API methods to non-admin.

Let's say we have a bucket `wormbucket`. In our [bucket policy ACL](https://netapp.io/2017/07/21/worm-s3-buckets-storagegrid-webscale-updated-july-2017/) we would first Allow - in one or more rules - access to whomever needs it, and then Deny certain operations that we want to prevent.

In this case those may be `s3:PutOverwriteObject`, `s3:DeleteObject` and such. 

```json
{
   "Effect":"Deny",
   "Principal":{
     "SGWS":["11111111111111111111"]
   },
   "Action":[
     "s3:PutOverwriteObject",
     "s3:DeleteObject",
     "s3:DeleteObjectVersion",
     "s3:PutBucketPolicy"
   ],
   "Resource":[
     "urn:sgws:s3:::wormbucket",
     "urn:sgws:s3:::wormbucket/*"
   ]
}
```

Obviously, this isn't as robust as compliance (where even administrators cannot delete objects), but it's good for many purposes including the prevention of accidental modification or deletion of files/objects by regular users and - unlike versioning - does not take extra storage space.

We could prevent users from deleting versioning-enabled objects by also taking away their ability to `s3:DeleteObjectVersion` or by enabling Compliance on the bucket, but it would make [previous versions harder to find](/2021/01/19/storagegrid-versioning-example.html) and it would likely use more storage space.

With WORM, if any of the operations from Deny list is attempted in a bucket where deletes are denied they simply fail. 

Here we can see two overwrites and two delete attempts failed.

![WORM disables overwrites and deletes to non-admin users](/assets/images/storagegrid-worm-overwrite-delete.png)

## Demo

In this demo two buckets are created, one with versioning enable, and another with WORM-like ACLs, and then several basic operations (PUT, GET, DEL) are performed.

- [Comparison between S3 versioning and WORM using NetApp StorageGRID](https://rumble.com/v313be0-how-versioning-and-worm-like-acls-work-on-netapp-storagegrid.html) - 3m53s

## Conclusion 

Versioning and ACLs-based WORM are different features that sometimes can be used for the same use case.

Even then, though, one may be more appropriate than the other, depending on the requirements.
