# Red Hat Quay with NetApp StorageGRID S3 Back End

How to configure StorageGRID as Red Hat Quay Amazon S3-compatible backend

Create a bucket, say `quay`, and a set of S3 keys for one of your S3 users to use with this bucket.

Pick **Amazon S3-compatible storage**, enter the required info, validate.

(Note: I've had several people who picked another type ask my why my blog post "doesn't work", so now the above option is bolded. I can't help beyond that!)

![StorageGRID 11.5 passes S3-compatible validation](/assets/images/red-hat-quay-netapp-storagegrid-11.png)

Then download your config file, and save it for use with "real" Red Hat Quay service.

Here's an example of a simplest configuration (my "site" is called `sg3`) in `config.yaml`:

```yaml
DISTRIBUTED_STORAGE_CONFIG:
    sg3:
        - S3Storage
        - host: sg3.netapp.com
          port: "8082"
          s3_access_key: 3SHxxxxxxxxxxx4U0
          s3_bucket: quay
          s3_secret_key: eZxxxxxxxxxxxxxxxxxxxxxxxxxxxcD4
          storage_path: /
DISTRIBUTED_STORAGE_DEFAULT_LOCATIONS: []
DISTRIBUTED_STORAGE_PREFERENCE:
    - sg3
```

Note that you can use arbitrary HTTPS ports (like 18082). That works fine, but you must either have proper TLS certificates on S3 gateway, or else load your own snake-oil certificates at the top of the configuration page (from which I took the screenshot above). HTTP won't work.

Also note I didn't actually try to run Quay (3.5) after I passed validation. I've spent too much time and run out of patience by the time I got around various issues.

Software used:

- Ubuntu 20.04
  - Docker 20.10.9
  - Red Hat Quay configuration tool (not versioned; I used [this one](https://quay.io/repository/projectquay/config-tool/manifest/sha256:0e5a3e05a534910a3629a0a9e65cdbbd9d1270a4bc35b74319bbdec76caaf013))
- NetApp StorageGRID 11.5
  - Self-signed CA & TLS certificate

### Update (2021/10/25)

I also performed configuration validation using the official Red Hat stack:

- Red Hat Enterprise Linux 8.4
  - Podman
- Red Hat Quay 3.6.0
- NetApp StorageGRID 11.5

It worked the same.

A demo video can be found [here](https://youtu.be/44XJPG98os0) (1m43s).

### Update (2023/08/02)

See [this](/2023/07/26/ontap-s3-as-velero-object-store.html) for Velero with ONTAP S3 Object Store.
