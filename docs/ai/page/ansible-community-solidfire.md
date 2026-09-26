# Ansible community collection for NetApp SolidFire

NetApp SolidFire collection for Ansible is better than ever

## Introduction

I'm not a big fan of Ansible, so I rarely blog about it. Recently, however, while building a better mouse trap I decided to check the SSolidFire collection.

Lo and behold - the damn thing was shelved in 2023! See [here](https://github.com/ansible-collections/netapp.elementsw). Archive mode, baby!

## Collection `community.solidfire`

Yes, it's available. 

A working fork can be found [here](https://github.com/scaleoutsean/netapp.solidfire).

### What's in `community.solidfire`

The same stuff that was there before, plus some other:

- In addition to the crippled backup module that couldn't backup to S3 (the most demanded type of backup on SolidFire) was added. If call is successful, it returns an async job handle, bulk volume read job ID, and MIP URL of the SolidFire node running the job, making it possible to pipe the output to pollers and with that information create parallel backup jobs, retry, report and more
- Volume deletion now can optionally retain the volume in garbage bin as SolidFire API and UI users expect
- The crippled snapshot module was improved by another, group snapshot, module
- Cluster information also lists iSCSI initiators

The collection passes Ansible Core 2.20.1 sanity tests.

## Conclusion

It took me just 2-3 days to make this abandoned project viable, update it to work with the latest and greatest Ansible and implement requests for enhancements created years ago. Must have been such burden to maintain it!

It has become harder for me to test such projects as I no longer have access to physical SolidFire hardware. Because of that I don't plan to submit this for inclusion in Ansible Community collections. The SolidFire demo VM is still extremely useful for development and testing. If anyone discovers any issues, I can try to fix them.

I'm considering using Ansible in a SolidFire-related hobby project, so I'm happy that I managed to make this collection usable again. If I get to use it, I may still add some new features to it. If you want to have something added, submit a pull or enhancement request.
