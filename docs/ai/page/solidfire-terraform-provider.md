# SolidFire Provider for Terraform

SolidFire Provider makes it to HashiCorp Terraform Registry

The Provider is now available from the official Terraform registry. This means we no longer need to download and build it manually. It is also easy to use it from Terraform scripts because it is deployed automatically like other providers available from the registry.

For now it can manage (create, delete) essential resources:

- storage account
- IQN
- Volume Access Group (VAG)
- volume

If you'd like it to be able to do more, please provide feedback on Github.

There's a short (1 minute) [demo](https://www.youtube.com/watch?v=pyU68JqPuMM) based on the Github example below, if you'd like to see it in action.

### Resources

- [SolidFire Provider](https://registry.terraform.io/providers/NetApp/netapp-elementsw/latest) at the Terraform Registry Web site
- Source code, releases and examples can be found [here](https://github.com/NetApp/terraform-provider-netapp-elementsw/releases/tag/v20.11.0)
