# TensorStore with BeeGFS

Use BeeGFS in file:// KvStore URL scheme for TensorStore

TensorStore is a new C++ and Python library that provides a uniform API for reading and writing *n*-dimensional data.

Among its Kv store drivers of interest to BeeGFS users is the file driver which uses the filesystem as a key-value store. The key is filesystem path (directory) and the value(s) files themselves.

Using a BeeGFS 7.3 client, create a destination directory to store data (this example needs just around ~20 MB).

```sh
mkdir -p /mnt/beegfs/tf/zarr
```

Install the stuff that needs to be imported, and use one of the official examples to try it out:

```python
import numpy as np
import tensorflow as tf
import tensorstore as ts

dataset = ts.open({
    'driver': 'zarr',
    'kvstore': 'file:///mnt/beegfs/tf/zarr'},
    dtype=ts.uint32,
    chunk_layout=ts.ChunkLayout(chunk_shape=[256, 256, 1]),
    create=True,
    shape=[5000, 6000, 7000]).result()

# two numpy arrays with example data
a = np.arange(100*200*300, dtype=np.uint32).reshape((100, 200, 300))
b = np.arange(200*300*400, dtype=np.uint32).reshape((200, 300, 400))

# asynchronous write
future_a = dataset[1000:1100, 2000:2200, 3000:3300].write(a)
future_b = dataset[3000:3200, 4000:4300, 5000:5400].write(b)

# wait for completion
future_a.result()
future_b.result()
```

As TensorStore starts writing we notice network activity on the BeeGFS client, as it's contacting BeeGFS Metadata server to create files, and sends data content to BeeGFS Data servers to store file data.

```sh
----system---- --total-cpu-usage-- -net/total-
     time     |usr sys idl wai stl| recv  send
23-09 05:13:14|  1   0  99   0   0| 186B  254B
23-09 05:13:15|  1   0  98   0   0|1453B 1926B
23-09 05:13:16| 21  22  57   0   0| 500k 1157k
23-09 05:13:17| 16  18  66   0   0|1301k 3733k
23-09 05:13:18| 20  18  62   0   0|1340k 4699k
23-09 05:13:19| 16  21  63   0   0|1373k 5411k
23-09 05:13:20| 10  10  81   0   0|1641k 7735k
23-09 05:13:21|  6   7  86   1   0| 765k 4186k
23-09 05:13:22|  0   1  99   0   0| 126B  254B
23-09 05:13:23|  1   1  98   0   0| 130B  254B
23-09 05:13:24|  3   2  95   0   0| 946B 1117B
```

The result is 2,800 files:

```sh
$ ll /mnt/beegfs/tf/zarr
total 18806
drwxrwxr-x 2 sean sean  2801 Sep 23 05:03 ./
drwxrwxr-x 3 sean sean     1 Sep 23 05:01 ../
-rw-rw-r-- 1 sean sean   228 Sep 23 05:02 .zarray
-rw-rw-r-- 1 sean sean  5873 Sep 23 05:02 11.15.5000
-rw-rw-r-- 1 sean sean  6536 Sep 23 05:02 11.15.5001
-rw-rw-r-- 1 sean sean  6536 Sep 23 05:02 11.15.5002
-rw-rw-r-- 1 sean sean  6536 Sep 23 05:02 11.15.5003
-rw-rw-r-- 1 sean sean  6536 Sep 23 05:02 11.15.5004
-rw-rw-r-- 1 sean sean  6536 Sep 23 05:02 11.15.5005
...
```

If you're interested in performance with files small-ish like these, take a look at this [Metadata performance test](https://docs.netapp.com/us-en/beegfs/beegfs-design-solution-verification.html#metadata-performance-test).

Note that there's also a KV memory driver. For large data sets of tiny files we could keep results in RAM and later write it out to BeeGFS or S3 if we need it.

On my mini BeeGFS cluster the script took 6 seconds (this includes loading the modules, spitting out warnings about the lack of CUDA, computing and writing to BeeGFS) whereas on the same system using RAM driver it took around 2 seconds.

Data that needs repeated access (re-read pattern) by clients would benefit from system cache or BeeGFS cache, so we shouldn't take this write test to mean "memory KV store should be 300% faster". In some cases it may be very similar.

I don't know enough about Tensorflow to be able to say how viable it is to change driver options to create larger files.

TenstorStore uses locking provided by the BeeGFS filesystem, so it should work fine with native application-aware access from many containers with BeeGFS CSI or general BeeGFS clients.

> Locking provided by the filesystem is used to safely allow concurrent access from multiple processes. (The locking protocol used does not block readers.) Provided that shared locking is supported, concurrent access from multiple machines to a network filesystem is also safe.

TensorStore's File KV store driver is documented [here](https://google.github.io/tensorstore/kvstore/file/index.html).
