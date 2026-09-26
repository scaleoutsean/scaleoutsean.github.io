# Storage account-level vs. IQN-level CHAP on SolidFire

Storage account-level CHAP vs. IQN-level CHAP authentication on NetApp SolidFire / Element OS

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

- [Using IQN-level CHAP authentication](#using-iqn-level-chap-authentication)
- [The Good](#the-good)
- [The Missing](#the-missing)
- [Summary](#summary)

Quick refresher on iSCSI authentication with SolidFire:

- Each SolidFire user account has a password and that combination can be used as CHAP credentials to access an account's volumes
- That is commonly set in `/etc/iscsi/iscsid.conf`; for one way authentication, the account `test` could have the following set:

```raw
node.session.auth.username = test
node.session.auth.password = testtesttest
discovery.sendtargets.auth.username = test
discovery.sendtargets.auth.password = testtesttest
```

- Another way to restrict access to volumes is to add them to Volume Access Group(s) and at the same time add Initiator Name(s) (IQN) from hosts that are supposed to access it, to the same VAG. IQN is defined in `/etc/iscsi/initiatorname.iscsi` and looks like this: `iqn.1994-05.com.redhat:bcc47dba2d5f`. Now all hosts whose IQNs have been added to the VAG can see all volumes in that VAG. This is similar to zoning in FC SANs and frequently used by vSphere (NetApp HCI, for example) or HA clusters, as all members need to see identical volumes.

That's how it's been for a while and how still is.

## Using IQN-level CHAP authentication

Recently another CHAP authentication appeared in SolidFire (Element OS) - initiator-level (IQN-level) CHAP authentication.

From the name it's clear what it does, so let's see how to configure it. I'm using a slightly different IQN Name (`..60` vs `..5f` above) as I plan to make use of it on a different iSCSI client.

```powershell
PS /home/sean> New-SFInitiator -Name iqn.1994-05.com.redhat:bcc47dba2d60 `
-Alias legitguy -VolumeAccessGroupID  15 -RequireChap -VirtualNetworkIDs 1 `
-ChapUsername marathonman -InitiatorSecret testtesttest

Alias              : legitguy
InitiatorID        : 18
InitiatorName      : iqn.1994-05.com.redhat:bcc47dba2d60
VolumeAccessGroups : {15}
Attributes         : {}
RequireChap        : True
ChapUsername       : marathonman
InitiatorSecret    : testtesttest
TargetSecret       : Oc0ri&<&<f5U%1/0
VirtualNetworkIDs  : {1}
```

As you can see, we've created a new IQN with its own credentials (marathonman/testtesttest), tied it to a Virtual Network ID (in my case, this is VLAN ID 104 - you can see that from `VirtualNetworkTag`) and added it to VAG ID 15 (we could do this part later as well, when VAG be created after IQN).

```powershell
PS /home/sean> Get-SFVirtualNetwork          

VirtualNetworkID  : 1
VirtualNetworkTag : 104
AddressBlocks     : 
Name              : segregated
Netmask           : 255.255.255.0
Svip              : 192.168.104.30
Gateway           : 0.0.0.0
```

Next, we would create a volume under the storage account `test`, a Volume Access Group (VAG), and:

- Add the volume to the VAG (ID 557)
- Add this IQN (Initiator ID 16) to the VAG (done above, as by now the VAG is available)

Our new IQN and Volume 557 are members of VAG ID 15 now.

```powershell
PS /home/sean> Get-SFVolumeAccessGroup -VolumeAccessGroupID 15

DeletedVolumes      : {}
VolumeAccessGroupID : 15
Name                : isitsafe
InitiatorIDs        : {18}
Initiators          : {iqn.1994-05.com.redhat:bcc47dba2d60}
Volumes             : {557}
Attributes          : {}
```

I can now stand up *another* iSCSI client, use IQN `iqn.1994-05.com.redhat:bcc47dba2d60` and CHAP credentials marathonman/testtesttest. That client should be able to access Volume ID 557 from this Volume Access Group.

In this picture below, I have two storage accounts, each with two volumes. Volumes are "assigned" (added to VAGs) to the left.

- Each account can always connect to their volume on default iSCSI network ("cluster SVIP") using account-level CHAP credentials
  - Each volume may optionally be added to one or more (up to 4) Volume Access Groups to remove the need to use account-level CHAP credentials for those volumes
  - In this picture each volume is a member of only one VAG
- Separately, it is possible to create VAG-specific IQN accounts, and access volumes from initiator accounts
  - One "app" (logical construct not related to SolidFire) has one or more initiators, and each can be on a separate VLAN, optionally using own IQN-level credentials
  - "App 2" makes use of two VAGs (VAG2, VAG3); maybe there are separate VMware clusters accessing the three volumes (2 volumes in VAG2, 1 volume in VAG3)
  - SolidFire objects involved on the left (IQN-based access) are: IQN, VAG, Volume, and optionally (Virtual) Network ID - when VLAN segregation between initiators from each VAG is desired

![SolidFire IQN-level vs Account-Level CHAP Credentials](/assets/images/solidfire-iqn-chap-authentication.png)

## The Good

How does that compare to using storage account credentials for CHAP authentication?

One, the account `test` can have 10 volumes in 10 VAGs, but this particular IQN will be able to access only those that are member of the same VAG. Which means that instead of creating two storage accounts on SolidFire (hrapp01db, hrapp01web) so that each can have its own volumes, you can create one (hrapp01) and setup two IQN-level credentials to access database and Web volumes, respectively. (Of course, in this case you would still be able to access both using your storage account credentials, but the point is those credentials won't be stored anywhere on the iSCSI clients.)

Two, account-level credentials do not have to be used on iSCSI hosts. If IQN credentials for the Web app are compromised, they cannot be used to access the database (because it can be on a different iSCSI VLAN) and require a different IQN, username, password.

Three, administrator doesn't *need to know* the storage account's password (which, in the example at the very top of this post, I had to know for the storage account `test` in order to populate `iscsid.conf`).

One thing to remember is that volumes added to a VAG with IQN-level CHAP credentials are *not* accessible only to such IQNs (properly authenticated, and over the specified VLAN): volume owner can still access VAG volumes over default Storage LAN, using their storage account CHAP credentials.

This makes sense, as storage account owns its volumes, but is easy to forget. So storage account credentials still must be guarded.

And four, related to this point: because storage account username and password are a sufficient but not necessary condition for volume access in an environment with VAG/IQN-level auth and VLANs, storage account password (which is CHAP password for the account) can be changed often if account owner doesn't use those credentials and relies on IQN-level credentials instead.

There may be some other advantages that are yet to be discovered (by me).

## The Missing

Things that could be improved:

- I wish we also had the ability to bind a Virtual Network ID to a VAG (and all volumes within it) so that we can limit to member volumes only to explicitly defined IQNs (which would be bound to the same Virtual Network ID).

- NetApp Trident CSI defaults to CHAP (using account-level CHAP credentials) and does not use VAGs, which means there's no way to use IQN-level credentials although that would have been useful and let us segregate workloads better.

Relevant part of SolidFire back-end configuration file ("TenantName" is SolidFire storage (or user) account):

```json
{
    "storageDriverName": "solidfire-san",
    "endpoint": "https://admin:admin@192.168.1.30/json-rpc/11.0",
    "svip": "192.168.103.30:3260",
    "tenantName": "test"
}
```

The way Trident works is if TenantName is the SolidFire account name that Trident uses to assign ownership of created volumes. If we were to provide an IQN user name (that is, ChapUsername marathonman from our example above), Trident would not find `marathonman` in the list of SolidFire storage accounts and it would attempt to create such an account which would fail with the following error: `xDuplicateUsername: CHAP username already exists`. (Again, `Get-SFAccount` does not list ChapUsername's, but `New-SFAccount` fails to create a new user (account) name that conflicts with existing ChapUsername.)

The confused K8s administrator would probably check to make sure no such SolidFire storage account exists, but if she looked under Management > Accounts in the SolidFire Web UI, no ChapUsernames would be seen because it's not a (storage) account name. Even in the CLI such as PowerShell, she'd have to use `Get-SFinitiator` (or its SolidFire API equivalent) and check all the IQNs' ChapUsername property to find it.

Without this confusion, it would have been possible to have different groups of Kubernetes workers use the same user/storage account, and yet work on different VLANs.

I haven't given this much thought as I'm still thinking about possible approaches, but by specifying tenant IQNs we could let Trident know what (IQN) CHAP credentials to use for particular workload. All volumes from this back-end would still belong to `tenantName`, but we could have workload segregation on the CHAP and VLAN level. Here's an incomplete, made-up example of a SolidFire back-end with just one IQN per environment that illustrates that.

```json
{
    "storageDriverName": "solidfire-san",
    "endpoint": "https://admin:admin@192.168.1.30/json-rpc/12.3",
    "tenantName": "test",
    "types": [{"Type": "bronze", "Qos": {"minIOPS": 1000, "maxIOPS": 2000, "burstIOPS": 4000}},
              {"Type": "gold", "Qos": {"minIOPS": 6000, "maxIOPS": 8000, "burstIOPS": 10000}}],
    "labels": {"store":"solidfire"},
    "storage": [
        {
            "labels": {"env": "test"},
            "tenantIqn": "iqn.1994-05.com.redhat:11111111",
            "type": "bronze"
        },
        {
            "labels": {"env": "prod"},
            "tenantIqn": "iqn.1994-05.com.redhat:22222222",
            "type": "gold"
        }
    ]
}
```

If certain workers were labeled the same way, our test workloads would be deployed to those specific workers which would connect to SolidFire using VLAN defined in the IQN (or IQNs, as there would likely be multiple workers in each cluster) for that `env`; `tenantIqn` would really be a list of IQNs).

In real life this would be more complex (we'd really want to use VAG IDs rather than IQNs here), but notice the simplification - there's no SVIP here because Trident gets the right SVIP and VLAN information from the IQN object(s) properties via the SolidFire API endpoint - and yet different environments use different VLANs.

It seems IQNs change more often than VAGs (as we add and remove worker nodes) and VAGs used to be supported in Trident's `solidfire-san` driver (in Trident v21.04 the code is still there, just deprecated). Because of that an even better way would be to be able to specify VAG IDs in the back-end configuration file. But there are two issues with that: as we have seen we cannot bind Virtual Network IDs to VAGs and Trident CSI has deprecated VAG support in solidfire-san driver.

For time being SolidFire users in a Trident CSI environment need to stick to the existing approach to account segregation - use different storage accounts (ex: define two back-ends with the same MVIP and SVIP; for one use tenantName `test`, for the other `prod`).

## Summary

IQN-level authentication has several very useful security benefits for workloads running in bare metal or virtualized environments.
