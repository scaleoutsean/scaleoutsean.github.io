# Check Active IQ connectivity from HCC on SolidFire mNode

Check connectivity to Active IQ from HCC on SolidFire mNode

One annoyance with Active IQ connectivity from Hybrid Cloud Control for SolidFire/NetApp HCI/eSDS is that it's not easy to tell what's going on with it when it doesn't work.

This post is about some basic steps to check its status.

First we check if the container is up and running.

```sh
$ sudo docker ps -a
CONTAINER ID        IMAGE
612e2da2a12f        mnode-svc-aiq-collector:1.7.1
```

Then we can use HCC's Swagger or - simpler and faster - `sudo docker logs ${CONTAINERID}` to see if there are any obvious errors.

```sh
$ sudo docker logs 612e2da2a12f
Mar 11 2022 07:48:59.214 INFO log level set to INFO
Mar 11 2022 07:48:59.215 INFO Attempting to retrieve auth token...
/tmp/_MEIfmppJL/urllib3/connectionpool.py:1020: InsecureRequestWarning: Unverified HTTPS request is being made to host '192.168.1.34'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#ssl-warnings
Mar 11 2022 07:48:59.258 INFO Token received from auth service.
Mar 11 2022 07:48:59.259 INFO Attempting to retrieve asset information...
Mar 11 2022 07:48:59.275 INFO Asset information retrieved from mnode-api service.
Mar 11 2022 07:48:59.275 INFO Attempting to retrieve mnode settings...
Mar 11 2022 07:48:59.371 INFO Mnode settings retrieved from mnode-api service.
Mar 11 2022 07:48:59.378 INFO Starting collector(s) for mnode
Mar 11 2022 07:48:59.378 INFO Starting collector for mnode storage_id=274fb77d-5faa-4530-a713-e24209bbacc5
Mar 11 2022 07:49:00.716 INFO ListClusterFaults summary : 5 of 5 faults are new, unresolved, or newly resolved
```

The problem with this is INFO log level doesn't give much useful information.

Has it connected to an Active IQ API endpoint? Has it sent any payload (even with INFO level, that should appear every 10 minutes)? Nothing. 

It might be helpful in the case of major problems such as a proxy trying to MITM your outgoing connection. But in this case not much can be glanced from logs. I looked through the documentation on how to enable DEBUG log level, but could not find that information. So it's time to move on.

With that container ID we can do some additional checking.

We can enter the container and check its connections.

```sh
$ sudo docker exec -it 612e2da2a12f /bin/ash
# netstat 
Active Internet connections (w/o servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       
tcp        1      0 612e2da2a12f:41736      10.0.0.40:http          CLOSE_WAIT  
tcp        0      0 169.254.104.28:58326    ec2-44-239-179-120.us-west-2.compute.amazonaws.com:https ESTABLISHED 
tcp        1      0 612e2da2a12f:60332      10.0.0.20:http          CLOSE_WAIT  
tcp       70      0 169.254.104.28:56100    sfdr.datafabric.lab:https CLOSE_WAIT  
tcp        0      0 169.254.104.28:58118    sfdr.datafabric.lab:https TIME_WAIT   
Active UNIX domain sockets (w/o servers)
Proto RefCnt Flags       Type       State         I-Node Path
```

All right, so there's a connection to EC2 (IPv4: 44.239...). Exit the container, and use mNode shell to check if that IP may be AIQ API endpoint:

```sh
$ nslookup monitoring.solidfire.com
Server:		192.168.1.4
Address:	192.168.1.4#53

Non-authoritative answer:
Name:	monitoring.solidfire.com
Address: 52.36.127.139
Name:	monitoring.solidfire.com
Address: 44.239.179.120
```

It looks that way. The second DNS result indicates our container is connected to AIQ via HTTPS and therefore we know it can get out to the Internet and connect to an Active IQ API endpoint.

Also on mNode, see if [Transmit](https://stackoverflow.com/questions/46704745/docker-stat-network-traffic) on eth0 is increasing (as it tries to send data out). First we get Docker's PID for the AIQ collector container and then watch its traffic.

```sh
$ sudo docker inspect 612e2da2a12f | grep '"Pid":'
30756

$ cat /proc/30756/net/dev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo:    1686      20    0    0    0     0          0         0     1686      20    0    0    0     0       0          0
  eth1: 19009170    6125    0   24    0     0          0         0   928784    4524    0    0    0     0       0          0
  eth0:    5146      41    0    0    0     0          0         0     4956      22    0    0    0     0       0          0

$ cat /proc/30756/net/dev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo:    1686      20    0    0    0     0          0         0     1686      20    0    0    0     0       0          0
  eth1: 19013079    6136    0   24    0     0          0         0   931452    4534    0    0    0     0       0          0
  eth0:    5146      41    0    0    0     0          0         0     4956      22    0    0    0     0       0          0

```

eth1 might be used for iSCSI or something, so we'd watch the NIC used for the default route (here, eth0) to see if its Transmit counter is incrementing. It's not, but that may be because the storage is SolidFire Demo VM for which AIQ Collector probably doesn't feed details into AIQ.

I don't know what else can be done to make this easier. Potentially you could use tcpdump on mNode to watch if traffic is going to monitoring.solidfire.com:

```sh
$ sudo tcpdump -i eth0 44.239.179.120
dropped privs to tcpdump
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 96 bytes
...
```

I happen to have this mNode configured with SF Demo VM, so I didn't see anything and I didn't expect it'd be sending anything. But a non-demo setup (eSDS or SolidFire or NetApp HCI) might dump traffic to Active IQ here.
