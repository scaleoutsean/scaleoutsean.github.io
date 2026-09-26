# NetApp E-Series single volume and consistency group clones

Workflows for creating volume clones from snapshots and other volumes

**UPDATE:** If you just want to use this workflow, see [santricity-powershell adds single volume snapshots and clones](/2026/01/25/eseries-santricity-ps-snapshots-clones.html). You can extract the steps from this or make an enhancement request for [`santricity-client`](/2025/12/29/santricity-client.html)

## Introduction 

Years ago I created a marathon-post on [SANtricity snapshots and consistency groups](/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html).

Not the most pleasant topic even for E-Series. Just reading that stuff causes headaches.

But, since I've been making progress with client libraries, I want to make another post on this topic, specifically on the topic of cloning - making copies of snapshots.

## Summary of SANtricity snapshots, clones and repositories

If you are interested to the extent that you may want to use these things, you should RTFM and possibly the post linked above, but for the "skimmers":

- SANtricity calls snapshots "snapshot images"
- SANtricity calls snapshot-derived clone volumes "snapshot volumes"
- SANtricity snapshots use Copy-on-Write (CoW) and therefore write-modified segments are "evacuated" from live source volume into extents called "repos" (short for repositories) that live in a grouping called Snapshot Group
- "Snapshot Groups" are not snapshots of Consistency Groups! They're groups of "repositories", extents that hold overwritten segments from the source volume within allocations known as Snapshot Group Reserved Capacity (specified as reserved percentage value of source volume size; that's not deducted from the source volume size - it is extra reserve)
- SANtricity also supports "Consistency Groups" (CGs) which are groups of volumes that can be snapshot at the same Point-in-Time (this "PIT" term comes up frequently in the API so it's better to get used to it)
- "Snapshot volumes" (quasi-volumes cloned from snapshots) that are presented to host(s) as read-write quasi-volumes also need own reserve capacity. Read-only clones don't need any reserve capacity, but they may be less useful. There's no way to "promote" a clone to a "normal" volume that you'd see in `GET volumes` or the Volumes section of the UI. A snapshot volume is bound to underlying PIT snapshot view, in other words it's "thin". It may be writeable, but it's not realy broken-off from the base

Some related official resources:
- NetApp [TR-4747](https://www.netapp.com/media/17167-tr4747.pdf), "SANtricity Snapshot feature - Overview and deployment guide", for details on SANtricity snapshots
- SANtricity documentation (jump directly to [Snapshot FAQs](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/faq-snapshots.html))

Let's move on to clones.

## Online vs. offline volume copies

- Online copies are real volumes made from "live" source volumes, not snapshots. You don't need to have a snapshot, but the volumes must have no host-side IO activity
- Offline copies (clones) are created from snapshot "images" and are "snapshot volumes" (quasi-volumes)

You may read about the conditions for online copies in the documentation, but those volumes aren't very interesting or useful and - once those restrictive conditions are met - the way they work is simple: create a destination volume of the same or larger size than source volume and kick off volume copy. Pick a source, pick a destination, and start copying.

Offline copies are more useful and related to the topic of snapshots.

Note that SANtricity has various restrictions for both approaches. You really need to RTFM. For example, you may not be able to copy volumes from NVMe LUNs (with 4096 byte sector sizes) to SAS-based SSDs or NL-SAS disks (no native 4096 sector size support).

## Single snapshot vs. CG snapshot clone

As I've mentioned above, in order to create a clone ("snapshot volume"), we create a read-only or read-write copy of a snapshot ("snapshot image").

The SANtricity API endpoints are different for single vs. groups, but the way it works is the same:

- We need a snapshot (created on schedule or manually), or can create one on-demand
- We create a "snapshot volume" (clone). Snapshot volumes with read-write access need reserve space just like "snapshot images". When we create a "snapshot volume" from a Consistency Group Snapshot Image, the only difference is there's 2 or more volumes involved. In most cases "snapshot volumes" are read-write, but need less reservation capacity if they're used for testing or backup, because regular volumes are modified all the time and snapshots may be in dozens, whereas cloning happens on very few and clone volumes aren't written to the same extent as source volumes.

Read requests on "snapshot volumes" go to:
- Live volume for data that hasn't changed since base snapshot was taken
- CoW-evacuated snapshot reserve area for data that has changed since base snapshot was taken

Data written to writeable snapshot volumes is written to the snapshot volume's own reserve area.

Like other objects in SANtricity, "snapshot volumes" can have their underlying resources "yanked" from underneath them. For example, you can (by mistake or deliberately) delete a snapshot that lies underneath a "snapshot volume" and kill that clone volume. Or you can delete a "snapshot group", which will wipe all reserve extents in it, and snapshot images and snapshot volumes that use them.

## Making copies of "snapshot volumes"

As we've just seen above, snapshot volumes aren't stand-alone volumes that have been "broken off" from their ancestor snapshots.

In order to get a clone volume's data into a "real" volume, you need to copy it to a "real" volume. 

Say we have a logical 1TB snapshot volume (clone). To get an independent volume:
- Create a normal 1TB volume
- Copy the clone to that new volume
- Optionally, delete the clone and delete its snapshots (or let them expire on their own if they're configured to do that)

## Workflow

- Go to Pools, create a volume (e.g. `cloneme`) for your cluster 
- Go to Volumes, select the volume and under **Copy Services**, select **Create Instant Snapshot**. The API equivalent is `POST /storage-systems/{system-id}/snapshot-groups`, which creates the super-confusingly named "snapshot group" (see the snapshot mega-post for screenshots). This "snapshot group" holds reserve extents for the evacuation of overwritten base volume segments (CoW). API payload for that would contain your volume ID and have some reserve- and other limits.

```json
{
  "baseMappableObjectId": "02000000600A098000E3C1B00000362A69657942",
  "name": "sean_snap_group_01",
  "repositoryPercentage": 10,
  "warningThreshold": 80,
  "autoDeleteLimit": 5
}
```
- That creates a `pitGroupRef` which the PIT acronym I mentioned earlier plus an abbreviation for "snapshot group". It will have the information about base volume, and repository "volume" (not really a volume you can use in any way) where CoW data will be evacuated to
```json
{
  "pitGroupRef": "string",
  "label": "string",
  "status": "unknown",
  "baseVolume": "string",
  "repositoryVolume": "string",
  ...
}
```
- Repository utilization has to be watched so that Used vs. Available remains below the alert or maximum size.
```http
GET snapshot-groups/repository-utilization
```
- That gives you total bytes used by the PIT group (snapshot group) by one or more snapshots:
```json
[
  {
    "pitGroupBytesUsed": "5767168",
    "pitGroupBytesAvailable": "4288872448",
    "groupRef": "33000000600A098000E3C1B00000362D69657993",
    "pitUtilization": [
      {
        "pitRef": "34000000600A098000E3C1B00063362F69657993",
        "bytesUsed": "2818048"
      },
      {
        "pitRef": "34000000600A098000F637140063387669657FEC",
        "bytesUsed": "131072"
      }
    ]
  }
]
```
- To ceate a snapshot ("snapshot image") we need to reference that `pitGroupRef`, i.e. choose which Snapshot Group and repository within it you want to use for new snapshot. If we don't choose, SANtricity selects it for us.
```json
{
  "groupId": "33000000600A098000E3C1B00000362D69657993"
}
```
Example: POST the above payload to create a snapshot:
```http
POST snapshot-images
```
- That returns a snapshot object ( with ID, i.e. `pitRef`, `34000000600A098000E3C1B0006336326965852B`):
```json
{
  "pitRef": "34000000600A098000E3C1B0006336326965852B",
  "pitGroupRef": "33000000600A098000E3C1B00000362D69657993",
  "creationMethod": "user",
  "pitTimestamp": "1768284219",
  "pitSequenceNumber": "266",
  "status": "optimal",
  "activeCOW": true,
  "isRollbackSource": false,
  "pitCapacity": "1073741824",
  "repositoryCapacityUtilization": "0",
  "baseVol": "02000000600A098000E3C1B00000362A69657942",
  "consistencyGroupId": null,
  "id": "34000000600A098000E3C1B0006336326965852B"
}
```
- Now we have a snapshot, and we want to make a clone ("snapshot volume"):
```http
POST /storage-systems/{system-id}/snapshot-volumes
```
- Our payload for this is a snapshot ID. Notice that we're creating another reservation - this time for a clone - as this snapshot volume may be just one of serveral we will make from that snapshot. Payload for the above POST action:
```json
{
  "snapshotImageId": "34000000600A098000E3C1B0006336326965852B",
  "fullThreshold": 85,
  "name": "sean_clone",
  "viewMode": "readOnly",
  "repositoryPercentage": 10
}
```
- That returns a large clone object:
```json
{
  "viewRef": "35000000600A098000E3C1B00000363469658649",
  "worldWideName": "600A098000E3C1B00000363469658649",
  "baseVol": "02000000600A098000E3C1B00000362A69657942",
  "basePIT": "34000000600A098000E3C1B0006336326965852B",
  "boundToPIT": true,
  "accessMode": "readOnly",
  "label": "sean_clone",
  "status": "optimal",
  ...
  "repositoryVolume": "0000000000000000000000000000000000000000",
  ...
  "viewTime": "1768284506",
  "viewSequenceNumber": "19",
  ... 
  "volumeHandle": 16386,
  ...
  "membership": {
    "viewType": "individual",
    "cgViewRef": null
  },
  ...
  "objectType": "pitView",
  ...
  "id": "35000000600A098000E3C1B00000363469658649"
}
```
- Couple of points about this clone object
  - `viewRef` - clone ID
  - `baseVol` - base volume ID
  - `basePIT` - base snapshot image ID
  - `repositoryVolume` - the value `0000...000` seems like a SANtricity equivalent of `None` because the clone is read-only
  - `viewTime` - time when clone was created
  - `viewSequenceNumber` - these are incrementing integers that can help us sort clones by age
  - `membership` - individual = not a Consistency Group snapshot member
  - `objectType` - `pitView` is a clone
  - `id` - same (duplicate) value as `viewRef`, i.e. clone ID

- It's possible to convert this clone to a read-write clone. `viewId` is `viewRef` or `id` from above. The payload is quite complicated so I'll skip that gruesome part.
```http
POST snapshot-volumes/{viewId}/convertReadOnly
```
- Once a clone has been created, it may be presented ("mapped") to a host (which can be different from the host(s) using the source volume, as is normal with clone volumes). I seem to recall that `GET volume-mappings` shows these mappings there as well.
```json
{
 ...
 "listOfMappings": [
  {
    "lunMappingRef": "8800000086000000000000000000000000000000",
    "lun": 2,
    "ssid": 16385,
    "perms": 15,
    "volumeRef": "35000000600A098000E3C1B00000363D69658DDD",
    "type": "cluster",
    "mapRef": "85000000600A098000E3C1B0003635EF695AFB56",
    "id": "8800000086000000000000000000000000000000"
  }
],
"mapped": true,
"currentControllerId": "070000000000000000000002",
"name": "cloneme_SV_0001_in_sean_SG",
}
```
- Noteworthy details:
  - `ssid` - these tend to be over 16,384 for clone volumes (whereas normal volumes have `ssid` values below 16,384)
  - `type` - we can see this clone is presented to a host group (`cluster`)
  - `name` - clone name, here `cloneme_SV_0001_in_sean_SG` (SANtricity suggests "SV" and I kept that. It stands for snapshot volume i.e. clone)
- We can delete this clone. Payload has to contain a `viewRef`, i.e. snapshot volume ID:
```http
DELETE snapshot-volumes/{id}
```
- Remember that you can't delete arbitrary snapshots. You need to sort by `pitTimestamp` (ascending) and delete the oldest before the second oldest, etc. It is better you get in the habit of deleting clones first, then snapshots. Otherise you may delete a snapshot and "disable" (orphan) your clone. 
- We can refresh a clone by stopping IO to it and updating it from either one of other "snapshot images" of the source volume or by creating a new, ad-hoc snapshot image. If we automated that, we'd query repository utilization for the snapshot group. Note that some of these are old **SYMbolV2** API paths (`/devmgr/v2/storage-systems/{system_id}/symbol/`) - as one might expect when the payload or method look ... unusual. This is where things start getting ugly...
```http
POST getPITGroupRepositoryUtilization?verboseErrorResponse=true
```
- Payload for that would be (list of) repository ID(s), I think: `{"pitGroupRef":["33000000600A098000E3C1B00000362D69657993","33000000600A098000E3C1B00000363769658CA4"]}`
- Then we can pick one with more unused capacity, for example. Say we pick `{"groupId":"33000000600A098000E3C1B00000363769658CA4"}` and POST `{"groupId":"33000000600A098000E3C1B00000363769658CA4"}` to create a new ad-hoc snapshot:
```http
POST snapshot-images
```
- Now we need to stop and start this clone object to refresh it from an ad-hoc snapshot. `stopPitView` for `35000000600A098000E3C1B00000363469658649` (clone, aka snapshot volume, ID) which returns `"ok"` (including the quotes). Payload for that call is `PitView ID`, also a text string.
```http
POST stopPITView?verboseErrorResponse=true
```
- (To be confirmed) I don't see this in the documentation, but we possibly need to create a snapshot here
- Then we start that clone again by posting an update for:
```json
{"viewRef":"35000000600A098000E3C1B00000363469658649",
  "basePIT":"34000000600A098000E3C1B0006336646965F562"}
```
```http
POST restartPITView?verboseErrorResponse=true
```
- Payload for that consists of `viewRef` (snapshot volume ID) and `basePIT` (base snapshot image ID).
```json
{
  "viewRef": "string",
  "basePIT": "string"
}
```
- Once a clone is updated, we can re-mount it on the host to which it's mapped and take a backup, run tests, etc.

These last few steps done in SYMbolV2 API are not documented, so the only way to figure it out is trial and error, and it has to be done for both individual and CG snapshots and clones.

### Consistency Group extras

To do this workflow for a consistency group (CG):
- `POST consistency-groups` - create a CG
- `POST consistency-groups/{cgId}` - add member volumes (with JSON payload)
- The rest is the same, but we work with any of the member volumes and SANtricity automatically references the entire CG (`cgRef`) instead of individual volume

## Copy clones to other disk groups

Clones and CG clones that live on a disk group can be copied to another:
- Create target volume(s) of the same or larger size
- Copy clones to these targets
```http
POST volume-copy-jobs
```
- Payload for this consists of source (clone ID) and target ("real" volume ID). We use offline copy as we clone from a dismounted clone volunme:
```json
{
  "sourceId": "string",
  "targetId": "string",
  "copyPriority": "priority2",
  "targetWriteProtected": false,
  "onlineCopy": false,
  ...
}
```
- Clones in DDP cannot be copied to destination outside of the sme DDP. We can copy copy a clone from a RAID 1 disk group to a RAID 6 disk group and then delete that source clone and source snapshot, which frees space on the source disk group, and gives us a low cost "copy of a clone volume" on RAID 6. But we may be able to clone a RAID 1 volume from DDP to a RAID 6 volume on DDP (which I haven't tried yet)

## Snapshot scheduling

I wrote about that in the snapshots mega-post so I won't repeat that here. 

I will add, though, that creating a schedule *in the API* is a PITA (not PIT), so I suggest to create those in the UI or using Ansible or SMcli rather than attempt to do it in SYMbolV2 API.

## Conclusion

It's crazy how complicated this is.

It would be easier if these IDs didn't look like cryptocurrency addresses, and why should they when limits are so much smaller? These IDs could be simple because supported limits are well below 32-bit integers, but because they're not **and** they all look alike, the API becomes extremely hard to use.

Snapshots are easy to create, but the rest of the steps is a nightmare.

A workaround (not realy a solution) is to use the UI (obviously), Ansible or some other way to automate. What that doesn't solve is repository monitoring and management, snapshot limits monitoring and management, and similar problems. 

It seems the right solution is to focus on Day 1 operations:
- Do not attempt to automate the entire workflow because it's very difficult and even if it's automated, it's hard to understand how various bits and pieces fit together
- What can work well is create Storage Groups and schedules on Day 0 or when new volumes (or groups of volumes) are created, and then run automated clone refresh operations 

This workflow is probably over 95% correct and just needs to be automated enough to reliably repeat the steps of re-creating snapshot clones and potentially copying them to a "real" volume for testing and other purposes.

I hope to get some of these steps right and then add them to my PoweShell module and Python client for SANtricity.

That would allow us to call these from snapshot-taking, cloning and volume copying scripts. Ages ago there were [SMcli](/2026/01/05/eseries-santricity-smcli-client.html) scripts for such workflows circulating around (and maybe some folks still have and use them), but that now seems too inconvenient for my liking. Veritas has [scripted](https://www.veritas.com/content/support/en_US/doc/155729295-165976295-0/v158305042-165976295) SANtricity snapshot automation (create, delete and export (presumably to a backup server)).

Now I just need to run these workflows one more time to confirm their correctness and then I can build functions to automate them.
