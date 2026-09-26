# Leverage BeeGFS in Nextflow to avoid unnecessary data movement

Leverage fast parallel filesystem (BeeGFS) for data-intensive Nextflow container jobs

Nextflow configuration and environment variables allow us to make use of BeeGFS with E-Series for most demanding IO tasks.

For an example, I may want to keep shared assets in one directory (or on one BeeGFS filesystem) and use another directory as working directory:

- assets: /mnt/beegfs/assets
- working directory: /mnt/beegfs/apptainer

If data is available in netflow-io repository, it will be pulled to assets directory. If you're using Docker engine (rather than Apptainer, or Singularity), you'd use `--with-docker`. With Apptainer/Singularity use `--with-singularity` (you may need to specify BeeGFS bind options to let the container get to BeeGFS).

Pick a BeeGFS client (here it's `b5`) and run a sample script. The first time it is executed, we should see "Pulling" and "downloaded":

```sh
sean@b5: ~$ time ./nextflow run nextflow-io/rnatoy -with-docker -w /mnt/beegfs/apptainer/
N E X T F L O W  ~  version 22.04.5
Pulling nextflow-io/rnatoy ...
 downloaded from https://github.com/nextflow-io/rnatoy.git
Launching `https://github.com/nextflow-io/rnatoy` [wise_pare] DSL1 - revision: 5ec6d657cc [master]
R N A T O Y   P I P E L I N E    
=============================
genome: /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/ggal_1_48850000_49020000.Ggal71.500bpflank.fa
annot : /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/ggal_1_48850000_49020000.bed.gff
reads : /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/*_{1,2}.fq
outdir: results

executor >  local (5)
[c2/e56f29] process > buildIndex (ggal_1_48850000_49020000.Ggal71.500bpflank) [100%] 1 of 1 ✔
[5c/c40c03] process > mapping (ggal_gut)                                      [100%] 2 of 2 ✔
[c4/1e1ec4] process > makeTranscript (ggal_gut)                               [100%] 2 of 2 ✔
Done!

real	0m21.608s
user	0m11.262s
sys	0m0.658s
```

Notice that the results go to `outdir` (`results`, relative to where I'm running from), while assets contain all the input files. We could modify this but the point is now our assets have been downloaded and next time I can run a job that uses the same assets using another BeeGFS client (`b6`).

```sh
sean@b6:~$ time ./nextflow run nextflow-io/rnatoy -with-docker -w /mnt/beegfs/apptainer/
N E X T F L O W  ~  version 22.04.5
Launching `https://github.com/nextflow-io/rnatoy` [spontaneous_goldstine] DSL1 - revision: 5ec6d657cc [master]
R N A T O Y   P I P E L I N E    
=============================
genome: /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/ggal_1_48850000_49020000.Ggal71.500bpflank.fa
annot : /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/ggal_1_48850000_49020000.bed.gff
reads : /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/*_{1,2}.fq
outdir: results

executor >  local (5)
[b5/053f8a] process > buildIndex (ggal_1_48850000_49020000.Ggal71.500bpflank) [100%] 1 of 1 ✔
[02/9b8890] process > mapping (ggal_liver)                                    [100%] 2 of 2 ✔
[da/beba85] process > makeTranscript (ggal_liver)                             [100%] 2 of 2 ✔
Done!

real	0m18.244s
user	0m10.727s
sys	0m0.663s
```

This time there's no "Pulling" and "downloading" because the data is already there. We've just saved 3 seconds and few megabytes in downloads.

```sh
sean@b6:~$ dir -lat /mnt/beegfs/assets/nextflow-io/rnatoy/
total 11
drwxrwxr-x 4 sean sean   11 Aug 11 07:51 .
-rw-rw-r-- 1 sean sean   35 Aug 11 07:51 .dockerignore
drwxrwxr-x 7 sean sean   10 Aug 11 07:51 .git
-rw-rw-r-- 1 sean sean   17 Aug 11 07:51 .gitignore
-rw-rw-r-- 1 sean sean  288 Aug 11 07:51 .travis.yml
-rw-rw-r-- 1 sean sean  925 Aug 11 07:51 Dockerfile
-rw-rw-r-- 1 sean sean  773 Aug 11 07:51 README.md
-rw-rw-r-- 1 sean sean   48 Aug 11 07:51 Singularity
-rw-rw-r-- 1 sean sean  215 Aug 11 07:51 circle.yml
drwxrwxr-x 3 sean sean    1 Aug 11 07:51 data
-rw-rw-r-- 1 sean sean 3238 Aug 11 07:51 main.nf
-rw-rw-r-- 1 sean sean  487 Aug 11 07:51 nextflow.config
drwxrwxr-x 3 sean sean    1 Aug 11 07:51 ..

sean@b6:~$ du -sh /mnt/beegfs/assets/nextflow-io/rnatoy/
3.7M	/mnt/beegfs/assets/nextflow-io/rnatoy/
```

Bulk of this data consists of input files required for computation.

```sh
sean@b6:~$ dir -lat /mnt/beegfs/assets/nextflow-io/rnatoy/data/ggal/
total 2901
drwxrwxr-x 2 sean sean      6 Aug 11 07:51 .
drwxrwxr-x 3 sean sean      1 Aug 11 07:51 ..
-rw-rw-r-- 1 sean sean 173911 Aug 11 07:51 ggal_1_48850000_49020000.Ggal71.500bpflank.fa
-rw-rw-r-- 1 sean sean  26287 Aug 11 07:51 ggal_1_48850000_49020000.bed.gff
-rw-rw-r-- 1 sean sean 691873 Aug 11 07:51 ggal_gut_1.fq
-rw-rw-r-- 1 sean sean 691995 Aug 11 07:51 ggal_gut_2.fq
-rw-rw-r-- 1 sean sean 691873 Aug 11 07:51 ggal_liver_1.fq
-rw-rw-r-- 1 sean sean 691995 Aug 11 07:51 ggal_liver_2.fq
```

Results are local to each client. For example, on `b5`:

```sh
sean@b5:~$ ll results/
total 40
drwxrwxr-x  2 sean sean  4096 Aug 11 07:51 ./
drwxr-xr-x 28 sean sean  4096 Aug 11 08:07 ../
-rw-r--r--  1 sean sean 12950 Aug 11 07:51 transcript_ggal_gut.gtf
-rw-r--r--  1 sean sean 12950 Aug 11 07:51 transcript_ggal_liver.gtf
```

With Apptainer or Singularity, data will be packaged as one (container image) file, which is one of the advantages of Singularity-style containers.  Singularity cache directory is set to /mnt/beegfs/apptainer/singularity:

```sh
$ dir -lat /mnt/beegfs/apptainer/singularity
total 216597
drwxr-xr-x 47 sean sean        46 Aug 11 09:29 ..
drwxrwxr-x  2 sean sean         1 Aug 11 09:28 .
-rwxrwxr-x  1 sean sean 221794304 Aug 11 09:28 nextflow-rnatoy@sha256-9ac0345b5851b2b20913cb4e6d469df77cf1232bafcadf8fd929535614a85c75.img
```

## Summary

We can leverage BeeGFS to avoid unnecessary data movement and save compute and network resources. See the Nextflow documentation for details about configuration files and environment variables and adjust them to suit your needs.

BeeGFS on E-Series EF600 gives compute nodes the ability to read and write shared data at tens of gigabytes per second.

BeeGFS "classic" can be deployed manually - just download the software and follow the official documentation.

NetApp's approach uses shared disks (E-Series arrays) which eliminates the need to use BeeGFS mirroring (replication with RF=2): each server in a BeeGFS server node pair attached to an E-Series array acts as a backup server for the other node, and HA clustering is used for monitoring and fail-over. Ansible can be used to [create BeeGFS HA server clusters](https://galaxy.ansible.com/netapp_eseries/beegfs) attached to E-Series storage.
