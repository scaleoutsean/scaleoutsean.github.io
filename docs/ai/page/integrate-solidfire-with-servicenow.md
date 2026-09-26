# Integrate SolidFire with ServiceNow

Integrate SolidFire with ServiceNow by way of Elasticstack

This is speculative and I haven't tried it, but it looks very interesting.

Note there's an [official SolidFire plugin](https://docs.servicenow.com/bundle/rome-it-operations-management/page/product/service-mapping/reference/solidfire-storage-pattern.html) on the ServiceNow Web site, but this is about leveraging ELK for a more holistic approach (performance, monitoring, event loging and various correlations that you can derive from SolidFire and other data managed by your ELK stack).

## Elastic-ServiceNow integration

The first is that I spotted in the news that Elastic announced their integration with [ServiceNow](https://www.elastic.co/what-is/servicenow).

One of the great things about this integration is it's bidirectional. And there's a [plugin](
https://docs.servicenow.com/bundle/rome-security-management/page/product/secops-integration-sir/secops-integration-elasticsearch-inc-enrichment/task/activate-configure-elasticsearch.html), so taken together this looks very nice to me.

## SolidFire-Elastic integration

The second is that thanks to [this post](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html), anyone should be able to get any SolidFire details (events, perf stats, etc.) into Elasticsearch.

I don't have anyone asking for this so I won't go out of my way to setup Elastic and ServiceNow in order to try this out, but this would be the first thing I'd try if I had to integrate SolidFire with ServiceNow without reinventing the wheel and deploying a lot of DIY plumbing.

## How to try

If you want to give it a try, [go here](https://www.elastic.co/blog/how-to-connect-servicenow-and-elasticsearch-for-bidirectional-communication) where you can find a walk through with a simple (non-SolidFire) project and links to download the required software (ELK stack and ServiceNow personal developer instance).

If you want to expand this testbed with SolidFire, Element Demo VM (no BS, gratis license which doesn't expire, but Support Portal registration is required) can be downloaded from the Tools section in NetApp downloads.

- More on [SolidFire Demo VM](https://github.com/scaleoutsean/awesome-solidfire#demo-vm-tools-and-utilities)
- Video: how to [deploy and configure SolidFire Demo VM on vSphere 7](https://youtu.be/3sWaD1arVvc) in minutes
