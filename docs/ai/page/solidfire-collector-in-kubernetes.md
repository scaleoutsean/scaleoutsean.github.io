# SolidFire Collector on Kubernetes

How to run SolidFire Collector in a Kubernetes environment

- [What is SFC](#what-is-sfc)
- [Making SolidFire Collector work with Kubernetes](#making-solidfire-collector-work-with-kubernetes)
- [Appendix: Deploymennt for SFC and Graphite](#appendix-deploymennt-for-sfc-and-graphite)

## What is SFC

Some SolidFire users may have heard of SolidFire Collector, a monitoring tool for SolidFire-based arrays which, after the launch of NetApp HCI, became HCI Collector and added vSphere monitoring.

I made one moderately significant update to it ([v0.7](/2021/03/08/hcicollector-v0.7.html)) with the idea to make it easier to remove vSphere and focus on the original SolidFire-focused metrics collection. But in mid and late 2021 I worked out reasonably detailed templates for observation with [ElasticSearch](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html) and SNMP, and the SolidFire Exporter guys did a great job and the need to do something with SolidFire Collector became much less pressing - it's now considered a solved problem.

Still, I think it's nice to have a lightweight monitor that's easy to customize, so I've been looking for an opportunity to continue improving SolidFire Collector. Here's what I have on mind:

- Create SolidFire Collector container that's easier to use than in v0.7 (done today)
- Collect less, but better - get few key metrics and add computed ("analytics") metrics - there's no need to gather the same data that SolidFire Exporter gathers so well (to do)
- Use better scheduling (50% done) and smarter metrics-gathering that collects different metrics at different intervals (to do)
- Make it more container friendly (done today)

## Making SolidFire Collector work with Kubernetes

There aren't many strict requirements to get SFC up and running: it needs to be able to get to SolidFire MVIP and send collected data to Graphite. That's it.

![SFC in a Kubernetes envronment](/assets/images/sfc-k8s-diagram.png)

Here's a simpler example to get started:

|  Service   |  IP            | Note                            |
|  :---      |  ---           | :---                            |
|  SFC       | 192.168.1.12   | Docker, outside of Kubernetes   |
|  Graphite  | 192.168.105.224| Kubernetes service (External IP)|
|  Grafana   | 192.168.105.225| Kubernetes service (External IP)|

SFC can run anywhere, but I haven't crated Kubernetes YAML file for it yet, so I simply run this from Docker.

```sh
docker run -it --name sfc \
  docker.io/scaleoutsean/sfc:v0.7 \
  -s 192.168.1.30 \
  -u sfc -p **** \
  -g 192.168.105.224
```

- `scaleoutsean/sfc:v0.7` is a new SFC container, but features-wise the same as SFC from HCI Collector v0.7
- `-s`: SolidFire MVIP
- `-u`: SolidFire read-only cluster admin (here: sfc)
- `-p`: SolidFire read-only cluster admin's password (here: masked)
- `-g`: Graphite target (IPv4 address, FQDN (TLS), or `debug` for debugging)
- `-h`: when used without other arguments, it shows available arguments and their default values

Graphite and Grafana are based on unmodified, stock deployment YAMLs that you can get from the Internet. Grafana has 1 PVC (grafana-pvc), whereas Graphite does not (but it could, it's up to you). If you already have Grafana and need just Graphite, then deploy only Graphite.

I used default deployment YAML samples and made Graphite and Grafana use the same namespace (sfc).

![SFC Namespace](/assets/images/sfc-k8s-sfc-namespace-deployments.png)

```sh
$ kubectl get service -n sfc
NAME       TYPE           CLUSTER-IP      EXTERNAL-IP       PORT(S)                       AGE
graphite   LoadBalancer   10.97.179.148   192.168.105.224   80:30541/TCP,2003:30016/TCP   90s

$ kubectl apply -f grafana.yaml -n sfc
persistentvolumeclaim/grafana-pvc created
deployment.apps/grafana created
service/grafana created

$ kubectl get pods -n sfc
NAME                        READY   STATUS    RESTARTS   AGE
grafana-58d576f784-hsd9v    1/1     Running   0          114m
graphite-5cd9765bb4-xzwhp   1/1     Running   0          116m

$ kubectl get service -n sfc
NAME       TYPE           CLUSTER-IP      EXTERNAL-IP       PORT(S)                       AGE
grafana    LoadBalancer   10.108.184.8    192.168.105.225   3000:32112/TCP                4s
graphite   LoadBalancer   10.97.179.148   192.168.105.224   80:30541/TCP,2003:30016/TCP   2m5s
```

In this setup SFC sends metrics to the default TCP port (2003) of Graphite receiver because that's what is exposed by default. If SFC was able to get to SolidFire MVIP and run in same Kubernetes namespace as Graphite, we may not need External IP for Graphite unless there are other Graphite clients and you don't want to run multiple Graphite Pods.

At the top of Graphite chart the little green dash lines show metrics (gathered once a minute). The cluster happens to be idling so the chart shows only some non-zero metrics.

![SFC to Graphite](/assets/images/sfc-k8s-to-graphite.png)

In Grafana, if you have no Graphite source, add it. My Grafana and Graphite run in the same namespace so I added it by CLUSTER-IP (10.97.179.148), but we could use service name instead.

![Grafana panel from Graphite source](/assets/images/sfc-k8s-grafana-to-graphite.png)

Now we can create Grafana panels and dashboards:

![Add Graphite source to Grafana](/assets/images/sfc-k8s-grafana-panel.png)

Because SFC v0.7 is based on HCI Collector v0.7, it seems those dashboards work okay. I tried to import [one of them](https://github.com/scaleoutsean/hcicollector/blob/v0.7/grafana/dashboards/solidfire-node.json) and it seems to work fine. It's a bit empty because I use SF Demo VM (single node SF cluster, as opposed to four or more nodes that SolidFire clusters have).

![Dashboard from HCI Collector v0.7](/assets/images/sfc-k8s-grafana-dashboard-node.png)

## Appendix: Deploymennt for SFC and Graphite

As I later published the container to Docker Hub, to test it I modified the Graphite deployment by adding SFC to it (the section with second container image). You may still need to adjust the rest for your environment. Or create a new deployment if you want to run SFC in its own location.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
 labels:
   app: graphite
 name: graphite
spec:
 replicas: 1
 selector:
   matchLabels:
     app: graphite
 template:
   metadata:
     labels:
       app: graphite
   spec:
     containers:
     - image: graphiteapp/graphite-statsd
       name: graphite
       ports:
       - containerPort: 2003
         name: carbon-plain     
       - containerPort: 2004
         name: carbon-pkl   
       - containerPort: 2023
         name: carbon-ag-plain
       - containerPort: 2024
         name: carbon-ag-pkl   
       - containerPort: 8125
         name: statsd   
       - containerPort: 8126
         name: statsd-admin  
       - containerPort: 80
         name: http       
     - image: docker.io/scaleoutsean/sfc:v0.7
       name: sfc
       args: [ "-s", "$(SF_MVIP)", "-u", "$(SF_RO_ADMIN)", "-p", "$(SF_RO_ADMIN_PASS)", "-g", "$(GRAPHITE_TARGET)" ]
       env:
         - name: SF_MVIP
           value: "192.168.1.30"
         - name: SF_RO_ADMIN
           value: "sfc"
         - name: SF_RO_ADMIN_PASS
           value: "*****"
         - name: GRAPHITE_TARGET
           value: "localhost"
---
apiVersion: v1
kind: Service
metadata:
 name: graphite
 labels:
   app: graphite
spec:
 type: LoadBalancer
 ports:
 - port: 80
   protocol: TCP
   targetPort: 80
   name: http
 - port: 2003
   protocol: TCP
   targetPort: 2003
   name: carbon
 selector:
   app: graphite

```

This results in two containers in Graphite deployment, the second of which is SolidFire Collector v0.7 (not exposed over network).

```sh
$ kubectl get pods -n sfc
NAME                        READY   STATUS    RESTARTS   AGE
grafana-58d576f784-hsd9v    1/1     Running   0          4h14m
graphite-567db8c9cd-qqggq   2/2     Running   0          83m

$ kubectl describe pod graphite-567db8c9cd-qqggq -n sfc
Name:         graphite-567db8c9cd-qqggq
Namespace:    sfc
Priority:     0
Node:         k8s-n-1/192.168.105.12
Start Time:   Mon, 02 May 2022 08:59:13 +0000
Labels:       app=graphite
              pod-template-hash=567db8c9cd
Annotations:  cni.projectcalico.org/podIP: 192.168.122.51/32
              cni.projectcalico.org/podIPs: 192.168.122.51/32
Status:       Running
IP:           192.168.122.51
IPs:
  IP:           192.168.122.51
Controlled By:  ReplicaSet/graphite-567db8c9cd
Containers:
  graphite:
    Container ID:   containerd://132e49d9cda8b89b409167cc64572034d67bc2de980f2347e6ef872561b0f12d
    Image:          graphiteapp/graphite-statsd
    Image ID:       docker.io/graphiteapp/graphite-statsd@sha256:90e51b3610ac6b354ca28c15594bac1b0899e777e0616b95a5a5d23455829291
    Ports:          2003/TCP, 2004/TCP, 2023/TCP, 2024/TCP, 8125/TCP, 8126/TCP, 80/TCP
    Host Ports:     0/TCP, 0/TCP, 0/TCP, 0/TCP, 0/TCP, 0/TCP, 0/TCP
    State:          Running
      Started:      Mon, 02 May 2022 08:59:15 +0000
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-5ndd7 (ro)
  sfc:
    Container ID:  containerd://bbacbebffcbd188c5d417d63ab4a038ba2ee7c47885545c9d3076d172f8eaf2f
    Image:         docker.io/scaleoutsean/sfc:v0.7
    Image ID:      docker.io/scaleoutsean/sfc@sha256:7a48df638949a6db57e2e45e03778ee30a2f46adbcd457fd0607282f986eb31e
...
```
