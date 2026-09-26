# Get Rancher Kubernetes deployment log for on NetApp HCI mNode

Get Rancher deployment log on NetApp HCI

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

As I explained in the lengthy [post](/2020/12/08/get-bearer-token-for-netapp-hci-hybrid-cloud-control-logs) related to mNode/HCC logs, mNode documentation is misleading in several places and in this particular case service name you need to provide isn't really a service name: my HCI mNode is called `mnode`, so "service name" I should provide is really `mnode_${servicename}`.

Rancher deployment service on NetApp HCI mNode is called `k8sdeployer`, which makes my full URL (assuming I have a valid bearer token):

> https://${mnode-ip}/mnode/1/logs?lines=1000&service-name=mnode_k8sdeployer&type=service

This gets me (up to) 1,000 most recent lines of that service log.

In mNode Swagger:

![Get logs from mNode Swagger UI](/assets/images/hcc-get-k8sdeployer-logs-01.png)

If your Rancher deployment fails and you don't grab a screenshot or copy the error, you can get the log from the Swagger UI or via the API (see the post linked at the top for instructions on how to do it from PowerShell or Python). In fact you shouldn't grab a screenshot, you should always get log and share your inputs and relevant part of the log file.

## Example

Here's an example I encountered the other day:

> "Error: error reconfiguring virtual machine: error in virtual machine configuration: this VM lacks a vApp configuration and cannot have vApp properties set on it"

My lab environment was too messy so I wasn't surprised. I also didn't [RTFM](https://docs.netapp.com/us-en/hci/docs/rancher_prereqs_overview.html): I had to enable DRS and clean up Rancher VMs left over from CLI-based testing.

Rancher deployment errors usually can be cleared by deleting Rancher cluster from HCC UI but if that doesn't work you can try to reboot mNode to clear the error that way, if no one or nothing is using it at the moment (although an enabled ActiveIQ collector always is, that one can survive reboots just fine).

## If you avoid errors you won't need to troubleshoot HCC logs 

A better approach - in my mind - is to use ez-rancher until you understand what various options do, and deploy production clusters with HCC because that gives you an officially supported deployment and frees you from having to deal with errors and troubleshooting due to incorrect use.

Even if you plan to use the free version (without paid support), it's still better to use HCC deployment correctly because it helps avoid troubles with HCC (and HCC and mNode are used for other services which may be important for production and support (ActiveIQ, for example).

Late last year I posted three ez-rancher deployment videos on YouTube, find the first one [here](https://www.youtube.com/watch?v=m54PM9dJujE).
