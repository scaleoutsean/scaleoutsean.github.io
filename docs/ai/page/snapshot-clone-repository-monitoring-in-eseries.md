# Monitor snapshot and clone repositories of NetApp E-Series SANtricity OS

Thoughts on monitoring repos used by SANtricity snapshots and clones

- [Problem statement](#problem-statement)
- [Considerations](#considerations)
- [First iteration](#first-iteration)
- [Second iteration](#second-iteration)
- [Conclusion](#conclusion)

## Problem statement

SANtricity has supported snapshots and clones forever, but monitoring them can be a challenge. 

That is obvious if you look at the SANtricity Web UI: related information may be confusing but if you think of how it could be improved, you probably won't have many ideas.

That's because it really is more complicated than on latest "virtualized" arrays. You can see this [post](/2023/10/05/snapshots-and-consistency-groups-with-netapp-e-series.html) for more on how E-Series snapshots and clones work. It's complicated (at least if you compare it with SolidFire).

Anyway, that's as far as the Web UI goes. What if we monitor these things externally?

## Considerations

First, what is it that needs to be monitored?

Well, various things. Let's see a random wish list:

- Total capacity utilization by snapshots and clones
- Total number of snapshots and clones
- Snapshots or clones hitting their capacity limit
- Volumes on which snapshots are about to hit their maximum number limit
- Snapshots or clones which have one of their repositories hitting its capacity limit
- etc.

SANtricity already does most of these things, both monitoring and alerting.

It would be effective and efficient if we could reuse those metrics and alert settings and eliminate duplication of effort with possibly different settings in each place.

Recently I worked on [monitoring E-Series with PRTG](/2023/09/25/monitoring-netapp-eseries-with-prtg.html) and one such monitor ("sensor", as PRTG calls them) was added. 

That monitor is SNMP Trap Receiver, and it lets PRTG receive alerts from SANtricity via SNMP v2 or v3 (I used v2).

Many other monitoring applications can receive SNMP traps or syslog, of course.

Second, could a monitoring application do something better? 

Unfortunately, it cannot. There's no simple recipe for solving an alert related to SANtricity snapshots and clone.

The storage admin simply must visit SANtricity Web UI and decide what to do.

Because of that, there isn't much that we should do in PRTG or other monitoring solution.

It would contain duplicate, and possibly incorrectly at that, information with no advantage over SANtricity Web UI: the end result is a storage admin must use the SANtricity UI.

## First iteration 

At first, I gathered various indicators from the API and created some derived metrics such as "GiB available", "% full" and such.

In any case, the SANtricity API isn't that easy to understand, so it took me a long time and although I had 10 metrics related to snapshots, clones and repositories, they weren't that useful. 

My fanciest metric was a monitor of "% full" for a special type of scheduled snapshot where the snapshot was configured to "Reject writes to base volume" when snapshot reserve gets full. If we need any kind of a snapshot-related alert, you want it for this situation where IO to base volume would simply stop! (That would be very useful for snapshots configured to avoid rotation by ransomware.)

But even for that useful indicator, I could configure SANtricity to send email and/or SNMP alerts from SANtricity, so why bother? 

![](/assets/images/eseries-prtg-repo-sensor-05-santricity-alert.png)

Another problem was that some of my API-derived metrics may have been correctly obtained, but incorrectly interpreted. Or at least it seemed that way: some indicators had different values from the SANtricity Web interface. Ouch!

It's not even that they were wrong - maybe they weren't - but the issue is the moment your values *seem* different from what you see in the official Web UI, it's game over.

## Second iteration 

I decided to change the approach and come up with a Plan B:

- Use SANtricity Web UI for detailed monitoring of snapshots and clones, as well as for alerting
- Receive alert in PRTG with SNMP Trap Receiver
- Use PRTG for cost-focused monitoring of snapshots and clones

What do I mean by "cost-focused"? I mean "watch how much snapshots and clones cost you".

If you pay $X per GIB usable, it's easy to understand how much snapshots and clones cost you.

![](/assets/images/eseries-prtg-repo-sensor-01-prtg-view.png)

There's just two indicators, one is the size of snapshot repos, the other is the size of clone repos. The third is a derived total (sum of these two).

If the cost seems too high, go to SANtricity Web UI and see what can be improved. 

The same information can be charted, to view it over time.

![](/assets/images/eseries-prtg-repo-sensor-02-prtg-chart-view.png)

I also tried the PRTG's new (currently still in alpha) UI - also looking good.

![](/assets/images/eseries-prtg-repo-sensor-03-prtg-new-view.png)

Very importantly, the sensor produces figures that match what the user sees in the array Web UI.

![](/assets/images/eseries-prtg-repo-sensor-04-santricity-view.png)

All snapshot-reserved capacity related to "Groups" is snapshot capacity for individual volumes and consistency groups.

All clone-related capacity is about "snapshot volumes".

I got sensor outputs to (roughly) match what I see in the array UI as well. 

Related to this last point, I had an orphaned repository volume which was adding 24GB to the total shown by the SANtricity UI, so the sensor was showing a higher utilization. But this is a SANtricity issue (I should find a way to delete that orphaned repository volume).

## Conclusion

SANtricity snapshots and clones *are* complicated, and I guess that translates into monitoring and alerting.

Because of that, I recommend to fetch the minimum metrics that do not differ from those in SANtricity Web UI and use SNMP Trap Receiver for the rest. 

Fancy metrics are possible, but in the case of anything actionable the storage admin has to check and fix it in the array interface. 

I still like the idea of special derived metrics, but I'd probably create a limited number for specific purpose, such as anti-ransomware alerts as mentioned above. Gathering half a dozen just to flood the UI defeats the purpose.
