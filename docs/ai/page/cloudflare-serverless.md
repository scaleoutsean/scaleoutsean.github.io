# Hybrid cloud scenarios with Cloudflare serverless

Opportunities for a better hybrid cloud architecture with Cloudflare

- [Introduction](#introduction)
- [Cloudflare scenarios for Hybrid Cloud users](#cloudflare-scenarios-for-hybrid-cloud-users)
- [Experiment](#experiment)
- [Conclusion](#conclusion)

## Introduction

Cloudflare is building a better infrastructure for Hybrid Cloud:

- Simpler (less cognitive overload)
- Lower cost 
- Better-performing
- Architecturally sound (in my opinion)

I wanted to illustrate and comment on currently or soon-to-be available options from a perspective of on-premises storage options.

## Cloudflare scenarios for Hybrid Cloud users

What we can do with it today as far as **hybrid** cloud deployments are concerned?

Before we begin, we should understand Cloudflare Workers. If we don't have time to do that, let's just say those are stateless, short-lived Node.JS-like containers.

We can run Workers and use Cloudflare Zero Trust services (there's Tunnel, etc.) to connect to on-premises infrastructure. There's also Algo Smart Routing to optimize routing and latency.

![Cloudflare Workers with on-prem data and applications](/assets/images/cloudflare-stateless-with-all-storage-on-prem.png)

Note on SMB and NFS: these services would not be used from containers, but by external application users who need access to NFS or SMB when - for example - applications simply cannot be containerized. An example can be seen [here](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/use_cases/smb/#connect-to-smb-server-with-warp-to-tunnel). For example, something like this:

![Cloudflare Workers with on-prem data and applications used by mobile users](/assets/images/cloudflare-stateless-with-all-storage-on-prem-mobile.png)

Would this approach be too slow? I don't think it would be too slow for small workloads. You wouldn't be able to use Workers to run SAP HANA this way, but many applications (maybe 50%) consume just a few hundred IOPS.

I haven't done any benchmarking of these use cases, but I have no doubt this is feasible for smaller applications. Last year I tested bandwidth and latency from my home lab to a nearby hyperscaler and it was 30 MB/s and just a few milliseconds, respectively. For database workloads that is as fast as small RAID array with 10K RPM SAS disks.

And, since Workers has recently been open-sourced, I think users will be able to run their Workers apps on-premises as well.

I think this approach is much simpler than with hyperscalers - Cloudflare takes care of all the network "magic" for you, and some additional services not mentioned here are competitively priced or even free.

Cloudflare object storage called R2 has GA'd recently. That opens up additional possibilities. Enterprises can keep their object data on-premises and replicate it to Cloudflare R2. Or just move all their object storage to R2.

![Cloudflare Workers with some data in Cloudflare object storage and database replicas](/assets/images/cloudflare-stateless-cloud-object-on-prem-file-r-w-db.png)

If object storage is updated and replicated to R2, this again makes it possible to run applications on-premises and in the cloud - just write and delete objects in the read-write location (whether that's R2 or on-prem S3) and replicate to the read-only location.

I made a small variation on the on-prem DB type - if you prefer to use HTTPS to connect from workers, that's also possible with RESTful plugins or native RESTful databases.

Workers with read-heavy workloads can take advantage of SQLite read-only replicas. Like with distributed objects, we can write to on-premises DB and replicate it to Cloudflare by pushing updates to D1, Cloudflare's SQLite service. That could work in reverse, too - one could collect IoT data in D1 and use Workers to replicate data to SQLite or other databases on-premises.

![Cloudflare Workers with some data in Cloudflare object storage](/assets/images/cloudflare-stateless-state-in-r2-and-ro-db.png)

D1 is not GA yet, but it will lets users run distributed SQLite completely within Cloudflare, accessible to Workers in read-write fashion.

Like with R2 and Workers today, it will be possible to have applications and data only on Cloudflare, but this post has focused on hybrid use cases where for whatever reasons, some data and workloads live on-premises (or in any hyperscaler or other public cloud provider, for that matter). Storing data-at-rest on premises may be cheaper or not, but it has a different data sovereignty profile and egress is almost always cheaper compared to public cloud.

## Experiment

I haven't used Cloudflare Workers to build a hybrid cloud application which uses on-prem data. 

At this time I have a light-weight worker application (an E-Series sizer) up and running in Workers but its data is self-contained and it could also run client-side (using client-side JavaScript rather than Worker-side), so it doesn't showcase many unique features of CloudFlare serverless - for now all you get is a container that quickly starts on-demand and renders JS server-side.

With the ability to offload I/O to R2 and soon D1, I think this stack is very powerful and yet simple to understand and manage. I could make it hybrid by moving its small database to an on-prem S3 or PostgreSQL, but I haven't done that because of maintenance burden.

Here's how it could work:

- JavaScript-powered application uploaded to on-premises S3 storage or running in Workers with server-side rendering (like my E-Series sizer)
  - For S3-based static apps with JS, use Cloudflare DNS and Web Proxy map external TLD to proxy on-premises S3 app - application is cached by Cloudflare and runs client-side in the browser
  - For Workers-based apps, application runs in Cloudflare Workers and uses on-prem data (S3 or SQL)
- Between Cloudflare Web Proxy and on-premises data set up Reverse Proxy for logging, authentication, security (this can be a Cloudflare service, or DIY on-prem)

![Cloudflare DNS with Web Proxy](/assets/images/cloudflare-proxy.png)

- On-premises PostgreSQL Docker container with RESTful API exposed to the Web via Cloudflare Zero Trust (Tunnel). Alternatively consider Cloudflare Argo to avoid exposing database to the Internet and/or your external clients.

![Cloudflare DNS with Web Proxy](/assets/images/cloudflare-restful-database.png)

We could connect from the Web app directly to an on-prem database by opening on-prem firewall to authenticated and authorized users, but then we'd have to take care of network security by ourselves.

This approach above only exposes our S3 bucket (which is read-only) to Cloudflare Web Proxy, and the application can contain authentication and authorization code. PostgreSQL database is not directly exposed to the Internet (it's RESTful HTTPS, proxied by Cloudflare, but can use Argo instead) and it allows access to only authenticated Web application users.

## Conclusion

I'm not a big fan of how applications are deployed to hyperscalers: it's either lift & shift, which usually doesn't result in improvements, or highly proprietary. Even with Kubernetes, many staff "specialize" in individual hyperscaler's flavor of managed Kubernetes service and can't easily combine it with, or migrate to, another Kubernetes service elsewhere. And then there are all sorts of complex fees - FinOps, proprietary and non-portable network and identity management, etc.

Cloudflare focuses on Web-related services (no Big Data solutions for now) that are simple to understand, open, affordable and most importantly, done right. If I had all my applications in one hyperscaler, I'd look for opportunities to move some services to Cloudflare rather than another hyperscaler (although that is sometimes unavoidable due to the need to use hyperscaler-specific applications).

I look forward to increased awareness and adoption of Cloudflare services among hybrid and public cloud users.
