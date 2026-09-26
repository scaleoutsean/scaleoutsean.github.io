# E-Series SANtricity API with JWT aka Bearer Tokens

How to use JWTs to access SANtricity API without username and password

- [Introduction](#introduction)
- [API](#api)
  - [Check TLS](#check-tls)
  - [Traditional login](#traditional-login)
  - [JWTs](#jwts)
  - [Use SANtricity Bearer Token](#use-santricity-bearer-token)
- [Demo](#demo)
- [References](#references)
- [Conclusion](#conclusion)

## Introduction

SANtricity 11.74 supports [JWT](https://docs.netapp.com/us-en/e-series-santricity/sm-settings/access-management-tokens.html#saml-and-json-web-token-access)s aka bearer tokens. These let us access the API without authentication. Why?

- You can monitor E-Series performance via the API using a read-only SANtricity account without having its current password
- You can get a short-living (3600s, for example) JWT to perform maintenance without the administrator having to remember to change password later

First you need to enable them and then you can use them. 

There are several ways to do it, for example:

- SANtricity Web UI
- SANtricity API

At the bottom there's a demo of how that looks like in the Web UI and links to Technical Reports (TR's) which have more details related to security and API than the documentation.

## API

One key point is before users can generate them, you need to enable them. I set mine to 366 days with the following in mind:

- Passwords are rotated every 7 days and no bearer token is used by administrators
- Bearer tokens are used by the account "monitor" to run E-Series Performance Analyzer script (collector.py); see [the recent post](/2022/10/26/eseries-performance-analyzer-e-series.html) for more.

If you pick the API approach and are not an admin, you should first check if they're at all enabled (default is `False`). 

![Enable JWTs](/assets/images/santricity-jwt-01.png)

This check can be performed from the UI or from the API using "classic" account login to check if JWTs have been enabled and how long they can last.

As SANtricity admin, I enabled them and set maximum duration to 366 days.

Once they've been enabled, users can create them for own accounts.

Duration must be longer than 0 seconds and equal or less than the maximum set by admin (366 * 86400).

![Create JWT](/assets/images/santricity-jwt-02.png)

What follows are related API details and comments.

### Check TLS

Before you connect you may want to check the API endpoint's TLS settings: 

- `GET ​/settings​/tls-params` -  Retrieve the TLS parameters that are currently available for inbound and outbound connections. The parameters returned are only for the web server that received the request. For embedded, a request will need to be sent to each controller.

Do something like:

```sh
curl -X GET \
  "https://1.2.3.4:8443/devmgr/v2/settings/tls-params" \
  -H "Accept: application/json"`

```

Starting with this update (11.74) SANtricity supports TLS 1.3: 

```json
{
  "protocols": [
    "TLSv1.3",
    "TLSv1.2"
  ],
  "ciphers": [
    "TLS_AES_256_GCM_SHA384",
    "TLS_AES_128_GCM_SHA256",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
    "TLS_DHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
    "TLS_DHE_RSA_WITH_AES_128_GCM_SHA256"
  ]
}

```

You may want to check other TLS settings and/or upload proper (valid) TLS certificates.

### Traditional login

- `POST ​/login` - Perform a manual login

Request:

```json
{
  "userId": "monitor",
  "password": "monitor123",
  "xsrfProtected": True
}

```

Python:

```python
login = 'https://1.2.3.4:8443/devmgr/utils/login'
username = 'monitor'
password = 'monitor123'
headers = {'Accept': 'application/json' , 'Content-Type': 'application/json'}
resp = requests.request("POST", login, headers=headers, json={'userId': username, 'password': password}, verify=False)

```

**NOTE**: pay attention to login URL, it's different from the rest...

With this you can check if JWTs are available.

### JWTs

- `POST /access-token` - Generates an access token for a logged in user

Request a bearer token with 1 day validity:

```sh
curl -X POST https://1.2.3.4:8443/devmgr/v2/access-token \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{ \"duration\": 86400}"

```

Again, notice the URL is different.

Response:

```json 
{
  "accessToken": "eyJhbGciOiJSUzI1NiJ9...snip...QiFYw",
  "duration": 86400
}

```

With this we no longer need username and password.

### Use SANtricity Bearer Token

We can try this from the SANtricity Swagger or CLI (if authenticated):

- `GET /storage-systems` - Get list of storage-systems

Request:

```sh
curl -X GET "https://1.2.3.4:8443/devmgr/v2/storage-systems" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authentication: Bearer eyJhbGciOiJS...77FQ"
```

Response:

```json
[
  {
    "id": "1",
    "name": "abcd",
    "wwn": "600A098000F13715000000005E79C17D",
    "passwordStatus": "valid",
    "passwordSet": true,
    "status": "optimal",
    ....
   }
 ]

```

The above was done in the SANtricity Swagger interface so there's no bearer token, but you can [search the Web](https://stackoverflow.com/a/50363110) on how to use Bearer Token with curl from Python, if you want to make these requests work with JWT and don't want to use requests.

From that response we get system-id for the next step.

- `GET /storage-systems​/{system-id}​/analysed-drive-statistics` - Get all analysed disk statistics

Request drive statistics from system-id (e.g. 21000000600A098000F63714000021115E79C17C obtained with `GET /storage-systems`):

```sh
curl -X GET \
  "https://1.2.3.4:8443/devmgr/v2/storage-systems/21000000600A098000F63714000021115E79C17C/analysed-drive-statistics" \
  -H  "Accept: application/json" \
  -H  "Content-Type: application/json" \
  -H  "Authentication: Bearer eyJhbGciOiJS...77FQ"

```

The response was too long so I'll omit it here. That's how E-Series Performance Analyzer would get all the info it needs with JWT.

We can try these requests using that Bearer Token that we got earlier. Let's try the first `curl` example, `GET /storage-systems`:

```python
import requests
url = 'https://1.2.3.4:8443/devmgr/v2/storage-systems'
headers = {'Accept': 'application/json', 
           'Content-Type': 'application/json',
           'Authorization': 'Bearer eyJhbGciOiJS...77FQ'}
response = requests.request("GET", url, headers=headers, verify=False)

```

Assuming the admin allowed the maximum JWT age of 366 days and we get a token with maximum duration today, this should work for one year regardless of password rotation.

## Demo

The demo is short and basically just shows how to enable JWTs in the SANtricity Web UI. There are no additional, technical details not contained in this post.

- [NetApp E-Series SANtricity API with JWT](https://rumble.com/v1shywk-netapp-e-series-santricity-api-with-jwt-bearer-tokens.html) - 1m55s

## References

- [NetApp TR-4736: SANtricity Web Services API](https://www.netapp.com/media/17142-tr4736.pdf)
- [NetApp TR-4712: NetApp SANtricity management security](https://www.netapp.com/media/17079-tr4712.pdf)
- [NetApp TR-4855: Security hardening guide for NetApp SANtricity](https://www.netapp.com/media/19422-tr-4855.pdf)

## Conclusion

Beginning with SANtricity 11.74, JWTs let E-Series users avoid the hassle of dealing with password rotation. 

Of course, the feature should be used with care. E-Series built-in monitor account is a good candidate for JWTs because it has read-only access to selected APIs.

In addition to this feature, I also noticed a beta version of API Proxy. I haven't checked it because it may still change, but it seems to allow proxying of API calls to other controllers. Maybe that would allow us to bypass SANtricity Web Services Proxy and just use on-controller API endpoints. If you're interested in this, feel free to examine this API feature.
