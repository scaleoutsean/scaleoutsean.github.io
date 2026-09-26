# SolidFire Operator for Kubernetes

Build and use SolidFire Operator for Kubernetes to take full advantage of SolidFire features

[solidfire-operator](https://github.com/scaleoutsean/solidfire-operator) is a Proof-of-Concept operator for Kubernetes built using Operator Framework.

At the time of publishing this post, it doesn't do anything useful. It can make changes to SolidFire QoS policies, which in all likelihood is completely useless for your Kubernetes environment.

If I find the concept useful I may add additional functionality, but the code is permissively licensed so anyone can fork the repo and expand its functionality to work with addditional SolidFire resources that are or aren't supported by SolidFire modules for Ansible. Or build your own (the README has some detail around that).

What does solidfire-operator actually do?

It lets you use `kubectl` to make changes to SolidFire resources.

How does it work? 

Kubernetes uses developer-provided code and custom resource definitions to make changes to resources. In this particular case and version, changes are made with Ansible and SolidFire Galaxy collection, and resources aren't many (just the SolidFire QoS Policy object, in fact).

To create a new policy, we edit the sample config file and create a custom resource. Seconds later, a new QoS policy pops up in the SolidFire Web UI.

![SolidFire Operator 0.0.4](/assets/images/solidfire-operator-01.png)

Check the repo for additional details.

Why not do some volume-related stuff? 

Trident CSI operates under the assumption it is the only program that manages Trident CSI*-managed* volumes. So it's best to stay away from that.

There are plenty of other opportunities, though. Trident CSI v22.01 *only* manages manged SolidFire volumes and snapshots and nothing else.

There are Trident unmanaged volumes (SolidFire volumes we can import to Trident as unmanaged), as well as other CSI integrations such as [Cinder CSI](/2022/03/02/openstack-solidfire-part-2.html) and Host Path volumes.

Some ideas for solidfire-operator:

- Clone Trident volumes from Trident-made snapshots
- Snapshot and clone non-Trident volumes 
- Snapshot & [backup](/2022/01/19/solidfire-backup-restore-wasabi-s3.html) SolidFire volumes to S3
- Apply QoS policies on Trident unmanaged volumes, or (this may interfere with Trident) apply and revert custom QoS policies on Trident-managed volumes
- Set up replication relationships
- Perform SolidFire cluster failover
- Configure SolidFire for better integrations with various Kubernetes applications

One of the nice things about this approach - compared to running this from [scripts located in VMs or Docker](/2021/05/08/revisiting-solidbackup.html) - is that this operator code can be deployed to Kubernetes in seconds and doesn't require monitoring and maintenance of compute infrastructure outside of Kubernetes. As long as you backup (with Velero or whatever you use) your operator configuration or can deploy it from Git - there's less to think about and less to manage.

## Update (2022/05/06)

I spent almost two days in an attempt to replicate what I already did before and what took me a faction of the time in PowerShell - namely, apply a [temporary QoS policy on a SolidFire volume](/2020/11/28/powershell-set-sfqosexception.html) and restore original QoS values and other attributes after that. 

This reminds me that my earlier idea to explore non-Ansible operators was the right one. I've experimented with Shell Oprerator since writing this post, - it works, but it's difficult to troubleshoot. But now I know - compared to Ansible, it's very nice.

Here's my reward for getting that Ansible playbook for QoS policy to work: unwanted KV pairs in volume attributes.

![SolidFire Operator for QoS Exception Policy](/assets/images/solidfire-operator-02-ansible.png)

The way that PowerShell module works is it restores whatever attributes the volume had before. Simple. In this case, it's a Trident volume so it had some Trident attributes. But after spending almost two days on restoring them from Ansible, two junk KV pairs get injected into volume attributes by na_elementsw_volume module.

Now to get around that I'll probably just use JSON RPC ([ansible.builtin.uri](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/uri_module.html)) to get around that (assuming that module doesn't inject own KV pairs, too).

Summary:

- Using an operator like this (hopefully not Ansible-based), we can easily set a temporary (presumably, higher) QoS value on a volume, run a backup to S3 job, and then restore the original QoS value and attributes even if the volume in question is Trident-managed (usually volume attributes are empty)
- Trident <= v22.04 can't retype SolidFire volumes (OpenStack users can use Cinder CSI which can do that), so it's unlikely that Trident's volume attributes would change while Ansible playbook is running, but obviously if we used this approach we'd have to monitor changes in Trident releases to spot any risks and adjust the script or playbook if necessary
- In order to avoid failing to restore original volume attributes if Ansible script doesn't complete, we'd have to persist original volume attributes to storage. What happens if a Trident-managed volume loses Trident-set volume attributes? I haven't tried, but I'd say probably nothing. We could backup these attributes on a regular basis with a script (I recommend PowerShell or Python; both work well on Linux and Windows) if we were afraid of that, but I also believe - although I haven't tried - that simply exporting and importing a Trident volume would result in latest Trident attributes being applied to it. So the risk of something going wrong is very small
- Another way to accomplish the same (set higher QoS, backup, set original QoS) would be to store original QoS in something like Sqlite or JSON file and not use volume attributes. But that's not as elegant and adds complexity

In order to build a complete backup workflow, I just need one more major task in this playbook - run async Backup to S3 job in between QoS set and QoS restore steps - but after this huge waste of time with Ansible, I don't think I'll try unless I have to. I'll probably use some other approach - probably Shell Operator with PowerShell or Python.

Those who'd like to write their own, find the API example [here](/2021/04/21/solidfire-backup-to-s3.html#backup-using-the-api-powershell-or-python) and rewrite it for Ansible to something like this (using static variables in vars).

```yaml
vars:
    sf_url: "https://192.168.1.30/json-rpc/12.0"
    sf_elementsw_username: "backup-operator" # Dedicated Cluster Admin account
    sf_elementsw_password: ""
    vol_name: "pvc-1something-2something"
    vol_id: 604             # Don't hard-code this obviously, you probablyl want to loop through a list
    vol_sz_blocks: 1220864  # =TotalVolumeSizeBytes/4096; get volume attributs and do the math on the fly
    s3_access_key: "BBB"    # Store access and secret key in K8s secrets
    s3_secret_key: "CCC"
    s3_bucket: "solidfire-native-backup" # Your S3 bucket
    s3_prefix: "PROD-mn4y/pvc-1something-2something-604" # How to get this? See the post linked just above
    s3_endpoint: "s3.com.org"

tasks:
    - name: Backup volume to S3
      ansible.builtin.uri:
        url: ""
        method: POST
        validate_certs: False
        force_basic_auth: True
        user: ""
        password: ""
        body: 'body: {"method": "StartBulkVolumeRead","params": {"volumeID": "","format": "native","script": "bv_internal.py","scriptParameters": {"range": {"lba":0,"blocks":""},"write": {"awsAccessKeyID":"","awsSecretAccessKey":"","bucket": "","prefix": "","endpoint": "s3","hostname":""}}}}'
        status_code: 200
        body_format: json
        return_content: yes
      register: result
```

Yes, it's not pretty. Use Jinja2 templates to make this nicer, if you care.

The above tasks returned this:

```json
{
  "id": null,
  "result": {
    "asyncHandle": 1012,
    "key": "d977d846f98d61730bb4495455d0ea71",
    "url": "https://192.168.103.29:8443/"
  }  
}
```

This means backup job has started (and may or may not succeed). Next we could poll this async handle and get an estimate of how long we should wait before reverting QoS and volume attributes to original values. For details, see the [mega post on SolidFire's Backup to S3 feature](/2021/04/21/solidfire-backup-to-s3.html#backup-using-the-api-powershell-or-python).

If we want to make this simpler, we could simply create a sleep task. Or - slightly smarter - divide the volume size by average backup speed you get, so that this task sleeps longer for larger volumes. Or create a while loop to check if backup manifest was written to S3 i.e. if backup was successful, and time out if nothing gets detected after two-three hours.

The example task above worked:

![SolidFire Operator - Ansible-driven backup task](/assets/images/solidfire-operator-03-ansible-backup-to-s3.png)

Destination bucket:

![SolidFire Operator - volume backup](/assets/images/solidfire-operator-04-s3-bucket.png)

If you're hell-bent on doing this in Ansible I'd recommend doing everything in `ansible.builtin.uri` module, or using `ansible.builtin.shell`, where we can write proper Python.

As mentioned in task comments above, you'd probably want something like a list of volumes and most values could be obtained on the fly, via another URI task (method: ListVolumes). Note that ListVolumes has two options: volumeIDs (listOfIDs) and volumeName (string). Because volumeName isn't necessarily unique, this may be another reason to use URI (or own script) with volumeIDs rather than rely on uniqueness of volume names. 

Volume names can be mapped to IDs many ways. Some examples:

- get it from Kubernetes CLI (by filtering PVCs for SolidFire Storage Classes)
- get volume IDs the (tenant) account ID used by particular Trident instance (method: ListVolumesForAccount)
- get it from backup application (let's say you use Velero as your main backup tool that automatically picks Trident/SoliFire PVCs that need to be backed up, and Backup to S3 is a separate weekly job to Object Store with [Object Lock enabled](/2022/05/06/solidire-backup-to-s3-with-object-lock.html))
