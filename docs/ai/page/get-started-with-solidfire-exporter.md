# Get started with solidfire-exporter

SolidFire metrics for Kubernetes and other clusters

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

In yesterday's [post](https://scaleoutsean.github.io/2021/03/08/hcicollector-v0.7.html) about HCICollector v0.7 I mentioned [solidfire-exporter](https://github.com/mjavier2k/solidfire-exporter).

Here's how to get started with it without Kubernetes and Docker in under 2 minutes. 

You can read the project's README file to the same effect, but in coming weeks I'll expand this post to cover more than just how to get started so I'll start with the basics and update the post later.

## Get started

Assuming you'll run both Prometheus and `solidfire-exporter` on your client, you can use 127.0.0.1 for both apps (i.e. listen address of solidfire-exporter and Web UI of Prometheus). My SolidFire management IP is 192.168.1.30 and I have version 12.2 (you may set this to 11.0 if on v11).

- config.yaml for solidfire-exporter:

```raw
listen:
  address: 127.0.0.1:9987
client:
  endpoint: https://192.168.1.30/json-rpc/12.2
  username: admin
  password: admin
  insecure: true
  timeout: 30
```

Download, decompress (if you downloaded the compressed binary) and run `solidfire-exporter` on your client. I built mine from source (I'm happy to report that it appears to works fine on AMD64 as well as ARM64).

```sh
# chmod 700 solidfire-exporter
./solidfire-exporter -c=config.yaml
```

Open another terminal session for Prometheus.

Download and decompress Prometheus, `cd` to decompressed directory and either replace the pre-created prometheus.yml or create a new one (in its place or elsewhere, just remember to tell Prometheus where it is):

```raw
# my global config
global:
  scrape_interval:     60s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
  evaluation_interval: 60s # Evaluate rules every 15 seconds. The default is every 1 minute.

# Alertmanager configuration
alerting:
  alertmanagers:
  - static_configs:
    - targets:
      # - alertmanager:9093

# A scrape configuration containing exactly one endpoint to scrape:
# Here it's Prometheus itself.
scrape_configs:
  # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
  - job_name: 'prometheus'

    # metrics_path defaults to '/metrics'
    # scheme defaults to 'http'.

    static_configs:
    - targets: ['localhost:9090','127.0.0.1:9987']
```

Note that I have two targets, one (9090) is Prometheus itself, the second one (127.0.0.1:9987) is my solidfire-exporter running on the same system.

Note that I set scrape and evaluation interval to 60 seconds. It doesn't make much sense to fetch SolidFire metrics every 10 seconds. You can, of course.

Start Prometheus by telling it where your config file is and where to listen (use 0.0.0.0:9090 for all interfaces). I didn't change directory so my prometheus file is outside of the decompressed Prometheus tree.

```sh
# chmod 700 /prometheus-2.25.0.linux-arm64/prometheus
./prometheus-2.25.0.linux-arm64/prometheus --config.file="prometheus.yml" --web.listen-address="127.0.0.1:9090"
```

Start up your browser and go to http://127.0.0.1:9090. JFGI for the rest.
