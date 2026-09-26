# Post-Quantum API proxy for E-Series and SolidFire

Enterprise-grade PQC TLS encryption for E-Series and SolidFire API endpoints

## Introduction

Do we want PQC on API endpoints? Yes! When do we want it? Now!!!

Are E-Series and SolidFire API endpoints already vulnerable? Unlikely so. 

SolidFire may seem less of a problem because it's going end-of-support relatively soon, but that way of thinking is entirely wrong. 

It is less of a problem only because it is unlikely that massive harvesting of encrypted traffic is occuring on internal, management networks. And, if it *is* happening, you're probably getting screwed somewhere else.

But that's not a reason to not use it today if it's easy and inexpensive. SolidFire will unlikely get it, and E-Series doesn't have it yet, so we can wait or go ahead with our Plan B.

## Plan B: quantum-secure reverse API gateway for SolidFire and E-Series

> Walter S: The beauty of this is its simplicity. 

Let's put a PQC-resistant reverse proxy right in front of your storage. The closer the better, because the last leg is going to remain good ole pre-PQC stuff. 

So, preferrably the same L2 or even one PQC dual-homed proxy with one L2 leg on the SANtricity or SolidFire management network.

![PQSS diagram](/assets/images/pqss.png)

We could run it inside of management domain, or not. That's up to us.

Then we expose API endpoints using strongest cryptography we can get and our clients can support.

Then we some quality-of-life goodies for the exhausted admins:

- Easy configuration
- Easy certificate checks
- Logging (to SIEM via syslog endpoint)
- Monitoring and metrics (to InfluxDB or Prometheus exporter). I already have an InfluxDB-based monitoring stack for [SolidFire](https://github.com/scaleoutsean/sfc/) and [E-Series](https://github.com/scaleoutsean/eseries-santricity-collector), so if you have more than one cluster (or box, in the case of SANtricity), maybe you can realize some economies of scale managing and monitoring this way

How do we go about it?

- NGINX from master branch (pre-1.29.3 code)
- OpenSSL 3.6.0 
- Build proxy container from NGINX and OpenSSL
  - Enable features you wish, such as ML-KEM
  - Logging
  - Metrics
  - Reporting done in SIEM and observability platforms
- Hashicorp Vault for secrets (if you need it)
- API server for CLI configuration wizard
  - Configure E-Series (2 controllers only, although we could allow 1)
  - Configure SolidFire (1 cluster only)
  - Configure both SolidFire and E-Series at once
  - Options to configure TLS v1.3 (required for PQC), to enable PQC, to allow fallback to PQC. You could use TLS v1.2 as well, or both TSL v1.3 or v1.2 (allowing TLS v1.2 here may seem silly, but it's not)
- Tools and scripts

## Strengths and weaknesses

I am not going to break this down into details, but I'll highlight some points.

Strengths:

- Strongest encryption: not just PQC, but also TLS v1.3, ciphers and the rest of it
- Monitoring: it's easy to keep an eye on one box, but even then people easily lose sight of it. If you have mutiple boxes you need to watch them, especially if you don't have a system that automatically refreshes certificates. Even if you do, you probably want another system that can give you reports, log fall-backs, and similar

Weaknesses:

- Container security: one may argue TLS v1.3 with "average" everything is better than PQ TLS v1.3 with best if that's running in a DIY container. That's partially correct, and if harvesting of encrypted traffic isn't one of attack vectors you're trying to stop then obviously this isn't for you

Additional points:

- It is wrong to assume that management domain (where this stack would be running) could somehow be compromised, but that manag*ed* systems to which systems from this domain connect, would some survive. Or that this proxy running on a stand-alone system would increase risks. That is *possible*, but it depends on what you're trying to achieve. If you manage over L3 or even public networks, you may not be more secure by not touching anything
- It is also wrong to assume that a rootless reverse proxy with top-notch security would be less secure than connecting to TLS v1.2 with poor ciphers if you're concerned about these types of attacks (related to weak ciphers, curves, protocols)
- NGINX can do a lot more than just PQC. For example with a bit more work you could add [RBAC](/2023/12/07/solidfire-rbac-for-json-rpc-api.html) to PQC. You'll never get RBAC from SolidFire proper, and that may be something that you need in every API call

## What PQSS isn't

This proxy is for API clients only. Authentication against back-end (API) is required. This is different from my [WAC Gateway for SolidFire](https://github.com/scaleoutsean/solidfire-wac-gateway), for example, were authentication and authorization is done against Active Directory Service and app gateway (not SolidFire!) configuration. 

UI use is relatively rare and declining. When users do use Web UI there is 2FA and SAML, so it's not something I wish to focus on.

## Let's do it!

It's nothing really new, but it's also not done stupidly. 

First we build NGINX and make sure it's done right. (To be) 1.29.3, OpenSSL 3.6.0 and ML-KEM can be configured.

![Build PQ NGINX](/assets/images/pqss_01_build.png)

Then we run our application that asks us how we want this configured. As mentioned above, this asks for **both** E-Series and SolidFire and you may answer `y` to both. I said `n` to E-Series because I don't have it at home (I also don't have a SolidFire cluster at home, but I have SolidFire Demo VM at home).

And, on that point, notice - one of the "not stupidly" parts, that is why you see one SolidFire node in that wizard. Why do we even see it? Because the application connects to SolidFire, gets all the active nodes, and checks 'em all out. The same is done later in reporting.

![PQSS app wizard](/assets/images/pqss_02_wizard.png)

Notice how fallback from PQC to non-PQC is allowed. That's an option for users who need it.

Once we're done, wizard finalizes NGINX configuration and updates NGINX container configuration files. 

When we start NGINX we can use different clients to see what they register in NGINX logs.

![PQ NGINX logs from Firefox and curl](/assets/images/pqss_03_testrun.png)

What I've mentioned earlier: Firefox 143 woks fine. "Current" `curl` as packages by Ubuntu for 24.04 LTS, is too old. It works, but it falls back and manages to connect only because fallback is allowed.

I've said this above, but many will want to try so... Here's what you'll see (SolidFire 12.5 version).

![Don't bother with SolidFire UI](/assets/images/pqss_04_web_ui.png)

The issue here is client-side JS interferes with proxying. I think a workaround would involve having a simple browser extension to override SolidFire management IP address.

You may have more luck with the SANtricity Web UI, although I wouldn't bother.

## Clients

- UI: as mentioned, SANtricity Web UI may work, SolidFire won't (although we could write a better UI, similar to this [Angular UI here](/2025/07/26/solidfire-windows-admin-center-gateway.html)). Other than the quirkiness clients, Firefox 143 does work, I tested out of curiosity and you can see it in a screenshot below.
- API: any HTTPS client that supports TLS v1.3 and curve `X25519MLKEM768` (ML-KEM). *Any client from 2024 is unlikely to work*

Current (as of today) `curl` won't work because it isn't compiled against OpenSSL 3.6.0. I wrote about it in the recent [ESC 4 post](/2025/10/07/ecp-eseries-performance-analyzer-aka-collector.html). 

But you can find various other clients that do work. For example, Go 1.25 should work fine. I used Go 1.25.2 for this.

API client log:

```sh
$ go run pqtest.go
TLS Version: TLS 1.3
Cipher Suite: TLS_AES_128_GCM_SHA256
Server Name: sf.dt.datafabric.lan
Negotiated Protocol: 

API Response:
{
  "id": 1,
  "result": {
    "clusterAPIVersion": "12.5",
    "clusterVersion": "12.5.0.897",
    "clusterVersionInfo": [
      {
        "nodeID": 1,
        "nodeInternalRevision": "BuildType=Release Element=magnesium Release=magnesium-patch5-rel ReleaseShort=magnesium-patch5-rel Version=12.5.0.1310 Repository=magnesium-patch5-rel VCS=git Revision=c53bcd206ed5 Options=timing,trace BuildDate=2022-04-29T01:35:01UTC md5=e2e1be4036b72b27c67ad04ad61eaf04",
        "nodeVersion": "12.5.0.897"
      }
    ],
    "softwareVersionInfo": {
      "currentVersion": "12.5.0.897",
      "nodeID": 0,
      "packageName": "",
      "pendingVersion": "12.5.0.897",
      "startTime": ""
    }
  }
}
```

What you see above is the client successfully connecting to SolidFire API version 12.5 using TLS 1.3, cipher suite TLS_AES_128_GCM_SHA256. 

`sf.dt.datafabric.lan` is my reverse proxy, not SolidFire MVIP (which is behind the proxy, with IPv4 192.168.1.34).

Let's take a look at the proxy server log. Why? 

Because we configured our proxy to fall back to non-PQC. Why?

Because we want to let clients connect. Why? It's just an option, to allow or disallow fallback to pre-PQC. Why do we enable?

For the purpose of testing. Not just of "can it connect with ML-KEM curve, but also to confirm our logging and reporting works (more on that later).

We check the log and...

```sh
$ docker exec pqss-nginx tail -1 /var/log/nginx/pqc_security.log
192.168.1.13 - admin [09/Oct/2025:12:00:20 +0000] "POST /json-rpc/12.3 HTTP/1.1" 200 "dt.datafabric.lan" TLSv=TLSv1.3 Cipher=TLS_AES_128_GCM_SHA256 Curve=X25519MLKEM768 "Go-http-client/1.1"
```

`Curve=X25519MLKEM768` it is! 

You can see that in this screenshot as well.

![Successful PQ TLS to SolidFire with Go 1.25.2](/assets/images/pqss_05_working.png)

Careful observes may have noticed a `-k` here and there. The reason was the right wildcard certificates weren't automatically copied to NGINX at that time and test code used ones for testing.

I just manually copied valid wildcard certificate and re-ran the test just to make sure there's no problem. 

![Proper PQ TLS validation](/assets/images/pqss_06_look_ma_no_cheating.png)

But that's another decision to make - how to handle secrets.

On SolidFire and SANtricity, private keys are in the box. Here, there's no box. 

You can keep them in a vault, .env, etc. Unfortunately, there's no recipe that fits all and providing several options can become complicated. I'm still looking into this. Current plan:

- Wizard ends and informs the user how many certificates with what names to get - it could be one (e.g. wild-card for 2 E-Series controllers) or 40 (40 FQDN certificates for a large SolidFire cluster)
- Admin gets the certificates (or automates their issuance) and uploads them to vault
- NGINX reloads upon seeing new certificates

This way you can automate own issuance scripts if you want, to issue certificates elsewhere and `scp` them to this system.

### mTLS

Once we have the above in place, it's easy to authenticate TLS clients using mTLS, too.

This can be strict (`ssl_verify_client on;`), so that no other client can connect to our proxy. Then we have another layer of protection as well.

This can be useful for anyone, but especially for Trident CSI and SolidFire, since Trident CSI already supports mTLS.

## Conclusion

If you're concerned about L2/L3 traffic harvesting on SolidFire (and E-Series, as long as it doesn't support PQC), this is a good approach. 

I deliberately use "Enterprise-grade PQC TLS encryption" in post summary, because it is. 

For those not in the know, it's not my scripts that's "enterprisey", but NGINX. You don't get NGINX that's different from most products use to reverse proxy inside the box - you get the same or better (because it's newer).

And community edition of NGINX can be swapped for commercially supported, enterprise-grade [F5 NGINX+](https://www.f5.com/products/nginx). As soon as it starts supporting ML-KEM (if it doesn't already), swap the container image link, restart NGINX and that's likely all you need to do. (Even the configuration files are likely remain the same, but you could add additional protection that NGINX+ supports.)

It's an affordable way to get enterprise grade security without touching your hardware. It can also be used to improve security in Kubernetes (CSI).

Alternatively, SolidFire users can also consider that WAC Gateway of mine (linked at the top).

If you're an E-Series or SolidFire user who may need this, ping me on X so that I allocate some time for documenting and publishing the source code.
