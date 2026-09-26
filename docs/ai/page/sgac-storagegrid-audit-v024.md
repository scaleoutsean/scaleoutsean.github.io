# SGAC v0.2.4

Minor update, no new features

Last weekend I opened the StorageGRID S3 API port to the world to see what happens.

Unsurprisingly, there are plenty of morons out there who try to gain access. 

![StorageGRID access log](/assets/images/sgac-v024.png)

- Highlighted in yellow: the idiots get HTTP 40x on everything because I don't have any buckets or objects with public/anonymous access (plus all the data is junk in the first place - it's a development grid). The management port isn't forwarded from the Internet, so the access log doesn't contain interesting lines related to management endpoint that aren't from LAN
- Highlighted in blue: that is "gateway UUID" from the NGINX. StorageGRID can have multiple gateways (SG1 appliances or VMs), so that ID is included in access logs, so that we can tell which request came via which gateway. I don't know why the UUID doesn't appear in all lines, but that's also not my immediate concern

Since I was forwarding all the logs - not just audit logs - to the same syslog destination I realized that, unless those lines are dropped or removed, they can cause parsing failures in SGAC. That's harmless, since such lines simply get dropped on parsing failure, but they could be skipped.

So, [StorageGRID Audit-log Converter aka SGAC](https://github.com/scaleoutsean/storagegrid-audit-analysis) v0.2.4 has two minor changes:

- v0.2.3 allowed the new audit string in v12, and v0.2.4 ignores lines from S3 API access and and StorageGRID management access, if present in "audit" (well, clearly not just audit) log. This doesn't change anything, it just drops those lines before parser fails trying to understand them
- A Logstash example for parsing access logs was added to the repo for reference
