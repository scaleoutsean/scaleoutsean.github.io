# Find unused S3 (access) keys and accounts on NetApp StorageGRID

When you need to know who is *not* using...

<!-- TOC -->

- [Problem](#problem)
- [What to do](#what-to-do)
- [Approach A](#approach-a)
  - [Delete access key by id](#delete-access-key-by-id)
  - [Delete access key by displayName](#delete-access-key-by-displayname)
- [Approach B](#approach-b)
- [Risks](#risks)
- [Summary](#summary)

<!-- /TOC -->

**NOTICE**: all credentials and tokens on this page are samples, not leaked.

## Problem

Users apply for - or get given by default - an S3 key pair.

Then they don't use it. And on top of that they may keep these access keys in a text file on their device.

What's even worse, that key may be able to access shared resources, so "why bother, I don't have any data on StorageGRID?" isn't always a solution. We need a better one.

What now?

## What to do

First, StorageGRID lets you create keys that expire. This sounds good, as those who aren't using S3 service probably won't remember to renew them either (great!), but tenants who do use their keys must remember to renew them which can be tricky in unruly environments.

Second, there's the option of nuking certain keys (and we can nuke both those that expire, and those that do not) from the UI. The problem with this is you don't know which keys to nuke.

The third approach is to automate. StorageGRID lets you delete S3 keys via the API. You can do it for the current user (i.e. yourself) but also for other users if you administer them. And if you only knew who's not using, you could periodically nuke their keys. Let's take a closer look.

## Approach A

As an example, I can get my own (current user's) keys with: `GET S3 /org/users/current-user/s3-access-keys`.

```sh
curl -X GET https://2.2.2.2/api/v3/org/users/current-user/s3-access-keys \
  -H  "accept: application/json" \
  -H  "Authorization: Bearer 7ca23478-6c5b-4857-a5b4-05555a0db7d4" \
  -H  "X-Csrf-Token: 60eeb0a4f1a83eca23a1179f350147a7"
```

For users whom we administer, we'd just use the API method that replaces `current-user` with `{USERNAME}`.

The response we get looks like this:

```json
{
  "responseTime": "2021-12-10T07:21:36.665Z",
  "status": "success",
  "apiVersion": "3.3",
  "data": [
    {
      "id": "SGKHEbfqjmQO0aPw0w0diRiVqsnqS7YT4IaKpmI2hA==",
      "displayName": "****************JEHS",
      "accountId": "21889316281388180360",
      "userURN": null,
      "userUUID": "00000000-0000-0000-0000-000000000000",
      "expires": "2021-12-15T18:02:00.000Z"
    },
    {
      "id": "SGKHGLoygSpt1_fC6jS1hRXUt2XZ6of2Md7EDz14eg==",
      "displayName": "****************XHU8",
      "accountId": "21889316281388180360",
      "userURN": null,
      "userUUID": "00000000-0000-0000-0000-000000000000",
      "expires": null
    },
    {
      "id": "SGKHhH2v68qlfSCAkeDygHnSVrurjf-kIYx8ayRImA==",
      "displayName": "****************D1P4",
      "accountId": "21889316281388180360",
      "userURN": null,
      "userUUID": "00000000-0000-0000-0000-000000000000",
      "expires": "2021-12-23T17:01:00.000Z"
    }
  ]
}
```

By the way, notice that some have `expires` set to `null`. Those keys are set to never expire.

But what the heck - how on earth can I know what key to delete with all those ***'s redacting most of access key ID?

Turns out `id` can be used as well. Why is displayName redacted, and ID isn't if they're equally sensitive? Maybe because `displayName` shows in the Web UI and the API is designed to not expose it, while `id` can be obtained only via the API.

The other problem is there's no `lastUsed` in response to let us know when a key was last used.

To delete the suckers we need to figure out complete `displayName` (such as `S7IJY5CWU1WQ3ZU9JEHS`) because the API won't accept partial info, or pass the `id` value. And we also need to know which keys to delete.

### Delete access key by id

It's easy with `DELETE /org/users/{USER}/s3-access-keys`:

```sh
curl -X DELETE https://2.2.2.2/api/v3/org/users/current-user/s3-access-keys/SGKHEbfqjmQO0aPw0w0diRiVqsnqS7YT4IaKpmI2hA== \
  -H  "accept: application/json" \
  -H  "Authorization: Bearer 7ca23478-6c5b-4857-a5b4-05555a0db7d4" \
  -H  "X-Csrf-Token: 60eeb0a4f1a83eca23a1179f350147a7"
```

But the problem is we don't know *which* key(s) to delete... So this doesn't really help.

### Delete access key by displayName

So, how to *find* the complete access key in the first place? Get this info from StorageGRID audit logs.

```raw
[AUDT:[RSLT(FC32):SUCS][CNID(UI64):1639144425523549][TIME(UI64):2751][SAIP(IPAD):"1.2.3.4"][TLIP(IPAD):"1.2.3.4"][S3AI(CSTR):"21889316281388180360"][SACC(CSTR):"sean"][S3AK(CSTR):"P20QGGHKI3GAYW24XHU8"][SUSR(CSTR):"urn:sgws:identity::21889316281388180360:root"][SBAI(CSTR):"21889316281388180360"][SBAC(CSTR):"sean"][S3BK(CSTR):"logs"][S3SR(CSTR):"location"][AVER(UI32):10][ATIM(UI64):1639144425532503][ATYP(FC32):SGET][ANID(UI32):12926021][AMID(FC32):S3RQ][ATID(UI64):9983709913644271547]]
```

We find `[S3AK(CSTR):"P20QGGHKI3GAYW24XHU8"]`, which matches `XHU8` (the second access key from the JSON response above). And audit logs have timestamps. So now we know *that* particular key has been used recently.

Now we can do something like this:

- get a list of all S3 access entries in the past X days
- create a list of *used* keys such as [P20QGGHKI3GAYW24XHU8, D1P4D1P4D1P4D1P4D1P4D1P4]
- get a list of all user accounts and loop through it
  - get a list of all keys for an account
  - loop through the unredacted part of the key from (`JEHS` is the first key in the JSON response) to see which of them have no matches in the list of S3 access keys used
  - build a list of unused keys (or build a list of unused keys for the tenant, or multiple lists - one for each tenant account and user with unused keys)

Although we wouldn't match on the entire access key, you'd need close to 36^4 keys to find two access keys with the identical last four alphanumeric characters. I don't think any StorageGRID account has more than 36^3 valid (i.e. unexpired) keys.

Once you know who's not using and what keys they're not using with (one-key list [S7IJY5CWU1WQ3ZU9JEHS], in this case), go through that list and nuke their unused key with `DELETE /org/users/{USER}/s3-access-keys`. In the following example I use the API method that nukes my own unused key.

```sh
curl -X DELETE https://2.2.2.2/api/v3/org/users/current-user/s3-access-keys/S7IJY5CWU1WQ3ZU9JEHS \
  -H  "accept: application/json" \
  -H  "Authorization: Bearer 7ca23478-6c5b-4857-a5b4-05555a0db7d4" \
  -H  "X-Csrf-Token: 60eeb0a4f1a83eca23a1179f350147a7"
```

Of course, you probably wouldn't use bash and curl to automate, and you're free to implement less extreme measures. And you can use key `id` instead of `displayName`, as we saw the API accepts either value.

With ADS-backed accounts you could send the account owner an email, etc. Or notify their tenant manager.

We could throw in some smartness about `expires`. For example, if an unused key expires in less than 30 days, it may be easier to just let it be than force users to delete hundreds of such keys.

## Approach B

A better way that requires a bit more effort and infrastructure:

- use an audit log coverter to feed StorageGRID audit logs to your log monitoring and analytics platform
  - you could use (or modify) [SGAC](/2021/10/20/sgac-storagegrid-audit-log-converter-v0.2.1.html) for this, but you could also extract just the dates and keys from audit.log and feed them to a separate index solely used for this purpose
- feed results of scheduled StorageGRID API queries S3 to the same place
- create a dashboard or CSV report that tenant managers (and tenants?) can visit any time

Not everyone has to be able to access the report, or see the entire key ID (we can still use displayName the way StorageGRID Web UI does it).

An [earlier version](/2021/08/09/sgac-storagegrid-audit-log-converter-v0.1.html) of SGAC used to export logs in the CSV format and for those without Elasticsearch or Splunk this could be an easy way to create these reports in SQL or Excel without access to sophisticated logging infrastructure.

## Risks

Remember to test carefully - we wouldn't want to nuke active keys, right?

Proposed solution B moves the responsibility for deleting keys onto tenant admins or even users (because they can delete their own key), and since all our audit logs are available for easy querying it's also easy to confirm the validity of a report before deleting a key.

At the same time, because inactive key deletion is delegated to tenant admins or even tenants themselves, it's relatively easy to recover from accidental deletion:

- it'd involve fewer tenants, accounts, and keys (and not be grid-wide)
- the same person who deletes the key may be able to quickly recreate and replace their deleted key

If there's constantly too many such unused keys, we should probably examine why we have this problem in the first place, or for ad-hoc keys introduce a mechanism for quick expiry and easy self-service renewal/refresh so that users entitled to use S3 service can get new key pairs issued quickly and conveniently which may help prevent over-issuance based on "just in the case you need it" reasoning.

## Summary

If we want to find unused S3 keys on StorageGRID, we need to
- find unexpired keys issued to a user
- check StorageGRID audit logs to eliminate keys that have been used, as the StorageGRID 11.5 API does not provide information on when or if a key was used. (Users with a TLS-terminating reverse proxy could get the information from proxy logs, which is similar to StorageGRID audit log).
- once we eliminate all keys that have been used, what's left is keys that haven't been used and those can enter your preferred workflow (delete, send reminders, etc.)
