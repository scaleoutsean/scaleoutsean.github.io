# Use Velero with NetApp StorageGRID Object Storage

Backup your K8s with Velero to NetApp StorageGRID

## tldr

Q: Can StorageGRID be used as an S3 provider for Velero?

A: Looks like it.

## Set things up

```
ubuntu@helmetsky:~$ ./trident-installer/tridentctl get backend -n trident
+--------------------------+----------------+--------------------------------------+--------+---------+
|           NAME           | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+--------------------------+----------------+--------------------------------------+--------+---------+
| solidfire_192.168.103.30 | solidfire-san  | e656fa37-ee5a-4b23-95f4-07482e2c6e5b | online |       0 |
+--------------------------+----------------+--------------------------------------+--------+---------+
ubuntu@helmetsky:~$ kubectl get sc
NAME                         PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
solidfire-bronze             csi.trident.netapp.io   Delete          Immediate              false                  11h
solidfire-gold               csi.trident.netapp.io   Retain          Immediate              true                   11h
solidfire-silver (default)   csi.trident.netapp.io   Retain          Immediate              false                  11h
```

## Create a set of S3 access keys, a bucket, and restrict access to the bucket using ACLs

Save them to `credentials-velero` or whatever:

```
[default]
aws_access_key_id = blablabla
aws_secret_access_key = 1111111111111111111111111111111
```

## Install Velero with AWS provider

Check the options in the Velero documentation and AWS Provider documentation.

```
velero install \
    --provider aws \
    --use-restic \
    --default-volumes-to-restic \
    --plugins velero/velero-plugin-for-aws:v1.1.0 \
    --bucket solidfire-velero \
    --secret-file ./credentials-velero \
    --use-volume-snapshots=false \
    --backup-location-config region=us-east-1,s3ForcePathStyle="true",s3Url=https://storagegrid.org.com:8443
```

## Backup

Following the standard Velero example, create a sample app (`nginx`) and back it up:

```
velero backup create nginx-backup --selector app=nginx
```

See what Velero is up to:

```
$ velero backup logs nginx-backup
time="2021-02-02T04:52:39Z" level=info msg="Setting up backup temp file" backup=velero/nginx-backup logSource="pkg/controller/backup_controller.go:534"
time="2021-02-02T04:52:39Z" level=info msg="Setting up plugin manager" backup=velero/nginx-backup logSource="pkg/controller/backup_controller.go:541"
..
time="2021-02-02T04:52:42Z" level=info msg="Backed up a total of 7 items" backup=velero/nginx-backup logSource="pkg/backup/backup.go:419" progress=
```

## Check the bucket

Is it there yet? Yes it is.

![Velero Bucket on StorageGRID Object Storage](/assets/images/velero-storagegrid-s3-provider.png)

## Simulate data loss

```
ubuntu@helmetsky:~$ kubectl delete namespace nginx-example
namespace "nginx-example" deleted
ubuntu@helmetsky:~$ kubectl get deployments --namespace=nginx-example
No resources found in nginx-example namespace.
ubuntu@helmetsky:~$ kubectl get services --namespace=nginx-example
No resources found in nginx-example namespace.
ubuntu@helmetsky:~$ kubectl get namespace/nginx-example
Error from server (NotFound): namespaces "nginx-example" not found
```

## Restore

```sh
ubuntu@helmetsky:~$ velero restore create --from-backup nginx-backup
Restore request "nginx-backup-20210202050222" submitted successfully.
Run `velero restore describe nginx-backup-20210202050222` or `velero restore logs nginx-backup-20210202050222` for more details.
```

## Verify

```sh
ubuntu@helmetsky:~$ velero restore get
NAME                          BACKUP         STATUS      STARTED                         COMPLETED                       ERRORS   WARNINGS   CREATED                         SELECTOR
nginx-backup-20210202050222   nginx-backup   Completed   2021-02-02 05:02:22 +0000 UTC   2021-02-02 05:02:26 +0000 UTC   0        0          2021-02-02 05:02:22 +0000 UTC   <none>
ubuntu@helmetsky:~$ kubectl get namespaces
NAME                 STATUS   AGE
default              Active   12h
kube-node-lease      Active   12h
kube-public          Active   12h
kube-system          Active   12h
local-path-storage   Active   12h
nginx-example        Active   9s
trident              Active   11h
velero               Active   24m
ubuntu@helmetsky:~$ kubectl get svc -n nginx-example
NAME       TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
my-nginx   LoadBalancer   10.96.121.63   <pending>     80:30729/TCP   19s
```

## Video demo

Find it [here](https://www.youtube.com/watch?v=EV7Ns_g3pic).

## Notes

Note I didn't use the Velero CSI plugin. The objective was to check and document how StorageGRID, not Trident CSI, can work with Velero.
