# StorageGRID object versioning

RTFM: poven approach to enabling and using StorageGRID versioned buckets

"There's no documentation" is different from "there are no copy-paste examples".

The StorageGRID documentation has no (or has very few) S3 API copy-paste examples because StorageGRID follows the Amazon S3 API and the only thing the StorageGRID documentation *needs* to say is to inform the user if something is implemented, and highlight implementation differences (if any). The StorageGRID documentation [does](https://docs.netapp.com/sgws-114/topic/com.netapp.doc.sg-s3/GUID-0B54A113-91F3-46F4-836E-094C367806D9.html?resultof=%22%78%2d%61%6d%7a%2d%6d%66%61%22%20) both of these things.

So yes, there is documentation. But sometimes we need to read it and apply an effort to figure it out.

## What does it take

- Create a bucket
- Enable versioning

## GET Bucket versioning

Assuming you've overcome the first hurdle and now you have a bucket called `versioned`. Searching the StorageGRID docs you find a page with "Operations on buckets" with "PUT Bucket versioning". Everything is clearly explained.

So versioning is something that's done to a bucket. In other words it's *not* a tenant API thing. And you can enable it or suspend it (if it's been enabled).

The Amazon S3 API reference [page](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketVersioning.html) has both the PUT and GET examples. For both PUT and GET we do not use `x-amz-mfa` because StorageGRID does not support it (and yes, that too is documented).

```
GET /?versioning HTTP/1.1
Host: Bucket.s3.amazonaws.com
x-amz-expected-bucket-owner: ExpectedBucketOwner
```

My StorgeGRID tenant account is `11111111111111111111`, as Tenant Administrator `root` I own the bucket `versioned` and my StorageGRID S3 API endpoint is `s3.org.com`, so I need to `GET` this info from one of these URLs (depending on how your StorageGRID is [configured](https://docs.netapp.com/sgws-114/topic/com.netapp.doc.sg-s3/GUID-91153FD2-CB4B-4A08-89BB-98BEDFD70438.html?resultof=%22%76%69%72%74%75%61%6c%22%20%22%70%61%74%68%22%20)):

- `https://s3.org.com/versioned/?versioning&x-amz-expected-bucket-owner=11111111111111111111` (in my environment I use path-style requests), or
- `https://versioned.s3.org.com/?versioning&x-amz-expected-bucket-owner=11111111111111111111` (following the S3 API example, virtual host-style configuration)

Unlike I, you'd better use proper TLS certificates. The URL and indeed the entire path must match your StorageGRID environment:

```sh
wget --no-check-certificate --quiet \
  --method GET \
  --timeout=0 \
  --header 'X-Amz-Content-Sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' \
  --header 'X-Amz-Date: 20210119T084616Z' \
  --header 'Authorization: AWS4-HMAC-SHA256 \
    Credential=22222222222222222222222222222/us-east-1/s3/aws4_request, \
    SignedHeaders=host;x-amz-content-sha256;x-amz-date, \
    Signature=4d35192374d84c6103592cca01c8ea04e2a8719d6658e33fef34eea306b3d47b' \
   'https://s3.org.com/versioned/?versioning&x-amz-expected-bucket-owner=11111111111111111111'
```

Which parts of the above do we need to provide?

- Access key that belongs to the owner of the bucket - we need that for AWS Signature authorization
- Secret key that matches access key, also for authorization (both are provided to the API, not used in the URL or header)
- method: `GET`, because I want to get information
- `versioning` (method in the URL) because that's what we want to `GET`
- Header info you need to provide
  - Credential:
    - AWS region - StorageGRID defaults to `us-east-1`, check with your grid administrator in the case that doesn't work)
    - AWS service - just use `s3` for this
    - `us-east-1/s3/aws4_request` comes from (AWS region + AWS service + `aws4_request`) - the last chunk is v4 signature string (as per Step 3, [here](https://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html))
  - SignedHeaders and signature (v4 in this case) are done by the S3 API client for you
- URL to your bucket (https://s3.org.com/versioned/ or https://versioned.s3.org.com/), with `x-amz-expected-bucket-owner` as tenant ID (11111111111111111111)

Within seconds, we get a response like this:

```raw
<?xml version="1.0" encoding="UTF-8"?>
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Status>Enabled</Status>
</VersioningConfiguration>
```

## PUT Bucket versioning

Versioning is already enabled on the bucket `versioned`, so at this point I can only use `PUT` to suspend (or enable, once I've suspended it) versioning. If you prefer the S3 CLI, you can find the syntax [here](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-bucket-versioning.html).

```raw
PUT /?versioning HTTP/1.1
Host: s3.org.com/versioned
Content-MD5: ContentMD5
x-amz-expected-bucket-owner: 11111111111111111111
<?xml version="1.0" encoding="UTF-8"?>
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <Status>Suspended</Status>
</VersioningConfiguration>
```

With `wget` (I am using path-style URL; remember to use the correct URL):

```sh
wget --no-check-certificate --quiet \
  --method PUT \
  --timeout=0 \
  --header 'X-Amz-Content-Sha256: beaead3198f7da1e70d03ab969765e0821b24fc913697e929e726aeaebf0eba3' \
  --header 'X-Amz-Date: 20210119T093751Z' \
  --header 'Authorization: AWS4-HMAC-SHA256 \
    Credential=22222222222222222222222222222/us-east-1/s3/aws4_request, \
    SignedHeaders=host;x-amz-content-sha256;x-amz-date, \
    Signature=7ee4f0c6af5a77e5586a295617b7bd681871837f54a74da9c4f0b90a40465130' \
  --header 'Content-Type: text/plain' \
  --body-data '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"> 
   <Status>Suspended</Status> 
</VersioningConfiguration>' \
   'https://s3.org.com/versioned/?versioning&x-amz-expected-bucket-owner=11111111111111111111'
```

This returns nothing but 200 if the request has been successful (it may take a few seconds, so don't cancel prematurely).

After this, I can do another `PUT` to check the current status:

```raw
<?xml version="1.0" encoding="UTF-8"?>
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Status>Suspended</Status>
</VersioningConfiguration>
```

## How to use

You must have the permission to read object tags (`s3:GetObjectVersionTagging`), which I as tenant administrator have. Otherwise I'd have to get the bucket owner(s). I had to re-enable versioning because I had forgotten I suspended it minutes ago.

To have something to work with, I've uploaded (PUT) debug.log to the bucket `versioned`, re-enabled versioning, edited local copy of debug.log and uploaded it again.

To get version info for my object, I just need to ask for it by GET-ing `https://<path-to-bucket>/versioned/?versions` in the request URL. Here's what I got:

```raw
<?xml version="1.0" encoding="UTF-8"?>
<ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Name>versioned</Name>
    <VersionIdMarker></VersionIdMarker>
    <Prefix></Prefix>
    <KeyMarker></KeyMarker>
    <MaxKeys>1000</MaxKeys>
    <IsTruncated>false</IsTruncated>
    <Version>
        <Key>debug.log</Key>
        <VersionId>555555555555555555555555555555555555</VersionId>
        <IsLatest>true</IsLatest>
        <LastModified>2021-01-19T10:04:18.027Z</LastModified>
        <StorageClass>STANDARD</StorageClass>
        <ETag>&quot;bfad4ad7a3da63c8e06484f3900a5c13&quot;</ETag>
        <Size>768</Size>
        <Owner>
            <ID>11111111111111111111</ID>
            <DisplayName>scaleoutSean</DisplayName>
        </Owner>
    </Version>
    <Version>
        <Key>debug.log</Key>
        <VersionId>null</VersionId>
        <IsLatest>false</IsLatest>
        <LastModified>2021-01-19T09:52:24.320Z</LastModified>
        <StorageClass>STANDARD</StorageClass>
        <ETag>&quot;45ac6ed79226ac3297ff6ac7cbd1f227&quot;</ETag>
        <Size>760</Size>
        <Owner>
            <ID>11111111111111111111</ID>
            <DisplayName>scaleoutSean</DisplayName>
        </Owner>
    </Version>
</ListVersionsResult>
```

One noteworthy thing in this example is that the first version has VersionID `null`. That's because I uploaded it while versioning was suspended.

The second version was updated after versioning on the bucket was re-enabled and its VersionID is `555555555555555555555555555555555555`.

If we asked for versioning on this particular object (debug.log) in this bucket, we'd do a GET to `https://<path-style>/versioned/?versions&key-marker=debug.log`. You'd get a simpler response like below. `IsTruncated` would be true if we were to attempt to get versioning info about a deleted object.

```raw
<?xml version="1.0" encoding="UTF-8"?>
<ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Name>versioned</Name>
    <VersionIdMarker></VersionIdMarker>
    <Prefix></Prefix>
    <KeyMarker>debug.log</KeyMarker>
    <MaxKeys>1000</MaxKeys>
    <IsTruncated>false</IsTruncated>
</ListVersionsResult>
```

Going back to those two available versions - how to get the particular object version?

- Non-versioned (with S3 path-style requests): `versioned/debug.log?versionId=null` or just `/versioned/debug.log`
- Versioned (also with S3 path-style requests): `versioned/debug.log?versionId=555555555555555555555555555555555555`

```sh
wget --no-check-certificate --quiet \
  --method GET \
  --timeout=0 \
  --header 'X-Amz-Content-Sha256: e3b0c44298fc1c149afb34c8996fb92427ae41e4649b934ca495991b7852b855' \
  --header 'X-Amz-Date: 20210119T102408Z' \
  --header 'Authorization: AWS4-HMAC-SHA256 \
    Credential=22222222222222222222222222222/20210119/us-east-1/s3/aws4_request, \
    SignedHeaders=host;x-amz-content-sha256;x-amz-date, \
    Signature=2098bd1cbe6635b1bf27200bc3d98298707dd1972a7bf33d6ecdb60bbb402cd5' \
   'https://s3.org.com/versioned/versioned/debug.log?versionId=555555555555555555555555555555555555'
```
