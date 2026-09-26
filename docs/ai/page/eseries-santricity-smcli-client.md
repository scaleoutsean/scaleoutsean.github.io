# How to actually get started with E-Series SANtricity SMcli

Why you should not get started with NetApp E-Series SMcli

## Introduction

[Reautomating E-Series](/2025/12/22/reautomating-eseries.html) has more about SANtricity automations and integrations in recent years. In order to address some of those issues last week I created a minimal [SANtricity client library for Python](/2025/12/29/santricity-client.html) and explained its advantages. 

This week I've decided to check out SMcli to see what it's about. I've never touched it my life. There was a good PowerShell [module](/2024/03/28/netapp-santricity-powershell-module.html), but even that wasn't of much use to me.

But, as I progress with other "reautomation" work, I decided to take a look at SMcli to see what it's like. It sucks.

But there's more to it, so:
- it sucks for almost everything, but you may still need to use it
- it's okay for some things
- you may learn some tips, workarounds, and solutions before your AI scraps this post (after which you'd get a nice summary without reading this post)

## Download E-Series SANtricity CLI (SMcli)

I forgot to mention - the docs suck, too! 

I think I could have added basic automation for full deployment in less time than it took me to figure out where and how to download this thing.

The documentation for SMcli 11.90 has a "Get started" section that does several things, but the one thing it won't do is get you started. 

One of the things burried somewhere is how to download SMcli. One might think that's the first step in getting started, but apparently not everyone agrees!

![How not to get started)](/assets/images/smcli_02_get_started.png) 

To download SMcli for SANtricity 11.9x, go to the SANtricity Web UI, and in Settings you'll find it. You should always re-download it when SANtricity OS is updated because the API isn't versioned.

![Download SMcli from SANtricity Web UI](/assets/images/smcli_01_download.png)

On SANtricity 11.90 that thing is in **Settings** > **System** > **Add-ons**. Unzip the archive to a subdirectory (otherwise it dump contents to current).

Since you need a JRE or JDK, make sure you have one. I was on Windows Server 2025. 

I downloaded the second newest OpenJDK, a Microsoft-built OpenJDK 21, from the Microsoft Web site and installed it with full options (everything enabled in installer options, as I didn't have plans to use other JDKs), but the defaults should work fine if you don't have multiple JDKs.

Then open a new console to get the Java path kick in and you can continue.

## How to actually get started with SMcli

The best way to get started is to not read Get Started at first. Here's how it works:
- We must download SMcli (done)
- Then we must configure arrays. One part of that is TLS certificates because SMcli uses HTTPS and how much needs to be done depends on how good your certificates are. Snake oil certificates require more work.
- SMcli uses Java to store TLS certificates in a trust store. In order to work with those over HTTPS/TLS, you need to have valid TLS certificates on the controllers, or add own snake oil, or internal, certificates to it. That's done with those "storage array commands"
- Once you're done with that, you can spend another 20 minutes getting lost in the documentation, or keep reading this post

Check [this](https://docs.netapp.com/us-en/e-series-cli/commands-category/array-configuration-commands.html#storage-array-commands) for storage array commands.

Oddly enough, the SMcli download instructions are tucked under [Array settings](https://docs.netapp.com/us-en/e-series-santricity/sm-settings/download-cli.html) in the *SANtricity* (not the SMcli) documentation. Awesome!

Another thing completely missing in the SMcli documentation is anything Linux-related, which is unbelievable. SMcli does work on Linux. I tested with Ubuntu 22.04 LTS, for example. No extra dependencies (some working JRE was already installed on Ubuntu) were needed.

Linux is what I used in the hope of avoding the `cmd` shell on Windows and whatever OS X has (I do have an OS X notebook, but I rarely use it).

First, I downloaded a controller's snake oil certificate chain using the browser. (Another option for this is to use a CLI command (such as `curl`), if you want to do everything from the CLI). You may want to download your snake oil certificate chain from both controllers if you have two as SMcli can switch to the other one if two are provided and one dies or gets disconnected.

We need to add these to Java trust store. For controller B I create a `c2` alias.

```sh
$ ./bin/SMcli trust localCertificate file ~/Downloads/10-1-1-1-chain.pem alias c2
SMcli completed successfully.
```

Widows shell:

```shell
.\SMcli.bat localCertificate trust alias c2 file "E:\c2_chain.pem"
```

On the EF arrays from this decade, you can download certificates directly from the controllers. Also in cmd.exe:

```shell
# At this time, EF300/EF600 only
.\SMcli.bat ipAddress1 ipAddress2 trust localCertificate
```

These two approaches are documented [here](https://docs.netapp.com/us-en/e-series-cli/commands-a-z/add-certificate-from-file.html#supported-arrays) and (newer EF-Series) [here](https://docs.netapp.com/us-en/e-series-cli/commands-a-z/add-certificate-from-array.html#supported-arrays).

Check (no need to provide array IP or host name or FQDN here, as this only checks Java trust store):

```sh
$ ./bin/SMcli localCertificate show all
Alias:       c2
Subject DN:  C=US,O=E-Series,CN=10.1.1.1
Issuer DN:   C=US,O=E-Series,CN=E-Series Root CA
Start:       2025-08-04 09:08
Expire:      2035-08-02 09:08
Thumbprint:  8ea3398c4b57f37a4db31485d6cdc6ae66d2b495
---------------------
SMcli completed successfully.
```

Now that this is okay, we can try some SMcli commands.

The documentation has some useful "tips" on how to dig that hole you're in even deeper. Stay away or double-check that it's not misleading or faulty.

![Issue-causing tip for how to avoid issues](/assets/images/smcli_03_doco_tips.png)

(Over the years I've submitted bugs about this multiple times, but it's still everywhere. I give up...)

Continuing with Bash on Ubuntu 22.04:

```sh
./bin/SMcli 10.1.1.1 -u "admin@local" -p "s3creTcR4p" -c "show allVolumes;"
```

That works.

Try with **PowerShell** 7.5 on Ubuntu 22.04 Linux:

```powershell
./bin/SMcli 10.1.1.1 -u "admin@local" -p "s3creTcR4p" -c "show allVolumes;"
```

It worked, completely unchanged!

Compare that with the [official guidance](https://docs.netapp.com/us-en/e-series-cli/get-started/formatting-cli-commands-in-windows-powershell.html) on how it's supposed to be done in PowerShell (on Windows) and consider which one is better.

```powershell
./SMcli.exe 123.45.67.88 123.45.67.89 `
  -c 'set storageArray userLabel=\"Engineering\";'
```

Or this gem (remember to use straight quotes): 

```powershell
-c 'enable storageArray feature file=\"C:\licenseKey.bin\";'
```

Oooof.

I haven't tried updating firmware with SMcli, but I'm pretty sure PowerShell on Windows WSL would let you avoid such monstrosities and let you use: `file ./fi.le`.

## What is SMcli good for?

It's good (the best!) for initial ("Day 0") box deployment tasks and servicing (firmware upgrades if have many arrays or can't access the UI and whatnot). If you must use SMcli on Windows, consider WSL rather than native Windows shells - based on my Linux experience, that way you may have a less miserable time.

If you're a regular and frequent Day 1+ user you'd probably be better off by building your own client. Use native PowerShell, for example, or add to [SANtricity client](/2025/12/29/santricity-client.html) of mine.

If you're a DevOps or ITOps type of user, you should probably consider the same. SMcli is the official, canonical client released with every SANtricity release and it's thoroughly QA'd. But its usability sucks. If you build modern workflows and have a sandbox where you can test own native API client (PowerShell, Python, or something else), I would recommend it over SMcli.

The best part - but not good enough - of SMcli is the documentation. That deserves its own section.

## SMcli and API documentation

Since SMcli is the only "official" SANtricity client and well-tested, what you see in the docs is stuff that is pretty much guaranteed to work. And if it doesn't, you can ask NetApp to fix it.

This may be the preferred way for "bureaucratic" organizations but, as I've said above, it'd take you less time and effort to maintain your own client library. 

The difficult part in building your own is the SANtricity API documentation. Because this "configware" (SMcli) is the main and only integration, the API isn't well documented so developing for it can be painful.

People say "it's easy, just use AI". But, for SANtricity, there's almost nothing an AI could learn from. I've done a fair amount of building API integrations for Python, so now AI can maybe help you with *some* stuff, but it's extremely limited as of early 2026. The only way to fix that is to build more.

In my opinion Python is the most important language for automation and there are good, working Python examples for Day 1 use that I've put out there. We don't need to use Python for NVSRAM updates or something that we rarely (or never, if the box is serviced by a 3rd party) do. What you need is:
- volumes
- hosts (and host-groups)
- mappings

That's it. The rest is "Day 0" and maintenance stuff. You can develop Python (or other) automation for that, too, but that is rarely needed (you may want it if you have 100 E-Series arrays, though).

Going back to API documentation: this is where you hit problems, as SANtricity [Swagger](/2024/04/26/swagger-files-netapp-eseries-arrays.html) is incomplete.

SMcli is Java based, so in theory it could be decompiled, but in practice it isn't allowed by the NetApp EULA that you have to agree with to download and use the SANtricity Web UI. Here's where:

```raw
LICENSE RESTRICTIONS. You must comply with the EULA terms at all times when using the Software and Documentation. You will not, nor will You allow anyone else to:

    use the Software in breach or excess of any limitations (e.g. the types, quantities, user limits, time limits, capacity limits) prescribed by NetApp and other usage attributes related to Your Software license;
    reverse-engineer, decompile or disassemble the Software or otherwise reduce it to human-readable format except to the extent required for interoperability purposes under applicable law or as expressly permitted in Open Source Software licenses;
    remove or conceal any Software identification, proprietary, intellectual property or other notices in the Software or Documentation;
    use the Software or Documentation to perform services for third parties in a service bureau, managed services, commercial hosting services or similar environment, unless otherwise agreed to in writing by NetApp;
    assign or otherwise transfer, in whole or in part, the Software or Documentation licenses to another party or Controller-based licenses to a different storage controller, unless otherwise agreed in writing by NetApp;
    install Controller-based licenses on or use them with third party hardware or any second-hand or grey market hardware not purchased by You from NetApp or a NetApp Partner;
    modify, adapt or create a derivative work of the Software or Documentation;
    publish or provide any Software benchmark or comparison test results; or
    use the Software for any benchmarking or competitive purposes or activities, including but not limited to, developing similar or competing products or services.

Use of the Software outside of the scope of the terms set forth in the EULA constitutes a material breach of this EULA.
```

Very helpful! 

Since the SANtricity Swagger exposes API that's equally accessible from SMcli, I don't expect this EULA to have an impact on anyone who uses SMcli to derive API request details for use with automation and interoperability (this is explicitly allowed), which is be the sole purpose in any case. But that risk is always there. 

You can "consult your lawyer" (and spend $500 finding an answer) or go back to trial and error with RESTful API. Awesome! (Also notice that Oracle-style anti-benchmarking clause - LOL.)

## Conclusion

SMcli is the only official client and technically the correct way to consume the SANtricity API. As such, it is indispensable for Day 0 and SANtricity maintenance tasks.

Windows users should give WSL with SMcli a try - it looks like it may result in a less miserable experience.

For everything else, you'll probably be better off by using SMcli for Day 0 and maintenance and a lightweight library or client for anything to do with volumes, hosts, and mappings. Maybe even for pools and disk groups, although E-Series users don't change these often so the value of automating them is smaller.

A lightweight Python client library and CLI are already available. More is on way.
