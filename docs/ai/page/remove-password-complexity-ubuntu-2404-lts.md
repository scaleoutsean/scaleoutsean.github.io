# Remove password complexity requirements on Ubuntu 24.04 LTS

Stop telling me what to do, Ubuntu!

- [Busybodies@work](#busybodieswork)
- [I want 123456](#i-want-123456)
- [Ending](#ending)
- [Appendix A: recommended low-quality password settings for pwquality.conf](#appendix-a-recommended-low-quality-password-settings-for-pwqualityconf)

## Busybodies@work

Because of a bug in 24.04 LTS (Noble) I couldn't enter some characters such as `:` in X-Windows, so I wanted to change my password to something simple.

But Ubuntu wouldn't let me set a simple password. Thanks for nothing, Ubuntu!

## I want 123456

Apparently `libpam-pwquality` ensures password "quality" on Ubuntu 24.04 LTS. 

Well, let's uninstall it and see what happens, shall we?

**NOTE:** do NOT do this on a system that you *must* be able to use again!

```sh
sudo apt-get purge libpam-pwquality -y
```

This uninstalls a whole bunch of seemingly **important** packages, ranging from SSH- to NSS-related.

As I was doing that on my test VM, I thought that was guaranteed to deny access *at least* for SSH if not for remote (VMware ESXi) console access as well the next time I reboot the OS.

## Ending

I changed my password to a sequence of six digits - no annoying prompts to use something more complex - and rebooted.

To my surprise, I still able to login over SSH using my top-secret 6-digit password. Sudo-ing inside of console works fine as well.

So far, so good!

If you use NSS, SSO and similar, you may end up completely cut off so I'd first try on a fresh VM (with a storage snapshot) and only then use it on other lab VMs without any complex authentication or account requirements. 

By the way, that package lets administrator relax password "quality" settings in `/etc/security/pwquality.conf`, but why would I want do that? 

In production, I don't even use passwords. In my lab a single `apt` command does the job. 

If you can't afford to get locked out, use the proper approach below or RTFM. 

## Appendix A: recommended low-quality password settings for pwquality.conf

Overwriting the contents of /etc/security/pwquality.conf with these 3 lines should achieve the same.

I haven't tried it, but this should allow you to use a low-quality password such as `123456` and keep the busybodies out of your way:

```raw
difok = 0
minlen = 6
dictcheck = 0
```
