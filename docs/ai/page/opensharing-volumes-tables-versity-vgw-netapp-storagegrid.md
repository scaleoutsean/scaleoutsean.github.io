# OpenSharing server for NetApp StorageGRID and E-Series with Versity S3 Gateway

Another demo of OpenSharing Tables, this time with StorageGRID 12

- PART ONE: [Does OpenSharing have anything for NetApp E-Series?](/2026/06/14/netapp-eseries-opensharing-deltasharing.html)
- PART TWO: [IoT ingress, OpenSharing, Versity S3 Gateway and NetApp E-Series](/2026/06/16/netapp-eseries-iot-compaction-opensharing.html)
- PART THREE: [NetApp volume content sharing with OpenSharing and Versity S3 Gateway](/2026/06/17/opensharing-files-versity-s3-gateway-netapp-eseries.html)
- **PART FOUR:** OpenSharing demo server for NetApp StorageGRID and E-Series with Versity S3 Gateway
- PART FIVE: [OpenSharing Server with S3/RDMA-based Versity S3 Gateway](/2026/08/10/opensharing-with-versity-s3-rdma-and-netapp-eseries.html)

In the previous three posts I explained what made me interested in OpenSharing and my first target was E-Series, as the one with highest "upside" - from absolutely no way to share anything, to (almost) first class Data Lakehouse citizen in no time!

NetApp StorageGRID is the other interesting one: like E-Series, it has no NAS solution. It has S3, so it's not nearly as bad as a E-Series, but it's the main NetApp product for AI and analytics so there's no excuse for not getting this going.

Now the Python API server has been redone in Go, and it's confirmed to work with StorageGRID 12.0 with TLS.

The whole thing doesn't work any different from how OpenSharing Python server with the Versity S3 Gateway looked like, but I have some screenshots.

First, I uploaded the same tables data to StorageGRID 12 (there's another table in the "IoT" subdirectory that we can't see from this view).

![StorageGRID bucket default-bucket](/assets/images/opensharing-eseries-20-storagegrid-volumes-tables.png)

We'll hit that endpoint from the URL bar and the Parquet file at the bottom of this screenshot.

Then we start the server (container or VM/bare metal):

![Start OpenSharing Server for StorageGRID and VGW](/assets/images/opensharing-eseries-21-opensharing-go-start-from-cli.png)

Commands to run from the CLI without authentication:

```sh
$ export AUTH_REQUIRED=false
$ export S3_INTERNAL_ENDPOINT=https://192.168.1.211:10443
$ export S3_EXTERNAL_ENDPOINT=https://192.168.1.211:10443
$ export S3_ACCESS_KEY=bla
$ export S3_SECRET_KEY=bla-bla
$ export REGISTRY_PATH=config/shares.yaml
$ export S3_CA_BUNDLE=$PWD/certs/storagegrid-ca.crt
$ export S3_TLS_VERIFY=true
$ ./opensharing-server
2026/07/22 23:16:01 registry loaded path=config/shares.yaml mod_time=2026-07-21T12:14:39+08:00
2026/07/22 23:16:01 config: auth_required=false s3_internal_endpoint=https://192.168.1.211:10443 s3_external_endpoint=https://192.168.1.211:10443 s3_request_timeout=10s
2026/07/22 23:16:01 opensharing server listening on :8000
```

`./config/shares.yaml` is where OpenSharing shares are defined. 

That hasn't changed from previous posts.

```yaml
tenants:
  - name: default
    shares:
      - name: my-share
        recipients:
          oidcEmails:
            - alice@example.com
          oidcSubjects: []
          oidcGroups:
            - beegfs-admins
        schemas:
          - name: my-schema
            tables:
              - name: my-table
                format: parquet
                storageLocation: s3://default-bucket/
                singleObject: test-object.parquet
                singleObjectSize: 35274209
                schemaString: '{"type":"struct","fields":[{"name":"A","type":"long","nullable":true,"metadata":{}},{"name":"B","type":"long","nullable":true,"metadata":{}},{"name":"C","type":"long","nullable":true,"metadata":{}},{"name":"D","type":"long","nullable":true,"metadata":{}}]}'
              - name: iot_silver_table
                format: parquet
                storageLocation: s3://default-bucket/iot_silver_table/
                schemaString: '{"type":"struct","fields":[{"name":"device_id","type":"string","nullable":true,"metadata":{}},{"name":"Temperature","type":"double","nullable":true,"metadata":{}},{"name":"target","type":"double","nullable":true,"metadata":{}}]}'
            volumes:
              - name: volume-bucket
                storageLocation: s3://volume-bucket/
                include: ["*"]
                exclude: [".internal/*"]
```                

We'd have to obtain JWT and add bearer token to our REST requests to OpenSharing API server if authentication wasn't disabled.

Using OpenSharing REST we can get a list of shares, schemas, and tables/volumes in them. These (in my current implementation) may be Delta tables or "plain" volumes (see the previous posts), as other types aren't as high priority for E-Series now. I marked the endpoint and Parquet file in the screenshot.

![List shares and schemas](/assets/images/opensharing-eseries-22-opensharing-get-shares.png)

Then, like in the previous posts, the same query with the same data works the same way, only this time with StorageGRID 12.0 (I used the Versity S3 Gateway in earlier posts). I don't expect any changes will be needed for the recently announced StorageGRID 12.1 - OpenSharing server uses extremely basic S3 API methods.

![Query Delta tables](/assets/images/opensharing-eseries-23-opensharing-queries.png)

The first query hits the first table (`s3://default-bucket/test-object.parquet`) while the second goes to the IoT table from previous posts. I only emphasized the first table to simplify this post.

## Notes

Currently, my OpenSharing Server for SG and E-Series exposes an HTTP port. You should hide it behind an HTTPS API proxy of your choice (as usual with API servers) where you can enable HTTPS, PQC, DDoS defense, IP source restriction, etc.

OAuth2 is available just like it was in the Python demos. Unlike in the Python demos, there's an option to disable it and there's also an option to use your own OAuth2 server, so it's more "real" that the Python based PoCs were.

OpenSharing Tables (for Delta tables) and Volumes are implemented, also like in the Python demos from the other posts. More might be added later if I find some use cases that interest me or if users ask me about them. At this time, the server does everything I wanted. Last week, OpenSharing Tables specs added Iceberg table support, but it's too early to care about that now.

What's missing is STS ([Assume Role](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). This is part of the specification, but it's not mandatory. Versity S3 Gateway doesn't support STS yet, which is one of the reasons I did not even try.

There's a Docker Compose YAML that lets you start everything in seconds.

I'll put a binary build of my [OpenSharing server on Github](https://github.com/scaleoutsean/opensharing-server/) - that should suffice for casual testing and use. The link will be added to Projects page. 

I have some extra ideas which I haven't implemented yet, but I update and expand the server only if there's meaningful feedback and traction. As-is, it works well enough for my development needs.

## Summary

While NetApp will likely add OpenSharing server to StorageGRID, E-Series users may not be as lucky, so in my opinion this approach is much more valuable to E-Series users - "securely share your E-Series-parked (or stuck) data for free" sounds useful (use case: 3 PiB of archive data securely parked for free and shared, compared to whatever amount of dollars it'd cost to park it on capacity-metered commercial S3 storage). You get OAuth2 (no need to deal with S3 credentials and manage S3 users), auditing, and everything else. What's not to like?

Do stand-alone OpenSharing servers have a future? I think so. Should you build your own? Maybe. 

I know many enterprise users would prefer the lazy and convenient way (built into the box), but there are those who will want to add value with their own implementations and I believe there will be commercial OpenSharing server implementations that will support multiple S3 vendors (just like my server does) and add value over what you find on a box (whether it's StorageGRID or EverPure or whoever).
