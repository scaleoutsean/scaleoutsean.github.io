# Use SGII and sg-cosi to provide access to AI in public cloud

This post showcases a workflow for AI in hybrid cloud that is free of storage management and requires no "storage admins" in the workflow

## Introduction 

Recently I saw a pretty funny workflow-come-book for "solving" data access for AI in a hybrid cloud scenario where "AI" is in the cloud.

I've said countless times by now, on-premises S3 storage solved that "challenge" 10 years ago, so that "solution" is *fundamentally flawed* and on top of that almost guarantees a [DMV-like](https://noai.duckduckgo.com/?q=dmv+jokes) experience.

Can we do better with StorageGRID? Probably, but if you look it up, NetApp StorageGRID lacks any recipes, solutions or best practices for such workflows, as if it works out-of-the-box. It doesn't.

I've given practical examples on how to actually do that in [here](/2026/09/08/opensharing-data-mobility-netapp-eseries-storagegrid.html) and other posts, mostly analytics-related. 

Last week I touched upon an "indexing and search" use case in the post [](/2026/11/04/ragdoll-serenedb-storagegrid.html). That's for unstructured data.

In Appendix A - at the bottom of that post - you can see some examples. I won't repeat that, but I'll share a screenshot of how that works for me now:

![AI docochat](/assets/images/sgii-hybrid-cloud-workflow-01-ai-chat.png)

All right, so that works as described and my "SOHO" workflow with "Project Ragdoll" (also described in that post) is very nice for that particular use case.

But, seeing that hilarious "solution" mentioned at the top, I thought about formalizing my own workflow for the purpose of demonstration.

## Hybrid cloud workflow with SGII and `sg-cosi`

If we wanted something more serious, we'd have multiple stakeholders, not just the initiator, but also an approver, possibly multiple.

StorageGRID is very flexible, so it *can* be made more complex than this, but at the very least, there would be two guys involved: the AI guy and the approver guy.

![SGII and sg-cosi in hybrid cloud](/assets/images/sgii-hybrid-cloud-workflow-00-workflow.png)

And we need to use templates for these things, to avoid mistakes and sneaky "customizations".

## How's it work?

We don't need anything new:
- StorageGRID supports bucket snapshots
- You can roll your own script or workflow

That's all.

Here's what I do:
- Kubernetes-based bucket snapshot workflow: I can create snapshots with `sg-cosi` [as explained here](/2026/09/18/storagegrid-s3-cosi-snapshot-leases.html) and 
- Non-Kubernetes based snapshot workflow: I use SGII, StorageGRID Incremental Inventory tool, [described here](/2026/10/08/kompromise-storagegrid-instaclustr-opensearch.html#whats-the-role-of-sgii-again)

What's the difference?

- Kubernetes-based: `sg-cosi` creates a read-only snapshot that auto-expires, which is perfect for situations where you want to delete it anyway after indexing is done. But, you may have objects that you don't want indexers or AIs to read. So you need to apply extra ACLs and create a sitemap by yourself.
- Non-Kubernetes: SGII creates a snapshot and builds a bucket inventory. With that, we use SGII query to create a prefix- and extension-filtered object list. That is used to create a "scoped-down" sitemap.xml and then we tighten ACLs before getting approvals and starting a proxy to expose it to the cloud. We need to remember to tear that snapshot down later, as SGII isn't a service and doesn't manage stuff like Kubernetes COSI does.

Depending on workflow, you could use `sg-cosi` to create a snapshot **and** SGII (container-packaged, it can run in Kubernetes as well) to take care of indexing, query filtering and snapshot deletion.

I have not crammed these "extras" into `sg-cosi`'s Snapshot Lease feature because they aren't supposed to be in it.

Additionally, now that NetApp Trident 2026.10 supports COSI, you aren't supported to run two COSI drivers for StorageGRID at the same time, so if you use NetApp Trident COSI, then `sg-cosi` component cannot be used - you'd have to use Trident COSI or own scripts for that part, so SGII is stand-alone.

The workflow details (examples, sample ACLs, and more) will be posted in the `sg-cosi` examples in coming days, but to make this post less ambiguous:

- (1) Use SGII to create a snapshot, then SGII query to dump desired file list to a JSONL file:

```sh
$ sgi query objects \
  --manifest s3://sgi/scans/<chain>/<baseline-scan-time>/manifest.json \
  --prefix web/ \
  --latest-only \
  --sample 0 \
  --format jsonl \
  --output web-objects.jsonl \
  --env-file kompromise-cosi-snapshots/.env
```

- (2) Data prep script creates `sitemap.xml`:

```sh
$ python3 data-prep.py \
  --input web-objects.jsonl \
  --base-url https://proj1a2b3c.public.company.com/ \
  --extensions .html,.htm,.md,.txt \
  --output SITEMAP
```

- In step (3) above, Approver has the ability to apply ACLs on the bucket, and push Web server configuration to deploy. We'd use a canned template for ACLs.

This makes the URL and sitemap accessible to your scanner in the cloud. 

![Scan from the cloud](/assets/images/sgii-hybrid-cloud-workflow-02-sitemap-scan.png)

We could package steps 1-3 in a simple API server for these stages of our workflow.

In the last step, some kind of indexer reads sitemap.xml, gets listed objects, creates embeddings and indexes and uses them the same way I do in that screenshot above (where I do not provide fancy URLs to on-prem StorageGRID URLs, but I could) - AI-assisted search, RAG, chat...

After download (from the cloud) is done, you can remove the proxy and snapshot bucket. The read-only nature of SGII makes it impossible to "update" the snapshot with new documents, although sitemap.xml could be updated and - after another approval - reloaded.

In a less secure workflow we can manually create writable StorageGRID snapshots, but I'm not interested in such "pet" approaches because I don't believe that they should exist outside of datalake or similarly comprehensive management workflows.

If I have a datalake, then I keep my object lists in a table, and can use it to create [OpenSharing](/2026/09/07/opensharing-iceberg-netapp-eseries-storagegrid.html) "file" shares on the fly.

## Conclusion

My SGII-enabled workflow is convenient, fast, secure and works correctly.

Time required to create a SGII inventory table is variable and depends on bucket object count, but can be seconds for buckets with 100K objects. With such buckets, you can have AI accessing your content in single-digit minutes, excluding turn-around time required for approvals or compliance checks.

For best experience and automation both `sg-cosi` and SGII can be used together, although stand-alone SGII is sufficient for what you see in the diagram (tear-down has to be taken care of in a reverse workflow and SGII doesn't delete buckets, objects/data or snapshot buckets).

`sg-cosi` - when Trident COSI isn't used - adds value with automated tear-down of snapshot bucket, proving its design, scope, and value beyond the [ridiculous COSI idea and specification](/2026/06/07/cosi-v1alpha1-is-garbage.html).
