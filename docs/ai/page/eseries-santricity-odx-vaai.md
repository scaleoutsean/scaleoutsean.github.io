# Windows ODX with E-Series SANtricity

Verify ODX setting on NetApp E-Series arrays

## Introduction

Windows Offloaded Data Transfer (ODX) is a Windows host equivalent of VMware's VAAI.

You actually don't have to do anything in order to be able to use it with E-Series arrays because it's enabled by default. But if it doesn't work, you may want to ensure that it's enabled.

## How to check ODX status on SANtricity arrays

SANtricity supports both ODX and VAAI and they're both by default enabled.

The setting is hidden in the SYMbolV2 API, and I don't think it's exposed in the SANtricity Web UI, so it takes some skillz to disable it.

Check the status with [SMcli](/2026/01/05/eseries-santricity-smcli-client.html):

```shell
$ ./SMcli 10.1.1.1 -u "admin@local" -p "s3cr3t" -c "show storageArray odxsetting;"
Performing syntax check...

Syntax check complete.

Executing script...

  Windows ODX Setting  Status
  ODX Enabled          True
  VAAI Enabled         True

Script execution complete.

SMcli completed successfully.
```

We're good. As you can see in the linked SMcli post, I'm not a fan. Let's use the API instead.

We need to query `odx` (or `vaai`) like so:

```json
{
    "functionAction": "getValue",
    "functionID": "odx"
}
```

This `curl` example shows the path is `setFunctionState` (`POST /symbol/setFunctionState`) although we're really doing a `GET` on a state. Oh, well... At least now you don't need to search through the 100+ functions to get to this point.

```sh
curl -X POST "https://10.1.1.1:8443/devmgr/v2/storage-systems/1/symbol/setFunctionState?controller=auto&verboseErrorResponse=true" -H  "accept: application/json" -H  "Content-Type: application/json" -d "{  \"functionAction\": \"getValue\",  \"functionID\": \"odx\"}"
```

Response:

```json
{
  "returnCode": "ok",
  "functionState": "enabled"
}
```

## ODX data movement

ODX can move Hyper-V volumes ("LUNs") between SANtricity disk groups. 

From one DDP pool to another, or from RAID 1 to RAID 5 should both work. 

I'm still skeptical whether that works between 4,096 and 512 disks - I wouldn't be surprised if that was a limitation.

## Notes

I tried something weird - SCSI pass-through of iSER LUNs to Windows Server 2025 in KVM - and ODX did not work. But, to put it mildly, that's not the ideal use case for ODX.

I had hoped it might work because it's iSER-SCSI-to-passthrough-SCSI, but maybe the IB transport or something else messes it up. So, don't try that and expect ODX to work out of box.

With proper SCSI (not NVMe!) access, whether it's iSCSI or FC, it should just work.

## Conclusion

ODX isn't just a Hyper-V feature. It works for general data movement (with some minor exceptions documented in the Windows documentation).

Right now I don't have an environment to try cross-pool offload (or even cross-LUN offload), but at least in-pool (cross-LUN) should work and I will continue with that assumption (meaning, until I know otherwise, DDP pools should a safer choice than a disk groups, although cross-pool movement might work as well).

As [`santricity-powershell`](/2026/01/06/eseries-santricity-powershell.html) has been released, I've been contemplating use cases for Windows and wondering if we needed a cmdlet to enable ODX or check its status.

As it turns out, we don't. We should expect it's enabled (because it's not very easy to disable it) and functional and if it's not, now you know how to check. It's a one-off thing, so I'm not going to add it to `santricity-powershell`.

I'll instead look into adding several non-`Get` cmdlets for other SANtricity objects (such as volumes). Hyper-V users should then find it convenient to quickly (re)configure their Hyper-V clusters to use E-Series.
