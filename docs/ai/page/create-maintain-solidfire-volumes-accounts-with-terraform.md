# Create SolidFire volumes and accounts with Terraform

How to create and maintain SolidFire volumes and accounts with Terraform

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

My [previous post](/2021/09/18/using-terraform-1-with-solidfire-12.html) on Terraform with SolidFire used the updated example from the NetApp ElementSW Provider repo on Github.

This post is for folks who've tried (or at least reviewed) that approach, so that we can jump straight into action.

In this approach we still have one account, but several volumes with unique properties. 

```
resource "elementsw_account" k8s_account {
  provider         = netapp-elementsw
  username         = var.elementsw_tenant_name 
  target_secret    = "NetApp123$NetApp"
  initiator_secret = "NetApp123$NetApp"
}

locals {
  volumes = {
    "etcd1" = { size = 1073742000, sectorsize_512e="false", qos={min="100", max="200", burst="300"} },
    # "etcd2" = { size = 1073742000, sectorsize_512e="false", qos={min="100", max="200", burst="300"} },
    "etcd3" = { size = 1073742000, sectorsize_512e="false", qos={min="100", max="200", burst="300"} }
  }
}

resource "elementsw_volume" volume {
  for_each   = local.volumes
  provider   = netapp-elementsw
  name       = "${each.key}"
  account    = elementsw_account.k8s_account.id
  total_size = each.value.size
  enable512e = each.value.sectorsize_512e
  min_iops   = each.value.qos.min
  max_iops   = each.value.qos.max
  burst_iops = each.value.qos.burst
}

output "elementsw_volume" {
  value      = elementsw_volume.volume
}
```

Now we can plan, then apply, remove `#` to add etcd2, apply again, etc.

```
elementsw_volume = {
  "etcd1" = {
    "account" = "9"
    "attributes" = tolist(null) /* of string */
    "burst_iops" = 300
    "enable512e" = false
    "id" = "24"
    "iqn" = "iqn.2010-01.com.solidfire:46z9.etcd1.24"
    "max_iops" = 200
    "min_iops" = 100
    "name" = "etcd1"
    "total_size" = 1073742000
  }
  "etcd2" = {
    "account" = "9"
    "attributes" = tolist(null) /* of string */
    "burst_iops" = 300
    "enable512e" = false
    "id" = "23"
    "iqn" = "iqn.2010-01.com.solidfire:46z9.etcd2.23"
    "max_iops" = 200
    "min_iops" = 100
    "name" = "etcd2"
    "total_size" = 1073742000
  }
  "etcd3" = {
    "account" = "9"
    "attributes" = tolist(null) /* of string */
    "burst_iops" = 300
    "enable512e" = false
    "id" = "22"
    "iqn" = "iqn.2010-01.com.solidfire:46z9.etcd3.22"
    "max_iops" = 200
    "min_iops" = 100
    "name" = "etcd3"
    "total_size" = 1073742000
  }
}
```

Destroy works the same way, i.e. you can remove just one of the volumes.

We can also change QoS settings and re-apply:

```
Terraform will perform the following actions:

  # elementsw_volume.volume["etcd2"] will be updated in-place
  ~ resource "elementsw_volume" "volume" {
        id         = "36"
      ~ max_iops   = 200 -> 150
        name       = "etcd2"
        # (6 unchanged attributes hidden)
    }

  # elementsw_volume.volume["etcd3"] will be updated in-place
  ~ resource "elementsw_volume" "volume" {
        id         = "34"
      ~ max_iops   = 200 -> 150
        name       = "etcd3"
        # (7 unchanged attributes hidden)
    }

Plan: 0 to add, 2 to change, 0 to destroy.

Changes to Outputs:
  ~ elementsw_volume = {
      ~ etcd2 = {
          ~ max_iops   = 200 -> 150
            # (9 unchanged elements hidden)
        }
      ~ etcd3 = {
          ~ max_iops   = 200 -> 150
            # (9 unchanged elements hidden)
        }
    }

```

List of volumes and their properties can be stored in variables.tf or volumes.tf or externally generated.

Multiple changes of volume properties, such as volume sizes and QoS, also work. As per the API, volumes can be extended but not shrunk.

```
Terraform will perform the following actions:

  # elementsw_volume.volume["etcd3"] will be updated in-place
  ~ resource "elementsw_volume" "volume" {
        id         = "39"
      ~ min_iops   = 100 -> 150
        name       = "etcd3"
      ~ total_size = 1073742000 -> 3073742000
        # (5 unchanged attributes hidden)
    }

Plan: 0 to add, 1 to change, 0 to destroy.

Changes to Outputs:
  ~ elementsw_volume = {
      ~ etcd3 = {
          ~ min_iops   = 100 -> 150
          ~ total_size = 1073742000 -> 3073742000
            # (8 unchanged elements hidden)
        }
        # (1 unchanged element hidden)
    }

```

In the current provider documentation (on the Terraform Web site) there's no mention of tenant (storage) account secrets, but I noticed those while preparing for today's post and they seem to work well so you don't have to rely on API-provided random passwords.

```
Terraform will perform the following actions:

  # elementsw_account.k8s_account will be updated in-place
  ~ resource "elementsw_account" "k8s_account" {
        id               = "18"
      ~ target_secret    = "NetApp123$NetApp" -> "NetApp123$000"
        # (2 unchanged attributes hidden)
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

This makes it easy to update account details with passwords that fit your internal complexity rules (although, unfortunately, the SolidFire API v12.3 limits the length of CHAP secret to only 16 characters - it seems that's 16 is the maximum accepted by Windows iSCSI initiator).

Compared to the example from previous Terraform-related post, this approach is more suitable for creation and maintenance of volumes for a project that belongs to single account. It also doesn't use VAGs because SolidFire's CSI provider now relies exclusively on tenant accounts and CHAP (VAG was deprecated for NetApp Trident, although it's still used in VMware and other clusters).

## Demo

It's not very different from previous demos, so I recorded this as a simple 60 second (it loops so don't wait for it to finish) animated GIF. Open it in a new tab for easier viewing.

![Volume create, update, delete with Terraform and SolidFire](/assets/images/terraform-solidfire-2022-02.gif)
