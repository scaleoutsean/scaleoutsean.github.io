# Backup SANtricity CSI volume with Velero and Versity S3 Gateway

Filesystem backup E-Series CSI PVCs with Velero 1.18 and Versity S3 Gateway

## Introduction

There's a bunch of E-Series CSI drivers and I think one is officially supported for backup by Velero: that's vSphere CSI (backed by E-Series).

What about some of the others?

They should all work the same. This post is premature as I haven't added snapshot support to SANtricity CSI or IBM Block CSI with SANtricity patch, but at the same time it's not.

Let's see why that is!

## Poor man's CSI backup 

[File system backup](https://velero.io/docs/v1.18/file-system-backup/) is the approach when CSI snapshots aren't available. Backup runs on a live file system.

It's well known that can't work well (or at all) for databases, but that's not the point. It's still useful.

- You can freeze IO while backing up
- You can backup clone volumes

**fsfreeze** is [documented here](https://velero.io/docs/main/backup-hooks/).

```sh
kubectl annotate pod -n nginx-example -l app=nginx \
    pre.hook.backup.velero.io/command='["/sbin/fsfreeze", "--freeze", "/var/log/nginx"]' \
    pre.hook.backup.velero.io/container=fsfreeze \
    post.hook.backup.velero.io/command='["/sbin/fsfreeze", "--unfreeze", "/var/log/nginx"]' \
    post.hook.backup.velero.io/container=fsfreeze
```

You could make a slightly more complex command that freezes/unfreezes the application and disk I/O at the same time. Still, you wouldn't want to freze a very large database for 47 minutes. 

If you backup SANtricity **Linked Clones**, live file system backup is good enough. We create a snapshot, from it a read-only Linked Clone, and map that clone to a backup host. Then we start a backup job on that "static" PVC. That's perfect for larger volumes or volumes with dynamic data, where restore is Dump Volume -> Production Volume, and backup is Disk-to-Disk (Production Volume -> Dump Volume).

- Database PVC
  - Hardware snapshot on SANtricity
    - Read-only Linked Clone volume <= Velero File System Backup of static PVC

We can easily automate this in several languages and frameworks and some [examples](/2026/03/15/santricity-powershell-postgres-snashot-clone.html) are available on this blog. The only difference is this isn't Kubernetes-native, as scheduling/snapshot/clone is driven by an external script. Sometimes it matters, sometimes it doesn't.

## How to do it

First, you want to have an S3 bucket. Versity S3 Gateway has been my personal favorite for years. There's an [example of how to deploy it on Kubernetes](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html) using SANtricity CSI. Today I created a more detailed example [here](https://github.com/scaleoutsean/eseries/) - you just need to identify disk size and the storage class to use. 

Of course, do not backup Kubernetes workloads to S3 running on the same Kubernetes cluster! You can use any other S3, and if you use Versity S3 Gateway, you can pick a bare metal box, VM (with Docker, from CLI, or as systemd service) and run it attached to an E-Series box with NL-SAS. As long as you need less than 1-2 GB/s that may be enough. Whatever works for you!

Second, we need Velero. I used v1.18. Prepare credentials you want to use (Versity S3 Gateway lets you create IAM-style credentials) and get the API endpoint URL. I don't follow best practices here, so I use Versity admin's credentials and HTTP. The more detailed example above will help you create a Versity S3 Gateway pod with a `velero` bucket, and then we just need service IP (or FQDN) and can create custom credentials for Velero.

```sh
$ kubectl get service -n versitygw # gives cluster IP we can use

$ velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.14.0 \
  --bucket velero \
  --secret-file  ~/.aws/credentials \
  --use-volume-snapshots=false \
  --use-node-agent --privileged-node-agent \
  --backup-location-config region=us-east-1,s3ForcePathStyle="true",s3Url=http://10.11.12.13:7070/ \
  --wait
```

When you download Velero, it comes with an examples directory where you can create NGINX pod with a PVC and then `velero create backup nginx --include-namespaces nginx-example`... Use that to create a backup, check your backup log and make sure stuff has been backed up.

```sh
$ export ENDPOINT="http://10.11.12.13:7070/"
$ aws s3api list-objects --endpoint-url "$ENDPOINT" --region us-east-1 --bucket "velero"
{
  "Contents": [
    {
      "Key": "backups/nginx/nginx-itemoperations.json.gz",
      "LastModified": "2026-04-17T16:15:53+00:00",
      "ETag": "\"ae811dd04e417ed7b896b4c4fa3d2ac0\"",
      "ChecksumAlgorithm": [
      "CRC32"
...
```

I tried this workflow using IBM Block CSI 1.13.1 with SANtricity patch earlier today.

## Conclusion

Velero's File System Backup works fine with SANtricity CSI drivers, but it, of course, doesn't cover all data protection use cases. 

For SANtricity CSI drivers, it's one step at a time: file system backup first, because it's easy and useful. It works great for many use cases. Later, it's going to be with CSI Snapshots.

Note that these days many databases can backup directly to S3, including Elasticsearch/Lucene (demonstrated with SANtricity CSI [earlier this week](/2026/04/13/elasticsearch-eck-kuberntees-netapp-santricity-csi.html)) and SQL Server post-2019, so just a minority of database applications benefit from CSI snapshots and can't use the "snapshot and clone" process described above. 

For single-host CSI (like TopoLVM), you may be able to [take snapshots](https://github.com/topolvm/topolvm) of E-Series backed PVs today, so if you set up replication (in order to overcome worker node failures), you don't need an HA CSI driver. It's been that way for years.

In a future Velero-related post, we'll demonstrate SANtricity CSI snapshots with one of the HA drivers.
