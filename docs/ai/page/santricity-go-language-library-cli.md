# E-Series SANtricity Go client for Day 1+ operations

E-Series SANtricity client library

## Introduction

[Reautomating E-Series](/2025/12/22/reautomating-eseries.html) has the background.

Since less than four weeks ago, I've "hand-crafted" a `santricity-client` (Python) and `santricity-powershell` (PowerShell) and have some other things "cooking".

Do we also need a Go language client? Of course we do.

Do we have the resources? Let's find out.

## `santricity-go`

There are several ways this can be done, but some are harder than others.

If you've read that post at the top, you must have noticed that Trident CSI used to support E-Series until it didn't because reasons.

That's good to know because someone might take that code and use it. Which is exactly what I did.

So, we now have a stand-alone, slim client library for Go that works with SANtricity 11.90+.

There wasn't much to update since the time NetApp dumped E-Series backend support. I've found a volumes-related API call that needed a small update and the rest was straightforward. If anything else crops up, it'll be fixed.

I've also added Bearer authentication (mutually exclusive with Basic authentical most people are used to - Trident E-Series backend used that as well).

There's a small proof-of-concept-ish CLI with two "example" calls, `get system` and `get volume`, but the library can do all the stuff Trident v22.01 could and more (Bearer authentication I've already mentioned, and the other one is the ability to load trusted certificate chain). 

![get system and get volumes](/assets/images/santricity-go-01-get-system-volumes.png)

The library retained features Trident CSI implemented at the time:

- System: AboutInfo, GetStorageSystem
- Volumes: GetVolumes, CreateVolume, ResizeVolume, DeleteVolume, MapVolume, UnmapVolume
- Pools: GetVolumePools
- Hosts: CreateHost, GetHostForIQN

The code is published under the Apache 2.0 License, the same license that the Trident repository uses.

## Next steps

We have a working Go client library for E-Series. Without any "resources", mind you! 

It's not anything like E-Series Ansible collection, but it's - as it was in 2022 - enough for Day 1+ use.

What's next?

Well, it's a building block. Now we can build plugins and other integrations with it.

- Import Path: github.com/scaleoutsean/santricity-go
- Package Name: santricity

In terms of "new features", I'm not in a hurry. Snapshots and NVMe/RoCEv2 host support would be nice to have, but I'll add what is needed and when it's needed. Or if someone creates a pull request.

Three weeks ago there was almost nothing. Now we have three semi-decent client libraries under very permissive licenses and we can use these building blocks to build something useful.

Fork as you seef fit!
