# Oracle TimesTen Classic XE notes

Notes on Oracle TimesTen

[Oracle TimesTen XE](https://www.oracle.com/database/technologies/related/timesten-xe.html) Classic v22.1 has quite a few requirements and settings related to memory and storage. Some attributes directly and indirectly related to storage:

- PermSize - the size in MB of the permanent memory region (default: 128)
- TempSize - the size in MB of the temporary region (default: 64; minimum: 32)
- LogBufMB - the size in MB of the internal transaction log buffer (default: 256; recommended: 256-4,096; maximum: 65,536)
  - Requirement: LogBufMB/LogBufParallelism >= 8
- LogFileSize - the maximum size in MB of transaction log files (default: 64; recommended 8)
  - Requirement: LogFileSize >= LogBufMB

Find the rest about these settings in TFM.

Where are data and log locations defined? In db.ini:

- `DataStore`: full path to the database
- (recommended) `LogDir`: directory for transaction files

In a Kubernetes environment we'd use two volumes, one for data and another for transaction logs.

```yaml
apiVersion: timesten.oracle.com/v1
kind: TimesTenClassic
metadata:
  name: xe
spec:
  ttspec:
    storageClassName: regular
    storageSize: 100Gi
    logStorageClassName: gold
    logStorageSize: 1000Gi
```

Likewise, in a physical or VM environment with the NetApp E-Series EF600, for example, we could create the log volume (`LogDir`) on a RAID1-like volume group, while storage volume (`DataStore`) could be on a RAID6-like volume.

Without separate volumes a single volume would be used for both checkpoints and transaction logs, which could create IO contention.

If you want to give it a try with Docker, you can download container images from Oracle's container registry. To pull Oracle's JDK container images, you need to access the registry from a Web browser, login, agree to the EULA, and then you may login from Docker CLI and `pull` such images.

```sh
$ docker images
REPOSITORY                                           TAG               IMAGE ID       CREATED        SIZE
container-registry.oracle.com/java/jdk               17-oraclelinux8   3e1cba96c324   3 days ago     559MB
container-registry.oracle.com/timesten/timesten-xe   latest            5c95ca8c1359   3 months ago   2.33GB
```

The possibility of using Docker seems appealing but there are no ready-made instruction for that (Kubernetes is well-documented and there's an Operator, too), so that would require some experimentation. Also, setting up a meaningful PoC would take some time, so I didn't try. 

Various other recommendations that may help avoid excessive contention:

- Larger LogBufMB can avoid frequent checkpoints to decrease frequent `LOG_BUFFER_WAITS`
- Disable `AUTOCOMMIT`
- Create larger transactions if you can
- Use nondurable commits where possible

TimesTen supports full and incremental backup to disk, so admin could create another volume or mount a volume from another storage system for that purpose. TimesTen Scaleout uses Internal Network to move backups; while data size of TimesTen databases is usually not very big, this may be important for network planning purposes. Other than that, it's quite similar to TimesTen Classic.

It is possible to attach a TimesTen backup repository to a SSH or SCP destination, which makes it possible to store backups remotely and not have any actual mounts:

```
$ ttGridAdmin repositoryAttach remoterepo \
  -path /repositories \
  -method scp \
  -address vault.com.org
```
