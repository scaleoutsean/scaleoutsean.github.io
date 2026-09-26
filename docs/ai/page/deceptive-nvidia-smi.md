# Deceptive nvidia-smi output

Is your GPU utilized 39%? Probably not.

I'm curious if I should buy a more expensive GPU so I use nvidia-smi to see how busy the current one is.

```sh
$ sudo nvidia-smi
Wed Dec  6 13:09:01 2023       
+---------------------------------------------------------------------------------------+
| NVIDIA-SMI 545.23.08              Driver Version: 545.23.08    CUDA Version: 12.3     |
|-----------------------------------------+----------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |         Memory-Usage | GPU-Util  Compute M. |
|                                         |                      |               MIG M. |
|=========================================+======================+======================|
|   0  NVIDIA GeForce RTX 2080 ...    On  | 00000000:2B:00.0  On |                  N/A |
|  0%   46C    P8              16W / 250W |   1136MiB /  8192MiB |     39%      Default |
|                                         |                      |                  N/A |
+-----------------------------------------+----------------------+----------------------+
```

Whoa, 39%!

BUY, BUY, BUY!

What's in fact happening the GPU is so damn idle that GPU clocked down to a fraction of the maximum clock speeds.

GPU memory clock and processor clocks are each around 400 MHz, compared to the maximum values of 7750 and 1650 MHz, respectively.

```sh
$ sudo nvidia-smi dmon
# gpu    pwr  gtemp  mtemp     sm    mem    enc    dec    jpg    ofa   mclk   pclk 
# Idx      W      C      C      %      %      %      %      %      %    MHz    MHz 
    0     15     44      -     12      9      0      0      0      0    405    375 
    0     15     44      -     25     17      0      0      0      0    405    375 
```

So my 39% is really just a small fraction of maximum GPU performance I can get from this hardware.
