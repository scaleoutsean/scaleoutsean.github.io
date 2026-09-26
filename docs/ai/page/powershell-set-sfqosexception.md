# Set Temporary Storage QoS Policy for SolidFire Volume

A way to set temporary storage QoS policy on a SolidFire volume

Say we have a Volume ID 321 with a storage QoS Policy ID 5, and need to run a temporary job that would benefit from a different Storage QoS Policy (higher or lower, it doesn't matter).

With PowerShell we'd normally use `Get-SFVolume` to get current QoS settings (could be a dictionary of custom Min, Max and Burst values, or a Storage QoS Policy ID (integer)), store that somewhere and set a new policy (e.g. 7). After we're done we'd restore the previous QoS setting using `Set-SFVolume`. This is an "old school" approach that can be improved.

What if we had a way that didn't require maintaining a document with current settings, and looping through it to revert the changes? 

With `Set-SFQosException` (find the module in my Github repo Awesome SolidFire) we can do this:

```powershell
Set-SFQosException -VolumeID 321 -SFQosPolicyId 7
``` 

First we check the current Volume settings, find that Volume ID 321 uses QoS Policy ID 5, take that value and store it in volume attributes as `"SfQosId": "5"`.

Then we run our task - batch job, report, backup, QA test... After we're done, we run:

```powershell
Set-SFQosException -VolumeID 321
```

The second time there's no `-SFQosPolicyId`, so `Set-SFQosException` simply resets Volume QoS Policy to the value of `SfQosId` we stored earlier (SfQosId K-V pair from volume attributes is not deleted, to minimize API work). That's it!

To make it simple and robust, it comes without the ability to work with Volumes with Custom Storage QoS Policy.

There may be some quirks (especially if you screw around with QoS policy in between the two steps above), but it seems to work and I find it much better than the old school approach.

Of course you could use the same approach from your own code. Just be careful to not step on other apps' toes - for example NetApp Trident stores some KV pairs into volume attributes as well (`SFQoSId` doesn't conflict with those).
