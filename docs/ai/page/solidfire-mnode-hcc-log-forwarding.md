# SolidFire mNode and HCC Log Fowarding

syslog forwarding for SolidFire mNode and Hybrid Cloud Control

SolidFire Management Node (aka mNode) is a VM that runs Hybrid Cloud Services (various "management stuff".) Let's say we wanted to collect and analyze those logs.

How could we get the logs out the smart way?

Before we begin, we need to know what we're dealing with. As of today, we have two groups of logs on mNode:

- mNode system logs (the usual Linux stuff)
- HCC service logs (JBOC, just a bunch of containers)

There are no local users so presumably everything that's worthy of our attention is in system and HCC log(s).

Key software components:

- NetApp SolidFire Management Node (mNode) v12.2
  - Docker v18.09.8
  - rsyslogd 8.1904.0
- NetApp Hybrid Cloud Control (HCC) v2.16.66

### mNode

Backup your /etc/rsyslog.conf and hack away! I added these three rows for my $DST server reachable at $DST_PORT (`$DST:$DST_PORT` such as 2.2.2.2:2514):

```raw
*.* action(type="omfwd" target="$DST" port="$DST_PORT" protocol="tcp"
            action.resumeRetryCount="100"
            queue.type="linkedList" queue.size="10000")
```

There are fancy features in this module. You can compress the log, set a re-try interval (for the 100 tries mentioned above; see `ActionSendTCPRebindInterval` in the rsyslog documentation), or even use a specific network `device` (which may be useful if you have multiple NICs as users who use mNode with Persistent Volumes do, or want to use a secure network to forward your logs) and so on. RTFM!

With this set up, we can now monitor OS-level events:

```raw
Nov 27 10:30:21 192.168.1.31 sshd[19710]: Postponed keyboard-interactive for admin from 192.168.1.12 port 58430 ssh2 [preauth]
Nov 27 10:30:23 192.168.1.31 sshd[19710]: Postponed keyboard-interactive/pam for admin from 192.168.1.12 port 58430 ssh2 [preauth]
Nov 27 10:30:23 192.168.1.31 sshd[19710]: Accepted keyboard-interactive/pam for admin from 192.168.1.12 port 58430 ssh2
```

I should note that there are all sorts of logs under /var/log, some of which are likely not captured by syslog, so additional modifications to rsyslog.conf would be required if we wanted to capture those logs.

### HCC

This one seems easy. Backup `/etc/docker/daemon.json` and hack away, right? Wrong!

With log-related additions to daemon.json we can send Docker logs to `$DST:$DST_PORT`, also using TCP like we did with rsyslog.

```json
{
    "bip" : "169.254.100.1/22",
    "log-driver": "syslog",
    "log-opts": {
        "syslog-address": "tcp://$DST:$DST_PORT",
           "tag": "solidfire"
    }
}
```

The `bip` thing was there before - I only added the log-related entries.

The tag key may be useful for classification and grouping at the destination. I should probably have done something similar for the rsyslog above. With that tag Docker logs (below tagged with `hcc`) are easier to tell apart from mNode (OS) logs (`systemd`), although we could also use syslog at the destination to save each source to a different file:

```raw
Nov 27 10:28:27 192.168.1.31 systemd[1]: Stopping Deploy Element Auth service...
Nov 27 10:28:27 192.168.1.31 systemd[1]: Stopping Login Service...
Nov 27 10:28:27 192.168.1.31 hcc[20264]: killing the spooler with pid 6
```

Once we're done with changes to rsyslog.conf and Docker's daemon.json, we can reboot mNode.

### Wait, what do you mean "reboot"

Yep, I just rebooted mNode to see if my settings worked. What if we wanted to reload rather than reboot? Feel free to JFGI (I'm not too curious how to do that on Docker v18.09.8!)

At the destination syslog server, tail the forwarded log(s) to see a combined log from mNode's rsyslog and Docker:

```raw
Nov 27 08:16:01 192.168.1.31 CROND[30647]: (root) CMD (cd / && /usr/bin/flock -x /var/lib/sftracing/lock -c 'logrotate --state=/var/lib/sftracing/status /var/lib/sftracing/logrotate.conf' >/dev/null)
Nov 27 08:16:51 192.168.1.31 dockerd[20264]: time="2020-11-27T08:16:51.520518736Z" level=info msg="NetworkDB stats mnode(2e34102d1390) - netID:jsgguqh5mxhgjxxf1qkvlvs0t leaving:false netPeers:1 entries:43 Queue qLen:0 netMsg/s:0"
Nov 27 08:16:51 192.168.1.31 dockerd[20264]: time="2020-11-27T08:16:51.520610196Z" level=info msg="NetworkDB stats mnode(2e34102d1390) - netID:moxqzm0ca0yon5wgri3yyty94 leaving:false netPeers:1 entries:3 Queue qLen:0 netMsg/s:0"
Nov 27 08:16:51 192.168.1.31 dockerd[20264]: time="2020-11-27T08:16:51.520624912Z" level=info msg="NetworkDB stats mnode(2e34102d1390) - netID:lp5fpj7cqik3pqsqsg7o56xsi leaving:false netPeers:1 entries:8 Queue qLen:0 netMsg/s:0"
Nov 27 08:17:01 192.168.1.31 CROND[30752]: (root) CMD (cd / && /usr/bin/flock -x /var/lib/sftracing/lock -c 'logrotate --state=/var/lib/sftracing/status /var/lib/sftracing/logrotate.conf' >/dev/null)
Nov 27 08:17:06 192.168.1.31 lldpd[21648]: unable to bind to raw socket for interface veth20d4528: No such device
Nov 27 08:17:06 192.168.1.31 lldpd[21651]: unable to initialize veth20d4528
```

System and Docker service log are there, but wait - those docker logs seem very sparse, what's up with that?

#### Logs of Individual Containers

We need to do something about the container logs. What only 30 minutes ago seemed like a trivial exercise is becoming a way to waste an entire evening...

Container logs go to `/var/lib/docker/containers/${Id}/${Id}-json.log` (where ID is the container ID) as expected. These IDs change after each restart (for example, in the case of container image `logs-svc` , we'd get a different ID every time the OS or container are restarted.)

For now the important part is that the information we need is there:

```raw
{"log":"[pid: 9|app: 0|req: 972/1678] 10.0.0.40 () {32 vars in 1303 bytes} [Fri Nov 27 08:33:13 2020] GET /1/assets/storage-clusters/5a6502a3-8bcb-4617-8cce-64127996545c =\u003e generated 735 bytes in 6 msecs (HTTP/1.1 200) 5 headers in 154 bytes (1 switches on core 0)\n","stream":"stderr","time":"2020-11-27T08:33:13.665314987Z"}
{"log":"[pid: 9|app: 0|req: 973/1679] 10.0.0.40 () {32 vars in 1303 bytes} [Fri Nov 27 08:33:23 2020] GET /1/assets/storage-clusters/5a6502a3-8bcb-4617-8cce-64127996545c =\u003e generated 735 bytes in 6 msecs (HTTP/1.1 200) 5 headers in 154 bytes (1 switches on core 0)\n","stream":"stderr","time":"2020-11-27T08:33:23.670857855Z"}
```

Next we need to figure out why that stuff isn't being forwarded out. The problem is we may not be able to do much with that information: we can't change HCC's container startup parameters (not in a supported way anyway).

We don't have to be worried about that scenario because we can always get to the container logs via the [HCC API](https://docs.netapp.com/us-en/hci/docs/task_hcc_collectlogs.html#use-the-rest-api-to-collect-logs) which lets us poll the HCC API endpoint and those logs every $N seconds (or get last $M lines from particular container log). That functionality reflects the logs command of Docker:

```sh
sudo docker logs c43bcd1f0431 --since 2020-11-26
```

While we can poll the API for container logs this way, a better approach would be to run an agent that scans /var/lib/docker/containers/ and takes care of everything.

But *why* are the logs not sent together with Docker logs? The answer is under `/etc/rsyslog.d` - in the file named `30-docker.conf`, to be precise:

```raw
:syslogtag, startswith, "docker" /var/log/docker.info
& stop
```

We'd have to hack that file or come up with another file (`40-hcc.conf`, for example) where we'd ask rsyslog to find our logs in `/var/lib/docker/containers/*/*-json.log`. But - alas! - this version of rsyslog doesn't do directory name wildcards so that's out of the question as well.

We could write a new fancy rsyslog rule and dynamically reload rsyslog.conf, but that wouldn't be pain-free either because interesting HCC container logs are all owned by `root:root` which wouldn't work for rsyslog.conf (another can of worms.)

Time to take another look at that HCC API method...

#### HCC `GET /logs`

HCC logs seem to be rotated very slowly (weeks) so it appears quite safe to fetch them every X minutes or hours. We can use the `since` parameter to dynamically get log entries created in last X minutes or hours, and avoid fetching the logs of stopped containers named `logs-svc` (we only want the logs of a running `logs-svc` container).

```sh
curl -X GET "https://${mNode-IP}/mnode/logs?since=2020-11-26T06%3A00%3A00Z&service-name=logs-svc&stopped=false ...
```

That would query mNode for the log of a running `logs-svc` container and return something like this:

```raw
Response body
Download
=========================================================
    mnode_logs-svc.1.nxk8szxmjuuiyo30frxdltcel
=========================================================
[uWSGI] getting INI configuration from uwsgi_app.ini
*** Starting uWSGI 2.0.19.1 (64bit) on [Fri Nov 27 10:57:26 2020] ***
compiled with version: 9.3.0 on 08 October 2020 02:01:58
os: Linux-4.19.37-solidfire7 #1 SMP Wed Jun 24 20:10:57 UTC 2020
nodename: 42d366150c41
machine: x86_64
clock source: unix
detected number of CPU cores: 6
current working directory: /app
detected binary path: /usr/local/bin/uwsgi
```

This particular log isn't structured, but some other services that deal with API calls have structured logs.

Another detail we should consider is if we want to get logs from particular service, or "all". We should definitively gather logs one by one. If we look at all `Up` containers in the output of `docker ps -a`, our initial list may look like this:

```raw
node-api-gateway
hcc-ui
credential-svc
vcp-sioc
mongo
redis
logs-svc
hci-monitor
mnode-api
mnode-svc-mon-grafana
package-svc
hardware-svc
vcenter-svc
telemetry-service
storage-service
mnode-svc-authz
inventory-service
mnode-svc-mon-prometheus
docker-proxy
mnode-svc-task-monitor
k8sdeployer
mnode-svc-aiq-collector
```

We could now look at the mNode and HCC documentation and decide which logs we're not interested in. For example we may take a look at the logs of `mnode-svc-mon-prometheus` and decide we don't want those. 

With that information we should be able to prune the list to a more manageable length and create a script that loops through a list of container services and every N minutes fetches last (N+1) minutes of service logs.

### Fowarding to Multiple Destinations

For rsyslog I would assume one can simply repeat an rsyslog `action` twice.

For Docker, depending on the version and configuration, `docker logs` may [or may not](https://docs.docker.com/config/containers/logging/dual-logging/) work the way you expect - and that also depends upon your expectations.)

As you can see at that page, Docker *cannot* log to multiple destinations. Oops! It also can't retry like rsyslog can. So it appears for some folks it may be better to log to `local` and have a 3rd party agent (or just rsyslog) gather those logs and send them to multiple destinations.

### What about SolidFire storage cluster logs

Short version: you can set one or more syslog destinations with a simple CLI or API call to MVIP.

See my repo Awesome SolidFire and SolidFire logging-related videos on YouTube.

## Conclusion

mNode system and Docker service logs can be forwarded with ease, but at this time logs of individual containers should be gathered by using the HCC API.

While that is not very inconvenient, we should also investigate 3rd party log forwarding tools that could be deployed inside of mNode VM and eliminate the need to use the API.

If you make any changes on your production system, don't work by these blog posts. Consult the documentation, read the KB articles and check with Support.

### Follow-up (2020/12/05)

As mentioned earlier, it's not supported to add your own containers to mNode VM. Why? It doesn't matter, what matters is it's not supported. It likely has to do with VM capacity and resources, as well as unpredictable interactions with existing container and non-container workloads. But whatever it is, the point is there's no need to create a how-to because the right how-to is "don't do it" so I'll just add some notes on how I made it work in a non-supported manner.

#### Input

Filebeat documentation for Docker isn't great, but (h/t: logz.io) I used `prima/filebeat` and didn't want to spend much time on making it look and work nice. My inputs were all Docker logs:

```yaml
filebeat.prospectors:
 - input_type: log
  paths:
    - /var/lib/docker/containers/*/*-json.log
  ...
```

The above, once it starts churning through logs, can eat up 2 CPU cores *easily*. Similarly for RAM and disk space. In other words, if you don't increase mNode VM resources or restrict this container's resources, it can easily take down your mNode or individual HCC services.

What if you want to collect just some, rather than all, logs? The list of containers is in this post and what they do is in the documentation. Create multiple filebeat containers or create multiple definitions (YAML format), one per each individual container, and load them like so:

```yaml
filebeat.config.inputs:
  enabled: true
  path: hcc.d/*.yml
```

You'd probably have to read [the docs](https://www.elastic.co/guide/en/beats/filebeat/current/filebeat-configuration-reloading.html) to use this approach.

After a bit of googling and RTFM I also managed to capture individual container logs (hcc-ui, in this example) with this:

```yaml
filebeat.autodiscover:
  providers:
    - type: docker
      templates:
        - condition:
            contains:
              docker.container.image: hcc-ui
          config:
            - type: container
              paths:
                - /var/lib/docker/containers/${data.docker.container.id}/*.log
              exclude_lines: ["^\\s+[\\-`('.|_]"]
```

#### Output

Filebeat can send container logs to external recepients.

```yaml
output.elasticsearch:
  hosts: ["192.168.1.146:9200"]
```

If you want to send it to two destinations, run two filebeat containers with identical configuration.

Or, if you wanted to store logs locally, you could add this directory to rsyslog configuration and leave the forwarding to multiple destinations to rsyslog:

```yaml
output.file:
  path: "/var/logs/docker/filebeat/"
  filename: filebeat
  rotate_every_kb: 1000
  number_of_files: 7
  permissions: 0644
```

In this example retain only 7 x 1 MiB files. That's probably not what you want to do. Likewise, although you're not supposed to have any local users on mNode, you'd probably want those permissions tighter (0640, for example).

#### Result

You'll get some extra junk you may not want, but Filebeat has options and processors that let you strip that, and so does rsyslog. By the looks of it (see the values like `jit` in this JSON file) you may want to ensure that logs are either stripped of confidential info at the source, or sent to destination over encrypted connection.

```json
{
	"@timestamp": "2020-12-04T17:06:02.511Z",
	"@metadata": {
		"beat": "filebeat",
		"type": "doc",
		"version": "6.2.3"
	},
	"source": "/var/lib/docker/containers/f14f10d6aefccf3be511c259a79e1cdae46f6f1da24479704392e3852cd45aa8/f14f10d6aefccf3be511c259a79e1cdae46f6f1da24479704392e3852cd45aa8-json.log",
	"offset": 73282162,
	"log": "2020-11-28T23:49:25.683922Z |     6 | 132721654 |    MainProcess-uWSGIWorker1Core0  |         flask_authtools:117  | DEBUG   | Authenticated user with claims: {'nbf': 1606607365, 'exp': 1606607485, 'iss': 'https://192.168.1.30/auth', 'aud': ['mnode_api', 'mnode_credential'], 'client_id': 'hci-monitor', 'iat': 1606607365, 'jti': 'YECZS3fkjxfpPx38gofKlg', 'scope': ['mnode_api:r', 'mnode_credential:r']}\n",
	"stream": "stderr",
	"time": "2020-11-28T23:49:25.684342722Z",
	"beat": {
		"hostname": "59e98457dadf",
		"version": "6.2.3",
		"name": "59e98457dadf"
	}
}
```
