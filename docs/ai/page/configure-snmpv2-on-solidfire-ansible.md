# Configure SNMP on SolidFire cluster using Ansible

How to configure SNMP on SolidFire cluster using Ansible and some thoughts on when to use Ansible

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

I mentioned Ansible in my [last post](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html) and that reminded me that I haven’t written about it for a while. And even in that post I mentioned it only as an example how its use could be *avoided* with the NetApp Data Ops Toolkit.

In the context of my favorite topic, SolidFire, I think I haven’t mentioned it for months. Why? Because I rarely need it for SolidFire.

This isn’t to say that it’s not useful - if you have more than one cluster or if you make frequent or complex changes to SolidFire cluster configuration, it is very useful.

But despite that, I rarely - in fact almost never - get any questions about it.

Why is that? I think it’s very simple:

- SolidFire easily and nicely scales out to dozens of nodes, so very few users have multiple clusters. Normally that could mean 30 arrays and 60 volume groups to manage, but with SolidFire you have one cluster and no volume groups to manage
- Users who do have multiple SolidFire clusters and use Ansible are likely to have a lot of other infra (if you have 50 SolidFire nodes, you probably have hundreds of servers), and therefore the staff and expertise that eliminates SolidFire-specific challenges

People who have just one or two clusters can manage them just fine with PowerShell or Python SDK - there’s very little to manage on SolidFire (accounts, volumes, QoS policies) so even with thousands of VMs or containers, it’s easy to manage with DIY PowerShell scripts. Some anecdotal examples:

- Reasonably reliable SolidFire cluster failover script in less than 200 lines of PowerShell (video demo on YouTube)
- SolidFire cluster and Trident back-end failover script in less than 300 lines (video demo on YouTube; I haven’t published)
- Parallel SolidFire volume backup to S3 (210 lines of PowerShell in my awesome-solidfire repo on Github)

To do the same with Ansible you may need fewer lines, but you also need to:

- Install, understand and maintain Ansible
- The same for SolidFire collection for Ansible
- Write own modules or scripts for things that haven’t been implemented (curl and JSON-RPC seems much better than doing the same in Python, but then one has to wonder why use Ansible at all)

Again, all of that is easily justified when you have multiple clusters or use Ansible to automate other stuff.

All right, enough ranting - let’s do this thing. SolidFire has many Ansible modules but I picked SNMP because I’ve done a lot of [SNMP](/2021/07/19/solidfire-mib-snmp-monitoring.html) and [monitoring](/2021/08/13/solidfire-snmp-v3-grafana.html)-related work (see blog archive) so with this post I’ll complete that work.

My sf_snmp.yml:

```yml
- name: Configure SolidFire SNMPv2
  hosts: localhost 
  gather_facts: no
  connection: local

  vars:
    elementsw_hostname: 192.168.1.34
    elementsw_username: admin
    elementsw_password: wink-wink

  tasks:  
    - name: Configure SNMP on SolidFire
      na_elementsw_cluster_snmp:
        hostname: ""
        username: ""
        password: ""
        state: present
        snmp_v3_enabled: False
        networks:
          access: ro
          cidr: 24
          community: MgmtNetwork
          network: 192.168.1.0
```

Some comments:

- we use SolidFire Python SDK and because of that we operate against localhost
- we don’t need to gather_facts

Result:

```
$ ansible-playbook sf-snmp.yml --extra-vars "elementsw_password=admin"

PLAY [SolidFire SNMPv2 Config] *****************************************************************************************

TASK [Configure SNMP on SolidFire] *************************************************************************************
ok: [localhost]

PLAY RECAP *************************************************************************************************************
localhost                  : ok=1    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

Let’s compare that with SoliFire PowerShell Tools:

- For SNMPv2 we need a list Networks (with at least one member hashtable) which you can build or Get
- PowerShell will save you 1-2 seconds, but if you do this once in five years that won’t matter

```powershell
PS > $snmp = Get-SFSnmpInfo

Networks                                                                                 Enabled SnmpV3Enabled UsmUsers
--------                                                                                 ------- ------------- --------
    True         False 

PS > $snmp.Networks

Access Cidr Community   Network
------ ---- ---------   -------
ro       24 MgmtNetwork 192.168.1.0

PS > Set-SFSnmpInfo -Network $snmp.Networks -Enabled:$true -SnmpV3Enabled:$False -Confirm:$false

Networks                                                                                 Enabled SnmpV3Enabled UsmUsers
--------                                                                                 ------- ------------- --------
    True         False 

```

To do the same for SNMPv3 you’d need to add a USM user before you Set:

```powershell
PS > $user = Add-SFSnmpUsmUser -Name admin -Access rouser -Password password -Passphrase passphrase -SecLevel auth

PS > Set-SFSnmpInfo -Networks $snmp.Networks -Enabled:$true -SnmpV3Enabled:$true -UsmUsers $user.UsmUsers -Confirm:$false
```

To disable SNMP with PowerShell:

```powershell
PS > Disable-SFSnmp -Confirm:$False

Enabled SnmpV3Enabled
------- -------------
  False         False
```

SNMPv3 can also be configured via Ansible - just change snmp_v3_enabled to True and add a block with USM configuration:

```yml
    snmp_v3_enabled: True
    usm_users:
      name: admin
      access: rouser
      password: passphrase
      passphrase: passphrase
      secLevel: auth
```

You can have just one YAML file with SNMPv3 in it, and disable it when configuring SNMPv2:

```
ansible-playbook sf-snmp.yml --extra-vars "elementsw_password=admin;state=present;snmp_v3_enabled=false" 
```

To disable SNMP server with Ansible, set state to false (absent):

```
$ ansible-playbook sf-snmp.yml --extra-vars "elementsw_password=admin;state=false"

PLAY [SolidFire SNMPv2 Config] *****************************************************************************************

TASK [Configure SNMP on SolidFire] *************************************************************************************
changed: [localhost]

PLAY RECAP *************************************************************************************************************
localhost                  : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

## Summary

Both approaches are valid and work better than manual operations through the Web UI or Hybrid Cloud Control.

If you already use Ansible for other infrastructure than SolidFire, or have more than one SolidFire cluster, you’ll probably find more suitable for SolidFire management than PowerShell.

If you don’t like Python you can still use SolidFire PowerShell Tools in place of missing SolidFire modules or even instead of NetApp Element Software modules you don’t like (maybe they don’t do something you can do with PowerShell, or aren’t available yet).

Use ansible.windows.win_powershell or other (shell) module to execute your PowerShell scripts from within Ansible. Could we run Ansible from PowerShell rather than PowerShell from Ansible? Yes, that works too - that’s the approach I use in solidbackup: I use PowerShell for all the SolidFire-related stuff because it’s much better and faster than Ansible, but I don’t want to use PowerShell to deal with the rest - namely Linux devices and mounts - because Ansible is much better for that.

All these scripts aren’t very long and take mere hours to develop, so you can find what’s best for you by doing just two-three simple PoCs.
