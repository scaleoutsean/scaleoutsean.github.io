# Connecting to SolidFire from PowerShell 7.5

How to connect when Connect-SFCluster does not work

## Error

I get this in PowerShell 7.5 on Linux (also on 7.4).

```raw
Connect-SFCluster: 
Could not load file or assembly 'System.Net.Http.WebRequest, Version=4.0.0.0, 
Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a'. The system cannot find the file specified.
```

It's probably due to System.Net.Http.WebRequest removed from the recent .NET packages (after being deprecated for a while before that).

## Fuhgeddaboudit  

Just forget about it. 

Python SDK still seems to work, but there I've preemptively eliminated it from recent use (example: [SFC](https://github.com/scaleoutsean/sfc/)). I don't use PowerShell much in programs, but I use it it scripts or from console. Well, now I can't. 

## Alternatives

- Create a docker container with older OS and .NET library. I have one on Github.
- Just fugheddaboutit and write your own functions

Something like this works or me (set sfApiAddress, sfAccountName, sfAccountPass).

```powershell
$sfApiEndpoint = 'https://' + $sfApiAddress + '/json-rpc/12.5/'
$headers = @{
    'Authorization' = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${sfAccountName}:${sfAccountPass}"))
    'Content-Type'  = 'application/json'
}
$sfConnection = @{
    'ApiEndpoint' = ${sfApiEndpoint}
    'Headers'     = ${headers}
}
try {
    $response = Invoke-RestMethod -Uri $sfApiEndpoint -Method Post -Headers $sfConnection.Headers -Body '{"method":"GetClusterInfo"}' -ErrorAction Stop
    Write-Host "Connected to SolidFire cluster $($response.result.clusterInfo.name) at ${sfApiAddress} successfully." -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to SolidFire cluster at ${sfApiAddress}: $_" -ForegroundColor Red
    return
}

```

Okay... So, this works. But I'm not done with the bad news.

The next problem is none of the other commands work either. Why? Because you need an SFConnection which hasn't been created.

"Full version" of a command: `Get-SFAccount -SFConnection $sfConnection`.

I tried creating a `SolidFire.Core.Objects.SFConnection` object, but I hit a

```sh
PS > Add-Type -AssemblyName 'SolidFire.Core.Objects' -ErrorAction SilentlyContinue
Add-Type: Cannot find path 'SolidFire.Core.Objects.dll' because it does not exist.
```

All right. Maybe I could find this DLL somewhere, add it to my environment or make a copy in current directly, but who knows what's the next problem? 

I'll just drop the SolidFire Tools for PowerShell and use native PowerShell cmdlets.

As we have the headers already, now we can reuse them.

```powershell
$response = Invoke-RestMethod -Uri $sfApiEndpoint -Method Post `
    -Headers $headers -Body '{"method":"GetAccountByID","params":{"accountID":4}}' `
    -ErrorAction Stop
```

Also, here's the stupidest hint of the week: if `$sfApiEndpoint` is a `string` such as https://cl.ust.er/json-rpc/12.5, that will work. If it's a real `Uri`, well... You're not supposed to use a proper `Uri` such as `$sfUri = 'https://cluster.solidfire.net'` and add `'/json-rpc/12.5'` to that. That won't work well for `-Uri`s because you'd end up with two forward slashes. You need to trim the invisible `/` from at the end of your Uri variable.

![One does not simply pass a URI variable to -Uri param](/assets/images/one-does-not-simply-pass-a-uri-var-to-uri-param.jpg)

## Conclusion

Lame.
