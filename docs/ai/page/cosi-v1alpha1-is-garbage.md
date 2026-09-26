# COSI and sg-cosi

COSI v1 Alpha 1 - by tech bros, for tech bros

## Introduction

NetApp doesn't have any COSI drivers, so work-wise COSI isn't a topic for me.

Of course, I *am* aware of it, keep an eye on it and sometimes ask others (builders and users of object storage) what they think about COSI v1alpha1. Most of those who tried it tell me they think it's garbage, while the rest has no opinion (as they see no use for it).

Recently, I've decided to take another look at it because I'd been working a lot with Kubernetes this year (see [this](/2026/06/05/above-and-beeond-beeond.html), [this](/2026/06/03/cloud-native-postgres-kubernetes-netapp-eseries-backup-restore.html) or all the way back to early 2026).

The first of the linked posts is about doing again something I already did with MinIO and BeeGFS in [2022](/2022/04/09/beegfs-csi-introduction.html#deploy-and-use-beegfs-csi), a demo of S3 gateway on BeeGFS backed by E-Series. MinIO [pulled the rug](/2025/06/06/whats-minio-up-to.html) on its freeloading users late last year, and since then I'd been thinking about doing something with COSI and the new [E-Series CSI drivers](/2026/01/20/kubernetes-netapp-eseries-santricity-csi.html). I'll return to this topic shortly.

## COSI v1alpha1

While looking at the COSI specification, implementation and documentation last weekend, I concluded COSI v1 Alpha 1 is a poorly thought-out, sloppily executed idea thought up by people with zero awareness of how S3 works and how it's used and managed in enterprise environments.

I wondered: who the hell came up with this nonsense? Then I found [this post from in 2022](https://kubernetes.io/blog/2022/09/02/cosi-kubernetes-object-storage-management/):

> Introducing COSI: Object Storage Management using Kubernetes APIs
> By Sidhartha Mani (Minio, Inc) | Friday, September 02, 2022

![Thanks, MinIO!](/assets/images/cosi_is_garbage_01_thank_you_minio.png)

Oh, I see... 

![I'm not surprised](/assets/images/meme_i_m_not_surprised.gif)

Let's see about the supposed benefits of COSI as it was envisioned in v1 Alpha 1 (described in the that blog post above):

- Kubernetes Native - Use the Kubernetes API to provision, configure and manage buckets
- Self Service - A clear delineation between administration and operations (DevOps) to enable self-service capability for DevOps personnel
- Portability - Vendor neutrality enabled through portability across Kubernetes Clusters and across Object Storage vendors

Sorry, tech bro, almost no on-premises S3 user who uses object storage at scale cares about these things.

Also, let's not lose sight of the *complete* lack of situational awareness over an extended period of time, too! Why on earth would any hyperscaler or S3 storage vendor care about COSI?

- Hyperscalers don't have this problem. Their own solutions just work *within* their own cloud
- On-premises S3 vendors and even users don't have this problem either. Portability and self-services aren't problems!

After [MinIO's rug pull](/2025/06/06/whats-minio-up-to.html) last year (first gradually, when they removed Apache 2.0 License years ago, then suddenly), MinIOs interest in "making S3 apps and data more portable" seems to have waned.

Maybe that COSIeist Manifesto that aims to make it easy to migrate data off MinIO wasn't making their board of directors happy. For whatever reason, the MinIO's COSI dude [has been quiet in the COSI repository commits history since v1 Alpha 1](https://github.com/kubernetes/enhancements/commits/master/keps/sig-storage/1979-object-storage-support) and I don't see new ones, so it seems like they let Red Hat inherit all of that mess (there's one relatively regular contributor from Red Hat at this time).

![MinIO's COSI contributions](/assets/images/cosi_is_garbage_03_minio_cosi_commits.png)

In case you haven't noticed, COSI doesn't have the concept of Controller and Node. In CSI, a CSI Node needs to connect to CSI Controller which may be running elsewhere and be the only pod that can manage storage. Not in COSI, where the tech bros were laser-focused on convenience, so if you create a bucket and S3 keys, your COSI controller may connect to both S3 API (`mb cosi/my-bucket`) and management API (to issue S3 keys). 

### COSI v1alpha1 vs CSI

I'm a CSI user as well, so I naturally wondered how come CSI wasn't such a disaster.

CSI has had its problems over the years - several issues with the specification were discovered much later and in some cases the specification is still ambiguous. By now, CSI is much more mature than COSI's specification, so one could say it's unfair to compare COSI `v1alpha1` with today's CSI. But even the earliest CSI specs and implementations weren't such a disaster and positioning failure! (In terms of complexity, COSI is much closer to Docker storage drivers, really; I also used the early ones in [2016](https://github.com/solidfire/solidfire-docker-driver/commit/19704e5763b16ccf489051bfa618abbe7be58f8d) and I can tell you they did *not* suck.)

Could that be because CSI had storage vendors, hyperscalers and other **stakeholders** on board, and they clearly knew what problems needed solving, and how? Perhaps.

By the looks of it, the people behind COSI v1alpha1 knew neither. It seems they had one big thing going for them - an unshaken belief in the superiority of their ideas ([sound familiar?](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect)).

![COSI vs CSI](/assets/images/cosi_is_garbage_00_cosi_vs_csi.jpg)

COSI had an easier task than CSI. 

They had to build a basic, minimally viable, Kubernetes storage interface for provisioning *modern, cloud-native object storage*. And they failed.

From the 2022 announcement linked above:

> We want to add more authentication mechanisms for COSI buckets, we are designing advanced bucket sharing primitives, multi-cluster bucket management and much more. 

Riiiiiight. Except that nothing happened between the time the tech bros got excited in 2022 and this year, when COSI v1 Alpha 2 was finalized.

One hilarious detail: unless you name `metadata.name` **exactly** as your bucket name (see `spec.existingBucketID`), your "convenient" COSI access details will be completely useless because they'll contain a wrong bucket name (`metadata.name`) and you'll have to look up the correct bucket name from this Bucket object instead. 

```yaml
apiVersion: objectstorage.k8s.io/v1alpha1
kind: Bucket
metadata:
  name: analytics
spec:
  driverName: coke.sg.cosi.dev
  bucketClassName: sg-cosi-coke-default
  bucketClaim:
    name: analytics-bucket-claim
    namespace: sg-cosi-coke
  existingBucketID: analytics
  deletionPolicy: Retain
  protocols:
    - s3
  parameters:
    bucketName: analytics
```

Now, you may say "not a problem, I'll just make it consistent", but that's not how it works. Bucket is cluster-scoped. If anyone on the same cluster names their bucket `analytics`, you little plan may fall apart.

Well done, COSI tech bros!

## COSI v1alpha2

I haven't read or heard what anyone thinks about this. The feeling *I* have about the Alpha 2 specification is:

- Some enterprise-focused S3 vendors and their customers are now entrapped in a COSI nightmare. COSI v1alpha1 sucks, but there can be only one COSI, so they've become unwilling, Stockholm syndrome-affected participants. Maybe they are engaging and helping out in minor ways
- Some enterprise S3 users who got fooled into onboarding on COSI v1 Alpha 1 are passing feedback upstream
- Tech bros have taken a back seat

I think that's where the glimpses of sanity seen in the Alpha 2 specification are coming from.

Has Alpha 2 solved a bunch of Alpha 1 issues? Not really.

- COSI v1 Alpha 2 has not been implemented yet. For now it's just a plan. [There's one guy](https://github.com/kubernetes-sigs/container-object-storage-interface/commits/main/?after=46fde39f12f739a1f3d9b591c783ebc5d562c662+34) actively working on it, probably not because many need COSI, but because it'd look bad for Kubernetes and business (since some customers may now be invested (and stuck) in the lousy COSI v1 Alpha 1 workflows)
- The COSI repository README currently has this barely comprehensible note on Alpha 2

![Alpha 2](/assets/images/cosi_is_garbage_02_alpha2.png)

The "pre-release" thing is nonsense. Little from the Alpha 2 specification has been implemented, so this "pre-release" of Alpha 2 is currently better described as "Alpha 1 with some good bugs" (i.e. `v1alpha2` specs that technically break `v1alpha1` until Alpha 2 is fully delivered).

Few other thoughts:

- Alpha 2 specification has *many* changes compared to Alpha 1, most of them improvements. I'm not a big spec/standards guy so I don't know if that's a lot by KEP standards. Maybe it's extensive as it is because the Alpha 1 specification was garbage
- Alpha 1 talked about how different COSI was from CSI. Alpha 2 now heavily leans on, and borrows from, the CSI concepts and workflows. COSI may not be as different from CSI as they told us in 2022. Did we really need COSI as a separate "CSI"? Maybe we do, but the interest and contributions to COSI are so few that they're now excessively borrowing the CSI concepts, designs and workflows.
- The Alpha 2 specification has basic canned permissions. *Yo, bro, S3 users in healthcare now care about permissions! WTF, dude!?* But that is one of the parts that haven't yet been implemented, so don't get *too* excited about it

## What now

The idea that "self-service" or "portability" were high on the list of priorities for on-premise Object Storage users or vendors shows just how clueless the people who created COSI v1 Alpha 1 were.

Most heavy users of on-premises S3 are *heavily* regulated (FSI, healthcare, government, you name it). All deal with compliance (Object Lock enabled in compliance or governance mode), versioning, auditing and S3 implementation (not COSI) challenges.

No on-premises Object Store user can arbitrarily move their regulated data around, while unregulated data they have is semi-junk that can be `rclone`-d anywhere, so application and data portability is **not** a top concern - it's impractical and has nothing to do with COSI. COSI doesn't solve anything here. 

And almost no one cares about "self-service" either - it's mostly seen as an anti-feature (self-service S3 in BFSI - imagine that, what could possibly go wrong?) and at best as a minor feature for small sandbox environments. **Not** a significant concern either.

Well, at least Alpha 2 is less bad. Maybe MinIO's absence has helped!?

Practical matters, the way I see it, given that COSI `v1alpha2` is **not** available for use:

- Perform bucket lifecycle operations by yourself (Ansible, Terraform, operators)
- If developers need S3 for experimentation, they can [deploy](/2026/03/07/versity-s3-gateway-netapp-eseries-santricity-csi.html) Versity S3 Gateway container to their development clusters. No COSI. Just deploy VGW and down when you tear down the cluster. It's for in-cluster or in-namespace S3 closed to the world - why would anyone need COSI for that?
- There's a use case for temp/scratch S3 space (batch jobs, analytics, AI), just like it exists for temp/scratch shared filesystems (CSI). Because COSI Drivers hand out S3 credentials to anyone who asks within the namespace, I wonder if even this use case requires COSI integration as opposed to simply calling Webhooks (`?action=create&size=100T` and `?action=delete`) and using own canned scripts that work faster and more reliably with your environment (networks, firewalls and S3 storage)

After thinking about these topics for a while, I just don't see much need for bucket lifecycle management that I'd let COSI handle. (The other part is credentials management, which seems more useful).

In the Alpha 2 specification they say they envision a future where multiple namespaces will be able to share access to COSI-managed buckets and in Alpha 1 they said Cross Cluster portability (not portability of data, but of access) was another goal of theirs. It looks like someone has a solution and is looking for problems to solve. Most of these problems have already been solved by applications such as job schedules, or don't even exist.

To finish on a positive note: the Alpha 2 specification shows some signs of sanity. If Alpha 2 gets *implemented*, COSI might become usable for a small fraction of production use cases where on-premises Kubernetes applications need access to Object Storage.

Another good option would be if CSI took over COSI and made it into a CSI sub-project (CSI-O?), since COSI is copying as much as they can from CSI.

## `sg-cosi`

As a "not yet a fan" (of COSI), I put together `sg-cosi`, an opinionated vending machine for S3 credentials.

I don't implement bucket lifecycle because I see no value in it with `v1alpha1` workflows and features.

### What works

What does this vending machine for S3 access keys do?

- it issues S3 access/secret key pairs to anyone who asks in the namespace

That's it. You like?

For that, we must use pre-created buckets - the so-called "brownfield" mode. Our StorageGRID Tenant is called Coke.

StorageGRID admins do all that as usual - cluster admin creates a tenant, and sets a tenant admin password.

Tenant admin creates groups and users. They create and prime buckets, configure load balancers, TLS certificates, and more. There's no value in leaving this to COSI because we can already do all of this better elsewhere, thank you very much.

In Kubernetes, cluster admin deploy COSI controller and namespace admin uses Helm to install `sg-cosi` in the `sg-cosi-coke` namespace that tenant "Coke" will use.

```sh
$ kubectl get pods -A
NAMESPACE                         NAME                                                   READY   STATUS    RESTARTS        AGE
container-object-storage-system   container-object-storage-controller-64ff5586fb-kddgc   1/1     Running   0               3h55m
kube-system                       coredns-7d764666f9-7k7xf                               1/1     Running   0               5h28m
kube-system                       etcd-minikube                                          1/1     Running   0               5h29m
kube-system                       kube-apiserver-minikube                                1/1     Running   0               5h29m
kube-system                       kube-controller-manager-minikube                       1/1     Running   0               5h29m
kube-system                       kube-proxy-9z96x                                       1/1     Running   0               5h28m
kube-system                       kube-scheduler-minikube                                1/1     Running   0               5h29m
kube-system                       storage-provisioner                                    1/1     Running   1 (5h28m ago)   5h29m
sg-cosi-coke                      sg-cosi-coke-sg-cosi-driver-5c755dd896-5b26c           2/2     Running   0               120m
```

Now we're talking just tenant-level:
- Our COSI driver needs credentials for the Coke tenant
- Our COSI users belong to Team Coke (namespace `sg-cosi-coke`)

As the Storage Tenant Admin for Coke, I create a COSI user to dish out S3 keys in Kubernetes namespaces for Coke and then I let COSI use this account. This *could* be the Tenant root account, but I'd rather have a dedicated COSI-only tenant root account, `Cosi Admin`.

```yaml
{
  "responseTime": "2026-06-08T09:50:54.590Z",
  "status": "success",
  "apiVersion": "4.2",
  "data": {
    "id": "63823499-776f-4b7d-b982-6d59de56d7c0",
    "accountId": "72383031060298248956",
    "fullName": "cosi-admin",
    "uniqueName": "user/Cosi Admin",
    "userURN": "urn:sgws:identity::72383031060298248956:user/Cosi Admin",
    "federated": false,
    "memberOf": [
      "a5e9cbcb-181b-4506-9551-fb1a7c52c820"
    ],
    "disable": false
  }
}
```

What's that group `a5e9cbcb`? It's `group/COSIadmins`.

```json
{
"id": "a5e9cbcb-181b-4506-9551-fb1a7c52c820",
"accountId": "72383031060298248956",
"displayName": "cosi-admins",
"uniqueName": "group/COSIadmins",
"groupURN": "urn:sgws:identity::72383031060298248956:group/COSIadmins",
"federated": false,
"managementReadOnly": false,
  "policies": {
    "management": {
        "manageAllContainers": true,
        "manageEndpoints": true,
        "manageOwnContainerObjects": true,
        "manageOwnS3Credentials": true,
        "rootAccess": true,
        "viewAllContainers": true
    }
  }
}
```

This is where you could create and put a bunch of them (Cosi Admin Coke, Cosi Admin Coke Lite, Cosi Admin Coke Zero), but on the other hand, StorageGRID isn't really made for that, so file this under "yes, you could do that, but why would you do that?" - perhaps grouping doesn't really make much sense here? (I'll answer this later.)

Since I'm not letting COSI create any buckets, I crete one manually. It's called `coke`.

In Kubernetes, `Bucket`s are global.

```yaml
apiVersion: objectstorage.k8s.io/v1alpha1
kind: Bucket
metadata:
  name: sg-brownfield-coke
spec:
  driverName: sg.cosi.dev
  bucketClassName: storagegrid
  existingBucketID: coke
  bucketClaim:
    name: my-coke-claim
    namespace: sg-cosi-coke
  deletionPolicy: Retain
  protocols:
    - s3
  parameters:
    bucketName: coke
``` 

At the bottom of this output you can see it refers to a StorageGRID bucket called `coke`.

```sh
$ kubectl describe bucket sg-brownfield-coke -n sg-cosi-coke
Name:         sg-brownfield-coke
Namespace:    
Labels:       <none>
Annotations:  <none>
API Version:  objectstorage.k8s.io/v1alpha1
Kind:         Bucket
Metadata:
  Creation Timestamp:  2026-06-08T09:29:24Z
  Finalizers:
    cosi.objectstorage.k8s.io/bucketaccess-bucket-protection
  Generation:        2
  Resource Version:  12504
  UID:               0a7b4b09-1e63-475d-b802-1988acc660cd
Spec:
  Bucket Claim:
    Name:              my-coke-claim
    Namespace:         sg-cosi-coke
    UID:               9206ff28-c953-4f20-9b0f-3451cde69e8f
  Bucket Class Name:   storagegrid
  Deletion Policy:     Retain
  Driver Name:         sg.cosi.dev
  Existing Bucket Id:  coke
  Parameters:
    Bucket Name:  coke
  Protocols:
    s3
Status:
  Bucket Id:     coke
  Bucket Ready:  true
Events:          <none>
```

Kubernetes admin then creates a `BucketClaim` on this bucket in the `sg-cosi-coke` namespace. This ties the bucket to the Coke namespace `sg-cosi-coke`.

```yaml
Name:         my-coke-claim
Namespace:    sg-cosi-coke
Labels:       <none>
Annotations:  <none>
API Version:  objectstorage.k8s.io/v1alpha1
Kind:         BucketClaim
Metadata:
  Creation Timestamp:  2026-06-08T09:29:39Z
  Finalizers:
    cosi.objectstorage.k8s.io/bucketclaim-protection
  Generation:        1
  Resource Version:  11304
  UID:               9206ff28-c953-4f20-9b0f-3451cde69e8f
Spec:
  Bucket Class Name:     storagegrid
  Existing Bucket Name:  sg-brownfield-coke
  Protocols:
    s3
Status:
  Bucket Name:   sg-brownfield-coke
  Bucket Ready:  true
Events:          <none>
```

We need to program our vending machine to cough up some candies: applications operating in this namespace create `BucketAccess` claims, and the machine gives them S3 keys.

Example:

```yaml
apiVersion: objectstorage.k8s.io/v1alpha1
kind: BucketAccess
metadata:
  name: my-coke-access
  namespace: sg-cosi-coke
spec:
  bucketClaimName: my-coke-claim
  bucketAccessClassName: storagegrid # Determines tenant group ID based on Helm class parameters
  credentialsSecretName: coke-s3-credentials # K8s will inject keys into this Secret
  protocol: s3
```

The vending machine kicks in and creates candy on demand, and `spec.credentialsSecretName` is the place to deliver it. In the namespace, obviously.

```yaml
Name:         my-coke-access
Namespace:    sg-cosi-coke
Labels:       <none>
Annotations:  <none>
API Version:  objectstorage.k8s.io/v1alpha1
Kind:         BucketAccess
Metadata:
  Creation Timestamp:  2026-06-08T09:54:40Z
  Finalizers:
    cosi.objectstorage.k8s.io/bucketaccess-protection
  Generation:        1
  Resource Version:  12627
  UID:               8d9dd164-c70b-4b57-9aaf-0b45239739d7
Spec:
  Bucket Access Class Name:  storagegrid
  Bucket Claim Name:         my-coke-claim
  Credentials Secret Name:   coke-s3-credentials
  Protocol:                  s3
Status:
  Access Granted:  true
  Account Id:      b7f0bf92-aa72-4c04-a198-85990d4609f5
Events:            <none>

```

The candy gets stored in that Kubernetes secret. Shake it out with with: `kubectl get secret -n sg-cosi-coke` 

```sh
$ kubectl get secret coke-s3-credentials -n sg-cosi-coke 
NAME                  TYPE     DATA   AGE
coke-s3-credentials   Opaque   1      3h33m
```

In order to access, unpack `coke-s3-credentials`.

```json
{
  "metadata": {
    "name": "bc-8d9dd164-c70b-4b57-9aaf-0b45239739d7",
    "creationTimestamp": null
  },
  "spec": {
    "bucketName": "sg-brownfield-coke",
    "authenticationType": "Key",
    "secretS3": {
      "endpoint": "https://192.168.1.211:10443",
      "region": "us-east-1",
      "accessKeyID": "9EACWVK1YERKCIBWNQYH",
      "accessSecretKey": "----------------"
    },
    "secretAzure": null,
    "protocols": [
      "s3"
    ]
  }
}
```

That access key pair does **not** belong to your StorageGRID COSI admin guy. 

It's a secret for a throw-away tenant in the tenant group defined in that `BucketAccessClass`, or "default" bucket access class as fallback. See that accessKeyID ending with `QYH`? Here it is:

![COSI machine user](/assets/images/cosi_is_garbage_04_sg_cosi_user.png)

It may be a little concerning that a random COSI account has been created and added to the COSIadmins group. That's how it was configured, but it doesn't have to be that way.

We can change that to add these randos to regular groups, a read-only group even.

![COSI machine user](/assets/images/cosi_is_garbage_05_sg_cosi_ba-tenant-group-id-bucketaccessclass.png) 

As these random accounts - and now maybe even random groups - get created left and right, soon you end up with 200 pages of randos in **Access Management** > **Users**.

![The smarter you get the worse it is](/assets/images/cosi_is_garbage_07_sg_ba_account_junk.png)

Long story short, the idea to create `group/COSIadmins` is not going to work except for the most trivial cases. You'll need entire tenants dedicated to COSI. End of story.

They've added another, limited sidecar in Alpha 2 (not yet implemented, of course).

Note that the rando accounts and credentials created by COSI can be abused by anyone who gets them and can access the tenant S3 endpoint for Coke. With some luck and skill, one can create a new namespace, fire up an `rclone` pod and exfiltrate Coke's business data to a 3rd world hellhole without breaking a sweat.

If you can't tell *who exactly from Kubernetes* is sucking data out of StorageGRID, maybe you shouldn't use COSI in environments that can exfiltrate data.

Compared to CSI, COSI is simpler and architecturally easier. There's not much going on in there.

![sg-cosi 0.5.0](/assets/images/cosi_is_garbage_08_sg-cosi.png)

But they still managed to screw it up.

### What doesn't (work)

Regarding bucket lifecycle management with COSI... Yeah, no.

I disabled that in the driver code.

The way bucket creation works is: **ask, and it shall be given you**.

![Dude, WTF?](/assets/images/dude-wtf.png)

*Yo, bro - check this out! I just apply this BucketClass claim and I get 100 TB of free S3 storage! How cool is that?*

```sh
$ kubectl describe BucketClass storagegrid-greenfield
Name:             storagegrid-greenfield
Namespace:        coke
Labels:           <none>
Annotations:      <none>
API Version:      objectstorage.k8s.io/v1alpha1
Deletion Policy:  Retain
Driver Name:      coke.cosi.dev
Kind:             BucketClass
Metadata:
  Creation Timestamp:  2026-06-06T10:38:44Z
  Generation:          1
  Resource Version:    5365
  UID:                 e9139670-6c90-4f89-8a7d-5fb21cb7766a
Events:                <none>
```

A `dynamic-coke-claim` would be created to get you a throw-away S3 bucket. 

```sh
$ kubectl describe BucketClaim dynamic-coke-claim 
Name:         dynamic-coke-claim
Namespace:    coke
Labels:       <none>
Annotations:  <none>
API Version:  objectstorage.k8s.io/v1alpha1
Kind:         BucketClaim
Metadata:
  Creation Timestamp:  2026-06-06T10:38:44Z
  Finalizers:
    cosi.objectstorage.k8s.io/bucketclaim-protection
  Generation:        1
  Resource Version:  5374
  UID:               9ca56954-3738-49e9-b515-8229baa99c43
Spec:
  Bucket Class Name:  storagegrid-greenfield
  Protocols:
    s3
Status:
  Bucket Name:   storagegrid-greenfield9ca56954-3738-49e9-b515-8229baa99c43
  Bucket Ready:  true
Events:          <none>
```

Then we do our thing with S3 access keys, use the bucket, and once we are done, we delete users' objects and users' secrets (S3 access/secret keys), and finally we delete the bucket claim itself.

Bucket Create is at the beginning, and Bucket Delete is at the end (unless you use `Retain`, which is the same deletion I can get by manually deleting that BucketClaim, and the bucket is only removed from Kubernetes, not from StorageGRID).

So, these two operations seem of very little value. I'm pretty sure automating them would waste more time than it would save (given how COSI `v1alpha1` and StorageGRID work), so ... nope.

I'll see if `v1alpha2` - if they implement it - turns out to be any good and consider if I want to enable bucket lifecycle at that point.

## Conclusion

COSI `v1alpha1` was/is garbage.

The recentely adopted `v1alpha2` does look better, but considering the current pace of development, interest, attention and even the limited usefulness, it could be years before the worst parts of `v1alpha1` are gone from COSI stack.

Maybe this is the right time to start kicking tires. But, where? 

For on-premises users who curate buckets, COSI's bucket lifecycle management seems limited, crude and unnecessary.

If I want to iterate in a development environment fast and let developers create and delete buckets as they please, I'd just ask developers to deploy Versity S3 Gateway inside their own namespaces and stop wasting time on COSI.

If I curate buckets and can't allow mayhem, then the approach `sg-cosi` uses already works fine: I create several dedicated tenant accounts for COSI and let COSI do its throw-away account and S3 key issue/delete thing. All the buckets are curated.

The `sg-cosi` repository is [here](https://github.com/scaleoutsean/sg-cosi), a README and Helm chart are coming (I need to do more testing and documentation). One can install everything in seconds, but there's a chatch - there's no source code!

![Where's the Source, Kenneth?](/assets/images/cosi_is_garbage_06_sg-cosi-is-best-i-can-do.png)

I know. That means almost no one will run this COSI driver, given that you need to entrust it with "tenant root"-equivalent credentials. Well, maybe some will, since `sg-cosi` connects to only designated tenant accounts and StorageGRID has good [audit logging](/2021/10/20/sgac-storagegrid-audit-log-converter-v0.2.1.html) and you can run it with the free SG SDS VMs in an isolated lab environment.

In any case, I reckon this is for the best:

- As we all know, it's easy to create and maintain a COSI driver. There's nothing to it. So, I've named mine **`sg-cosi`** and left the **`storagegrid-cosi`** name to the pros, either from the community or NetApp.
- There's a COSI driver that does more or less everything that the lame-ass `v1alpha1` spec is good for. If you don't need a production-grade COSI driver for StorageGRID, you can create your own or use this one (watch audit logs, see if anything is off). If you do need production-grade code, up your game or ask NetApp to do it for you. Just "*contact your NetApp representative!*", as they say.

At the top, I've mentioned I'd been looking forward to doing some new S3 experiments and demos. Ideas:
- Auto-start S3 workloads (assuming buckets and COSI are pre-configured)
- Hand-off S3 keys for batch workload handling to apps 
- I also plan to use COSI in Versity S3 Gateway, likely in combination with StorageGRID or BeeGFS. That's also something that I've blogged about [months ago](/2025/10/09/storagegrid-s3-cache-branch-buckets.html#so-how-is-this-supposed-to-be-used) - there are various opportunities here
- General automation of StorageGRID S3 ([snapshots](/2026/01/30/storagegrid-branch-buckets-snapshots.html), caching, yes?)

All these "problems" are already solved without COSI - usually by pre-configuring S3 in one place and credentials in another (secrets).

Some of you may remember this and the S3 caching diagram from [this post](/2026/01/16/santricity-eseries-datalake-storage.html#application-rack-and-storage-redundancy) which explains why COSI may be helpful: it's not just one little thing.

![Where COSI plays](/assets/images/eseries-datalake-storage-layout-02.png)

- E-Series: since [reautomating E-Series](/2025/12/22/reautomating-eseries.html) started last December, E-Series has been solved. We have several good CSI drivers, all sorts of Cloud-Native workloads run well on E-Series-backed Kubernetes (including Versity S3 Gateway itself)
- Versity and StorageGRID at the top need some work and maybe COSI can help make things better there
