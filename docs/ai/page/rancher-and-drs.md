# Deploying Rancher Worker VMs to NetApp HCI with VMware VSS

The impact of Virtual Standard Switch on Host Selection

Earlier this week I spotted the advice to not select a VM host when deploying Rancher worker VMs to a vSphere environment where DRS is enabled, because "DRS is smarter than you."

![Select VM Host in a DRS environment](/assets/images/rancher-2-deploy-to-specific-vsphere-host.png)

That's almost certainly true - especially in the mid and long term - but at the moment of deployment you might have an edge.

Situation:

- Five VM hosts with ESXi
- Virtual Standard Switch (VSS) because maybe you don't have vSphere Enterprise Edition
- Rancher VMs are commonly deployed on VM Hosts 1, 2, and 3 so that they don't run all over the place

If you use a Resource Pool and the three hosts are part of it, then it's more likely that DRS will make better decisions over time.

If you do not have a Resource Pool and only Hosts 1, 2 and 3 are connected to networks required by your Rancher workloads, it's probably better to pick one of the hosts and manually redistribute VMs after that (add anti-affinity rules, etc.).

One such situation is where only Hosts 1-3 have networks or allow VLANs that can allow Rancher VMs to get to SolidFire Storage Virtual IP (i.e. iSCSI). 

In a regular NetApp HCI environment only hosts (not VMs) need to get to SolidFire iSCSI IPs (each ESXi has 2 networks for that purpose). With VDS this is easy to apply and maintain over a cluster of hosts, but with VSS it takes some effort and some users may find value in limiting that complexity to only a subset of VM hosts.

If you use VSS and run Rancher on a subset of VM hosts, it's a good idea to create a Resource Pool with these "Rancher" Hosts.
