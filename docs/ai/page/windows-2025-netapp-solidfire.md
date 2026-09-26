# Windows Server 2025 with NetApp SolidFire

Touch test of Windows Server 2025 (build 26100.4061) iSCSI with SolidFire

I wrote about Windows Server 2025 [here](/2024/03/31/windows-server-2025-with-solidfire-part-one.html).

Anyway, since I've already installed the same product again, there's another update so I'll blog about that as well.

What we're dealing with? A Windows Server 2025 VM ([this specific build](https://support.microsoft.com/en-us/topic/may-13-2025-kb5058411-os-build-26100-4061-57181688-a692-49e5-b6cd-6e3919da12ca), if you're curious) I installed for this purpose. And a NetApp SolidFire 12.5.0.897 (demo VM).

![Windows Server 2025 build 26100.4061](/assets/images/solidfire-win25-06.png)

To test, I created two SolidFire volumes, one with 512e and one with native 4096 sector size, and added them to a VAG. Then on Windows iSCSI client I added SolidFire SVIP to Discovery portals and refreshed iSCSI client.

![SolidFire volumes and Windows 2025 iSCSI](/assets/images/solidfire-win25-01.png)

When logging in, although both volumes ought to be accessible due to their VAG membership, I specifically tried unidirectional CHAP on one of them and multi-pathing was enabled (although there's just one path to SVIP). That worked fine.

![iSCSI to SolidFire with Unidirectional chap ](/assets/images/solidfire-win25-02.png)

Result:

![Windows iSCSI client is connected to two targets](/assets/images/solidfire-win25-03.png)

Then I onlined the volumes and created a file-system on each - one ReFS and another NTFS - using the default allocation unit size for each.

![iSCSI volumes online](/assets/images/solidfire-win25-04.png)

It all worked as expected. (Volume labels (512e, 4096) is just my tag to be able to tell which is which.)

![ReFS and NTFS volumes online](/assets/images/solidfire-win25-05.png)

So.... still no changes that matter, and last year's review was more detailed and involved automation and SQL Server, so Windows Server 2025 with SolidFire 12.5 (or newer) looks reasonably safe.
