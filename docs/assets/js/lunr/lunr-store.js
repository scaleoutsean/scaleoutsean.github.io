var store = [{
        "title": "solid-rancher",
        "excerpt":"solid-rancher is a Github repo I created to organize and enrich information related to Rancher on SolidFire (and NetApp HCI in general). A non-mission is to substitute or duplicate information from the official documentation (whether from Rancher or from NetApp). Like with other repos I maintain, the idea is to...","categories": ["projects","solidfire"],
        "tags": ["netapp","solidfire","kubernetes","rancher","hci"],
        "url": "/2020/11/16/solid-rancher.html",
        "teaser": null
      },{
        "title": "Muddying the gh-pages waters",
        "excerpt":"I’ve done my fair share of googling and was surprised to see there are so many complex ways to use Github pages. As a person supposed to solve problems, I can’t say I like that there are so many ways to serve static pages and at the same time I’ve...","categories": ["random"],
        "tags": ["github"],
        "url": "/2020/11/17/muddying-gh-page-waters.html",
        "teaser": null
      },{
        "title": "Deploying Rancher Worker VMs to NetApp HCI with VMware VSS",
        "excerpt":"Earlier this week I spotted the advice to not select a VM host when deploying Rancher worker VMs to a vSphere environment where DRS is enabled, because “DRS is smarter than you.” That’s almost certainly true - especially in the mid and long term - but at the moment of...","categories": ["kubernetes","virtualization"],
        "tags": ["rancher","solidfire","kubernetes","netapp"],
        "url": "/2020/11/20/rancher-and-drs.html",
        "teaser": null
      },{
        "title": "Dark Mode for NetApp HCI and SolidFire",
        "excerpt":"NetApp HCI, SolidFire, eSDS Web UI The above image is SolidFire v12.0 viewed from Firefox and Dark Reader. There’s another open source browser extension called Dark Mode. Both are available for Firefox, Chrome, and Edge. Element Plug-in for VMware vCenter (aka VCP) It too works well (evaluated with Dark Mode,...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","dark mode"],
        "url": "/2020/11/20/solidfire-netapp-hci-dark-mode.html",
        "teaser": null
      },{
        "title": "Helpful waste of time",
        "excerpt":"Introduction Update 1 (2023/08/30) Update 2 (2025/05/03) Update 3 (2025/06/07) FAQs Introduction When dealing with input that consists of unweildy TLS certificates Postman can helpfully hint at potential JSON validity problems and save you time. I’m sure some other tools are like that as well. With such help, instead of...","categories": ["random"],
        "tags": ["certificate","postman","solidfire"],
        "url": "/2020/11/24/scary-bs-postman-ssl-certs.html",
        "teaser": null
      },{
        "title": "SolidFire Provider for Terraform",
        "excerpt":"The Provider is now available from the official Terraform registry. This means we no longer need to download and build it manually. It is also easy to use it from Terraform scripts because it is deployed automatically like other providers available from the registry. For now it can manage (create,...","categories": ["solidfire","automation"],
        "tags": ["netapp","solidfire","terraform","plugin","provider","devops"],
        "url": "/2020/11/26/solidfire-terraform-provider.html",
        "teaser": null
      },{
        "title": "SolidFire mNode and HCC Log Fowarding",
        "excerpt":"SolidFire Management Node (aka mNode) is a VM that runs Hybrid Cloud Services (various “management stuff”.) Let’s say we wanted to collect and analyze those logs. How could we get the logs out the smart way? Before we begin, we need to know what we’re dealing with. As of today,...","categories": ["solidfire","automation"],
        "tags": ["netapp","solidfire","hci","hcc","log","logging"],
        "url": "/2020/11/27/solidfire-mnode-hcc-log-forwarding.html",
        "teaser": null
      },{
        "title": "Set Temporary Storage QoS Policy for SolidFire Volume",
        "excerpt":"Say we have a Volume ID 321 with a storage QoS Policy ID 5, and need to run a temporary job that would benefit from a different Storage QoS Policy (higher or lower, it doesn’t matter). With PowerShell we’d normally use Get-SFVolume to get current QoS settings (could be a...","categories": ["automation"],
        "tags": ["netapp","solidfire","powershell","qos","devops"],
        "url": "/2020/11/28/powershell-set-sfqosexception.html",
        "teaser": null
      },{
        "title": "How much slower is iSCSI vs. Fibre Channel",
        "excerpt":"If you search for “iSCSI vs FC performance” it’s not easy to find a recent like-for-like comparison from enterprise vendors. I’ve been puzzled by this and I have some theories as to why, but regardless - the fact is there aren’t that many comparisons out there. Last time I looked...","categories": ["storage"],
        "tags": ["e-series","eseries","iscsi","fibre channel","fc","performance","netapp"],
        "url": "/2020/12/05/iscsi-vs-fibre-channel-fc-performance.html",
        "teaser": null
      },{
        "title": "Get NetApp Hybrid Cloud Control logs via the HCC API",
        "excerpt":"Hybrid Cloud Control (HCC) is a group of services - management plane, if you will - for out-of-band management of NetApp HCI, SolidFire and eSDS. Currently it’s a bunch of containers that runs in a VM commonly called mNode (short for Management Node). NOTICE: all credentials and tokens on this...","categories": ["automation"],
        "tags": ["netapp","solidfire","hci","api","powershell","python","hcc"],
        "url": "/2020/12/08/get-bearer-token-for-netapp-hci-hybrid-cloud-control-logs.html",
        "teaser": null
      },{
        "title": "Rancher Kubernetes Layer-7 NLB/Ingress with NGINX Plus and Let's Encrypt",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. tl;dr Introduction and requirements Resources Deploy Linux VM and N+ Create DNS entries, get TLS certificates, configure NGINX Prepare DNS and open public firewall (port TCP/443) TLS with Let’s Encrypt Install Rancher Servers Configure N+ Upstream...","categories": ["kubernetes"],
        "tags": ["netapp","solidfire","kubernetes","rancher","nginx","f5","ingress"],
        "url": "/2020/12/14/netapp-hci-rancher-ingress-nginx-plus-lets-encrypt.html",
        "teaser": null
      },{
        "title": "SolidFire PowerShell Tools, Python CLI and SDK pip packages v1.7",
        "excerpt":"This is a nice Christmas present as far as I am concerned, because it’s been a while since SolidFire PowerShell tools, sfcli and their respective SDKs v1.5 have been released. Those of you who use them don’t need any instructions, but those who are curious can glance at the post...","categories": ["automation"],
        "tags": ["netapp","solidfire","powershell","devops","python"],
        "url": "/2020/12/19/solidfire-powershell-python-cli-sdk-1.7.html",
        "teaser": null
      },{
        "title": "Protect your Kubernetes with Kasten and SolidFire",
        "excerpt":"Rancher and other Kubernetes users want to protect their applications and data. NetApp HCI and its underlying SolidFire storage are used by NetApp Trident to provide a CSI-compatible API to Kubernetes-based orchestrators. Kubernetes CSI Snapshots NetApp Trident lets Kuberntes users take snapshots and import existing volumes to Kubernetes. In order...","categories": ["kubernetes"],
        "tags": ["netapp","solidfire","kasten","backup","data protection","trident","k10","kanister"],
        "url": "/2020/12/21/kasten-rancher-netapp-hci-solidfire-k8s-backup.html",
        "teaser": null
      },{
        "title": "Adapter, network and VLAN isolation on NetApp HCI",
        "excerpt":"This comes up every so often: Somebody out there (such and such team or person isn’t comfy with virtual switches or VLANs, etc.) wants to physically or virtually segregate networks People take the easy way out and isolate less than they think they should, and need to reconfigure after the...","categories": ["virtualization"],
        "tags": ["netapp","solidfire","vlan","networking","hci","vsphere","vmware"],
        "url": "/2020/12/24/netapp-hci-network-segregation.html",
        "teaser": null
      },{
        "title": "DiskSpd performance from NetApp HCI VM to EF280",
        "excerpt":"Summary Why test EF280 performance from a VM VMFS vs. Raw Devices Manageability and iSCSI Cost of an All Flash backup tier Reference Appendix: Configuration and DiskSpd logs NTFS striped over two VMDK/Datastores ReFS on Raw Device ReFS Striped across four Raw Devices Summary VM running on a NetApp HCI...","categories": ["virtualization","storage"],
        "tags": ["netapp","solidfire","e-series","eseries","performance","diskspd","benchmark","veeam"],
        "url": "/2020/12/30/netapp-hci-ef280-diskspd-for-backup.html",
        "teaser": null
      },{
        "title": "BeeGFS on NetApp HCI with EF280 for high-speed VM file sharing",
        "excerpt":"Summary Why and when run BeeGFS in NetApp HCI VMs Aren’t shared file systems complex to deploy and manage How do automation and virtualization help Performance Considerations What next References Update (Jan 05, 2021) Summary If you need fast sequential access from NetApp HCI VMs to a shared data pool...","categories": ["virtualization"],
        "tags": ["netapp","solidfire","e-series","eseries","beegfs","hci","performance"],
        "url": "/2020/12/31/beegfs-on-netapp-hci-and-ef-series.html",
        "teaser": null
      },{
        "title": "Virtualized Splunk on NetApp HCI and EF Series iSCSI storage",
        "excerpt":"Things are getting interesting Does EF-Series for Splunk on NetApp HCI make sense How does it work How does that compare with other HCI Can we get to the point and see those bonnie++ results How hard is it to manage NetApp HCI-attached E/EF-Series iSCSI arrays This comparison doesn’t apply...","categories": ["virtualization","analytics"],
        "tags": ["netapp","solidfire","e-series","eseries","splunk","vm","iscsi"],
        "url": "/2020/12/31/virtualized-splunk-on-netapp-hci-and-ef-series.html",
        "teaser": null
      },{
        "title": "Elasticsearch on NetApp HCI H615C with EF-Series EF280",
        "excerpt":"Summary Test results Configuration Elasticsearch data protection with EF-Series Workload description Performance-related observations Client Elastisearch VMs Network EF280 storage performance HCI H615C vs H410C, Bare Metal vs VMs NetApp HCI server-to-EF-Series array ratio Management OS (VM) deployment Elasticsearch deployment Storage management Monitoring Advantage of disaggregated HCI Summary In this post...","categories": ["virtualization"],
        "tags": ["elk","elasticsearch","netapp","hci","e-series","eseries","monitoring","visualization"],
        "url": "/2021/01/04/elasticsearch-on-netapp-h615c-ef280.html",
        "teaser": null
      },{
        "title": "StorageGRID SDS for Splunk Smartstore on NetApp HCI, EF-Series",
        "excerpt":"If you’d like to deploy Splunk SmartStore with NetApp StorageGRID object storage but also want to “start small”, you can consider using smaller StorageGRID appliances or deploy StorageGRID as virtual machines. Which one is better? Both are great. Which one is better for you depends on your current, and (expected)...","categories": ["virtualization","analytics"],
        "tags": ["smartstore","splunk","netapp","hci","e-series","eseries","monitoring","visualization","storagegrid"],
        "url": "/2021/01/15/netapp-hci-storagegrid-splunk-smartstore-on-efseries.html",
        "teaser": null
      },{
        "title": "StorageGRID object versioning",
        "excerpt":"“There’s no documentation” is different from “there are no copy-paste examples”. The StorageGRID documentation has no (or has very few) S3 API copy-paste examples because StorageGRID follows the Amazon S3 API and the only thing the StorageGRID documentation needs to say is to inform the user if something is implemented,...","categories": ["storage"],
        "tags": ["object versioning","storagegrid","netapp","s3","api"],
        "url": "/2021/01/19/storagegrid-versioning-example.html",
        "teaser": null
      },{
        "title": "Splunk sizing with shared core HCI vendors",
        "excerpt":"In recent weeks I’ve done a fair amount of reading about log management solutions, and I have to say the quality of technical material related to Splunk and Elasticsearch from mainstream vendors is not very good. Shared-core HCI vendors are worst because not one ever tells you what you’re overpaying...","categories": ["analytics","storage"],
        "tags": ["nutanix","splunk","performance","sizing"],
        "url": "/2021/01/21/splunk-sizing-with-dellemc-and-nutanix.html",
        "teaser": null
      },{
        "title": "NetApp HCI with Cloud Backup Service",
        "excerpt":"NetApp Cloud Backup Service backs up your ONTAP data to your Object Storage bucket located in the cloud (Amazon, Azure, Google Cloud). Can NetApp HCI use that service? Indirectly, it can. It is possible to use it directly, too, by leveraging the included ONTAP Select, but as we shall see...","categories": ["virtualization"],
        "tags": ["cloud backup service","cloud backup","netapp","cbs","hci","ontap","ontap select","data protection"],
        "url": "/2021/01/27/netapp-hci-cloud-backup-service.html",
        "teaser": null
      },{
        "title": "Get Rancher Kubernetes deployment log for on NetApp HCI mNode",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. As I explained in the lengthy post related to mNode/HCC logs, mNode documentation is misleading in several places and in this particular case service name you need to provide isn’t really a service name: my HCI...","categories": ["virtualization","kubernetes"],
        "tags": ["kubernetes","rancher","netapp","hci"],
        "url": "/2021/01/29/get-rancher-deployment-log-from-netapp-hci-hcc.html",
        "teaser": null
      },{
        "title": "Backup Rancher cluster configuration to NetApp StorageGRID",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Summary Backup and restore etcd configuration in Rancher on NetApp HCI Prepare a bucket Use it when deploying a cluster View your backups with an S3 browser Restore a cluster configuration backup Object storage organization What...","categories": ["kubernetes"],
        "tags": ["kubernetes","rancher","data protection","storagegrid","s3","backup"],
        "url": "/2021/02/01/backup-rancher-on-hci-to-storagegrid-s3.html",
        "teaser": null
      },{
        "title": "Install NetApp Trident v21.01 with Helm v3, SolidFire",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. NetApp Trident v21.01.01 supports Helm. This makes Trident easier to install, especially if you have multiple clusters or stand up and destroy clusters on a regular basis. Download Trident from Github, decompress and change directory to...","categories": ["kubernetes","solidfire"],
        "tags": ["kubernetes","trident","netapp","helm","solidfire"],
        "url": "/2021/02/02/trident-21.01-install-with-helm-on-netapp-hci.html",
        "teaser": null
      },{
        "title": "Use Velero with NetApp StorageGRID Object Storage",
        "excerpt":"tldr Q: Can StorageGRID be used as an S3 provider for Velero? A: Looks like it. Set things up ubuntu@helmetsky:~$ ./trident-installer/tridentctl get backend -n trident +--------------------------+----------------+--------------------------------------+--------+---------+ | NAME | STORAGE DRIVER | UUID | STATE | VOLUMES | +--------------------------+----------------+--------------------------------------+--------+---------+ | solidfire_192.168.103.30 | solidfire-san | e656fa37-ee5a-4b23-95f4-07482e2c6e5b | online | 0 |...","categories": ["virtualization"],
        "tags": ["velero","backup","data protection","storagegrid","s3","netapp"],
        "url": "/2021/02/02/use-velero-with-netapp-storagegrid.html",
        "teaser": null
      },{
        "title": "Use SolidFire PowerShell Tools to find low efficiency volumes",
        "excerpt":"NetApp Hybrid Cloud Control (HCC) lets you access volume details to a slightly greater detail than the SolidFire Web UI. One additional detail that we are interested about is volume (storage utilization) efficiency. You can use this information to identify poorly utilized volumes (again, in terms of storage efficiency, not...","categories": ["automation","solidfire"],
        "tags": ["PowerShell","devops","storage efficiency"],
        "url": "/2021/02/05/get-solidfire-volume-efficiency-with-powershell.html",
        "teaser": null
      },{
        "title": "Use Velero CSI Plugin with NetApp SolidFire and NetApp Trident 21.01",
        "excerpt":"tldr Using CSI Plugin (currently still in beta) Velero v1.5.3 can help protect Kubernetes apps and data on NetApp HCI or SolidFire (meaning, it can schedule and take Trident/SolidFire snapshots as well as backup application settings and data to a S3-compatible provider such as NetApp StorageGRID). Since this support is...","categories": ["kubernetes","solidfire"],
        "tags": ["velero","csi","data protection","solidfire","trident","backup"],
        "url": "/2021/02/08/use-velero-with-netapp-solidfire-and-trident-csi.html",
        "teaser": null
      },{
        "title": "StorageGRID as Cloud Storage (S3) Provider for Kasten K10",
        "excerpt":"Previously I blogged about using Kasten with NetApp HCI and SolidFire, but I did not have time to examine another NetApp storage integration, namely that of NetApp StorageGRID which can be used as a Cloud Provider in Kasten K10. It’s extremely easy to set it up: in Kasten K10 Web...","categories": ["kubernetes"],
        "tags": ["kasten","backup","data protection","storagegrid","s3"],
        "url": "/2021/02/09/kasten-netapp-storagegrid-cloud-storage-s3-provider.html",
        "teaser": null
      },{
        "title": "NetApp SolidFire, Kasten K10, Kubernetes",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Introduction Improve storage management and data protection in a Kubernetes environment NetApp SolidFire NetApp Trident CSI Kasten by Veeam NetApp StorageGRID Data protection with Kasten in a NetApp HCI or SolidFire environment SolidFire QoS performance policies...","categories": ["kubernetes","solidfire"],
        "tags": ["kasten","backup","data protection","solidfire","s3","kubernetes"],
        "url": "/2021/02/12/kasten-solidfire-trident.html",
        "teaser": null
      },{
        "title": "Use StorageGRID for private container registry",
        "excerpt":"Docker Registry This post needs a refresh, but the tldr of it is: you need to work by Docker docs and use StorageGRID values like so: - regionendpoint: https://s3.dot.org:8443 # StorageGRID S3 API endpoint - bucket: docker-registry # create it beforehand, secure with S3 ACLs - secure: true # use...","categories": ["containers"],
        "tags": ["docker","storagegrid","registry","netapp","container registry","s3"],
        "url": "/2021/02/17/storagegrid-s3-private-container-registry.html",
        "teaser": null
      },{
        "title": "Limit CSI provisioner's blast radius for ONTAP storage",
        "excerpt":"Problem Solutions Demo Problem “We’d like to automate, but we don’t expose storage management interface to workload nodes”. Solutions There are several. For the maximum security in management, don’t use CSI. Provision manually. Problem solved! There’s no dynamic storage provisioning, that’s true, but you could automate out-of-band with Ansible and...","categories": ["kubernetes","storage"],
        "tags": ["ontap","trident","csi"],
        "url": "/2021/02/20/trident-csi-ontap-management-isolation.html",
        "teaser": null
      },{
        "title": "NetApp Trident v21.01.1 on Linux/ARM64 with SolidFire iSCSI storage",
        "excerpt":"Intro Build \\&amp; Deploy What about s390x, ppc64le and other architectures Next steps Version info Notes on linux/s390x (Feb 25, 2021) Intro NetApp Trident is open source dynamic storage provisioner for CSI-compatible platforms such as Docker and Kubernetes. Currently it supports the x86_64 platform but - as we shall soon...","categories": ["kubernetes","storage"],
        "tags": ["trident","csi","netapp","solidfire","arm64"],
        "url": "/2021/02/24/netapp-trident-on-arm64.html",
        "teaser": null
      },{
        "title": "NetApp StorageGRID for Vertica EON Mode",
        "excerpt":"WTF is EON Mode What do I need to do to get Vertica EON Mode work with StorageGRID TLS certificate for HTTPS IP address for S3 API endpoint S3 bucket and region name Configuration details for Object Storage Backup to S3 Export data to S3 StorageGRID sizing for performance and...","categories": ["analytics"],
        "tags": ["vertica","database","netapp","storagegrid","s3"],
        "url": "/2021/02/27/storagegrid-s3-as-vertica-communal-storage.html",
        "teaser": null
      },{
        "title": "Announcing HCICollector v0.7",
        "excerpt":"What’s new in HCICollector v0.7 Improvements Setbacks What’s next for HCICollector Unsolvable NetApp Trident Download HCICollector What’s new in HCICollector v0.7 Updates: base images, SolidFire SDK, Grafana, and more sfcollector: this is the Python script that takes care of SolidFire-related metrics. Updated SolidFire SDK for Python which supports latest and...","categories": ["projects","solidfire"],
        "tags": ["monitoring","visualization","solidfire","api","python","hci","hcicollector"],
        "url": "/2021/03/08/hcicollector-v0.7.html",
        "teaser": null
      },{
        "title": "Get started with solidfire-exporter",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. In yesterday’s post about HCICollector v0.7 I mentioned solidfire-exporter. Here’s how to get started with it without Kubernetes and Docker in under 2 minutes. You can read the project’s README file to the same effect, but...","categories": ["projects","solidfire"],
        "tags": ["monitoring","visualization","solidfire","api","python","hci","prometheus","exporter","solidfire-exporter"],
        "url": "/2021/03/09/get-started-with-solidfire-exporter.html",
        "teaser": null
      },{
        "title": "Kubernetes failover and failback with Trident CSI and SolidFire",
        "excerpt":"UPDATE Summary Introduction Comparison between PV Patching and Trident Volume Import approach Why only Scenario 1 Failover (PROD=&gt;DR) Steps to failover a SolidFire cluster Configure Kubernetes and Trident CSI for the SolidFire cluster PROD Notes about restoring workloads on the remote SolidFire cluster Steps to configure SolidFire volume replication in...","categories": ["kubernetes","automation","storage"],
        "tags": ["netapp","solidfire","trident","bc","dr","trident"],
        "url": "/2021/03/20/kubernetes-solidfire-failover-failback.html",
        "teaser": null
      },{
        "title": "Hardware monitoring of NetApp HCI compute nodes for dark sites",
        "excerpt":"NetApp HCI compute nodes are normally monitored from mNode, which is a VM that fetches events from both storage and compute nodes. But if your environment is disconnected from the Internet, you can enable SNMP and send email alerts as with any standard server with management controller. My preferred approach...","categories": ["virtualization","solidfire"],
        "tags": ["netapp","solidfire","hci","monitoring","visualization","hcicollector","python"],
        "url": "/2021/03/24/netapp-hci-compute-node-local-hardware-monitoring.html",
        "teaser": null
      },{
        "title": "Testing Edge-to-DC using Photon IoT and ONTAP",
        "excerpt":"Introduction What does it do Storing and protecting your IoT data Object Stores for Photon IoT C2C (Cloud to Container) How to process IoT data uploaded to the cloud? Restore Photon IoT snapshots to ONTAP in the cloud or on-premises Copy Photon IoT data to other systems in the cloud...","categories": ["random"],
        "tags": ["netapp","ontap","edge","photon iot","arm64","trident"],
        "url": "/2021/03/27/photon-ontap-on-arm64-iot-edge.html",
        "teaser": null
      },{
        "title": "NetApp SolidFire and Trident CSI failover automation with Powershell",
        "excerpt":"While experimenting with SolidFire and Trident CSI failover for Kubernetes, I came across a challenge: SolidFire Tools for Powershell provide unbeatable convenience and ease of SolidFire automation, but tridentctl, kubectl and the rest of Linux shell commands are not easy to use from Powershell, while using two shells results in...","categories": ["containers","kubernetes","automation","solidfire"],
        "tags": ["netapp","solidfire","trident","kubernetes","powershell"],
        "url": "/2021/03/28/manage-netapp-trident-with-powershell.html",
        "teaser": null
      },{
        "title": "GA of SolidFire 12.3",
        "excerpt":"Snapshot queue and serialization FIFO snapshot queue allows you to ensure that snapshots are replicated in predictable order. If you decide to use this feature, when you create a volume you can decide the minimum and maximum number of FIFO snapshot slots that should be reserved. When the FIFO snapshot...","categories": ["storage"],
        "tags": ["netapp","solidfire"],
        "url": "/2021/04/20/solidfire-12.3.html",
        "teaser": null
      },{
        "title": "Backup SolidFire volumes to S3-compatible storage",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. What it is (and isn’t) and when to use it How it works Buckets, (sub)directories, nametags Restore from S3 Automating SolidFire Backup to S3 Backup using the API, PowerShell or Python Note on range setting Using...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","s3","backup","data protection","api"],
        "url": "/2021/04/21/solidfire-backup-to-s3.html",
        "teaser": null
      },{
        "title": "SolidFire, KVM, Duplicati and S3 Object Storage",
        "excerpt":"In the previous post I explained how SolidFire’s built-in backup/restore to/from S3 works and how we can automate it. This post is about doing less automation and more integration. Why For niche data protection use cases we can take advantage of the friendly SolidFire API features as well as various...","categories": ["virtualization","containers"],
        "tags": ["netapp","solidfire","s3","backup","data protection","duplicati","kvm"],
        "url": "/2021/04/22/solidfire-kvm-duplicati-and-backup-to-s3.html",
        "teaser": null
      },{
        "title": "StorageGRID with CloudMirror - replication to S3-compatible bucket",
        "excerpt":"What When CloudMirror is properly configured, StorageGRID places changes into a queue and copies modified objects to a remote S3 bucket. This remote bucket can be AWS S3, another StorageGRID or some other object store that adheres to the S3 API. Why If you need a persistent copy of your...","categories": ["analytics","cloud"],
        "tags": ["netapp","storagegrid","s3","cloudsync","cloud sync","replication","sync","cloud mirror"],
        "url": "/2021/04/29/storagegrid-cloudmirror-async-replication-to-remote-s3-bucket.html",
        "teaser": null
      },{
        "title": "GA of NetApp Trident v21.04",
        "excerpt":"What Upgrade procedure Before Out with the old, in with the new Verify success Trident for ARM64 and other non-AMD64 architectures What NetApp Trident v21.04 was released yesterday. Notable Kubernetes-related enhancements: Added recreate strategy in Trident Operator deployment Added an images sub-command to tridentctl to display the container images required...","categories": ["containers","kubernetes"],
        "tags": ["netapp","trident","csi","docker"],
        "url": "/2021/05/01/netapp-trident-21.04-released.html",
        "teaser": null
      },{
        "title": "Mirantis Kubernetes Engine 3.4 with NetApp SolidFire 12.2",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Yesterday I realized that NetApp Trident v21.04 introduced support for Mirantis Kubernetes Engine (MKE). In the past NetApp Trident and SolidFire couldn’t work with Docker EE so I was curious if this change that would give...","categories": ["kubernetes","solidfire"],
        "tags": ["netapp","mirantis","trident","solidfire"],
        "url": "/2021/05/02/mirantis-mke-netapp-trident-solidfire.html",
        "teaser": null
      },{
        "title": "SolidFire Maintenance Mode",
        "excerpt":"Maintenance Mode is a relatively new SolidFire feature that takes a node in and out of the neutral. In other words, it nicely moves a node’s services to remaining cluster nodes, making servicing less disruptive to iSCSI clients, and makes it eligible for service scheduling when node leaves Maintenance Mode...","categories": ["automation","solidfire"],
        "tags": ["netapp","hcc","hci","solidfire","api"],
        "url": "/2021/05/06/using-solidfire-maintenancemode.html",
        "teaser": null
      },{
        "title": "SolidBackup for SolidFire Data Protection in Hybrid Cloud",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Introduction First attempt Backup and Restore in KVM environments Data Migration Do we really want DIY approaches to protect our data Second attempt Create configuration and keep Src &amp; Dst (Clone) volumes in sync Backup to...","categories": ["automation"],
        "tags": [],
        "url": "/2021/05/08/revisiting-solidbackup.html",
        "teaser": null
      },{
        "title": "Monitor SolidFire Network with SolidFire-Exporter, Prometheus and Grafana",
        "excerpt":"In the first solidfire-exporter post I went through the first two steps required to gather SolidFire (or NetApp HCI) data and get it into Prometheus. I also said I’ll write additional posts as I find time and opportunity. In this post I’ll describe additional steps related to a practical requirement...","categories": ["projects","solidfire"],
        "tags": ["netapp","solidfire","prometheus","monitoring","visualization"],
        "url": "/2021/05/19/solidfire-exporter-monitor-solidfire-network-interfaces-with-prometheus-and-grafana.html",
        "teaser": null
      },{
        "title": "Get Trident's SolidFire metrics from outside Kubernetes",
        "excerpt":"If I had a SolidFire array in a VM and container environment (which I do), I’d prefer to run Prometheus and Grafana in VMs, rather than cram the monitoring into Kubernetes. If you have that kind of a setup, you might prefer the same. Now, since newer releases of Trident...","categories": ["containers","kubernetes"],
        "tags": ["netapp","solidfire","trident","csi"],
        "url": "/2021/05/25/external-access-to-netapp-trident-solidfire-metrics.html",
        "teaser": null
      },{
        "title": "Does SolidFire support Availability Zones",
        "excerpt":"SolidFire Double Helix As most of you know, up to the current version (12.3) SolidFire protects its data with Helix, which aims to make and maintain 2 replicas of each block. Some vendors call this approach RF2 (some implementations may maintain copies of segments or “chunks” of blocks). When making...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","ha","az","pd","protection domain","failure domain"],
        "url": "/2021/06/08/solidfire-availability-zones.html",
        "teaser": null
      },{
        "title": "Role of SolidFire networks in SolidFire storage replication",
        "excerpt":"Everyone should get the hard-to-find TR-4741 (NetApp Element Software Remote Replication), but to answer the simple question: “all of the above”. Management network is used for management traffic Storage (iSCSI) network is used for storage traffic (including storage replication traffic) Similarly to what I did in this post, I configured...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","networking","management","mvip","svip"],
        "url": "/2021/06/08/solidfire-networks-used-for-storage-replication.html",
        "teaser": null
      },{
        "title": "SolidBackup with alternative backup clients",
        "excerpt":"As I mentioned in one of previous posts on the topic of SolidBackup, we first use SolidSync to sync SolidFire Source volume(s) to Clone volume(s), and then SolidBackup generates scripts to run backup off those Clone volume(s). The first example I shared uses Restic, but it can be anything you...","categories": ["automation","projects"],
        "tags": ["netapp","backup","data protection","solidfire","rclone","duplicati","restic","kopia","duplicacy","s3"],
        "url": "/2021/06/18/solidbackup-with-alternative-backup-clients.html",
        "teaser": null
      },{
        "title": "Maximum parallelization of SolidFire Backup and Volume Copy/Clone jobs",
        "excerpt":"SolidFire can backup volumes to S3-compatible Object Storage. How to do it in parallel, I wrote about here. Volume cloning and copying is a similar type of background job, and those can also be executed in parallel. We get to use this in automation, for example when you need to...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","powershell","devops","backup","restore","data protection"],
        "url": "/2021/06/22/solidfire-backup-and-cloning-with-per-storage-node-queues.html",
        "teaser": null
      },{
        "title": "Faster initialization, rebalancing with DDP on NetApp E-Series",
        "excerpt":"RAID 6 vs DDP DDP expansion Disk media refresh with DDP pools Demo RAID 6 vs DDP Here I explained how Dynamic Disk Pools (DDP) work and how they differ from traditional RAID6 (or RAID5) data protection. Recently I had a query about the need for DDP for which I...","categories": ["storage"],
        "tags": ["netapp","eseries","e-series","ddp"],
        "url": "/2021/07/06/e-series-ddp-expansion-and-rebalancing.html",
        "teaser": null
      },{
        "title": "Data Path in SolidFire clusters with Protection Domains",
        "excerpt":"In the post that compares SolidFire Protection Domains with Availability Zones I had this illustration of network connectivity among SolidFire v12 cluster nodes and between SolidFire and iSCSI clients. Sometimes one wonders if it’d be better if clients had some intelligence about storage layout. In this post I explain why...","categories": ["solidfire","storage"],
        "tags": ["netapp","solidfire","iscsi","networking"],
        "url": "/2021/07/06/solidfire-protection-domains-data-path.html",
        "teaser": null
      },{
        "title": "SolidFire Support Bundle Log with Automation, OneCollect",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. I don’t have any first hand information to say this is the case, but I believe that with the increased focus on container workloads and container-packaged SolidFire (NetApp eSDS), SolidFire management has slowly been increasingly containerized...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","onecollect","log"],
        "url": "/2021/07/07/solidfire-onecollect-and-scripted-supportbundle-automation.html",
        "teaser": null
      },{
        "title": "Storage account-level vs. IQN-level CHAP on SolidFire",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Using IQN-level CHAP authentication The Good The Missing Summary Quick refresher on iSCSI authentication with SolidFire: Each SolidFire user account has a password and that combination can be used as CHAP credentials to access an account’s...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","chap","iqn","security"],
        "url": "/2021/07/16/iqn-level-chap-authentiation-on-solidfire.html",
        "teaser": null
      },{
        "title": "Monitor SolidFire with SNMP",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Get SolidFire MIBs What’s in SolidFire MIBs Enable SNMP service on SolidFire cluster SNMP v2 SNMP v3 What to monitor (documentation and reference material) Events and Faults Event Severity in clusterFaultDetails (1.3.6.1.4.1.38091.1.1.5.1.1.10) Event Types (1.3.6.1.4.1.38091.1.1.5.2.1.6) Cluster...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","snmp","monitoring","alerting"],
        "url": "/2021/07/19/solidfire-mib-snmp-monitoring.html",
        "teaser": null
      },{
        "title": "GA of NetApp Trident v21.07",
        "excerpt":"Latest &amp; greatest NetApp Trident is out! Version 21.07 says goodbye to OCP 3.11 (and any and all Kubernetes clusters running versions earlier than v1.17). It also removes support for E-Series back-end. Users can still use Trident v21.04 with E-Series, as well as any other (generic) or specialized drivers such...","categories": ["kubernetes"],
        "tags": ["netapp","trident","csi","kubernetes"],
        "url": "/2021/07/31/netapp-trident-v21.07.html",
        "teaser": null
      },{
        "title": "SGAC v0.1",
        "excerpt":"How it begun Last year I forked a stale community script for StorageGRID audit log analysis and made some improvements to it. In my opinion it was useful and there have been a few downloads, but I don’t know if anyone uses it. What was useful about it? The reason...","categories": ["projects"],
        "tags": ["netapp","storagegrid","s3","python","visualization","log","audit"],
        "url": "/2021/08/09/sgac-storagegrid-audit-log-converter-v0.1.html",
        "teaser": null
      },{
        "title": "SolidFire SNMP v3, Telegraf, Prometheus, Grafana",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Introduction Enable SNMP V3 on SolidFire Install and configure Telegraf Prometheus Grafana Related stuff Conclusion Introduction As you may know, for collection and visualization of SolidFire metrics I recommend SolidFire-Exporter followed by HCICollector. How they (in...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","snmp","monitoring","audit","telegraf","prometheus","grafana","visualization"],
        "url": "/2021/08/13/solidfire-snmp-v3-grafana.html",
        "teaser": null
      },{
        "title": "Copy StorageGRID objects and tags using rclone",
        "excerpt":"Create two buckets, source and destination, a PUT a test object with some junk tags to source/. Copy that object to another bucket using rclone: $ mc ls sgpub/source [2021-08-24 16:14:54 CST] 1.7KiB diff-31-33.txt $ rclone copy --no-update-modtime sgpub:/source/diff-31-33.txt sgpub:/destination/ $ mc ls sgpub/destination [2021-08-24 16:30:37 CST] 1.7KiB diff-31-33.txt $...","categories": ["random"],
        "tags": ["netapp","storagegrid","rclone","s3"],
        "url": "/2021/08/24/rclone-copy-objects-with-storagegrid-tags.html",
        "teaser": null
      },{
        "title": "How to create StorageGRID object path-based ILM rule",
        "excerpt":"Say you have a bucket called junk with “directory tree” (not really but…) several levels deep (junk/lev1/lev2) and want to do some ILM stuff on the stuff in one of those subdirectories. Of course, you’d create a new ILM rule and apply it in a policy. To narrow down potential...","categories": ["storage"],
        "tags": ["netapp","storagegrid","s3","ilm"],
        "url": "/2021/09/06/storagegrid-ilm-rule-for-paths.html",
        "teaser": null
      },{
        "title": "Logical backup vs. storage-assisted backup with Kasten v4 and SolidFire",
        "excerpt":"To answer the question quickly: logical backups make sense. WTF is a K10 logical backup? Logical backups use application-aware backup commands to backup data (and restore, when restoring). K10 uses Kanister which uses Blueprints to define application-specific workflows. “Applications” currently means popular databases: PostgreSQL mySQL MongoDB Elasticsearch There are no...","categories": ["storage","kubernetes"],
        "tags": ["netapp","kasten","solidfire","backup","data protection","trident"],
        "url": "/2021/09/09/kasten-v4-with-solidfire-logical-and-snapshot-assisted-data-protection.html",
        "teaser": null
      },{
        "title": "Using Terraform 1.0.6 with SolidFire 12.3",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. NetApp ElementSW Provider, as it’s officially known, is a simple SolidFire integration for Hashicorp Terraform. The provider is an outcome of a SolidFire hackathon project that was “officialized” (published by NetApp) and soon after that became...","categories": ["solidfire","automation"],
        "tags": ["netapp","solidfire","go","terraform","provider","plugin","devops"],
        "url": "/2021/09/18/using-terraform-1-with-solidfire-12.html",
        "teaser": null
      },{
        "title": "Red Hat Quay with NetApp StorageGRID S3 Back End",
        "excerpt":"Create a bucket, say quay, and a set of S3 keys for one of your S3 users to use with this bucket. Pick Amazon S3-compatible storage, enter the required info, validate. (Note: I’ve had several people who picked another type ask my why my blog post “doesn’t work”, so now...","categories": ["containers","kubernetes"],
        "tags": ["netapp","redhat","quay","container registry","registry","s3","storagegrid"],
        "url": "/2021/10/14/storagegrid-s3-with-red-hat-quay.html",
        "teaser": null
      },{
        "title": "SolidFire monitoring with Elasticsearch",
        "excerpt":"Problem Why ELK Log Forwarding with syslog-ng Challenges with SolidFire Log Forwarding Solving Single-Log-Many-Formats Challenge Structured Logs Get Events and Faults Completely from API logs Unstructured Logs Searching Unstructured Logs Status Polling with http_poller SNMP Trap Monitoring Creating Charts and Visualizations Video Demo Conclusion Appendix A: Software Used Appendix B:...","categories": ["solidfire","automation"],
        "tags": ["netapp","solidfire","elk","elasticsearch","monitoring","observability","audit","log"],
        "url": "/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html",
        "teaser": null
      },{
        "title": "SGAC v0.2.1",
        "excerpt":"Some two months ago I rewrote SGAC and released it as v0.1. Github tells me few folks downloaded it but I’ve no idea who and why. I got no contributions and feedback from colleagues either, but as I worked on the SolidFire-ELK post I thought I should use the opportunity...","categories": ["projects"],
        "tags": ["netapp","sgac","storagegrid","python","elk","elasticsearch","log","audit","s3"],
        "url": "/2021/10/20/sgac-storagegrid-audit-log-converter-v0.2.1.html",
        "teaser": null
      },{
        "title": "SolidFire highlights from NetApp INSIGHT 2021",
        "excerpt":"In the case you missed NetApp INSIGHT 2021 and want to catch up with latest SolidFire developments, I recommend to consider some of the following sessions. I can’t reproduce any content without the written permission of NetApp, so no screenshots or verbatim details in this post - sorry! BRK-1096-1 -...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","insight"],
        "url": "/2021/10/24/solidfire-insight-2021.html",
        "teaser": null
      },{
        "title": "Alluxio and StorageGRID",
        "excerpt":"Intro Problem description Proof of Concept Configuration Actions Summary Demo video Intro Some IT people (I wish I could say many, but sadly that’d be untrue) are aware that the state of technology related to global and distributed access has been improving and can have huge benefits in time-to-results, manageability,...","categories": ["analytics","storage"],
        "tags": ["netapp","storagegrid","alluxio","cache","s3","hadoop","hdfs","caching","ram cache"],
        "url": "/2021/11/12/alluxio-storagegrid-s3.html",
        "teaser": null
      },{
        "title": "Alluxio and ONTAP NFS",
        "excerpt":"Intro Configuration for NFS Run test workload with NFS back end Alluxio with ONTAP S3 Demo Intro In the first Alluxio-related post I have a more detailed, generic introduction related to both S3 and NFS, so here I’ll just say that in use cases where we can benefit from Alluxio’s...","categories": ["analytics","storage"],
        "tags": ["netapp","ontap","alluxio","s3","analytics","hadoop","ram cache","caching"],
        "url": "/2021/11/21/alluxio-ontap.html",
        "teaser": null
      },{
        "title": "Replicate volume data from Digital Ocean to SolidFire and back",
        "excerpt":"Digital Ocean is a no-nonsense cloud provider that you’ve probably heard of. SolidFire and Digital Ocean users may sometime want to migrate volume data without using application-level replication. That may involve activities such as Backup &amp; Restore (each action on one side) or offline data synchronization or replication. In this...","categories": ["solidfire","cloud","automation"],
        "tags": ["netapp","solidfire","digital ocean","data protection","sync","replication"],
        "url": "/2021/11/30/digital-ocean-volume-to-solidfire-volume-and-back.html",
        "teaser": null
      },{
        "title": "Flatcar Container Linux with SolidFire iSCSI",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. If you’re into containers you’ve probably heard of Flatcar Container Linux, popular community fork of CoreOS. I don’t think any Flatcar Container Linux user would encounter a problem configuring SolidFire (SolidFire configuration for iSCSI clients is...","categories": ["storage","virtualization"],
        "tags": ["netapp","solidfire","flatcar","linux","iscsi","coreos"],
        "url": "/2021/12/07/flatcar-linux-with-solidfire-iscsi.html",
        "teaser": null
      },{
        "title": "Find unused S3 (access) keys and accounts on NetApp StorageGRID",
        "excerpt":"Problem What to do Approach A Delete access key by id Delete access key by displayName Approach B Risks Summary NOTICE: all credentials and tokens on this page are samples, not leaked. Problem Users apply for - or get given by default - an S3 key pair. Then they don’t...","categories": ["storage"],
        "tags": ["netapp","s3","storagegrid"],
        "url": "/2021/12/12/finding-unused-storagegrid-accounts.html",
        "teaser": null
      },{
        "title": "Integrate SolidFire with ServiceNow",
        "excerpt":"This is speculative and I haven’t tried it, but it looks very interesting. Note there’s an official SolidFire plugin on the ServiceNow Web site, but this is about leveraging ELK for a more holistic approach (performance, monitoring, event loging and various correlations that you can derive from SolidFire and other...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","servicenow","plugin"],
        "url": "/2021/12/14/integrate-solidfire-with-servicenow.html",
        "teaser": null
      },{
        "title": "Hadoop Multi-Tiered Read-Write S3 cache Alluxio and NetApp StorageGRID",
        "excerpt":"Introduction Setup Underlay Storage (S3) Multi-tiered S3 Cache Hadoop (MapReduce) Compute Layer Configuration Results Hot Read Cache (including pinned and pre-loaded content) Cold Cache (including free’d and evicted) Observations Related to SSD Cache Benefits and Conclusion Demo NOTICE: all credentials and tokens on this page are samples, not leaked. Introduction...","categories": ["analytics","storage"],
        "tags": ["netapp","storagegrid","ontap","analytics","ram cache","caching","alluxio"],
        "url": "/2021/12/16/hadoop-multi-tiered-s3-read-write-cache.html",
        "teaser": null
      },{
        "title": "Using NetApp SolidFire Hybrid Cloud Control (HCC) API from PowerShell",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. In this post I explained how we can interact with Hybrid Cloud Control (HCC). In this - because the first one is a bit Python-focused and some folks couldn’t get PowerShell to work - I’ll explain...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","powershell","python","hcc","hci"],
        "url": "/2021/12/21/netapp-solidfire-hci-hcc-powershell.html",
        "teaser": null
      },{
        "title": "This blog in 2021",
        "excerpt":"Top posts Number one Number two Number three Top referrers Top countries Personal favorites that have and haven’t been written in 2021 solidbackup Structured SolidFire logging MIA Other As noted in About, I use privacy-orientated log analytics which collects some vary basic details about what’s going on here. I don’t...","categories": ["meta","random"],
        "tags": [],
        "url": "/2021/12/22/blog-year-2021.html",
        "teaser": null
      },{
        "title": "Using rclone to copy StorageGRID S3 data to local filesystem",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Today’s challenge was how to define as little as possible in our rclone configuration file. For some reason, rclone dev(s) decided this had to be hard. I suppose that may be to minimize the user-friendliness shock for rclone...","categories": ["storage"],
        "tags": ["netapp","storagegrid","rsync","sync","replication"],
        "url": "/2021/12/22/rsync-with-storagegrid.html",
        "teaser": null
      },{
        "title": "Minimal Nextcloud 23 with NGINX and SQLite on Ubuntu 22.04",
        "excerpt":"Introduction Problem statement Solution What you need Warning for PHP 8.1 users Install PHP 8.0 Storage for Nextcloud binaries and data NGINX FPM Give it a try End References Introduction In 2021 I’ve been using Docker and Kubernetes more than before, but at the same time I’ve been paying more...","categories": ["random"],
        "tags": ["nextcloud","nginx"],
        "url": "/2021/12/29/nextcloud-nginx.html",
        "teaser": null
      },{
        "title": "Getting SolidFire volume details with Powershell and Python",
        "excerpt":"Just a few examples for those who struggle to get started. Volumes have other properties, of course, but names, IDs and sizes are what most people want to get. Feel free to extract other details as you see fit. It is recommended to create a dedicated read-only cluster admin for...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","powershell","devops","python","api"],
        "url": "/2022/01/01/getting-solidfire-volume-details-python-powershell-api-cli.html",
        "teaser": null
      },{
        "title": "SolidFire and CVE-2021-44228 Apache Log4j Vulnerability",
        "excerpt":"If you haven’t enabled VVOLs on SolidFire (Element, eSDS), i.e. VASA service hasn’t been enabled, there’s no need to do anything. But if you want to patch anyway, you can find the links here. SUST-1210 - for SolidFire v12 to 12.3.1 SUST-1211 - for SolidFire v11.3 to 11.8 If you...","categories": ["solidfire"],
        "tags": ["security","cve"],
        "url": "/2022/01/03/log4j-patch-for-solidfire-element-esds.html",
        "teaser": null
      },{
        "title": "Red Hat Quay with NetApp ONTAP S3",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Today I realized I’d forgotten to write this post last year… So, how to configure Red Hat Quay with ONTAP S3? Use NetApp OTNAP 9.10.1 or newer Configure ONTAP S3 and create a bucket, account, etc. for Quay....","categories": ["kubernetes","containers"],
        "tags": ["quay","ontap","s3","ontap s3","redhat","registry","container registry","netapp"],
        "url": "/2022/01/17/redhat-quay-with-ontap-s3.html",
        "teaser": null
      },{
        "title": "Getting started with NetApp Cloud Sync API",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Getting started Short answer Long answer JWT access token (access_token) for NetApp Cloud Central Cloud Sync Account ID from NetApp Cloud Central Random Swagger, Postman and REST rant Next steps This post is the first in a two-post...","categories": ["automation","cloud"],
        "tags": ["netapp","cloud","cloudsync","cloud sync","api"],
        "url": "/2022/01/17/using-netapp-cloudsync-api.html",
        "teaser": null
      },{
        "title": "Using NetApp Cloud Sync API",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Start using Cloud Sync Deploy Data Broker Set up a relationship and subscribe to Cloud Sync service Sync Reports Unsubscribe Conclusion This post is the second in a two-post series. The first post can be found here and...","categories": ["automation","cloud"],
        "tags": ["netapp","cloudsync","cloud sync","sync","api","devops"],
        "url": "/2022/01/18/using-netapp-cloudsync-api.html",
        "teaser": null
      },{
        "title": "SolidFire v12 Backup and Restore with Wasabi S3",
        "excerpt":"It’s very easy and works as you expected: Create a usable bucket (get region, account, access/secret key pair details and make sure it works from another client) Get S3 API endpoint FQDN for your bucket from the Wasabi help pages Backup (or restore) SolidFire volumes as usual I am in...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","s3","backup","data protection","wasabi"],
        "url": "/2022/01/19/solidfire-backup-restore-wasabi-s3.html",
        "teaser": null
      },{
        "title": "StorageGRID S3 in Public Cloud workflows without Data-at-Rest",
        "excerpt":"This week I heard of a StorageGRID customer who had a query about data processing in the cloud. Probably instinctively, their first idea was to copy data to the cloud. Sometimes that’s okay, another time it’s unavoidable, etc. But in this case it was completely unnecessary (“Because that’s how we’ve...","categories": ["storage","automation"],
        "tags": ["netapp","storagegrid","s3","workflow"],
        "url": "/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html",
        "teaser": null
      },{
        "title": "Configure SNMP on SolidFire cluster using Ansible",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. I mentioned Ansible in my last post and that reminded me that I haven’t written about it for a while. And even in that post I mentioned it only as an example how its use could be avoided...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","snmp","ansible","api","monitoring"],
        "url": "/2022/01/31/configure-snmpv2-on-solidfire-ansible.html",
        "teaser": null
      },{
        "title": "SolidFire RBAC workflow with Ansible",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Introduction Continuing from my previous post related to Ansible with SolidFire, after I touched that topic I thought to revisit some of the old management challenges or problems and see if I can try and find a nice...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","redhat","ansible","api","monitoring","rbac","workflow"],
        "url": "/2022/02/14/middle-class-rbac-solidfire-ansible.html",
        "teaser": null
      },{
        "title": "Create SolidFire volumes and accounts with Terraform",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. My previous post on Terraform with SolidFire used the updated example from the NetApp ElementSW Provider repo on Github. This post is for folks who’ve tried (or at least reviewed) that approach, so that we can jump straight...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","go","terraform","plugin","provider","devops","gitops"],
        "url": "/2022/02/17/create-maintain-solidfire-volumes-accounts-with-terraform.html",
        "teaser": null
      },{
        "title": "Kubernetes with Cinder CSI on Openstack and SolidFire - Part 1",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Posts in “Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena with SolidFire 12.3” series (this post) Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena with SolidFire 12.3 - Part 1 Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena...","categories": ["virtualization","kubernetes","solidfire"],
        "tags": ["netapp","solidfire","openstack","cinder","xena","provisioning","driver","csi"],
        "url": "/2022/02/22/openstack-solidfire.html",
        "teaser": null
      },{
        "title": "Fix Trident's expired credentials for Kubernetes API",
        "excerpt":"Today I got this error on Kubernetes v1.23.4 while trying out a Trident CLI command (tridentctl): Error: found the Kubernetes CLI, but it exited with error: Unable to connect to the server: x509: certificate has expired or is not yet valid: current time 2022-03-01T07:51:19Z is after 2022-02-17T05:32:52Z There are many...","categories": ["kubernetes","automation"],
        "tags": ["netapp","trident","api"],
        "url": "/2022/03/01/trident-login-kubernetes.html",
        "teaser": null
      },{
        "title": "Kubernetes with Cinder CSI on Openstack and SolidFire - Part 2",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Posts in “Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena with SolidFire 12.3” series Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena with SolidFire 12.3 - Part 1 (this post) Kubernetes with Cinder CSI Plugin on Openstack Yoga/Xena...","categories": ["virtualization","kubernetes","openstack","solidfire","storage"],
        "tags": [],
        "url": "/2022/03/02/openstack-solidfire-part-2.html",
        "teaser": null
      },{
        "title": "S3 Select and other new features of NetApp StorageGRID 11.6",
        "excerpt":"What’s new in StorageGRID 11.6 S3 Select Example 1: Basic Example 2: Network-efficient log grep Example 3: Brute Force Sizer for SolidFire What you need to know when using StorageGRID S3 Select feature StorageGRID log forwarding Demos What’s new in StorageGRID 11.6 StorageGRID 11.6 just came out and it has...","categories": ["storage","analytics"],
        "tags": [],
        "url": "/2022/03/04/storagegrid-s3-select.html",
        "teaser": null
      },{
        "title": "Elasticsearch 8 with NetApp storage",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Elasticsearch and NetApp storage systems Sizing and management Precise storage sizing Use cases for “enterprise” storage features Asymmetric configurations To NFS or not to NFS? Object storage (S3 flavor) Install Elasticsearch with iSCSI-backed data store on ONTAP or...","categories": ["storage","containers","analytics"],
        "tags": ["elk","elasticsearch","netapp","solidfire","ontap","e-series","eseries","logging","log","visualization","audit"],
        "url": "/2022/03/06/elastic-elk-stack-on-netapp.html",
        "teaser": null
      },{
        "title": "S3 Select vs. remote SQL access to CSV over FUSE",
        "excerpt":"In a recent post I wrote about S3 Select in StorageGRID 11.6. From that post - and various AWS S3 Select material out there which is pretty abundant - you’ll see that best approach to querying flat files on S3 almost always “depends” on multiple factors. There are many ways...","categories": ["storage","analytics"],
        "tags": ["sql select","s3","storagegrid","parquet","csv","sql"],
        "url": "/2022/03/10/s3-select-vs-remote-csv-over-fuse.html",
        "teaser": null
      },{
        "title": "Check Active IQ connectivity from HCC on SolidFire mNode",
        "excerpt":"One annoyance with Active IQ connectivity from Hybrid Cloud Control for SolidFire/NetApp HCI/eSDS is that it’s not easy to tell what’s going on with it when it doesn’t work. This post is about some basic steps to check its status. First we check if the container is up and running....","categories": ["storage"],
        "tags": ["netapp","activeiq","aiq","hcc","hci","solidfire"],
        "url": "/2022/03/11/solidfire-mnode-active-iq-connectivity.html",
        "teaser": null
      },{
        "title": "VMware Photon 4.0 with SolidFire 12 iSCSI Target",
        "excerpt":"Summary Why Because you may want to connect to SolidFire iSCSI targets from VMware Photon OS. Say, Docker. Potentially Kubernetes as well. How to iSCSI Build iSCSI package from Photon source RPM file for your version, for example here. Unfortunately the Photon documentation isn’t the greatest, so install all Development...","categories": ["virtualization","solidfire"],
        "tags": ["netapp","solidfire","photon","vmware","vsphere","iscsi"],
        "url": "/2022/03/11/vmware-photon-iscsi-solidfire.html",
        "teaser": null
      },{
        "title": "Velero V1.8 with Restic, SolidFire 12.3 and StorageGRID 11.5",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Introduction Backup and restore Kubernetes application data and metadata to S3 Is this “good enough” or … Using Velero and Restic to backup regular SolidFire volumes Summary Introduction I wrote about Velero &amp; Trident CSI (also about Velero...","categories": ["kubernetes","storage"],
        "tags": ["netapp","velero","restic","backup","data protection","s3","storagegrid","solidfire"],
        "url": "/2022/03/15/velero-18-with-restic-and-trident-2201.html",
        "teaser": null
      },{
        "title": "curl with native JSON support and SolidFire API",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Until now, using curl with JSON was somewhat complicated. --data [arg] --header \"Content-Type: application/json\" --header \"Accept: application/json\" Because I don’t use it every day, every time I want to compose a JSON-capable curl command, I had to look...","categories": ["automation"],
        "tags": ["netapp","solidfire","curl","api"],
        "url": "/2022/03/17/curl-json-solidfire-api.html",
        "teaser": null
      },{
        "title": "Evaluating ONTAP S3 performance with s3tester",
        "excerpt":"ONTAP has had S3 service for a while now. While ONTAP S3 isn’t meant to take over large and complex S3 workloads in which NetApp StorageGRID excels, it is more than capable of servicing many S3 requirements. People use ONTAP S3 for various purposes, from container registry (Red Hat Quay)...","categories": ["storage"],
        "tags": ["netapp","ontap","ontap s3","s3","performance","benchmark","s3tester"],
        "url": "/2022/03/17/ontap-s3-performance-test.html",
        "teaser": null
      },{
        "title": "Simplify data workflows with Kestra",
        "excerpt":"Introduction Sometimes I blog about storage-specific automation and usually I focus on SolidFire because it… just damn works. I’ve also written several scripts - for backup and whatnot - that showcase how SolidFire makes it easy to automate somewhat complex actions. The SolidFire architecture and developer-friendly API make that possible....","categories": ["automation"],
        "tags": ["kestra","workflow","python"],
        "url": "/2022/03/22/solidfire-storagegrid-data-workflows-kestra.html",
        "teaser": null
      },{
        "title": "HashiCorp Nomad with NetApp SolidFire-backed iSCSI volumes",
        "excerpt":"Introduction Deploy Nomad with SolidFire Host Volumes Backup and restore Backup data from VM with SolidFire-based as Host Volumes Backup data from VM running Docker with dynamically-provisioned SolidFire volumes Backup to S3 and anti-ransomware measures Backup and restore test Host Volumes vs. dynamic provisioning (with and without CSI plugin) Dynamically...","categories": ["storage","automation","containers"],
        "tags": ["nomad","hashicorp","solidfire","docker","trident","iscsi"],
        "url": "/2022/03/23/nomad-solidfire-hostpath-volumes.html",
        "teaser": null
      },{
        "title": "HashiCorp Nomad CSI with NetApp SolidFire and E-Series back-ends",
        "excerpt":"Introduction NetApp E-Series NetApp BeeGFS CSI Other CSI provisioners and non-CSI approaches NetApp SolidFire Cinder CSI Other and non-CSI approaches Summary Introduction This page contains some details about CSI plugins which work with HashiCorp Nomad CSI and NetApp SolidFire and E-Series storage. Note that HashiCorp Nomad v1.3.0 will officially support...","categories": ["automation","storage","containers"],
        "tags": ["beegfs","netapp","e-series","docker","trident"],
        "url": "/2022/03/28/nomad-democratic-csi.html",
        "teaser": null
      },{
        "title": "Manage SolidFire from Jupyter Python or .NET notebooks",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Introduction SolidFire can be managed interactively from both Jupyter (using Python SDK) and .NET (using SolidFire PowerShell module) notebooks. Not everything needs to be interactively managed, but NetApp has the DataOps Toolkit and while unstructured data...","categories": ["automation","storage","solidfire"],
        "tags": ["netapp","api","jupyter","powershell","workflow"],
        "url": "/2022/03/29/manage-solidfire-jupyter-powershell.html",
        "teaser": null
      },{
        "title": "SolidFire capacity and efficiency report generator",
        "excerpt":"NOTICE: any and all credentials and tokens on this page are samples, not leaked. Intro Yesterday I published a sample Jupyter notebook for SolidFire automation and didn’t have the time or will to screw around with tables and charts. But then I spent the entire evening working on it. Couple...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","report","visualize","powershell"],
        "url": "/2022/03/30/solidfire-capacity-report-html5.html",
        "teaser": null
      },{
        "title": "On-prem Platform9 Managed Kubernetes with SolidFire",
        "excerpt":"Introduction As I set out to do some K8s work that was a good chance to try another Kubernetes distribution with SolidFire. Platform9 Managed Kubernetes (PMK) has a free offering for on-premises Kubernetes clusters that works similar to how NetApp Kubernetes Service used to work (while in beta). You can...","categories": ["kubernetes","storage"],
        "tags": ["netapp","platform","pmk","trident","solidfire"],
        "url": "/2022/03/31/platform-managed-kubernetes-pmk-on-prem-solidfire.html",
        "teaser": null
      },{
        "title": "Rest Server with NetApp E-Series",
        "excerpt":"Introduction How it works Rest Server E-Series Dealing with the risk of storage-side snapshot rotation Storage efficiency Thin vs thick SANtricity volumes Limiting backup window Other use cases Summary Introduction Restic is one of several popular open source backup-and-restore applications. Restic can be executed manually or from other scripts or...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","restic","rest server","backup","data protection"],
        "url": "/2022/04/03/restic-server-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Nomad batch jobs with BeeGFS and E-Series",
        "excerpt":"Introduction Setup Generic batch job with I/O to parallel filesystem File format conversion Summary Demo Introduction When I wrote about HashiCorp Nomad with NetApp SolidFire last week I mentioned how BeeGFS CSI with NetApp E-Series is of to-do items. This post isn’t about CSI, but an intermediate step. Now, there...","categories": ["storage","containers","kubernetes"],
        "tags": ["netapp","eseries","e-series","nomad","hashicorp","beegfs","workflow","analytics"],
        "url": "/2022/04/05/nomad-beegfs-eseries.html",
        "teaser": null
      },{
        "title": "Consume SolidFire storage from Proxmox hosts",
        "excerpt":"Configure Proxmox 7.1 with SolidFire 12.3 SolidFire Demo VM on Proxmox Some notes for folks who want to use Proxmox 7.1 with SolidFire 12… (PVE 8.4 also works!) Configure Proxmox 7.1 with SolidFire 12.3 First, create a tenant account on SolidFire, such as proxmox1 (in the case you have multiple...","categories": ["storage","containers","virtualization"],
        "tags": ["netapp","solidfire","proxmox","iscsi","lvm"],
        "url": "/2022/04/05/proxmox-solidfire.html",
        "teaser": null
      },{
        "title": "An introduction to NetApp BeeGFS CSI",
        "excerpt":"Introduction Use cases Getting started Options in a mixed environment Deploy and use BeeGFS CSI Data protection Summary Demo Introduction The E-Series devs behind BeeGFS CSI have done a great job not only developing this provisioner but also introducing it to the world. HPC, ML and Data Analytics haven’t been...","categories": ["containers","kubernetes"],
        "tags": ["netapp","e-series","eseries","beegfs","csi"],
        "url": "/2022/04/09/beegfs-csi-introduction.html",
        "teaser": null
      },{
        "title": "Backup and restore NetApp BeeGFS CSI PVs with Kanister",
        "excerpt":"Introduction What Kanister does Summary Demo Introduction In my previous post on BeeGFS CSI I touched upon the topic of data protection with BeeGFS CSI. Here’s a screenshot from that post, showing a restore of Kanister backup for flat files (Wordpress Web site) and a database (MySQL back-end). I didn’t...","categories": ["storage","containers"],
        "tags": ["netapp","e-series","eseries","csi","beegfs","kanister"],
        "url": "/2022/04/13/backup-restore-beegfs-csi-pv-with-kanister-kasten.html",
        "teaser": null
      },{
        "title": "Scaling out Nomad batch jobs with BeeGFS and NetApp E-Series",
        "excerpt":"Introduction Setup Scaling-out IO-intensive batch jobs Shared file system vs. file server vs. internal disk Scale-out batch jobs with Nomad I/O and BeeGFS Getting data in and out of the cluster Scaling out batch jobs File format conversion Simple approach for small clusters Medium and large scale Getting the files...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","beegfs","nomad","workflow"],
        "url": "/2022/04/24/nomad-batch-job-scale-out-parallel-filesystem-beegfs-e-netapp-series.html",
        "teaser": null
      },{
        "title": "SolidFire Operator for Kubernetes",
        "excerpt":"solidfire-operator is a Proof-of-Concept operator for Kubernetes built using Operator Framework. At the time of publishing this post, it doesn’t do anything useful. It can make changes to SolidFire QoS policies, which in all likelihood is completely useless for your Kubernetes environment. If I find the concept useful I may...","categories": ["automation","storage","containers"],
        "tags": ["netapp","solidfire","redhat","ansible","api","python","devops"],
        "url": "/2022/04/28/solidfire-operator-kubernetes.html",
        "teaser": null
      },{
        "title": "Ephemeral volumes with BeeGFS CSI provisioner on Kubernetes",
        "excerpt":"One of more obvious characteristics of Persistent Volumes is they persist, i.e. survive pod(s) that use them until the claim for the PV itself is deleted, assuming reclaim policy is set to Delete. This isn’t ideal for workloads where pods need a PVC only as long as they run, because...","categories": ["kubernetes","storage"],
        "tags": ["netapp","solidfire","ephemeral","csi","trident"],
        "url": "/2022/04/29/kubernetes-ephemeral-volumes-solidfire-eseries.html",
        "teaser": null
      },{
        "title": "BeeGFS and BeeGFS CSI on ARM64",
        "excerpt":"BeeGFS 7.3.0 for ARM64 Attempt 1 Attempt 2 Video walk-through BeeGFS 7.3.0 for ARM64 ThinkParQ recently released BeeGFS 7.3.0. You can read about it in this press release. The technical types can check the release notes. For me the most exciting novelty is support for ARM64. Why? Well, ARM64 systems...","categories": ["kubernetes","storage"],
        "tags": ["netapp","beegfs","eseries","e-series","arm64","csi"],
        "url": "/2022/04/30/beegfs-csi-on-arm64.html",
        "teaser": null
      },{
        "title": "SolidFire Collector on Kubernetes",
        "excerpt":"What is SFC Making SolidFire Collector work with Kubernetes Appendix: Deploymennt for SFC and Graphite What is SFC Some SolidFire users may have heard of SolidFire Collector, a monitoring tool for SolidFire-based arrays which, after the launch of NetApp HCI, became HCI Collector and added vSphere monitoring. I made one...","categories": ["projects","solidfire"],
        "tags": ["netapp","solidfire","visualize","python","monitoring"],
        "url": "/2022/05/02/solidfire-collector-in-kubernetes.html",
        "teaser": null
      },{
        "title": "Trident CSI REST API",
        "excerpt":"Why access Trident API Controller routes Trident resources Expose the Trident REST API Examples What about it Appendix: List of Trident Resources Why access Trident API Why would one want to access the Trident API? Maybe there’s a bug in the CLI, maybe something’s not readily available through the CLI,...","categories": ["kubernetes","containers","storage"],
        "tags": ["netapp","trident","csi","rest","api"],
        "url": "/2022/05/04/trident-csi-api.html",
        "teaser": null
      },{
        "title": "SolidFire Backup to S3 with Object Lock",
        "excerpt":"How would we use SolidFire Backup to S3 with Object Lock-enabled buckets Practical observations How many S3 objects or accounts do we need Determine suitable access policy Backup job tagging and Object Locks Compliance vs. governance mode How to get to a point-in-time version of an object Conclusion How would...","categories": ["automation","storage"],
        "tags": ["netapp","solidfire","s3","object lock","backup","data protection"],
        "url": "/2022/05/06/solidire-backup-to-s3-with-object-lock.html",
        "teaser": null
      },{
        "title": "GA of SolidFire 12.5",
        "excerpt":"SolidFire and eSDS (containerized SolidFire for 3rd party x86 servers) version 12.5 just came out. I haven’t tried it yet - I’m downloading the SolidFire Demo VM 12.5 as I write this - so I can’t share my personal findings about it, but it has a bunch of small improvements...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire"],
        "url": "/2022/05/17/solidfire-12.5.html",
        "teaser": null
      },{
        "title": "Kubernetes with vSphere CSI Plugin and NetApp E-Series",
        "excerpt":"NetApp E-Series are fast-performing disk arrays frequently used by big data, analytics, video processing, NOSQL databases, and HPC applications. You can find more about E-Series here (SSD, HDD) and here (NVMe, SSD, HDD). I don’t have any statistics or breakdowns of how E-Series is used in Kubernetes environments, but if...","categories": ["virtualization","storage","kubernetes"],
        "tags": ["netapp","vmware","tanzu","vsphere","e-series","eseries","csi"],
        "url": "/2022/05/18/vmware-tanzu-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Rightsizing compute resources in the cloud with Spot.io",
        "excerpt":"Most cloud users know about the various options to rent cloud compute resources. Hyperscalers provide recommendations or at least cost reports that give the user the information necessary to make better selection and placement decisions. The problem is how to analyze that information - it’s too much for spreadsheets, and...","categories": ["cloud"],
        "tags": ["netapp","spot.io","economics","sizing"],
        "url": "/2022/05/30/rightsizing-in-the-cloud.html",
        "teaser": null
      },{
        "title": "The new Kasten K10 v5.0 with NetApp SolidFire",
        "excerpt":"Kubernetes-native RBAC S3 Object Lock support “Officialized” (Kanister) blueprints for SQL Server and PostgreSQL Operator aka PGO OpenStack and vSphere in Infrastructure Profiles “Officialized” Veeam Backup Server in Location Profiles K10 v5.0.0 with NetApp SolidFire 12 and NetApp Trident 22.04 The snapshot stuff Selected screenshots Conclusion Appendix A - NetApp...","categories": ["storage","kubernetes"],
        "tags": ["netapp","solidfire","kasten","backup","data management","kanister","trident"],
        "url": "/2022/06/07/kasten-k10-v5-with-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Copy files to/from BeeGFS before or after scheduled jobs",
        "excerpt":"While the ability to move files (or blocks) from and to other filesystems is nice, it isn’t always necessary or desirable. To keep this short, let’s say we have the following situation: Data ($HOME, etc.) lives on ONTAP NFS or StorageGRID S3 Some compute jobs must run, or simply run...","categories": ["analytics"],
        "tags": ["netapp","beegfs","eseries","e-series","workflow","automation"],
        "url": "/2022/06/14/batch-copy-files-beegfs.html",
        "teaser": null
      },{
        "title": "Apache Hadoop 3 with NetApp E-Series",
        "excerpt":"HDFS Durability and External Protected Storage Does everyone need RF2 HDFS Erasure Coding Compression NFS gateway Snapshots HttpFS, WebHDFS Recommended settings for E-Series Recommendations for Cloudera Enterprise Summary HDFS Durability and External Protected Storage For a long while HDFS predominantly used three replica policy (sometimes shortened as “RF3”) with the...","categories": ["analytics","storage"],
        "tags": ["netapp","e-series","eseries","hadoop","hdfs"],
        "url": "/2022/06/22/e-series-hdfs.html",
        "teaser": null
      },{
        "title": "E-Series as Tier One for multi-tiered Kafka clusters",
        "excerpt":"Multi-tiered storage in Kafka clusters How to leverage E-Series Performance vs. data protection overhead Sequential performance vs. latency Tiering to S3 Compression Evaluating data efficiency Snapshots and replication Environmentals Conclusion I’ve blogged about the unnecessary decade long abuse of JBOD and DAS storage in the context of Hadoop, Splunk, Elastic,...","categories": ["analytics","storage"],
        "tags": ["netapp","eseries","e-series","kafka"],
        "url": "/2022/06/28/kafka-eseries-object-storage.html",
        "teaser": null
      },{
        "title": "Storage efficiency with Kafka 3.2 and NetApp SolidFire 12",
        "excerpt":"Objective How I tested Kafka tests and results Random ASCII records StorageGRID audit log Protecting Kafka on a single site Sizing with RF2 Summary and conclusion Objective I wanted to see how much data efficiency is lost on SolidFire with Kafka’s RF2 and RF3 as well as due to optional...","categories": ["analytics","storage"],
        "tags": ["netapp","solidfire","kafka","efficiency","e-series"],
        "url": "/2022/07/05/kafka-solidfire-efficiency.html",
        "teaser": null
      },{
        "title": "Apache Ozone S3 and NetApp E-Series",
        "excerpt":"I’m supposed to be resting this week and that hasn’t been working out… Still, I’ll try to keep this one shorter than the previous two posts from this week. WTF is Apache Ozone Why should we use Apache Ozone What does Ozone look like S3 gateway Ozone with E-Series To-Do...","categories": ["analytics","storage"],
        "tags": ["netapp","e-series","eseries","s3","apache","ozone"],
        "url": "/2022/07/06/apache-ozone-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Milvus with SolidFire and E-Series",
        "excerpt":"WTF is Milvus Storage-related stuff Meta storage (etcd) Logs and queues Object store Storage efficiency High availability of block and S3 storage services Aggregate performance on E-Series WTF is Milvus Milvus is a vector database built for scalable similarity search. Storage-related stuff To get Milvus up and running I first...","categories": ["analytics","storage"],
        "tags": ["netapp","storage","milvus","lnn","vector database","search"],
        "url": "/2022/07/07/milvus-with-solidfire-e-series.html",
        "teaser": null
      },{
        "title": "Cassandra with SolidFire and E-Series",
        "excerpt":"Introduction Apache Cassandra is an open-source NoSQL distributed database. DataStax has a commercial, value-added bundle based on Cassandra called DataStax Enterprise and a cloud service AstraDB which provides zero lock-in guarantee (users can always fall back to open-source Cassandra). A while ago NetApp released a Technical Report TR-4635 (“NetApp SolidFire...","categories": ["analytics","storage"],
        "tags": ["netapp","cassandra","solidfire","eseries","e-series","database"],
        "url": "/2022/07/09/datastax-cassandra-with-netapp-solidfire-e-series.html",
        "teaser": null
      },{
        "title": "XCP-ng and XOA with NetApp SolidFire iSCSI Storage Repositories",
        "excerpt":"Introduction XCP-NG with SolidFire XOA Conclusion Introduction XCP-ng is an open-source fork of Citrix Xen Server. As the thing with Broadcom and VMware unfolds, people are looking for alternatives. It “feels” similar to Proxmox (which I wrote about here). Although underlying hypervisor technology is different, storage-related integration with iSCSI is...","categories": ["virtualization","storage"],
        "tags": ["netapp","solidfire","xen","xcp-ng","xen server"],
        "url": "/2022/07/10/xcp-ng-with-netapp-solidfire-iscsi.html",
        "teaser": null
      },{
        "title": "Show per-node performance guarantees of SolidFire storage nodes",
        "excerpt":"There’s a PowerShell script sfvid2nid.ps1 in my Awesome SolidFire repository on Github. It produces a table that shows the mapping of volume IDs to node IDs. SolidFire users sometimes ask about checking if their volumes are well-balanced. SolidFire has its own definition of “well” means and users have no direct...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","visualize","api","performance","QoS"],
        "url": "/2022/08/04/solidfire-volume-to-node-and-min-guarantees-per-node.html",
        "teaser": null
      },{
        "title": "Apptainer with BeeGFS",
        "excerpt":"Apptainer is based on the Singularity project. It has several advantages over Docker and Portman, but in this post I’ll just write about the ease of use for users who use containers to interactively access shared files (in this case, files on BeeGFS). Apptainer can be installed on hosts that...","categories": ["storage","containers"],
        "tags": ["netapp","apptainer","beegfs","e-series","eseries"],
        "url": "/2022/08/08/apptainer-with-beegfs-mounts.html",
        "teaser": null
      },{
        "title": "S3 service for BeeGFS using Hashicorp Nomad and MinIO gateway",
        "excerpt":"I have a small Nomad cluster which can access a BeeGFS filesystem. One of these host runs Nomad server and client, another runs just Nomad client. Both are also BeeGFS clients. I want to make a BeeGFS directory accessible via S3. Download MinIO, accept the license, etc. Then run this...","categories": ["storage"],
        "tags": ["minio","eseries","nomad","hashicorp","s3","eseries","e-series","netapp"],
        "url": "/2022/08/09/nomad-beegfs-minio-s3.html",
        "teaser": null
      },{
        "title": "Leverage BeeGFS in Nextflow to avoid unnecessary data movement",
        "excerpt":"Nextflow configuration and environment variables allow us to make use of BeeGFS with E-Series for most demanding IO tasks. For an example, I may want to keep shared assets in one directory (or on one BeeGFS filesystem) and use another directory as working directory: assets: /mnt/beegfs/assets working directory: /mnt/beegfs/apptainer If...","categories": ["storage","analytics","containers"],
        "tags": ["netapp","beegfs","nextflow","workflow","eseries"],
        "url": "/2022/08/11/leverage-beegfs-nextflow.html",
        "teaser": null
      },{
        "title": "Nomad pack for InfluxDB with BeeGFS filesystem",
        "excerpt":"Nomad Pack and Nomad BeeGFS Nomad Pack for InfluxDB on Nomad with BeeGFS Backup \\&amp; restore Using influx backup Conclusion Nomad Pack and Nomad Nomad Pack is a little bit like “Helm for Nomad”. It’s very new so not yet as powerful as Helm, but considering how much simpler and...","categories": ["storage","containers"],
        "tags": ["beegfs","influxdb","monitoring","visualize","e-series","eseries"],
        "url": "/2022/08/11/nomad-pack-influxdb-beegfs.html",
        "teaser": null
      },{
        "title": "BeeGFS and NetApp E-Series metrics in InfluxDB v2 or Prometheus",
        "excerpt":"NOTE: Since BeeGFS v7.3.3 there’s an improved and self-contained monitoring package. There’s no need to use this approach on BeeGFS v7.3.3 and beyond. See the docs. NetApp has a BeeGFS solution which consists of ThinqParQ BeeGFS and NetApp E-Series arrays. Servers that run BeeGFS are purchased separately from one of...","categories": ["storage","analytics"],
        "tags": ["netapp","e-series","eseries","beegfs","influxdb","prometheus","visualize","monitoring"],
        "url": "/2022/08/15/monitoring-beegfs-and-netapp-eseries-grafana.html",
        "teaser": null
      },{
        "title": "Rocky Linux 8, 9 with NetApp Trident for Docker and SolidFire 12",
        "excerpt":"The official Trident documentation is okay, but it mentions no Rocky Linux. The other problem is Red Hat-like distributions tend to default to Podman, but I couldn’t install Trident Docker volume plugin with Podman. At this time the plugin seems to work only with Docker. Trident Docker volume driver for...","categories": ["storage","linux","solidfire"],
        "tags": ["rocky linux","rocky","linux","trident","docker","solidfire","iscsi"],
        "url": "/2022/08/21/rocky-linux-docker-netapp-trident-solidfire.html",
        "teaser": null
      },{
        "title": "Oracle TimesTen Classic XE notes",
        "excerpt":"Oracle TimesTen XE Classic v22.1 has quite a few requirements and settings related to memory and storage. Some attributes directly and indirectly related to storage: PermSize - the size in MB of the permanent memory region (default: 128) TempSize - the size in MB of the temporary region (default: 64;...","categories": ["storage"],
        "tags": ["oracle","timesten","database","performance"],
        "url": "/2022/08/21/timesten-xe-notes.html",
        "teaser": null
      },{
        "title": "Configuration approaches to NetApp E-Series with ThinkParQ BeeGFS",
        "excerpt":"It may not be easy to digest how BeeGFS with NetApp E-Series is usually configured. One of the good reasons is that it can be configured in many different ways, but then people just ask for one or two suggestions to look at. Another is that many BeeGFS clusters out...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","beegfs","sizing"],
        "url": "/2022/08/28/configuring-netapp-e-series-solution-for-beegfs.html",
        "teaser": null
      },{
        "title": "SolidFire Backup to S3 over Storage Network",
        "excerpt":"Normally SolidFire 11 and 12 use Management Network for volume backup. Some users prefer to have backup flow over Storage Network. To find a workaround I setup a singleton SolidFire Demo VM with a “reversed” IP configuration: eth0 (Management Interface) - connect it to iSCSI storage network and assign it...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","s3","backup","networking","s3","storage network","iscsi"],
        "url": "/2022/08/29/solidfire-backup-to-s3-over-storage-network.html",
        "teaser": null
      },{
        "title": "SBOM with signed Apptainer containers on BeeGFS",
        "excerpt":"Introduction Why Build data-app container and check its inventory Use it Conclusion Introduction To give credit where credit is due - this post is inspired by a recent update from Singularity in which they noted that Syft has added support for the SIF format used by Singularity (and Apptainer). I...","categories": ["containers"],
        "tags": ["apptainer","sbom","security"],
        "url": "/2022/08/30/apptainer-beegfs-software-bom-sbom.html",
        "teaser": null
      },{
        "title": "LXD containers and VMs on BeeGFS with NetApp E-Series",
        "excerpt":"Introduction Why LXD on BeeGFS (with or without NetApp E-Series) Get started Optimal BeeGFS settings HA BeeGFS client in LXD VMs on LXD server accessing BeeGFS on E-Series Storage-related rant Issues and workarounds Conclusion Introduction LXD is a handy virtualization platform for containers and virtual machines. It also supports Windows...","categories": ["storage","containers","virtualization"],
        "tags": ["beegfs","lxd","container","eseries","e-series"],
        "url": "/2022/09/02/lxd-containers-vms-on-beegfs.html",
        "teaser": null
      },{
        "title": "Brute force sizing NetApp E-Series",
        "excerpt":"Introduction Considerations Create configuration options Choice of query tool Show available options Query capacity range Manual selection of promising candidates Discuss and configure Where’s the metadata, Kenneth What about the performance Why not use MS Excel Alternative approach: Web page with sort and filter features Conclusion NOTE: the Web site...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","sizing","capacity"],
        "url": "/2022/09/04/brute-force-sizing-netapp-eseries.html",
        "teaser": null
      },{
        "title": "New Dynamic Disk Pool configuration and E-Series SANtricity",
        "excerpt":"Dynamic Disk Pools vs. Disk Groups New DDP configuration What does that mean? Things to note SANtricity Web Services Proxy Web Proxy Container Docs DDP DDP and Thin Volumes Examples of automation with Python Summary Appendix A - GET pools Appendix B - POST volumes Appendix C - GET volumes...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","ddp","api","automation","python","powershell"],
        "url": "/2022/09/12/new-ddp-and-e-series-santricity-web-restful-api.html",
        "teaser": null
      },{
        "title": "Reading Weka's documentation",
        "excerpt":"Weka has a nice documentation site based on GitBook. I love good documentation! It’s a Friday evening and I have nothing else to do, so I thought to RTFM and take some notes. Scalability: Scalable: The Weka system linear performance depends on the size of the cluster. Consequently, a certain...","categories": ["random"],
        "tags": ["weka","weka.io"],
        "url": "/2022/09/17/rtfm-weka.html",
        "teaser": null
      },{
        "title": "DDP capacity splitter for E-Series",
        "excerpt":"NOTE: the Web site with this tool was improved and updated on 2024/04/19, so some details below may differ from current functionality Since mid 2022 it’s possible to create smaller DDPs (Dynamic Disk Pools) on SSD-based E-Series arrays. I blogged about it here. As mentioned in that post, the DDP...","categories": ["projects","storage"],
        "tags": ["netapp","e-series","eseries","sizing","capacity","ddp"],
        "url": "/2022/09/18/eseries-ddp-capacity-splitter.html",
        "teaser": null
      },{
        "title": "End of Availability for SolidFire",
        "excerpt":"This week NetApp released product communique CPC-00467 (NetApp support portal login required) on end of availability of SolidFire. EOA is isn’t going to happen immediately so, similarly to NetApp HCI, there’s ample time for users to refresh existing hardware if they want to, and continue using their SolidFire cluster(s). In...","categories": ["solidfire"],
        "tags": ["netapp","solidfire","eoa","end of availability"],
        "url": "/2022/09/23/eoa-solidfire.html",
        "teaser": null
      },{
        "title": "TensorStore with BeeGFS",
        "excerpt":"TensorStore is a new C++ and Python library that provides a uniform API for reading and writing n-dimensional data. Among its Kv store drivers of interest to BeeGFS users is the file driver which uses the filesystem as a key-value store. The key is filesystem path (directory) and the value(s)...","categories": ["analytics","storage"],
        "tags": ["tensorstore","beegfs","eseries","e-series","netapp"],
        "url": "/2022/09/23/tensorstore-with-beegfs.html",
        "teaser": null
      },{
        "title": "Low-hanging BeeGFS efficiency fruit",
        "excerpt":"Following my previous post on TensorStore with BeeGFS I thought I should revisit another item from my lengthy to-do list: filesystem compression. E-Series and storage efficiency Even many NetApp customers aren’t familiar with E-Series so I’ll just say this quickly: E-Series aims to have a lean data path and deliver...","categories": ["storage"],
        "tags": ["netapp","beegfs","e-series","eseries","efficiency","compression"],
        "url": "/2022/09/24/low-hanging-storage-efficiency-fruit-beegfs.html",
        "teaser": null
      },{
        "title": "NetApp Trident v22.07.0 for ARM64",
        "excerpt":"I had thought the posts I wrote about Trident on ARM64 were enough to get almost everyone going, but it seems it’s not hard to get stuck. So I’ve spent a few more hours to: Fork NetApp Trident v22.07.0 Build Trident v22.07.0 for ARM64 Post the updated container to Docker...","categories": ["containers","storage"],
        "tags": ["netapp","trident","csi","arm64"],
        "url": "/2022/09/25/unofficial-netapp-trident-for-arm64.html",
        "teaser": null
      },{
        "title": "Speed of volume creation with BeeGFS CSI",
        "excerpt":"While reading the excellent article Why We Migrated from Kubernetes to Nomad (2021) it occurred to me I spotted some of the same advantages while working on Nomad posts for this blog. I then thought to do a simple experiment to quantity one of the things I noticed, which is...","categories": ["containers","storage"],
        "tags": ["netapp","beegfs","csi","nomad","hashicorp","eseries","e-series"],
        "url": "/2022/09/27/beegfs-csi-nomad-kubernetes.html",
        "teaser": null
      },{
        "title": "Hybrid cloud scenarios with Cloudflare serverless",
        "excerpt":"Introduction Cloudflare scenarios for Hybrid Cloud users Experiment Conclusion Introduction Cloudflare is building a better infrastructure for Hybrid Cloud: Simpler (less cognitive overload) Lower cost Better-performing Architecturally sound (in my opinion) I wanted to illustrate and comment on currently or soon-to-be available options from a perspective of on-premises storage options....","categories": ["cloud","storage"],
        "tags": ["netapp","solidfire","cloudflare","workers","hybrid cloud","containers"],
        "url": "/2022/09/29/cloudflare-serverless.html",
        "teaser": null
      },{
        "title": "Velero 1.9 with AWS and CSI plugins for ARM64",
        "excerpt":"Introduction Non-CSI with Restic and NetApp BeeGFS CSI CSI with NetApp Trident What’s new in 1.9 and 1.8 Velero on ARM64 Restic (ARM64) CSI (ARM64) Introduction See how to prepare the S3 credentials file in this post. Then install after inserting your own S3-related values in the below. AWS S3...","categories": ["kubernetes","storage"],
        "tags": ["netapp","velero","csi","arm64","plugin"],
        "url": "/2022/09/30/velero-backup-192.html",
        "teaser": null
      },{
        "title": "BeeGFS filesystem event monitoring with watcher",
        "excerpt":"Maybe you’ve used an app (or an ONTAP feature) that makes use of the FPolicy API. FPolicy is proven in large and busy NAS environments, and has rich features and integrations for auditing, anti-ransomware protection and more. It is commercially licensed, mostly to ISVs. On Linux OS there are several...","categories": ["storage"],
        "tags": ["watch","beegfs","fsnotify"],
        "url": "/2022/10/19/watch-beegfs-filesystem.html",
        "teaser": null
      },{
        "title": "iRODS or Robinhood HSM with BeeGFS",
        "excerpt":"BeeGFS can work with different storage targets, so just like with Spectrum Scale it is possible to create a filesystem that spans across different disk media and protection schemes. But sometimes you need to move data to another location, for which different filesystems have different approaches. For example: Tier cold...","categories": ["storage"],
        "tags": ["netapp","hsm","irods","beegfs","eseries","e-series"],
        "url": "/2022/10/20/beegfs-hsm-irods-robinhood.html",
        "teaser": null
      },{
        "title": "Notes on MinIO performance with NetApp E-Series",
        "excerpt":"I’ve written about several ways we can take advantage of MinIO with NetApp E-Series back-ends, for example in the post on MinIO on HashiCorp Nomad with BeeGFS I show how BeeGFS/E-Series users can run MinIO to get S3 service without dedicated S3 appliances. I haven’t focused on performance because I...","categories": ["storage"],
        "tags": ["netapp","s3","minio","e-series","eseries","performance"],
        "url": "/2022/10/21/minio-performance-netapp-e-series.html",
        "teaser": null
      },{
        "title": "Rocky Linux 8 and 9 added to NetApp E-Series interoperability matrix",
        "excerpt":"Rocky Linux 8 and 9 have been added to the NetApp E-Series interoperability matrix starting with SANtricity 11.70. Rocky Linux is an open-source enterprise operating system designed to be 100% bug-for-bug compatible with Red Hat Enterprise Linux®. It is under intensive development by the community. Linux is probably the most...","categories": ["storage","linux"],
        "tags": ["netapp","e-series","eseries","rocky linux","rocky","iscsi","fc"],
        "url": "/2022/10/26/e-series-rocky-linux.html",
        "teaser": null
      },{
        "title": "Notes on NetApp E-Series Performance Analyzer",
        "excerpt":"Should we use E-Series Performance Analyzer or SANtricity Web UI to monitor E-Series performance Various E-Series Performance Analyzer (EPA) notes Authentication Using JWT for EPA collector Bypass Web Services Proxy Bypass Web Services Proxy with Graphite (Carbon) instead of InfluxDB v1 Summary Demo and resources NOTE: Credentials in this post...","categories": ["storage"],
        "tags": ["epa","e-series","eseries","grafana","influxdb","python","visualize","monitoring"],
        "url": "/2022/10/26/eseries-performance-analyzer-e-series.html",
        "teaser": null
      },{
        "title": "E-Series SANtricity API with JWT aka Bearer Tokens",
        "excerpt":"Introduction API Check TLS Traditional login JWTs Use SANtricity Bearer Token Demo References Conclusion Introduction SANtricity 11.74 supports JWTs aka bearer tokens. These let us access the API without authentication. Why? You can monitor E-Series performance via the API using a read-only SANtricity account without having its current password You...","categories": ["storage","automation"],
        "tags": ["netapp","devops","api","santricity","jwt","auth","token","login"],
        "url": "/2022/11/08/eseries-santricity-jwt-bearer-tokens.html",
        "teaser": null
      },{
        "title": "On-prem Spot Instaclustr-managed clusters with NetApp E-Series storage",
        "excerpt":"Introduction Compute layer and storage interconnect Small and large clusters HDDs, SSDs, RAID, DDP… How to automate E-Series volume provisioning to hosts Data protection and replication Data and application migration Conclusion Introduction If you haven’t heard of Instaclustr, please visit their Web site and read their blog to find out...","categories": ["storage","cloud"],
        "tags": ["netapp","spot.io","instaclustr","hybrid cloud"],
        "url": "/2022/11/11/netapp-spot-instaclustr-eseries.html",
        "teaser": null
      },{
        "title": "PowerShell password change for local E-Series SANtricity OS users",
        "excerpt":"Long story short, password rotation scripts should directly use the SANtricity (or Web Services Proxy, if you can’t get directly to SANtricity) API and not the CLI. My script can pick either controller and optionally validate the new password. Here I use the admin credentials to set a new password...","categories": ["automation","storage"],
        "tags": ["netapp","e-series","eseries","powershell","api","script","password","santricity"],
        "url": "/2022/12/07/eseries-password-change-powershell.html",
        "teaser": null
      },{
        "title": "Kubernetes and E-Series - DirectPV, TopoLVM, CSI Driver LVM CSI",
        "excerpt":"CSI choices for E-Series in a Kubernetes environment What’s out there in terms of DAS CSI for Kubernetes Unique DAS approaches How does it work? Advantages of using DAS CSI with E-Series disk arrays Redundancy and data protection with DAS CSI and E-Series Client connectivity RAID level or DDP Volume...","categories": ["kubernetes","storage"],
        "tags": ["netapp","e-series","eseries","directpv","csi","topolvm","lvm csi"],
        "url": "/2022/12/09/directpv-topolvm-csi-lvm-das-k8s-with-eseries.html",
        "teaser": null
      },{
        "title": "Forward E-Series SANtricity logs to remote syslog server",
        "excerpt":"Configure SANtricity to send array events to a remote syslog server Configure your syslog server to be able to receive syslog events on a UDP port. Example with an rsyslog server listening at 10514/UDP and accepting logs from two arrays; each has two controllers so we use a compare filter...","categories": ["storage"],
        "tags": ["netapp","logging","log","eseries","e-series","syslog","forwarding"],
        "url": "/2022/12/12/eseries-syslog-forwarding.html",
        "teaser": null
      },{
        "title": "Prometheus exporter for NetApp E-Series SANtricity OS",
        "excerpt":"NetApp E-Series Prometheus Exporter Recently I forked E-Series Performance Analyzer (“EPA”) so that it can work without SANtricity Web Services Proxy. As mentioned in that post, EPA pushes data to the aged InfluxDB v1, so in recent days I’ve been thinking how to modernize that part of EPA’s Collector. That’s...","categories": ["storage"],
        "tags": ["netapp","eseries","e-series","visualize","prometheus","monitoring","santricity"],
        "url": "/2022/12/12/monitoring-netapp-eseries-with-prometheus.html",
        "teaser": null
      },{
        "title": "Gathering and forwarding E-Series SANtricity Major Event Log (MEL)",
        "excerpt":"E-Series Performance Analyzer (EPA) v3.0.0 collects MEL (Major Event Log) events and send them to InfluxDB. I think SANtricity syslog events have similar information but I haven’t yet observed them in that context. MEL (Major Event Log) To get MEL events from the SANtricity API we query the API: curl...","categories": ["storage"],
        "tags": ["netapp","eseries","e-series","mel","event","log","logging","monitoring"],
        "url": "/2022/12/13/eseries-santricity-mel-forwarding.html",
        "teaser": null
      },{
        "title": "NetApp BeeGFS CSI driver 1.4.0",
        "excerpt":"This week NetApp released BeeGFS CSI driver v1.4.0 which adds support for newer Kubernetes and BeeGFS. Apart from these updates, container images are now signed with Cosign so no matter if you install the driver from a copy on public registry or upload copy to own registry, you can easily...","categories": ["storage","kubernetes"],
        "tags": ["netapp","beeegfs","csi","eseries","e-series"],
        "url": "/2022/12/16/eseries-beegfs-csi-driver-140.html",
        "teaser": null
      },{
        "title": "SSD disk wear indicator in E-Series SANtricity 11.70",
        "excerpt":"E-Series SANtricity 11.70 shows wear level for SSD/NVMe disks. To view it, simply navigate to view physical disk properties. The indicator shows wear level as amount of performed writes performed so far divided by total supported amount writes for this disk over its lifetime. Two percent means the disk can...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","monitoring","ssd","wear","epa","grafana","santricity"],
        "url": "/2022/12/21/eseries-ssd-wear-indicator-santricity-117.html",
        "teaser": null
      },{
        "title": "GA of SolidFire 12.7",
        "excerpt":"SolidFire and eSDS (containerized SolidFire for 3rd party x86 servers) version 12.7 was released in late October, but I haven’t blogged about it. I won’t rehash the official What’s new, but I’ll copy the list: Secure CHAP algorithms Dynamic block (bin) sync-in rate Storage node firmware updates Garbage Collection improvement...","categories": ["solidfire"],
        "tags": ["netapp","solidfire"],
        "url": "/2022/12/22/solidfire-12.7.html",
        "teaser": null
      },{
        "title": "Monitor wear level of NetApp E-Series SSDs with API and CLI",
        "excerpt":"At some point (I couldn’t find the exact release in the documentation, but I’ve found it v11.52) E-Series Engineering added SSD wear level metrics to the SANtricity API. Recently I made a short post on where to find that indicator in the SANtricity Web UI. This post is about getting...","categories": ["storage"],
        "tags": ["netapp","eseries","e-series","flash","epa","monitoring","wear","visualization","santricity","grafana"],
        "url": "/2023/01/08/eseries-flash-ssd-wear-level-monitoring.html",
        "teaser": null
      },{
        "title": "Burst on-premises BeeGFS/E-Series to Spot Ocean in the cloud",
        "excerpt":"Problem statement Data replication Storage CSI drivers GPU compute nodes Performance monitoring Workflow Problem statement Enterprises with analytics, HPC and Deep Learning workloads that have high-bandwidth storage requirements use BeeGFS with NetApp E-Series. For various reasons they may need to burst-to-cloud. Some of the main challenges in this process: Data...","categories": ["storage","cloud"],
        "tags": ["spot.io","spot","analytics","beegfs","eseries","e-series","instaclustr","hybrid cloud"],
        "url": "/2023/01/12/beegfs-eseries-hybrid-cloud-spot-ocean-spark.html",
        "teaser": null
      },{
        "title": "NetApp E-Series Performance Analyzer in container environments",
        "excerpt":"EPA on Kubernetes and Nomad is here It took some time to find the time… But it’s almost ready now: in EPA 3.1.0, E-Series metrics collector is completely disentangled from InfluxDB management and operation, and can run on its own (in a shell, Docker, Kubernetes, Nomad). I’m still working on...","categories": ["storage","containers"],
        "tags": ["netapp","epa","e-series","eseries","grafana","influxdb","python","kubernetes","nomad","monitoring","visualization"],
        "url": "/2023/01/14/eseries-performance-analyzer-container-orchestrator-kubernetes.html",
        "teaser": null
      },{
        "title": "Like Flask, but with PowerShell",
        "excerpt":"PowerShell (still) rocks PowerShell-based services Some ideas and use cases De-skill Kubernetes operations Provide RBAC to PowerShell automation Improve logging and monitoring Conclusion PowerShell (still) rocks I haven’t written (and won’t write) a “2022 in review” kind of post, but I did think about it. One of the topics I...","categories": ["automation"],
        "tags": ["PowerShell","reporting","scripting","DevOps"],
        "url": "/2023/01/17/automation-with-powershell-server.html",
        "teaser": null
      },{
        "title": "Flash media overprovisioning on NetApp E-Series",
        "excerpt":"Why overprovisioning exists Who needs this BeeGFS example Who doesn’t need this Impact on capacity sizing Impact on deployment Resources Why overprovisioning exists “Dude, where’s my capacity?” People sometimes get confused by “overprovisioning” that E-Series by default does when it uses flash media. I was no exception. This stuff is...","categories": ["storage","containers"],
        "tags": ["e-series","eseries","performance","flash","netapp","overprovisioning","santricity"],
        "url": "/2023/01/17/eseries-ssd-overprovisioning.html",
        "teaser": null
      },{
        "title": "Containerized Cloud Sync Data Broker for Docker, Kubernetes and Nomad",
        "excerpt":"Introduction Containerizing Data Broker Mounting and accessing data But, does it auto-scale? Demo Video demo Introduction I’ve written two posts about Cloud Sync, programmable NetApp service for file replication and migration and mentioned it in a bunch of others. The Cloud Sync service runs in the cloud, but scanning and...","categories": ["cloud","containers"],
        "tags": ["Cloud Sync","CloudSync","Docker","Kubernetes","Nomad","NetApp","replication","sync","data broker"],
        "url": "/2023/01/19/containerized-netapp-cloudsync.html",
        "teaser": null
      },{
        "title": "Minimizing ransomware risks for SolidFire data",
        "excerpt":"SolidFire vs. Ransomware If you want best ransomware protection, consider ONTAP. There’s a lot about it, so I won’t rehash it. Second, if you have SolidFire, that doesn’t mean you’re defenseless. I’ve never seen anyone write about that, so I decided to do something about it. I won’t make this...","categories": ["storage"],
        "tags": ["SolidFire","snapshot","ransomware","NetApp","ransomware"],
        "url": "/2023/02/01/solidfire-vs-ransomware.html",
        "teaser": null
      },{
        "title": "Use Cloud Sync API and Elasticsearch to improve data replication",
        "excerpt":"Why and when automate Cloud Sync? Some NetApp Cloud Sync users have many sync relationships (as in dozens). (As of recently the new name for Cloud Sync is “BlueXP Copy and Sync”, but I won’t use it.) At that scale, the use of the Cloud Sync API can become justified....","categories": ["automation"],
        "tags": ["Cloud Sync","CloudSync","monitoring","metrics","ELK","Elastic","Elasticsearch","visualization"],
        "url": "/2023/02/06/cloud-sync-elasticsearch.html",
        "teaser": null
      },{
        "title": "Store Kasten backups on NetApp E-Series",
        "excerpt":"Backup repository choices for Kasten with E-Series Veeam Repository S3 bucket NFS share Which one to use? Cost and performance Security Backup repository choices for Kasten with E-Series Many Veeam users use E-Series. There’s a NetApp Technical Report for it, currently a copy can be found here. How about Kasten...","categories": ["kubernetes"],
        "tags": ["E-Series","Kasten","eseries","backup","k8s","Kubernetes","netapp","data protection"],
        "url": "/2023/02/09/veeam-eseries-nfs-storage-provider.html",
        "teaser": null
      },{
        "title": "Backup/restore E-Series Performance Analyzer with Kasten K10",
        "excerpt":"Introduction Backup Customizing backup scripts Restore Scenario 1: delete deployments, PVCs and PVs, restore from repository Scenario 2: force delete Trident/SolidFire volumes, followed by the entire epa namespace Scenario 3: revert to a Kasten/Trident snapshot Quirks and fine-tuning Demo Summary Introduction Yesterday’s post on using Kasten with various backup repositories...","categories": ["kubernetes"],
        "tags": ["E-Series","Kasten","eseries","backup","k8s","Kubernetes","epa","influxdb","netapp","data protection"],
        "url": "/2023/02/10/backup-epa-data-on-kubernetes.html",
        "teaser": null
      },{
        "title": "KubeVirt backup, restore with NetApp SolidFire & Kasten K10",
        "excerpt":"Introduction KubeVirt VMs Snapshot and Backup Restore Demo Summary Update Introduction KubeVirt is still early in its development, but it’s getting better. Some SolidFire users are eager to move their VMs to Kubernetes and since I’ve been playing with Kubernetes to test several other things, I decided to take a...","categories": ["kubernetes","virtualization"],
        "tags": ["KubeVirt","Kasten","Trident","backup","k8s","Kubernetes","restore","snapshot","vm","SolidFire","data protection","netapp","trident","csi"],
        "url": "/2023/02/12/backup-restore-kubevirt-vms-with-solidfire-kasten-kubernetes.html",
        "teaser": null
      },{
        "title": "Backup and replicate Kubernetes PVs with SolidFire using VolSync",
        "excerpt":"Introduction VolSync Use cases Walk-through VolSync as generic backup and DR application Closing thoughts Introduction There are literally hundreds of applications and workflows for data replication and synchronization. NetApp alone has several (CloudSync, XCP, plus array-based replication). I’ve blogged about them here and you can find those posts using the...","categories": ["kubernetes"],
        "tags": ["VolSync","Trident","backup","k8s","Kubernetes","replication","snapshot","synchronization","SolidFire","NetApp"],
        "url": "/2023/02/13/volume-replication-solidfire-kubernetes-volsync.html",
        "teaser": null
      },{
        "title": "Velero 1.10 with NetApp Trident and SolidFire",
        "excerpt":"Velero 1.10 came out recently so I tried it with Kubernetes v1.26.1, Trident v23.01, and SolidFire 12.5. tldr; CSI backup works as it used to File-based backup works as well The main changes in Velero 1.10 are the addition of Kopia (also used by Kasten) and improvements in the robustness...","categories": ["kubernetes","storage"],
        "tags": ["SolidFire","velero","backup","CSI","restic","kopia","NetApp","data protection","trident"],
        "url": "/2023/02/17/velero-1-10-with-trident-solidfire.html",
        "teaser": null
      },{
        "title": "Visualize E-Series temperature and power consumption metrics with EPA",
        "excerpt":"EPA v3.3.0 will be the next release of EPA and I’m aiming for two small improvements: Environmental sensor monitoring Power consumption monitoring The first is most likely going to be temperature sensors. I’m still trying to figure out what they mean. The second is total power consumption of the array....","categories": ["storage"],
        "tags": ["E-Series","eseries","monitoring","projects","epa","NetApp","monitoring","visualization"],
        "url": "/2023/02/18/epa-eseries-monitor-sensors-psu-power-consumption.html",
        "teaser": null
      },{
        "title": "Elasticsearch performance with E-Series",
        "excerpt":"Introduction Environment Elasticsearch performance in Docker Simple Web log indexing workload SIEM indexing workload Time-series database (TSDB) indexing workload for general monitoring use cases Indexing latency Search latency Effect of Elasticsearch replicas Should we use Elasticsearch replicas with E-Series Should we use E-Series’ snapshots with Elasticsearch Saturating E-Series controllers Performance...","categories": ["monitoring","storage"],
        "tags": ["E-Series","ELK","eseries","elasticsearch","elastic","observability","monitoring","epa","analytics","netapp"],
        "url": "/2023/02/25/elasticsearch-eseries-performance.html",
        "teaser": null
      },{
        "title": "Protect multi-PVC Kubernetes apps with NetApp Trident, SolidFire",
        "excerpt":"Introduction Cold multi-volume backup without snapshots Group Snapshot-assisted multi-volume backup Backup multi-volume snapshot to S3 with built-in backup-to-S3 Using other methods to backup data from storage snapshots Application-integrated backups Application-consistent snapshots vs. multi-volume storage snapshots Injecting storage snapshot into application-aware workflows Sub-volume partitioning and other tricks Conclusion Introduction Recently I...","categories": ["kubernetes","storage"],
        "tags": ["SolidFire","backup","CSI","trident","Kanister","NetApp"],
        "url": "/2023/02/27/group-multi-volume-backup-solidfire-kubernetes-trident.html",
        "teaser": null
      },{
        "title": "Use cases for AWS mountpoint-s3 with NetApp E-Series and SolidFire",
        "excerpt":"AWS mountpoint-s3 Deploy Use cases for E-Series and SolidFire S3 bucket as backup mountpoint Sub-bucket allocation mountpoint-s3 vs application-native backup to S3 E-Series as S3 storage Data sharing with single-host filesystem Analytics Conclusion AWS mountpoint-s3 AWS mountpoint-s3 lets us mount S3 bucket or its path to a Linux mount point,...","categories": ["kubernetes","storage"],
        "tags": ["E-Series","SolidFire","eseries","backup","S3","analytics","mountpoint-s3","netapp"],
        "url": "/2023/03/16/aws-mountpoint-s3-eseries-solidfire.html",
        "teaser": null
      },{
        "title": "Zero-out and rethin VMDKs on NFS",
        "excerpt":"A workaround for rethinning Create multiple NFS shares for ESXi Mount NFS shares in ESXi Create a VM with extra data disk on one of NFS shares Ensure VM is running and /dev/sdb is usable Format data disk in Linux VM Fill up data disk Remove 50% of data and...","categories": ["virtualization"],
        "tags": ["nfs","ontap","vmware","unmap","rethin","efficiency","flatcar linux","vsphere"],
        "url": "/2023/03/29/zeroout-with-storage-vmotion-rethin.html",
        "teaser": null
      },{
        "title": "Using snapshot attributes in SolidFire",
        "excerpt":"Snapshot attributes in SolidFire Hashtable example Snapshot with attributes Using snapshot attributes Conclusion Snapshot attributes in SolidFire When we create a SolidFire snapshot from the Web UI, we see something like this: That’s not all there is to it. The API allows us to tag snapshots with a hashtable. If...","categories": ["storage","automation"],
        "tags": ["solidfire","snapshot","powershell","backup","consistency group","api","DevOps","netapp"],
        "url": "/2023/04/01/using-solidfire-snapshot-attributes.html",
        "teaser": null
      },{
        "title": "CloudCasa, Velero, NetApp Trident, and SolidFire",
        "excerpt":"Table of Contents Table of Contents Conclusion Introduction Does it work with Trident and SolidFire? How does it work? Summary Conclusion If you’re a Velero user or would like to use Velero if it had a Web UI, give Cloud Casa for Velero a try. Introduction CloudCasa added Velero support...","categories": ["storage","kubernetes"],
        "tags": ["solidfire","backup","kubernetes","csi","cloudcasa","trident","pvc","velero","data protection","netapp"],
        "url": "/2023/04/15/cloudcasa-netapp-trident-solidfire.html",
        "teaser": null
      },{
        "title": "Azure Linux with SolidFire iSCSI targets",
        "excerpt":"Now that Azure Linux is out, maybe some SolidFire users wonder if Azure Linux iSCSI can connect to SolidFire targets? I don’t think there are many such users out there because although Azure Linux can run anywhere, it’s probably going to be rare in on-premises environments. Because of that I’m...","categories": ["storage","solidfire"],
        "tags": ["solidfire","cbl-mariner","kubernetes","azure","linux","netapp"],
        "url": "/2023/05/29/microsoft-azure-linux-with-solidfire-iscsi.html",
        "teaser": null
      },{
        "title": "Versity S3 Gateway",
        "excerpt":"What As some may recall, over a year ago MinIO stopped supporting its gateway deployment type (aka MinIO Gateway). I blogged about that topic here. Since then several things have happened in this are, such as the MinIO-WEKA licensing spat (or maybe more, but I haven’t heard that it progressed...","categories": ["storage"],
        "tags": ["versity","s3","gateway","e-series","eseries"],
        "url": "/2023/06/14/versity-s3-posix-gateway.html",
        "teaser": null
      },{
        "title": "StorageGRID and Elasticsearches",
        "excerpt":"Why “Elasticsearches”? Because there’s more than one. And people often don’t even know enough to be confused. Wait, what? There are two things you can currently (NetApp StorageGRID 11.7) do with Elasticsearch more or less “out of the box”: Log forwarding Search There’s are also things Elasticsearch can do with...","categories": ["storage","analytics"],
        "tags": ["storagegrid","s3","elasticsearch","elk","logstash","syslog","netapp","search"],
        "url": "/2023/07/20/storagegrid-and-elaticsearches.html",
        "teaser": null
      },{
        "title": "Comparison between S3 object versioning and WORM with NetApp StorageGRID",
        "excerpt":"Terms Versioning in the S3 API is a means of keeping multiple variants of an object in the same bucket, according to AWS. WORM is a generic concept and stands for “Write Once, Read Many”. In data storage it describes the ability to create indelible files and directories. Obviously, with...","categories": ["storage"],
        "tags": ["storagegrid","s3","versioning","worm","version","netapp"],
        "url": "/2023/07/21/storagegrid-comparison-between-versioning-and-worm.html",
        "teaser": null
      },{
        "title": "Use ONTAP S3 as backup destination for Velero",
        "excerpt":"Update (2024/06): I haven’t tested this yet, but it seems after Velero AWS Plugin v1.9, ONTAP S3 users can no longer use Velero. One workaround for this is to uninstall Velero plugin for AWS v.1.9 or v1.10 and install v1.8.2 (latest v1.8). See Velero AWS Plugin and SignatureDoesNotMatch nonsense for...","categories": ["storage","backup"],
        "tags": ["s3","velero","object store","backup","data protection","ontap","netapp"],
        "url": "/2023/07/26/ontap-s3-as-velero-object-store.html",
        "teaser": null
      },{
        "title": "Thanos with StorageGRID, ONTAP S3 and MinIO on E-Series",
        "excerpt":"Introduction Thanos’ object storage component seems to use S3-compliant object stores in reasonably simple ways which lead me to believe it should be easy to get working. In this post I examine different choices and mention some high-level guidelines to help NetApp customers determine what may be better for them....","categories": ["storage","analytics"],
        "tags": ["s3","prometheus","object store","thanos","e-series","eseries","minio","ontap","storagegrid","netapp","s3","eseries"],
        "url": "/2023/07/28/thanos-with-minio-eseries-or-ontap-s3.html",
        "teaser": null
      },{
        "title": "SolidFire management Web site and API endpoint behind a proxy",
        "excerpt":"Introduction Later (12.*) versions of SolidFire have this annoying authentication callback redirect which seems to prevent proper reverse proxying of the Web UI. I haven’t found a way to make HTTPS reverse proxy work for the Web UI. Environment and problem description Client: 192.168.1.13 Proxy server: 192.168.1.137 (s137.datafabric.lan) with a...","categories": ["storage","solidfire"],
        "tags": ["api","proxy","squid","nginx","reverse proxy","forward proxy","api","DevOps","netapp"],
        "url": "/2023/07/31/solidfire-web-management-api-behind-proxy.html",
        "teaser": null
      },{
        "title": "FSCrawler for basic filesystem analytics in Elasticsearch",
        "excerpt":"Introduction Sometimes you want files, directories, and even content indexed and searchable for whatever purposes. FSCrawler does that, it also stores various metadata (and allows you to customize it, obviously) and it’s free. It uses Apache Tika and can optionally perform Tesseract-based OCR. See their docs for more. What is...","categories": ["storage","analytics"],
        "tags": ["elk","elasticsearch","fscrawler","compliance","audit","filesytem","compliance","indexing","search"],
        "url": "/2023/08/01/fscrawler-filesystem-analytics-elasticsearch.html",
        "teaser": null
      },{
        "title": "Change E-Series DDP preservation capacity on-the-fly",
        "excerpt":"Requirement Some users want to start small and flexibly add disks in small increments (1, 2, 3) later. For various reasons, DDP is a good match for that. The most obvious argument against using classic RAID is one isn’t supposed to create weird RAID 5 or 6 widths - it...","categories": ["storage"],
        "tags": ["e-series","eseries","DDP","pool","preservation","expand","shrink","netapp"],
        "url": "/2023/08/02/eseries-increase-reserve-preservation-capacity-drives.html",
        "teaser": null
      },{
        "title": "What's new in NetApp Trident v23.07",
        "excerpt":"Introduction Trident v23.07 hasn’t been officially released or announced, but the code seems finalized. Rather than wait for the official announcement and republish some of its highlights, I’ll simply comment on the details I find noteworthy. Notably, while I use Trident, I don’t deep dive into it with ONTAP backends....","categories": ["storage","kubernetes"],
        "tags": ["csi","netapp","solidfire","ontap","trident","arm64"],
        "url": "/2023/08/02/netapp-trident-v2307.html",
        "teaser": null
      },{
        "title": "Basic notes on h2o GPT from a storage perspective",
        "excerpt":"So… I don’t use Generative AI. I used it a bit before it was popular (before ChatGPT 4.0 came out) to automate SolidFire CLI, saw how it works, and while it was interesting I didn’t see immediate use cases for it in my life. Now Generative AIs are much more...","categories": ["storage"],
        "tags": ["ai","gpt","generative ai","h2o","lln","netapp"],
        "url": "/2023/08/04/h2o-storage-notes-h2ogpt.html",
        "teaser": null
      },{
        "title": "StatefulSet PVC Retention with Trident and SolidFire",
        "excerpt":"Introduction PVC retention has entered beta in Kubernetes v1.27, and some Trident-SolidFire users may be wondering if that’s something that can benefit them and how. As a reminder, the persistentVolumeClaimRetentionPolicy section is new: apiVersion: apps/v1 kind: StatefulSet ... spec: persistentVolumeClaimRetentionPolicy: whenDeleted: Retain whenScaled: Delete As you probably figure, these will...","categories": ["storage","kubernetes"],
        "tags": ["csi","netapp","solidfire","trident","statefulset","retention","netapp"],
        "url": "/2023/08/21/trident-new-stateful-set-delete-feature.html",
        "teaser": null
      },{
        "title": "Per-site erasure-coded copies of data with NetApp StorageGRID",
        "excerpt":"Introduction By default NetApp StorageGRID uses “2 Copy” ILM policy: make 2 copies anywhere, as long as it’s on different nodes. Because StorageGRID storage nodes use protected storage (RAID-like, not JBOD), storage node’s data is already protected from disk drive loss. As always, there are situations where people want, need...","categories": ["storage"],
        "tags": ["s3","ilm","ec","storagegrid","policy","erasure coding","netapp"],
        "url": "/2023/08/22/storagegrid-simple-two-site-copy-and-ec-ilm-example.html",
        "teaser": null
      },{
        "title": "SolidFire backup-to-S3 using ONTAP S3 destination",
        "excerpt":"Introduction Backup to ONTAP S3 Network configuration Workflow Discussion Backup to ONTAP S3 DR to ONTAP S3 Alternative “backup to S3” approaches Conclusion Introduction SolidFire can backup its volume contents to, and restore from, generic S3 object stores. It’s a free feature included with every cluster. AWS S3, (post-v12) MinIO,...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","s3","backup","restore","snapmirror","ontap s3"],
        "url": "/2023/08/26/solidfire-backup-to-ontap-s3.html",
        "teaser": null
      },{
        "title": "Microsoft SQL Server data virtualization PolyBase with S3 Object Stores",
        "excerpt":"What, why and how HTTP Access from SQL Server Where does Docker come in Other S3 clients Backup use case Compatibility Conclusion What, why and how PolyBase is a data virtualization feature in Microsoft SQL Server and Azure Synapse Analytics. What does it do? PolyBase enables your SQL Server instance...","categories": ["storage","analytics"],
        "tags": ["storagegrid","s3","ontap s3","sql server","parquet","polybase","backup"],
        "url": "/2023/08/28/sql-server-polybase-s3.html",
        "teaser": null
      },{
        "title": "Storage considerations for Memphis message broker",
        "excerpt":"What is Memphis Storage-related observations Tiers S3 tier Disk and object storage (S3) considerations Conclusion What is Memphis According to them, Memphis.dev is an intelligent, frictionless message broker. I would describe it is “Kafka minus headaches”. If you hate Java, you may like Memphis. At this time Memphis is at...","categories": ["analytics"],
        "tags": ["memphis","s3","eseries","e-series","broker","message broker","queue","streaming","analytics","memphis.dev"],
        "url": "/2023/08/29/introduction-to-memphis-message-broker.html",
        "teaser": null
      },{
        "title": "Monitor SolidFire clone and backup jobs through API",
        "excerpt":"Problem API methods Finding SolidFire API limits Clone jobs Slice sync jobs Clone sync jobs Remote sync jobs Bulk (backup, restore) jobs Opportunities for improvements and integrations Faster access to volume clones Faster multiple clones from a single volume Auto-adjust QoS on volumes involved in bulk jobs Get available bulk...","categories": ["solidfire","automation"],
        "tags": ["netapp","solidfire","api","powershell","python","clone","backup","sync","data protection"],
        "url": "/2023/08/30/monitoring-solidfire-clone-and-backup-jobs.html",
        "teaser": null
      },{
        "title": "Teradata Vantage with NetApp S3 object stores",
        "excerpt":"Introduction Teradata Vantage Impressive screenshot Choosing S3 Storage Officially supported Sequential performance Scale of capacity Random performance Multi-site deployments Conclusion Introduction External tables on S3 are asn increasingly popular solution. From the “built-in” (into the S3 API) S3 Select to Teradata, you can use S3 like a database. As I’ve...","categories": ["analytics"],
        "tags": ["storagegrid","s3","ontap s3","teradata","nos","delta lake","json","parquet","vantage"],
        "url": "/2023/08/31/teradata-ons-s3-netapp.html",
        "teaser": null
      },{
        "title": "Block volume mode in Kubernetes with SolidFire",
        "excerpt":"Introduction Digression Purpose Volume mode in PVC How does this help us with git clone problem Conclusion Appendix A - example with Trident v24.06 and SolidFire Introduction Two days ago I revisited some old volume backup and cloning topics. Digression Later that day I spotted this query in a community...","categories": ["kubernetes","solidfire","storage"],
        "tags": ["kubernetes","csi","trident","solidfire","volumemode","fileystem","btrfs","zfs"],
        "url": "/2023/09/01/kubernetes-solidfire-block-volumemode.html",
        "teaser": null
      },{
        "title": "SolidFire backup-to-S3 with Backblaze",
        "excerpt":"I’ve written a dozen posts about SolidFire’s “backup to S3”, so I’ll just skip all that and focus on Backblaze. To test if SolidFire’s backup to S3 feature can work with Backblaze, I create a new bucket solidfire-backup (bucket name must be unique service-wide, so pick another name!). I didn’t...","categories": ["solidfire"],
        "tags": ["solidfire","restore","backup","s3","b2","s3","backblaze","restore","data management"],
        "url": "/2023/09/02/solidfire-backup-to-s3-backblaze-b2.html",
        "teaser": null
      },{
        "title": "Using synthetic SolidFire S3 backups for Dev/Test purposes",
        "excerpt":"Why Automation Generate data and backup volumes Restore S3 backups to new SolidFire volumes Restore-related notes Cost estimation Conclusion Why It’s one of those seemingly obvious things - after you’ve read the title, you know what it is and it seems so simple. But - like me - maybe you’ve...","categories": ["solidfire","automation"],
        "tags": ["solidfire","restore","sample","s3","volume","data","devops","synthetic"],
        "url": "/2023/09/02/solidfire-test-volumes.html",
        "teaser": null
      },{
        "title": "MinIO Erasure Coding with NetApp E-Series",
        "excerpt":"The concept Recommendations Single rack Three racks Non-standard EC:1 on VI/K8s with E-Series Tolerance to disk loss E-Series with unprotected media MinIO without EC Getting the most out of E-Series in MinIO EC environments Appendix A The concept I’ve touched upon this in previous blog posts, but I wanted to...","categories": ["storage"],
        "tags": ["netapp","minio","s3","e-series","eseries","dpp","ec","erasure coding","ef300","ef600"],
        "url": "/2023/09/03/minio-erasure-coding-and-netapp-e-series.html",
        "teaser": null
      },{
        "title": "Use Simple Backups to file-backup cloned SolidFire volumes to S3/B2",
        "excerpt":"What is Simple Backups? Use Simple Backups for File-type backup with SolidFire clones mounted to a “backup VM” Backup sizes compared to SolidFire’s Backup to S3 Thoughts on Simple Backups Needs improvement The good Conclusion What is Simple Backups? Today I evaluated Simple Backups, a managed backup-as-a-service. Simple Backups can...","categories": ["solidfire","automation"],
        "tags": ["solidfire","restore","simple backups","s3","simplebackups","data","data protection","backup"],
        "url": "/2023/09/03/simplebackup-with-solidbackup.html",
        "teaser": null
      },{
        "title": "SolidBackup with Kopia",
        "excerpt":"Objectives and tools Steps to set up backup with Kopia Steps on OS and SolidBackup Steps related to Kopia Ensuring SolidBackup and Kopia schedules don’t overlap Refresh source volumes for next round of SolidBackup cloning Steps to restore a volume or file Alternative approaches to using Kopia One Kopia per...","categories": ["solidfire","automation"],
        "tags": ["solidfire","restore","kopia","s3","data","data protection","backup","b2"],
        "url": "/2023/09/03/solidbackup-with-kopia.html",
        "teaser": null
      },{
        "title": "ThinkParQ takes over NetApp-created BeeGFS CSI driver",
        "excerpt":"I’ve written several posts about NetApp’s BeeGFS CSI driver. BeeGFS CSI for Kubernetes The Github project has been cleanly transferred to ThinkParQ, so BeeGFS users can keep using it. Because of the transfer, the old link still works - it redirects to the new link and both of these links...","categories": ["kubernetes","storage"],
        "tags": ["e-series","beegfs","kubernetes","netapp","csi"],
        "url": "/2023/09/08/beegfs-csi-driver-lives-on.html",
        "teaser": null
      },{
        "title": "Velero 1.12 and CSI Snapshot Data Movement with NetApp SolidFire",
        "excerpt":"Introduction WTF is CSI Snapshot Data Movement (CSI SDM) Why is that a Good Thing Get ready to use CSI SDM with NetApp Astra Trident CSI and SolidFire Software stack Backup workflow Conclusion Appendix A - Demo Appendix B - CSI SDM backup job details Introduction I’ve written a bunch...","categories": ["kubernetes","solidfire"],
        "tags": ["solidfire","netapp","velero","snapshot","csi","backup","kopia"],
        "url": "/2023/09/15/velero-csi-snapshot-data-movement-with-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Event monitoring with SNMP traps from NetApp E-Series arrays",
        "excerpt":"Introduction Configure SNMP trap destination in SANtricity OS Get E-Series MIB files and OID SANtricity SNMP walk SANtricity SNMP traps and trap examples E-Series-specific SM10-R3-MIB and ES-NETAPP Generic Other approaches to delivering notifications to SNMP trap destinations Forwarding notifications to other SNMP and non-SNMP destinations Conclusion Appendix A - E-Series...","categories": ["storage"],
        "tags": ["e-series","eseries","netapp","observability","mib","oid","monitoring","INF-01-00"],
        "url": "/2023/09/17/netapp-e-series-snmp-trap-notifications.html",
        "teaser": null
      },{
        "title": "Versity S3 Gateway with BeeGFS",
        "excerpt":"What Config How Using Conclusion Appendix - External performance test What I’ve blogged about VersityGW before and concluded that for some users it’s a promising alternative to MinIO GW. That includes the users of NetApp’s BeeGFS-E-Series solution. Usually the goal is to be able to download files via S3. S3...","categories": ["storage"],
        "tags": ["versity","s3","gateway","e-series","eseries","beegfs","versitygw"],
        "url": "/2023/09/20/versity-gw-s3-posix-gateway-beegfs-eseries.html",
        "teaser": null
      },{
        "title": "Ubuntu 22.04 LTS as iSER client to NetApp E-Series",
        "excerpt":"Problem statement E-Series side Ubuntu side Hardware and software stack Setup workflow Tips and tricks SANtricity Host settings SANtricity iSER settings OS rescue mode What’s what and Mellanox OFED Netplan and MTU ifaces Multipath Target discovery Volume partitioning and sanlun command Conclusion Problem statement WTF is iSER? iSER aka iSCSI...","categories": ["storage"],
        "tags": ["rdma","iser","iscsi","e-series","eseries","netapp","ef-series"],
        "url": "/2023/09/22/ubuntu-lts-netapp-eseries-iser.html",
        "teaser": null
      },{
        "title": "Monitoring NetApp E-Series with PRTG",
        "excerpt":"Introduction Software stack Getting E-Series events and metrics into PRTG Generic probes SNMP walk SNMP traps Custom sensor script API access Conclusion Appendix A - SNMP walk (“Needs Attention” status check) Appendix B - SNMP Trap Receiver sensor Appendix C - HTTP Push Data sensor (performance monitoring) Write a script...","categories": ["storage","monitoring"],
        "tags": ["prtg","e-series","eseries","snmp","plugin","traps","custom","powershell"],
        "url": "/2023/09/25/monitoring-netapp-eseries-with-prtg.html",
        "teaser": null
      },{
        "title": "Stand-alone and Consistency Group snapshots on NetApp E-Series",
        "excerpt":"How does it work? Limits Thin or thick? How much to reserve for SANtricity snapshots? What can we do with SANtricity snapshots and clones Use case 1: plain old snapshots Use case 2: snapshots with anti-ransomware characteristics Use case 3: Dev/Test and backup offload Managing reserved capacity Consistency groups and...","categories": ["storage","automation"],
        "tags": ["snapshot","e-series","eseries","powershell","python","api","santricity","consistency group","clone","cg"],
        "url": "/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html",
        "teaser": null
      },{
        "title": "Benefits of RAID 1 in E-Series DDP",
        "excerpt":"What is this about again? Why is RAID 1 on DDP a good idea? Is R1 on DDP really faster? Which workloads can benefit from mixed RAID 1 and RAID 6 volumes in DDP Data loss protection vs. classic RAID 1 VG Conclusion What is this about again? Even now,...","categories": ["storage"],
        "tags": ["e-series","eseries","netapp","ef-series","ddp","volume group","raid1","raid6","r10","r1"],
        "url": "/2023/10/08/raid1-in-netapp-eseries-ddp.html",
        "teaser": null
      },{
        "title": "Monitor snapshot and clone repositories of NetApp E-Series SANtricity OS",
        "excerpt":"Problem statement Considerations First iteration Second iteration Conclusion Problem statement SANtricity has supported snapshots and clones forever, but monitoring them can be a challenge. That is obvious if you look at the SANtricity Web UI: related information may be confusing but if you think of how it could be improved,...","categories": ["storage"],
        "tags": ["e-series","eseries","netapp","ef-series","repository","snapshot","clone","snapshot volume","snapshot image","monitoring"],
        "url": "/2023/10/12/snapshot-clone-repository-monitoring-in-eseries.html",
        "teaser": null
      },{
        "title": "Faster PostgreSQL with DDP-based RAID 1 compared to DDP-based RAID 6",
        "excerpt":"Introduction Environment Tests Results Other performance views Conclusion Introduction In the post Benefits of RAID 1 in E-Series DDP I highlighted the performance benefit of DDP-based RAID 1 over DDP-based RAID 6 using a synthetic performance test (fio). This post attempts to make that comparison more “real-life” by running a...","categories": ["storage"],
        "tags": ["netapp","e-series","eseries","RAID 1","RAID 6","R1","performance","pgbench","postgresql"],
        "url": "/2023/10/17/netapp-eseries-raid1-vs-raid6-ddp-comparison.html",
        "teaser": null
      },{
        "title": "Monitor Snapshot Consistency Groups of NetApp E-Series SANtricity OS",
        "excerpt":"Problem statement Considerations SANtricity UI Consistency Group Sensor for PRTG What’s missing but would be nice to have Conclusion Problem statement SANtricity OS supports Snapshot Consistency Groups (I like to call them CGs) and while it’s easy to use the basic CGs features, it’s not that easy to monitor them....","categories": ["storage"],
        "tags": ["e-series","eseries","netapp","ef-series","consistency group","snapshot","clone","snapshot volume","snapshot image","monitoring"],
        "url": "/2023/10/29/consistency-group-monitoring-in-eseries.html",
        "teaser": null
      },{
        "title": "E-Series Perf Analyzer (EPA) v3.3.0",
        "excerpt":"Introduction Power Temperature What does V3.3.0 do for expansion shelves? What’s next for EPA? Database Grafana Other wish-list items Introduction My fork of E-Series Perf Analyzer (EPA) may soon see another release, v3.3.0. The changes are already in master branch, but I need to do some testing before I release....","categories": ["storage"],
        "tags": ["e-series","eseries","grafana","ef-series","monitoring","observability","influxdb","epa","e-series perf analyzer","psu","temperature","sensors"],
        "url": "/2023/11/04/eseries-perf-analyzer-epa-330.html",
        "teaser": null
      },{
        "title": "NetApp E-Series sizing for Splunk 9 with SmartStore",
        "excerpt":"Introduction Existing material Related posts on this blog Observations TB per day Events per day Sizing challenges Splunk 9 SmartStore StorageGRID StorageGRID performance StorageGRID capacity MinIO E-Series storage layout Storage sizing example with Splunk Enterprise with SmartStore SmartStore on flash media SmartStore on NL-SAS SmartStore churn and slowness Multi-array and...","categories": ["storage"],
        "tags": ["e-series","eseries","ef-series","splunk","smartstore"],
        "url": "/2023/11/06/netapp-eseries-sizing-for-splunk-smartstore.html",
        "teaser": null
      },{
        "title": "Send NetApp SolidFire metrics to Splunk HTTP Event Collector aka HEC",
        "excerpt":"Introduction Splunk makes things a bit more complicated than necessary when it comes to using their evaluation software. At the same time, I have to ask myself is it any easier with SolidFire demo VM? Not really. It requires registration, and Splunk doesn’t. So let’s just move on. But when...","categories": ["storage","solidfire","analytics"],
        "tags": ["splunk","hec","http event collector","monitoring","solidfire","element"],
        "url": "/2023/11/12/send-solidfire-metrics-splunk-hec-http-event-collector.html",
        "teaser": null
      },{
        "title": "Calculate snapshot capacity utilization on NetApp SolidFire",
        "excerpt":"Introduction Clone and analyze Example with Postgres writeBytes metric Cost issue Do we still need to clone those snapshots? How to minimize storage utilization by snapshots Conclusion Introduction Today I came up with an idea on how to calculate snapshot capacity utilization for a storage account on SolidFire. As a...","categories": ["storage","solidfire","monitoring"],
        "tags": ["netapp","solidfire","api","snapshot"],
        "url": "/2023/11/20/netapp-solidfire-calculate-snapshot-capacity-utilization.html",
        "teaser": null
      },{
        "title": "NetApp SolidFire with GenAI and inferencing workloads",
        "excerpt":"Introduction Inferencing with SolidFire Examples Making use of iSCSI Share data with a parallel file system Share data without a parallel file system Use SolidFire from Jupyter Ready-to-clone PVs for tools, applications, models Conclusion Appendix A - volume templates and fast clones Introduction As I’ve mentioned several times, SolidFire isn’t...","categories": ["storage","solidfire","ai"],
        "tags": ["netapp","solidfire","ai","devops"],
        "url": "/2023/11/22/genai-with-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Postgres, pgvector, E-Series and Instaclustr",
        "excerpt":"NOTICE: all credentials and tokens on this page are samples, not leaked. Introduction pgvector Instaclustr NetApp E-Series Wait, what does pgvector actually do and is it any good? pgvector notes Conclusion Introduction In recent years, due to their growing popularity, there’s been a number of new vector databases. Why now?...","categories": ["storage","cloud","analytics"],
        "tags": ["ai","analytics","vector","instaclustr","cloud","ai","postgres","postgresql","pgvector","RAG"],
        "url": "/2023/11/28/postgres-pgvector-instacluster-eseries.html",
        "teaser": null
      },{
        "title": "Snapshots and ILM with Elasticsearch 8",
        "excerpt":"Introduction Elasticsearch “snapshots” Snapshot to S3 vs. snapshot to Path Multiple repositories Backup performance Elasticsearch ILM Relationship between ILM, snapshots and searchable snapshots What does any of this have to do with E-Series? Conclusion Appendix A - selected API responses Introduction I’ve written several posts about Elasticsearch (find them in...","categories": ["storage","analytics"],
        "tags": ["analytics","elasticsearch","ilm","s3","e-series","netapp","e-series","storagegrid","minio","elk","backup"],
        "url": "/2023/11/30/elasticsearch-ilm-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Containerized BeeGFS with NetApp E-Series",
        "excerpt":"Introduction Sometimes we want to run BeeGFS in containers. It’s possible and, since the recent efforts by the BeeGFS vendor ThinkParQ, easy. Why Why deploy containerized BeeGFS? As I demonstrated in BeeGFS in VMs: BeeGFS in VMs can be deployed in minutes (including VMs, 10 minutes) Virtualized BeeGFS can deliver...","categories": ["storage"],
        "tags": ["beegfs","docker","kubernetes","eseries","e-series","netapp"],
        "url": "/2023/12/02/containerized-beegfs-with-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Deceptive nvidia-smi output",
        "excerpt":"I’m curious if I should buy a more expensive GPU so I use nvidia-smi to see how busy the current one is. $ sudo nvidia-smi Wed Dec 6 13:09:01 2023 +---------------------------------------------------------------------------------------+ | NVIDIA-SMI 545.23.08 Driver Version: 545.23.08 CUDA Version: 12.3 | |-----------------------------------------+----------------------+----------------------+ | GPU Name Persistence-M | Bus-Id Disp.A |...","categories": ["monitoring"],
        "tags": ["nvidia"],
        "url": "/2023/12/06/deceptive-nvidia-smi.html",
        "teaser": null
      },{
        "title": "RBAC and delegation for SolidFire JSON-RPC API with Lua",
        "excerpt":"Introduction Fixing RBAC with a TLS-terminating reverse proxy Lua in reverse proxy path JSON-RPC Lua and JSON-RPC Complicate things with custom APIs How can we use this with Trident Conclusion Introduction As explained here, SolidFire never implemented proper RBAC. That post also shows a workaround with Ansible (and Ansible Tower),...","categories": ["storage","solidfire","automation"],
        "tags": ["solidfire","api","rbac","delegation","management","roles"],
        "url": "/2023/12/07/solidfire-rbac-for-json-rpc-api.html",
        "teaser": null
      },{
        "title": "NetApp SolidFire backup to S3 and MinIO compression savings",
        "excerpt":"Introduction SolidFire backup to S3 MinIO compression Results Conclusions Introduction I’m not sure if I used these volumes in this post (also related to SolidFire backup/restore to/from S3) or in the Kopia post. Probably the latter, as the sizes match. Anyway, I got ‘em, there’s 10 of ‘em, each 66.67%...","categories": ["storage","solidfire"],
        "tags": ["solidfire","minio","compression","backup","restore","data protection","netapp"],
        "url": "/2023/12/10/solidfire-backup-to-minio-compression.html",
        "teaser": null
      },{
        "title": "UNMAP/TRIM Hyper-V volumes backed by NetApp SolidFire",
        "excerpt":"Introduction General notes on NTFS rehinning and SolidFire QoS-related tips Prepare Windows host volume SDelete SDelete with Windows guests on Hyper-V TRIM/UMAP enabled vs SDelete Normal behavior (TRIM/UMAP enabled) TRIM/UNMAP disabled TRIM/UNMAP disabled and enabled mid-way Conclusion Introduction Hyper-V users sometimes wonder about various details of rethinning NTFS volumes backed...","categories": ["storage","solidfire"],
        "tags": ["solidfire","windows","unmap","trim","rethin","retrim","ntfs","sdelete"],
        "url": "/2023/12/12/solidfire-unmap-hyper-v.html",
        "teaser": null
      },{
        "title": "PyTorch checkpointing workload with NetApp E-Series",
        "excerpt":"Introduction Torch checkpoints Filesystem format, path and files Example Storage considerations File system considerations S3 vs cluster file system Hybrid cloud options Conclusion Appendix A - Orbax Introduction Checkpoints save the state of the system and that state can be used to resume work without losing work already done. One...","categories": ["storage","ai"],
        "tags": ["pytorch","torch","load","save","distributed","eseries","checkpoint","dcp"],
        "url": "/2024/01/10/ai-deep-learning-pytorch-checkpointing-eseries.html",
        "teaser": null
      },{
        "title": "Kubernetes KEDA with NetApp SolidFire and E-Series",
        "excerpt":"Introduction KEDA concepts and components Scalers KEDA and persistent storage SolidFire E-Series Storage-related events Storage logs Conclusion Introduction WTF is KEDA? From their site: KEDA is a Kubernetes-based Event Driven Autoscaler. With KEDA, you can drive the scaling of any container in Kubernetes based on the number of events needing...","categories": ["storage","kubernetes","automation"],
        "tags": ["kubernetes","autoscaling","keda","e-series","eseries","solidfire","trident","csi"],
        "url": "/2024/01/24/kubernetes-keda-netapp-solidfire-eseries.html",
        "teaser": null
      },{
        "title": "NetApp E-Series DAS or SAN storage as Veeam Hardened Repository",
        "excerpt":"Introduction Longer answer Other notes Disk snapshots and security E-Series vs. internal RAID Hardened repository volumes on E-Series with primary data copy Relevant E-Series configuration steps Conclusion Introduction The idea behind Veeam Hardened Repository is simple: A Linux box runs the Veeam Data Mover Service (veeamtransport) and the Veeam Immutability...","categories": ["storage"],
        "tags": ["netapp","eseries","e-series","backup","restore","veeam","hardened","santricity"],
        "url": "/2024/01/24/netapp-eseries-as-veeam-hardened-repository.html",
        "teaser": null
      },{
        "title": "Scan NetApp StorageGRID S3 buckets for viruses and malware",
        "excerpt":"Introduction Problem description Getting started with a DIY approach Example A smarter approach Preempting and deleting trouble-causing uploads Consider various limitations Use public cloud to scan StorageGRID buckets mirrored to AWS S3 Optional commercial components Conclusion Introduction Scanning of S3 buckets and their content for viruses and malware is not...","categories": ["automation","storage"],
        "tags": ["netapp","storagegrid","s3","AV","antivirus","antimalware","ransomware","scan","virus","malware"],
        "url": "/2024/01/29/antivirus-scanning-for-on-premises-s3.html",
        "teaser": null
      },{
        "title": "How to change NetApp HCI from VMware to alternatives",
        "excerpt":"Introduction Challenges with vSphere 8 on NetApp HCI Alternatives NetApp HCI storage and data migration Summary Appendix A - VirtualBox Appendix B - Using Veeam and Kasten for VM migration Introduction I haven’t heard of any NetApp HCI customers who want to move away from VMware. So “the problem” and...","categories": ["storage","virtualization"],
        "tags": ["solidfire","vmware","netapp hci","hci","proxmox","xcp-ng","hyper-v","linux"],
        "url": "/2024/02/07/migrate-netapp-hci-from-vmware.html",
        "teaser": null
      },{
        "title": "Add NetApp SolidFire iSCSI storage to KVM",
        "excerpt":"Introduction Storage options exposed in Virtual Manager Filesystem directory Physical disk device Preformatted block device iSCSI target LVM mpath ZFS pool Conclusion Introduction Continuing from the previous post on hypervisor OS alternatives for NetApp HCI, this post reviews storage options from KVM with SolidFire. Storage options exposed in Virtual Manager...","categories": ["storage","virtualization","solidfire"],
        "tags": ["solidfire","netapp hci","hci","proxmox","kvm"],
        "url": "/2024/02/11/add-solidfire-storage-from-kvm.html",
        "teaser": null
      },{
        "title": "NetApp StorageGRID on VMware",
        "excerpt":"Introduction Network Servers StorageGRID load balancer OS Storage Flash tier NL-SAS tier DDP vs RAID Groups for object space on storage nodes Maximum storage node capacity for SG SDS Erasure Coding vs 2 Copy policy vSAN as storage backend NetApp E-Series as storage backend StorageGRID pools and grades Storage grades...","categories": ["storage","virtualization"],
        "tags": ["storagegrid","netapp storagegrid","s3","sds"],
        "url": "/2024/02/15/storagegrid-on-vmware.html",
        "teaser": null
      },{
        "title": "VMware license calculator for VVF and VCF",
        "excerpt":"Introduction VMware’s calculator (KB 96426) Example for NetApp HCI Conclusion Introduction Recently I blogged about how NetApp HCI customers can migrate from VMware. As I mentioned in that post, more NetApp HCI users appear to be interested in continuing to use vSphere (either 7 or 8), than in migrating to...","categories": ["virtualization","netapp hci","netapp","hci"],
        "tags": ["broadcom","netapp hci","hci","vmware","licensing"],
        "url": "/2024/02/18/netapp-hci-broadcom-vmware-new-license-calculator.html",
        "teaser": null
      },{
        "title": "Delete old object versions on NetApp StorageGRID",
        "excerpt":"Introduction You may have object versions you don’t want to keep. Or you know you don’t want to keep older versions in some bucket. Why? That’s not important right now. The question is - how? You can use S3 client utilities or S3 API, but you can also configure StorageGRID...","categories": ["storage"],
        "tags": ["storagegrid","netapp storagegrid","s3","versioning","version","ilm"],
        "url": "/2024/02/22/storagegrid-delete-old-object-versions.html",
        "teaser": null
      },{
        "title": "Kafka notifications in NetApp StorageGRID 11.8",
        "excerpt":"Introduction How to configure What do Kafka notifications look like Similarities and differences compared to Elasticsearch search integration Use cases for StorageGRID notifications Storage platform for Kafka Conclusion Introduction Since 11.8, NetApp StorageGRID supports Kafka notifications in addition to the previous cloud-only AWS SNS notifications. SNS works fine, but it...","categories": ["analytics","storage"],
        "tags": ["storagegrid","netapp storagegrid","notifications","elasticsearch","event","kafka","confluent","instaclustr"],
        "url": "/2024/02/23/storagegrid-notifications-kafka.html",
        "teaser": null
      },{
        "title": "ZFS deduplication with NetApp E-Series",
        "excerpt":"Introduction What’s new with ZFS deduplication ZFS and E-Series Benefits of using ZFS with E-Series Deduplication Compression E-Series models for ZFS with modern deduplication Disk layout and performance sizing ZFS hosts Conclusion Appendix - Example with multiple ISO copies Introduction As we all know, ZFS deduplication still sucks (as of...","categories": ["storage"],
        "tags": ["netapp","eseries","fast_dedup","dedup","efficiency","zfs"],
        "url": "/2024/02/26/zfs-deduplication-netapp-eseries.html",
        "teaser": null
      },{
        "title": "ZFS with NetApp E-Series",
        "excerpt":"Introduction What is E-Series anyway Easy storage management Conclusion Introduction This posts is for Incus (or LXD) or ZFS users interested in offloading some of the work to NetApp E-Series. I’ve written about the reasons why one may want to do that in the post on ZFS deduplication. This posts...","categories": ["storage"],
        "tags": ["netapp","eseries","zfs","incus","lxd"],
        "url": "/2024/02/28/incus-zfs-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Ubuntu 24.04 LTS with NetApp SolidFire",
        "excerpt":"Introduction Create, discover, login Efficiency - zpools on SoliFire vs global SolidFire efficiencies Comparison with XFS and BTRFS Operational and data governance differences between ZFS and “classic” Linux filesystems (XFS, EXT4) ZFS in containers Conclusion NOTE: accounts and passwords from this post are given as examples and not used in...","categories": ["storage"],
        "tags": ["netapp","ubuntu","netapp","solidfire","zfs"],
        "url": "/2024/02/29/ubuntu-2404-lts-with-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Monitor progress and notify of E-Series media scan events",
        "excerpt":"Introduction SANtricity API methods related to scrubbing, scanning, fixing data issues Media scan in Web UI Relevant API methods Implementation Example API polling frequency Manual vs. SANtricity-scheduled media scan jobs How to observe SANtricity-initiated media scan events Conclusion NOTE: accounts and passwords from this post are given as examples and...","categories": ["storage","automation"],
        "tags": ["netapp","santricity","e-series","media scan","powershell"],
        "url": "/2024/03/17/monitoring-notifications-eseries-santricity-media-scan-progress.html",
        "teaser": null
      },{
        "title": "Analyze HTTP logs from NetApp StorageGRID gateway nodes",
        "excerpt":"Introduction Log format What needs to happen Parsing with Grok Result Caveats Why you probably don’t need this (but another team may) Legit requests Non-legit requests Introduction Gateway Nodes provide a dedicated load-balancing interface that S3 and Swift client applications can use to connect to StorageGRID. Load balancing maximizes speed...","categories": ["storage","analytics"],
        "tags": ["storagegrid","netapp storagegrid","s3","gateway","version","observability","logstash","grok","log"],
        "url": "/2024/03/18/storagegrid-nlb-http-logs.html",
        "teaser": null
      },{
        "title": "Filesystem block size used by NetApp StorageGRID",
        "excerpt":"So, what filesystem block size does StorageGRID 11.8 use? It’s yet another of those questions you can answer by yourself. Login to a storage node. List filesystems. admin@DC1-S1:~ $ df Filesystem 1K-blocks Used Available Use% Mounted on overlay 20464208 11002652 8396700 57% / tmpfs 65536 8 65528 1% /dev shm...","categories": ["storage"],
        "tags": ["storagegrid","netapp storagegrid","xfs","block size","s3"],
        "url": "/2024/03/18/storagegrid-storage-node-filesystem-block-size.html",
        "teaser": null
      },{
        "title": "Quickly install NetApp Trident v24.02 on ARM64 Kubernetes",
        "excerpt":"Here we go again… I started building Trident for ARM64 years ago, before it was a thing. Because it wasn’t convenient and I disliked the process (or the documentation - in any case, it wasn’t a good experience), I even started maintaining a patched no-brainer fork repository and published Trident...","categories": ["storage","kubernetes"],
        "tags": ["netapp","solidfire","trident","arm64","kubernetes"],
        "url": "/2024/03/21/netapp-trident-v2402-arm64.html",
        "teaser": null
      },{
        "title": "Velero v1.13 metadata, hooks with NetApp Trident v24.02",
        "excerpt":"Introduction Backup detail enhancements in Velero v1.13 Mapping Velero jobs to SolidFire volume and snapshot objects How many Velero instances for two sites with a SolidFire cluster on each Conclusion Appendix A - configuration details Appendix B - backup and details Appendix C - restore and delete Appendix D -...","categories": ["storage","kubernetes"],
        "tags": ["velero","trident","solidfire","snapshot","csi","backup","restore","hooks"],
        "url": "/2024/03/22/velero-trident-backup-job-details.html",
        "teaser": null
      },{
        "title": "Use Velero with NetApp Verda and Trident CSI",
        "excerpt":"What is Verda Example with Redis Conclusion What is Verda This project aims to help users protect popular Kubernetes applications with NetApp Astra Control by taking app-consistent snapshots, backups, and other techniques. Verda has hook scripts for several popular applications and it works best with NetApp Astra Control. The scripts...","categories": ["storage","kubernetes"],
        "tags": ["velero","trident","solidfire","snapshot","csi","backup","restore","hooks","verda"],
        "url": "/2024/03/23/velero-netapp-verda-scripts-and-trident.html",
        "teaser": null
      },{
        "title": "NetApp SANtricity PowerShell module for E-Series",
        "excerpt":"Get NetApp.SANtricity module for PowerShell 5.1 Install and load Use End Appendix A - Known issues \\&amp; workarounds Get NetApp.SANtricity module for PowerShell 5.1 The problem is you can’t. Or maybe you can, but it’s not easy. It appears it was deprecated some time ago and removed from NetApp downloads....","categories": ["storage","automation"],
        "tags": ["e-series","eseries","windows","powershell","devops"],
        "url": "/2024/03/28/netapp-santricity-powershell-module.html",
        "teaser": null
      },{
        "title": "SSD Cache feature on NetApp SANtricity E-Series",
        "excerpt":"WTH is “SSD Cache” Create SSD cache Configure HDD-based volumes to use SSD Cache Summary API for monitoring WTH is “SSD Cache” It’s a feature that makes E-Series arrays store frequently accessed data from HDDs on faster flash disk drives. The documentation isn’t very clear so I’m putting this post...","categories": ["storage"],
        "tags": ["e-series","eseries","ssd","caching","ssd cache"],
        "url": "/2024/03/29/netapp-eseries-santricity-ssd-read-cache.html",
        "teaser": null
      },{
        "title": "Windows Server 2025 with NetApp SolidFire 12 iSCSI",
        "excerpt":"This is the first of possibly several posts on Microsoft Windows Server 2025 and NetApp SolidFire. (you’re here) Part One: Windows Server 2025 with NetApp SolidFire - getting started Part Two: Windows Server 2025 with NetApp SolidFire 12 iSCSI - snapshots and SQL Server 2022 Part Three: Windows Server 2025...","categories": ["storage","solidfire","automation"],
        "tags": ["netapp","solidfire","windows","hyper-v","sql server","iscsi","powershell","devops"],
        "url": "/2024/03/31/windows-server-2025-with-solidfire-part-one.html",
        "teaser": null
      },{
        "title": "Windows Server 2025 with NetApp SolidFire 12 iSCSI Part Three",
        "excerpt":"This is the second of the posts posts on Microsoft Windows Server 2025 and NetApp SolidFire. Part One: Windows Server 2025 with NetApp SolidFire - getting started Part Two: SQL Server T-SQL and Snapshots - using SolidFire snapshots with SQL Server 2022 (you’re here) Part Three: Hyper-V - using Hyper-V...","categories": ["storage","solidfire","automation","virtualization"],
        "tags": ["netapp","solidfire","windows","hyper-v","iscsi"],
        "url": "/2024/04/01/windows-server-2025-with-solidfire-part-three-hyper-v.html",
        "teaser": null
      },{
        "title": "Windows Server 2025 with NetApp SolidFire 12 iSCSI Part Two",
        "excerpt":"This is the second of the posts posts on Microsoft Windows Server 2025 and NetApp SolidFire. Part One: Windows Server 2025 with NetApp SolidFire - getting started (you’re here) Part Two: SQL Server T-SQL Snapshots - using SolidFire snapshots with SQL Server 2022 Part Three: Windows Server 2025 with NetApp...","categories": ["storage","solidfire","automation"],
        "tags": ["netapp","solidfire","windows","hyper-v","sql server","iscsi","powershell","devops"],
        "url": "/2024/04/01/windows-server-2025-with-solidfire-part-two-sql-server-2022.html",
        "teaser": null
      },{
        "title": "NetApp StorageGRID networks",
        "excerpt":"Introduction Because “security”, I can no longer access my corporate “Web drive” from my personal desktop, which is great if you’re trying to get nothing done. But every now and then it’s nice to share some product details with a prospect without being annoyed by MFA prompts even if you’re...","categories": ["storage"],
        "tags": ["netapp","storagegrid","best practices","networking","firewall","s3"],
        "url": "/2024/04/02/storagegrid-networking.html",
        "teaser": null
      },{
        "title": "Backup NetApp SolidFire's non-Kubernetes volumes with Velero",
        "excerpt":"Intro Using Kubernetes to backup non-Kubernetes volumes Dealing with alien filesystems Workflow for backup of non-K8s volumes on SolidFire using Velero Original-to-clone volume mapping Workflow Clone refresh Kubernetes-related tasks Restores Automation and auto-scaling Summary Intro Over the years I’ve been kind of obsessed with DIY backup. Maybe that’s because SolidFire...","categories": ["storage","automation"],
        "tags": ["netapp","s3","backup","restore","solidfire","velero","trident"],
        "url": "/2024/04/09/solidbackup-velero-backup-non-k8s-volumes-netapp-solidfire-to-s3.html",
        "teaser": null
      },{
        "title": "NetApp E-Series with containerized BeeGFS, NFS, S3",
        "excerpt":"Introduction Reinventing the wheel Components Workflow Expected outcome Next steps Security Quotas and ACLs Monitoring Conclusion Introduction Everyone likes to say their storage platform makes AI easy to automate, get started in no time, and so on. Well, I am 100% sure that is the case with NetApp SolidFire. Related...","categories": ["kubernetes","storage","ai"],
        "tags": ["kubernetes","csi","beegfs csi","e-series","eseries","ai"],
        "url": "/2024/04/11/netapp-eseries-containerized-beegfs-nfs-s3-all-in-one.html",
        "teaser": null
      },{
        "title": "EConfig v2",
        "excerpt":"WTF is EConfig? What’s new How I use EConfig DDP BeeGFS Troubles Conclusion Appendix A - BeeGFS sizer WTF is EConfig? EConfig is my site with currently two (unofficial) sizing tools (or utilities, or features, whatever): BeeGFS tool that he map BeeGFS data and metadata capacity requirement to E-Series RAID...","categories": ["storage","projects"],
        "tags": ["netapp","e-series","eseries","sizing","capacity","ddp","beegfs"],
        "url": "/2024/04/23/econfig-update.html",
        "teaser": null
      },{
        "title": "NetApp SolidFire Collector with Grafana 11",
        "excerpt":"You may have heard Grafana 11 is coming out soon. I decided to check if my old SolidFire Collector can work with it. Short answer: it does. A longer answer is below. I could have used the stand-alone Docker version, but I also wanted to make sure the Kubernetes recipe...","categories": ["storage","analytics","projects"],
        "tags": ["sfc","netapp","solidfire","hcicollector","grafana","monitoring"],
        "url": "/2024/04/23/grafana-11-netapp-solidfire-sfc.html",
        "teaser": null
      },{
        "title": "Metrics for NetApp SolidFire backup-to-S3 in InfluxDB and Grafana",
        "excerpt":"Introduction Initiating and monitoring SolidFire backup-to-S3 jobs Initiation Status Progress Completion and result Sending metrics to InfluxDB v1 The little DB that could Kubernetes jobs Conclusion Appendix A - Gauge visualization Appendix B - Grafana alerts Introduction In the previous post I wrote about Grafana 11 (Preview), with which good...","categories": ["storage","analytics"],
        "tags": ["sfc","netapp","solidfire","backup","s3","grafana","monitoring","influxdb"],
        "url": "/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html",
        "teaser": null
      },{
        "title": "OpenAPI and SolidFire",
        "excerpt":"SolidFire doesn’t have an OpenAPI interface. See here. I never tried to find out why, but looking from the outside it appears that during NetApp HCI time NetApp tried to work out an OpenAPI interface for HCC aka “NetApp HCI management node”, so some indirect and limited use of REST...","categories": ["storage"],
        "tags": ["solidfire","netapp","elementos","automation","swagger","openapi","json-rpc","jsonrpc"],
        "url": "/2024/04/25/openapi-swagger-for-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Swagger files for NetApp E-Series",
        "excerpt":"If you want to develop or automate E-Series but aren’t always connected, you may want to work offline with Swagger API files. Get them from the array here: General API Swagger JSON file (commonly used): GET /devmgr/v2/swagger SYMbol API Swagger JSON file (rarely used): GET /devmgr/v2/swagger/symbol Then load them to...","categories": ["storage","automation"],
        "tags": ["e-series","netapp","santricity","automation","swagger","openapi","santricity"],
        "url": "/2024/04/26/swagger-files-netapp-eseries-arrays.html",
        "teaser": null
      },{
        "title": "Tenant (account) attributes on NetApp SolidFire",
        "excerpt":"It took me a while It took me only 6 years to figure out that NetApp SolidFire account object has user-writable attributes. Volume objects also have attributes, of course, and they’re actively used, for example by NetApp Trident, and by my Set-QoSException module. In this screenshot you can see how...","categories": ["storage","automation"],
        "tags": ["solidfire","netapp","api","automation"],
        "url": "/2024/04/30/netapp-solidfire-account-attributes.html",
        "teaser": null
      },{
        "title": "Towards next SolidFire Collector (SFC)",
        "excerpt":"WTF is SFC? Why bother when no one is using it? Progress so far Conclusion WTF is SFC? It’s a niche monitoring script for NetApp SolidFire that I think originates from pre-NetApp time. Originally it consisted of a Python script for Graphite/StatsD. At NetApp, a 3rd party vSphere monitoring plugin...","categories": ["storage","monitoring","solidfire","projects"],
        "tags": ["solidfire","netapp","monitoring","influxdb","grafana","performance","monitoring"],
        "url": "/2024/05/03/netapp-solidfire-collector-next.html",
        "teaser": null
      },{
        "title": "Access NetApp SolidFire API with Async IO",
        "excerpt":"Introduction When using Python with SolidFire I usually use SolidFire Python SDK which in turn uses requests and urllib3. One opportunity for performance enhancement with scripts that issue a lot of Get and List API requests is asynchronous access to the SolidFire API. Opportunities should be evaluated in the context...","categories": ["storage","solidfire"],
        "tags": ["solidfire","netapp","api","performance","devops","automation"],
        "url": "/2024/05/04/netapp-solidfire-with-async-http.html",
        "teaser": null
      },{
        "title": "Remove password complexity requirements on Ubuntu 24.04 LTS",
        "excerpt":"Busybodies@work I want 123456 Ending Appendix A: recommended low-quality password settings for pwquality.conf Busybodies@work Because of a bug in 24.04 LTS (Noble) I couldn’t enter some characters such as : in X-Windows, so I wanted to change my password to something simple. But Ubuntu wouldn’t let me set a simple...","categories": ["random"],
        "tags": ["ubuntu","linux","password","123456"],
        "url": "/2024/05/10/remove-password-complexity-ubuntu-2404-lts.html",
        "teaser": null
      },{
        "title": "Use Telegraf to send NetApp SolidFire metrics to InfluxDB",
        "excerpt":"Telegraf for heavy lifting? PoC with PowerShell Conclusion Appendix A - Python version Telegraf for heavy lifting? As I’m still thinking how to move ahead with SFC, I’ve been checking out Telegraf again. I thought maybe I should just use Telegraf instead, so today I’ve been revisiting Telegraf again. This...","categories": ["storage","monitoring","solidfire"],
        "tags": ["solidfire","netapp","monitoring","influxdb","grafana","performance","python","powershell"],
        "url": "/2024/05/20/netapp-solidfire-input-for-telegraf.html",
        "teaser": null
      },{
        "title": "Make use of storage QoS histograms on NetApp SolidFire",
        "excerpt":"Intro About QoS histograms on NetApp SolidFire Request Response What are these things? Bucket naming Should you use QoS histogram information? Role of metrics collection Conclusion Intro As I’ve been working on SFC v2 I’ve been playing with SolidFire’s QoS histograms and I thought I should write a post about...","categories": ["storage","monitoring","solidfire"],
        "tags": ["solidfire","netapp","monitoring","qos","storage","histograms","grafana"],
        "url": "/2024/05/28/netapp-solidfire-volume-qos-histograms.html",
        "teaser": null
      },{
        "title": "SolidFire Collector v2.0.0 is ready",
        "excerpt":"Intro Other objectives What’s new in SFC Rewrite Back-end database change Asynchronous execution Drop SolidFire Python SDK Scheduling and performance improvements Logging improvements QoS Histograms Other usability improvements Dependencies and the messy code Grafana and Python Packaging Security What’s next for SFC Conclusion Demo Intro As I’ve been working on...","categories": ["storage","solidfire","projects","monitoring"],
        "tags": ["solidfire","netapp","monitoring","sfc","visualization","grafana","api"],
        "url": "/2024/05/29/sfc-v2.html",
        "teaser": null
      },{
        "title": "Kubernetes, Trident and SolidFire configuration visibility",
        "excerpt":"Introduction Mapping applications to Kubernetes PVCs with kubectl Mapping PVCs to storage with tridentctl Mapping Trident to SolidFire with scripts or SQL queries SolidFire API vs. external database Using the SolidFire API to enhance configuration mapping Using a database to assist in configuration mapping Assembling replicated iSCSI target names for...","categories": ["kubernetes","solidfire","projects"],
        "tags": ["automation","api","replication","storage"],
        "url": "/2024/06/01/pvc-volume-relationships-in-solidfire-trident-part-1.html",
        "teaser": null
      },{
        "title": "Kubernetes, Trident and SolidFire configuration - part 2",
        "excerpt":"Introduction Use cases Feed Trident volume list to Velero Create backup-to-S3 jobs on SolidFire Set up cross-site replication for PVCs Manage QoS settings Conclusion This series of posts has several parts: Part 1 - Kubernetes, Trident and SolidFire configuration visibility Part 2 - this post Introduction In part 1 of...","categories": ["kubernetes","solidfire","projects"],
        "tags": ["automation","api","replication","storage"],
        "url": "/2024/06/03/pvc-volume-relationships-in-solidfire-trident-part-2.html",
        "teaser": null
      },{
        "title": "Project Longhorny",
        "excerpt":"Introduction What exactly does Longhorny do? Longhorny walk-through Site-level actions Conclusion Demo Introduction An introduction has already been written in Kubernetes, Trident and SolidFire configuration visibility, where I said a tool for managing replication relationships was one of my use cases motivated by the recent progress of scripting/automating Kubernetes-to-SolidFire volume...","categories": ["solidfire","projects"],
        "tags": ["automation","api","replication","storage"],
        "url": "/2024/06/11/introducing-project-longhorny.html",
        "teaser": null
      },{
        "title": "Reporting SolidFire cluster and volume pairing relationships",
        "excerpt":"Introduction This week I released Longhorny, my simple tool for SolidFire volume replication management and while there’s a “list” action for both cluster and volumes, I mentioned that these are meant to list relationships for a Longhorny-supported setup the user is working with, which is 1-to-1 exclusive pairing. Longhorny can...","categories": ["solidfire","projects"],
        "tags": ["automation","api","replication","storage","longhorny"],
        "url": "/2024/06/12/longhorny-cluster-volume-replication-report.html",
        "teaser": null
      },{
        "title": "Monitoring volume replication in NetApp SolidFire",
        "excerpt":"Introduction SolidFire volume replication Failed and not-so-successful approaches Write workload at destination Node throughput Good approaches Sync jobs at destination Volume’s statistics at source What else? All together now! Conclusion Appendix A - replication metrics in SFC Introduction Few weeks ago I saw a question about resolving volume pairing problems...","categories": ["solidfire","projects","monitoring"],
        "tags": ["automation","api","replication","storage","longhorny","sfc"],
        "url": "/2024/06/14/netapp-solidfire-replication-monitoring.html",
        "teaser": null
      },{
        "title": "SFC v2 adds volume replication monitoring",
        "excerpt":"What replication monitoring? What does that mean? What can we see? Other implementation details Grafana aside Summary What replication monitoring? You can read about the topic of SolidFire replication monitoring in the previous post where I explain the background and the related SolidFire API methods. This post is about an...","categories": ["solidfire","projects","monitoring"],
        "tags": ["automation","api","replication","storage","sfc"],
        "url": "/2024/06/15/sfc-adds-volume-replication-monitoring.html",
        "teaser": null
      },{
        "title": "Snapshots and snapshot schedules in NetApp SolidFire",
        "excerpt":"Introduction Slightly confusing SolidFire snapshot schedules Create a schedule Group vs. single One volume, multiple schedules FIFO settings The API Group snapshots and Longhorny Conclusion Appendix A - ListGroupSnapshots Introduction I’m not going to write what snapshots are. On Solidfire they’re thin and efficient in the sense that SolidFire’s global...","categories": ["solidfire","storage","monitoring"],
        "tags": ["automation","api","snapshot","storage","solidfire"],
        "url": "/2024/06/16/snapshot-schedules-in-solidfire.html",
        "teaser": null
      },{
        "title": "Trident QoS policy sucker for SolidFire backend",
        "excerpt":"Pull QoS policy from SolidFire into Trident back-end configuration for solidfire-san Exercise care What does the IOPS really do? What does all this mean? Conclusion Appendix A - sample run Pull QoS policy from SolidFire into Trident back-end configuration for solidfire-san This isn’t some huge idea, but I just thought...","categories": ["solidfire","storage","automation","containers"],
        "tags": ["automation","api","storage","solidfire"],
        "url": "/2024/06/19/trident-policy-sucker-for-solidfire-backends.html",
        "teaser": null
      },{
        "title": "Snapshots and snapshot schedules in SFC v2",
        "excerpt":"Introduction Similarly to the recent pattern where a post on some SolidFire API details is followed by a post on data collection and visualization in SFC, this one is as per the title and follows Snapshots and snapshot schedules in NetApp SolidFire. Towards the end of that earlier post I...","categories": ["solidfire","storage","monitoring"],
        "tags": ["automation","sfc","snapshot","schedule","solidfire"],
        "url": "/2024/06/20/snapshot-and-schedules-in-sfc.html",
        "teaser": null
      },{
        "title": "Increase size of SolidFire volumes paired for replication",
        "excerpt":"Introduction Situation Procedure Kubernetes Conclusion Appendix A - upsize remote and resize in Longhorny Introduction You’ve paired two volumes at the source and the destination cluster, and now you need to grow their size. This post reviews how to do that correctly on SolidFire. Situation Source: volume ID 136 (5GB)...","categories": ["storage","solidfire","automation"],
        "tags": ["netapp","solidfire","api","devops","dr","powershell","replication"],
        "url": "/2024/06/28/growing-solidfire-volumes-paired-for-replication.html",
        "teaser": null
      },{
        "title": "Get SolidFire volume attributes created by Trident, other apps",
        "excerpt":"This series of posts has several parts: Part 1 - Kubernetes, Trident and SolidFire configuration visibility Part 2 - Kubernetes, Trident and SolidFire configuration - part 2 Part 3 - this post Introduction How Trident creates SolidFire volume attributes What’s in volume attributes How to use volume attributes Getting SolidFire...","categories": ["storage","solidfire","automation","kubernetes"],
        "tags": ["netapp","solidfire","api","devops","trident","dr","replication","csi"],
        "url": "/2024/07/02/solidfire-volume-attributes-from-trident-and-other-apps.html",
        "teaser": null
      },{
        "title": "Kubefire for Kubernetes failover/failback with SolidFire",
        "excerpt":"Introduction Kubefire Simplified version of Longhorny focused on Kubernetes Automated replication service for SolidFire replication in a Kubernetes environment Conclusion Appendix A - implementation ideas Introduction In this post I described how SolidFire Collector collects and stores volume attributes from NetApp Trident CSI. It’s one of several pieces of the...","categories": ["storage","kubernetes","solidfire","projects"],
        "tags": ["trident","solidfire","python","automation","netapp","replication","failover","failback"],
        "url": "/2024/07/05/kubefire-for-failover-failback-of-kubernetes-with-solidfire-backend.html",
        "teaser": null
      },{
        "title": "Velero AWS Plugin and SignatureDoesNotMatch nonsense",
        "excerpt":"Introduction Before After Workarounds HTTPS weirdness Conclusion Appendix A - ONTAP S3 backup listing and Velero backup describe Introduction Apparently world improvers from the Velero team applied the latest and greatest AWS S3 feature to Velero Plugin for AWS (i.e. S3) and as people are upgrading, their backup stops working....","categories": ["storage","backup"],
        "tags": ["s3","velero","object store","backup","data protection","ontap","aws","plugin","netapp","storagegrid"],
        "url": "/2024/07/13/velero-aws-plugin-s3-signature-does-not-match-nonsense.html",
        "teaser": null
      },{
        "title": "Rapid PVC provisioning with NetApp Trident and SolidFire",
        "excerpt":"Introduction While browsing random Trident CSI issues I found this one: It took more than 10 minutes to create 200 PVs at once and pod mount them. First of all, it took over 8 minutes to create 200 PVs. And it took about 2 minutes for the pod to mount....","categories": ["storage","kubernetes","automation"],
        "tags": ["trident","csi","solidfire","python"],
        "url": "/2024/07/26/netapp-trident-csi-rapid-volume-provisioning-solidfire.html",
        "teaser": null
      },{
        "title": "Boot OpenShift RCOS from NetApp SolidFire iSCSI target",
        "excerpt":"Introduction How Other SolidFire-related tips Conclusion Introduction I’ll make this a short one because I haven’t actually tried any of this. So, starting with OpenShift 4.16, Red Hat OpenShift can boot RCOS from iSCSI devices. Does SolidFire support that? Simple answer: Who cares! There’s nothing that SolidFire needs to do...","categories": ["storage","kubernetes","automation"],
        "tags": ["redhat","rcos","solidfire","openshift","iscsi","netapp"],
        "url": "/2024/07/31/openshift-ocp-416-iscsi-boot-solidfire.html",
        "teaser": null
      },{
        "title": "Fixing Web UI annoyances with element blocking",
        "excerpt":"While using ehm, a famous S3 server, I got annoyed by this stupid red dot. Yeah, I get it: pay attention to the license. Which I did as always before I downloaded the damn thing. So, what is the purpose of distracting and annoying me with that red dot every...","categories": ["random"],
        "tags": ["ublock","minio","red dot"],
        "url": "/2024/08/04/fixing-ui-annoyance-with-element-blocking.html",
        "teaser": null
      },{
        "title": "Convert NetApp HCI from VMware to Hyper-V",
        "excerpt":"Requirement Workflow Storage considerations Tools Requirement If you have NetApp HCI or SolidFire with vSphere 7 and want to move to Hyper-V, how to do that? For NetApp HCI, the tricky part is compute, which likely isn’t certified for latest Windows Server. I wrote about that here. As far as...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","netapp hci","hyper-v","vsphere"],
        "url": "/2024/08/28/convert-netapp-hci-from-vmware-to-hyperv.html",
        "teaser": null
      },{
        "title": "Using NetApp E-Series Volume Copy",
        "excerpt":"What is a volume created by Volume Copy operation How does it work? Progress Reserve size Reserve location Priority Automating Volume Copy Application-aware snapshots Consistency groups Online vs. offline Volume Copy Comparison with snapshot-based clones Monitoring and logging Conclusion Appendix A - Volume Copy API Get Volume Copy pairing relationship...","categories": ["storage"],
        "tags": ["eseries","netapp e-series","clone","volume copy","santricity"],
        "url": "/2024/10/10/eseries-volume-copy.html",
        "teaser": null
      },{
        "title": "MinIO and Versity S3 GW with tiny object workloads on NetApp E-Series",
        "excerpt":"Introduction The problem Solutions Notes on MinIO Notes on VersityGW Benchmarking and testing VersityGW on scale-out file systems vs Erasure Coding on S3 SDS Tests Results Observations Conclusion Appendix - additional tests and observations Introduction Everyone knows what MinIO is and everyone should know what VersityGW is, so I won’t...","categories": ["storage","performance"],
        "tags": ["netapp","eseries","versitygw","versity","minio","s3"],
        "url": "/2024/10/14/minio-versitygw-s3-performance-netapp-ef-series.html",
        "teaser": null
      },{
        "title": "InfluxDB 3 Core Alpha available for testing",
        "excerpt":"Introduction What’s backwards compatible and what’s not in InfluxDB 3 Evaluate with E-Series Performance Analyzer Other details Conclusion Appendix A - Example Appendix B: admin token reset Update (2025/04) Update (2025/06) Introduction When I forked E-Series Performance Analyzer (EPA), I didn’t want to waste time on InfluxDB 2 because that...","categories": ["storage","monitoring"],
        "tags": ["netapp","eseries","epa","performance","monitoring","solidfire","sfc"],
        "url": "/2025/01/24/influxdb-3-core-alpha.html",
        "teaser": null
      },{
        "title": "Minimal Prometheus Exporter with ONTAP Harvest",
        "excerpt":"Introduction Approach Steps One or more instances Prepare your box Clone Harvest repo or download pre-built container image Create ONTAP management user with minimal API access Create minimal template for Prometheus Exporter Use harvest.yml to generate harvest.yml Annnnd … action Scrape Security Power users Conclusion Appendix A - demo video...","categories": ["storage","monitoring"],
        "tags": ["netapp","ontap","prometheus","harvest"],
        "url": "/2025/02/17/minimal-prometheus-exporter-with-ontap-harvest.html",
        "teaser": null
      },{
        "title": "Cloudera Base with NetApp E-Series",
        "excerpt":"Introduction Reference architectures High-level design and best practices What’s new in Cloudera Base Deployment topology Sizing and hardware selection Failure handling Operating system best practices Networking and security Example topologies Third party filesystems Storage Scale with E-Series FAQs Introduction First off, NetApp doesn’t validate or certify E-Series for Cloudera. Maybe...","categories": ["storage","analytics"],
        "tags": ["netapp","eseries","hadoop","cloudera","s3"],
        "url": "/2025/04/16/cloudera-with-netapp-e-series.html",
        "teaser": null
      },{
        "title": "ThinkParQ BeeGFS v8 with NetApp E-Series",
        "excerpt":"Introduction Data tiering with pools ZFS BeeGFS snapshots Role of snapshots Cognitive overhead of ZFS BeeGFS copy tool Remote storage File-system events File index Monitoring Conclusion Introduction BeeGFS version 8 recently came out and I wanted to celebrate that with a post that goes through new and underappreciated features of...","categories": ["storage","analytics"],
        "tags": ["netapp","e-series","tiering","indexing","vector","ai","embedding","rag","deduplication","efficiency","zfs","compression","beegfs"],
        "url": "/2025/05/17/beegfs-v8-netapp-e-series-indexing-tiering-workflows.html",
        "teaser": null
      },{
        "title": "Build NetApp SolidFire MCP server",
        "excerpt":"Introduction MCP Use cases? Get, set, and security Conclusion Additional reading Introduction I noticed some storage vendors have been highlighting their “commitment” to AI by posting about their MCP servers. I’ve received zero queries about GenAI, AIOps and such in the context of SolidFire. But: I know SolidFire is fine...","categories": ["storage","ai","solidfire"],
        "tags": ["netapp","solidfire","mcp","ai","agent"],
        "url": "/2025/05/20/get-started-with-netapp-solidfire-mcp-server.html",
        "teaser": null
      },{
        "title": "OPEA AI with NetApp E-Series",
        "excerpt":"Introduction What is the OPEA project The stack Docker vs. Kubernetes Where’s the storage? E-Series storage and solution stack for OPEA Multi-tenancy Conclusion Introduction NetApp and OPEA (Open Platform for Enterprise AI) recently announced a joint solution. In this post I’ll describe how an OPEA &amp; E-Series can work together....","categories": ["storage","ai"],
        "tags": ["netapp","e-series","beegfs","opea","ai","rag"],
        "url": "/2025/05/21/opean-ai-with-netapp-eseries.html",
        "teaser": null
      },{
        "title": "Windows Server 2025 with NetApp SolidFire",
        "excerpt":"I wrote about Windows Server 2025 here. Anyway, since I’ve already installed the same product again, there’s another update so I’ll blog about that as well. What we’re dealing with? A Windows Server 2025 VM (this specific build, if you’re curious) I installed for this purpose. And a NetApp SolidFire...","categories": ["storage","solidfire"],
        "tags": ["netapp","windows","iscsi","solidfire","2025","server"],
        "url": "/2025/05/22/windows-2025-netapp-solidfire.html",
        "teaser": null
      },{
        "title": "Data pipelines with ThinParQ BeeGFS and NetApp E-Series",
        "excerpt":"Introduction BeeGFS file-system events and indexes Dispatch jobs for data operations Near real-time vs scheduled processing Near real-time data workflows Scheduled batch jobs Scalability of real-time processing NetApp DatOps Toolkit (DOT) The need for “AI reference stack” Road to bloat Databases CSI driver for E-Series Two- or three-server node database...","categories": ["storage","ai","analytics"],
        "tags": ["netapp","beegfs","data pipeline","thinkparq","ai","e-series","mlops","rag","stack","reference","spark","analytics","TR-4890"],
        "url": "/2025/05/23/beegfs-data-pipeline.html",
        "teaser": null
      },{
        "title": "Simple file share and S3 analytics and MCP ops",
        "excerpt":"Introduction SMB and NFS data migration Shell scripts and utilities XCP Elaborate schemes Enterprise software Example: SMB share S3 reporting and replication Example: S3 usage reporting Combined file and object shares Conclusion Demo Introduction Sometimes storage admins have challenges related to data movement, such as moving stuff from A to...","categories": ["storage","ai","analytics"],
        "tags": ["netapp","mcp","analytics","indexing","scanning","enumeration"],
        "url": "/2025/06/05/simple-filesystem-and-s3-analytics-and-mcp.html",
        "teaser": null
      },{
        "title": "What is MinIO up to these days?",
        "excerpt":"“Adjustments” Latest and greatest: “breaking changes” Are you telling me there’s a chance? Thoughts Risk and commercial issues Technical side Alternatives Risk of forks Conclusion “Adjustments” Last summer MinIO made an attempt to annoy us freeloaders, but I doubt that did them much good. But that was just one of...","categories": ["storage"],
        "tags": ["s3","minio","aistor"],
        "url": "/2025/06/06/whats-minio-up-to.html",
        "teaser": null
      },{
        "title": "Speed up PowerShell startup time on Linux with environment",
        "excerpt":"Problem Background Solution(s) Epilogue Problem Recently, whenever I ran a PowerShell script, it’s seemed a bit slow. PowerShell 7.4 and 7.5 Ubuntu LTS 24.04 I executed those from Bash so I didn’t really think much of it, except that it seemed a bit slow which was probably “some snapd or...","categories": ["random"],
        "tags": ["linux","powershell","automation"],
        "url": "/2025/06/07/powershell-linux-long-startup-time-history-file.html",
        "teaser": null
      },{
        "title": "Improved pipelines with BeeGFS FS Event Notifications in v8",
        "excerpt":"Introduction What’s new in BeeGFS file-system events in BeeGFS v8 Dude, where’s my gRPC server? Can BeeGFS watch server, erhm, client, drop messages File-system notification messages Use case: data pipeline for StorageGRID Advantages Limitations Scheduled scanning Performance (and security) Bonus lightweight approach with Web hooks Bonus use case: data pipeline...","categories": ["storage","ai","analytics"],
        "tags": ["netapp","eseries","beegfs","pipeline","clamav","s3"],
        "url": "/2025/06/15/pipeline-with-beegfs-file-system-notifications-v2.html",
        "teaser": null
      },{
        "title": "SFC (SolidFire Collector) 2.1",
        "excerpt":"Introduction SFC 2.1 Queries Summary Introduction tldr; My SolidFire metrics collector, SFC, was posted to Github last year. v2 was a complete rewrite; I changed back-end to InfluxDB 1, made performance improvements so that it could scale to mid-sized clusters (or better), and eliminated SolidFire SDK As I’ve blogged at...","categories": ["solidfire","storage","projects"],
        "tags": ["solidfire","monitoring","grafana","python"],
        "url": "/2025/06/18/sfc-2-dot-1.html",
        "teaser": null
      },{
        "title": "Data pipeline with BeeGFS FS Event Notifications and Versity S3 Gateway",
        "excerpt":"Background Why this is cool Catches File/object duality considerations Conclusion Demo Background For the context, see “Improved pipelines with BeeGFS FS Event Notifications in v8” where I build on top of an earlier approach to scalable S3 anti-virus scanning from some time ago, and discover that BeeGFS file-system event notifications...","categories": ["storage","ai","analytics"],
        "tags": ["netapp","eseries","beegfs","pipeline","clamav","versity","s3"],
        "url": "/2025/06/22/data-pipeline-with-beegfs-file-system-notifications-and-versity-s3-gateway.html",
        "teaser": null
      },{
        "title": "Do we need a NetApp SolidFire plugin for Proxmox",
        "excerpt":"Who wants it and why? Perl for the win! Features Effort Appendix A: what works and how Appendix B: observations, problems, solutions Appendix C: why I don’t want a SolidFire plugin for PVE Appendix D: Corosync 101 for casual users “Any headline that ends in a question mark can be...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","proxmox","iscsi"],
        "url": "/2025/06/24/initial-exploration-solidfire-proxmox-plugin.html",
        "teaser": null
      },{
        "title": "Connecting to SolidFire from PowerShell 7.5",
        "excerpt":"Error I get this in PowerShell 7.5 on Linux (also on 7.4). Connect-SFCluster: Could not load file or assembly 'System.Net.Http.WebRequest, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a'. The system cannot find the file specified. It’s probably due to System.Net.Http.WebRequest removed from the recent .NET packages (after being deprecated for a while before that). Fuhgeddaboudit...","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","powershell"],
        "url": "/2025/06/29/solidfire-with-powershell-7.html",
        "teaser": null
      },{
        "title": "SolidFire backup to disk with Versity S3 Gateway",
        "excerpt":"This is more appropriate for a tweet, but anyway… I’ve blogged about SolidFire’s rather basic “backup to S3” feature many times. As far as S3 targets are concerned, I’ve tried a bunch, including experiments with S3 storage appliance compression vs. source-side (that is, SolidFire) compression (I quite liked that thought,...","categories": ["storage","solidfire"],
        "tags": ["netapp","solidfire","backup","versity","s3"],
        "url": "/2025/06/30/solidfire-backup-to-disk-with-versity-s3-gateway.html",
        "teaser": null
      },{
        "title": "Firemox - an anti-plugin for Proxmox PVE with NetApp SolidFire",
        "excerpt":"Background Firemox What it does, and doesn’t (Stopping) scope creep Known issues and limitations Conclusion Demo and source code Appendix A: Feature creep continues (2025/07/09) Background In “Do we need a NetApp SolidFire plugin for Proxmox” in looked into storage plugins for Proxmox and explained why I didn’t like the...","categories": ["automation","solidfire","virtualization","projects"],
        "tags": ["netapp","solidfire","powershell","proxmox","pve"],
        "url": "/2025/07/07/firemox.html",
        "teaser": null
      },{
        "title": "The shocking truth about SolidFire ModifySchedule method",
        "excerpt":"Introduction Show me Why? Thoughts Conclusion Introduction As I was trying to add snapshot-related feature to Firemox (see previous post, my Proxmox-SolidFire console thing) I was shocked about the true distinction between Group and “standard” snapshots in SolidFire. And it shocked me enough to motivate me to blog about it....","categories": ["automation","solidfire"],
        "tags": ["netapp","solidfire","api","consistency group","snapshot","group snapshot"],
        "url": "/2025/07/09/the-shocking-truth-about-createschedule.html",
        "teaser": null
      },{
        "title": "S3 vector search - DIY vs AWS S3 Vectors",
        "excerpt":"This is a two-part post: Part 1 - S3 vector search: S3 vector search - DIY vs AWS S3 Vectors (this post) Part 2 - S3 vector search: S3 GO NATS! The first part is a rant against current approaches. The second will show a DIY approach. Introduction AWS S3...","categories": ["storage","ai"],
        "tags": ["netapp","s3","vector","database","embedding","search","knn","similarity","elasticsearch","s3 vectors"],
        "url": "/2025/07/18/s3-vector-search-01-analysis.html",
        "teaser": null
      },{
        "title": "S3 GO NATS!",
        "excerpt":"Part 1 - S3 vector search: S3 vector search - DIY vs AWS S3 Vectors Part 2 - S3 vector search: S3 GO NATS! (this post) The first part was a rant against the current (or you might say emerging) approaches. This part attempts to demonstrate why not all but...","categories": ["storage","ai"],
        "tags": ["netapp","s3","vector","database","embedding","instaclustr","elasticsearch","opensearch","search","knn","similarity","elasticsearch","s3 vectors"],
        "url": "/2025/07/23/s3-vector-search-02-diy.html",
        "teaser": null
      },{
        "title": "Updated Terraform provider for SolidFire",
        "excerpt":"Introduction What’s new in 2025 Next steps Introduction Prior to NetApp’s acquisition SolidFire had a Terraform provider for SolidFire for internal use. It was posted on Github, but never promoted to external users. After SolidFire got acquired, I fought for it to be adopted and kept around as a “community”...","categories": ["automation","solidfire","projects"],
        "tags": ["netapp","solidfire","terraform","hcl"],
        "url": "/2025/07/25/terraform-solidfire-provider-update.html",
        "teaser": null
      },{
        "title": "SolidFire Gateway for Windows Admin Center 2025",
        "excerpt":"Introduction What it is What it does IIS Setup Why this matters What about it? Conclusion Appendix: Introduction Yet another “extra gloves” flashback today. I won’t say who I think “Dumber” is, but I have a very accurate list of suspects. What it is SolidFire WAC Gateway is an API...","categories": ["automation","solidfire","projects"],
        "tags": ["netapp","solidfire","windows","hyper-v","windows admin center"],
        "url": "/2025/07/26/solidfire-windows-admin-center-gateway.html",
        "teaser": null
      },{
        "title": "SolidFire Extension for Windows Admin Center 2025",
        "excerpt":"Introduction Walk-through And now… Conclusion Appendix A: demo Animated GIF (no playback control) Video demo with voice-over Introduction Continuing our “Dumb &amp; Dumber in Tech” series, I’m pleased to report that I can add another episode following that SolidFire WAC Gateway post. I’ve kept cracking and have something to share....","categories": ["automation","solidfire","projects"],
        "tags": ["netapp","solidfire","windows","hyper-v","windows admin center"],
        "url": "/2025/07/30/solidfire-windows-admin-center-extension.html",
        "teaser": null
      },{
        "title": "Got binged in July 2025",
        "excerpt":"I don’t track users (see Privacy page), don’t have ads and don’t care about “likes” or “followers”, but generally I want my content to be in search engine indexes for discoverability. That is especially the case since I don’t “advertise” blog and don’t spam social media with links, so search...","categories": ["meta","random"],
        "tags": [],
        "url": "/2025/08/11/bing-index-issue.html",
        "teaser": null
      },{
        "title": "E-Series Performance Analyzer (EPA) v4 beta",
        "excerpt":"Introduction EPA 4 EPA Collector-specific Details related to storage requirements What’s next Appendix A: updates Introduction In 2023 I forked the dead (archived) E-Series Performance Analyzer (EPA) v3 to make sure it remains usable and improve it. I accomplished all of the goals I set for it at the time:...","categories": ["e-series","storage","projects"],
        "tags": ["e-series","monitoring","grafana","netapp","performance","EPA"],
        "url": "/2025/08/11/epa-4-beta.html",
        "teaser": null
      },{
        "title": "E-Config v2 updated for QLC drives",
        "excerpt":"Introduction I don’t write much about E-Config (see it in Projects), but among my projects I like, this is one of the few that I use on a regular basis. I also like Firemox very much, for example, but I haven’t used it since I posted the source code to...","categories": ["e-series","storage","projects"],
        "tags": ["e-series","sizing","qlc","raid6","ddp"],
        "url": "/2025/08/20/econfig-v2-updates.html",
        "teaser": null
      },{
        "title": "EPA version 3.4.0",
        "excerpt":"How it started … This came as a little unexpected detour in my recent attempts to upgrade E-Series Performance Analyzer to version 4. Surprisingly, this “simple” refresh from 3.3 to 3.4 took me several days of work. I still can’t believe it. I mean, I couldn’t believe it after 2...","categories": ["e-series","storage","projects"],
        "tags": ["e-series","monitoring","grafana"],
        "url": "/2025/08/24/epa-version-3-dot-4.html",
        "teaser": null
      },{
        "title": "EPA version 3.4.1",
        "excerpt":"What’s new in EPA v3.4.1 3.4.0 was released days ago but based on user feedback this week, two micro-features have been added in version 3.4.1. Include metrics If you don’t need all of the metrics that EPA 3 collects, you can specify just a subset and keep your InfluxDB v1...","categories": ["e-series","storage","projects"],
        "tags": ["e-series","monitoring","grafana"],
        "url": "/2025/08/27/epa-version-3-dot-4-dot-1.html",
        "teaser": null
      },{
        "title": "EPA version 3.5.0",
        "excerpt":"What’s new in EPA v3.5.0 Several small features have been added in E-Series Performance Analyzer version 3.5.0. Like with some of the changes in 3.4, I’d already added some of them in version 4 (currently in public beta), so I again wasted some time repeating the same thing. At this...","categories": ["e-series","storage","projects"],
        "tags": ["e-series","monitoring","grafana","influxdb"],
        "url": "/2025/08/31/epa-version-3-dot-5.html",
        "teaser": null
      },{
    "title": "About this site",
    "excerpt":"About me I create solutions. The blog title and motto come from the theory of human action (praxeology). Disclaimer The content of this site and opinions expressed on it are personal and not necessarily shared by my employer. The site does not provide technical or other advice to my employer’s...","url": "https://scaleoutsean.github.io/about/"
  },{
    "title": "Posts by Category",
    "excerpt":" ","url": "https://scaleoutsean.github.io/categories/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/"
  },{
    "title": "Page Archive",
    "excerpt":"About this site Posts by Category Home Page Archive Post Archive Projects Posts by Tag Posts by Year projects solidfire random kubernetes virtualization automation storage analytics containers cloud meta openstack linux monitoring backup ai netapp hci netapp hci performance e-series Home Home Home Home Home Home Home Home Home Home...","url": "https://scaleoutsean.github.io/page-archive/"
  },{
    "title": "Post Archive",
    "excerpt":"EPA version 3.5.0 2025-08-31 00:00 5 minute read What’s new in EPA v3.5.0 EPA version 3.4.1 2025-08-27 00:00 3 minute read What’s new in EPA v3.4.1 EPA version 3.4.0 2025-08-24 00:00 5 minute read What’s new in EPA v3.4.0 E-Config v2 updated for QLC drives 2025-08-20 00:00 4 minute read...","url": "https://scaleoutsean.github.io/archive/"
  },{
    "title": "Projects",
    "excerpt":"Projects The following are my OSS repos except for E-Series Sizing Tools which is a (public) Web site (it’s a bit sensitive from a competitive perspective, so I haven’t posted that source to Github). The rest is all permissively licensed OSS. Repo Description Awesome Solidfire SolidFire-related resources (docs, curation, Python...","url": "https://scaleoutsean.github.io/projects.html"
  },{
    "title": "Posts by Tag",
    "excerpt":" ","url": "https://scaleoutsean.github.io/tags/"
  },{
    "title": "Posts by Year",
    "excerpt":" ","url": "https://scaleoutsean.github.io/year-archive/"
  },{
    "title": "projects",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/projects/"
  },{
    "title": "solidfire",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/solidfire/"
  },{
    "title": "random",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/random/"
  },{
    "title": "kubernetes",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/kubernetes/"
  },{
    "title": "virtualization",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/virtualization/"
  },{
    "title": "automation",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/automation/"
  },{
    "title": "storage",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/storage/"
  },{
    "title": "analytics",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/analytics/"
  },{
    "title": "containers",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/containers/"
  },{
    "title": "cloud",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/cloud/"
  },{
    "title": "meta",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/meta/"
  },{
    "title": "openstack",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/openstack/"
  },{
    "title": "linux",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/linux/"
  },{
    "title": "monitoring",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/monitoring/"
  },{
    "title": "backup",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/backup/"
  },{
    "title": "ai",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/ai/"
  },{
    "title": "netapp hci",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/netapp-hci/"
  },{
    "title": "netapp",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/netapp/"
  },{
    "title": "hci",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/hci/"
  },{
    "title": "performance",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/performance/"
  },{
    "title": "e-series",
    "excerpt":"","url": "https://scaleoutsean.github.io/categories/e-series/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page2/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page3/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page4/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page5/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page6/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page7/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page8/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page9/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page10/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page11/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page12/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page13/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page14/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page15/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page16/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page17/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page18/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page19/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page20/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page21/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page22/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page23/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page24/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page25/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page26/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page27/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page28/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page29/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page30/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page31/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page32/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page33/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page34/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page35/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page36/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page37/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page38/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page39/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page40/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page41/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page42/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page43/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page44/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page45/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page46/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page47/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page48/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page49/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page50/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page51/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page52/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page53/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page54/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page55/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page56/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page57/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page58/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page59/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page60/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page61/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page62/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page63/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page64/"
  },{
    "title": "Home",
    "excerpt":"","url": "https://scaleoutsean.github.io/page65/"
  }]
