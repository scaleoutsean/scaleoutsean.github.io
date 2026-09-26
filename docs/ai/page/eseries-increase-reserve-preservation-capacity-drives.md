# Change E-Series DDP preservation capacity on-the-fly

Change E-Series DDP preservation capacity on-the-fly

## Requirement

Some users want to start small and flexibly add disks in small increments (1, 2, 3) later.

For various reasons, DDP is a good match for that. The most obvious argument against using classic RAID is one isn’t supposed to create weird RAID 5 or 6 widths - it results in unpredictable (usually on the negative side) performance and the larger a RAID 5 or 6 group, the slower it rebuilds.

You can search this blog or the NetApp Web site for more on DDP vs. RAID 6.

There are two related questions (and answers):

- Can DDP be expanded in small increments without negative consequences - yes 
- Can DDP “protection” capacity be increased as the pool grows to 60 or 120 or more drives - yes 

## Solution

I wrote about DDP expansion before so I’ll focus on the second question first.

You may start with 20 drives and allocate 2 (common best practice for DDP for up to 2-3 dozen disks) for protection (the so-called DDP preservation capacity). But once you get to 60 drives, you may want to have three drives worth of spare capacity.

DDP preservation capacity is a disk pool setting that’s available here:

- In SANtricity System Manager, go to * Storage* > *Pools and Volumes*  and select your DDP 
- Click on *View/Edit Settings*  
- Go to the modal’s second tab, *Pool Settings* and scroll all the way down 
 
![DDP Pool Settings](/assets/images/eseries-ddp-change-number-of-reserved-drives-00.png)

- At the very bottom you’ll be offered to * update*  (yes!!!) the pool’s preservation capacity. 
 
![DDP Preservation Capacity](/assets/images/eseries-ddp-change-number-of-reserved-drives-01.png)

- Change it (e.g. from 3 to 4) and hit *Save*  

Now the pool should have a slightly reduced capacity (by 1 disk) as 1 disk worth of capacity was assigned to preservation.

The “Why can’t I increase” question is concerning, so let’s check that link. What TFM [says](https://docs.netapp.com/us-en/e-series-santricity/sm-storage/why-cant-i-increase-my-preservation-capacity.html) is:

> If you have created volumes on all available usable capacity, you cannot increase preservation capacity without adding capacity to the pool by either adding drives or deleting volumes.

All right, no big deal - if you’re on 3 and you’ve used up all space for data, you won’t be able to increase that to 4 until you add another disk to the pool. Makes sense.

I was able to both shrink (go from 4 to 3) and grow (from 3 to 4) DDP preservation setting.

(FYI, this particular screenshot was taken on E-Series simulator v11.73, something that’s handy for quick checks of how SANtricity Web UI works. E-Series Simulator is available to NetApp employees and partners.)

## Demo

I put one of these experiments in a short [demo video](https://rumble.com/v3415px-expand-e-series-ddp-pool-and-grow-and-shrink-its-preservation-capacity.html) (2m6s).

It’s annotated and easy to understand, so you can mute it if you don’t like the voiceover.

## Conclusion

By default, DDP has performance characteristics similar to RAID 6. It requires 11 disks to start, but then you can:

- [Grow DDP](/2021/07/06/e-series-ddp-expansion-and-rebalancing.html) in increments between 1 and many disks
- Start with a small DDP preservation setting (e.g. 2 out of 11 at first) and grow it to 3 or 4 as your DDP hits 30 or 60 or 100 drives 

## Appendix

For a closer look at the expansion and changes, here are some additional screenshots:

Create a new DDP from 20 “7.68” TB drives.

![Create new DDP from 20 drives](/assets/images/eseries-ddp-change-number-of-reserved-drives-02-new-20-drive-dpp.png)

Let’s examine the DDP's properties: these particular drives are 7,319.85 GiB large and the total usable DDP capacity is 104,312 GiB (see the details on capacity calculation in the Appendix at the bottom.)

![DDP properties](/assets/images/eseries-ddp-change-number-of-reserved-drives-03-new-20-drive-dpp-settings.png)

Now let’s add 10 more drives, naively thinking that should increase the capacity by 50% (it won’t exactly).

- Interestingly, the size of these drives - due to them being made by a different manufacturer, for example - are 7,324.85 GiB, so when confirming our action we get a warning that only 7319.85 (5 GiB less) will be used as that’s the size of the smallest drive in the original 20 disk group used in this pool 
- 10 drives amount to 73,248.51 GiB, but as we just saw, this will add 73,198 GiB due to the new disk not having identical capacity which will cause a small "loss" in the process

![Expand DDP with 10 similar drives](/assets/images/eseries-ddp-change-number-of-reserved-drives-04-add-10-drives-to-20-drive-ddp.png)

Now our DDP has 162,264 GiB, which despite the loss of 50 GiB, is 55% more, although the number of disks went from 20 to 30. Why? 

Because the overhead i.e. the number of preservation capacity was 2 (disks worth of capacity) and it’s still 2, which is now smaller percentage-wise (2 over 30 vs. 2 over 20 before).

Originally 18 disks worth of capacity were usable in a 20 large pool. We’ve added 10 so it’s 28 now.

![30/2 DDP](/assets/images/eseries-ddp-change-number-of-reserved-drives-05-30-drives-2-preservation-cap.png)

Let’s change the DDP's preservation capacity from 2 to 4 drives worth of capacity: you’d think this would drop usable by 2 x 7,319.85 GiB, but it doesn’t. It drops only 11,574 GiB (as if disks are 5,787 GiB!).

![Change DDP preservation from 2 to 4](/assets/images/eseries-ddp-change-number-of-reserved-drives-06-30-drives-4-preservation-cap.png)

(N.B. The notes in these two screenshots are mine, so that I can tell which is which without looking at the file name!)

Because we have no volumes, nothing is used, so preservation setting can be manipulated both ways, up and down. Let’s shrink it from 4 to 3. Perhaps unexpectedly, usable capacity grows by only 5,792 GiB.

![Change DDP preservation from 4 to 3](/assets/images/eseries-ddp-change-number-of-reserved-drives-07-30-drives-3-preservation-cap.png)

The main reason is RAID 6-like protection comes * after*  preservation capacity is deducted.

### Usable capacity calculation in DDP

If you’re trying to make precise sense of the figures, let’s do a simple (the exact calculation is slightly different) calculation for 30-large DDP with 3 drives worth of preservation capacity:

- 30/3 means 3 drives need to be deducted immediately 
- The remainder (27) are protected in a RAID 6-like fashion, so 8+2, i.e. deduct 20% 
- DDP uses no hot spares 

Capacity-wise:

- (30-3) x 7,319.85 x 0.8 = 158,108.76 GiB 
- SANtricity shows (last screenshot, just above) 156,472.00 GiB, which is pretty close 
- The exact calculation method for DDP capacity can be found in the DDP Technical Report which I’ve linked to several times - please read other DDP posts or use a search engine
