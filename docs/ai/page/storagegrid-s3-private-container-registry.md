# Use StorageGRID for private container registry

StorageGRID as S3 back-end for Docker / Harbor Registry server

## Docker Registry

[This](https://blog.netapp.com/blogs/deploying-docker-registry-on-netapp-storagegrid-webscale/) post needs a refresh, but the tldr of it is: you need to work by Docker docs and use StorageGRID values like so:

```raw
- regionendpoint: https://s3.dot.org:8443  # StorageGRID S3 API endpoint
- bucket: docker-registry        # create it beforehand, secure with S3 ACLs
- secure: true                   # use HTTPS to SG S3 (strongly recommended)
- v4auth: true                   # v4 auth, we want this
- chunksize: 8388608             # Docker Registry min is 5*1024*1024, here I set 8 MiB
- rootdirectory: /scaleoutsean   # "subdirectory" in bucket
```

There are other settings you can (and have to) set, some mandatory (but not StorageGRID-specific), some optional. I haven't tested `encrypt` (optional, default: `false`), for example.

Start Docker registry container (by default it runs on port 5000, but I'm running mine on port 5001) and push a docker image to it:

```sh
$ sudo docker push localhost:5001/sean/onecollect:2.2
The push refers to repository [localhost:5001/sean/onecollect]
1f86270f8b10: Pushed 
d8e7bb532026: Pushed 
4491ef6d3684: Pushed 
237fede51eb1: Pushed 
22b25abc8483: Pushed 
3079b27917f6: Pushed 
474ea542cb75: Pushed 
d65a2752aa83: Pushed 
a82f5cf3c2ac: Pushed 
0484528dc83e: Pushed 
40a9a68a4a2d: Pushed 
1704948fdfa1: Pushed 
43111861f90f: Pushed 
e39388a91f88: Pushed 
d69f00255e33: Pushed 
cc9d18e90faa: Pushed 
0c2689e3f920: Pushed 
47dde53750b4: Pushed 
2.2: digest: sha256:11752ab8043ac8eea544cd1f94540f3cc7f2999b678db4c06c84e8b0d1d4fde1 size: 4070
```

Now you should see some stuff in the registry-backing bucket:

![StorageGRID Docker's docker-registry bucket](/assets/images/storagegrid-docker-s3-registry.png)

Because we downloaded that Docker image from Docker Hub first, now we have two:

```sh
$ sudo docker images | grep coll
localhost:5001/sean/onecollect       2.2                 fb484820200c        2 months ago        350MB
netapp/onecollect                    latest              fb484820200c        2 months ago        350MB
```

Remove both of them and try to download [OneCollect](https://hub.docker.com/r/netapp/onecollect/) from StorageGRID-backed private registry:

```sh
$ sudo docker pull localhost:5001/sean/onecollect:2.2
2.2: Pulling from sean/onecollect
6a5697faee43: Pull complete 
ba13d3bc422b: Pull complete 
a254829d9e55: Pull complete 
307bfc31a030: Pull complete 
8d16aae92253: Pull complete 
e880f7506ac2: Pull complete 
8658c249d939: Pull complete 
e62f0c8b95a8: Pull complete 
b3467aefecbc: Pull complete 
e6ff3d4e27e5: Pull complete 
198075eb550e: Pull complete 
aa0aad1f63d7: Pull complete 
edcb4255c8da: Pull complete 
e6dc89a40119: Pull complete 
b8c7dc79a72e: Pull complete 
5a15ee51ad5a: Pull complete 
2ba1851ce93a: Pull complete 
1f9a330b5ade: Pull complete 
Digest: sha256:11752ab8043ac8eea544cd1f94540f3cc7f2999b678db4c06c84e8b0d1d4fde1
Status: Downloaded newer image for localhost:5001/sean/onecollect:2.2
localhost:5001/sean/onecollect:2.2
```

## Harbor Registry

After Docker Registry I installed Harbor. It's very similar and S3 related settings are nearly identical (in `harbor.yaml`) - I even used the same StorageGRID S3 bucket (`rootdirectory` was `scaleoutsean-harbor` vs. `scaleoutsean` with Docker Registry).

```sh
$ docker images
REPOSITORY                             TAG                 IMAGE ID            CREATED             SIZE
goharbor/chartmuseum-photon            v2.2.0              036eabb4e8b4        7 days ago          165MB
goharbor/redis-photon                  v2.2.0              af30f909bcd0        7 days ago          68.9MB
goharbor/trivy-adapter-photon          v2.2.0              576741ea40ad        7 days ago          116MB
goharbor/notary-server-photon          v2.2.0              e4dcdf19f2ca        7 days ago          101MB
goharbor/notary-signer-photon          v2.2.0              8d2b8194d69c        7 days ago          98.4MB
goharbor/harbor-registryctl            v2.2.0              7d2c74e67290        7 days ago          128MB
goharbor/registry-photon               v2.2.0              76a8d4dfb507        7 days ago          77.2MB
goharbor/nginx-photon                  v2.2.0              1eed7232f077        7 days ago          40.2MB
goharbor/harbor-log                    v2.2.0              186bd0f71fc4        7 days ago          108MB
goharbor/harbor-jobservice             v2.2.0              aaa1bcbec29f        7 days ago          163MB
goharbor/harbor-core                   v2.2.0              bef56a1d9844        7 days ago          148MB
localhost:5000/library/harbor-portal   v2.2.0              c81e05ebcfba        7 days ago          51MB
goharbor/harbor-portal                 v2.2.0              c81e05ebcfba        7 days ago          51MB
goharbor/harbor-db                     v2.2.0              818e07587d3b        7 days ago          174MB
goharbor/prepare                       v2.2.0              0e98e9a1a9b1        7 days ago          165MB
goharbor/harbor-exporter               v2.2.0              9ab1248a90dd        7 days ago          76.1MB
k8s.gcr.io/kube-proxy                  v1.20.2             43154ddb57a8        5 weeks ago         118MB
k8s.gcr.io/kube-apiserver              v1.20.2             a8c2fdb8bf76        5 weeks ago         122MB
k8s.gcr.io/kube-controller-manager     v1.20.2             a27166429d98        5 weeks ago         116MB
k8s.gcr.io/kube-scheduler              v1.20.2             ed2c44fbdd78        5 weeks ago         46.4MB
registry                               2                   678dfa38fcfa        2 months ago        26.2MB
registry                               latest              678dfa38fcfa        2 months ago        26.2MB
netapp/onecollect                      2.2                 fb484820200c        2 months ago        350MB
localhost:5001/sean/onecollect         2.2                 fb484820200c        2 months ago        350MB
k8s.gcr.io/etcd                        3.4.13-0            0369cf4303ff        5 months ago        253MB
k8s.gcr.io/coredns                     1.7.0               bfe3a36ebd25        8 months ago        45.2MB
k8s.gcr.io/pause                       3.2                 80d28bedfe5d        12 months ago       683kB

$ docker tag goharbor/nginx-photon:v2.2.0 localhost:5000/library/nginx-photon:v2.2.0

$ docker push localhost:5000/library/nginx-photon:v2.2.0
The push refers to repository [localhost:5000/library/nginx-photon]
57c3cb695990: Pushed 
230005775895: Mounted from library/harbor-portal 
v2.2.0: digest: sha256:5b2a1a4873e18444c6dffee72a2e8b7ce8880e8586b56eaa7e39b1575bb55a15 size: 740
```

In the same bucket, now in the `scaleoutsean-harbor` (sub)directory, we can see the uploaded content:

![Harbor's docker-registry bucket](/assets/images/storagegrid-harbor-s3-registry-bucket.png)

Same as with Docker Registry, we can pull specific version of the image using its SHA256 sum or tag.

```sh
$ docker pull localhost:5000/library/harbor-portal@sha256:8c9635208a3d89f8a3b575929672b3a14c3e3af59ca41c0afd09734a02a3df6e

$ docker pull localhost:5000/library/harbor-portal:v2.2.0
v2.2.0: Pulling from library/harbor-portal
Digest: sha256:8c9635208a3d89f8a3b575929672b3a14c3e3af59ca41c0afd09734a02a3df6e
Status: Image is up to date for localhost:5000/library/harbor-portal:v2.2.0
localhost:5000/library/harbor-portal:v2.2.0
```

The Web UI assists with these tasks and has some other features:

![Harbor's docker-registry bucket](/assets/images/storagegrid-harbor-s3-registry-portal.png)

![Harbor's docker-registry bucket](/assets/images/storagegrid-harbor-s3-registry.png)

## Demo

Find it [here](https://youtu.be/0Bn0Y3I7Hh8) (1m4s).

## References

- NetApp StorageGRID 11.4
- Docker Registry [S3 storage driver](https://docs.docker.com/registry/storage-drivers/s3/) options
- Harbor v2.2.0-rc2 ([download v2.2.0-rc2](https://github.com/goharbor/harbor/releases/tag/v2.2.0-rc2); [currently published documentation for v2.0.0](https://goharbor.io/docs/2.0.0/))
- [Storage configuration options](https://docs.docker.com/registry/configuration/#storage) for Docker Registry
