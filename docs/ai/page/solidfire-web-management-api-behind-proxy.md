# SolidFire management Web site and API endpoint behind a proxy

About accessing the Web UI and API via a proxy server

## Introduction

Later (12.*) versions of SolidFire have this annoying authentication callback redirect which seems to prevent proper reverse proxying of the Web UI.

I haven't found a way to make HTTPS reverse proxy work for the Web UI.

## Environment and problem description

- Client: 192.168.1.13
- Proxy server: 192.168.1.137 (s137.datafabric.lan) with a route to 192.168.105.0/24 (management network)
- SolidFire MVIP: 192.168.105.32:443 (management network)

When the Web UI is accessed directly, the first 302 redirection happens:

```raw
https://192.168.105.32/auth/connect/authorize?
client_id=element-ui&
redirect_uri=https%3A%2F%2F192.168.105.32%2Fcluster%2F%23%2Fauth-callback&
response_type=code&
scope=openid+profile+element_api&
state=454b3859b0fd460fa87b9de3ffc1a5c2&code_challenge=511gUL-IOYiG1E3GV-LIHSEWk1My1FgbRCyfTiBJpYk&
code_challenge_method=S256
&response_mode=query
``````

Followed by the second:

```raw
https://192.168.105.32/auth/api/2/account/login?
returnUrl=%2Fauth%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Delement-ui%26redirect_uri%3Dhttps%253A%252F%252F192.168.105.32%252Fcluster%252F%2523%252Fauth-callback%26response_type%3Dcode%26scope%3Dopenid%2520profile%2520element_api%26state%3D454b3859b0fd460fa87b9de3ffc1a5c2%26code_challenge%3D511gUL-IOYiG1E3GV-LIHSEWk1My1FgbRCyfTiBJpYk%26code_challenge_method%3DS256%26response_mode%3Dquery
```

## Reverse proxy

What works: API access which will use Basic Authentication header over TLS. To do this, simply configure NGINX or other reverse proxy to terminate TLS and proxy it to the SolidFire API endpoint(s) - mostly MVIP, but you could do node MIPs as well.

What doesn't work: Web management. A simple reverse proxy setup makes redirect URL lead to the internal (MVIP) address (unchanged from examples above) which obviously cannot work since MVIP isn't reachable by the Web client.

Even if the redirect links are manipulated to redirect the client to the proxy server's Public FQDN or IP, it doesn't seem to work without additional tricks which I couldn't figure out.

![Error on redirect](/assets/images/solidfire-web-management-ui-reverse-forward-proxy-01.png)

There are [complex](https://surepassid.atlassian.net/wiki/spaces/ProdDoc/pages/2292056065) examples for OIDC reverse proxy configuration out there, but without access to the SolidFire API server's settings the risk of spending hours on this and then getting stuck because some SolidFire Web UI setting can't be changed seemed too high. So I haven't tried.

## Transparent proxy

Instead, I tried Squid. Admittedly, Squid may not be fashionable and not many people use it, but it's still maintained and free. 

If tightly guarded (IP ACLs, etc.), it may be okay to use it here. Or use some commercial software that does the same.

My proxy server was Rocky 8.8 so I installed squid-4.15-6. 

The only thing I changed in default config was to change `acl localnet src 192.168.0.0/16` to `acl localnet src 192.168.1.0/24`, although `acl localnet src 192.168.1.13/32` would have also worked.

I could have limited IP access with firewalld, added authentication (see [here](https://wiki.squid-cache.org/Features/Authentication)), and TLS proxying ([SSL Bump](https://support.kaspersky.com/KWTS/6.1/en-US/166244.htm)) for additional security.

After that, I changed client browser's proxy settings for HTTP(S) to Squid's service IP and port.

![Configure HTTP(S) proxy in your browser](/assets/images/solidfire-web-management-ui-reverse-forward-proxy-02-firefox.png)

That worked.

![Watch Squid log](/assets/images/solidfire-web-management-ui-reverse-forward-proxy-03-squid.png)

Squid access log:

```sh
1690797272.717     61 192.168.1.13 TCP_TUNNEL/200 10562 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797272.739      0 192.168.1.13 NONE/000 0 NONE error:transaction-end-before-headers - HIER_NONE/- -
1690797272.739      0 192.168.1.13 NONE/000 0 NONE error:transaction-end-before-headers - HIER_NONE/- -
1690797272.739      0 192.168.1.13 TCP_TUNNEL/200 39 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797273.809    163 192.168.1.13 TCP_TUNNEL/200 6161 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797273.812    166 192.168.1.13 TCP_TUNNEL/200 4075 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797273.872     46 192.168.1.13 TCP_TUNNEL/200 5656 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797273.873    230 192.168.1.13 TCP_TUNNEL/200 7160 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
1690797273.925     63 192.168.1.13 TCP_TUNNEL/200 3399 CONNECT 192.168.105.32:443 - HIER_DIRECT/192.168.105.32 -
```

So at least we know this works and can be improved to be reasonably secure.

## Summary

Reverse proxying of SolidFire Web management UI access is hard, if not impossible, to configure. It works for JSON-RPC API with Basic Authentication to the API IP endpoint.

A workaround for Web management UI is to use a properly guarded transparent HTTPS proxy.
