# Visualize E-Series temperature and power consumption metrics with EPA

Monitor temperature sensors and power consumption on NetApp E-Series with EPA

EPA v3.3.0 will be the next release of EPA and I'm aiming for two small improvements:

- Environmental sensor monitoring
- Power consumption monitoring 

The first is most likely going to be temperature sensors. I'm still trying to figure out what they mean.

The second is total power consumption of the array. There are per-PSU stats, but I'm going to play safe and just sample the total figure.

As with SSD wear level metrics, I'm not going to bother with Grafana. If you need it, add a new dashboard and a few panels to visualize that data.

![Visualize sensors and power consumption](/assets/images/epa-monitor-eseries-temperature-sensors-power-consumption.png)

There's at least 6 sensors on the EF570 I used.

I don't create new EPA panels - those who need it can easily create these on their own - so above is just an example that doesn't attempt to figure out what each sensor does.

But the SANtricity Web interface gives us some hints.

![Temperature sensors in the SANtricity Web UI](/assets/images/epa-monitor-eseries-web-ui-temperature-sensors.png)

Here's what these mean (I found this only later) on a two-controller system

- Sensors 1 & 3 are the CPU temperatures (60C or so, in this example)
- 2 & 4 are the inlet temperatures, and 128 isn't 128C but represents "normal", whereas non-128 is ab-normal. We should probably display this indicator separately, or use green for 128 and red for non-128
- 5 & 6 in green below are the PSU sensors (which normally run slightly above room temperature, and clock close to 30C here)

The second chart is simple and shows the total power consumption (W) of the storage array. There are more detailed (per-PSU) metrics, but I can't see much value in them so I won't try to capture per-PSU metrics and unnecessarily bloat the database.
