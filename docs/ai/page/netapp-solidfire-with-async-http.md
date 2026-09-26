# Access NetApp SolidFire API with Async IO

Using asynchronous IO with NetApp SolidFire API endpoint

## Introduction

When using Python with SolidFire I usually use SolidFire Python SDK which in turn uses requests and [urllib3](https://github.com/solidfire/solidfire-sdk-python/blob/49fe23e2e9383dcd75723d680ffd18a475dccea5/solidfire/common/__init__.py).

One opportunity for performance enhancement with scripts that issue a lot of Get and List API requests is asynchronous access to the SolidFire API.

Opportunities should be evaluated in the context of use case and application behavior. Get and List requests in monitoring applications are usually async-safe and the same should apply to long-running jobs which are asynchronous on SolidFire as well (e.g. cloning or backup-to-S3). 

Python's `asyncio` provides ways to safely use other methods, but that requires more effort and skill. In this post I only want to evaluate its viability in simple & low risk use cases.

(Async IO isn't limited to Python clients - it's just that I will use Python in this particular post.)

## Simple example

Here's a simple example, a loop that makes 100 calls to GetSnmpInfo method over HTTPS (using valid TLS certificate, so there's no time spent on warnings or errors). 

That test doesn't create much load on the system, it's a very simple API request.

Using SolidFire Python SDK, create a loop that does this 100 times:

```python
>>> sfe.get_snmp_info()
2024-05-04 00:48:08,574 - solidfire.Element - INFO - {"method": "GetSnmpInfo", "id": 60, "params": {}}
GetSnmpInfoResult(enabled=False, networks="[SnmpNetwork(access='ro', cidr=0, community='public', network='localhost')]", snmp_v3_enabled=False, usm_users='[]')

```

To try with `requests`, use their basic examples and access the SolidFire API endpoint ("MVIP") directly, without the SDK.

And the same with `aiohttp` - just use one of the basic examples with Basic Authentication from their [documentation](https://docs.aiohttp.org/en/stable/client_quickstart.html).

Here's how that unscientific test (100 x `GetSnmpInfo`) worked on Ubuntu 22.04 LTS, Python 3.10.12 and SolidFire Demo VM 12.5 on ESXi. HTTPS (TLS) was used in all tests. SolidFire API endpoints run behind built-in NGINX (reverse proxy API gateway) which uses HTTP 1.1 - that's the "HTTP server".

| Client   | seconds |
|:---------|---------|
| SolidFire Python SDK | 3.35 |
| requests | 3.45    |
| aiohttp  | 2.90    |

In all cases it was just a simple loop (with aiohttp - asynchronous) with 100 API calls.

If `asyncio` is used to create 100 async `task`s which are then executed in own async HTTP(S) sessions, and the results gathered with `gather(*tasks)`, it takes just 1.65 seconds! But that's a bit more complicated to use and requires better skills than I currently have.

## Is it worth the trouble?

First, it's strange that Requests was slower than SolidFire SDK which uses requests, but anyway.

Even compared to SolidFire Python SDK, I get more than a 10% performance improvement with `aiohttp`. 

On the other hand, I'd have to do a lot more work without the SDK, and I may not really that extra performance.

So at this time I don't want to use `aiohttp`, but it may come handy for selected requests in [SolidFire Collector](/2024/05/03/netapp-solidfire-collector-next.html) - those which are many, such as some of the busiest functions from that instrumentation chart in the linked post.

## Real-life examples

### Chunky responses to "default" List and Get requests 

As a better, "real-life" example, a SolidFire's QoS Histogram (see the SolidFire Collector article) object has 14 keys in 5 metrics, which is 70 JSON "documents" per each volume (approximately 1kB per volume). 

If you have 500 volumes and ask for a QoS histogram chart, that's one giant response with thousands of records, which is a huge response compared to most other API responses that SolidFire does.  HCI Collector does that - it just sends one huge requests which probably works great if you have 20-200 volumes, which is likely 90% of SolidFire users out there.

A 1 MB response to `ListVolumeQoSHistograms` sent to a cluster with 1000 volumes isn't going to "crash" SolidFire. But it may slow down other requests and take a second to complete.

Another extreme would be to send 500 requests with 500 responses of approximately 1 kB each. This increases the use of CPU on the SolidFire node where API endpoint is located.

What I do in SolidFire Collector (v2 alpha) is something in between: I batch volume IDs in requests, so that I can send one or 20, and all but one be "medium" size. This is where farming those out to a dozen parallel `aiohttp` requests would be useful. (Multi)threading is also helpful here, but that only parallelizes work and after some success may create more blocking and contention so a combination of both is more helpful than multithreading alone.

### Single-object requests that need to be repeated

Yet another situation is some SolidFire API methods that work on a single object (no list can be passed). 

`GetAccountEfficiency` is one such example. There's no way to get efficiency for 2 or all accounts. It has to be one by one - maybe because each request makes the API get all the volumes owned by an account and already does a lot of work to get that response back.

With those there's no choice - one has to send a bunch of requests to get a bunch of responses. `aiohttp` can make all of them non-blocking.

### JSON-RPC

Note that in my test above I used simple JSON-RPC that didn't have to be URL-encoded. 

For non-trivial use we'd have to use a JSON-RPC integration for `aiohttp` or do the same work ourselves, by "manually" creating JSON payload for aiohttp requests.

There are [JSON-RPC projects for asyncio on Github](https://github.com/expert-m/aiohttp-rpc), but I have not yet tried them. Manual assembly of POST requests works  - it's less productive, but doesn't have external dependencies.

## Conclusion

Async IO isn't needed for "fast performance". 

Also, I *don't want* fast performance for my scripts because SolidFire API endpoints have more important users (such as vSphere Plugin or NetApp Trident) than my scripts.

I just want the ability to handle all requests optimally without stalling SolidFire or my program. Async IO can do that: if I remember correctly `aiohttp` creates up to 100 connections which I seem to remember is well within the SolidFire's API endpoint's limit (not for SolidFire Demo VM, but for hardware appliances).

There are other ways to get more out of Python, but I don't think I'll need to use them with SolidFire. 

I may consider using `aiohttp` in SolidFire Collector and [backup-to-S3 scripts](/2024/04/24/netapp-solidfire-monitor-backup-influx-grafana-11.html) because there may be 20-30 volume jobs to keep track of plus a fair number of requests to a metrics database and notifications services.
