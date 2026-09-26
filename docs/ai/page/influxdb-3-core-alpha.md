# InfluxDB 3 Core Alpha available for testing

InfluxDB 3 Core is out for early testing

- [Introduction](#introduction)
- [What's backwards compatible and what's not in InfluxDB 3](#whats-backwards-compatible-and-whats-not-in-influxdb-3)
- [Evaluate with E-Series Performance Analyzer](#evaluate-with-e-series-performance-analyzer)
- [Other details](#other-details)
- [Conclusion](#conclusion)
- [Appendix A - Example](#appendix-a---example)
- [Appendix B: admin token reset](#appendix-b-admin-token-reset)
- [Update (2025/04)](#update-202504)
- [Update (2025/06)](#update-202506)

## Introduction

When I forked E-Series Performance Analyzer (EPA), I didn't want to waste time on InfluxDB 2 because that would also require a rework of front-end (Grafana dashboards) and I had a strong dislike for FluxQL.

Then when I rewrote SolidFire Collector (SFC) [I noted I'd pick InfluxDB v1 so that SFC and EPA use the same back-end DB](/2024/05/03/netapp-solidfire-collector-next.html).

The idea behind it all was that **when** InfluxDB 3 comes out - considering the intent to retain compatibility with version 1 - it shouldn't be hard to upgrade and it'd be possible to completely avoid Flux. 

That day [has come](https://www.influxdata.com/blog/influxdb3-open-source-public-alpha/).

## What's backwards compatible and what's not in InfluxDB 3 

What's compatible:

> Support for InfluxDB 1.x and 2.x write APIs

> InfluxDB Line Protocol support

> InfluxQL query support (and the v1 query API)

What won't work is the addition of new tag columns after a table is created.  

I don't remember if EPA or SFC add new tag columns, but we'll find out as we go.

## Evaluate with E-Series Performance Analyzer

Currently, InfluxDB 3 Core alpha version may be downloaded and installed to Docker or natively on OS. Choosing the latter is easier if we want to inspect data and just avoid hassle until we know more about it.

```sh
curl -O https://www.influxdata.com/d/install_influxdb3.sh && sh install_influxdb3.sh
```

Get your admin token. In version 3.0 and 3.1 you can't recover it. Use the right protocol, IP and port.

```sh
influxdb3 create token --admin --host https://s169:8181
```

You may add the token to shell variable `export INFLUXDB3_AUTH_TOKEN=` on the DB host to avoid having to provide it every time.

Create a database:

```sh
$ influxdb3 create database epa
Database "epa" created successfully

$ influxdb3 show databases
+---------------+
| iox::database |
+---------------+
| epa           |
+---------------+

$ export INFLUXDB3_DATABASE_NAME="epa"
```

Now we're set to use the new DB and can write to `epa`.

```sh
$ influxdb3 write -h
Perform a set of writes to a running InfluxDB 3 Core server

Usage: influxdb3 write [OPTIONS] --database <DATABASE_NAME> --file <FILE_PATH>

Options:
  -H, --host <HOST_URL>           The host URL of the running InfluxDB 3 Core server [env: INFLUXDB3_HOST_URL=] [default: http://127.0.0.1:8181]
  -d, --database <DATABASE_NAME>  The name of the database to operate on [env: INFLUXDB3_DATABASE_NAME=]
      --token <AUTH_TOKEN>        The token for authentication with the InfluxDB 3 Core server [env: INFLUXDB3_AUTH_TOKEN=]
  -f, --file <FILE_PATH>          File path to load the write data from
      --accept-partial            Flag to request the server accept partial writes
  -h, --help                      Print help information
```

At this point I'm stuck because I don't have any sample EPA or SFC data that I could send!

I'd have to get access to E-Series or SolidFire to give EPA or SFC a try. I'll update this post if/when I manage to get that done. (Done - see Appendix.)

We need to test (and maybe modify) just two things:

- if EPA and SFC add tags after database has been created and if yes, modify the code to avoid that
- if the Grafana dashboards from EPA have to be modified (probably not, since InfluxQL is mentioned as supported). SFC v2 does not have Grafana dashboards, but I do have all the [InfluxQL queries](https://github.com/scaleoutsean/sfc/blob/master/docs/dashboards.md) documented, so we can go down that list and try if all queries work as they work with InfluxDB 1.

## Other details

I haven't written much about the great new features in InfluxDB 3 since for EPA and SFC users moving to version 3 is not a question of better features but of security requirements.

InfluxDB 3 Core looks very promising, though, I've been keeping an eye on it for well over a year and tried using even their public pre-alpha builds.

You may read the official announcement and details [here](https://www.influxdata.com/blog/influxdb3-open-source-public-alpha/).

Since I'm already on this topic, I can't resist:

- version 3 will be able to store data on S3 in the fashion similar to other modern time series databases
- SolidFire Collector, specifically, does not implement any sort of data pruning (why, that's explained in SFC-related posts), but works around that with smarter (and selective) data collection compared to EPA. But S3 completely solves that now, and you can retain like a maniac
- E-Series Performance Analyzer could also collect more data if data management was easier. With InfluxDB 3 and S3 tiering, it is, so maybe users with thousands of disks (HPC, etc.) would collect more detailed metrics and use them for predictive analytics

*If* I get to updating SFC or EPA, I may include a MinIO container so that S3 is included by default and users can start with S3 right away and switch to other S3 if they want. That way SolidFire (i.e. SFC) users will have the option to not hoard metrics data on SolidFire volumes as long as they redirect InfluxDB data store to another S3 rather than MinIO on SolidFire block devices. Built-in S3 back-end in EPA should be valuable to E-Series users with all-flash storage as well.

## Conclusion

The decisions to skip version 2 and (for SFC) migrate to InfluxDB 1 were very good.

SFC doesn't even use any any Python libraries for InfluxDB 1 - all documents are composed "by hand" before being sent to InfluxDB. That was done on purpose so that I don't have another outdated dependency (in Python library for InfluxDB 1).

Now we can reap rewards by skipping InfluxDB 2 and Flux (yaeah!) while most others are stuck on v2 and have to rewrite queries and re-create dashboards (notice there's *no query support for Flux* in InfluxDB 3)!. (You can [read about Flux vs InfluxQL here](https://docs.influxdata.com/influxdb/cloud/reference/syntax/flux/flux-vs-influxql/)).

EPA and SFC users may be able to switch to InfluxDB 3 early because EPA and SFC are almost trivial workloads and backward compatibility has been preserved. InfluxDB 3 could be ready for casual production with EPA or SFC in just 2-3 months. 

## Appendix A - Example

So, I didn't get access to anything, but I did find some old JSON files from E-Series API, and then I used the EPA collector code to remind myself what the heck I'm supposed to do...

First - continuing from `show databases` above - you can export main key variables to save typing time. Note the API token is the other API token, not the first one that InfluxDB spits out when started.

```sh
export INFLUXDB3_DATABASE_NAME='epa'
export INFLUXDB3_HOST_URL=http://127.0.0.1:8181
export INFLUXDB3_AUTH_TOKEN=apiv3_OvwR_DVe6P_j-pH8azw6PzTxpn5aYsLK8J4_cKammUrjO4ENGzAEAsBRdJnewMs-mN4RdL7k9A2ap9jSQXmGzQ
# landmine alert - you may use http as per above (that's the "default"), but I set https for myself

```

Then there are problems, such as, the "simple" getting started guide quickly gets you in trouble, because InfluxDB 3 defaults to http (as you can see from the link above), but its new Python library does not. 

To work around that you'd have to restart InfluxDB with them "advanced options". And there's dozens of them. 

```sh
$ influxdb3 serve -h | wc -l
64
```

64 lines? Hard pass! 

Next, since their [Python thing](https://github.com/InfluxCommunity/influxdb3-python) can't work with HTTP, I had to use a two-step workaround:
- Convert data to InfluxDB [line protocol](https://docs.influxdata.com/influxdb3/core/reference/syntax/line-protocol/)
- Post that stuff to InfluxDB HTTP endpoint (using `curl -X POST` or equivalent)

That is *exactly* how I do it in SFC, so no change for me!

Let's see an example with that E-Series API response. You can see a power consumption response for the EF-Series EF570 model here.

```json
{
  "returnCode": "ok",
  "energyStarData": {
    "totalPower": 412,
    "numberOfTrays": 1,
    "trayPower": [
      {
        "trayID": 0,
        "numberOfPowerSupplies": 2,
        "inputPower": [
          203,
          209
        ]
      }
    ]
  }
}
```

As an aside, I've never implemented parsing for multiple trays (which EF570 I used didn't have) because I'm not sure if trayIDs beyond 0 have the same output format. So I'm still curious about it. For that reason, I spiced this up a bit by imagining how response for multiple trays might look like:

```json
{
  "returnCode": "ok",
  "energyStarData": {
    "totalPower": 1112,
    "numberOfTrays": 1,
    "trayPower": [
      {
        "trayID": 0,
        "numberOfPowerSupplies": 2,
        "inputPower": [
          203,
          209
        ]
      },
     {
        "trayID": 1,
        "numberOfPowerSupplies": 2,
        "inputPower": [
          175,
          175
        ]
      },
     {
        "trayID": 1,
        "numberOfPowerSupplies": 2,
        "inputPower": [
          180,
          170
        ]
      }      
    ]
  }
}
```

This could very well be "fake news", but let's say that's how a hybrid EF300 with two 60-drive enclosures might respond.

Notice that (emulated) `energyStarData.totalPower` is now 1112, not the same as trayID 0. Currently in EPA I don't separately report `trayID.inputPower` because with 1 tray that's always the same as totalPower. But for this imaginary response, that's a sum of all trays' power supplies.

All rightie! Now we put this in **one line** using InfluxDB's line protocol. Data values start with tray_id_0_power which is prefixed by the space character.

Here I've inserted extra line breaks for easier viewing:

```sh
power,sys_id=array_blah,sys_name=wwn_something 
    tray_id_0_power=412,
    tray_id_1_power=350,
    tray_id_2_power=350,
    total_system_power=1112

```

With that:

- I can save that to a temp file (server_data.txt) and send it using `influxdb3 write`, or
- I can use `curl` or Python requests to send it on-the-fly

InfluxDB 3 binary (which is a server/client all-in-one) can write from file, so that would look like this (--database is optional since I have it in ENV):

```sh
$ influxdb3 write --database=epa --file=server_data.txt
success
```

You may need extra options if the stuff's missing from environment variables, etc. This also works

```sh
$ echo 'power,sys_id=array_blah,sys_name=wwn_something tray_id_0_power=412,tray_id_1_power=350,tray_id_2_power=350,total_system_power=1112' \
> server_data.txt 

$ cat server_data.txt | influxdb3 write --database 'epa'
success
```

```sh
$ influxdb3 query --database=epa "SELECT * FROM power"
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+
| sys_id     | sys_name      | time                          | total_system_power | tray_id_0_power | tray_id_1_power | tray_id_2_power |
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+
| array_blah | wwn_something | 2025-01-24T17:41:02.042586723 | 1112.0             | 412.0           | 350.0           | 350.0           |
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+

```

We can do that ourselves with `curl` or Python `requests` and it's the same way it's done in SFC (EPA uses Python Influx v1 library, that's how it was when I forked it).

From TFM:

> InfluxDB 3 Core provides the /write and /api/v2/write endpoints for backward compatibility with clients that can write data to previous versions of InfluxDB. 

Again, be careful about your authorization header and HTTP vs HTTPS. And we're writing to the DB called `epa` (in the URL).

```sh
$ curl -vk -X POST \
  -data-raw "power,sys_id=array_blah,sys_name=wwn_something tray_id_0_power=390,tray_id_1_power=300,tray_id_2_power=300,total_system_power=990" \
  --Header "Authorization: Bearer apiv3_OvwR_DVe6P_j-pH8azw6PzTxpn5aYsLK8J4_cKammUrjO4ENGzAEAsBRdJnewMs-mN4RdL7k9A2ap9jSQXmGzQ" \
  "https://localhost:8181/api/v3/write_lp?db=epa&precision=auto&accept_partial=false"

```

If you consolidate databases in one InfluxDB server, please read the InfluxDB docs and modify the code that affects DB instantiation (or remove it and handle instantiation, user and token management externally).

The second point is notice that I used `precision=auto`, because `influx3db` used `auto` as well. But EPA uses second-level precision - there's nothing to gain from timestamping like this is a space-ship.

After that, we see two records in the table named "power":

```sh
$ influxdb3 query --database=epa "SELECT * FROM power"
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+
| sys_id     | sys_name      | time                          | total_system_power | tray_id_0_power | tray_id_1_power | tray_id_2_power |
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+
| array_blah | wwn_something | 2025-01-24T18:11:04.150552050 | 990.0              | 390.0           | 300.0           | 300.0           |
| array_blah | wwn_something | 2025-01-24T17:41:02.042586723 | 1112.0             | 412.0           | 350.0           | 350.0           |
+------------+---------------+-------------------------------+--------------------+-----------------+-----------------+-----------------+

```

My conclusion is InfluxDB 3 Core meets my technical expectations (which is, I don't have to do almost anything to use it, coming from InfluxDB v1). 

Stil, the two code bases need changes:

- EPA:
  - Database initialization section where DB is created
  - All inserts may need adjustments (if there are tags and variables with identical keys, for example)
  - The included Grafana dashboards may need small documentation changes
  - Docker Compose and other templates need updating
- SFC:
  - Same as EPA. While there are no Grafana dashboards, there are detailed query examples as mentioned above
- Extra MinIO container and basic documentation for convenient tiering to S3 from Day 1

## Appendix B: admin token reset

It's stupid, but as of 3.1 there's still no way to do that (issue [here](https://github.com/influxdata/influxdb/issues/26330)).

As per the above, my node ID is writer0, data is in the below folder, etc. To nuke it, I stop server and then:

```sh
rm -rf /home/sean/.influxdb/data/writer0/*
```

Then I restart InfluxDB and - because I'm using TLS - I have to remember to specify `--host` either here or in environment variables.

```sh
influxdb3 create token  --admin --host https://s146:8181 
```

Now I just save the token in `.bashrc` and `export INFLUXDB3_AUTH_TOKEN=$AUTH_TOKEN`, so that I don't have to deal with this nonsense again.

## Update (2025/04)

InfluxDB 3 Core has been released and now we can start looking into modifying E-Series Performance Analyzer and SolidFire Collector for it...

In line with SFC's approach to security, I think TLS by default should be the only option. InfluxDB 3.0 Core added certificate related arguments, so we can try that out.

Here's how I start InfluxDB 3.0 with a valid, CA-issued certificate (the CA certificate is in OS truststore and this is not a dockerized instance).

```sh
/home/sean/.influxdb/influxdb3 serve 
  --node-id='writer0' \
  --http-bind='s146:8181' \
  --object-store file --data-dir /home/sean/.influxdb/data \
  --tls-cert /home/sean/.influxdb/certs/server.crt --tls-key /home/sean/.influxdb/certs/server.key

```

(In EPA and SFC I would use S3 and not file-system to store InfluxDB data.)

I didn't disable authorization, so I need a bearer token and then I can access the server securely without any issues ("SSL certificate verify ok.`"). 

It's a bit silly that there's just one port (same as in previous versions) so when one accesses service at 8181, it's anyone's guess what the protocol may be (HTTP or HTTPS). I've submitted an [enhancement request](https://github.com/influxdata/influxdb/issues/26263) about that, although I doubt it will be accepted. Anyway, let's move on...

```raw
$ curl  -v https://s146:8181/health \
  --Header "Authorization: Bearer apiv3_OvwR_DVe6P_j-pH8azw6PzTxpn5aYsLK8J4_cKammUrjO4ENGzAEAsBRdJnewMs-mN4RdL7k9A2ap9jSQXmGzQ"

* Host s146:8181 was resolved.
* IPv6: (none)
* IPv4: 192.168.1.146
*   Trying 192.168.1.146:8181...
* Connected to s146 (192.168.1.146) port 8181
* ALPN: curl offers h2,http/1.1
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
*  CAfile: /etc/ssl/certs/ca-certificates.crt
*  CApath: /etc/ssl/certs
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
* TLSv1.3 (IN), TLS handshake, Certificate (11):
* TLSv1.3 (IN), TLS handshake, CERT verify (15):
* TLSv1.3 (IN), TLS handshake, Finished (20):
* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
* TLSv1.3 (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=s146.datafabric.lan
*  start date: Apr 14 09:39:56 2025 GMT
*  expire date: Jul 13 09:40:56 2025 GMT
*  subjectAltName: host "s146" matched cert's "s146"
*  issuer: O=DataFabric; CN=DataFabric Intermediate CA
*  SSL certificate verify ok.
*   Certificate level 0: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA256
*   Certificate level 1: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA256
*   Certificate level 2: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA256
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
* old SSL session ID is stale, removing
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
* old SSL session ID is stale, removing
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
* old SSL session ID is stale, removing
* using HTTP/2
* [HTTP/2] [1] OPENED stream for https://s146:8181/health
* [HTTP/2] [1] [:method: GET]
* [HTTP/2] [1] [:scheme: https]
* [HTTP/2] [1] [:authority: s146:8181]
* [HTTP/2] [1] [:path: /health]
* [HTTP/2] [1] [user-agent: curl/8.5.0]
* [HTTP/2] [1] [accept: */*]
* [HTTP/2] [1] [authorization: Bearer apiv3_OvwR_DVe6P_j-pH8azw6PzTxpn5aYsLK8J4_cKammUrjO4ENGzAEAsBRdJnewMs-mN4RdL7k9A2ap9jSQXmGzQ]
> GET /health HTTP/2
> Host: s146:8181
> User-Agent: curl/8.5.0
> Accept: */*
> Authorization: Bearer apiv3_OvwR_DVe6P_j-pH8azw6PzTxpn5aYsLK8J4_cKammUrjO4ENGzAEAsBRdJnewMs-mN4RdL7k9A2ap9jSQXmGzQ
> 
< HTTP/2 401 
< date: Wed, 16 Apr 2025 04:10:44 GMT
< 
* Connection #0 to host s146 left intact
```

All good, TLS 1.3 is working and we don't have to "cheat" with `-k`!

Or, a mix of CLI and curl commands to query an empty `epa` DB on `https://s146`.

```sh
$ /home/sean/.influxdb/influxdb3 create token --admin --host "https://s146:8181"

# Token: apiv3_1nSeJAtDL2Z2E7vYdIQhHckmPFIHvtWABaulZMvTVwQNuiNe8JA3Hcr-3aAVp0kndWzenDzGaWWCoOVVw52qsw

$ /home/sean/.influxdb/influxdb3 create database epa \
  --token apiv3_1nSeJAtDL2Z2E7vYdIQhHckmPFIHvtWABaulZMvTVwQNuiNe8JA3Hcr-3aAVp0kndWzenDzGaWWCoOVVw52qsw \
  -H https://s146:8181/query

# Database "epa" created successfully

$ curl https://s146:8181/query \
  --Header "Authorization: Bearer apiv3_1nSeJAtDL2Z2E7vYdIQhHckmPFIHvtWABaulZMvTVwQNuiNe8JA3Hcr-3aAVp0kndWzenDzGaWWCoOVVw52qsw" \
  --data-urlencode "db=epa" --data-urlencode "q=SELECT * FROM epa"

# {"results":[{"statement_id":0}]}
```

Now in order to get EPA and SFC to use InfluxDB 3 OSS, it just needs to be put together and packaged!
s
Which I may or may not (since I've never heard that anyone uses these things) do. But the source code is available and we know it won't be hard.

## Update (2025/06)

This will probably get fixed as support for InfluxDB 3 Core is in alpha, but I couldn't set up Grafana with a TLS-enabled InfluxDB (I had to restart InfluxDB without TLS configuration and use HTTP from Grafana). 

The good thing is the rest (InfluxQL from v1) worked, which is important for EPA dashboards (no need to edit them, I hope).

**Note** that InfluxDB 3.1 has been released on June 11, 2025, and addresses several pain points highlighted above, including admin-only token. Now there are operator tokens and per-database tokens as well. More [here](https://www.influxdata.com/blog/inside-influxdb-3.1/). Version 3.2, scheduled for late June, should add retention features, which would eliminate the last issue with InfluxDB 1 OSS where retention queries are possible but complicated so I chose not to use them in SFC 2.0.
