# NetApp StorageGRID networks

Notes on NetApp StorageGRID networking

## Introduction

Because “security”, I can no longer access my corporate “Web drive” from my personal desktop, which is great if you’re trying to get nothing done.

But every now and then it’s nice to share some product details with a prospect without being annoyed by MFA prompts even if you’re using the “right” device.

I assume we’re not allowed to share corporate content on the Internet, though, so I’d rather create my own.

And then the last big thing is everyone has been posting them mesmerizing animated diagrams lately. If you haven’t shared one on Linkedin, career-wise you should probably be worried. I’m takin’ care of that right now!

## Global load balancer (GLB)

- StorageGRID load balancers are “local”, confined to load-balancing requests originating from the same “site”
- The tricky part in multi-site situations is how to send a request from DC2 to DC2 when DC2 is up, but to DC1 when it’s not
- If you don’t want to employ a poor man’s solution (Pager Duty + DNS updates), you may need a GLB (NetApp doesn’t sell these, get ‘em from some of the validated partners)

![](/assets/images/storagegrid-multisite-01-glb.svg)

## Link cost (maybe) matters

- This may or may not matter - it really depends
- It doesn’t *always* help in *all* multi-site scenarios
- Expensive may be worse than slow
- If GLB and StorageGRID agree on these costs, that is the best outcome

![](/assets/images/storagegrid-multisite-02-link-cost.svg)

## Site networks

First, the round blue icon in each site is the StorageGRID admin node.

The cubes are storage nodes, and the lod-balancing icon show S3 API gateways which also act as local load balancers.

- The green network is cluster network ( semi-hidden beyond the blue boxes) and it is mandatory
- The blue network at the bottom  is admin network is strongly recommended    
    - In fact, you may have two or more of ‘em; notice there’s two admin networks in this diagram  
- The red network is a client network, strongly suggested as well; usually only StorageGRID load balancer/API gateways are exposed to those
    - You can have a bunch of them, for example the orange network is another client network
- Sites may have asymmetric networks, but the cluster network must connect all of them as one (extended) Level 2 network

![](/assets/images/storagegrid-multisite-03-site-networks.svg)

## It can be more complicated

- On-board management controllers (the IPMI/BMC stuff) is often vulnerable, so even if you need to use it, keep it unplugged when not using it (and create SIEM alerts when it’s plugged in)
- Outgoing access via cluster or other network may be useful for “phone home” functionality
- VM-based S3 API gateways also need to be connected to the rest of StorageGRID cluster using at least cluster network

![](/assets/images/storagegrid-multisite-04-node-networks.svg)

- SG100* hardware in 11.8 does not have "bare metal"-level AutoSupport code; their StorageGRID cluster status is picked by Admin node which indirectly reports on any issues as seen from StorageGRID (for example, a NIC port down event would be detected). That's why the SG1000s in this diagram can't get to Secure Proxy *except* through Cluster Network, which is the same way Admin Node (container) running on a SG1000 would send its AutoSupport payload. Optionally, SG100* hardware can be monitored from BMC & BMC's SNMP traps, but there's no need for it, and it's safer if BMC network is disconnected.
- Federated Identity lookups are done by IDNT service which runs alongside ADC service on selected Storage Nodes. If that's enabled, external DNS resolution must be allowed. (Outgoing) traffic for identity lookups (to LDAP/ADS) flows out through outgoing HTTPS proxy.

## S3 bucket consistency and ILM on-ingest policies

- Users often want to know if they can get multi-site data consistency. Yes, use [Strong-Global](https://docs.netapp.com/us-en/storagegrid-118/tenant/manage-bucket-consistency.html) (v11.8). But - *as you would want* - that means when a site is down, you won’t be able to `PUT` new objects *anywhere* in that bucket
- The other question is *when* this consistency happens - “shortly”, “soon”, etc. You can enforce [Strict ILM (policy enforcement) on ingest](https://docs.netapp.com/us-en/storagegrid-118/ilm/example-5-ilm-rules-and-policy-for-strict-ingest-behavior.html) to achieve immediate consistency on PUT. In this case PUTs are acknowledged only after the rule has been satisfied
- If, on the other hand, you relax settings (use the consistency type Strong-Site to apply ILM rules with the Balanced or Dual Commit setting), you’ll have a slightly higher risk of data loss (or temporary data unavailability) due to a site failure, but a lower risk of `PUT`s (and even `GET`s following such `PUT`s) failing not just when WAN dies, but also when WAN is too busy

![](/assets/images/storagegrid-multisite-05-bucket-consistency-ilm-enforcement-tradeoffs.svg)

There are many considerations in this area, not just data availability, risk of service interruptions, risk of data loss, performance (Strong-Global is the worst), but also the API behavior of StorageGRID’s S3 and management plane.

## Conclusion

Every knob that increases thing A, at the same time decreases some other thing B, so don’t think you’re gaining something for free when you turn these on (or off).

And read the docs - the diagrams don’t tell the whole story. They’re just some examples to get the thinking process started.
