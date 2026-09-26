# StorageGRID with CloudMirror - replication to S3-compatible bucket

Simple intro to StorageGRID CloudMirror

## What

When CloudMirror is properly configured, StorageGRID places changes into a queue and copies modified objects to a remote S3 bucket.

This remote bucket can be AWS S3, another StorageGRID or some other object store that adheres to the S3 API.

## Why

If you need a persistent copy of your bucket data in another location - disaster recovery, predictably geographically distributed readers, distributed analytics, etc.

If you need a temporary or ad-hoc copy for quick or repetitive read access from remote clients, you can configure HTTP(S) read cache such as Varnish in front of StorageGRID. Varnish service can be located close to the S3 client(s).

## Steps

You should read the documentation as it doesn't make sense to rehash it here, so here goes a summary:

- Grid Admin must enable Platform Services for the Tenant (at Source). These services include CloudMirror, but also Search (Elasticsearch integration) and SNS.

- Tenant Admin must create an S3 API endpoint. This can be confusing. No, you don't *create* an endpoint and in fact don't create anything on the Grid you're using. You merely register a remote S3 API endpoint with your Grid, so that it knows where to send data. You must provide Access Key and Secure key for most Target buckets as they require some form of authentication and authorization.

- In Source bucket settings, paste the standard XML file for S3 replication. A simple template can be found in the StorageGRID documentation but you can use AWS S3 documentation as well (in the case you use the latter, some limitations outlined in the StorageGRID documentation apply - such as Storage Class is limited to `STANDARD` and so on). Best start with the skeleton configuration file from the StorageGRID documentation and improve it once you get it to work. Example to replicate s3://source-bucket/onlythis-subdir/ to s3://remote-bucket-name/onlythis-subdir/ (Standard storage class) on AWS S3:

```xml
<ReplicationConfiguration> 
    <Rule> 
        <Status>Enabled</Status> 
        <Prefix>onlythis-subdir/</Prefix> 
        <Destination> 
            <Bucket>arn:aws:s3:::remote-bucket-name</Bucket> 
            <StorageClass>STANDARD</StorageClass>
        </Destination> 
    </Rule> 
</ReplicationConfiguration>
```

## Gotchas

As the documentation highlights, existing objects won't get replicated. You need to "touch" them (update them in some way) or use a 3rd party utility to sync existing objects from Source to Target bucket, which can be done before you configure CloudMirror, but also after. In the case you do it after you'd probably prefer to use a filter to not replicate objects that have changed after CloudMirror was enabled (maybe filter by date or object name or something else).

In endpoint settings and bucket's XML file you need to supply `arn:aws:s3:::` for AWS S3 and `urn:sg:s3:::` for StorageGRID destination. This is mentioned in the documentation and online help, but of course ain't nobody got time to read that (or this paragraph).

I found the aws s3 CLI frustratingly hard to use for StorageGRID to StorageGRID sync as it makes it hard (in my experience impossible) to provide two sets of profiles and credentials required for Source and Target. Try rclone or some other utility.

## Workarounds

If CloudMirror doesn't support your destination object store (say, Azure Blob), consider using client-side utilities and services (such as NetApp CloudSync).

## Demo

- [Configure StorageGRID CloudMirror replication](https://www.youtube.com/watch?v=d_3C7Wq45n0) (2m33s)
