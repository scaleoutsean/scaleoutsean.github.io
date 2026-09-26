# Tenant (account) attributes on NetApp SolidFire

Make use of storage account attributes on NetApp SolidFire

## It took me a while

It took me only 6 years to figure out that NetApp SolidFire account object has user-writable attributes.

Volume objects also have attributes, of course, and they're actively used, for example by NetApp Trident, and by my Set-QoSException module. 

In this screenshot you can see how `fstype = xfs` is being used to help us identify filesystem (which can be useful in backup and replication workflows, for example).

![](/assets/images/solidfire-tenant-account-attributes-02-volume-attrs.png)

## What about it

Well, it's at the very least *interesting* that the feature is available for accounts as well.

Just last week I blogged about "backup to S3" and we could [observe](/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html#progress) that SolidFire bulk volume jobs also have attributes, but not write-able. Unless you check - by trying to set them - you wouldn't necessarily know they can be modified by storage administrators.

Also:

- It's surprising to me that no one has come up with any use cases for this
- It's surprising to me that I've never heard of this possibility which means very few people outside of SolidFire Engineering knew about this
- No one has experimented or wrote about it (unsurprisingly, this one)

(And all that aside, this is yet another example that it takes years to become good at something.)

How do account attributes look like? The same as volume attributes. 

![](/assets/images/solidfire-tenant-account-attributes-01-get-set.png)

- (1) - Get-SFAccount to get them, Set-SFAccoun to set them
- (2) - You *must* be careful when handling Get-SFAccount because Initiator and Target secret are included in response
- (3) - In this example I used `handsome=true`

## What's it good for

That's up to us. 

Let's say we use (multiple) Kubernetes or Docker (Compose) and deal with tenants (storage accounts) rather than particular volumes. In a vSphere environment we'd likely use one tenant (vSphere), so we wouldn't deal with individual tenants.

Now in order to automate certain parts of our operations, we may be able to use account attributes rather than build a small PostgreSQL database just to store 5 KB of text.

Get volumes used by Account ID 1, create attributes object and stuff it into the account's attributes.

```powershell
PS > $cg = (Get-SFAccount -AccountID 1).Volumes # $cg = (1,2)
PS > $backupattrs = @{"s3"=$True;"fromSnap"=$True;"cg"=$cg}
PS > Set-SFAccount -AccountId 1 -Attributes $backupattrs -Confirm:$False

AccountID          : 1
Username           : test
Status             : active
Volumes            : {1, 2}
Attributes         : {[s3, True], [cg, System.Object[]], [fromSnap, True]}

```

That's it! Note that the value of `attributes['cg']` is an object itself (a list, in this case). 

Now when we run our weekly scheduled backup, rather than backing up all accounts' data, we can easily find out which accounts want to backup to S3 (`s3 = True`) and if I should backup all their accounts or just a Consistency Group. Here CG is (1, 2) which tells me to backup volume IDs 1 & 2. 

FromSnap=True tells me to use the latest snapshot I can find, rather than rely on ad-hoc snapshots. This is useful if snapshots are taken in a consistent manner (which is the case of Group Snapshots).

That's enough to schedule backup-to-S3 jobs when I loop through Account ID 1:

```powershell
PS > foreach 
   ($vol in (Get-SFAccount -AccountID 1).Attributes.cg) 
   { Write-Host "Backup Volume ID $vol to S3" }
Backup Volume ID 1 to S3
Backup Volume ID 2 to S3
```

Account ID 1 could even tell me which S3 to backup data to; assuming my backup script had access to a vault, "s3dest=us-east-1" would tell me to backup there, and "dest=(site1,site2)" would tell me to backup twice, once to each site. 

Given a simple [Ansible script or Web UI with RBAC](/2022/02/14/middle-class-rbac-solidfire-ansible.html), tenants could update all these details and I wouldn't need to be in the loop - I'd just send my logs to Elasticsearch or other place for them to observe my work.

Other use cases may be related to disaster recovery and business continuity - anything where a few bytes of settings can replace the cost and complexity of a full-fledged management system.

## Why not use "proper" database

What *is* a proper database? 

In [this post on using InfluxDB](/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html) hosted in public cloud I mentioned the possibility of using it as the single source of truth for which volumes are backed up when and where. 

That will work, and even with multiple SolidFire clusters (PROD & DR, for example) we'd have a database in the third location, so we'd be able to look up key details when automating recovery from backup or disaster.

But there's a cost associated with managing databases. Even InfluxDB OSS needs to be hosted, secured, backed up, etc. You also need a front-end, security, auditing, etc. and you may already have solved all of that for SolidFire.

SolidFire's volume and account attributes aren't "databases", but they are "micro database tables" and doing one IO per minute (which would be extremely frequent, as far as updates to attributes are concerned) is definitively not going to overwhelm the SolidFire API.

A proper database, sure, but it'd better be worth $10-$20 K/year!

If you need just basic info and don't want to manage it separately from storage, volume and account attributes may be enough.

## Account attributes in JSON

If you're used to JSON, here's how $backupattrs above look like in JSON:

```json
{
  "s3": true,
  "cg": [
    1,
    2
  ],
  "fromSnap": true
}
```

You can create them by hand, in any CLI or in static Web pages with JavaScript support. If working in the CLI this "backup-attrs-JSON" aka `$baj` is converted to PowerShell like so.

```powershell
PS > $backupattrs = ($baj | ConvertFrom-Json)

  s3 cg     fromSnap
  -- --     --------
True {1, 2}     True
```

## Conclusion

SolidFire's account attributes give us another option for enhancing storage DR, BC and data protection management workflows with minimal effort and without any additional cost.

Volume attributes - as one might imagine - can store volume- and application-related (i.e. data-related) metadata. We could even store last successful backup time in volume attributes and use that in monitoring and reporting.

Account attributes help us address other use cases, where we're concerned with tenant-related storage services, preferences and options. A static Web site with preferences can give users a way to generate attributes and use Ansible or PowerShell or Python CLI to apply them (or have the SolidFire admin apply them for them).

Both can be nicely automated and are very easy to manage.
