# S3 Select vs. remote SQL access to CSV over FUSE

S3 Select vs. remote SQL CSV access over FUSE

In a [recent post](/2022/03/04/storagegrid-s3-select.html#s3-select) I wrote about S3 Select in StorageGRID 11.6.

From that post - and various AWS S3 Select material out there which is pretty abundant - you'll see that best approach to querying flat files on S3 almost always "depends" on multiple factors.

There are many ways analytics applications can access CSV files (and other formats) on S3, so a comprehensive comparison across applications, formats and workloads would be very time consuming. But I thought to give one special case a try, namely Virtual Table with CSV files in SQLite.

As the name implies, this feature lets you work with "external" CSV tables which are of temporary nature.

To access S3 files from SQLite we need something like S3FS or Goofys. I used the latter.

I create the same file I used in Example 3 of the previous S3 select post - which is a CSV file with all possible SolidFire configurations, but enlarged to 100 nodes (so that file size becomes bigger) - and upload it to a remote StorageGRID.

Then I mount that `data` bucket to /tmp/junk on my client.

```sh
$ mc ls sgpub/data/
[2022-03-10 12:00:29 CST] 9.2MiB bruteForceSizingSolidFire.txt

$ df | grep junk
data                      1099511627776         0 1099511627776   0% /tmp/junk

$ dir -lat /tmp/junk
total 9526
drwxrwxrwt 63 root root   61440 Mar 10 12:05 ..
drwxr-xr-x  2 sean sean    4096 Mar 10 12:02 .
-rw-r--r--  1 sean sean 9684195 Mar 10 12:00 bruteForceSizingSolidFire.txt
```

Finally, I used SQLite to create a [virtual table](https://www.sqlite.org/csv.html) from that CSV file.

```sql
CREATE VIRTUAL TABLE temp.t2
 USING csv(filename='/tmp/junk/bruteForceSizingSolidFire.txt', headers);
```

I did two simple tests:

- select all rows (non-cached)
- select some or all rows (cached access)

As expected, selecting all rows from a non-cached CSV file on S3 this way requires a full read. Even selecting just some rows would be the same, as SQLite has no idea what's in the file. Everything has to be read.

In the second test - also as expected - the CSV file was already cached so query was very fast (faster than S3 Select).

But there were some interesting details, too.

First, `'SELECT * FROM'` wasn't as smooth as expected. It took over 50 seconds to run this query, which was much slower than regular S3 read (12 seconds). Similar test outside of SQLite (copy FUSE-mounted file to /tmp/) over Goofys took 50 seconds as well, which made me think this was Goofys' behavior (15 seconds of idling, 3 seconds of slow network activity, followed by 30 seconds of idling, followed by 10 seconds of slow network activity).

I also tried S3FS which worked a better; it did more reads on mount (as if it was pre-caching the first 1-2 MB) and `'SELECT * FROM'` took 50% less time than over Goofys.

This isn't a lab benchmark, but just a result from querying that 9MB file from a StorageGRID on another continent to give you an idea:

| Approach        | Full Table Scan | Cached Select | Remote (S3 Select) |
| :---            | ---             | ---           |         ---        |
| SQLite + Goofys | 50s             | 1s            | -  |
| SQLite + S3FS   | 25s             | 1s            | -  |
| S3 Select       | 05s             | -             | 2s |

Additionally, the first S3 Select figure is an estimate based on [querying a smaller CSV file the other day](/2022/03/04/storagegrid-s3-select.html#example-3-brute-force-sizer-for-solidfire) (I couldn't repeat that test here because this StorageGRID is version 11.5).

Second, query results were a bit strange. That's probably due to the lack of DB schema, but it shows that it's not easy to change tools on a short notice and expect it will all just work. Queries did "work", but incorrectly or strangely (for example `WHERE` and `'SORT BY'` didn't work correctly, I suspect because SQLite assumed that integers were strings). This isn't to say that S3 Select is better, just that you need to use your tools properly (which I didn't do). I did spot the problem, at least, although I didn't care to correct it for this test.

Some high level conclusions:

- S3FS, Goofys and similar tools may be very suitable for one workload and not so suitable for another, whereas S3 Select is predictable for the workload of querying S3 based objects without downloading entire objects
- SQLite is much more popular and very feature-rich, so for some use cases it makes sense to use SQLite than the spartan S3 Select. For example, existing applications that work with SQLite, when migrating SQLite read-only databases to S3, when integrating SQL from S3 objects with other database systems, complex SQL queries and reports... In such cases it makes sense to use SQLite
- Different workloads benefit from different approaches; even the same workload may benefit from different approaches if it's executed once vs. more than once (in which case it can benefit from local cache)

There's probably more than 10 ways to do this... Some of them:

- download objects, import local files to SQLite and run queries
- use SQLite virtual tables over FUSE
- use specialized wrappers such as [sqlite-s3-query](https://pypi.org/project/sqlite-s3-query/)
- use Parquet or other specialized database formats to be queried by specialized application(s)
- use S3 Select for simplicity and basic SQL features
- use SQLite with FUSE to create indexes and PUT them back to the bucket, so that SQLite CSV queries over FUSE take advantage of indexes. To fully optimize, don't even use CSV files (if you can) - just keep SQLite DB on S3

Years ago I knew of a customer who was doing lots of Microsoft Access reporting. This involved updating and copying databases from storage in branch offices to very big disk array at the HQs where 4-way servers ran reporting, and it was still very time consuming and slow. Eventually they refreshed their existing architecture and retained the old workflow so I didn't learn how complex their SQL queries were. While I couldn't tell whether I'd suggest one of "enhanced" SQLite approaches from the list above or perhaps just S3 Select, but it's hard to imagine how either way with data on StorageGRID could be worse than what they had.

I was surprised that Goofys didn't work well for this test: `'SELECT * FROM'` should be just one big sequential read. Last week I tested file upload with Goofys and StorageGRID S3 and it achieved a better performance than my regular *native* S3 client. For this workload it set a low bar, and S3FS outperformed it by a large margin.

But it's a made up use case anyway, so there's no need to find the fastest way to do this one thing.

It's enough to know that small differences can translate into unpredictable outcomes and that we have a number of client-side tools at our disposal. Most of them free to use so optimizations can be made as necessary. 

## Demo

- [SQLite Virtual Table (CSV) over Goofys and S3FS](https://rumble.com/vwzvqt-sqlite-virtual-table-with-goofys-and-s3fs.html) - 2m24s
- An S3 Select example can be seen in the demo section of the [S3 Select post](/2022/03/04/storagegrid-s3-select.html#example-3-brute-force-sizer-for-solidfire)
