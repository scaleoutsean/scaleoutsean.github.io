# Install NetApp Trident v21.01 with Helm v3, SolidFire

How to install NetApp Trident v21.01.01 on NetApp HCI with Helm

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

NetApp Trident v21.01.01 supports Helm. This makes Trident easier to install, especially if you have multiple clusters or stand up and destroy clusters on a regular basis.

Download Trident from Github, decompress and change directory to `helm`. Make sure your `kubectl` (or `oc`) and `helm` both work.  We'll install Trident to a new namespace called `trident`:

```raw
$ wget https://github.com/NetApp/trident/releases/download/v21.01.0/trident-installer-21.01.0.tar.gz
$ tar xfz trident-installer-21.01.0.tar.gz; cd trident-installer/helm
$ helm install trident trident-operator-21.01.0.tgz --namespace trident --create-namespace
NAME: trident
LAST DEPLOYED: Mon Feb  1 17:29:18 2021
NAMESPACE: trident
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
Thank you for installing trident-operator, which will deploy and manage NetApp's Trident CSI
storage provisioner for Kubernetes.

Your release is named 'trident' and is installed into the 'trident' namespace.
Please note that there must be only one instance of Trident (and trident-operator) in a Kubernetes cluster.

To configure Trident to manage storage resources, you will need a copy of tridentctl, which is
available in pre-packaged Trident releases.  You may find all Trident releases and source code
online at https://github.com/NetApp/trident.

To learn more about the release, try:

  $ helm status trident
  $ helm get all trident
```

Use these two commands (above) to see what's up with your Trident. Check the status of Trident pods the usual way.

```raw
$ kubectl -n trident get pods
NAME                                READY   STATUS    RESTARTS   AGE
trident-csi-dfbd8899d-5smjg         6/6     Running   0          80s
trident-csi-l7qpw                   2/2     Running   0          80s
trident-operator-76989856bd-fc26g   1/1     Running   0          81s
```

Now you can create a back-end for SolidFire by using `trident-installer/sample-input/backend-solidfire.json` (change username and password in Endpoint, MVIP and SVIP in Endpoint and SVIP, respectively, and TenantName):

```json
{
    "version": 1,
    "storageDriverName": "solidfire-san",
    "Endpoint": "https://admin:nimda@192.168.1.30/json-rpc/11.0",
    "SVIP": "192.168.103.30:3260",
    "TenantName": "helmetsky",
    "Types": [{"Type": "Bronze", "Qos": {"minIOPS": 200, "maxIOPS": 390, "burstIOPS": 600}},
              {"Type": "Silver", "Qos": {"minIOPS": 400, "maxIOPS": 590, "burstIOPS": 1000}},
              {"Type": "Gold", "Qos": {"minIOPS": 600, "maxIOPS": 800, "burstIOPS": 2000}}]
}
```

With this (your filename and path may differ), we create a back-end:

```raw
$ ./tridentctl create backend -n trident -f ../back-end.json
+--------------------------+----------------+--------------------------------------+--------+---------+
|           NAME           | STORAGE DRIVER |                 UUID                 | STATE  | VOLUMES |
+--------------------------+----------------+--------------------------------------+--------+---------+
| solidfire_192.168.103.30 | solidfire-san  | e656fa37-ee5a-4b23-95f4-07482e2c6e5b | online |       0 |
+--------------------------+----------------+--------------------------------------+--------+---------+
```

For the above to work, your Endpoint must work. Later on iSCSI client on the worker(s) must be properly configured as well, so you could use this opportunity to configure iSCSI on the worker(s), create a test volume on SolidFire and login manually from the workers.

Next, use one or more samples for storage classes from the same sample-input subdirectory to create SCs and you're done.

For Rancher on NetApp HCI, review and make a desired SC the default SC in the Rancher Web UI.

See my Trident related videos on YouTube and previous Trident-related posts for additional details. Also, don't forget to RTFM!
