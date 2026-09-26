# SolidFire WAC Gateway Client (PowerShell)

PowerShell module for SolidFire WAC Gateway

## SolidFire WAC Gateway

As a reminder, SolidFire Windows Admin Center (WAC) Gateway is an API gateway for SolidFire that runs on IIS and enables Windows authentication with advanced authorization.

You can see it under (1) here:

![SolidFire WAC Gateway](/assets/images/solidfire-wac-api-gateway.png)

I wrote about it [here](/2025/07/26/solidfire-windows-admin-center-gateway.html). You can see it in action [(video demo) here](/2025/07/30/solidfire-windows-admin-center-extension.html#appendix-a-demo).

## PowerShell client for SolidFire WAC Gateway

Today I built and posted a PowerShell module for it: [https://github.com/scaleoutsean/solidfire-wac-gateway-client](https://github.com/scaleoutsean/solidfire-wac-gateway-client).

I won't say it's "production-ready", but there's nothing "production-ready" about PowerShell cmdlets: the API (SolidFire WAC Gateway) is nearly production-ready and anyone who wants to use it in production could easily productize it and use this PowerShell module or create their own.

What this gives you is the ability to securely and easily consume SolidFire storage from a Hyper-V cluster with multiple tenants or from multiple Hyper-V clusters connected to a large SolidFIre cluster.

The same applies to Windows Admin Center plugin ([easy as well](/2025/07/30/solidfire-windows-admin-center-extension.html), see that video demo above).

## Conclusion

I've been thinking about building a Hyper-V-specific console for SolidFire WAC Gateway (something similar to [Firemox](/2025/07/07/firemox.html), but obviously better with advanced storage multi-tenancy), but I don't know anyone who might need it and so SolidFire WAC Client is enough.

This completes my years-long point about Hyper-V integration, WAC and Azure Local.

I'd always known it was easy and required minimal resources.

`\_( -.- )_/`
