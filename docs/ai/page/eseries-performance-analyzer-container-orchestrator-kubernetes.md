# NetApp E-Series Performance Analyzer in container environments

Deploy and run E-Series Performance Analyzer on Kubernetes and Hashicorp Nomad

## EPA on Kubernetes and Nomad is here

It took some time to find the time... But it's almost ready now: in EPA 3.1.0, E-Series metrics collector is completely disentangled from InfluxDB management and operation, and can run on its own (in a shell, Docker, Kubernetes, Nomad).

I'm still working on instructions for Kubernetes, but exiting EPA 3.1.0 can be deployed to Kubernetes or Nomad today because the containers are already ready and work without any changes.

The disentangled EPA looks like this:

![EPA Diagram](/assets/images/epa-eseries-perf-analyzer.png)

dbmanager only pushes a list of array names to InfluxDB. It does not connect to E-Series, or have any other details about the storage.

The E-Series admin just needs to have their array name added to dbmanager config, and their collector IP or FQDN added to the list of IPs allowed to access InfluxDB 8086/tcp. Array details, including credentials, do not need to be shared with the Influx or Grafana administrator(s).

Because collector does not need to use storage admin credentials, SANtricity admin credentials can be rotated without changing collector configuration.

In this example we have:

- one Grafana instance
- one InfluxDB instance
- one dbmanager periodically pushing list of array names to InfluxDB
- two collectors gathering metrics for two E-Series arrays

![EPA in action on Kubernetes 1.25](/assets/images/epa-eseries-perf-analyzer-kubernetes-nomad.png)

This test was done on the (currently) latest Minikube on Rocky Linux 9.

### Kubernetes

Once detailed Kubernetes instructions are ready, version 3.2.0 will be released. Until then you can build and deploy containers to Kubernetes on your own.

### Nomad

I won't delay 3.2.0 until detailed instructions for Nomad are ready. Why?

Because they aren't necessary. Nomad is easy to use, and for collector it's even more suitable than Kubernetes (because it's easier to use and has all the features collector needs) or Docker Compose (I say this because it has HA features which Docker Compose does not).

## What's next for EPA

Version 3 seems now complete to me. The code I added for SSD Wear Level shows I'm not a Python expert and could be moved to its own function, but other than that I don't see much wrong with it. "Folder"-related stuff from the time WSP was used was completely removed from collector, and I think having another container (dbmanager) is a nice approach to create InfluxDB folders and serve as the location for generic "database manager" features if new back-ends are added.

I've no plans for the future. It depends what I find intresting in course of my work: if I see opportunities to add something valuable, I'll try.

Objectively speaking, it would be helpful to upgrade InfluxDB to v2, which means changes in collector, and Grafana queries and dashboards would have to be done from scratch.

I don't want to create and maintain Grafana dashboards - I think that should be done by the users - so I'm considering adding another DB back-end so that InfluxDB v1 remains in place, but another DB gets added as an option.

As far as database back-ends for EPA are concerned InfluxDB v1 is good enough, so I'm entertaining the possibility of adding Elasticsearch. The reason is I don't need a better database for EPA data (than InfluxDB), but I'd like to have the option to search for [E-Series failures and events](/2022/12/13/eseries-santricity-mel-forwarding.html), and use Kibana as the UI for that.

And not only that:

- In BeeGFS with E-Series environments, Elasticsearch could also collect (and corelate) logs for OS and BeeGFS
- Environments without DB admins could send data to Elastic Cloud and maybe even Instaclustr's OpenSearch 

The challenge for the second item is OpenSearch and Elasticsearch APIs have been diverging. Personally, I prefer Elasticsearch, but OpenSearch users are welcome to submit pull requests at any time. Ideally I'd like to have the option of back-end selection (InfluxDB, OpenSearch/Elasticsearch, or both) in collector, and dbmanager would contain the code that interfaces with OpenSearch/Elasticsearch.

As of EPA 3.1.0 InfluxDB management is still done in collector because it makes no (significant) difference - the only disadvantage is that any of the collector users can destroy (drop) the InfluxDB, but an assumption EPA inherited from upstream is that all collectors are implicitly trusted. If another back-end becomes available I'd like to have DB-management code moved to dbmanager.

I am not going to improve that in version 3 because InfluxDB data isn't mission-critical, and it's not the only thing that needs to be improved security-wise: there's also a matter of RBAC (dbmanager vs. collector), read (Grafana) and write (collector, dbmanager) separation, TLS certificates, and more. None of that is currently taken care of by default (users may create additional, read-only InfluxDB account for Grafana and such and my Kubernetes notes show how). 

But any new back-end should be reasonably secure by default from day one.

## Resources

- Download [EPA v3.2.0](https://github.com/scaleoutsean/eseries-perf-analyzer/releases/tag/v3.2.0)
- Demo of deploying and configuring [EPA v3.2.0 on Kubernetes](https://rumble.com/v28mh6w-netapp-e-series-performance-analyzer-epa-v3.2.0-for-kubernetes.html) (4m44s)
- Demo of deploying and configuring [EPA v3.1.0 on Kubernetes](https://rumble.com/v25nep8-e-series-performance-analyzer-3.1.0-on-kubernetes.html) (3m16s)
- [E-Series Performance Analyzer](https://github.com/scaleoutsean/eseries-perf-analyzer) on Github
