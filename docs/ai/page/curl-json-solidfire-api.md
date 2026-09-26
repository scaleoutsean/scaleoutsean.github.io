# curl with native JSON support and SolidFire API

Using JSON-capable curl and the SolidFire API

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

Until now, using curl with JSON was somewhat complicated. 

```sh
--data [arg]
--header "Content-Type: application/json"
--header "Accept: application/json"
```

Because I don't use it every day, every time I want to compose a JSON-capable curl command, I had to look up this syntax.

The other problem is that with complex JSON - almost every time non-trivial params are involved, in fact - I'd just load that crap from a file rather than try to type it in shell.

When I have to use curl with JSON more than once per day, which isn't too often, then it's a bit easier.

```sh
curl -k -H "Content-Type: application/json" \
  -d '{ "method": "ListVolumes", "params": { "volumeName": "esdata01" }}' \
  https://admin:admin@192.168.1.34:443/json-rpc/12.0
```

[Now](https://daniel.haxx.se/blog/2022/02/02/curl-dash-dash-json/) that's becoming very easy. Get a recent daily build and give it a try:

```sh
$ sudo apt-get install -y jo jq

$ params=`jo volumeName=esdata01`

$ jo method=ListVolumes params=${params} | \
  curl -s -k --json @- https://admin:admin@192.168.1.34/json-rpc/12.0 | \
  jq '.result.volumes[] | { volumeID: .volumeID, volumeName: .name}'
```

Assuming you have just one volume named `esdata01`, you'll see something like this:

```json
{
  "volumeID": 166,
  "volumeName": "esdata01"
}
```

To get all volumes, simply don't specify volumeName:

```sh
jo method=ListVolumes | \
  curl -s -k --json @- https://admin:admin@192.168.1.34/json-rpc/12.0 | \
  jq '.result.volumes[] | { volumeID: .volumeID, volumeName: .name}'
```

Of course, a less complicated approach works as well.

```sh
$ json='{ "method": "ListVolumes", "params": { "volumeName": "esdata01" }}'
$ curl --json ${json} -k https://admin:admin@192.168.1.34/json-rpc/12.0 
```

For simple maintenance or setup operations that involve 2-3 calls to the API we can compose three-four JSON files on the fly and loop through them without creating a script that's hard to read for people not used to working with curl.

I prefer to not use curl when I can use PowerShell or Python (or Postman), but it is often the only practical way to use the API in secure environments.
