# Improved pipelines with BeeGFS FS Event Notifications in v8

More on improvements in BeeGFS file-system event notifications

- [Introduction](#introduction)
- [What's new in BeeGFS file-system events in BeeGFS v8](#whats-new-in-beegfs-file-system-events-in-beegfs-v8)
  - [Dude, where's my gRPC server?](#dude-wheres-my-grpc-server)
  - [Can BeeGFS watch server, erhm, client, drop messages](#can-beegfs-watch-server-erhm-client-drop-messages)
  - [File-system notification messages](#file-system-notification-messages)
- [Use case: data pipeline for StorageGRID](#use-case-data-pipeline-for-storagegrid)
  - [Advantages](#advantages)
  - [Limitations](#limitations)
  - [Scheduled scanning](#scheduled-scanning)
- [Performance (and security)](#performance-and-security)
- [Bonus lightweight approach with Web hooks](#bonus-lightweight-approach-with-web-hooks)
- [Bonus use case: data pipeline for the Versity S3 Gateway](#bonus-use-case-data-pipeline-for-the-versity-s3-gateway)
- [Conclusion and ideas for future work with BeeGFS FS event notifications](#conclusion-and-ideas-for-future-work-with-beegfs-fs-event-notifications)
- [Appendix A: batching and filtering](#appendix-a-batching-and-filtering)
- [Appendix B: scanning](#appendix-b-scanning)
- [Appendix C: likely bottlenecks](#appendix-c-likely-bottlenecks)

## Introduction

I actually blogged about this right here: [File-system events](/2025/05/17/beegfs-v8-netapp-e-series-indexing-tiering-workflows.html#file-system-events), so I'll skip 90% of what I wrote in that post and just build on that here. 

Secondly, some years ago I wrote about implementing [anti-virus scanning for StorageGRID](/2024/01/29/antivirus-scanning-for-on-premises-s3.html). I'll revisit that as a use case - maybe a 'stretch use case', but fun - for using BeeGFS file-system event notifications.

## What's new in BeeGFS file-system events in BeeGFS v8

If you're interested in some background, see the related section of that recent post above.

To keep it simple, here's how I'd explain it (without reading the FS events code from v7, which puts me at a disadvantage):

- Old notifications weren't easily accessible (see the article above)
- New (v8) notifications use gRPC client to send them, and can easily and reliably dispatch thousands of notifications per second to multiple remote servers
- Implementing the server is "an exercise for the reader", as they say

### Dude, where's my gRPC server?

You have to write it. The reason(s) is/are explained in `beegfs-go`, along with other useful information. Based on [current](https://github.com/ThinkParQ/beegfs-go/commit/78a7f84a88d4473b702be31cc4a4d76b7c1b6eff) README file, it appears ThinkParQ didn't want to get too prescriptive too early and that is smart because they can avoid wasted development. For example, I have suggested to create a way for the client to drop some events at source and optionally spray them evenly across several destinations and maybe they're getting similar suggestions from other users.

For now users are expected to roll their own gRPC server (only gRPC notifications can be sent), but as use cases and requirements get surfaced to them, they will likely improve it and may make other protocols available. 

### Can BeeGFS watch server, erhm, client, drop messages

Currently - also from that read-me - it stores (and buffers) messages in memory, so it won't lose sent-and-acknowledged messages, but it could lose not-yet-sent ones. As the read-me explains, the reason is they thought the best way is to build this into metadata service rather than to watch service, which is a to-do item. 

### File-system notification messages

The read-me was confusing to me, as it took me a while to realize what's what. Frankly speaking, I don't like that Watch service (so, a server) is a client (a gRPC client), while gRPC server is a "subscriber" (which sounds very client-ish to me). This wasted me some time when setting this up. (Not that I'm a gRPC expert, but it *added* to my usual stumbling.)

Anyhow, the linked repository has gRPC protocol definition files, so not unexpectly messages look exactly like the "proto" files intend them to look. 

```raw
seq_id: 1341
meta_id: 1
v2 {
  type: OPEN_READ
  num_links: 1
  path: "/main.log"
  entry_id: "0-682A0F1C-1"
  parent_entry_id: "root"
  msg_user_id: 1000
  timestamp: 1749980308698647132
}
```

Here I simply ran `cat /mnt/beegfs/main.log` and Watcher service sent the above via gRPC.

On the server ("subscriber") you have to ack these to make them go away i.e. to have Watch server (that is, the gRPC client) know the message was well received.

Then, with it, you can do whatever you want. Prefix your mount point (in my case, `/mnt/beegfs/`) to those names if you need full path to file(s).

I ranted about that (the over-hyping of what is essentially several steps you can create by yourself in days using BeeGFS as seen here) in the BeeGFS-related post at the top, and also the subsequent one [here](/2025/05/23/beegfs-data-pipeline.html) (related to the annoying "reference stacks" and "pipelines" that every vendor likes to boast about as if no enterprise user can run `'docker compose'` without having a "vendor-certified" copy-paste example.).

## Use case: data pipeline for StorageGRID 

A pipeline of the special kind - AV and anti-malware scanning - that is.

This was an example from the StorageGRID virus and malware scanning post linked at the top.

![StorageGRID Kafka notifications for AV scanner architecture](/assets/images/s3-av-scan-example.png)

There's nothing wrong with it, it's as good or as bad as any other. 

But, since I already ranted about data pipelines and "reference architectures" **and** I've always wanted to revisit S3 bucket AV scanning (if you skim through that older post, I did a "PoC" but it was a simple Python script), I thought to use that example as a use case in this post.

Of course, it should also not be a fake example - it should be superior in some aspects, including the reason that BeeGFS may be slightly more complicated to run than single-host file-systems (although I found [BeeGFS on-demand file-systems](/2025/05/17/beegfs-v8-netapp-e-series-indexing-tiering-workflows.html#beegfs-copy-tool) very easy to setup and tear down). Here's an example:

![S3 AV and malware scanning on BeeGFS](/assets/images/storagegrid-s3-scanner-beegfs.png)

S3 service sends notifications or uses Web hooks to let us know of changes. That can go to Kafka, although I'd use something less nightmarish but compatible (StorageGRID supports Kafka and Elasticsearch endpoints, remember?). 

There's a Kafka consumer to subscribe/poll these topics named after StorageGRID buckets that those notifications originate from. 

The "new" element - compared to the earlier approach - is that because we have a *very fast* cluster file-system and S3 happens to contain large objects, this is a great match: we can achieve excellent performance and scalability by downloading objects to BeeGFS (can be BeeOND, i.e. temporary BeeGFS cluster/filesystem created on-demand). 

I don't have a concrete proof for the superiority of this approach except second-hand knowledge of gRPC and a bit of first hand experience (I didn't *do* anything with BeeGFS Watcher events, I just acknowledged them, but in any case those are just external overheads and even that ack-ing messages is enough to see several messages can be exchanged within the same millisecond.)

![gRPC receive and send with BeeGFS Watch and gRPC server in Python](/assets/images/grpc_python_resp.png)

To be sure, time saved with gRPC shouldn't play a big role in overall scanning performance, but there's one Watch server per BeeGFS file-system, so I want the fastest one to make sure notifications themselves aren't bottlenecked at the FS level. I can scale downloading and scanning by adding more containers, but I can't scale Watch Service (which is why it's great that in version 8 it's gRPC based - at least they do the best they can).

After receiving a bucket notification event and making sure it's of interest (i.e. it's an S3 PUT rather than GET or DELETE) in Step 3 we dispatch S3 GET (download) jobs to all or a group of "download containers" which download objects to (say) `/mnt/beegfs/av/BUCKET_NAME/`.

BeeGFS file-system notifications are useful because we can learn of new objects from Watch service quickly and economically (Step 4). It is important to know the file has landed onto shared file-system.

Once we receive these file-system notifications, we know that downloaded files are visible to all containers (in the "AV scanning" group, if we run a dedicated job queue for that) so we can fire AV scan jobs immediately. Our gRPC server could even run on BeeGFS metadata node; normally that's not a best practice, but gRPC client is very lightweight and on BeeOND systems this would be perfectly fine.

There's another optimization we could do in this case: with a BeeOND-per-bucket, we could probably create large singleton BeeOND clusters with 8-16 containers and use gRPC over UNIX sockets to eliminate TCP in Step 5.

AV scan results are later sent to another Kafka topic (e.g. BUCKETNAME-scan-results) or elsewhere (Loki, etc.).

If we're worried some jobs may fail silently, we could log successful completions using a gRPC sequence number so that we can easily query all submissions for which no successful jobs referencing the same sequence ID can be found. Alternatively, there are "event databases" for such workflows, and we wouldn't use Kafka at all to avoid the need to "manually" deal with failed events.

To be honest, I wouldn't expect anyone to run a DIY AV service that's mission critical - if it's very important, it's better to use a commercial solution (and get latest and greatest virus definitions and detection engines).

We already mentioned that the main disadvantage is now we have a small cluster to run, but that isn't hard with BeeOND. Let's take a look at the main advantages (as I see them).

### Advantages

It's easier to scale AV scanning because pods on all BeeGFS nodes can see any object regardless of where it was downloaded (if we wanted to do that). 

Normally we'd achieve this by using a file share, but this should run much faster even for GB-sized objects. Or maybe you'd do a download and scan on the same client, but we may need to wait a few seconds longer for an object to download and it would be harder to schedule jobs: scheduling just 2 per container could turn out to be wrong because both files could be very large. 

Notice how here, thanks to file-system event notifications, we don't have to wait for a "download pod" to notify us. The moment we see `LAST_WRITER_CLOSED` (event) in BeeGFS file-system path of interest, we can scan from any available "scanning pod". Also, based on `PATH` value, which includes `BUCKET_NAME`, we can dispatch events to the appropriate "scanner group" if we use ACLs to segregate scanning groups by bucket name.

I also think that having separate "download" and "scanning" pods is better for performance because AV scanners aren't burdened by IO and memory utilization spikes from S3 GET jobs.

### Limitations

It's more of a choice than a limitation: we don't do anything with infected files. We had the same "limitation" without BeeGFS. 

As I mentioned in the first antivirus scanning post, I can't say I like the idea of being able to write to buckets and overwrite (and possibly delete) objects that are already there. Furthermore, versioning or even Object Lock may be enabled. 

Those who seek to scan for viruses and malware *before* files get uploaded to S3 can do that in a Web front-end (which could also use BeeGFS) or client application. 

I've also seen some approaches that update S3 object metadata to mark it "clean" but that, too, seems too complicated. As if it's not bad enough to have a place that can download all your objects, now we want to be able to update its tags? 

I think it's appropriate enough, and also much easier to do, to just scan and notify. If you need a mission-critical AV scanning service, I would definitively not suggest a DIY approach with ClamAV.

### Scheduled scanning

Just a note on that approach: it doesn't require a different architecture: we simply hoard FS notifications in a DB and start working on them at 1am, for example.

Because many TBs of objects may have been uploaded during the day, we need to remember to delete downloaded objects after scanning them. Or we could loop over a list of buckets and create a new BeeGFS for each, rather than have one big file-system landing area for everything that was uploaded that day.

## Performance (and security)

Another interesting detail may be performance. gRPC ought to be faster than other approaches, so this approach should scale better than some others.

I took this screenshot from the gRPC project, and it shows that even Python lets us process 1,000 messages per second. 

![gRPC server in Python](/assets/images/grpc_python.png)

I think this is Python-to-Python, whereas BeeGFS isn't Python, so it may be faster.

You don't *have to* implement the server in Python, but we can. 

If queue-to-Kubernetes and gRPC-to-Kubernetes are private network and/or file names aren't secret, TLS can be dropped, helping some more. We may be able to dispatch a few hundred messages per second, which is enough for "average" mid-size StorageGRID cluster.

For users who desire to use TLS simply because BeeGFS nodes might download "important objects" (although that's not really related to TLS; downloads from StorageGRID would use TLS - no need to compromise there): you can take advantage of dedicated smaller BeeOND clusters (e.g. 3 VMs with 6 GB each for one particular bucket). For less militant segregation, BeeGFS has ACLs. 

If you want to run AV scanning as batch jobs, BeeOND clusters could be created at start, and wiped after scanning is done, one by one bucket. (You can see in the BeeGFS post at the top, it takes 1 minute to get a BeeOND filesystem going).

Lastly, one interesting thing is that with ClamAV using containers is an interesting way to at least partially segregate scanners from host OS and it may be better for performance as well. I *haven't tested that on BeeGFS*, but sending files from scanners to ClamAV server goes over TCP network, whereas - when every file is visible to all containers on all BeeGFS nodes - here I can use UNIX sockets and completely avoid TCP. No need for TCP and (even more) HTTPS! 

## Bonus lightweight approach with Web hooks

If you have a well-maintained Kafka cluster and your S3 storage supports Kafka notifications, there's no reason to not use it.

If you don't have it, your you don't quite like it, you can use Elasticsearch (at the very top, my preferred approach at the time).

If there's was a way for S3 to notify using Web hooks, you could use something like this:

- Web-hook-to-some other (such as NATS) messaging service
- From there, proceed as usual (without the JVM hogs (Kafka, Elasticsearch))

![StorageGRID Web hook notifications for AV scanner architecture](/assets/images/storagegrid-s3-webhook-av-scanner.png)

In other words, don't build a Kafka or Elasticsearch cluster just for AV scanning. Those services aren't for the faint of heart.

Here's how I un-hogged my "S3 event notification-to-AV-scanner" workflow using Web hooks (which have the same format that StorageGRID can send to Kafka today):

- Tab 1 - NATS server v2.11
- Tab 2 - Web hook-to-NAS service (DIY Python service)
- Tab 3 - Web hook generator (DIY script - fakes proper Kafka-style SNS notifications)
- Tab 4 - NATS message service consumer (and AV scan job dispatcher, also DIY. AV scan jobs could be sent to some "famous" job scheduler. Maybe some out there can already talk to NATS.)

(You may open this image in new tab for easier viewing.)

![S3 web hooks to NATS to AV scanner with Python](/assets/images/webhooks-to-nats-to-av.gif)

Now we don't have to deal with certain Kafkaesque services.

## Bonus use case: data pipeline for the Versity S3 Gateway

I came up with this only after I wrote this post (when I finished adding Appendix A) - I guess writing about MinIO's [erratic behavior](/2025/06/06/whats-minio-up-to.html) got my S3-related brainstorming algorithms working overtime in recent days... 

As objects land on the Versity S3 Gateway server, BeeGFS events kick off automatically. This is wild! 

There's no step 2 here: this sucker goes straight to "**Profit!**", folks. This deserves its own post.

## Conclusion and ideas for future work with BeeGFS FS event notifications

New BeeGFS file-system notifications in version 8 are greatly improved compared to previous implementation in version 7. 

We get more performance, more reliable delivery, and an easier data format (gRPC events vs. DIY parsing) to work with.

Combined with BeeOND, it opens possibilities for secure, high-performance processing steps that require a POSIX file system. Antivirus scanning is one such case, but there are others.

Using a DIY recipe with ClamAV is good enough for basic checking - it probably can stop Tier 2+ attackers. Mission-critical use in environments with compliance requirements should consider a commercial offering which could start after Step 1 (that is, you'd just have to send notifications to Kafka, and they'd take it from there).

When I find time I'd like to evaluate performance on low-end hardware (i.e. my home lab) to get a worst-case performance baseline for BeeGFS gRPC notifications. I'd also look at the details of Step 5 (gRPC -> Kubernetes scan jobs) - Hashicorp Nomad is [absolutely great for that](/2022/04/24/nomad-batch-job-scale-out-parallel-filesystem-beegfs-e-netapp-series.html), but I don't have a favorite for Kubernetes yet.

## Appendix A: batching and filtering

Days after writing this post I revisited this and added batching and filtering.

How many events to batch? I guess "that depends" is the right answer. I used 8 while prototyping.

![gRPC event batching in Python](/assets/images/grpc_python_batching.png)

After batches of desired size are gathered, I process them like so:

- Filtering (based on criteria such as file extension, event type, path, user ID, etc - along the lines demonstrated in the post with notifications from BeeGFS version 7)
- After filtering, events are sent to process files in intended way (such as AV scanning on LAST_WRITER_CLOSED). This I currently do in the same script, but like I said in the older demo, these events could be immediately sent to a message queue or job scheduler and let other services deal with them later.

Another reason to "hoard" events or file lists is that scanning can be batched and/or delayed, for example. That can sometimes be useful. 

For example, files/objects in certain buckets may be overwritten multiple times (so maybe there's no point of scanning them multiple times), or deleted quickly so there's no point of scanning them. 

Knowing `path` to each file, we can develop filters and criteria that allow us to implement a variety of approaches in gRPC server or downstream by message queue subscribers.

While playing with batching I realized gRPC works much faster than I can write files to BeeGFS, so I probably won't be able to find any gRPC bottlenecks that way. Not unexpected.

I did a test with `OPEN_READ` (faster than writing) which:

- Finds all files in a directory tree and loops through the list (8192 files)
- Reads and discards each file (1kB)
- Track gRPC server events

It's fast.

| Step                        | Timestamp (UTC)                |
|-----------------------------|---------------------------------|
| Enumeration and `cat` start | Sat Jun 21 16:59:38 2025        |
| Completed                   | Sat Jun 21 16:59:51 2025        |
| Last event seen by gRPC     | 2025-06-21T16:59:51Z            |
| Time between Last event and Completed | 0 seconds             |

This didn't give me much and I found some of the files were larger, so I focused on just the smallest files (1024 of them). Elapsed time: 1.434 seconds.

```raw
Bash script end time:   1750526463.384
gRPC server last event: 1750526463.384
```

Well, even milliseconds aren't granular enough. It's safe to say "there's practically no delay under moderate load" (few hundred events per second). As I guesstimated early on.

This doesn't include processing, but that doesn't necessarily need to happen in gRPC server. If I do additional experiments with processing (AV scanning, primarily), I'll add those notes in Appendix B.

## Appendix B: scanning

This is the last step in our antivirus pipeline, where events are gathered in batches (3), then type `LAST_WRITER_CLOSED` (2) is filtered and scanned using Clam AV. Infected files (3) are detected, while clean files (not shown) are not.

![gRPC file scanning in Python](/assets/images/grpc_python_actions.png)

(Some messages appear seemingly "out of nowhere". That's because AV scanning is asynchronous.)

I don't think I can precisely estimate "real life" performance, but there's effectively no delay and scans complete within the same second (0.001-0.003 seconds per small file). That time would be longer for larger files, but multiple ClamAV workers can be used.

A better test is needed for precise measurement, but what I looked at was when my shell script finished running and when the last event from the last batch was processed.

```raw
Last file event on FS: 1750566483.692
Last file scanned    : 1750566501.383
```

We can see (501-483) seconds have passed. This isn't too bad for 1,000 files and a single queue on a small VM. 

gRPC events come in, get queued, and files (that have been written) are then scanned asynchronously, so nothing is being blocked. Millions can be queued in several GB of RAM. Or we could use Redis to queue them up and persist to disk before acknowledging receipt to BeeGFS gRPC client.

As I've mentioned earlier, N BeeGFS clients can scan 1/N files each. If we can scan 50 files per second, ten VMs *(2 vCPU, 8GB RAM) may give us aggregate scanning performance of 500 files (or S3 objects) per second for files already on file-system.

I created another test, same files and everything, but removed ClamAV from the loop so that there's only an async sleep of 0.001 seconds (to simulate a quick external "action" such as calling a Web hook) for each event processed. This took 9 seconds, so 100 write events per second including filtering and (external) action.

```raw
Last file event on FS: 1750571129.416
Last file scanned    : 1750571138.230
```

I should mention that there are more than 1,000 events when 1,000 files are being overwritten (as in this case). There’s a `TRUNCATE`, followed by a `FLUSH`, and then a `LAST_WRITER_CLOSED`. Also, if I removed the numerous print statements from the gRPC server, it should be even faster.

For S3 AV scanning (StorageGRID use case) we'd first have to download objects and then scan, so it'd be slower. For Versity S3 Gateway, no "download-from-S3" would be necessary. I assume in real life we wouldn't scan objects with extensions known to be safe (.json, .mp4...) which could translate into very few scan-able objects per second.

To scale even further we could have M gRPC servers and make every server process 1/M of all events.

## Appendix C: likely bottlenecks

I expect that S3 object download would be the slowest part (e.g. 10 seconds), followed by ClamAV (< 1 second). Both of these would require multiple BeeGFS (or non-BeeGFS, if you use something else) clients (VMs, containers), but can be done by simply adding more.

Web hooks are lightweight and not a problem.

At some point, the gRPC server may become a bottleneck itself. 

With my Python-based gRPC server I receive gRPC requests, parse and filter events, and finally dispatch scan jobs. This happens in parallel, but maybe around 100 objects (which could be 1,000 BeeGFS events) per second, I would need to improve it. 

That, too, should not be hard - we could simply use gRPC server(s) (as BeeGFS can send to multiple) to receive requests and pass them to a message server, and have the rest done by clients of that message server (e.g. NATS, Kafka). That way we could probably scale out by 10x to 1,000 objects per second (and by that time we'd need a bunch of BeeGFS/ClamAV nodes!)

At some even larger scale, it would be helpful to rewrite the gRPC server in Go and scale it even further, but I don't know of anyone who has that many new objects created every second in an on-premises environment. Even if they do, different buckets could send event notifications to different Webhooks or message stores, so there are plenty of chances to parallelize AV scanning.
