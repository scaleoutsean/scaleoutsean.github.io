# Simplify data workflows with Kestra

Offload workflows and scheduling in automation to simplify script-driven workflows and easily build more complex workflows

## Introduction

Sometimes I blog about storage-specific automation and usually I focus on SolidFire because it... just damn works.

I've also written several scripts - for backup and whatnot - that showcase how SolidFire makes it easy to automate somewhat complex actions. The SolidFire architecture and developer-friendly API make that possible.

What I haven't had time to do yet was to investigate inserting these "steps" of workflows into real workflows. For an example, in SolidBackup there are several steps:

- Configuration management - maintain and manage your list of volumes
- Cloning management - run jobs (possibly hundreds) - that copy production volumes into clones (SolidFire array-side)
- Backup management - mount those clones from backup containers (Docker, Kubernetes) or VMs and copy (backup) data to S3
- Monitoring, reporting, alerting, auditing - have some way to see what's going on without using `grep` 

I solved the first by having a configuration file in (say) Git. The second and third are scripts and the third requires redirecting script logs to a back-end that would provide monitoring, reporting, alerting, and auditing. So there's some amount of DIY work that needs to be done, especially because if script logging isn't well structured (and it likely won't be, if more than one tool is used in the process).

Of course, I knew that early on, but I also knew there's no logging without scripts that do the work, so I wrote the scripts first with the idea that those may help others get started and write the rest to suit their circumstances (everyone has a different solution and requirements for that last step).

For backup, recently I've examined the possibility of taking care of cloning independently (Step 2) and using [Velero V1.8 for backup management](/2022/03/15/velero-18-with-restic-and-trident-2201.html#using-velero-and-restic-to-backup-regular-solidfire-volumes) (Step 3) even for non-containerized volumes (as long as they are formatted with ext[3,4] or xfs). 

I've also explored using [Ansible](/2022/02/14/middle-class-rbac-solidfire-ansible.html) for workflows that require RBAC feature for segregated access to SolidFire resources.

For generic workflows, a less prescriptive approach would be to use a generic workflow management tool. 

For Deep Learning and Big Data related workflows, NetApp has the Data Ops Tool (I call it "DOT") that currently doesn't support SolidFire API. It certainly could but SolidFire usually isn't used in Deep Learning. So rather than trying Airflow and Jupyter/DOT, I wanted to try something more "generic".

So I picked Kestra for this PoC. You can find more about it on [their Web site](https://kestra.io/blogs/2022-02-22-leroy-merlin-usage-kestra.html). The point is, it's a data-focused workflow tool so it should be good for my purpose.

I tried two things:

- SolidFire's native Backup to S3 (use the SolidFire API from a container)
- StorageGRID Audit Log Analysis (implement several steps to have the entire pipeline in one place)

## Backup to S3

Kestra lets you build "flows", i.e. pipelines, or data workflows. I first built one called "backup". It's a single task workflow, it just calls an API method that [copies SolidFire volumes to S3 buckets](/2021/06/22/solidfire-backup-and-cloning-with-per-storage-node-queues.html).

![Backup workflow for SolidFire](/assets/images/workflow-automation-with-backup-01.png)

The way I built this "flow" is to ask the user for several inputs and kick of a Backup-to-S3 job based on these inputs. Now, this is kind of fake. Normally, if we provided a Volume ID we wouldn't need to also provide a SolidFire volume name because you could get it via the API. But I wanted to test parametric execution where not everything is hard-coded.

Also, rather than backup volumes one by one, we would probably have a fairly static list of 20 or 100 volumes and backup four or more in parallel (see the link above, related to parallel backup to S3).

Anyway, the user provides some inputs that make the script work. The script itself is based on the steps provided [here](/2021/04/21/solidfire-backup-to-s3.html#automating-solidfire-backup-to-s3). It could all be hard-coded, too, especially if you have just one cluster and the set of Volume IDs rarely changes you could edit the list of hardcoded volumes in Kestra's Web based editor which (see the demo) provides versioning and diff-view features.

![Kestra flow inputs](/assets/images/workflow-automation-with-backup-03.png)

Once inputs are provided, workflow can execute. This step below kicks it off and in Executions we can find the flow's log. In the screenshot below all runs result in a "Warning" (yellow button) because the script returned more than just 0 and Kestra couldn't determine if that was a warning or not (it wasn't, so the warnings are unnecessary, but you'd have to check the flow the first time to figure this out). This is merely an aesthetic/usability issue and can be fixed by making the script run more quietly.

![Kestra executions](/assets/images/workflow-automation-with-backup-02.png)

Backups usually run at night, so we want to schedule those flows. That can be done. I also specified the optional backfill schedule to run one before its scheduled time.

![Kestra schedules](/assets/images/workflow-automation-with-backup-04.png)

 I had expected backfill time to be in browser-local TZ, but that didn't work. After some experimenting Kestra started two backup jobs at once (one because I executed the workflow, another was backfill scheduled to $NOW), which is when I realized that backfill time is in UTC TZ.

![SolidFire runs scheduled Kestra job and backfill job](/assets/images/workflow-automation-with-backup-05.png)

After a flow execution completes its logs can be reviewed. The bad part about this is passwords and credentials end up in the logs. Unless you are the only user operating this instance, you'd want to find a way to fix that. I haven't found a way to not log those sensitive details (in Community Edition I used).

![Kestra flow log](/assets/images/workflow-automation-with-backup-06.png)

So that's basically it. There are several advanced options - I could provide a list of volumes and run N loops (jobs), etc. - but it's only a matter of spending more time to refine and optimize flows.

I should add that (as expected) it is possible to chain tasks/steps, as it is to write everything in one giant step. The former is better because it's not all-or-nothing. This screenshot shows how we can extract variables such as async handle (of the backup job) and job key from response returned by the SolidFire API, which is one of ways how we dynamically pass inputs from one task to another.

![Kestra flow outputs](/assets/images/workflow-automation-with-backup-07.png)

This could be used in the next step, to poll jobs as they run, and possibly retry those that fail. I hit some Kestra bugs here so I gave up on those tasks.

## Generic data workflow

Because I've written too many backup-related posts, I thought to try a more practical workflow, such as StorageGRID audit log converter ([SGAC](/2021/10/20/sgac-storagegrid-audit-log-converter-v0.2.1.html)). Why?

It's more complex - one needs to get the audit log file from an NFS share, maybe split it in 16 or 32 chunks, then convert each, and finally pass JSON files to some other program for analysis. This may involve multiple systems, applications, and protocols.

Enter my fake SGAC flow for Kestra:

![Made up workflow for SGAC](/assets/images/workflow-automation-with-sgac-01.png)

There are more steps than necessary (one of them is completely repetitive), but I was just playing with it and didn't want to delete tasks. What I do is build a container that runs SGAC (download SGAC Python script, install Python modules), then run it against uploaded StorageGRID audit log file (manual step in my flow), let the container convert that log (or log chunks) to JSON, and push output(s) to Elasticsearch.

This looks much nicer as far as demonstrations go - you can see the flow going from one task to another, etc. Convert is the task where conversion to JSON happens, so it takes most time. Elasticsearch load fails because of what I suspect is a bug or documentation problem (and Kestra has few other issues that aren't hard to spot, it seems to me) and I couldn't make Elasticsearch upload to work even in a single task flow.

![SGAC flow in Kestra](/assets/images/workflow-automation-with-sgac-02.png)

But bugs can be fixed and documentation improved - we care if the converted audit log file was produced as expected. It was (at the very bottom).

![SGAC JSON file](/assets/images/workflow-automation-with-sgac-03.png)

We can find and download it from Outputs tab for this job, which was a workaround I used to get the output and upload it manually to Elasticsearch to see if it was okay. (I think it's listed twice because `files.outFile` may be a deprecated variable to access file outputs while `outputFiles` is the new one, but I'm not sure).

![SGAC convert task output](/assets/images/workflow-automation-with-sgac-04.png)

Kestra on Kubernetes can drive many containers to process StorageGRID logs and that almost always beats a single VM running a DIY convert-and-upload script. So even if you don't see much benefit from moving a script like SGAC to Kestra, I see value in Kestra for this use case because it "kubernetizes" SGAC and makes it easy to scale it out, retry jobs, and more. If you have a busy StorageGRID v11.0-11.5 and need to convert 50-100 2GB logs every day, Kestra can probably help you.

Is this example related to SolidFire? Not directly, but there's no reason why we couldn't run this workload on SolidFire:

- We just need some ephemeral storage to run container images. Data itself (StorageGRID logs, in this case) doesn't need to be stored at rest on SolidFire
- Docker images used to convert StorageGRID logs into JSON can keep these files in [RAM](/2022/01/28/storagegrid-hybrid-cloud-processing-without-data-at-rest.html) - there's no need to save anything (even temporary data files) on SolidFire volumes; converted JSON files can be uploaded to a StorageGRID bucket or Elasticsearch or other location as last step of the flow

## Kestra or the DOT for SolidFire workflows

Can Kestra act as a Data Ops Toolkit for SolidFire? While it may be easier to automate SolidFire from Kestra than expand the Data Ops Toolkit with SolidFire-specific functionality, I think Kestra is not focused on Deep Learning (feel free to compare it with Airflow, Argo or whatever seems of interest).

Although you could Kestra's "forms" (in Execute step) to get outcomes similar to Jupyter with the DOT, personally I'd use it more for scheduled jobs that span different applications (check Kestra's documentation to find more on that) than for interactive use.

What about use cases for ONTAP and StorageGRID? There isn't much overlap, but - for the sake of an example - the DOT can download data from StorageGRID to ONTAP for processing, and upload back the results. In this case, if it's application specific *and* Kestra has a plugin for it, I'd use it. If there's no plugin or if the workflow involves ONTAP clones, I'd use the DOT. And finally, we can use the DOT from *within* Kestra, which further increases our options.

Some ideas for Kestra with SolidFire:

- SolidFire's native Backup to S3 - this needs managed parallelism, logging, monitoring, scheduling; I wouldn't use it for Velero or other backup that runs externally and has its own application-specific, integrated scheduling
- Multiple tasks that use the SolidFire API - migrate scripts from VMs to Kestra to have them managed and executed in one place
- Database cloning between different arrays - good for DevTest, although I'd like to see Kestra provide native PowerShell support to make it easier to use in Windows environments

## Conclusion

As far as SolidFire-related automation is concerned, Kestra's Bash wrapper seems to have some bugs. I struggled with it when I tried to use solidire-cli from it, but even scripts that had curl with `-H` option couldn't be validated and saved. So I ended up using Kestra's Python wrapper and SolidFire Python SDK.

This post shared two basic examples that illustrate the value in offloading automation plumbing to a specialized engine such as Kestra: you get scheduling, logging, monitoring and more without spending much time on that.

Kestra can run from Docker and Kubernetes, and can build sophisticated workflows that save time and improve reliability (at least when I compare it to my own scripts).

![Complex Kestra workflow](/assets/images/workflow-automation-kestra.png)

But for now you have to be ready to deal with its bugs (or the not-there-yet documentation - either way, I struggled too much for my liking). 

Once it has a way to mask or exclude sensitive log entries and the documentation and code are better, I'd consider using it for data-related workflows.

Kestra Enterprise Edition has features such as RBAC which solve some of the shortcomings I mention, if you need better access control, namespace segregation, etc.

## Demo

- [Kestra demo with SolidFire Backup and SGAC log conversion](https://rumble.com/vyjomt-kestra-demo-with-solidfire-backup-and-sgac-log-conversion.html) - 3m55s
