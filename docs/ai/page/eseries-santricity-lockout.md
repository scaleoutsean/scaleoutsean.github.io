# E-Series SANtricity Web UI lockout

Read this 1 post instead of 5 KB articles

## Lockout feature

The SANtricity lockout feature is good, but the poor documentation often makes it annoying.

You can configure it the way you want in SANtricity API.

From the Web UI go to API documentation (Swagger) or use some API client.

Confusingly, some lockout settings are in Administration, others in Storage Systems. Let's look at the first one.

```raw
https://santricity_a:8443/devmgr/docs/?#/Administration/set-lockoutSettings 

POST /storage-systems/{system-id}/settings/lockout
Update lockout settings.
```

Then you can shorten `lockoutTime` or increase `maximumLoginAttempts` or apply some combination thereof. 30s and 500 attempts:

```json
{
  "lockoutMode": "ip",
  "lockoutTime": 30,
  "maximumLoginAttempts": 500
}
```

If you hate the feature but still want to keep this it enabled for the case where there's an outrageous number of retries, you may pump `maximumLoginAttempts` to a large number (when `lockoutTime>0`, otherwise it makes no difference).

![Example of SANtricity lockout settings](/assets/images/santricity_lockout_01_setting.png)

## Automation and lockdown

Unmanaged lockdown settings can mess with your automation.

You can check lockdown status before (or after) trying to authenticate.

```raw
GET/storage-systems/{system-id}/lockdownstatus
```

This tells if you if the system is in lockdown status. This one is not.

```json
{
  "isLockdown": false,
  "storageSystemLabel": "sean",
  "lockdownType": "unknown",
  "sevenSegmentCodes": null,
  "hasDrives": true,
  "limitedAccessState": "none",
  "lockdownClearable": false
}
```

If `isLockdown` is false, continue. If not, log an error and sleep some time before retrying (hoping that lockdown tiem is not too long), or exit.

Active lockdown may be clearable.

```raw
POST /storage-systems/{system-id}/lockdownclear
```

You can call it from Swagger or other API client. If the system isn't locked down, nothing will happen.

```json
{
  "errorMessage": "System is not in lockdown state or the lockdown is not clearable.",
  "developerMessage": null,
  "localizedMessage": "System is not in lockdown state or the lockdown is not clearable.",
  "retcode": "invalidLockdownState",
  "codeType": "devicemgrerror",
  "invalidFieldsIfKnown": null
}
```

I haven't tried to lock myself out, but lockdown may not be clearable for your own account.

That would be another reason to not use `admin` account for routine automation. I recommend using `monitoring` for monitoring (in E-Series Performance Analyzer, for example). 

If you expect you may need to clear lockdowns urgently, better test the exact scenario and make sure it works.

## Password changes

If you need to automate password changes, you can use or reference my PowerShell script from my `eseries` repository on Github.

The API methods above can be combined with the script to effectively disable lockout feature before, and re-enable it after password has been successfully changed.

## `curl` examples

**NOTE:** use `-k` with snake oil certificates.

To get lockout settings, use basic (`-u user:pass`) or bearer authentication, depending on what the system is configured for. I use the latter.

```sh
curl -X GET \
 -H "Authorization: Bearer ${YOUR_TOKEN}"
 "https://santricity_a:8443/devmgr/v2/storage-systems/1/settings/lockout" \
 -H  "accept: application/json"
```

When setting this, provide JSON:

```raw
 -d '{ "lockoutMode": "ip", "lockoutTime": 0, "maximumLoginAttempts": 100 }'
```

You may need slightly different escapes for various client OS (refer to `curl` documentation). The examples above and below work for most. Don't forget to add your authentication params as examples below don't have them.

```sh
curl -X POST "https://santricity_a:8443/devmgr/v2/storage-systems/1/settings/lockout" \
 -H  "accept: application/json" \
 -H  "Content-Type: application/json" \
 -d "{  \"lockoutMode\": \"ip\",  \"lockoutTime\": 0,  \"maximumLoginAttempts\": 86400}"
```

Get lockdown status (**no** authentication needed):

```sh
curl -X GET "https://santricity_b:8443/devmgr/v2/storage-systems/1/lockdownstatus" \
 -H  "accept: application/json"
```

Clear lockdown (add authentication):

```sh
curl -X POST "https://santricity_b:8443/devmgr/v2/storage-systems/1/lockdownclear" \
  -H  "accept: application/json" \
  -d ""
```

Interestingly this command doesn't report failed authentication when `isLockdown=False`. I'd think that unauthenticated requests should be rejected even if `isLockdown=True` cannot be cleared without valid authentication. Nothing should be returned, in other words. But it appears that's not how it works in SANtricity 11.80.
