# Fixing Web UI annoyances with element blocking

Fix Web UI annoyances with CSS element blocker

While using ehm, a famous S3 server, I got annoyed by this stupid red dot.

![](/assets/images/annoyances_minio_red_circle_01.png)

Yeah, I get it: pay attention to the license.

Which I did as always before I downloaded the damn thing.

So, what is the purpose of distracting and annoying me with that red dot every time I use the Web UI?

I can use the API or CLI? Sure. I do that, but I'd also like something like this.

![](/assets/images/annoyances_minio_red_circle_02.png)

Now, how does one get from A to B?

I could change the source, but the AGPL 3.0 license mandates that - if I ever were to let anyone download something from my server - I [have to publish the modified source code](https://www.gnu.org/licenses/agpl-3.0.html) and offer the user to download it.

>  It requires the operator of a network server to provide the source code of the modified version running there to the users of that server.

Thanks, but no, thanks!

Use your favorite ad blocker to block the `##circle` element on the IP/FQDN where Web UI is hosted (IP/FQDN is determined automaticaly by ad blocker in any case).

Web log shows the element being blocked (on one of the URLs, shown in above screenshots, but the filter itself applies to the entire server (1)).

![](/assets/images/annoyances_minio_red_circle_03.png)

That's it. You haven't modified anything, there's no need to publish any modifications and you're good to go.
