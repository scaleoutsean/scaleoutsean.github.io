# S3 Tag-on-Upload with Kompromise Lite and StorageGRID

The post walks through an example of using Kompromise Lite (Webhook + Kafka) with MCP agent that watches Kafka messages and uses anti-virus and image model for detection of unsafe content, and acts on positive results.

## Introduction 

This is the second time I'm saying this - the second half of 2026 has been more interesting because I blew the first half on [fixing potholes](/2025/12/22/reautomating-eseries.html#20260517) and couldn't do only the things I wanted to do. The second half has been mostly about what I wanted to do and therefore more enjoyable.

In recent weeks I covered a fair amount of different approaches to embeddings, search, RAG/chat stuff relevant for S3 (the storage protocol [that matters more than others](/2026/09/08/opensharing-data-mobility-netapp-eseries-storagegrid.html)) and one that illustrated how I'd do it for NAS (where I used [Share-to-S3 migration utility](/2026/11/01/s2s3-feeder.html)).

I had variants with databases on prem, databases in the cloud, scheduled, near real-time, on-prem RAG, hybrid cloud RAG, vector DB-on-S3-based chat, with half a dozen databases (from vector to lexical search, including two S3-based formats).

StorageGRID S3 and E-Series block work identically in all on-premises scenarios, but there were minor differences to workflows (which sometimes use the API), network settings, and it allowed me to exercise utilities such as `sg-cosi`, SGII, and Kompromise both core and niche use cases. So the value was there despite the same "a bucket and three LUNs" pattern.

What I haven't experimented much with yet is agents. Yeah, I'm late to that party, but that's because I spent six months fixing potholes.

## AI agents

I plan to blog about agentic AI related to StorageGRID and E-Series:
- E-Series, when you buy NetApp storage for databases. (<- that's "the full stop"; check out some of the database posts or [the TopoLVM post](/2026/11/06/topo-lvm-netapp-santricity-e-series.html))
- StorageGRID, NetApp software (or appliances) for private cloud S3-compatible object storage

E-Series is very interesting here because databases for agentic use need a lot of performance and/or a lot of capacity. This is as correct as it was in January 2026.

- S3 for almost everything
- Some application-replicated block for databases
- Some R0 for ephemeral cache (KV cache, for example) and R10 for general cache and streaming services

![Datalake Pattern with E-Series](/assets/images/eseries-datalake-storage-layout-02.png)

Agentic use cases are mostly about databases. Most of them tier to S3. Sometimes it's just S3 with cache and log on block (i.e. [datalakes](/2026/06/20/lakekeeper-iceberg-rest-catalog-netapp-eseries.html), which are increasingly used to store agent history as well embeddings). I've blogged about several such databases (including [YugabyteDB](/2026/09/21/yugabytedb-netapp-storage-eseries.html), but related to agentic use).

### MCP

MCP isn't "agents", but it can be used by agents.

I want to revisit was MCP. I wrote a "getting started" post for SolidFire MCP [last year in May](/2025/05/20/get-started-with-netapp-solidfire-mcp-server.html) and it just didn't seem very useful. I think the reason was it was for SolidFire, which is already easy to automate *and* VS Code had various security precautions that destroyed the little value that MCP offered over what any SolidFire user could do with faster in PowerShell.

My second attempt was for [file-and-share analytics](/2025/06/05/simple-filesystem-and-s3-analytics-and-mcp.html) which seemed genuinely useful to me. The VS Code restrictions were less but still existed. It wasn't so awful and the tools were for querying a custom database/API which, without a front-end or CLI, couldn't be easily accessed.

After that, I wrote two other posts about MCP - one was for data migration to E-Series, another for E-Series performance testing - but it just didn't seem useful enough.

That was before NetApp had any official MCP stuff (so not much awareness existed even internally) but, even today, I rarely hear anyone actually uses it with storage. Maybe people do, but don't share.

`tldr;` I haven't done any MCP stuff for these products because it seemed useless, and I'm *not going to* because it *still* seems useless. But I'm interested in trying those other use cases.

## S3 Tag-on-Upload

As you can see in [the second "anti-virus scanning for StorageGRID" post](/2024/01/29/antivirus-scanning-for-on-premises-s3.html), it's not a trivial topic and while "post v2" was better, I wasn't happy with the outcome.

So... anti-virus, MCP, agents. 

### Walk-through

I have a guy who shares a bucket for team's content uploads.

![guy](/assets/images/kompromise-lite-tag-on-upload-01-tenant.png)

Team members post all sorts of crap to the bucket, and while warnings to team members happen "out of band", the guy needs a way to flag and deal with undesirable content.

Webhook notifications for the `shared` bucket are configured according to Kompromise conventions:

![Platform Web services setup for Webhook](/assets/images/kompromise-lite-tag-on-upload-02-tenant-platform-services--webhook.png)

I configure the bucket to use this Webhook endpoint. Then - when people upload stuff to it - StorageGRID Web notifications hit my [Kompromise Lite](https://github.com/scaleoutsean/kompromise) Webhook server.

"Lite" is called Lite because it's much simpler than "full" Kompromise stack (which I haven't yet finished - it has NATS, AIS and also runs on Kubernetes). But at least Lite is on Github. And - to satisfy JVM fanatics and Apache purists - the Lite example uses Kafka rather than NATS. F-yeah!

Anyway, in Lite Kafka is where Webhook data is surfaced  as topics for consumers.

![Kompromise Lite - Kafka](/assets/images/kompromise-lite-tag-on-upload-03-kompromise-lite-kafka.png)

This is where MCP comes in. In the past, I'd have a dispatcher and then some rigid pipeline (including for "full" Kompromise stack, as well as in the anti-virus posts). Here, it's different.

- MCP watches Kafka events
- MCP agent looks for upload events

![MCP Agent log](/assets/images/kompromise-lite-tag-on-upload-04-mcp-agent.png)

- MCP agent checks the type of file
  - executable files are scanned for viruses
  - images are scanned for adult content
  - if either is detected, the image is tagged 
- MCP agent has tools
  - antivirus 
  - model for detecting "adult content"

No virus, but adult (detection example A):

![MCP Agent tasks](/assets/images/kompromise-lite-tag-on-upload-05-mcp-agent-work.png)

Virus and another adult image (detection example B):

![MCP Agent tasks](/assets/images/kompromise-lite-tag-on-upload-06-mcp-agent-work.png)

Because these come and go, I also have a dashboard where I can see stuff in order to see what the heck is going on.

![MCP UI](/assets/images/kompromise-lite-tag-on-upload-07-mcp-ui.png)

"Events" is "objects scanned" and always goes up (doesn't tell me much useful, but it tells me the thing works), but when something interesting happens, certain counters change.

![MCP UI and Kafka log](/assets/images/kompromise-lite-tag-on-upload-08-mcp-kafka-action.png)

You can also see that Kafka entries are much more detailed with "real" content.

MCP UI makes it easy to see the details than looking at Kafka topic events.

![MCP agent log](/assets/images/kompromise-lite-tag-on-upload-10-mcp-agent-log.png)

The issue is you won't be able to catch everything when there are many uploads or hours later.

Of course, we can fix that with logging and longer term dashboards - something that I'm rather familiar with (I did that for file sharing MCP last year) - but in this PoC I just needed to see that it works, not what it did yesterday.

The other place where you can see concrete outcomes is object tags. 

![MCP agent-tagged items](/assets/images/kompromise-lite-tag-on-upload-09-mcp-tagged-items.png)

The last image is tagged with `adult=true`. 

### Considerations 

- The possibility of tagging objects was mentioned in that AV post v2. I finally explored it in an automated way
- Anti-virus scanning tool I used here is generic (actually, not even generic - it detects just Eicar and nothing else). I do have automated API callers for ClamAV from the BeeGFS AV-related posts and Virus Total (in CI), but everyone has a different one anyway (StrikeForce, Trend AI, etc.) so it's just a distraction
- Adult content detection model was another freeware. Like with AV, you can get very good ones and call them the same way, but these things differ in subtle ways so everyone prefers a slightly different approach. I won't even recommend this one, because it did not work well.

Let's see:

- `nsfw-ish-naked-painting.jpg` was not flagged as adult, although it was the "worst" (it was an art piece, oil on canvas from the 1800s). Even that wasn't unsafe for workplace - you could probably find similar paintings in a nearby museum or art gallery. I first used this in the hope I could trigger detection without storing pornographic content on disk.
- `nsfw-anime-milfs.jpg` *was* flagged as adult, although there's nothing adult about it. It's an anime cartoon screenshot with absolutely no nudity. It is suggestive, but there's no nudity in it.
- `pumping-iron.png` from detection example B, *was* flagged as porn. 
![MCP agent-tagged item pumping-iron.png](/assets/images/kompromise-lite-tag-on-upload-11-pumping-iron.png)

The oil painting could potentially be tagged in some cases (not in most museums, art galleries, etc.), but some models tolerate nudity in paintings, so that outcome was overwhelmingly correct. The anime cartoon and the photo should not have been tagged. Adult content detection failed in over 50% of cases (although sample size was very small)!

I know I can adjust detection sensitivity, tune parameters, or even "use a better model", but that's not the point. The points are:
- it's not good for production unless you have a person in charge of just this. You'd waste more time on fiddling with the model than it'd cost to pay for a good tool. Get the proper model if you need it to work right and focus on where you can add value. Use a crappy freeware model and you'll waste time dealing with support escalations, compliance and legal "situations".
- MCP agent just uses returned results, so the poor detection results aren't a big problem for this demonstration - it's just an interesting aspect of buy vs. build. You can build (or assemble) a NSFW model, as well as the entire stack, but even commercial stacks work the same way.

Malware detection worked well because it was a straightforward hash match and didn't use heuristics to detect "novel" or "previously unknown" viruses. It could detect Eicar, it saw Eicar, and it tagged the object.

Image (and/or video) detection is harder, but we should focus on what we can improve. There's nothing I can possibly add to the topics of AV and content detection, but related to StorageGRID and S3 in general:
- image tagging looks like a very good choice. Applications can filter on tags and drop serving suspected viruses and not show (or show pixelated) images
- we can add multiple actions, such as auto-removal of certain content, such as viruses, when confidence is very high, for example, or when buckets are used in public-facing services for which there may be fines
- because these buckets/objects may need fiddling with, versioning should usually be enabled

MCP seems useful here. I could write Python node that uses the same rules to do the same thing. It'd harder to adjust, but more reliable. What MCP gives me is more flexibility; for example, I can add extra tools very easily.

### Possible next steps

There's a bunch of extra things that can be done to explore these integrations further and improve the workflow:

- Additional skills and tools for this workflow
- Human-in-the-Loop as an option for "re-instantiation" or final removal
- Kompromise "Full" has S3 cache; I can download large objects for the pretend-purpose of processing them in parallel, just to have an excuse to examine multiple agents collaboratively working on shared data. In part on AIS, and in part sharing agent memory in a DB

I'd like to create a better MCP stack, but I already know how to do that (to a degree) and beyond that I'd rather leave it to the AI guys. In terms of data processing, there are other tasks that MCP agents could assist with such as guardrails, cleansing (PII and other sensitive information) removal, but that's like anti-virus, mostly a matter of calling other tools (which may be good or bad tools, but not something I am expected to deliver; I just need to call them). It's interesting and useful, but also more of the same.

I am much more interested Human-in-the-Loop because that concerns StorageGRID management API actions. I am also interested in multi-agent workflows, because that concerns parallel access to data and/or database (BeeGFS, E-Series).

## Conclusion 

Agentic workflows with StorageGID are interesting and useful.

Kompromise Lite makes these workflows easier because its Webhook notifications are better than plain StorageGRID notifications and documentation is slightly more detailed (see the readme in the Github repository).

But, we could use "plain" StorageGRID notifications instead. I didn't *need* Kompromise for this agentic workflow. There's no "secret sauce". I used Kompromise Lite in order to make sure it can work (since I haven't heard of anyone who tried to use it) and because I wanted richer S3 notifications that StorageGRID has, which is something I will need in the future demos.

We can create useful workflows easily because it's not block or file, but S3, storage. Did you notice I did not do any "admin stuff" on StorageGRID? I didn't need to. It's an API-driven storage service. I simply tagged the object using standard AWS S3 API and solved the problem. I could have deleted the object without doing anything else, because it would have remained as a non-current version. How would I do that with LUNs attached to hosts I don't control, or file shares? I could run agents on all those servers and have another agent that tells them what to do, but that'd be worse - not better. It can't be done better than with S3.

I think I've improved this workflow compared to the AV post v2 thanks (in part) to Kompromise and MCP and the improvements make it easier to integrate StorageGRID in agentic workflows (which is something that isn't a pressing concern for a stand-alone demo, but needs to be mentioned because it's one of those "sensitive" data workflows - it's not a backup job that can fail today because it will succeed tomorrow).

My likely next steps in this area involve Human-in-the-Loop for possible StorageGRID-related remedial actions, as well as multi-agent workflows where I can make use of databases or datalakes.

## Appendix A: Demo

![S3 Tag on Upload](https://rumble.com/v7ipxi6-storagegrid-s3-tag-on-upload.html) - 4m16s
