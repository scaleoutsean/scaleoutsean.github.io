# Using rclone to copy StorageGRID S3 data to local filesystem

Because IT must be hard

**NOTICE:** all credentials and tokens on this page are samples, not leaked.

Today's challenge was how to define as little as possible in our rclone configuration file.

For some reason, rclone dev(s) decided this had to be hard.

I suppose that may be to minimize the user-friendliness shock for rclone users who've dealt with rsync. Or sendmail config files.

## rclone configuration file

If you are comfortable with having StorageGRID configuration in a configuration file, just specify it by following the AWS S3 example from the rclone documentation.

To copy the object people_data02.csv from the bucket hahdupe (that exists on our remote (S3) backend defined in the section of rclone config called `sgpub`) to /tmp/:

```sh
rclone -v copy sgpub:/hahdupe/people_data02.csv /tmp/
```

See? It's a non-event.

But... if you want to specify credentials and other stuff (region, etc.) using CLI options, you may hit the wall. At least I did - couldn't figure out how to define the remote name (that "sgpub" thing I had earlier). Eventually I went with this approach:

- Create a stub configuration file (see below)
- Provide the rest in the CLI (examples below)

You can put this stub config file anywhere (`--config /any/where/config.txt`) or even create a temp one, but this config item header (`[sgpub]`, in this case) is what I couldn't find how to provide using the CLI options.

```sh
[sgpub]
type = s3
provider = Other
```

With this stub above I got a name for my "remote", as rclone CLI samples call it. Probably one of the other options (provider, for example) can be removed too - I just needed *something* in the damn config file...

The third option is to use environmental variables for everything, but that crap is even worse documented so I just gave up. The above approaches work and that's good enough for me.

Going back to this "maximize the use of CLI options" requirement, here's how to copy one or more files to a local filesystem.

## Single object from bucket `hahdupe` to local

You obviously don't have to specify all these options, but it's easier to remove them than search for them. `sgpub` ("remote") is the reason I had to have at least a minimal configuration file.

```sh
rclone -v --config ~/.config/rclone/rclone.conf \
  --s3-access-key-id AAAAAAAAAAAAAAAAAA \
  --s3-secret-access-key BBBBBBBBBBBBBBBBBBB \
  --no-check-certificate \
  --s3-endpoint https://strg.gr.id:18443 \
  --s3-region=us-east-1 \
  --dry-run \
  --force_path_style=true \
  copy sgpub:/hahdupe/wordcount/input.txt /tmp/
```

## S3 to local with a bunch-o-files

As earlier, remove the stuff you don't need.

```sh
rclone -v --config ~/.config/rclone/rclone.conf \
  --s3-access-key-id AAAAAAAAAAAAAAAAAA \
  --s3-secret-access-key BBBBBBBBBBBBBBBBBBB \
  --no-check-certificate \
  --s3-endpoint https://strg.gr.id:18443 \
  --s3-region=us-east-1 \
  --dry-run \
  --force_path_style=true \
  copyto sgpub:/hahdupe/wordcount/ /tmp/test/
```

## S3 to local with a bunch-o-filtered files

Let's say I have some data in multiple levels of subdirectories under sgpub:/hahdupe/wordcount/... like so:

```raw
    27040 input.txt
        0 output/pd/_SUCCESS
 20252426 output/pd/part-r-00000
        0 output/pd1/_SUCCESS
 20252426 output/pd1/part-r-00000
        0 output/pd2/_SUCCESS
 20246725 output/pd2/part-r-00000
        0 output/pd22nd/_SUCCESS
 20246725 output/pd22nd/part-r-00000
```

Say I want the objects that begin with "part-r-", found in various subdirectories underneath sgpub:/hahdupe/wordcount/output. Let's list them (to make it easier on your eyes I skip all the unnecessary CLI options):

```sh
$ rclone --include '*/part-r*' ls sgpub:/hahdupe/wordcount/
 20246725 output/pd22nd/part-r-00000
 20252426 output/pd1/part-r-00000
 20252426 output/pd/part-r-00000
 20246725 output/pd2/part-r-00000
```

I don't want all of the objects from that subdirectory (e.g. no 0-sized wordcount/output/pd2/_SUCCESS, thank you very much), and I don't want to run four copy commands either. How to get 'em?

```sh
rclone -v --config ~/.config/rclone/rclone.conf \
 --include '*/part-r*' \
 copyto sgpub:/hahdupe/wordcount/ /tmp/test/
```

Notice that full paths get recreated, but only `include`'d objects make it to local FS:

```sh
$ ll -laR /tmp/test/        
/tmp/test/:
total 72K
drwxrwxr-x   3 sean sean 4.0K Dec 22 15:27 .
drwxrwxrwt 147 root root  60K Dec 22 15:27 ..
drwxrwxr-x   6 sean sean 4.0K Dec 22 15:27 output

/tmp/test/output:
total 24K
drwxrwxr-x 6 sean sean 4.0K Dec 22 15:27 .
drwxrwxr-x 3 sean sean 4.0K Dec 22 15:27 ..
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 pd
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 pd1
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 pd2
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 pd22nd

/tmp/test/output/pd:
total 20M
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 .
drwxrwxr-x 6 sean sean 4.0K Dec 22 15:27 ..
-rw-rw-r-- 1 sean sean  20M Dec 15 17:20 part-r-00000

/tmp/test/output/pd1:
total 20M
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 .
drwxrwxr-x 6 sean sean 4.0K Dec 22 15:27 ..
-rw-rw-r-- 1 sean sean  20M Dec 15 17:21 part-r-00000

/tmp/test/output/pd2:
total 20M
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 .
drwxrwxr-x 6 sean sean 4.0K Dec 22 15:27 ..
-rw-rw-r-- 1 sean sean  20M Dec 17 12:07 part-r-00000

/tmp/test/output/pd22nd:
total 20M
drwxrwxr-x 2 sean sean 4.0K Dec 22 15:27 .
drwxrwxr-x 6 sean sean 4.0K Dec 22 15:27 ..
-rw-rw-r-- 1 sean sean  20M Dec 17 12:07 part-r-00000
```

There must be some fancy options for maximum directory depth and such, but at this time I don't need them so I won't look them up.

## LBNL

Last but not least: the `sync` command is weird - watch out for that one, compliance lovers!

And don't use any of this stuff on production data without several `--dry-run` tries. rclone can be counterintuitive.
