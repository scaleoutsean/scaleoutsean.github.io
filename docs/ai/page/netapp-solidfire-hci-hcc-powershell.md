# Using NetApp SolidFire Hybrid Cloud Control (HCC) API from PowerShell

It is easy, you just need to copy non-existing samples

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

In [this](/2020/12/08/get-bearer-token-for-netapp-hci-hybrid-cloud-control-logs.html) post I explained how we can interact with Hybrid Cloud Control (HCC).

In this - because the first one is a bit Python-focused and some folks couldn't get PowerShell to work - I'll explain how we can interact with the poorly documented HCC using PowerShell 7.

So, point number one is this is PowerShell **7**. I tend to use PowerShell on Linux (no PS 5.1 there) and Windows, so when I write a script I want it to work both on Windows and Linux - hence PS 7.

This isn't to say that we couldn't do this in PowerShell 5.1, but it'd have to be written differently. I'm not going to explore that because it's not related to HCC or SolidFire, but search engines should be helpful to help you adjust this for PS 5.1.

```powershell
$multipartContent = [System.Net.Http.MultipartFormDataContent]::new()
$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
$stringHeader.Name = "client_id"
$StringContent = [System.Net.Http.StringContent]::new("mnode-client")
$StringContent.Headers.ContentDisposition = $stringHeader
$multipartContent.Add($stringContent)

$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
$stringHeader.Name = "username"
$StringContent = [System.Net.Http.StringContent]::new("administrator")
$StringContent.Headers.ContentDisposition = $stringHeader
$multipartContent.Add($stringContent)

$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
$stringHeader.Name = "password"
$StringContent = [System.Net.Http.StringContent]::new("NetApp123")
$StringContent.Headers.ContentDisposition = $stringHeader
$multipartContent.Add($stringContent)

$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
$stringHeader.Name = "grant_type"
$StringContent = [System.Net.Http.StringContent]::new("password")
$StringContent.Headers.ContentDisposition = $stringHeader
$multipartContent.Add($stringContent)

$body = $multipartContent

$response = Invoke-RestMethod 'https://hcc.add.r.es/token' -Method 'POST' -Headers $headers -Body $body -SkipCertificateCheck:$True
$token    = $response.access_token

$headers = @{
    Authorization="Bearer $token"
}

$allassets= (Invoke-WebRequest 'https://hcc.add.r.es/mnode/assets' -Method 'GET' -Headers $headers -SkipCertificateCheck:$True).Content | ConvertFrom-Json

foreach ($c in $allassets.compute) {
    Write-Host "Host:", $c.host_name, "IP:", $c.ip
}
```

The second point is you need to be careful what you replace with what. Couple of notes related to script reuse:

- What you need to replace in the code above:
  - `administrator`: this is what I use to auth against mNode. Use your own account here
  - `NetApp123`: the password. Use your own. You could also expand the code to get credentials and avoid having to hard-code them in the script
  - `hcc.add.r.es`: replace this with your mNode's (and HCC's, the same thing) IP or FQDN
  - `SkipCertificateCheck:True`: ideally, use FQDN and proper TLS certs and set this to `False`. If you can't, use `True`
- Do *NOT* replace the word password or other stuff from `$body` at the top: we need that to obtain the token
- What happens in the script:
  - The first thing, `Invoke-RestMethod` is to get a bearer token, and the stuff above that is the form which we work with. This is the same as in the other HCC post and comes from Postman's translation of API into scripts (in this case PS)
  - The second thing, `Invoke-WebRequest` is to get info about all assets known to HCC. Once I get it, I do some stuff with the compute-related assets

Expected output is a list of compute hosts and their IPs. Something like:

```
Host: my-hci-c2  IP: 192.168.1.2
Host: my-hci-c1  IP: 192.168.1.1
Host: my-hci-c3  IP: 192.168.1.3
Host: my-hci-c5  IP: 192.168.1.5
Host: my-hci-c4  IP: 192.168.1.4
```

If you do more, you'd need `Invoke-WebRequest` type of requests only. (One good use case for me would be when I reinstall mNode and have to manually find and copy IDs from one Swagger output into another - that's really annoying!)

And every now and then get a new Bearer token because they expire. You could get a new one every time you run the script, or do some smart checking (I'd say that isn't necessary because it'd complicate the script and we won't have hundreds of HCC users pounding mNode for new tokens).

## Getting the rest of HCC dashboard information via the HCC API

I don't think that's possible.

I didn't try to confirm by looking at HCC container logs, but it looks like the HCC API is just to configure NetApp HCI or SolidFire cluster, and the rest is done by making calls to SolidFire MVIP or vCenter or BMC (for firmware upgrades).

If you want to get storage utilization details (capacity, performance, and so on), connect to the SolidFire API at MVIP address. SolidFire MVIP is unlikely to change during cluster lifetime and it's better to not query HCC for it (because your scripts will work even if mNode is down), but if you want to get it from HCC you can try these HCC APIs:

- `GET ​/assets`
- `GET /assets/{asset_id}/storage-clusters`

You may want to reuse some of PowerShell [scripts](https://github.com/scaleoutsean/awesome-solidfire/) from awesome-solidfire (see scripts directory) or Kevin's [repo](https://github.com/kpapreck/test-plan). For Python samples, check my HCI Collector.

As I've recommended elsewhere, create a read-only SolidFire cluster admin account for such read-only scripts (and remember that even that account can read account passwords).
