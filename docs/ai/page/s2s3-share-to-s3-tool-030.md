# S2S3 v.3.0 adds native Windows x64 client with SMB 3 support

SMB 3 support added. Migrate at will!

WTF is **S2S3**? See [here](/2026/10/22/s2s3-share-to-s3-tool.html). 

> It's a share-and-bucket inventory-related utility for NAS to S3 migrations.

What's new:
- with v0.3.0 (and v0.2.0 before that, but minor improvements happened since), native Windows x64 client is available. `s2s3.exe`, baby!
- S2S3 for Windows can scan SMB 3 shares
- ... annnnd, the rest of it still works

In practical terms, this is what's new (open these screenshots in a new tab if you wish):

![S2S3 on Windows with SMB 3](/assets/images/s2s3-05-s2s3-native-windows-with-smb3.png)

Also this:

![S2S3 on Windows with NFSv3](/assets/images/s2s3-06-s2s3-native-windows-with-nfsv3.png)

![Yuuup!](/assets/images/yuuup.png)

"The rest still works" is described in the repo README, but the TLDR of it is: is once you build an inventory of an SMB share, you can can copy the inventory to Linux and run other S2S3 steps (those that don't require share access) from Linux. Or you can perform those on Windows, too.

The performance of S2S3 for Windows with SMB 3 is fine - it can enumerate 100K files in less than 10 seconds on modest hardware. I also tried a share with 5,000,000 files - it took less than 45 seconds.

In the first S2S3 post, I mentioned around 8,000 files/second with NFS (in a slightly different environment), so it's roughly comparable. As the "sizing" calculations from that post show, share enumeration is unlikely to be a bottleneck for sub-100 TB shares/buckets.

S2S3 for Windows does make some assumptions (SMB 3 and auth are all sorted out, for example). It hasn't been tested at scale, but I don't expect it to be worse than Linux version.

Check the first S2S3 post for additional information.
