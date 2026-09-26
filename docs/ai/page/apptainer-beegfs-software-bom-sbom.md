# SBOM with signed Apptainer containers on BeeGFS

Use Apptainer to secure applications and data on NetApp E-Series BeeGFS clusters

- [Introduction](#introduction)
- [Why](#why)
- [Build data-app container and check its inventory](#build-data-app-container-and-check-its-inventory)
- [Use it](#use-it)
- [Conclusion](#conclusion)

## Introduction

To give credit where credit is due - this post is inspired by a recent update from Singularity in which they noted that Syft has added support for the SIF format used by Singularity (and Apptainer).

I thought to give this workflow a try and write a post that outlines additional advantages of Apptainer containers. I got some help from an Apptainer expert which helped me save time, and referenced the official Apptainer documentation for the rest.

## Why

As most readers know, NetApp has an E-Series BeeGFS solution which I often write about. 

Although E-Series arrays have very strong security features, and NetApp's BeeGFS solution is based on BeeGFS with enterprise features which includes ACLs, BeeGFS itself currently has no encryption. This may pose challenges in some environments.

Many NetApp users keep highly secure data on ONTAP systems or StorageGRID (Object Storage), but there are cases (performance, cost, etc.) where keeping such data on BeeGFS is desired.

Anther, generic challenge is the security and portability of applications, where Singularity-type containers shine. SBOM-features of Syft only add to those strengths and now that Syft supports SIF (Singularity) archives, we can do this and more:

- Create Singularity/Apptainer containers on BeeGFS
- Package data with applications if we want to create a seamless user experience or ship application with data (dark sites, offline use, etc.)
- Check packaged Apptainer containers for vulnerabilities
- Cryptographically sign (clear-sign) such containers to assure the user of their integrity (they would need to have, and trust, our public key)
- Create SBOM for such containers, so that the user can inspect them without scanning those (maybe TB-sized) containers, although they can still do that, too
- Encrypt and sign containers on BeeGFS (which makes data secure, but obviously such containers can no longer be scanned after the fact)
- Do other neat stuff (more on that below)

To learn about Software Bill of Materials aka SBOM, see [here](https://www.cisa.gov/sbom).

## Build data-app container and check its inventory

Download or copy data (logo.png) your application will use and prepare a definition file that combines your app and data.

In our case that file is caddy.def:

```sh
Bootstrap: docker
From: caddy:latest

%files
  logo.png /srv/view-me.png

%startscript
  caddy file-server --browse --listen :8080 --root /srv
```

Build:

```sh
apptainer build caddy.sif caddy.def
```

Use `apptainer key` sub-commands on this new image:

- `create` (a new PGP key)
- `sign caddy.sif`
- `verify caddy.sif`

Repeat the build with a different container file name for the encrypted version:

```sh
sudo apptainer build --passphrase caddy-encrypted.sif caddy.def
```

Create a software BOM for the first application-data image:

```sh
syft singularity:caddy.sif -o json=caddy.sbom.cdx.json
```

What's in an SBOM file? Stuff like this (shortened for brevity):

```json 
{
 "artifacts": [
  {
   "id": "35085779bdf473bb",
   "name": "alpine-baselayout",
   "version": "3.2.0-r22",
   "type": "apk",
   "foundBy": "apkdb-cataloger",
   "locations": [
    {
     "path": "/lib/apk/db/installed",
     "layerID": "sha256:a7f6a64cd530e56e9a10d50c21751550d382085eee14bb35b2e314172ac83033"
    }
   ],
   "licenses": [
    "GPL-2.0-only"
   ],
   "language": "",
   "cpes": [
    "cpe:2.3:a:alpine-baselayout:alpine-baselayout:3.2.0-r22:*:*:*:*:*:*:*",
    "cpe:2.3:a:alpine:alpine_baselayout:3.2.0-r22:*:*:*:*:*:*:*"
   ],
   "purl": "pkg:alpine/alpine-baselayout@3.2.0-r22?arch=x86_64&upstream=alpine-baselayout&distro=alpine-3.16.2",
   "metadataType": "ApkMetadata",
   "metadata": {
    "package": "alpine-baselayout",
    "originPackage": "alpine-baselayout",
    "maintainer": "Natanael Copa <ncopa@alpinelinux.org>",
    "version": "3.2.0-r22",
    "license": "GPL-2.0-only",
    "architecture": "x86_64",
    "url": "https://git.alpinelinux.org/cgit/aports/tree/main/alpine-baselayout",
    "description": "Alpine base dir structure and init scripts",
    "size": 11126,
    "installedSize": 348160,
    "pullDependencies": "alpine-baselayout-data=3.2.0-r22 /bin/sh so:libc.musl-x86_64.so.1",
    "pullChecksum": "Q1l6/nM0K+cyVdqNfgkp1/c6Ylzk0=",
    "gitCommitOfApkPort": "cb70ca5c6d6db0399d2dd09189c5d57827bce5cd",
    "files": [
     {...} ]
    }
  ]
}
```

Check the SBOM file for known and published vulnerabilities:

![Grype result of SBOM scan](/assets/images/apptainer-sbom-beegfs-02.png)

This works with clear-signed Apptainer containers, too:

```sh
$ grype sbom:caddy-signed.sbom.cdx.json
 ✔ Vulnerability DB        [no update available]
 ✔ Scanned image           [2 vulnerabilities]

NAME                        INSTALLED  FIXED-IN  TYPE       VULNERABILITY   SEVERITY 
google.golang.org/protobuf  v1.28.0              go-module  CVE-2015-5237   High      
google.golang.org/protobuf  v1.28.0              go-module  CVE-2021-22570  High   
```

This container contains one vulnerable Go module with two published CVEs. For CVEs as old as that it's weird that `FIXED-IN` is empty (usually it's not). I had to check and found [this](https://github.com/advisories/GHSA-jwvw-v7c5-m82h) which shows there's a fix. Maybe that's a Grype bug.

Our Web application exposes container data in read-only fashion, so we'll proceed anyway. We could build a newer Caddy container to fix this, of course. 

Once a container is cryptographically signed, application and data in it can be implicitly trusted for trusted PGP keys.

```sh
$ apptainer verify caddy-encrypted.sif
Verifying image: caddy-encrypted.sif
[LOCAL]   Signing entity: Sean XXXXXXX <XXXXXXXXXXX@netapp.com>
[LOCAL]   Fingerprint: 9D1AC07D2BA49D2BB70B3E9D59624FF646415296
Objects verified:
ID  |GROUP   |LINK    |TYPE
------------------------------------------------
1   |1       |NONE    |Def.FILE
2   |1       |NONE    |JSON.Generic
3   |1       |NONE    |JSON.Generic
4   |1       |NONE    |FS
Container verified: caddy-encrypted.sif
```

## Use it 

Now that we got our app+data container, we can move it around without the fear of tampering.

The container itself *could* be uploaded to a container registry, but I don't expect that *large* containers that pack data would be commonly stored in a container registry. But sometimes you may want to do that.

Some random thoughts about that:

- Signed containers without data can of course be stored in container registry (see this [example](https://medium.com/@panda1100/aws-elastic-container-registry-as-apptainer-image-registry-bc82eca59375) of using AWS Elastic Container Registry to store Apptainer images)
- Tamper-proof (i.e. signed) containers that include data (which can be very large!) are suitable for keeping on BeeGFS with properly configured ACLs if data is not very sensitive
- Encrypted signed containers that package data can be kept on BeeGFS even if data in the container is sensitive
  - Apptainer SBOM must be generated before the container is encrypted. SBOM reports can be clear-signed with PGP and left on BeeGFS
  - Vulnerability scan result can also be included with the image; otherwise the Grype output file that goes with the container would have to be signed as well (so that it cannot be tampered with)
- You must be careful about storing passwords in containers (best approach: don't do it). For example, even in caddy-encrypted.sif it's possible to see the start script. If there was a password in that line, that could be bad - especially for signed-only data+app containers:

```sh
#!/usr/bin/env run-singularity
SIF_MAGIC-TON-OF-BINARY-STUFF-HERE
c02Bootstrap: docker-TON-OF-BINARY-STUFF-HERE
From: caddy:latest

%files
  logo.png /srv/view-me.png

%startscript
  caddy file-server --browse --listen :8080 --root /srv
```

Once our app+data container is ready, we can keep it on BeeGFS and run it when we need to.

Starting and stopping these instances (one at a time, if you haven't changed application port for different builds) is easy:

```sh
$ apptainer instance start --passphrase caddy-encrypted.sif web1
$ apptainer instance stop web1
```

Common steps in one big screenshot:

![Check container source and run it](/assets/images/apptainer-sbom-beegfs-01.png)

Knowing that our app binds `*:8080`, we can access it from a Web browser:

![Caddy instance in encrypted Apptainer](/assets/images/apptainer-sbom-beegfs-03.png)

Access application data (view-me.png):

![Packaged data in encrypted Apptainer](/assets/images/apptainer-sbom-beegfs-04.png)

While this demo container runs a Web application, Apptainer containers can be built to run services, batch jobs and more.

## Conclusion

Syft support for the SIF format adds valuable features to Apptainer containers - not just "app+data containers", but all Apptainer containers.

NetApp BeeGFS users benefit from other Apptainer features (see [this post](/2022/08/08/apptainer-with-beegfs-mounts.html), for example), but signing and encryption not only prevents tampering, but it also provides a simple way to bundle data and application SBOM files and vulnerability reports within Apptainer containers.

While SBOM and vulnerability data should probably be easy to access via an API and in an automated fashion, nothing prevents us from *also* storing SBOM files and vulnerability reports elsewhere. Today many users still do not have a formal way to store and query SBOMs and vulnerability scan results, so being able to include that in data and app containers and archives can be useful.

The approach of packaging data with applications is useful for other reasons as well, for example in hybrid multi-cloud environments.

Data on an encrypted filesystem normally loses protection as soon as it's moved to another location. There are ways to solve that, for example with file encryption that relies on external key manager or using filesystem replication. But these approaches can be expensive, complex, or inconvenient. Once a file is copied off an encrypted filesystem to a remote location it needs to be checked for integrity (and maybe not just while copying, but before each and every use) and then accessed by the application which the destination may not have available in a convenient container format such as Apptainer.

Signed app+data Apptainer containers, on the other hand, are completely self-contained, portable, tamper-proof (even from bit rot), easy to inspect (SBOM) and use. Signed encrypted containers are also tamper-proof and offer additional data security to users who need it.
