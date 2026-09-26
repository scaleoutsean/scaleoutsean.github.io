# Quickly install NetApp Trident v24.02 on ARM64 Kubernetes

Quick installation of NetApp Trident v24.02 for ARM64 from pre-built images

## Here we go again...

I started building Trident for ARM64 [years ago](/2021/02/24/netapp-trident-on-arm64.html), before it was a thing. 

Because it wasn't convenient and I disliked the process (or the documentation - in any case, it wasn't a good experience), I even started maintaining a patched no-brainer fork repository and published Trident container images for almost two years.

Then in v23.01 ARM64 became officially supported (yay!), so I archived [that repo](https://github.com/scaleoutsean/trident).

It didn't take long to realize that ARM64 is still a 2nd class citizen, so here we go again...

If you're looking for a newer release, it is recommended to check the official documentation because this post may be outdated by then.

## Install NetApp Trident on ARM64 nodes

These instructions are for a quick installation of NetApp Trident v24.02 on ARM64-only clusters. If you have a mixed cluster, refer to the official docs or see the README.md in my archived repo for ideas on how to deal with that.

Download and decompress [trident-installer](https://github.com/NetApp/trident/releases/).

In the past I'd post tridentctl for ARM64 to my Trident repo, but now the repo is archived (nothing can be posted) so I'm back to explaining this again:

- If you want to build Trident on ARM64, get the Trident source code, from which you can build tridentctl for ARM64. Presumably you don't want this and you're reading this post because you want something done quickly. Read on..
- Since you want to do that quickly, you'd probably want a ready-made tridentctl for ARM64, which I now can't post to that archived repo. For ARM64, extract it from my Docker Hub image for ARM64 or download here:
  - [tridentctl v24.02 for ARM64](https://pub-b36e83914b354d7d9986e006905799c0.r2.dev/tridentctl-v24.02) (SHA256: d4586b6af90511c789b519d90eac5427d1932c191b12b4f409385c0df289493f)
  - tridentctl for x86_64 - it's contained in trident-installer.tar.gz, if you want to generate YAML setup files on x86_64

In the decompressed directory trident-installer generate a custom set of YAML files:

```sh
cd trident-installer
./tridentctl install --generate-custom-yaml
```

If you did that on x86_64, copy the entire trident-installer directory `setup` to your ARM64 system ("myarm"). If you're on ARM64, skip this step.

```sh
cd ..
scp -r ./trident-installer myarm:/tmp/
```

Now SSH to your ARM64 box and first modify these two files as appropriate: setup/trident-daemonset.yml and setup/trident-deployment.yml.

See my archived repository above for the details, but it's basically about the following:

- Remove NetApp autosupport from your deployment
- Remove AMD64 mentions to avoid any screwups with AMD64
- Set Trident image(s) to your repo if you built Trident by yourself. Or use my images from Docker Hub (see YAML files below)

```sh
cd /tmp/trident-installer
# vim setup/trident-daemonset.yml
# vim setup/trident-deployment.yml
```

If you wish you can copy these two files over the same files in your setup directory, and see if that works for you.

- setup/trident-daemonset.yml

```yaml
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: trident-node-linux
  labels:
    kubectl.kubernetes.io/default-container: trident-main
    app: node.csi.trident.netapp.io
spec:
  selector:
    matchLabels:
      app: node.csi.trident.netapp.io
  template:
    metadata:
      labels:
        app: node.csi.trident.netapp.io
    spec:
      serviceAccount: trident-node-linux
      hostNetwork: true
      hostIPC: true
      hostPID: true
      dnsPolicy: ClusterFirstWithHostNet
      priorityClassName: system-node-critical
      containers:
      - name: trident-main
        securityContext:
          privileged: true
          allowPrivilegeEscalation: true
          capabilities:
            drop:
            - all
            add:
            - SYS_ADMIN
        image: scaleoutsean/trident-arm64:v24.02
        imagePullPolicy: IfNotPresent
        command:
        - /trident_orchestrator
        args:
        - "--no_persistence"
        - "--k8s_pod"
        - "--rest=false"
        - "--csi_node_name=$(KUBE_NODE_NAME)"
        - "--csi_endpoint=$(CSI_ENDPOINT)"
        - "--csi_role=node"
        - "--log_format=text"
        - "--log_level=info"
        - "--log_workflows="
        - "--log_layers="
        - "--disable_audit_log=true"
        - "--http_request_timeout=1m30s"
        - "--https_rest"
        - "--https_port=17546"
        - "--enable_force_detach=false"
        - "--iscsi_self_healing_interval=5m0s"
        - "--iscsi_self_healing_wait_time=7m0s"
        #- -debug
        startupProbe:
          httpGet:
            path: /liveness
            scheme: HTTPS
            port: 17546
          failureThreshold: 5
          timeoutSeconds: 1
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /liveness
            scheme: HTTPS
            port: 17546
          failureThreshold: 3
          timeoutSeconds: 1
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readiness
            scheme: HTTPS
            port: 17546
          failureThreshold: 5
          initialDelaySeconds: 10
          periodSeconds: 10
        env:
        - name: KUBE_NODE_NAME
          valueFrom:
            fieldRef:
              apiVersion: v1
              fieldPath: spec.nodeName
        - name: KUBELET_DIR
          value: /var/lib/kubelet
        - name: CSI_ENDPOINT
          value: unix://plugin/csi.sock
        - name: PATH
          value: /netapp:/bin
        volumeMounts:
        - name: plugin-dir
          mountPath: /plugin
        - name: plugins-mount-dir
          mountPath: /var/lib/kubelet/plugins
          mountPropagation: "Bidirectional"
        - name: pods-mount-dir
          mountPath: /var/lib/kubelet/pods
          mountPropagation: "Bidirectional"
        - name: dev-dir
          mountPath: /dev
        - name: sys-dir
          mountPath: /sys
        - name: host-dir
          mountPath: /host
          mountPropagation: "Bidirectional"
        - name: trident-tracking-dir
          mountPath: /var/lib/trident/tracking
          mountPropagation: "Bidirectional"
        - name: certs
          mountPath: /certs
          readOnly: true
      - name: driver-registrar
        image: registry.k8s.io/sig-storage/csi-node-driver-registrar:v2.10.0
        imagePullPolicy: IfNotPresent
        args:
        - "--v=2"
        - "--csi-address=$(ADDRESS)"
        - "--kubelet-registration-path=$(REGISTRATION_PATH)"
        env:
        - name: ADDRESS
          value: /plugin/csi.sock
        - name: REGISTRATION_PATH
          value: "/var/lib/kubelet/plugins/csi.trident.netapp.io/csi.sock"
        - name: KUBE_NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        volumeMounts:
        - name: plugin-dir
          mountPath: /plugin
        - name: registration-dir
          mountPath: /registration
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: kubernetes.io/arch
                    operator: In
                    values:
                    - arm64
                  - key: kubernetes.io/os
                    operator: In
                    values:
                    - linux
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app
                    operator: In
                    values:
                      - node.csi.trident.netapp.io
              topologyKey: kubernetes.io/hostname
      tolerations:
      - effect: "NoExecute"
        operator: "Exists"
      - effect: "NoSchedule"
        operator: "Exists"
      volumes:
      - name: plugin-dir
        hostPath:
          path: /var/lib/kubelet/plugins/csi.trident.netapp.io/
          type: DirectoryOrCreate
      - name: registration-dir
        hostPath:
          path: /var/lib/kubelet/plugins_registry/
          type: Directory
      - name: plugins-mount-dir
        hostPath:
          path: /var/lib/kubelet/plugins
          type: DirectoryOrCreate
      - name: pods-mount-dir
        hostPath:
          path: /var/lib/kubelet/pods
          type: DirectoryOrCreate
      - name: dev-dir
        hostPath:
          path: /dev
          type: Directory
      - name: sys-dir
        hostPath:
          path: /sys
          type: Directory
      - name: host-dir
        hostPath:
          path: /
          type: Directory
      - name: trident-tracking-dir
        hostPath:
          path: /var/lib/trident/tracking
          type: DirectoryOrCreate
      - name: certs
        projected:
          sources:
          - secret:
              name: trident-csi
          - secret:
              name: trident-encryption-keys

```

- setup/trident-deployment.yaml

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trident-controller
  labels:
    app: controller.csi.trident.netapp.io
    kubectl.kubernetes.io/default-container: trident-main
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: controller.csi.trident.netapp.io
  template:
    metadata:
      labels:
        app: controller.csi.trident.netapp.io
        
    spec:
      serviceAccount: trident-controller
      containers:
      - name: trident-main
        image: scaleoutsean/trident-arm64:v24.02
        imagePullPolicy: IfNotPresent
        securityContext:
          runAsNonRoot: false
          capabilities:
            drop:
            - all
        ports:
        - containerPort: 8443
        - containerPort: 8001
        command:
        - /trident_orchestrator
        args:
        - "--crd_persistence"
        - "--k8s_pod"
        - "--https_rest"
        - "--https_port=8443"
        - "--csi_node_name=$(KUBE_NODE_NAME)"
        - "--csi_endpoint=$(CSI_ENDPOINT)"
        - "--csi_role=controller"
        - "--log_format=text"
        - "--log_level=info"
        - "--log_workflows="
        - "--log_layers="
        - "--disable_audit_log=true"
        - "--address=127.0.0.1"
        - "--http_request_timeout=1m30s"
        - "--enable_force_detach=false"
        - "--metrics"
        
        #- -debug
        livenessProbe:
          exec:
            command:
            - tridentctl
            - -s
            - "127.0.0.1:8000"
            - version
          failureThreshold: 2
          initialDelaySeconds: 120
          periodSeconds: 120
          timeoutSeconds: 90
        env:
        - name: KUBE_NODE_NAME
          valueFrom:
            fieldRef:
              apiVersion: v1
              fieldPath: spec.nodeName
        - name: CSI_ENDPOINT
          value: unix://plugin/csi.sock
        - name: TRIDENT_SERVER
          value: "127.0.0.1:8000"
        
        volumeMounts:
        - name: socket-dir
          mountPath: /plugin
        - name: certs
          mountPath: /certs
          readOnly: true
        
      - name: csi-provisioner
        image: registry.k8s.io/sig-storage/csi-provisioner:v4.0.0
        imagePullPolicy: IfNotPresent
        securityContext:
          capabilities:
            drop:
            - all
        args:
        - "--v=2"
        - "--timeout=600s"
        - "--csi-address=$(ADDRESS)"
        - "--retry-interval-start=8s"
        - "--retry-interval-max=30s"
        
        env:
        - name: ADDRESS
          value: /var/lib/csi/sockets/pluginproxy/csi.sock
        volumeMounts:
        - name: socket-dir
          mountPath: /var/lib/csi/sockets/pluginproxy/
      - name: csi-attacher
        image: registry.k8s.io/sig-storage/csi-attacher:v4.5.0
        imagePullPolicy: IfNotPresent
        securityContext:
          capabilities:
            drop:
            - all
        args:
        - "--v=2"
        - "--timeout=60s"
        - "--retry-interval-start=10s"
        - "--csi-address=$(ADDRESS)"
        env:
        - name: ADDRESS
          value: /var/lib/csi/sockets/pluginproxy/csi.sock
        volumeMounts:
        - name: socket-dir
          mountPath: /var/lib/csi/sockets/pluginproxy/
      - name: csi-resizer
        image: registry.k8s.io/sig-storage/csi-resizer:v1.9.3
        imagePullPolicy: IfNotPresent
        args:
        - "--v=2"
        - "--timeout=300s"
        - "--csi-address=$(ADDRESS)"
        env:
        - name: ADDRESS
          value: /var/lib/csi/sockets/pluginproxy/csi.sock
        volumeMounts:
        - name: socket-dir
          mountPath: /var/lib/csi/sockets/pluginproxy/
      - name: csi-snapshotter
        image: registry.k8s.io/sig-storage/csi-snapshotter:v6.3.3
        imagePullPolicy: IfNotPresent
        securityContext:
          capabilities:
            drop:
            - all
        args:
        - "--v=2"
        - "--timeout=300s"
        - "--csi-address=$(ADDRESS)"
        env:
        - name: ADDRESS
          value: /var/lib/csi/sockets/pluginproxy/csi.sock
        volumeMounts:
        - name: socket-dir
          mountPath: /var/lib/csi/sockets/pluginproxy/
      
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: kubernetes.io/arch
                    operator: In
                    values:
                    - arm64
                  - key: kubernetes.io/os
                    operator: In
                    values:
                    - linux
      tolerations: []
      volumes:
      - name: socket-dir
        emptyDir:
      - name: certs
        projected:
          sources:
          - secret:
              name: trident-csi
          - secret:
              name: trident-encryption-keys

```

Finally, create the namespace `trident` in Kubernetes and install.

```sh
kubectl create ns trident
./tridentctl install --use-custom-yaml -n trident
```

## Software stack

Trident can work with any Kubernetes that supports CSI provisioners. See the Trident documentation for more.

My environment:

- Ubuntu 22.04 LTS on ARM64
- Docker 24.0.7
- Kubernetes v1.28.3
- NetApp Astra Trident v24.02 for ARM64

```raw
# Pre-built Trident v24.02 for ARM64
docker image pull scaleoutsean/trident-arm64:v24.02
docker image pull scaleoutsean/trident-operator:v24.02
# Pre-built tridentctl v24.02 for ARM64
# SHA256: d4586b6af90511c789b519d90eac5427d1932c191b12b4f409385c0df289493f
wget https://pub-b36e83914b354d7d9986e006905799c0.r2.dev/tridentctl-v24.02

```

As always, you're encouraged to build your own images from the upstream source.

I hope this saved you some time and frustration.
