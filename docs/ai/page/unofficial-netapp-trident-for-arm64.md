# NetApp Trident v22.07.0 for ARM64

Easy way to get Trident working on ARM64

I had thought the posts I wrote about Trident on ARM64 were enough to get almost everyone going, but it seems it's not hard to get stuck.

So I've spent a few more hours to:

- Fork NetApp Trident v22.07.0
- Build Trident v22.07.0 for ARM64 
- Post the updated container to Docker Hub
- Create sample deployment files (find them [here](https://github.com/scaleoutsean/trident/tree/v22.07.0-arm64/setup))

Now it shouldn't take more than these steps to install Trident on ARM64 system with a working `kubectl`:

```sh
git clone https://github.com/scaleoutsean/trident -b v22.07.0-arm64
cd trident
wget https://github.com/scaleoutsean/trident/releases/download/v22.07.0-arm64/tridentctl
chmod +x tridentctl
kubectl create namespace trident
sudo ./tridentctl install --use-custom-yaml -n trident
```

This last command should use custom deployment files prepared in the setup directory, which defaults to my Docker Hub container images. 

Folks who want to build from the source can do that with just 2 commands. Check the README on Github or Docker Hub notes.

I hope this gives enough how-to guidance to everyone, so that I don't need to update and maintain this fork. 

*Remember* that v22.07.0 isn't supported on Kubernetes >= v1.24! 

If you're using Kubernetes v1.24 or 1.25 on ARM64, it's better to build Trident from latest source code until v22.10 comes out - you'd still have an unsupported version (in between v22.07 and v22.10) but at least it should behave better. I've built experimental Trident (ARM64) container based on Trident commits as of Sep 25, 2022, and until Trident v22.10 comes out you may install that one by using custom YAML deployment files from the directory `setup-experimental` in my Trident repo.

Where's what:
- Github repo: [https://github.com/scaleoutsean/trident](https://github.com/scaleoutsean/trident)
- Docker Hub: [https://hub.docker.com/r/scaleoutsean/trident-arm64](https://hub.docker.com/r/scaleoutsean/trident-arm64)
