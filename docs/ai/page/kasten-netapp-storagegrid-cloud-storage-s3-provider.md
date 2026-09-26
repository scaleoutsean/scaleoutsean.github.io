# StorageGRID as Cloud Storage (S3) Provider for Kasten K10

Configure NetApp StorageGRID for Kasten K10 cloud backup repository

Previously I blogged about using Kasten with NetApp HCI and SolidFire, but I did not have time to examine another NetApp storage integration, namely that of NetApp StorageGRID which can be used as a Cloud Provider in Kasten K10.

It's extremely easy to set it up: in Kasten K10 Web UI go to Location Profiles add a Generic Provider and provide required details. Make sure you apply appropriate ACLs to this bucket (`sean-backup`, in my case) to protect it from unauthorized access.

![Kasten Cloud Provider in Location Profiles](/assets/images/kasten-k10-bucket-storagegrid-11.4.png)

If you enable K10 Disaster Recovery, K10 creates a unique path within the bucket (`d5cca499-f80d-4574-a539-5c90cd0987f2`) which corresponds to your "cluster ID", from which Kasten can restore applications and data to another site and another Kubernetes cluster.

![StorageGRID bucket in use by Kasten K10](/assets/images/kasten-k10-bucket-storagegrid-11.4-bucket-content.png)

Individual data protection policies (for applications and such) are stored in its subdirectories.

If you have three StorageGRID storage nodes (which can be VMs), Kasten K10 and a cluster of six StorageGRID nodes (three per site) can provide cross-site data protection for your Kubernetes cluster.

Such small VM-based StorageGRID clusters (starting at just few TB of usable capacity) can be expanded to PBs by adding additional virtual or physical StorageGRID appliances.

If you run StorageGRID on NetApp HCI or other virtualized infrastructure and use external storage, consider E-Series. I wrote about StorageGRID on NetApp HCI and E-Series in [this post](/2021/01/15/netapp-hci-storagegrid-splunk-smartstore-on-efseries). 

For 50, 100 TB or more, use StorageGRID appliances to provision the bulk of that capacity (it can be 100% of it, but "edge" sites can be served by VM-based StorageGRID "pools" because StorageGRID supports asymmetric hardware configurations).

## Demo

See it in action [here](https://www.youtube.com/watch?v=MdmaM7jIG-4) (slightly longer, 5m11s).
