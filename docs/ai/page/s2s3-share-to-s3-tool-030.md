# S2S3 v.3.0 adds native Windows x64 client with SMB 3 support

SMB 3 support added. Migrate at will!

WTF is **S2S3**? See [here](/2026/10/22/s2s3-share-to-s3-tool.html). 

> It's a share-and-bucket inventory-related utility for NAS to S3 migrations.

What's new:
- v0.3.0 (and v0.2.0 before that, but improvements were made since) native Windows client was added in v0.2.). `s2s3.exe`, baby!
- S2S3 for Windows can scan SMB 3 shares now
- ... annnnd, the rest of it still works

In practical terms (open these screenshots in a new tab if you wish):

![S2S3 on Windows with SMB 3](/assets/images/s2s3-05-s2s3-native-windows-with-smb3.png)

Also this:

![S2S3 on Windows with NFSv3](/assets/images/s2s3-06-s2s3-native-windows-with-nfsv3.png)

"The rest still works" is described in the repo README, but the TLDR of it is: is once you build an inventory of SMB share, you can can copy the inventory to Linux and run other S2S3 steps (those that don't require share access) from Linux. Or you can do those on Windows, too.

![Yuuup!](/assets/images/yuuup.png)

Performance of S2S3 for Windows with SMB 3 is fine - around 100K files in 9 seconds. In the previous post I mentioned around 8,000 files/second with NFS (slightly different environment), so it's roughly comparable.

S2S3 for Windows does make some assumptions (SMB 3 and auth are all sorted out, for example). It hasn't been tested at scale, but I don't expect it to be worse than Linux version (which has been tested with directory trees of several million files).

Check the first S2S3 post for additional information.
