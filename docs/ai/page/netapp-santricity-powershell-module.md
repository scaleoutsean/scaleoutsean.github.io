# NetApp SANtricity PowerShell module for E-Series

Get and use PowerShell 5.1 module for NetApp SANtricity (E-series, EF-Series)

**UPDATE:** This outdated module for PowerShell 5.1 may not work with with SANtricity 11.90+. But there's a new community module that supports PowerShell 7, `santricity-powershell`. See [this post](/2026/01/25/eseries-santricity-ps-snapshots-clones.html), for exmaple.

- [Get NetApp.SANtricity module for PowerShell 5.1](#get-netappsantricity-module-for-powershell-51)
- [Install and load](#install-and-load)
- [Use](#use)
- [End](#end)
- [Appendix A - Known issues \& workarounds](#appendix-a---known-issues--workarounds)

## Get NetApp.SANtricity module for PowerShell 5.1

The problem is you can't. Or maybe you can, but it's not easy.

It appears it was deprecated some time ago and removed from NetApp downloads. 

I don't know if the file is available on the Internet, but you should be able to ask NetApp Support to share it with you. 

Here's the file and SHA256 hash of the installer I used[.](https://pub-b36e83914b354d7d9986e006905799c0.r2.dev/eseries-powershell-module-01.40.002.3000.zip)

```raw
Algorithm: SHA256
Hash: 69B1A05948A5D14880D1CC0546833CB9913D5B28D8F78DA2EAF0A0827B9C6AA3
Path: SANtricity_PowerShell_Module_01.40.0002.3000.exe  
```

The package is digitally signed by NetApp, by the way.

## Install and load

I think this old module can work only with PowerShell 5.1 (and not PS Core), but the good news is Microsoft keeps that version around so I was able to install it on Windows 11 without any workarounds.

By default, it is installed to `C:\Program Files\NetApp\Modules\NetApp.SANtricity.PowerShell\`.

Start PowerShell 5.1 and check your modules:

```powershell
PS C:\Users\sean> Get-Module

ModuleType Version    Name                                ExportedCommands                                                                                               
---------- -------    ----                                ----------------                                                                                               
Script     1.0.0.0    ISE                                 {Get-IseSnippet, Import-IseSnippet, New-IseSnippet}                                                            
Manifest   3.1.0.0    Microsoft.PowerShell.Management     {Add-Computer, Add-Content, Checkpoint-Computer, Clear-Content...}                                             
Manifest   3.0.0.0    Microsoft.PowerShell.Security       {ConvertFrom-SecureString, ConvertTo-SecureString, Get-Acl, Get-AuthenticodeSignature...}                      
Manifest   3.1.0.0    Microsoft.PowerShell.Utility        {Add-Member, Add-Type, Clear-Variable, Compare-Object...}                                                      
Manifest   3.0.0.0    Microsoft.WSMan.Management          {Connect-WSMan, Disable-WSManCredSSP, Disconnect-WSMan, Enable-WSManCredSSP...} 
```

That's fine, you can edit `$env:PSModulePath` and refer to it from scripts, or simply import on demand. 

Note that in this part below you need elevated privileges aka "Run as Administrator".

```powershell
PS C:\Windows\system32> Import-Module "C:\Program Files\NetApp\Modules\NetApp.SANtricity.PowerShell\NetApp.SANtricity.Functions.psm1"

PS C:\Windows\system32> Get-Module

ModuleType Version    Name                                ExportedCommands                                                                                               
---------- -------    ----                                ----------------                                                                                               
Script     1.0.0.0    ISE                                 {Get-IseSnippet, Import-IseSnippet, New-IseSnippet}                                                            
Manifest   3.1.0.0    Microsoft.PowerShell.Management     {Add-Computer, Add-Content, Checkpoint-Computer, Clear-Content...}                                             
Manifest   3.1.0.0    Microsoft.PowerShell.Utility        {Add-Member, Add-Type, Clear-Variable, Compare-Object...}                                                      
Script     0.0        NetApp.SANtricity.Functions         {Get-NeBuildinfo, Get-NeCommands, Get-NeEventLogDebug, Get-NeKeyValue...}                                      
Binary     1.1.0.0    PSScheduledJob                      {Add-JobTrigger, Disable-JobTrigger, Disable-ScheduledJob, Enable-JobTrigger...}  
```

NetApp.SANtricity.Functions and PSScheduledJob modules have been imported. (And yeah, that SANtricity module is not versioned.)

## Use

In the late 2010s I created two simple demos (you can find them on YouTube, try searching for SANtricity PowerShell).

Fortunately, there's been no updates since then, so those very already likely showcase the latest and greatest (what I'm using in this post). 

For that and other reasons I'll just show cmdlets available in the module:

```powershell
PS C:\Windows\system32> (Get-Module -Name NetApp.SANtricity.Functions).exportedCommands).Keys
Get-NeBuildinfo
Get-NeCommands
Get-NeEventLogDebug
Get-NeKeyValue
Get-NeModuleinfo
Get-NeProxyCredential
New-NeCredential
New-NeKeyValue
Send-NeAutoSupportData
Set-NeEventLogDebug
Start-NeAutoSupport
Get-NeAsyncMirrorGroups
Get-NeAsyncMirrorGroupStorageSystems
Get-NeAsyncMirrorIncompletePairs
Get-NeAsyncMirrorPairs
Get-NeAsyncMirrorPairsRepositoryUtilization
Get-NeAvailableMelEvents
Get-NeConcatRepositoryVolumes
Get-NeConsistencyGroup
Get-NeConsistencyGroupMember
Get-NeConsistencyGroupSnapshots
Get-NeConsistencyGroupViews
Get-NeConsistencyGroupViewVolumes
Get-NeDeviceAlertsConfig
Get-NeEthernetInterfaces
Get-NeFirmwareFiles
Get-NeFirmwareUpgrade
Get-NeRemoteMirrorSyncProgress
Get-NeRemoteMirrorVolumeCandidates
Get-NeSnapshot
Get-NeStorageSystemFromFolder
Get-NeSyslogConfig
Get-NeValidateConfig
Get-NeVolumeExpansion
Get-NeVolumeGroupExpansionCandidates
Get-NeVolumeGroupReductionCount
New-NeAsyncMirrorGroups
New-NeAsyncMirrorPairs
New-NeConsistencyGroup
New-NeConsistencyGroupMember
New-NeConsistencyGroupSnapshots
New-NeConsistencyGroupViews
New-NeConsistencyGroupViewsBatch
New-NeSnapshot
Remove-NeAsyncMirrorGroups
Remove-NeAsyncMirrorIncompletePairs
Remove-NeAsyncMirrorPairs
Remove-NeConsistencyGroup
Remove-NeConsistencyGroupMember
Remove-NeConsistencyGroupSnapshots
Remove-NeConsistencyGroupViews
Remove-NeSnapshot
Set-NeResumeAsyncMirrorGroup
Set-NeResumeFlashCache
Set-NeSuspendAsyncMirrorPair
Set-NeSuspendFlashCache
Set-NeSyncAsyncMirrorPair
Test-NeSendTestEmail
Test-NeSendTestSyslogMessages
Test-NeTestAsyncMirrorConnectivity
Test-NeTestRemoteMirrorCommunication
Update-NeActivateFirmwareUpgrade
Update-NeAddDrivesToFlashCache
Update-NeAsyncMirrorGroups
Update-NeAsyncMirrorIncompletePairs
Update-NeConcatRepositoriesFromMutipleVolumes
Update-NeConcatRepositoriesFromSingleVolume
Update-NeConfigureFalshCache
Update-NeConsistencyGroup
Update-NeConsistencyGroupMember
Update-NeConsistencyGroupMemberBatch
Update-NeConvertToReadWriteSnapshotVolume
Update-NeDeviceAlertsConfig
Update-NeDownloadFirmwareUpgrade
Update-NeEthernetInterfaces
Update-NeExpandConcatRepositoryVolume
Update-NeFirmwareUpgrade
Update-NeInitializeThinVolume
Update-NeInitializeVolume
Update-NeMoveHost
Update-NeMoveVolumeMappings
Update-NeReloadFirmwareUpgrade
Update-NeRemoveDrivesFromFlashCache
Update-NeRollbackCgSnapshot
Update-NeSyslogConfig
Update-NeThinVolumeExpansion
Update-NeValidateConfig
Update-NeVolumeExpansion
Update-NeVolumeGroupExpansion
```

Connect directly (better) or through SANtricity Web Services Proxy (okay, but I don't like it).

If you decide to use the WSP you need to add the array to it.

```powershell
# $ManagementIpAddresses is a list (one for each controller)
# URL would be the URL to your WSP API endpoint
$ManagementIpAddress = "1.2.3.4", "5.6.7.8"
$Url = https://woo.hoo:8082
# it appears this assumes both WSP and controller have the same $cred
#    - use $cred1 and $cred2 if that's not the case
$cred = Get-NeProxyCredential -Url $Url -ProxyUser $user -ProxyPwd $pwd
$(New-NeStorageSystem -Cred $cred -ControllerAddresses $ManagementIpAddresses) | Out-Null
Start-sleep 5  # let the proxy connect to back-end array
# ip1 would be the first controller in the WSP response
ss = Get-NeStorageSystem -Credential $cred |? { $_.ip1 -eq $ManagementIpAddresses[0] }

# $ss will have the name and ID of the added array: $ss.Name and $ss.Id

```

After that you'd connect *through* the proxy.

Users who *do not use* the WSP would go directly to (one of) the controllers. In that case you'd skip the step of adding the array, you'd instead just connect. 

Here's [one of the old YouTube videos](https://www.youtube.com/watch?v=7JmfXDZS6nI) that show a demo of that.

As I recall from using the API directly, Bearer Token has to be reissued - it may not be synced across the controllers, so keep that in mind.

## End

On the laptop where I can connect to E-Series, I couldn't even import the modules because of "security". 

The installation and module loading steps were confirmed to work on a Windows outside my restricted environment, but I don't have E-Series there so I couldn't actually try using the module this time.

In the recent years I've been using the SANtricity API directly, which is why I lost track of this module. 

Using the API is not that hard, but for me the added convenience is a big plus as I can run my E-Series/SANtricity scripts using any PowerShell version, and on both Linux and Windows. Compared to SolidFire - which has an amazing PowerShell module - SANtricity functions aren't super easy to use, so I would encourage you to use the API directly unless you have old scripts which work well for you.

## Appendix A - Known issues & workarounds 

I found these in a SANtricty document from 2018... Don't know if these have been fixed in subsequent releases, but maybe this will save you time so...

- Get-NeAuditLog cmdlet - Fails with a return response of “Value cannot be null” referencing a parameter named disposition. Workaround: Use the SANtricity Web Services API endpoint (and GET /storage-system/{system-id}/audit-log) instead of Get-NeAuditLog
- Get-NeLocalUsersInfo cmdlet - The returned value for minimumPasswordLength field is null. Future new releases of the SANtricity OS will return a valid value for the field. Workaround: Upgrade to the next release of SANtricity OS when available.
- Update-NeExternalKeyServerCertificateCsr cmdlet- An exception will be thrown only if required parameters are used for the cmdlet, no optional parameters. Workaround: Use the cmdlet with all required and optional parameters.
- Get-NeLdapRoles cmdlet - Typo in the synopsis statement on the get-help output for the cmdlet.
- Update-NeSslconfigReset cmdlet - Typo in the synopsis statement on the get-help output for the cmdlet.
