# How to create StorageGRID object path-based ILM rule

How to put together a rule and policy for object path-based ILM rule

Say you have a bucket called `junk` with "directory tree" (not really but...) several levels deep (`junk/lev1/lev2`) and want to do some ILM stuff on the stuff in one of those subdirectories.

![Bucket junk with one or more levels of subdirectories](/assets/images/sg-ilm-rule-for-path-filtering00.png)

Of course, you'd create a new ILM rule and apply it in a policy.

To narrow down potential matches, administrator creates a policy for this tenant (named `s3`) and the bucket named `junk`. In it, we say if object name (aka `key`) contains `lev1/lev2/`, match it.

![Bucket junk with one or more levels of subdirectories](/assets/images/sg-ilm-rule-for-path-filtering01.png)

Put together, that becomes `junk/lev1/lev2/`. Now, that's a *CONTAINS* condition, so you'd better hope you didn't forget that last `/` and at the same time have something like `junk/lev1/lev2-IMPORTANT/` in there.

Anyway, once that's in place we need to decide want to do with the stuff that matches this and create a policy to include this rule.

Before we put that policy in effect we can simulate it, which shows that `junk/lev1/lev2/junk.file` matches the rule.

![Bucket junk with one or more levels of subdirectories](/assets/images/sg-ilm-rule-for-path-filtering02.png)

You may want to ensure no other stuff gets caught in this rule and that the same tenant, `s3`, knows what kind of matching is in place. The rule only matches against that tenant and that bucket, so other users and other buckets would not be affected.
