# SolidFire RBAC workflow with Ansible

Basic workflow for volume management isolation between teams with SolidFire and Ansible

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

## Introduction

Continuing from my [previous post related to Ansible with SolidFire](/2022/01/31/configure-snmpv2-on-solidfire-ansible.html), after I touched that topic I thought to revisit some of the old management challenges or problems and see if I can try and find a nice use case for Ansible with SolidFire.

Yesterday I recalled the old forgotten problem of RBAC. That's a good one!

On SolidFire, there are (storage) accounts and there are storage admins (cluster admins).

Volumes belong to storage accounts (who may use their account (CHAP) name and password to access volumes), but all cluster admins who can manage volumes can manage any and all storage accounts' volumes.

Normally that's not a big issue because there's a management layer where RBAC is built in (vCenter) or there's something that fully or partially resembles it.

In OpenStack [Cinder](https://docs.openstack.org/cinder/xena/configuration/block-storage/drivers/solidfire-volume-driver.html), for example, we have `sf_account_prefix = ''` that lets you use one tenant account per cluster. NetApp Trident CSI driver supports `storagePrefix`, an optional prefix for volume names. 

## Basic requirements

Let's say you needed something similar for your automation workflows:

- "admin" (main SolidFire cluster admin) manages other admins
- cluster admin "jupiter" manages storage accounts (or volumes) named "jupiter-*"
- cluster admin "mars"  manages storage accounts (or volumes) named "mars-*"

Maybe you'd have "accounting" and "marketing" rather than "jupiter" and "mars", but you get the idea.

This is how these cluster admin accounts look like in the SolidFire UI:

![SolidFire cluster admins](/assets/images/solidfire-cluster-admins.png)

Jupiter and Mars can manage the cluster, access cluster facts related to volumes as well as do everything related to volumes. The problem is, it's *all* volumes.

So we to come up with a way to constrain what volumes or accounts can be managed by only these two admins.

The idea is as follows:

- Instead of writing your own application, use Ansible Tower (or other mechanism) as an API proxy
- "Application" logic in Ansible
-  and  (see below) are used for authentication and authorization: as we start running a volume management playbook, for example, one of the steps ensures the user is indeed a cluster admin

```yaml
  - name: Check if member of cluster admins
    any_errors_fatal: true
    na_elementsw_admin_users:
      hostname: "192.168.1.34"
      username: ""
      password: ""
      element_username: "" 
      state: present
    register: result
    failed_when: result.failed == true

```

- Once he gets past that task 's name is hard-coded in volume-name tasks. For example, any volume name that Jupiter provides in the step below results in the creation of `jupiter-${volname}`:

```yaml
  - name: Create Volume
    na_elementsw_volume:
      hostname: "192.168.1.34"
      username: ""
      password: ""
      state: present
      name: "-"
      qos: {minIOPS: 100, maxIOPS: 200, burstIOPS: 500}
      account_id: 6
      enable512e: False
      size: 2 
      size_unit: gb
    when: someadmin == 'jupiter'
```

- Notice that the condition "`when`" right above locks out any other cluster admins. This isn't strictly necessary because cluster admin's account name ($someadmin) is already a part of volume name string, but can be used for additional protection

![SolidFire cluster admins](/assets/images/solidfire-cluster-admins-rbac-for-cluster-accounts.png)

- Likewise, any volume Jupiter can *delete* begins with "jupiter-" and not "mars-" or something else. Even if Jupiter specifies =mars-db1 Ansible will attempt to delete `jupiter-mars-db1` (which won't do any harm to accounts from Team Mars)

```yaml
  - name: "Delete volume -"
    na_elementsw_volume:
      hostname: "192.168.1.34"
      username: ""
      password: ""
      state: absent
      name: "-"
      account_id: 6 
```

- You can see that `account_id` (just above) is hard-coded in to this task, but it wouldn't necessarily have to be that way (this was just a basic PoC) and additional checks could be made to ensure that owner of volume that's being deleted shares the account prefix with cluster admin to verify the volume does not belong to the other team.

Team Jupiter could have multiple accounts (jupiter-joe - ID 6, jupiter-jack - ID 9) and all of these would also have to be matched (that is, we could first get a list of all accounts that begin with jupiter- to make sure that the storage account named volume belongs to is in fact a Team Jupiter account.)

Then Jupiter and Mars can create or delete volumes for storage accounts managed by them like so:

```sh
ansible-playbook create.yml -e "someadmin=jupiter somepass=testtest volname=jdb"
```

What happens if Mars tries to create a volume using the above workflow? 

```sh
ansible-playbook create.yml -e "someadmin=mars somepass=testtest volname=jdb"
```

Because that task contains a hard-coded "when" condition to let only Jupiter use it, Mars will successfully authenticate in the first task (`na_elementsw_admin_users`, see above) avoid hitting a fault, but Create Volume will be skipped because Mars' admin account name doesn't match the `when` condition. No authorization, so to speak.

```yaml
TASK [Check if member of cluster admins] ****************
ok: [localhost]

TASK [Spit out the result] ******************************
ok: [localhost] => {
    "result": {
        "changed": false,
        "failed": false,
        "failed_when_result": false
    }
}

TASK [Create Volume] ************************************
skipping: [localhost]

PLAY RECAP **********************************************
localhost                  : ok=4    changed=0    unreachable=0
    failed=0    skipped=1    rescued=0    ignored=0   
```

Again, this condition probably isn't necessary, but can be put in place. We could have another task after that to alert main cluster administrator or other team administrators about failed Create Volume tasks.

Without that restriction, Team Mars would create a volume, but it'd be named mars-jdb rather than jupiter-jdb. Also - because have a storage account hard-coded in that task - the volume would end up assigned to Team Jupiter so that could be improved, although isn't very harmful.

## Summary

In conclusion, this approach makes it easy to create a basic role-based account and volume access control with just two-three small Ansible playbooks. No application to maintain, no complex code to write.

It's not meant for high-security environment, but it can help prevent accidental deletion of accounts and volumes.

Remember that all cluster admins can read cluster settings, so while this isn't a Coke vs. Pepsi candidate solution, it can help avoid accidental and to some degree (depending on how well it's implemented) deliberate destruction of data in a trusted environment. For example, if everything was exposed through Ansible Tower, all Delete Volume tasks on certain volume names could be dropped or delayed by 3600s, with a Slack notification to the storage account owner.

On SolidFire volumes deleted via the SolidFire API aren't immediately purged (they stay in a "recycle bin" for 8 hours) and that approach to deletion (directly call the API using shell task with curl or something like that) could be used to give the owner additional time to react. Otherwise, if ElementSW "delete volume" task is used the volume is [purged at the same time](https://github.com/ansible-collections/netapp.elementsw/issues/2) which is consistent with Trident and other automation tools but doesn't allow us to "undo" volume delete mistakes made through automation.

If you already automate your environment with Ansible and don't have anything better in place, maybe you can create an additional cluster admin account and use something like this to prevent accidental deletion of accounts and volumes.
