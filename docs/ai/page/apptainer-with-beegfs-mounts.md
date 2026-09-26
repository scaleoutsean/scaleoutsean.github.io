# Apptainer with BeeGFS

Access BeeGFS from Apptainer container

Apptainer is [based on the Singularity project](https://apptainer.org/news/community-announcement-20211130/).

It has several advantages over Docker and Portman, but in this post I'll just write about the ease of use for users who use containers to interactively access shared files (in this case, files on BeeGFS).

Apptainer can be installed on hosts that have Docker and BeeGFS installed (no need to stand up a new VM with BeeGFS client) to check if we can access data on BeeGFS.

Create a directory on BeeGFS and make sure it's accessible to whoever needs to access it in terms of ownership or permissions.

```sh
$ mkdir /mnt/beegfs/apptainer
```

Start an Apptainer container with that directory mounted:

```sh
$ export APPTAINER_BIND="/mnt/beegfs/apptainer:/mnt"

$ apptainer shell docker://alpine 
INFO:    Using cached SIF image

Apptainer> df
Filesystem           1K-blocks      Used Available Use% Mounted on
tmpfs                    16384        12     16372   0% /
squashfuse               16384        12     16372   0% /etc/group
squashfuse           129125532  12353024 110170268  10% /etc/hosts
squashfuse               16384        12     16372   0% /etc/passwd
squashfuse               16384        12     16372   0% /etc/resolv.conf
squashfuse             3000304         0   3000304   0% /dev
squashfuse            10470400    184832  10285568   2% /mnt
squashfuse           129125532  12353024 110170268  10% /tmp
udev                   3000304         0   3000304   0% /dev
tmpfs                  3044440         0   3044440   0% /dev/shm
/dev/sda3            129125532  12353024 110170268  10% /etc/localtime
/dev/sda3            129125532  12353024 110170268  10% /etc/hosts
tmpfs                  3044440         0   3044440   0% /sys/fs/cgroup
/dev/sda3            129125532  12353024 110170268  10% /home/vagrant
/dev/sda3            129125532  12353024 110170268  10% /tmp
/dev/sda3            129125532  12353024 110170268  10% /var/tmp
tmpfs                    16384        12     16372   0% /etc/resolv.conf
tmpfs                    16384        12     16372   0% /etc/passwd
tmpfs                    16384        12     16372   0% /etc/group
beegfs_nodev          10470400    184832  10285568   2% /mnt
```

(/mnt is at the very bottom of the list)

Write and read a file to/from BeeGFS directory mounted at /mnt:

```
Apptainer> ls /mnt/
Apptainer> touch /mnt/from-container.txt
Apptainer> echo "sean" >> /mnt/from-container.txt
Apptainer> cat /mnt/from-container.txt
sean
Apptainer> exit
```

Check the file from the host or any BeeGFS client that mounts the same filesystem:

```
$ ll /mnt/beegfs/apptainer/
total 2
drwxr-xr-x 2 sean sean 1 Aug  8 10:11 ./
drwxrwxrwx 7 root    root    5 Aug  8 10:05 ../
-rw-rw-r-- 1 sean sean 5 Aug  8 10:11 from-container.txt

$ cat /mnt/beegfs/apptainer/from-container.txt 
sean
```

If apptainer is started without `--no-home`, user's $HOME directory is made accessible without any extra steps.

```sh
Apptainer> ls -lat
total 53376
-rw-------    1 sean  sean        212 Aug  8 10:12 .ash_history
drwxr-xr-x    3 sean  sean         60 Aug  8 10:11 ..
drwxr-xr-x   19 sean  sean       4096 Aug  8 10:10 .
drwx------    3 sean  sean       4096 Aug  8 09:29 .local
drwx------    3 sean  sean       4096 Aug  8 09:29 .apptainer
-rw-------    1 sean  sean     133867 Aug  8 08:57 .bash_history
-rw-------    1 sean  sean      23935 Aug  8 06:10 .viminfo
drwxrwxr-x   10 sean  sean       4096 Aug  8 06:08 njobs
drwxr-xr-x    2 sean  sean       4096 Aug  8 06:08 .vim
...
```

As you can see it's very easy to understand and convenient - more so than with Docker and Podman, I would say.

More on Apptainer mounts can be found in [TFM](https://apptainer.org/docs/user/main/bind_paths_and_mounts.html). 

Some other advantages (copied from the project's Github page) that you may want to explore on your own:

- An immutable single-file container image format, supporting cryptographic signatures and encryption
- Integration over isolation by default. Easily make use of GPUs, high speed networks, parallel filesystems on a cluster or server
- Mobility of compute. The single file SIF container format is easy to transport and share
- A simple, effective security model
