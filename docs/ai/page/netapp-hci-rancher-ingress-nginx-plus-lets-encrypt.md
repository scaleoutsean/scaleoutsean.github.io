# Rancher Kubernetes Layer-7 NLB/Ingress with NGINX Plus and Let's Encrypt

Use F5 NGINX+ Layer-7 with TLS Termination as NLB for Rancher on NetApp HCI

**NOTICE**: any and all credentials and tokens on this page are samples, not leaked.

- [tl;dr](#tldr)
- [Introduction and requirements](#introduction-and-requirements)
- [Resources](#resources)
- [Deploy Linux VM and N+](#deploy-linux-vm-and-n)
- [Create DNS entries, get TLS certificates, configure NGINX](#create-dns-entries-get-tls-certificates-configure-nginx)
  - [Prepare DNS and open public firewall (port TCP/443)](#prepare-dns-and-open-public-firewall-port-tcp443)
  - [TLS with Let's Encrypt](#tls-with-lets-encrypt)
- [Install Rancher Servers](#install-rancher-servers)
  - [Configure N+](#configure-n)
    - [Upstream (Rancher) servers on different network](#upstream-rancher-servers-on-different-network)
  - [kubectl X.509 'certificate signed by unknown authority' error](#kubectl-x509-certificate-signed-by-unknown-authority-error)
- [Use N+ to reverse-proxy multiple Rancher clusters or services](#use-n-to-reverse-proxy-multiple-rancher-clusters-or-services)
- [Use N+ to reverse-proxy other API or service endpoints](#use-n-to-reverse-proxy-other-api-or-service-endpoints)
- [Next steps](#next-steps)

## tl;dr

Start with the instructions and config file samples from [this](https://rancher.com/docs/rancher/v2.x/en/installation/resources/advanced/single-node-install-external-lb/) page.

Read the below or search the Internet if you can't get it to work.

## Introduction and requirements

NetApp HCI users who run Rancher may need to expose K8s service or even their management plane to the Internet.

The Rancher infrastructure setup page for Ingress Load Balancer can be found [here](https://rancher.com/docs/rancher/v2.x/en/installation/other-installation-methods/behind-proxy/prepare-nodes/). There are many ways to do this and multiple reasons why someone chooses one way over another, but that's out of scope for this article (search the Internet, talk to a Kubernetes or NGINX expert, RTFM...)

This post outlines one specific approach based on the following assumptions:

- Our Rancher Kubernetes cluster should be securely and reliable exposed to the Internet (business requirement)
- Load Balancer mustn't run on the Rancher Servers (Rancher requirement)

Use case considerations (yours may be different):

- Because this is a publicly available service, we want enhanced security and enterprise support so we use [F5 NGINX Plus](https://www.nginx.com/products/nginx/) (aka "N+") and [NGINX AppProtect](https://www.nginx.com/products/nginx-app-protect/)
- N+ terminates TLS on port 443 (example: `rancher.doma.in:443`) and proxies requsts to Rancher servers's port 443. External incoming HTTP requests to N+ are simply forwarded to port 443 to have external traffic encrypted. Internally, N+ to Rancher still uses self-signed TLS certificates based on default Rancher setup (and self-signed CA), so while not ideal (something for another blog post), that will have to suffice for now.
- VMware HA is chosen to provide High Availability for N+. We could set up a pair of VMs and use [NGINX High Availability](https://www.nginx.com/products/nginx/high-availability) with [keepalived](https://docs.nginx.com/nginx/admin-guide/high-availability/ha-keepalived/), but considering our bandwidth and uptime requirements that is not necessary and can be done at a later time should our uptime or performance requirements change. (A single mid-sized VM instance (8 vCPUs) can foward-proxy HTTPS at a rate way higher than Internet-facing bandwidth most small and medium enterprises have at their disposal and estimated availability of VMware HA meets our current requirements)
- We have the option to use a wildcard certificate (`*.rancher.doma.in`) or create several subdomains (`rancher.doma.in`, `cluster[01-05].doma.in`). Note that this is where things can get complicated, depending on your situation with regards to DNS service you use, number of External IP addresses, CA issuance and so on. When we plan for this we should also consider how many Internet-facing services from user clusters we plan to deploy and what kind of degree of isolation (i.e. how many clusters, IPs, domain names) will be required.

## Resources

- We stand up a Rancher management cluster on NetApp HCI with VMware Standard or Enterprise Edition, using `ez-rancher`([download here](https://github.com/NetApp/ez-rancher/)) (or NetApp HCI's Hybrid Cloud Control, once it becomes available)
- [This document](https://rancher.com/docs/rancher/v2.x/en/installation/resources/advanced/single-node-install-external-lb/) has a basic configuration file for NGINX L7 load balancer with TLS termination - start with this config file
- NGINX
  - If you want to use N+, apply for a [free trial](https://www.nginx.com/free-trial-request/). Register, download the keys and install N+ according to [repo setup](https://cs.nginx.com/repo_setup) instructions. NGINX AppProtect is "out of band", so to speak, so its features may be a topic of another post.
  - If you want to use the free (community) version of NGINX, install it according to your distribution's instructions or see the official documentation ([example for Ubuntu](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/#prebuilt_ubuntu) and other distros can be found at this link.)
- If using Ubuntu 18.04 LTS, deploy a VM with `socat` and `open-vm-tools` packages and make sure its NTP and DNS clients work without problems
  - Your N+ VM can have a single NIC on the same or different network as your Rancher servers. In this case your External traffic would arrive via eth1 (for example) and leave (towards Rancher) via eth2. Other combinations are possible as well.

## Deploy Linux VM and N+

Maybe you'll need these (in N+ VM):

```sh
sudo apt-get install -y socat curl wget bc open-vm-tools jq git
```

This is my starting configuration:

```raw
# cat /etc/lsb-release
DISTRIB_ID=Ubuntu
DISTRIB_RELEASE=18.04
DISTRIB_CODENAME=bionic
DISTRIB_DESCRIPTION="Ubuntu 18.04.5 LTS"

# nginx -v
nginx version: nginx/1.19.5 (nginx-plus-r23)

# cat /etc/netplan/50-cloud-init.yaml
network:
    ethernets:
        ens192:
          addresses:
            - 192.168.1.172/24
          gateway4: 192.168.1.1
          nameservers:
            search: [datafabric.lab]
            addresses: [192.168.1.4, 192.168.1.5]
        ens224:
          addresses:
            - 192.168.105.172/24
...
```

`datafabric.lab` is a made up **internal** domain, we can ignore it for time being.

The VM above has two NICs, but both N+ and Rancher servers are on the same network (`ens192`). As noted earlier, you could go with Rancher VMs on another network but then N+ configuration may need to be made slightly more complex (to make use of `ens224`).

My back-end (Rancher) servers:

- 192.168.1.80 (s80)
- 192.168.1.81 (s81)
- 192.168.1.82 (s82)

There's no need to pay special attention to my network configuration. One or 11 NICs may be more suitable for your situation.

In fact we'll use only one NIC in this post. But if my upstream (back-end Rancher servers) was on another network to which we would get via `ens224`, then I would make use of that interface. More on that later.

Before you start experimenting, test your DNS, NTP clients and consider if you want to enable firewall on Ubuntu OS (to disable or limit inbound HTTP(S) access to N+ until you're sure it works as intended.)

NGINX can use unprivileged installation and can also be deployed in Docker. See [the docs](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-plus/#unpriv_install) if you're interested in these options.

## Create DNS entries, get TLS certificates, configure NGINX

The three internal Rancher servers (VMs) should ideally have internal FQDNs, especially if we want to use trusted TLS encryption between N+ and Rancher servers. Here we skip that part.

At minimum, we need one external FQDN and one TLS certificate for the IPv4 (or IPv6, or both) traffic that's incoming from public Firewall to N+ VM.

### Prepare DNS and open public firewall (port TCP/443)

You can do this step after N+ is confirmed to be properly configured, if you're concerned that typos or other issues may end up forwarding traffic elsewhere, or wrong kind of traffic to the right IPs.

Assuming we wanted to use the FQDN `rancher.doma.in`, we'd create appropriate external DNS entries (see Let's Encrypt or the Rancher document for NGINX linked above) and verify them with something like `nslookup rancher.doma.in`.

If we use Let's Encrypt we need to remember that some Let's Encrypt utilities require TCP/80 of the requesting client (e.g. N+ VM) to be accessible to the Internet (to Let's Encrypt's servers - see their FAQs). If you can't do this, consider using the DNS or manual approach. You don't necessarily need NGINX for this - certificates can be copied to NGINX configuration later and any CA can be used.

In our environment we did the following:

- `rancher.doma.in` resolves to Firewall's Internet-facing IPv4 address
- Firewall redirects incoming traffic to ports TCP/80 and TCP/443 to internal IP address 192.168.1.172 (`ens192` on N+ VM)
  - Port TCP/80 is not required to be open (we used the manual setup method for Let's Encrypt). But it is enabled anyway simply so that we don't have to type `https://` before `rancher.doma.in`
- N+ VM listens for requests to `rancher.doma.in` on incoming ports 80 (redirected to port 443) and 443 and forwards that traffic to "upstream" servers (that is, Rancher server VMs). I don't have any filtering (by IP), authentication or authorization (yet) on N+ at this time

### TLS with Let's Encrypt

There are many guides and [tools](https://letsencrypt.org/docs/client-options/) for this - pick the one you like. It's impossible to recommend one because everyone's circumstances differ.

As mentioned above, if you can't open firewall to forward incoming TCP/80 to N+ VM, you may not be able to use one set of tools, and if you can't use ACME DNS challenge, another won't work for you. Personally I ended up using a manual approach (with DNS) which downloaded a bunch of TLS certificates and one private key.

- Server certificate set: server certificate that we want to use on NGINX, and the matching private key (as two separate files)
- Certificate chain: server certificate (no private key) + intermediate certificates that signed the server certificate, spread around in three files
- Full chain: as the same says, all certificates together as one file starting with server certificate at the top. If private key isn't included here it has to be specified separately (`ssl_certificate_key` parameter.)

Depending on your CA, tools and processes you may end up with a slightly different set of files or formats (NGINX uses the PEM format), but you'll always need one server cert (and its private key) and one or more intermediate CA certs. Again, there's nothing NGINX- or Rancher-specific here.

## Install Rancher Servers

See README.md (or HCC online help, once it's released) and examine `rancher.tfvars.example` in the `ez-rancher` repository. I'll only highlight these three:

```raw
# Three Rancher VMs - happen to be on the same network as N+ VM's ens192 NIC,
#                     but could be on another network
static_ip_addresses = ["192.168.1.80/24", "192.168.1.81/24", "192.168.1.82/24"]

# N+ L7 LB FQDN
rancher_server_url = "rancher.doma.in"

# Do not let ez-rancher use URLs of nip.io URLs
use_auto_dns_url = false
```

Run `terraform apply` and at the end of a long log file you should see something like this:

```raw
cluster_nodes = [
  {
    "ip" = "192.168.1.80"
    "name" = "rancher-node01"
  },
  {
    "ip" = "192.168.1.81"
    "name" = "rancher-node02"
  },
  {
    "ip" = "192.168.1.82"
    "name" = "rancher-node03"
  },
]
rancher_server_url = https://rancher.doma.in
```

Now may be a good time to set a complex password for Rancher if you haven't done that in `rancher.tfvars`. Once N+ comes up, your Rancher servers may be exposed to the world.

### Configure N+

NGINX configuration defaults have the directives `worker_processes` set to `auto` and `worker_connections` to `1024`, while the Rancher documentation (link provided above) suggests higher values. I would suggest to not change these to Rancher-recommended values at first.

If you do need non-default values, values from the Rancher example probably won't be suitable for you. If you don't, then there's no reason to change them. If you don't know whether you need them or not, there's also no reason to change them. Start with the defaults, monitor and adjust as necessary.

 We used IPv4 addresses in the `upstream` block of the `http` [context](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/#contexts). We could use *internal* DNS names, such as `s8[0-2].datafabric.lab`, but that would make N+ depend on internal DNS servers which in this particular instance we wanted to avoid.

```raw
worker_processes auto;
worker_rlimit_nofile 40000;

events {
    worker_connections 1024;
}

http {
    upstream rancher_cluster_https {
        server 192.168.1.80:443 max_fails=3 fail_timeout=5s;
        server 192.168.1.81:443 max_fails=3 fail_timeout=5s;
        server 192.168.1.82:443 max_fails=3 fail_timeout=5s;
    }

    map $http_upgrade $connection_upgrade {
        default Upgrade;
        ''      close;
    }

    server {
        listen 443 ssl http2;
        server_name rancher.doma.in;
        # SSL CONFIG
        location / {
        # PROXY CONFIG
        }
    }

    server {
        listen 80;
        server_name rancher.doma.in;
        return 301 https://$server_name$request_uri;
    }
}
```

I deliberately left out the details of SSL and Reverse Proxy (from N+ VM to Rancher servers)  directives. The reason is directives and parameters may change between different versions of N+ and OpenSSL while optimal configuration depends on the environment (including HTTPS clients). There are already too many useless or outdated `nginx.conf` examples on the Web and we don't want to contribute to that mess.

Instead, we should start with the examples provided by Rancher (link at the top) and then look at the N+ documentation for the version of N+/NGINX we have to check whether they apply and what values can be used.

The official N+ documentation can be found [here](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/). If you have problems setting things up check in the Rancher 2.x or NGINX community (or contact NGINX support, if you use N+.)

Copy Let's Encrypt (or other) certificate to your NGINX VM using a self-documenting location such as `/etc/ssl/certs/rancher.doma.in/`, tighten the permissions (NGINX service user must be able to read them), and edit NGINX configuration file so that virtual HTTP(S) servers used to proxy requests to Rancher servers make use of that Let's Encrypt certificate. Other virtual servers may use other certificates (such as internal CA certificates, for example.)

```raw
ssl_trusted_certificate /etc/ssl/certs/rancher.doma.in/fullchain.crt;
ssl_certificate         /etc/ssl/certs/rancher.doma.in/server.crt;
ssl_certificate_key     /etc/ssl/certs/rancher.doma.in/server.key;
ssl_password_file       /etc/ssl/certs/rancher.doma.in/pass;
```

You can skip the below if you use an ACME (Let's Encrypt) client which does everything for you (and especially if it integrates with NGINX). Mine didn't, so I had to figure it out:

My `server.crt`:

- Server certificate (for `rancher.doma.in`)

My `fullchain.crt`:

- Server certificate (for `rancher.doma.in`), followed by
- Public key for IdenTrust (cross-signer for the R3 certificate), followed by
- Let's Encrypt R3 (RSA Intermediate Certificate)

I suppose having two intermediate certificates increases compatibility of clients (that is, a server TLS certificate should validate even on HTTPS clients who don't have one of the CA root certificates in their OS or browser).

Separately, I imported IdenTrust and Let's Encrypt Root CA certificates to Ubuntu CA Certificate Store (although they should be there by default if your Ubuntu is up-to-date - if you're curious you can check before vs after - look what you already have under `/etc/ssl/certs/`.)

My `server.key`:

- Private key of my server certificate

My password file `pass` (you can name it any way you want):

- Text file with one line and one word (password to my server certificate)

As you can imagine, you'd want to secure this VM *real* good.

While Let's Encrypt client (ACME) is easy to use, trying to understand what the hell is going on under the hood, where each certificate comes from and how they're related to each other turned out to be less easy. Let's Encrypt users can find some of these answers here (also read their FAQs):

- [https://letsencrypt.org/certificates/](https://letsencrypt.org/certificates/)

With that in place, reload N+ configuration. If N+ is not running, start it. If it fails it will tell you why - make a backup, edit `nginx.conf`, and try again - you know the drill.

```sh
nginx -s reload
# or
sudo systemctl start nginx
```

Test by visiting https://$DOMAIN:443. You can also use [external sites](https://www.ssllabs.com/ssltest/index.html) to test the reachability and quality of your setup. Or try using OpenSSL client:

```shell
openssl s_client -connect rancher.doma.in:443
```

Eventually you should see something like this.

![Rancher behind NGINX Plus L7 TLS-Terminating Proxy](/assets/images/nginx-lets-encrypt-certificate.png)

Let's Encrypt certificates are valid for only 12 weeks. Many users use `cron` or other scheduler to automate TLS certificate renewal (actually it's re-issuance). If that's permissible and possible in your environment, there's even more value in using an automated or semi-automated approach.

If you want to send N+ access and error logs elsewhere, read the NGINX documentation on how to do that, do it and reload N+ configuration again.

#### Upstream (Rancher) servers on different network

Earlier I mentioned how I would make use of the second interface in my N+ VM, if upstream servers were on another network.

Take a look at the following options if you need to make NGINX listen on, and bind the proxy service to, some particular network:

```raw
server {
    listen ;
    proxy_pass ;
    proxy_bind ;
}
```

Read about these options in the the NGINX documentation if you need to do this.

### kubectl X.509 'certificate signed by unknown authority' error

As you use `kubectl` to access your cluster via N+, your client needs to use the new Let's Encrypt TLS certificate against `rancher.doma.in`.

- Default TLS cert is issued by self-signed CA): `O = Acme Co, CN = Kubernetes Ingress Controller Fake Certificate`
- N+ L7 Proxy TLS cert is issued by Let's Encrypt CA): `C = US, O = Internet Security Research Group, CN = ISRG Root X1`

If you continue using the default certificate included in K8s config file obtained from the Rancher cluster, `kubectl` will try to match validate the fake cert against `rancher.doma.in` TLS, which won't work.

```sh
kubectl get nodes
Unable to connect to the server: x509: certificate signed by unknown authority
```

Remember that in this post we didn't touch our Rancher cluster, so now the only way to get around the mismatch between the fake self-signed cert and what `rancher.doma.in` has is this:

```sh
kubectl --insecure-skip-tls-verify=true get nodes
NAME             STATUS   ROLES                      AGE     VERSION
rancher-node01   Ready    controlplane,etcd,worker   3d22h   v1.19.4
rancher-node02   Ready    controlplane,etcd,worker   3d22h   v1.19.4
rancher-node03   Ready    controlplane,etcd,worker   3d22h   v1.19.4
```

That's not ideal, to say the least. What you can do to properly validate the cert is to replace the fake CA-issued cert from kubeconfig with the Let's Encrypt-issued TLS used by N+.

- Go to your N+ server. Get the server cert with `cat /etc/ssl/certs/rancher.doma.in/server.crt | base64 |  tr -d "\n"`
- Replace `certificate-authority-data` in the kubeconfig file from the Rancher cluster

After that `kubectl`, `helm` and other commands will work without workarounds.

Ideally we should deploy Kubernetes so that these workarounds aren't necessary, but this post is limited to dealing with TLS termination on a L7 LB VM with NGINX or NGINX Plus. I may explore internal CA and certs for Rancher and K8s in general in a future post.

## Use N+ to reverse-proxy multiple Rancher clusters or services

If you want to expose multiple clusters using the same port and IP address, read [this](https://docs.nginx.com/nginx/admin-guide/security-controls/terminating-ssl-http/#an-ssl-certificate-with-several-names).

Ideally you'd have multiple addresses and different TLS certificates, but workarounds may be possible too: use a different IP address for each cluster, use the same IPv4 address but a different port for each cluster, or run N+ on a nearby Public Cloud and forward requests to your on-premises Rancher through VPN.)

Of course, get familiar with K8s networking and security before doing this.

## Use N+ to reverse-proxy other API or service endpoints

This isn't related to external access to Rancher cluster(s), but just something you may want to consider since you already set up that highly available NGINX reverse proxy. (As mentioned earlier, `datafabric.lab` is my **internal** domain, completely unrelated to Let's Encrypt, Ingress or External FQDN.)

In our case there are internal Web-based services such as HCI Collector which use Basic Authentication and would benefit from the security NGINX reverse proxy can provide. While it is possible to create TLS certificates HCI Collector containers, it is also not very convenient and if we did that at most we'd only create yet another NGINX proxy on the HCI Collector VM.

What we can do is add a new "section" to our new N+ configuration and perform authentication for HCI Collector service with a vetted and supported N+ and so eliminate the unnecessary reverse proxy sprawl.

Another example is the NGINX dashboard (if you have N+, visit `http://nginx-server:8080/dashboard.html`), which doesn't need external access but requires authorization for *write* access to NGINX API.

We can use internal DNS and CA to create additional FQDNs such as `perf.datafabric.lab` and `ap-gw.datafabric.lab`, deploy internal TLS certificates to N+ and expose such services to users on different internal networks.

While we can (and should) use HTTPS where possible, here's an example of using N+ to serve as API proxy to a read-only API endpoint and dashboard - its own API dashboard (available in N+) - for which I didn't have time to issue internal TLS certificate:

![Internal API endpoint exposed via HTTP behind NGINX Plus](/assets/images/nginx-api-gateway-dashboard-internal.png)

```raw
  server {
    listen 8080;
    location /api {
      api write=off;
    }
    location = /dashboard.html {
      root   /usr/share/nginx/html;
    }
    location = /status.html {
      return 301 /dashboard.html;
    }
  }
```

Additional details can be found [here](https://docs.nginx.com/nginx/admin-guide/monitoring/live-activity-monitoring/#).

## Next steps

There's a lot more to be done here, for example:

- Centralize logging for auditing, security and performance [monitoring](https://docs.nginx.com/nginx/admin-guide/monitoring/live-activity-monitoring/#configuring-the-api) purposes
- Automate certificate re-issuance
- Break down `nginx.conf` into sections to make it easier to understand and maintain
- Make N+ part of your CI/CD operations so that proxy configuration is added, changed and removed automatically
- Implement proper CA and TLS certificates for K8s servers
- Implement modern authentication and authorization for services that may have outdated configuration (TLSv1 or SSLv3) or use old ciphers
- Implement fine-grained access to on-premises clusters and services based on IP address and other criteria
- Implement rate reservations and limits for services proxied by N+ and beyond the granularity you get from your firewall
- Implement Hybrid Cloud integrations so that you can run and manage your services on- and off-premises, burst to cloud, and more (if you're using containers in Public Cloud but don't know about [spot.io](Spot): Spot can help you observe and optimize cloud costs - register for free and see estimated savings in no time!)

These integrations can easily take months or even quarters, depending on the size of your team and the length of your to-do list, which is why I believe it makes sense to pay for, rather than build by yourself, important components (such as NGINX Plus or Rancher, for example).

Users can save time by getting professional advice and implementation help, as well as increase the quality and security of these integrations, without introducing integrations that can be extremely difficult-to-untangle.

The benefits of this approach are not limited to K8s but extend across your K8s, VI and bare metal services and into hybrid or multi-cloud environments - just like NetApp Data Fabric.
