# RBAC and delegation for SolidFire JSON-RPC API with Lua

Use reverse proxy with Lua to work around SolidFire's lack of RBAC

- [Introduction](#introduction)
- [Fixing RBAC with a TLS-terminating reverse proxy](#fixing-rbac-with-a-tls-terminating-reverse-proxy)
- [Lua in reverse proxy path](#lua-in-reverse-proxy-path)
- [JSON-RPC](#json-rpc)
  - [Lua and JSON-RPC](#lua-and-json-rpc)
  - [Complicate things with custom APIs](#complicate-things-with-custom-apis)
- [How can we use this with Trident](#how-can-we-use-this-with-trident)
- [Conclusion](#conclusion)

## Introduction

As explained [here](/2022/02/14/middle-class-rbac-solidfire-ansible.html), SolidFire never implemented proper RBAC. 

That post also shows a workaround with Ansible (and Ansible Tower), but I haven't had time to revisit this issue for SolidFire users who don't use Ansible.

As a reminder, the main problem is that SolidFire's cluster admin has exactly the same permissions as admin2, so if you allow direct access to the API you can't add the second admin without increasing risk to the first admin (and the entire cluster). 

Normally you'd want to have not only two, but N SolidFire admins, where N is the number of departments or teams. But that would suck security-wise.

To be fair, I haven't received any asks to solve this either, so maybe nobody needs this anyway. 

But it's bean something that's annoyed me professionally over the years, so I've had the desire to get to the bottom of it one day.

## Fixing RBAC with a TLS-terminating reverse proxy

This is exactly how the Ansible RBAC workaround works - TLS terminates in Ansible Tower, and Ansible Tower - after checking the rules - talks to the  SolidFire API endpoint.

But, unlike with Ansible, in the case with a "generic" reverse proxy we have to find something that can help us create policies and enforce them.

## Lua in reverse proxy path

Lua, due to its presence in the NGINX ecosystem, is a popular choice for this type of thing.

Other options are possible, but let's just stick with the common one, say NGINX or NGINX+ (for those who want enterprise support) and Lua. The documentation is currently [here](https://github.com/openresty/lua-nginx-module#readme).

What we can do with Lua is create scripts, or bytecode, that NGINX uses to enforce our policies.

There are entire "Lua applications" to make that easier, such as Casbin, but for simple use cases you can get away with just Lua scripts. 

NGINX would load these scripts on startup and match JSON-RPC requests to the SolidFire API with the objective to enforce RBAC:

```raw
http {
	init_by_lua_block {
        local Enforcer = require("casbin")

    	-- Initialize a new enforcer at server start
        e = Enforcer:new("sf/rbac_model.conf", "sf/rbac_policy.csv")
    }
    lua_package_path "$prefix/lua/?.lua;;";

    server {
        listen 443 reuseport;

        location / {
            default_type text/plain;
            content_by_lua_block {

            }
        }
    }
}
```

As I just said, this doesn't have to be complicated.  But what does that mean? 

That means in some cases you don't need any RBAC here. All you need is to prevent accounts *other than* admin from reaching the API. That's all!

Consider the case where admin uses management network without any proxies, and other management accounts use other networks with proxies. Then one blanket filter can be applied across all proxies.

| Account |  Client IP  | Reverse Proxy | SolidFire API |
|---------|------------:|--------------:|--------------:|
|   admin1| 192.168.1.1 |  192.168.1.250|  192.168.3.10 |
|   admin2| 192.168.2.1 |  192.168.2.250|  192.168.3.10 |
|    admin| 192.168.3.1 |             - |  192.168.3.10 |

The above-mentioned Casbin can create full-fledged RBAC policies, so if we need to create those we can use Casbin. There are many ways to create segregation, but let's see one, RESTful-based.

SolidFire JSON-RPC requests are sent in HTTP headers, so we can't really use RESTful here. 

But such requests can be formatted like this, so let's imagine this is how people use the API - that will make this blog post easier to write. (For the record, I tried to make more complex URL-encoded API requests, but could not - I just couldn't get parameters' encoding right).

```raw
https://**********:**********@192.168.1.30/json-rpc/12.2?method=SnmpSendTestTraps
https://**********:**********@192.168.1.30/json-rpc/12.5?method=ListVolumeStatsByVolume

```

Now with Casbin's "subject, object, action" requests and policy definitions, we'd create a policy that allows access in the case of certain matches (we could also create one that disallows matches, for example). 

```raw
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
```

Let's say our SolidFire is on 12.5, we don't want the two team admins (Bob & Alice) to be able to create new accounts - we only want them to be able to see if a user is connected to cluster. There's also a monitor account which is read-only in the first place, but since accounts may container CHAP passwords, we don't want this account to have unrestricted GET access.

```raw
p, admin, /json-rpc/12.5?method=GetReport*, (GET)|(POST)
p, admin, /json-rpc/12.5?method=CreateAccount, POST
p, admin, /json-rpc/12.5?method=*, GET
p, admin, /json-rpc/12.5?method=SnmpSendTestTraps*, POST
p, alice, /json-rpc/12.5?method=ListActiveAuthSession*, GET
p, bob, /json-rpc/12.5?method=ListActiveAuthSession*, GET
p, monitor, /json-rpc/12.5?method=GetVolumeCount, GET
p, monitor, /json-rpc/12.5?method=GetVolumeStats*, GET
```

Next we could create some test scenarios (subject, object, action) and see how they evaluate. Here we'd want to see if subjects can get to objects they're supposed to using specific actions, and if other objects remain off-limits.

```raw
admin, /json-rpc/12.5?method=GetReport*, GET
admin, /json-rpc/12.5?method=GetClusterConfig*, GET
bob, /json-rpc/12.5?method=ListActiveAuthSession*, GET
monitor, /json-rpc/12.5?method=GetVolumeCount, GET
monitor, /json-rpc/12.2?method=GetSnmpInfo, GET
admin, /json-rpc/11.3?method=CreateAccount*, GET
admin, /json-rpc/11.3?method=GetReport*, POST
alice, /json-rpc/12.5?method=CreateAccount, GET
bob, /json-rpc/12.5?method=NewAccount*, POST
alice, /json-rpc/12.0?method=GetClusterConfig*, GET
alice, /json-rpc/11.5?method=GetClusterConfig*, GET
bob, /json-rpc/12.5?method=GetClusterConfig*, GET
monitor, /json-rpc/12.5?method=GetVolumeStats&params=%7B%22volumeID%22%3A1%7D, GET
```

If we try them out, we'd expect that Bob and Alice couldn't create new accounts, and that API version < 12.5 would not be allowed either (this last is not a real concern).

I can't create complex page layouts on this blog so I'll attach a screenshot of this information, with an extra column (true, false) that shows which rules matched and which didn't.

![](/assets/images/solidfire-rbac-lua-example-restful-matching.png)

**NOTE**: this is just a made-up example to illustrate how this could work, but it's not good enough for all SolidFire API calls because JSON-RPC requests can be smuggled in HTTP body so the above RBAC wouldn't be effective. But this would work for the "custom API" example further below, because that API is *only* RESTful.

## JSON-RPC

The example above **cannot** fully cover JSON-RPC use cases because, as already mentioned, JSON-RPC doesn't have to use URLs which means path-based rules wouldn't filter by parameters. 

The second problem is Lua has no idea to know who "alice" is, unless we authenticate on Reverse Proxy which can be done, but may be a completely different account from the SolidFire local account by the same name. (SolidFire can disable all local accounts except "admin", and additional admins can be mapped to ADS/LDAP groups, so if authentication uses the same ADS/LDAP, then user identity could be the same on Reverse Proxy and SolidFire).

The third is even for cases where it is possible, regular expressions based on URL encoding of JSON-RPC are hard to create.

It would be okay for simple situations such as "disallow all POST actions by Bob and Alice", but for anything but basic requests, we'd want to:

- Allow only requests to https://mvip/json-rpc/12.5 (i.e. do not allow JSON-RPC in URLs)
- Check for JSON-RPC payload in request body
- Apply RBAC-style rules on the method (CloneVolume, DeleteVolume, etc.) and request (GET, POST) of each JSON
- Log match/no match for auditing purposes

What specifically should be banned really "depends" on what you want to allow. I'd create a separate proxy, or use no proxy, for "top level" admins, and a different proxy for regular users including "team admins". In this limited proxy, I'd look into limiting or blocking:

- POST that uses Delete* methods on objects other than for volumes
- POST that uses DeleteVolume for volumes that do not belong to the account
- POST on *Accounts (GetAccounts, ListAccounts, etc.)

Or maybe it's easier to only allow Volume-related actions and block all other. Note that there are two methods - PurgeDeletedVolume and PurgeDeletedVolumes - that Trident CSI requires, but vSphere Plugin and regular users do not. So for Trident you need to enable these (or at least the first), and for other "admin level" accounts maybe not. If you do a lot of volume creation and deletion, you may want to enable it for regular admins, but you could also have a cronjob that purges volumes under certain conditions (e.g. when an account has > 100 purged volumes).

### Lua and JSON-RPC

There's a Lua JSON-RPC [module](https://github.com/r3l0c/lua-json-rpc) for generating and processing JSON-RPC, for that last step.

To dissect JSON-RPC in Lua, you can also consider [this](https://github.com/craigmj/json4lua) code.

### Complicate things with custom APIs

We could also create a simple API service of our own and use it for essential storage management functions that Bob and Alice need, and allow nothing but only those requests. These could be RESTful, not JSON-RPC, and that would make it easy to create rules for RESTful matching (although in most cases the API would be limited to what is required, so they wouldn't even be necessary). 

We would have to authenticate and authorize on Reverse Proxy because requests are not simply forwarded to SolidFire in this case. And we'd map those actions to JSON-RPC requests we want to send to the SolidFire API. 

I wouldn't suggest to do this - it may complicates things - but if you're good at this, then I would encourage it. 

Because it would both solve RBAC challenges and improve storage management, including Trident in Kubernetes environments (if you want to do storage site failover in a Kubernetes environment, for example). Instead of building complicated filters, you would need to build just 4-5 API methods for Create, Clone, Copy, Modify, and Delete Volume.

That's much easier and more secure! If you look at the Ansible post, there new volumes are prefixed with the storage account's name, so when we delete them we can simply match the account name against the volume to determine if the account is allowed to do that.

Custom API proxy gateways let us move that logic to the proxy and simply load profiles hard-coded for each API user. 

To try this I created a simple Python API gateway with several basic methods, all *locked* to fixed account ID:

- GET volumes - list *all* volumes that belong the fixed account
- PUT volume - create new volume 
- GET volume - get details for specific volume ID (I chose to get volume stats rather than general volume details - matter of preference and implementation)
- DELETE volume - delete volume by volume ID

This is easy enough, and I don't need much more. Notice that PUT volume takes just a volume name ("postgresql"), while GET and DELETE volume methods require a volume ID (106) as customary with SolidFire.

![](/assets/images/solidfire-rbac-lua-example-restful-provisioning.png)

For production I'd add authentication and ideally a few more parameters - such as the ability to specify volume size and QoS in volume parameters, but it's just a matter of spending a bit more time on that PUT volume method.

No other paths and requests are supported, so although I'm using a full-featured SolidFire admin account, there's nothing else that I can do with it but those 4 operations on my own account's volumes.

Because this API is fully RESTful, it could be filtered like we did in that Casbin example above. Still, since we fully control it, there's no need to filter it - for example, if admin account assigned Team B does `curl http://192.168.1.187:5000/volumes/107 -X DELETE` but volume 107 is named `team-c-vol-sqlite` (belongs to Team C) - that's easy to detect, reject and report in logs forwarded to your monitoring system.

For this simple PoC I hard-coded the volume size (it doesn't matter - SolidFire uses Thin Provisioning) and per-proxy account ID. The usual SolidFire Python SDK was used for all back-end communications, filtering, etc.

To make it easier to GET volumes based on Volume ID, I created this dictionary keyed on (`volume_` + $volumeID). SolidFire volume names can be non-unique but IDs are always unique, so we can't reliably use volume names.

```sh
$ curl -q -H 'Content-Type: application/json' http://192.168.1.187:5000/volumes -X GET | jq .volume_106
{
  {"volume_106": {
    "volume": "acc-1-vol-postgresql",
    "size": 1073741824,
    "accountid": 1,
    "deleteTime": "2023-12-09T05:39:36Z"}
  }
}
```

Without `jq .volume_106` I'd simply get all volumes, but I realized I needed to modify the dictionary to include volume ID for the situations when I don't know what volume_$NUMBER to use. 

```sh
$ curl -q -H 'Content-Type: application/json' http://192.168.1.187:5000/volumes -X GET | jq '.[] | select(.accountid==1)' 
{
  "volume": "data",
  "size": 2000683008,
  "accountid": 1,
  "volumeid": 1,
  "deleteTime": ""
}
{
  "volume": "log",
  "size": 1073741824,
  "accountid": 1,
  "volumeid": 2,
  "deleteTime": ""
}
{
  "volume": "acc-1-vol-postgresql",
  "size": 1073741824,
  "accountid": 1,
  "volumeid": 106,
  "deleteTime": "2023-12-09T05:39:36Z"
}
```

Volumes without `acc-1` were created in the SolidFire Web UI, so presumably I would delete them there if I needed to. 

Filtering by any volume property is available as long as it's included in volume information and now we have size, name and volume ID.

```sh
$ curl -q -H 'Content-Type: application/json' http://192.168.1.187:5000/volumes -X GET | jq '.[] | select(.volume=="acc-1-vol-postgresql")'
{
  "volume": "acc-1-vol-postgresql",
  "size": 1073741824,
  "accountid": 1,
  "volumeid": 106,
  "deleteTime": "2023-12-09T05:39:36Z"
}
```

Is it necessary to reinvent the wheel like this? 

No, but we haven't "reinvented" anything: the SolidFire API is JSON-RPC and can't be easily filtered, while this custom API is already restrictive and RESTful.

**NOTE**: this proxy couldn't work for SolidFire's vSphere Plugin, for example: it is hard-coded to the SolidFire API, so that client (plugin runnign on vCenter) would have to be given access to the native SolidFire API. Dissection and filtering with Lua would be possible, of course.

## How can we use this with Trident 

I've no idea. I looked at the [Trident CSI API](/2022/05/04/trident-csi-api.html) once and didn't have any spectacular insights at the time. 

Another time I kind of considered doing something with it was when I was considering SolidFire cluster [failover in Kubernetes environments](/2021/03/20/kubernetes-solidfire-failover-failback.html#why-only-scenario-1), but as I realized Trident had no intention of properly fixing that backend removal bug, I wasn't too eager to waste my time on finding workarounds for that Trident behavior.

But if you rely on multiple SolidFire clusters in a Kubernetes environment, maybe it's worth another look. 

The other scenario would be data protection (replication, backup & restore) for SolidFire clusters in a Kubernetes environment. Trident CSI is unlikely to add, but probably also unlikely to remove, API methods available to solidfire-san driver. Which means if we can take advantage of Trident APIs to better integrate data protection with Velero. Example:

- Use Velero CLI or [API](https://velero.io/docs/main/api-types/) to manage backup jobs
- Write simple containerized scheduler that reads Velero configuration and implements enhancements to SolidFire replication, QoS and similar

Examples:
- Automate testing of Velero backups
- Automate QoS adjustments before (adjust higher) and after (return to default) backup jobs run
- Setup async replication for volumes based on Velero backup job definitions
- Run Backup-to-S3 jobs for PVCs defined in Velero backup schedule

Update (2024/06/06): I've revisited this recently and have created [this post](/2024/06/01/pvc-volume-relationships-in-solidfire-trident-part-1.html) and may do more (in fact I have part 2 written but not yet published, and part 3 is coming soon). These posts (and scripts that go with them) are meant to partially fix and/or automate things. Check out that post and others if interested.

## Conclusion

This filtering approach is the same approach we used in RBAC with Ansible.

In the case of Trident or vSphere Plugin for SolidFire, it'd be nice if we could restrict those accounts' methods or limit parameters they can provide, and now we know how to do that.

While this post isn't a complete recipe for JSON-RPC filtering, it shows an approach that can work out of the box for simple use cases where we want team admins to simply get status of certain objects.

For a more complete approach we'd have to dissect JSON-RPC requests or create a limited RESTful or JSON-PRC based API that we would map to SolidFire's JSON-RPC on the back end. 

Having to run a custom API service just to get RBAC going may be annoying, but it can improve security by disallowing certain methods generally allowed to all SolidFire admins.
