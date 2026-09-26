# santricity-powershell for Day 1+ E-Series automation

Automate Day 1 operations on E-Series SANtricity using PowerShell

## Introduction

[Reautomating E-Series](/2025/12/22/reautomating-eseries.html) has more about SANtricity automations and integrations in recent years. As you can see there, SANtricity used to have a thick PowerShell [module](/2024/03/28/netapp-santricity-powershell-module.html) and it was closed source (a mistake), so once they stopped maintaining it it was "game over, man, game over" for anyone who used it.

Last week I released a [lightweight library and CLI for Day 1+ SANtricity management with Python](/2025/12/29/santricity-client.html) and since back-end API would be the same for PowerShell it wasn't hard to think of the next logical step. 

[santricity-powershell](https://github.com/scaleoutsean/santricity-powershell) has been pushed to Github moments ago.

It may be buggy. Why release, then? Well, unlike with the Python library/CLI, I've been having problems with PowerShell (can't install "unapproved" PowerShell modules on Windows) and I've been having problems with PowerShell bugs on Linux, so I won't be able to test it for a couple of days (until I download and deploy a Windows VM). 

## About `santricity-powershell`

- Permissive Open Source. You won't get stuck again. No need to release your modifications or improvements. No need to tell me you're using. Or to login anywhere to download it
- Lightweight, like `santricity-client`. And it aims to do the same thing - suffice for Day 1+ operations on volumes, hosts, volume-to-host mappings
- Basic and JWT (token) authentication
- Easy to integrate in your workflows. Just `Import-Module santricity`.
- Less [nasty wrapping and escaping](/2026/01/05/eseries-santricity-smcli-client.html#conclusion) for Windows users (assuming this thing lets you do 80% of Day 1+)
- It's supposed to look nice and work on Windows, Linux (as all my PowerShell 7 stuff does) and OS X

Feedback (Github issues) and pull requests are welcome as long as it doesn't add bloat that can't be justified by the focus of this project (lightweight, Day 1+, integrations).

Some things I may add later:
- `storage-pools` handling. It hasn't been added yet because I don't think SANtricity users often mess around with pools on Day 1+. Also automating pools can be a bit complex and sensitive
- Capacity reporting. Not complex, but also perhaps not relevant for this project. On the other hand, releasing a tiny project just for that, or putting a script out there, is just as annoying. Anyway, that's not off the table, but I'll need to think about it. For now the priority is to make sure the damn thing works (as mentioned above, I've been having "infrastructure issues" and so far know that it can connect to SANtricity controllers and client code *seems* correct)

For the most part, this is the same thing as `santricity-client` but in PowerShell rather than Python. What *is* different is that PowerShell excels at [pipelines](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipelines?view=powershell-7.5).

For example, imagine if you could use PowerShell to install iSCSI initiator on a host, pipe created object to `santricity-powershell`, create host configuration, create some LUNs and present it to the host? Wait, we don't have to imagine - that's how it's supposed to be done! 

Does that mean we could easily build deployment scripts for Hyper-V with SANtricity iSCSI? Abso-frikkin-lutely!

## Conclusion

Reautomating E-Series has been progressing well. The module will be properly tested in a week or two.

PowerShell, and especialy Windows, users now have a way to get more out of their E-Series investment.

Integrators can take and improve the code for their needs and build SANtricity solutions faster and cheaper.
