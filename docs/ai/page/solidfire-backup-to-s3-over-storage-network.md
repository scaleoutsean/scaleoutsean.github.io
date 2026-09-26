# SolidFire Backup to S3 over Storage Network

Get around default routing to Object Store

Normally SolidFire 11 and 12 use Management Network for volume backup. Some users prefer to have backup flow over Storage Network.

To find a workaround I setup a singleton SolidFire Demo VM with a "reversed" IP configuration:

- eth0 (Management Interface) - connect it to iSCSI storage network and assign it an IPv4 from that network
- eth1 (Storage Interface) - connect it to Management Network, and give it an address from that network

I did the above using SolidFire text console.

Next I added a custom route to the network I commonly use for storage (but here for SolidFire management) to be able to get to the node's management IP (MIP). There I reviewed all network-related settings.

![Management Interface on iSCSI Network](/assets/images/solidfire-backup-to-s3-over-storage-network-01.png)

In the same Web console I created a cluster with desired MVIP and SVIP (these are virtual IP addresses for Management and Storage, respectively).

After I was done, iSCSI service was running on network usually used for management and applications, while Management Interface was on an isolated network normally used for iSCSI.

Because that isolated network can't get out to the Internet, at first I was unable to backup a test volume to S3. To get around that I added several custom routes on my Storage Network in SolidFire - for DNS, NTP and S3:

![Custom routes on SolidFire storage interface](/assets/images/solidfire-backup-to-s3-over-storage-network-02.png)

**NOTE:** Most SolidFire nodes have no gateway on Storage Network, but on this cluster I added it anyway. I haven't tried to see if custom routes without IPv4 gateway would work or not.

Add host routes to S3 API endpoint(s) in similar fashion. Now you can got to a SolidFire Node's Management Interface and try System Tests > Test Ping and you should be able to ping one of these hosts, which should be impossible if default route is on a non-routable network (i.e. here it should work which means backup to S3 should work as well).

Now that SolidFire "knew" it should use Storage Network to get to S3, backup to S3 worked:

![Backup to S3 over iSCSI interface](/assets/images/solidfire-backup-to-s3-over-storage-network-03.png)

The S3 bucket where this backup was uploaded:

![Completed backup job to S3 bucket](/assets/images/solidfire-backup-to-s3-over-storage-network-04.png)

Personally I don't like this approach (I'd rather backup over Management interfaces as it's intended to work), but 2x25G iSCSI interfaces on each SolidFire node can help eliminate network bottlenecks (Management Network may be 2x1GigE) so this approach may be helpful when the amount of storage that needs to be backed up is large.
