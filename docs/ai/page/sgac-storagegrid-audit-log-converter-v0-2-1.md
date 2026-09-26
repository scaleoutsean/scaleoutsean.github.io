# SGAC v0.2.1

Find out if SGAC (StorageGRID audit log converter to JSON) works with ELK stack

Some two months ago I rewrote SGAC and released it as v0.1.

Github tells me few folks downloaded it but I've no idea who and why. I got no contributions and feedback from colleagues either, but as I worked on the [SolidFire-ELK post](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html) I thought I should use the opportunity to check if SGAC JSON log can be imported to ELK.

I didn't know what to expect as since SGAC v0.1 I validate SGAC output in both PowerShell and Python, but you never know... Of course, it didn't work that well so I had to use some dirty tricks, and now it does. At least that's what it looks like.

![SGAC JSON imported to Elastic with Logstash - 7.15.1](/assets/images/sgac-v0-2-1-logstash-import-success.png)

There are no tricks, you just import JSON documents (each line is a "document") with Logstash (or with Filebeat and pass it on to Logstash).

There still may be nasty surprises in hidden in imported records (say, policy-related values with those nested JSON files), but they need to be found and fixed.

But now I've tried it and have pretty good indications the basic stuff works fine: all the records (from my sample) seem imported and several simple queries worked as expected.

![SGAC logs in Elastic 7.15.1](/assets/images/sgac-v0-2-1-elastic-elk.png)

In fact, I just spotted a problem like the one I described earlier right here in the screenshot.... That JSON has extra escapes (edit: I fixed that in v0.2.2).

That transformation is Logstash's, not SGAC's, task so for now I'll leave that as an exercise to the skilled reader. But even values that contain JSON documents with escapes [can be searched](/2021/10/18/solidfire-syslog-filebeat-logstash-elk-stack.html#searching-unstructured-logs).

You can see a video demo of ingesting and using SGAC data in to ELK [here](https://www.youtube.com/watch?v=Xu5mEUTqlqY) (2m01s).

SGAC v0.2.1 can be found [in the usual location](https://github.com/scaleoutsean/storagegrid-audit-analysis/).
