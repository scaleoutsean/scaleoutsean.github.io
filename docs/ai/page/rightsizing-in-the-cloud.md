# Rightsizing compute resources in the cloud with Spot.io

Why rightsize cloud compute resources with Spot.io by NetApp

Most cloud users know about the various options to rent cloud compute resources.

Hyperscalers provide recommendations or at least cost reports that give the user the information necessary to make better selection and placement decisions. The problem is how to analyze that information - it's too much for spreadsheets, and too little to make decisions about instances and configurations we could be using.

In recent years we've seen several prominent startups have attempted to provide advisory or even proactive services that analyze vast amounts of billing and workload data.

I don't want to make a long pitch on why cloud users should outsource this to a service, and why Spot.io in particular. I'd rather use examples to illustrate why it doesn't make sense to *not* use such services.

Below are some approaches people move on-prem workloads to the cloud, from worst to best.

## Worst

There are many ways to screw things up, but the classic approach is to add up all resources allocated on-prem, say 391 vCPU cores, 1282 GB vRAM, 8128 TB of SSD capacity, and try to get the best deal possible.

This means comitting to buy discounted Reserved Instances, potentialy taking advantage of sign-up credits and whatnot. 

The first issue with this is no one bothers to figure out the minimum (or optimal) amount of resources required. So people usually buy way too much. Or way too little, if they randomly discount vCPUs ("our CPUs are 3 years old, let's buy 391 x 0.8 to save money"), which makes it necessary to buy On-Demand instances at no discount, or more Reserved Instances at a fixed discount (which is probably worse, because it eliminates the possibility for consolidation savings, other improvements or simply redunction in resource requirements).

The second issue is whatever optimization opportunities have existed prior to locking yourself in a 3-year commitment, most will be missed.

## Better

Some users do more technical work while planning migration to the cloud, which makes it possible to right-size resources and avoid significant waste or last-moment emergency top-ups.

vSphere makes this easy to do this for compute resources, but these features are not always used. Why? Because different application teams may want to add "buffer" to whatever reading vSphere shows - "just in case", "it's for year end batch jobs", etc.

Even if done right, it still doesn't solve all challenges related to right-sizing:

- Which instance *types* should you order - 80 x 4 vCPU or 160 x 2 vCPU? 
- Which instance type is cheaper *for given workload*?
- Which workloads can benefit from containerization? We shouldn't want to manage 182 micro VMs if we don't have to.
- Which workloads can benefit *more* from containerization, assuming you don't have time to containerize all of them?
- Which workloads should be moved to hyperscaler-native Kubernetes service? If 64 vCPUs worth of workloads are moved to hyperscaler-native Kubernetes service, it's almost guaranteed that 48 vCPUs will be enough most of time, and 72 vCPUs will be necessary on certain days.

## Best

Spot.io can help you solve most of the problems remaining problems:

- Works with VMs and Kubernetes
- Supports Azure Windows Virtual Desktops (Spot PC)
- Provides workload- *and* application-specific right-sizing for [Apache Spark](https://spot.io/products/ocean-apache-spark/)

It can even help you [offload reserved AWS and Azure instances](https://spot.io/products/eco/) if you have too many of them.

## Doing this well manually is ~~hard~~ impossible

Hyperscalers' billing and performance metrics are very detailed, which makes them useful but at the same time too hard to consume for humans, and evaluating a bunch of workloads and instance choices is not easy.

Sometimes we can't appreciate the challenge of figuring this out until we try it first-hand. Recently I tried to optimize just three workloads that consist of two services each:

- Service A (0.5 vCPU, 1GB vRAM)
- Service B (0.75 vCPU, 2GB vRAM)
- Each of three applications runs one instance of Service A and one instance of Service B
- Two applications are unused and can be stopped from Friday 8pm until Monday 8am

We could just add everything up and run it in a single VM as per below (this is bad, but not the worst way):

- 3 x (0.5 + 0.75) = 3.75 vCPU (rounded up: 4 vCPU)
- 3 x (1 + 2) = 9 GB vRAM (rounded up: 12 GB vRAM)

The worst approach would probably be to create 6 VMs using 2 instance types (1 vCPU each): overprovisoned CPUs and too many VMs (even if OS is free).

This consolidated example I gave (all workloads in one 4 vCPU VM) results in minor waste on a daily basis (3 GB of extra vRAM), but more importantly at least 66% of all resources is wasted every weekend. Take four weekends per month - that's eight days out of 30 (26%), which means 17.6% (26% * 66%) of all spending is wasted before any other optimization.

Although overspending by 18% is not a disaster, this isn't *that* great either. And there are still many shortcomings and challenges:

- need ongoing support for application consolidation - some sort of CI/CD workflow would help
- miss savings from using spot instances
- how to handle concurrent CPU utilization peaks
- miss savings from using optimal VMs (we haven't answered the question *which* instance type is optimal *this* workload)
- need to constantly reevaluate, or else miss capturing savings from downsizing when workload drops, or fail to right-size for increased performance if utilization increases

It's hard enough to do this right for *one* service, let alone for half a dozen applications that involve a bunch of services.

If you do it by hand, you probably waste at least 25-30% of resources.

Folks with containerized workloads running on Kubernetes are better off, but even they need to make choices about instances and Spot.io can make them better.

## Would you like to know more?

Visit [spot.io](https://spot.io/) to find more about the use cases.

The Spot.io documentation can be found at [https://docs.spot.io/](https://docs.spot.io/).
