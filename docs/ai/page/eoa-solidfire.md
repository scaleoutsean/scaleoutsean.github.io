# End of Availability for SolidFire

SolidFire EOA announcement

This week NetApp released product communique [CPC-00467](https://mysupport.netapp.com/info/communications/ECMLP2884466.html) (NetApp support portal login required) on end of availability of SolidFire.

EOA is isn't going to happen immediately so, similarly to NetApp HCI, there's ample time for users to refresh existing hardware if they want to, and continue using their SolidFire cluster(s).

In my opinion SolidFire is the best block storage NetApp has to offer for virtualized and containerized on-premise workloads of small and medium size, and despite lacking certain features it will remain useful for years to come - especially to users who use it in non-vSphere environments and hence have no dependency on a closed source plug-ins (such as Element Plug-in for vSphere).

## Cluster expansion and shrinkage and node refresh options for SolidFire users

Short "tips":

- Consider the minimum supported cluster size is 4 
- No node can have more than 1/3 of cluster capacity
- Try to co-term support/maintenance of the remaining nodes to not end up with 3 nodes that are good for production but can't form a cluster
- Consider performance and capacity shrinkage when consolidating by removing older nodes. If you have no choice, consider evacuating some data with VMware Storage vMotion or other methods

Some examples:

- The minimum cluster size is 4 nodes. If you have a cluster that consists of older and newer SolidFire nodes, and older nodes are going to hit End of Hardware Support, you'll have to "shrink" your cluster in order to have a cluster that consists of supported nodes. In this situation, you may have two challenges
  - Newer nodes are less than four, so you cannot remove older nodes as node count would drop to 3 or less
  - One of the newer nodes has more capacity than 33.33% of the cluster if older nodes are removed. For example, let's say you have 10 older and 4 newer nodes, and in the latter group 2 are big and 2 are small. If you were to remove 10 older nodes, one of two big nodes would have more than 33.33% of remaining cluster capacity
- Another challenge is mixed support life-time. If you have four nodes that will hit End of Hardware Support in 2 years, and three nodes in 5 years, what may happen is 2 years from now you can't buy new nodes, but you can't remove old nodes either because cluster size would be 3 nodes, which isn't supported (although it's technically functional)
  - One way to deal with this is to buy 1 "like" node before End of Sale (late 2023), to get the number of newer nodes to 4 and have them all the same size. You'd lose capacity by removing older nodes, but you'd have a 4 node cluster that can run for 4 additional years (i.e. End of Hardware Support for the second group of nodes meanwhile drops from 5 to 4 years). The newest node, bought in 2022 or 2023, can be purchased with 4 year software subscription and hardware maintenance (as it can't run on its own). One thing to consider here is your capacity may considerably shrink (depending on the count and capacity of the nodes removed in the first batch)
  - Another way is to buy four or more largest nodes before End of Sale. This is the same as previous bullet, but can help you avoid capacity shrinkage. You'd also have to consider performance shrinkage, but the same logic applies

Other alternatives include non-SolidFire alternatives such as migration to E-Series or ONTAP or to the cloud, either partially or fully.

## Useful NetApp KB articles

Support login is required:

- [Software upgrade matrix for SolidFire clusters](https://kb.netapp.com/Advice_and_Troubleshooting/Data_Storage_Software/Element_Software/What_is_the_upgrade_matrix_for_storage_clusters_running_NetApp_Element_software) - shows which version may be upgraded to which version 
- [End of Availability for older SolidFire nodes](https://mysupport.netapp.com/info/communications/ECMLP2847476.html) - if you have SF4805, SF9605, SF19210, SF38410, and SF-FCN-01. Amazingly, some of these (e.g. SF1920) can still run the latest OS, SolidFire 12.5
