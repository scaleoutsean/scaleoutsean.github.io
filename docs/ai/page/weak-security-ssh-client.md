# Overcome SSH invalid key length, SSH security annoyances

Overcome SSH invalid key length error on daily basis

## Problem

Your SSH client fails to connect and reports `Bad server host key: Invalid key length`. What to do?

Root cause: your SSH client is not shitty enough.

## Weak Link SSH to rescue 

You can create one-off, per-host SSH client configurations, but if you need to **do this every day** this "solution" might drive you nuts. Let's not go nuts just yet.

To solve my own problem I built a container based on Ubuntu LTS from 10 years ago and should be able to connect to devices released after 2010. A 10 years old OS ought to be enough for (almost) everyone. If that's not ~~good~~ bad enough for you, try 14.04 or 12.04 and rebuild.

![Weak Link SSH)](/assets/images/weak_link_ssh_01.png) 

Your host may be unable to create SSH keys that are weak enough. Weak Link SSH crushes that obstacle without any issues!

Let's start by creating a weak-ass SSH key pair.

Start by building your own, or using my Docker Hub, container image (in which case remember to tag it after pulling it, so that the README examples can be used without the long container name).

```sh
docker pull docker.io/scaleoutsean/weak-link-ssh:latest
docker tag docker.io/scaleoutsean/weak-link-ssh:latest weak-link-ssh:latest
```

Make sure you get `:latest` as it may be improved (i.e. the security weakened) in the future.

Let's create weak-ass SSH key pair by entering the container and creating the there:

```sh
$ docker run --rm -it -v "$PWD:/mnt" weak-link-ssh:latest bash
root@db31a74f70ce:/# ssh-keygen -t rsa -b 1024 -f /mnt/legacy_id_rsa
Generating public/private rsa key pair.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Your identification has been saved in /mnt/legacy_id_rsa.
Your public key has been saved in /mnt/legacy_id_rsa.pub.
The key fingerprint is:
SHA256:g/uS44+Bmuh2LwzNEBLovfnuTi+e5d/9f56qXddLq18 root@db31a74f70ce
The key's randomart image is:
+---[RSA 1024]----+
|o.               |
|o.               |
|o o              |
| o .   .         |
|  + o . S        |
| . = . . .      .|
|  o o.oo       oE|
| o *.oO+  . o o B|
|+.+ BO+*+. o.==B=|
+----[SHA256]-----+
```

Now exit the container and find your lame-ass SSH keys in current directory.

Move them to a dedicated directory such as `~/.ssh_weak_link/` and confirm the permissions. In case of any issues make sure their permissions are secure (one can't be careful enough these days!).

```sh
$ mv legacy_id_rsa* .ssh_weak_link/

$ ll .ssh_weak_link/
total 8
-rw-------. 1 root root 887 Feb 14 01:22 legacy_id_rsa
-rw-r--r--. 1 root root 231 Feb 14 01:22 legacy_id_rsa.pub
```

Now we can use these lame-ass SSH keys to connect to our lame-ass SSH server(s).

```sh
[sean@ictad27h01 ~]$ docker run --rm -it \
  -v "$HOME/.ssh_weak_link:/root/.ssh:ro" \
  weak-link-ssh:latest ssh-legacy admin@10.1.2.3
The authenticity of host '10.1.2.3 (10.1.2.3)' can't be established.
RSA key fingerprint is SHA256:zz2LjQMx4ElswTS70vQ7TYaHXkn6E0UO6n7dtOoOIAg.
Are you sure you want to continue connecting (yes/no)? yes
Failed to add the host to the list of known hosts (/root/.ssh/known_hosts).
User Access Verification
Password:

Cisco Nexus Operating System (NX-OS) Software
```

And with that, my Rocky Linux 10.1 is unable to stop me from connecting to lame-ass SSH servers from 2018.

![Weak Link SSH connected to SSH server from 2018)](/assets/images/weak_link_ssh_02.png) 

That's not the only thing Weak Link SSH does. It has additional features for anyone who needs lower security these days. Read about them in the README.

### Ansible angle

We should be able to configure this in Ansible configuration file, but this likely won't work.

```ini
[ssh_connection]
ssh_args = -F /home/sean/.weak_link_ssh/legacy_id_rsa
```

Why? Because your client may be too new and/or Ansible modules may be messing with you. Paramiko, for example, [dropped some legacy features](https://www.paramiko.org/changelog.html) in version 4.0.0. I guess in those cases you may need to add an old version of Ansible to the container and use old versions of everything.

## Conclusion

Weak Link SSH helps you connect to shitty SSH servers form the '10s. If that is not enough, we can weaken its security further - let me know in Issues.

Weak Link SSH is ideal for IT folks in telcos, government, utilities and anyone in IT professional services.

Get your weak-ass SSH client at [github.com/scaleoutsean/weak-link-ssh](https://github.com/scaleoutsean/weak-link-ssh)!
