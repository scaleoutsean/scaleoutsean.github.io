# Using Terraform 1.0.6 with SolidFire 12.3

Revisiting SolidFire provider for Terraform v1

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

NetApp ElementSW Provider, as it's officially known, is a simple SolidFire integration for Hashicorp Terraform.

The provider is an outcome of a SolidFire hackathon project that was "officialized" (published by NetApp) and soon after that became available from Terraform Registry.

It can manage only four resources, but thankfully this looks like one of those good 80/20 situations where a handful of resources provides most of what one wants from a provider. It'd sure be nice if it could do more, but it can manage key resources such as storage accounts and volumes:

- Storage (tenant) account
- Volume
- Volume Access Group (VAG)
- Initiator (IQN)

In recent releases (probably since Terraform 0.14, if I recall correctly) Hashicorp set up a public Terraform Registry and made it convenient to download provider binaries from their Web site.

It became no longer necessary to build the SolidFire provider from source (which was the case before with 0.12, 0.13 as NetApp did not distribute provider binaries). We used to have to build it from source, copy the provider binary to the right directory, and figure out a way to load it. 

Now we just need to do this:

```hcl
terraform {
  required_providers {
    netapp-elementsw = {
      version = ">= 20.11.0"
      source  = "NetApp/netapp-elementsw"
    }
  }
}
```

Create a `provider.tf` file which defines variables to use the provider, run `terraform init` and the provider will be downloaded to the directory called `.terraform`.

Now create [resources and variables files](https://github.com/NetApp/terraform-provider-netapp-elementsw/tree/master/examples/elementsw) (or copy the entire repo to get the example files), and you can run `terraform plan` or `terraform apply`:

```sh
$ terraform apply \
  -var="elementsw_username=admin" \
  -var="elementsw_password=admin" \
  -var="elementsw_cluster=192.168.1.34" \
  -var="volume_name=testVol" \
  -var="volume_size_list=[1073742000,1073742000,1073742000]" \
  -var="sectorsize_512e=false" \
  -var="qos={min=100,max=200,burst=300}" \
  -var="volume_name=dc1-testVol-master" \
  -var="elementsw_initiator={name=\"iqn.1998-01.com.vmware:test-cluster-000001\",alias=\"testNode1\"}" \
  -var="volume_group_name=testTenant" \
  -var="elementsw_tenant_name=testCluster01"
```

This is all it takes to quickly create (or destroy) volumes on SolidFire.

![Using Terraform 1.0.6 with SolidFire 12](/assets/images/using-terraform-1-with-solidfire-12.gif)

## Why do we need this

What are some use cases for this SolidFire provider?

- Repetitive initiator/account/volume create-destroy cycles (DevOps, QA, hosting) where the speed matters
- General infrastructure-as-code

Although the number of resources SolidFire provider can manage is small, you don't need much more than that.

One example that should be available (but isn't) is a Terraform script for Kubernetes cluster provisioning on SolidFire, where we usually need a handful of new volumes for etcd data, or VMFS for Kubernetes Master VMs, for example. This should have been included in Rancher-on-NetApp-HCI provisioning scripts (ez-rancher), in my opinion. These improvements in the SolidFire provider documentation and examples are steps that move us in that direction - now we only need the VMware datastore step.

In the case you haven't heard of it, [ez-rancher](https://github.com/NetApp/ez-rancher/) uses Terraform to provision Rancher on VMware. There are similar Terraform community scripts to deploy Kubernetes in various ways. We just need to turn created SolidFire volumes into VMFS and then use something like ez-rancher to deploy Kubernetes.

We can do that with Ansible or PowerShell today but if we need to do that 10 or 1,000 times a day, maybe doing it with Terraform makes sense.

What if we wanted to do work on more than just those SolidFire resources the provider currently supports?

We can combine Terraform with Ansible (there's over 30 Ansible modules for SolidFire) and other configuration and automation tools, or even extend functionality with our own scripts.

I'm lazy to search for that demo video now but I recorded one example where SolidFire provider is used to create a database volume for mySQL (running in a VM), while Docker provider is used to create Docker volumes for containerized Web service (which are also using SolidFire volumes, but these volumes get created by NetApp Trident; Terraform tells Docker what volumes to create, and NetApp Trident for Docker takes care of making sure it happens).

In another example (which I didn't record) I create volumes with Terraform and then use Terraform to run my own PowerShell script for some extra functionality that the SolidFire provider doesn't have.

But in simple and straightfoward use cases where you need to create accounts and volumes for VMware, physical hosts or Kubernetes and do it quickly, Terraform with SolidFire provider can do that job in seconds by following that example above.

## Next steps

With SolidFire provider easier to use we can create more complex examples such as end-to-end provisioning of new SolidFire volumes with VMware datastores and Kubernetes VMs on top of that.
