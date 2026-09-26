# Reautomating E-Series

E-Series automation resources

## Introduction

This page summarizes what's available in terms of NetApp E-Series SANtricity plugins and integrations to make it easier for new builders and contributors to get started.

## E-Series integrations

Discharged/MIA/AWOL:

- Openstack Cinder: gone from NetApp Cinder since Rocky
- Kubernetes CSI: gone from NetApp Trident in v22.04 (disabled in v20.07)
- PowerShell Module (PowerShell 5): [disappeared without notice](/2024/03/28/netapp-santricity-powershell-module.html)
- Cloud Connector (backup to S3): [gone](https://docs.netapp.com/us-en/e-series/cloud-connector/index.html)

In service:
- Ansible (used in E-Series-BeeGFS solution, but see Update below)
- VMware (sort-of - it's an `iframe`-d SANtricity Web UI)
- BeeGFS CSI (indirect use of E-Series, handed over to ThinkParq and properly maintained)

## Resources

- Last Cinder release from Openstack Rocky release: [source code](https://github.com/openstack/cinder/tree/rocky-eol/cinder/volume/drivers/netapp/eseries)
  - For SANtricity 11.50.x
- Python 2: [NetApp SANtricity Web Services - Python SDK package](https://pythonhosted.org/netapp.santricity/) (uses `six` for Python 3 compatibility, likely needs many updates)
- PowerShell: see the link above. Outdated for PowerShell 7.
- Ansible: [NetApp E-Series SANtricity Collection](https://github.com/NetApp/santricity)
  - [E-Series with BeeGFS](https://github.com/NetApp/beegfs/)
- Trident: [v20.07](https://github.com/NetApp/trident/commits/stable/v20.07/) or other releases before v22.07, although SANtricity was unlikely to have been tested since v20.07
  - Last SANtricity driver in Trident [v22.01](https://github.com/NetApp/trident/tree/stable/v22.01/storage_drivers). [This commit removed](https://github.com/NetApp/trident/commit/927d0039e4721e5524583224a0a5fb010afe3e62) E-Series from Trident CSI.

Some working examples of using SANtricity API - mostly in Python - can be found in my [Projects](/projects).

## Re-automating SANtricity

The good thing is, the API is still available and AI assistants make the task easier than ever.

The bad thing is, almost no one would use an unsupported driver or integration.

Top of my wish-list:
- HA CSI driver for "traditional" single-host filesystems: currently there are none
  - Cluster file systems such as BeeGFS and others have their own CSI drivers, so we have that
  - Non-HA CSI drivers are [also available](/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html) and this actually covers many use cases for E-Series (anything where data is replicated in RF2 or RF3)
- Reference HA failover solution for "traditional" single-host filesystems: doable with Pacemaker and Corosync (already exists in that E-Series with BeeGFS repository above, just not made for single-host filesystems)

ZFS is a single-host filesystem and volume manager with CSI support which can be set up for replication within E-Series, although that is somewhat wasteful. Another approach is DRBD from Linstor, also somewhat wasteful.

## Next steps

In order to get working community plugins and integrations, we need to identify alternative approaches and execute them. 

HA failover is low-hanging fruit. It's just a matter of integrating existing code and documenting it.

Basic CSI isn't too hard. Create, present, delete. We can add SANtricity backend to some ready-made CSI driver out there and maybe add it back and update in an enhanced Trident fork.

Useful automation can be created by refreshing and improving existing code.

How many users do we need to make this viable? 0. We can do it for ourselves.

Let's see how it goes in 2026.

## Updates

### 2026/01/10

I just noticed that even the SANtricity Ansible Collection was crippled [some time ago](https://github.com/NetApp/santricity/commit/bc60c07e7736072f55baf6c8d35aa2e3e2ffc81f). It's facing risk of getting kicked out of Galaxy (no updates for years), so if it gets updated in time *and* they stick to the plan, all this stuff below will be gone.

```sh
*** Note that the following deprecated modules will be removed in a future release.
Deprecated Modules:
    - netapp_e_alerts: Manage email notification settings
    - netapp_e_amg: Create, remove, and update asynchronous mirror groups
    - netapp_e_amg_role: Update the role of a storage array within an Asynchronous Mirror Group (AMG)
    - netapp_e_amg_sync: Conduct synchronization actions on asynchronous mirror groups
    - netapp_e_asup: Manage auto-support settings
    - netapp_e_auditlog: Manage audit-log configuration
    - netapp_e_auth: Set or update the password for a storage array
    - netapp_e_drive_firmware: Manage drive firmware
    - netapp_e_facts: Retrieve facts about NetApp E-Series storage arrays
    - netapp_e_firmware: Manage firmware
    - netapp_e_flashcache: Manage SSD caches
    - netapp_e_global: Manage global settings configuration
    - netapp_e_hostgroup: Manage eseries hosts
    - netapp_e_host: Manage array host groups
    - netapp_e_iscsi_interface: Manage iSCSI interface configuration
    - netapp_e_iscsi_target: Manage iSCSI target configuration
    - netapp_e_ldap: Manage LDAP integration to use for authentication
    - netapp_e_lun_mapping: Create, delete, or modify lun mappings
    - netapp_e_mgmt_interface: Manage management interface configuration
    - netapp_e_snapshot_group: Manage snapshot groups
    - netapp_e_snapshot_images: Create and delete snapshot images
    - netapp_e_snapshot_volume: Manage snapshot volumes
    - netapp_e_storagepool: Manage volume groups and disk pools
    - netapp_e_storage_system: Manage Web Services Proxy manage storage arrays
    - netapp_e_syslog: Manage syslog settings
    - netapp_e_volume_copy: Create volume copy pairs
    - netapp_e_volume: Manage storage volumes (standard and thin)
```

### 2026/05/17

SANtricity CSI v1.0.0 has been released. IBM Block CSI with SANtricity patches is also functional, currently in v1.13.2.

Other developments:

- SANtricity client library in Go
  - Terraform Provider SANtricity - leverages Go library
  - SANtricity CSI - also leverages Go library
- SAntricity client library in Python
- SANtricity PowerShell modules
  - SANmox - Proxmox TUI for SANtricity
