# What's new in NetApp StorageGRID 12.1 and `sg-cosi` 0.5.4

What is new in NetApp StorageGRID 12.1 and sg-cosi 0.5.4

## StorageGRID 12.1

NetApp StorageGRID 12.1 was announced last month, but the packages were made available for download just two days ago. 

Yesterday I upgraded my StorageGRID cluster and used some of the new features. I won't comment on all of them and if you just want to see what's new, click [here](https://docs.netapp.com/us-en/storagegrid/release-notes/whats-new.html) to see an unopinionated fact sheet with "What's New in 12.1".

The choice of server-side time filters in **bucket snapshots** has been expanded. Bucket snapshots is great feature, but it seems most people have no idea what to do with it although the StorageGRID documentation explains several highly pertinent use cases. Personally, I have plenty of ideas (some are described [here](/2026/06/13/storagegrid-sg-cosi-branch-snapshots.html), some elsewhere, and I have some new demos I haven't shared yet), but it looks like it may take another 6-12 months for me to find someone who gets it. 

12.0 allowed only `before` filtering, and bizarrely, you could chose a future date. They made that even worse (or better, if you disagree) in 12.1 and added support for `after`, `between` and `exclude`. All allow future dates.

![Snapshot options for a bucket](/assets/images/storagegrid-12_01_00_bucket_snapshots.png)

**SSO with OIDC** is [finally supported](https://docs.netapp.com/us-en/storagegrid/admin/learn-about-setting-up-sso-oidc.html). Entra ID, Keycloak, Octa, and PingFederate are part of the first wave. This is interesting from several perspectives; one is that StorageGRID users who use federated authentication now have these additional, modern options, but there's a less obvious one, too: with the appearance of initiatives such as [OpenSharing](/2026/07/22/opensharing-volumes-tables-versity-vgw-netapp-storagegrid.html) - which can authenticate the same OIDC users - one can take advantage of the same backend for authentication and authorization across StorageGRID and various sharing schemas.

**Non-functional S3 REST API headers** isn't a feature, but a `noop`. It doesn't happen often that not doing anything is considered a "feature" but in this case we have an exception and `If-Match` and `If-None-Match` are accepted but non-functional. For now this merely prevents issues with certain clients. May they become functional in next release!

**Kafka endpoints and mTLS authentication** allows better security for outgoing Kafka notifications. I couldn't believe they left Webhooks out. If you need mTLS for Webhook notifications, "contact your NetApp representative".

**Moar buckets**! Up to 20,000 buckets can be created for each S3 tenant account. You probably won't run out of buckets even if you generously avail yourself of the bucket snapshot feature.

**Improved Link Cost configuration**. As the term suggests, these are link cost and latency hints for certain StorageGRID services. As recently as 12.0, the UI to set them was very dated. Now it's been modernized. It doesn't change how it works, but those who have multiple sites and use the Web UI to configure link costs among them will appreciate the new UI.

There are other very nice features, but I don't want to duplicate the entire What's New from TFM.

## `sg-cosi` 0.5.4

[COSI is garbage](/2026/06/07/cosi-v1alpha1-is-garbage.html), but that's not a reason to not update a COSI driver if you have one and storage has added COSI-related features.

[`sg-cosi`](/2026/06/07/cosi-v1alpha1-is-garbage.html#sg-cosi) was created for StorageGRID 12.0 and the key workflow is the one that relies on bucket snapshot functionality. As we've just seen above, v12.1 supports to 20K buckets per tenant, which makes the use of COSI with bucket snapshots even more attractive: low risk to Tenant and Grid administrators, high convenience to teams that rapidly iterate with base buckets (i.e. "source" buckets from which snapshots get created).

Snapshot buckets is what gets created in the default "greenfield" `sg-cosi` workflow. They are also read-only, so that they barely create any trouble.

Since StorageGRID 12.1 expanded snapshot options, `sg-cosi` followed and `exclude`, `range`, and `after` have been added to the original `before` time filter option. 

I think allowing future datetime(s) in these filters doesn't make any sense, so in `sg-cosi` `now()` was, and still is, the datetime closest to the future that can be set.

As we all know, there are people who think using future dates is very useful and safe (I doubt that, but from the feature we know they exist). To make such "power users" happy, `sg-cosi` v0.5.4 lets the user remove this sanity check with `DISABLE_FUTURE_DATETIME` set to `false`.

Here's an example of a snapshot bucket created with `sg-cosi` using `between` filter that covers period between 2026-**06**-23 07:59:00 GMT and 2026-**07**-23 07:59:00 GMT. You may want to create such a snapshot if you need to inspect objects and their versions created during specific time period.

![sg-cosi read-only snapshot with between filter](/assets/images/storagegrid-12_01_01_bucket_snapshot_workflow.png)

As I mentioned in previous `sg-cosi` and bucket snapshots posts, you can do that with client-side filtering, but this frees you from having to use such filters in the first place and is both more efficient and user-friendly.

When you think of it, SIEM and auditing is actually one of the few valuable use cases for COSI, especially for `sg-cosi` with these read-only snapshot-derived buckets: both these snapshot buckets and their tenants are temporary, which offloads work from Tenant Administrator or at least does not add to it.

In course of testing `sg-cosi` 0.5.4 I realized that there's as limit to how far in the future a snapshot bucket date can be (5 years) and I double-checked [in TFM](https://docs.netapp.com/us-en/storagegrid-121/tenant/manage-branch-buckets.html#time-filter).

![Future timestamp is now+5Y](/assets/images/storagegrid-12_01_02_bucket_snapshot_future_date_limit.png)

Imagine creating a `between`-style bucket snapshot that filters objects created between 2029 and 2030. What does that even mean???

It's weird that future dates are allowed. And it's also weird the limit is set to now plus 5 years. This time filter that allows future dates is one of the most bizarre features I've seen in StorageGRID in this decade.
