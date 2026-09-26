# Got binged in July 2025

How I got binged out of Bing in July 2025

I don't track users (see Privacy page), don't have ads and don't care about "likes" or "followers", but generally I want my content to be in search engine indexes for discoverability. 

That is especially the case since I don't "advertise" blog and don't spam social media with links, so search engines (including AI-ones) are normally the main way for people to find this site.

Every now and then I look at the high level stats (the only ones I have) just to see if everything is fine as far as search engines are concerned.

Lately I noticed two trends:

- Referrals from AI search engines (the good ones, if you will, those who provide links to where the content is coming from). This is usually 0-5% (it varies week to week) and growing.
- Referrals from Bing have completely disappeared lately

These seemed counter-intuitive, given Microsoft's prominence in AI, with Copilot and whatnot.

## Deindexed?

So after seeing that for several weeks, I decided to take a look. Lo and behold at what happened in early July!

![Got binged in July](/assets/images/meta_01_seo_bing.png)

It turns out Microsoft has tightened the screws some five weeks ago and now if you don't have your site map in order, they "de-emphasize" you. Or, in other words, your search index ranking gets crushed to something like page 100.

Maybe not page 100, but maybe I'm not even in there. I looked for some blog posts that Google refers users to, and not one was in top five pages, and those are "the top" pages. They must be very low-ranked or not in there at all. 

I see in the screenshot a few pages get found every other days, so it's probably just very heavy penalization.

Anyway, after seeing their blog post on the new approach I looked at my sitemap and indeed, it wasn't done the way Bing likes it. I fixed that and that will hopefully do it.

## Click-through issue

The other funny thing with that Bing chart is "surfacing" is fine, click-through isn't great. Honestly, I can't say I care - why, I explained at the top - but for things I *create*, I want them to be findable. Not popular or liked, just findable.

So I looked at that too. 

Bing lets you see how your site fares for keywords and what people look for when they see you in results. It appears Bing's audience is non very technical and although my content gets surfaced "enough for my liking", it's usually very "consumer-level stuff" that people are looking for. 

There may be an odd query about Kubernetes, but it's "how to provision a PVC" or some entry-level stuff. For 99.9% of users that is not something this site can help with. And that's okay - "no action required", as they say!

I just want to make sure the damn blog is findable on Bing, as now it is not even for the most obvious stuff. If I search for *my own projects*, I'm nowhere in first five pages which is incredible no matter how my sitemap looks like! 

## Should be fixed now

Bing was never a big referrer for me. 

After this sitemap/index fix is reflected in the index, Bing will probably have the same share as AI search engines - but I just want the links to be in there ranked according to their relevance, and nothing more. Currently I can't even tell people who use Bing to "just bing it" because almost nothing has been bingable since early July.

But, this is also related to AI search. 

Copilot, for example, gets its results from Bing (and Duck Duck Go, too). So if you get obliterated in Bing, Copilot (and DDG's AI) likely won't know much or anything about your Web site content either. And that (AI referrals) is from technical power users and I know that has been growing. 

Not from Copilot - since I got binged - but from OpenAI and Perplexity. 

So with the sitemap now fixed my site will get its previous visibility in Bing and with that (the important part) in Copilot as well.

I guesstimate it should be okay again in a day or two.

## Appendix A: Update (Aug 16, 2025)

Nothing good happened after my "fixes". 

Today I used Bing's Webmaster Tools and discovered that some pages were "discovered by not crawled" in 2006 (LOL!) because it "has some issues which are preventing indexation". Very helpful!

![Bing is a mess](/assets/images/meta_02_seo_bing_url_inspector.png)

There were other pages like this. Approximately one in 20 was indexed. So today I attempted additional "fixes". 

At this point I'm concerned this will continue until I break my Web site generator or remove myself from Google's index...

## Appendix B (Update (Aug 22, 2025))

Bing's search index is totally messed up. Even after making fixes that somehow weren't needed only 2-3 months ago, Bing is still showing old pages (that are now no longer good) and my "fixed" site map submitted for indexing on Aug 16 is still "in processing" and not *one* page from it is showing as already included in their index.

Apparently it takes them at least a week - and this is the "automated" approach, mind you, what you normally see complete on Google the same or next day.

Some old pages are still in the index, so dropping old pages on site map update also takes many days.

## Appendix C (Update (Aug 25, 2025))

Since last week I have no errors of any kind, and even most warnings have been fixed. 

After extensive fixes and all sorts of "best practices", best I could do in the past week was 2 impressions on one day. All others were complete 0s. All the while my Google referrals have been normal. Bing is fun!

![Flatlining on Bing](/assets/images/meta_03_seo_bing_perf_after_fixes.png)

## Appendix D (Update (Aug 30, 2025))

I saw on X Bing is giving rewards to their users. I'd much prefer if they hired someone to fix the damn thing. They wouldn't have to reward anyone if their indexing and search were good.

New strategy: 

- Remove the site from Bing index with meta tags
- Wait a week or two, then add it back again

We'll see how that works.
