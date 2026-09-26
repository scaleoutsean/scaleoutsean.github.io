# SSD disk wear indicator in E-Series SANtricity 11.70

Find wear level of SSD media in your E-Series array

E-Series SANtricity 11.70 shows wear level for SSD/NVMe disks.

![SSD wear level percentage indicator in SANtricity](/assets/images/eseries-ssd-wear.png)

To view it, simply navigate to view physical disk properties.

The indicator shows wear level as amount of performed writes performed so far divided by total supported amount writes for this disk over its lifetime.

Two percent means the disk can take 50x more writes before its considered worn out. 

I've never seen a disk with wear level above 10% (or below "90% remaining", on SolidFire arrays.)
