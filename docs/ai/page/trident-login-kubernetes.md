# Fix Trident's expired credentials for Kubernetes API

tridentctl hits Unable to connect to the server: x509: certificate has expired or is not yet valid

Today I got this error on Kubernetes v1.23.4 while trying out a Trident CLI command (tridentctl):

```
Error: found the Kubernetes CLI, but it exited with error: Unable to connect to the server: x509: certificate has expired or is not yet valid: current time 2022-03-01T07:51:19Z is after 2022-02-17T05:32:52Z
```

There are many different reasons why you can hit this but I'll focus just one one, specific to this issue with Trident.

`tridentctl` uses `KUBECONFIG`, so when tridentctl doesn't work that's the first thing to check: is kubeconfig there, is it accessible, etc.

The file was there and accessible but API certificate has expired, I thought. Instinctively I tried to renew the certificates.

The below is overkill because it renews all of them, but I didn't care because it's a home lab.

```sh
kubeadm certs renew all
```

This didn't work - of course - because ... my kubeconf wasn't valid. Doh!

So I ran the same again but with `sudo` which read the valid kubeconfig file from its default location on my system, /etc/kubernetes/admin.conf.

I rebooted all involved nodes (I have only three so I had to restart services on all of them, one by one). You could also restart affected services, but I didn't care to find out how to do that so I just rebooted.

Then I tried again, and this time I got a different error.

```sh
Found the Kubernetes CLI, but it exited with error: error: You must be logged in to the server (the server has asked for the client to provide credentials)
```

Now I realized wher the problem was. I copied /etc/kubernetes/admin.conf to ~/.kube/config and was able to use tridentctl:

```sh
sean@k1:~$ kubectl get nodes
NAME   STATUS   ROLES                  AGE    VERSION
k1     Ready    control-plane,master   377d   v1.23.4
k2     Ready    <none>                 339d   v1.23.4
k3     Ready    <none>                 377d   v1.23.4

sean@k1:~$ ./trident-21.01/bin/tridentctl -n trident get backend 
+--------------------------+----------------+--------------------------------------+--------+---------+
|           NAME           | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+--------------------------+----------------+--------------------------------------+--------+---------+
| solidfire_192.168.103.34 | solidfire-san  | 8d516181-3c2d-4ca5-bba9-b875725f5646 | online |       0 |
+--------------------------+----------------+--------------------------------------+--------+---------+
```

So it's likely that I didn't need to renew certificates at all.

I didn't check beforehand but it's possible /etc/kubernetes/admin.conf was okay the whole time - I could have copied it over my ~/.kube/config and changed the ownership: that could have been enough.
