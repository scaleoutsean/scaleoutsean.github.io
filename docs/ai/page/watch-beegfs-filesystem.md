# BeeGFS filesystem event monitoring with watcher

Simple way to watch file and directory changes on BeeGFS clients

Maybe you've used an app (or an ONTAP feature) that makes use of the FPolicy API. FPolicy is proven in large and busy NAS environments, and has rich features and integrations for auditing, anti-ransomware protection and more. It is commercially licensed, mostly to ISVs.

On Linux OS there are several similar applications and most use [inotify](https://en.wikipedia.org/wiki/Inotify), a Linux subsystem which monitors the filesystem and sends event notifications.

[watcher](https://github.com/e-dant/watcher) does *not* use inotify and seems quite new, so I wanted to check it out. 

Both inotify (in the case you pick another utility that leverages it) and watcher are permissively licensed, and may not be able to solve all your problems (let's leave it at that).

Normally we'd start watcher on a BeeGFS client by passing it a BeeGFS mount point like so:

```sh 
./watch /mnt/beegfs
```

Now we can create some BeeGFS filesystem activity on that BeeGFS client:

```sh
$ touch /mnt/beegfs/test01.txt 
$ cat /mnt/beegfs/test01.txt 
$ echo "tasdfasf" >> /mnt/beegfs/test01.txt 
$ mv /mnt/beegfs/test01.txt /mnt/beegfs/test02.txt
$ rm /mnt/beegfs/test02.txt
```

Watcher output:

```
$ ./watch /mnt/beegfs/
{"water.watcher.stream":{
"1666112809564097156":{"where":"/mnt/beegfs/test01.txt","what":"modify","kind":"file"},
"1666112818382373993":{"where":"/mnt/beegfs/test01.txt","what":"destroy","kind":"dir"},
"1666112818383007343":{"where":"/mnt/beegfs/test02.txt","what":"create","kind":"file"},
"1666112821797725785":{"where":"/mnt/beegfs/test02.txt","what":"destroy","kind":"dir"},
(CTRL+C)
```

Of course, this is quite basic and not very practical.  A slightly more advanced approach:

- Create a watch service that runs on all BeeGFS clients and writes changes to a file
- Use Filebeat or other utility to read watch output and send it to Elasticsearch
- Use Elasticsearch to gather and analyze data from all BeeGFS clients

This lets us know when what changed, but not by whom.

While watcher doesn't do a lot, the information it collects can be useful in various ways:

- Create a queue of new and modified files to replicate or backup; to be honest I don't know how to create a query that gets a list of unique files that have been modified and created but not subsequently destroyed, but in an environment where files are only added and deleted, this query should be very simple
- Create a list of *modified* files; this can be useful as well, because we could use this information to overwrite a remote file replica without making a date or checksum comparison. This should be trivial for use cases where data is ingressed via a single BeeGFS client
- Create a search engine for file and directory names; some files may no longer exist (if they were subsequently deleted) but that should be easy to see from Elasticsearch results (`destroy` action should appear after `modify` when sorted by time (descending) and may be good enough for some use cases). We can touch all files in a directory tree to get watcher to log them and populate Elasticsearch

BeeGFS has its own method of watching filesystem activity which is more advanced, gathers events from metadata servers (rather than from clients) and provides a lot more data.

Watcher is simple single-binary utility, but I think (I have a BeeGFS cluster with only one client in my lab) it must be deployed to all BeeGFS clients where we wish to monitor the same filesystem, so I would recommend it for simple use cases similar to what I described above.

If you expect to need more details, consider other, more mature Linux utilities or BeeGFS' own filesystem activity monitor ([RTFM](https://doc.beegfs.io/latest/advanced_topics/filesystem_modification_events.html)).

I haven't tested watcher under a heavy workload.
