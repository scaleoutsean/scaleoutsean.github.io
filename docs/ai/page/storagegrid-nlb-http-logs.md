# Analyze HTTP logs from NetApp StorageGRID gateway nodes

What StorageGRID 11.8 Gateway Node HTTP log is, how to parse it and why ... not

- [Introduction](#introduction)
- [Log format](#log-format)
- [What needs to happen](#what-needs-to-happen)
- [Parsing with Grok](#parsing-with-grok)
- [Result](#result)
- [Caveats](#caveats)
- [Why you probably don't need this (but another team may)](#why-you-probably-dont-need-this-but-another-team-may)
  - [Legit requests](#legit-requests)
  - [Non-legit requests](#non-legit-requests)

## Introduction

> Gateway Nodes provide a dedicated load-balancing interface that S3 and Swift client applications can use to connect to StorageGRID. Load balancing maximizes speed and connection capacity by distributing the workload across multiple Storage Nodes. Gateway Nodes are optional.

([source](https://docs.netapp.com/us-en/storagegrid-118/primer/what-gateway-node-is.html))

Assuming you use these (most users do), you may want to monitor their logs. 

## Log format

This is a sample of StorageGRID 11.8 gateway's HTTP log.

```raw
[2024-03-07T22:51:00+00:00] 1.1.2.2 "GET /sg-cdp/?list-type=2&delimiter=%2F&max-keys=2&prefix=managed%2Fm1.db%2Ft1%2F&fetch-owner=false HTTP/1.1" 200 613 929 0.005 "fabd7761-91c7-4-be86-3f39f86facf3" "10.1.2.1:18082"
[2024-03-07T22:51:00+00:00] 10.1.2.3 "GET /sg-cdp/?list-type=2&delimiter=%2F&max-keys=5000&prefix=managed%2Fm1.db%2Ft1%2F&fetch-owner=false HTTP/1.1" 200 616 932 0.009 "fabd7761-914664-be86-3f39f86facf3" "10.1.2.1:18082"
[2024-03-07T22:51:00+00:00] 172.16.0.1 "HEAD /sg-cdp/managed/m1.db/t1/base_0000001/_metadata_acid HTTP/1.1" 404 213 869 0.003 "fabd7761-91c7-4664-be86-3f39f86facf3" "10.1.2.1:18082"
[2024-03-07T22:51:00+00:00] 2001:0db8:85a3:0000:0000:8a2e:0370:7334 "GET /sg-cdp/?list-type=2&delimiter=%2F&max-keys=2&prefix=managed%2Fm1.db%2Ft1%2Fbase_0000001%2F_metadata_acid%2F&fetch-owner=false HTTP/1.1" 2561 961 0.013 "fabd7761-91c7-4664-be86-3f39f86facf3" "10.1.2.1:18082"
[2024-03-07T22:51:00+00:00] lab.dr.evil.org "HEAD /sg-cdp/managed/m1.db/t1/base_0000001/_metadata_acid HTTP/1.1" 404 213 869 0.004 "fabd7761-91c7-4664-be86-3f39f86facf3" "sc.un.org:18080"
```

## What needs to happen

As of StorageGRID 11.8, those logs can't be [forwarded](/2023/07/20/storagegrid-and-elaticsearches.html) in the same fashion as audit logs, for example. It may become possible in the future, but it's not as of 11.8.

So, if you need this you can wait, or you can do something on your own today.

The first challenge is to get them logs out somehow. Example:

- SSH script to get into gateway node
- Find unique non-current HTTP logs (e.g. http.log.1 or http.log.tgz or whatever it is)
- Run this periodically (say every 5 min) to not lose a log in due to rotation. It should take hours (I hope) to rotate a log out of existence
- rsync new compressed log file out to a place where they can be parsed and ingested

That's not great, but can work.

If the logs get 80% compressed, getting them out like this shouldn't be a huge problem.

## Parsing with Grok

I've no clue what the two integer values mean. The first of the three is likely the response code (200, 404, etc.). The other two I don't know. Probably request size or some such. But that doesn't matter much - you probably need to get it in and can check with Support what they represent.

Secondly, I've no idea what the log hex string is. Could be a session ID. Anyway, store it first, ask questions later.

```raw
\[%{TIMESTAMP_ISO8601:timestamp}\]%{SPACE}(%{IPV4:src}|%{IPV6:src}|%{HOSTNAME:src})%{SPACE}\"%{WORD:verb}%{SPACE}%{GREEDYDATA:request}\"%{SPACE}%{INT:resp}%{SPACE}%{INT:val2}%{SPACE}%{INT:val3}%{SPACE}%{BASE16FLOAT:timetaken}%{SPACE}\"%{GREEDYDATA:sess}\"%{SPACE}\"(%{IPV4:dst}|%{IPV6:dst}|%{HOSTNAME:dst})\:%{INT:dstport}\"
```

## Result

That should result in your nicely structured log in Elasticsearch or other place:

```json
[
  {
    "timestamp": "2024-03-07T22:51:00+00:00",
    "src": "1.1.2.2",
    "verb": "GET",
    "request": "/sg-cdp/?list-type=2&delimiter=%2F&max-keys=2&prefix=managed%2Fm1.db%2Ft1%2F&fetch-owner=false HTTP/1.1",
    "resp": 200,
    "val2": 613,
    "val3": 929,
    "timetaken": 0.005,
    "sess": "fabd7761-91c7-4-be86-3f39f86facf3",
    "dst": "10.1.2.1",
    "dstport": 18082
  },
  {
    "timestamp": "2024-03-07T22:51:00+00:00",
    "src": "10.1.2.3",
    "verb": "GET",
    "request": "/sg-cdp/?list-type=2&delimiter=%2F&max-keys=5000&prefix=managed%2Fm1.db%2Ft1%2F&fetch-owner=false HTTP/1.1",
    "resp": 200,
    "val2": 616,
    "val3": 932,
    "timetaken": 0.009,
    "sess": "fabd7761-914664-be86-3f39f86facf3",
    "dst": "10.1.2.1",
    "dstport": 18082
  },
  {
    "timestamp": "2024-03-07T22:51:00+00:00",
    "src": "172.16.0.1",
    "verb": "HEAD",
    "request": "/sg-cdp/managed/m1.db/t1/base_0000001/_metadata_acid HTTP/1.1",
    "resp": 404,
    "val2": 213,
    "val3": 869,
    "timetaken": 0.003,
    "sess": "fabd7761-91c7-4664-be86-3f39f86facf3",
    "dst": "10.1.2.1",
    "dstport": 18082
  },
  {
    "timestamp": "2024-03-07T22:51:00+00:00",
    "src": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    "verb": "GET",
    "request": "/sg-cdp/?list-type=2&delimiter=%2F&max-keys=2&prefix=managed%2Fm1.db%2Ft1%2Fbase_0000001%2F_metadata_acid%2F&fetch-owner=false HTTP/1.1",
    "resp": 2561,
    "val2": 96,
    "val3": 1,
    "timetaken": 0.013,
    "sess": "fabd7761-91c7-4664-be86-3f39f86facf3",
    "dst": "10.1.2.1",
    "dstport": 18082
  },
  {
    "timestamp": "2024-03-07T22:51:00+00:00",
    "src": "lab.dr.evil.org",
    "verb": "HEAD",
    "request": "/sg-cdp/managed/m1.db/t1/base_0000001/_metadata_acid HTTP/1.1",
    "resp": 404,
    "val2": 213,
    "val3": 869,
    "timetaken": 0.004,
    "sess": "fabd7761-91c7-4664-be86-3f39f86facf3",
    "dst": "sc.un.org",
    "dstport": 18080
  }
]
```

## Caveats

The above is for S3.

Swift? I don't know if the requests are the same (they should be) but don't care either. If you were to parse URLs to detail, then it may differ slightly, but we don't do that so it's probably the same.

QA your parsing rules before relying on them for security in production environments.

## Why you probably don't need this (but another team may)

### Legit requests

Legit HTTP requests are passed through and appear in StorageGRID audit log. So, storing the same info in HTTP logs is completely redundant.

### Non-legit requests

Non-legit HTTP requests don't even reach StorageGRID storage nodes, so why collect HTTP logs in the first place? 

The answer may very well be "the security wants them". Well, if they want them, let them pick buckets or network source IP ranges which they care about (DMZ, etc.), redirect traffic to their firewalls, terminate TLS there (F5 or whatever they can put in front of StorageGRID gateway nodes) and analyze threats on their own. 

It's really not an S3 thing, it's just HTTP(S). So if they want to parse them, they can forward those logs and use the same Grok pattern to parse them.

For internal StorageGRID access you probably shouldn't need to worry about HTTP requests to StorageGRID load balancers - remember that Gateway Node can control access, and the same can be done in ACLs (allow only certain IPs or ranges).
