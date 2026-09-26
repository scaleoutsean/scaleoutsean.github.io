# PowerShell password change for local E-Series SANtricity OS users

Change E-Series password with PowerShell script that utilizes the SANtricity API

Long story short, password rotation scripts should directly use the SANtricity (or Web Services Proxy, if you can't get directly to SANtricity) API and not the CLI.

My script can pick either controller and optionally validate the new password. Here I use the admin credentials to set a new password for the monitor user, and then I validate it. (Since this screenshot SysId validation was changed to use WWN.)

![epasschange with validation on](/assets/images/eseries-password-change-powershell.png)

It takes around 0.8s to complete password change this way.

It's not intended for automated change of the admin account password because if things go wrong you may lock yourself out. But I tried and it worked.

![change-password round-tripping admin account](/assets/images/eseries-password-change-admin-verify.png)

The first run sets the admin account's password to `monitor123`, and because validation is enabled, it tries to login using the new password - OK!

The second run sets the password back to what it was, also OK.

The optional transcript switch (example output below) leaves basic information behind each run.

```raw
**********************
PowerShell transcript start
Start time: 20221221044059
Username: ih07\sean
RunAs User: ih07\sean
Configuration Name: 
Machine: ih07 (Unix 5.14.0.162)
Host Application: /opt/microsoft/powershell/7/pwsh.dll
Process ID: 72991
PSVersion: 7.3.1
PSEdition: Core
GitCommitId: 7.3.1
OS: Linux 5.14.0-162.6.1.el9_1.0.1.x86_64 #1 SMP PREEMPT_DYNAMIC Mon Nov 28 18:44:09 UTC 2022
Platform: Unix
PSCompatibleVersions: 1.0, 2.0, 3.0, 4.0, 5.0, 5.1.10032.0, 6.0.0, 6.1.0, 6.2.0, 7.0.0, 7.1.0, 7.2.0, 7.3.1
PSRemotingProtocolVersion: 2.3
SerializationVersion: 1.1.0.1
WSManStackVersion: 3.0
**********************
Transcript started, output file is /home/sean/epass/change-password.log
Success!
```

## Is it safe and reliable?

I think it's safer than the average CLI script that does the same thing. 

If the controller fails between the time the new password is set and the time it's validated (which is a time span of about 100ms, I think), validation would fail despite the password change succeeding. But then you don't have to validate and then it's "if it works, it works". Still better than the average CLI script.

I ran it 1000 times, 500 times with and 500 times without validation. It took around 13 minutes and 100% of runs succeeded. This doesn't mean it is fail proof, of course.

Other than that, I haven't tested it a lot and I'd suggest to use it for non-admin accounts. My use case is to change the monitor account password, the account/role I use in Collector container from my E-Series Performance Analyzer fork.

If you run it attended (as opposed to un-attended), it's fine to use it for any account. When you change the admin account password have that NetApp KB on how to reset the admin password handy because if admin is locked out you can't just log in to change it back.

## Summary

If you think Ansible can save you time or something like that, use Ansible modules for E-Series to accomplish the same. I couldn't figure out how to use Ansible with E-Series so I gave up.

An alternative approach is to use PowerShell (or Python) to avoid Ansible. A downside is you must have your own script.

I think PowerShell is easier, faster and better, but Ansible module for E-Series password change *may be* (who knows if it is) more reliable. At the same time I also think Ansible itself is more likely to break than PowerShell 7.

The script was posted to my eseries repository on GitHub.
