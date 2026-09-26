# Copy StorageGRID objects and tags using rclone

Use rclone to copy StorageGRID objects and tags

Create two buckets, `source` and `destination`, a PUT a test object with some junk tags to `source/`.

![Create test object and tag it](/assets/images/storagegrid-rclone-tag-sync-2021-08-24_01.png)

Copy that object to another bucket using `rclone`:

```shell
$ mc ls sgpub/source
[2021-08-24 16:14:54 CST] 1.7KiB diff-31-33.txt

$ rclone copy --no-update-modtime sgpub:/source/diff-31-33.txt sgpub:/destination/

$ mc ls sgpub/destination
[2021-08-24 16:30:37 CST] 1.7KiB diff-31-33.txt

$ mc tag list sgpub/source/diff-31-33.txt
Name   : https://x.y.z/source/diff-31-33.txt ()
author : scaleoutSean

$ mc tag list sgpub/destination/diff-31-33.txt
Name   : https://x.y.z/destination/diff-31-33.txt ()
author : scaleoutSean
```

That'd be great, you may say, but rclone currently can't copy object metadata!

That's true. Which why I used rclone-v1.55.0-beta obtained [here](https://beta.rclone.org/branch/fix-111-metadata/v1.55.0-beta.5247.b7199fe3d.fix-111-metadata/).

![Object and its tag have been copied to destination bucket](/assets/images/storagegrid-rclone-tag-sync-2021-08-24_02.png)
