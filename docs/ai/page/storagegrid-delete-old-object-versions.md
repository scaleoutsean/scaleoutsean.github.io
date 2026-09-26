# Delete old object versions on NetApp StorageGRID

How to delete old object versions on StorageGRID 11

## Introduction

You may have object versions you don't want to keep. Or you know you don't want to keep older versions in some bucket.

Why? That's not important right now.

The question is - how? 

You can use S3 client utilities or S3 API, but you can also configure StorageGRID to do that for you. I used version 11.8 for this. 

## What needs to happen

Since the docs made me waste two hours on this, I am creating a post and this is the key part of it:

Point 1: If a bucket has versioning enabled, then **after the first screen/modal** in the ILM new policy wizard (on StorageGRID v11.8) , you can select to perform operations on non-current object versions.

Point 2: Once you get to that part (which is the second step in ILM rule wizard), you need to retain these objects **for X days** rather than remain stuck on "forever" (default).

Point 3: With that new rule in place, you can now create a new ILM policy that includes that rule. Since this rule is for non-current object versions, if you "don't have anything to add" (in terms of other conditions) you don't need to do anything else. Which means:
  - If you are happy with your current default policy (whatever it is) you may go to ILM Policy, clone that policy, edit the clone and **add the new rule** for non-versioned objects (mentioned just above). Then apply the clone to have a new grid-wide default policy that is the same as the original one but deletes non-current objects older than 7 days. For this your new ILM rule should probably not use some specific tenant or bucket name.
  - If you also want to fiddle with the current default policy or delete non-current object versions for a custom (non-default) policy, you may create a new one and in the process add to it the new rule for non-versioned objects

Please check the StorageGRID documentation for their recommendations for ILM policies. 

Personally I'd try to create custom rules with a constrained scope (limit to certain buckets or maybe tenants, or a combination of both) than apply a rule globally and then having to create new ILM rules every day in order to *avoid* the default rule that doesn't make sense for everyone.

## How to do it

Now that you understand what happens the stuff below is optional, but I took screenshots for those who are still confused. Although, if the 3 points above aren't clear enough, I'd recommend re-reading those rather than looking at the screenshots.

With that said, let's move on.

### Create a bucket with versioning enabled and an ILM rule to delete older versions

Create a new bucket if you don't have it already. If you do have it, enable versioning. 

**WARNING**: versioning in a bucket with large objects may eat up a lot of space.

![](/assets/images/sg-versioned-retention-01.png)

Here's a bucket with versioning enabled. My bucket is called "versioned" (that's the actual bucket name).

![](/assets/images/sg-versioned-retention-02.png)

If you just created a new bucket, it's probably empty. Upload some junk data to create versions. 

![](/assets/images/sg-versioned-retention-03.png)

Check the versions in your client/API console/whatever. 

I'm using the Web UI as Grid Manager here. Tenant Manager can't create ILM rules. 

Create a new rule and if you're targeting some specific bucket (I am), you can enter the bucket name or tenant name.

![](/assets/images/sg-versioned-retention-04.png)

You may choose to apply the rule on existing objects if you want. I have 2 versions of my object but they were both created today, so I won't be able to see the effect of that regardless of what I choose - neither is more than 7 days old. But if you have versions older than 7 days, you may choose Yes.

![](/assets/images/sg-versioned-retention-05.png)

This right above is the silly part of the UI *and* the documentation where I got stuck for 20 minutes. You need to press **Continue** as you won't see anything related to non-current versions. 

It is the step after that where you will see "Noncurrent time"! And then change **store forever** to **store for** (and pick some value such as 7 (days)). Note that I also selected EC 2+1. You can use some other approach: as an example (this is what I used in simulation tests at the bottom of this post) you could have one rule to store 2 copies of objects for 0 to 7 days, and another rule to delete older versions after 7 days and store EC 2+1 after that.

![](/assets/images/sg-versioned-retention-06.png)

That will get rid of the matching (tenant, bucket, etc.) non-current object versions older than 7 days once you add this rule to an active ILM policy (next step). 

![](/assets/images/sg-versioned-retention-07.png)

Now we create a policy to include the new rule. As mentioned above (Point 4, read it again if you don't recall), you may or may not want a new default policy. Or even if you want a new default policy, maybe you want to create it by cloning existing default policy rather than creating one from scratch.

Here I'm going from scratch but not with a new default policy - notice this new ILM policy applies only to one bucket.

![](/assets/images/sg-versioned-retention-10.png)

I created 2 new rules, in fact, and I'll use both in my new custom policy for the bucket versioned:
- The first new rule in the screenshot below is called "EC2+1" simply uses EC2+1. This should catch all objects in the bucket "versioned"
- The second rule is meant to catch all non-current versions of objects in the bucket "versioned" (shown above) older than 7 days

![](/assets/images/sg-versioned-retention-18.png)

Now, when we use these rules, we want the second rule to be matched first in order to delete old junk.

### Create an ILM policy that employs the rule

When creating a new ILM policy, because I'm not changing the default policy, I will select those two rules. 

So either "delete this old junk" (the rule for non-current versions in the bucket "versioned" older than 7 days), or EC 2+1. Or - since StorageGRID's "2-Copy" policy is still the default that will catch all the other objects (that don't match the above two rules).

This is why in this scenario, the message tells us that we can have other rules **before** the default rule (which we don't need to select because it's ... well - the default).

![](/assets/images/sg-versioned-retention-11.png)

The wizard spots the deletion rule and warns us about this destructive rule. Triple-check to make sure the time and other criteria (in my case, bucket name) are correct.

![](/assets/images/sg-versioned-retention-12.png)

Now that the policy has been created, it is inactive. It is recommended to simulate any new policy on **several** objects to make sure it works like you think. 

![](/assets/images/sg-versioned-retention-13.png)

Use your S3 client, API, etc. to figure out version IDs of some sample object.

![](/assets/images/sg-versioned-retention-14.png)

### Simulate (test) your new ILM policy

We want to delete junk versions, so our scenario is:
- Try the current version of an object - should not be caught by the rule that deletes older versions
- Try a non-current version of an object older than 7 days

![](/assets/images/sg-versioned-retention-15.png)

In this example above **revision #1** should be deleted (version `MtdG...`) while version #2 (`MkEzO...`) should not.

**NOTE**: before you start looking below - these two screenshots below were **taken when the grid had just two policies**: 
- Default (Make 2 Copies) StorageGRID policy
- EC2+1 (which included a step to delete non-current versions in the bucket "versioned" that are older than 7 days and additionally save object using EC2+1). The earlier screenshots taken above included an additional policy just for EC 2+1.

Let's test the current version (v2). In this screenshot there's no 2nd ILM policy - there's just the "delete old junk versions in the bucket 'versioned'" policy, and, failing that, the default policy. This is expected behavior.

![](/assets/images/sg-versioned-retention-16.png)

Test an old non-current version, v1, so this object gets matched by the rule which catches such objects.

![](/assets/images/sg-versioned-retention-17.png)

From the above we can see that the same key (versioned/StorageGRID_CLI_Commands.txt) will be copied twice (Make 2 Copies) if it's the current version, or deleted (if it's a non-current version older than 7 days). 

Again, the way we created our policy to delete objects applies only to one bucket. If you created a policy that includes a tenant name or some combination of both, you would have to run more tests to match (and not match) various combinations of those.

## Demo 

- [Deleting non-current object versions on NetApp StorageGRID](https://rumble.com/v4f6ymc-deleting-non-current-object-versions-on-netapp-storagegrid.html) (7m6s) - shows a (perhaps) less confusing approach than these screenshots as this is a recording of my 3rd attempt to do it. Take a look if the post confuses you.

## Summary

I somehow made this to work (I guess), but it was **very confusing**. 

StorageGRID should really have ready-made inactive policies and rules so that people can simply apply those, or maybe clone them, edit and then apply. Since that's not available, [the documentation](https://docs.netapp.com/us-en/storagegrid-118/ilm/example-4-ilm-rules-and-policy-for-s3-versioned-objects.html) should have enough screenshots to make that process easy to understand. Well, neither is available. Maybe the assumption is the user is familiar with ILM, but that isn't enough because ILM for versioned objects doesn't work exactly like general StorageGRID ILM.

Other than that, everything seems to work as seen on TV.

I went through this process twice, which is why the simulation screenshots at the end are different from the ILM policy in other screenshots, but both approaches may be used. A way to use 3 policies would be:
- Non-current objects older than 7 days: delete them, and change protection to EC 2+1 
- For non-current versioned objects *younger* than 7 days and for all *current* objects, make two copies
- If neither matches, use the default policy (whatever it is)

If we wanted to store everything using the default policy and delete non-current objects older than 7 days grid-wide, then we could have just two rules - the first would find objects to delete, and the second would just use the default.

At some point this can become overwhelming so personally I would create new rules and policies very sparingly, only when I have to. 

Versioning is one such situation - if users need the feature you may need to enable it across the board, but you know that will also eat up a lot of space, so you need a wait to control that. 

If you have just one-two buckets with few thousand objects, maybe it's better to run a client-side script that deletes old versions:
- list all objects (for a few hundred) or paginate through objects
- if version is latest, leave the version alone
- else delete the object version

It's also possible to leave 2 versions combine multiple conditions (example: if there's more than 2 versions, retain 2 versions but only if neither is older than 14 days) - you can find those examples in the documentation.
