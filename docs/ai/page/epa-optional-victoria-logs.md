# Optional Victoria Logs in EPA stack

How to configure SANtricity audit and alert forwarding to Victoria Logs in EPA 4

## Introduction 

Since I removed [MEL](/2022/12/13/eseries-santricity-mel-forwarding.html) codes in [EPA 4.0.0 beta 1](/2026/04/23/epa_400_beta.html), a separate how-to was created for the proper way to handle that, with instructions for a leading logging application ([Forward E-Series SANtricity logs to Victoria Logs syslog receiver](/2026/04/26/santricity-syslog-forward-victoria-metrics-logs.html)).

Since Victoria Logs works well and can meet a variety of needs (more on that later), it was added as an optional service to E-Series Performance Analyzer Docker Compose. You may, but you don't have to, enable it.

Although that post linked above explains it in detail and shows it in action, I need to add several additional notes.

## Victoria Logs (VL) in EPA 

It's not rocket science - just enable it and configure SANtricity to send logs to Victoria Logs.

Victoria Logs stores data in `./data/vl` by default. Nothing else has to be done.

By default, it listens on 15514 (both UDP and TCP) and the included Traefik container does *not* pass through that traffic.

Traffic flows from E-Series management interfaces to 15514/tcp (or /udp) on the EPA host. There's no authentication either. So, just make sure you allow incoming traffic from all E-Series controllers, or otherwise configure Traefik for termination and maybe use TLS if you want.

## Log forwarding in E-Series SANtricity 12.1

The other non-trivial detail that has to be documented is the degraded user experience in the SANtricity Web UI in version 12. 

These don't make any sense to me, but this is where the stuff is now. There are two places.

### Audit log

This is by default the new and changed stuff (`POST` and `DELETE` API actions, mostly). You could send all (reads as well, but that would create a lot of junk logs - imagine if you have EPA and reads enabled - you'd get hundreds of `GET`-driven events every minute).

![SANtricity audit log](/assets/images/epa-victoria-logs-01-audit.png)

Details:

![SANtricity audit log details](/assets/images/epa-victoria-logs-02-audit-details.png)

I have UDP selected, but other options include TCP and TLS (which you may want to use if you configure TLS termination on Traefik; the EPA repo has a script that creates self-signed certificates, and you can create and load the Traefik certificate here).

### Alerts

Why on earth this needs another section in the already bloated top-level menu remains to be seen.

These fire and forget and don't get sent repeatedly.

![SANtricity alerts](/assets/images/epa-victoria-logs-03-alerts.png)

I set both audit log and alerts to `15514/udp` to match the Victoria Logs' defaults in the EPA stack.

There's no TLS or TCP here. The format is RFC3164.

Message content example:

```sh
myarray1;4011;Critical;Volume not on preferred path due to AVT/RDAC failover
# <array-name>;<event-id>;<severity>;<message>
```

EPA already gets active alerts via the API, so these Alerts may be useful in only rare cases. These are very few and don't take up significant space, so there's no harm in leaving them enabled.

### Other weirdness

I think each category uses a different RFC standard. Notice that Alerts have just UDP option.

NTP in SANtricity may have a weird default as well (I can't tell for sure as someone may have changed the settings and [TFM doesn't say](https://docs.netapp.com/us-en/e-series-santricity/sm-hardware/configure-ntp-server-addresses.html)). It appears it's set to get NTP server info from DHCP, which often results in an unconfigured NTP client. So, configure NTP servers before you setting up syslog forwarding.

## Why do we need Victoria Logs

You don't. As the first post explains, I recommend it to those who miss MEL events removed from performance metrics (because they aren't performance metrics). You can send logs anywhere, or nowhere. 

I put Victoria Logs service in Docker Compose and disabled it by default so that it takes no effort to get it going. Flip the switch, allow incoming to E-Series, configure NTP and forwarding. 30 seconds per array and you have logs preserved.

With that, you can do stuff.

After I completed [SolidFire MCP Server](/2026/11/23/keep-going-with-netapp-solidfire-mcp-server.html), I looked at what NetApp is doing with MCP and - surprise, surprise - there's no MCP for SANtricity. There's Harvest MCP which can access SANtricity metrics, but that's about it.

So, Victoria Logs has been to EPA added today as the first step.

My next step might be the EPA MCP Server:
- Performance-related tools with Victoria Metrics backend
- Configuration- and event-related tools with Victoria Logs backend
- Kubernetes insights with performance and configuration data from [SANtricity CSI](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html)

With one MCP server for all backends (or three servers in one place, whatever), I can get 8-10 useful query tools in one place, without ability to modify anything, without bloat, confusion or repetitive features. That should be good because there's nothing out there.

It's not hard, it just makes it even easier. I had an [MCP server for E-Series](https://github.com/scaleoutsean/eseries-santricity-collector/tree/master/influx-mcp) before NetApp MCP servers came out, but I got no feedback of any kind, so I shelved that project. I'm also not convinced I should waste time on doing it again.

But at least Victoria Logs is a no-brainer, so that's all for now.

## Conclusion

This addition isn't part of a new release, but it's already on Github. 

It may or may not make it to a future release, but it's usable today as per the previous post on Victoria Logs with SANtricity.

To make this release-worthy, I'd have to (re)create the EPA MCP server.
