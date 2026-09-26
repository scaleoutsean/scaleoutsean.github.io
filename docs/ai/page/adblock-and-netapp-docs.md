# Block external sites to improve loading speed of NetApp docs

Annoyed by the slow-loading NetApp documentation? Fix it.

## The hogs

These hogs often make the site load very slowly.

![External hogs on https://docs.netapp.com](/assets/images/netapp_docs_external_hogs_01.png)

The two phat scripts are candidates for local caching even if you need them.

The rest are candidates for your browser filters/blockers.

## Block 'em

I tried blocking 'em all (both the phat scripts and the rest of the unessential stuff), and didn't see any negative effects.

In **uBlock Origin** (Firefox), under **My Filters**, add these and see if it helps.

```sh
! -----------------------General junk -----------------------!
! Translation junk
||translate-pa.googleapis.com^
||translate.googleapis.com^
! -----------------------Analytics junk ---------------------!
||go-mpulse.net^
||typography.com^
||akstat.io^
! -----------------------AI junk ----------------------------!
! Search served from this domain, can no longer be blocked without disabling search
! ||ie-docs-chatbot-api.azure-api.net^ 
! Sep 16, 2026 https://docs.netapp.com - AI search summary
||docs.netapp.com##._ai_nm4y2_1
||docs.netapp.com/common/chat/netapp-components-chat.umd.js$script
! (above is a specific file filter)
! -----------------------Assets junk ------------------------!
||assets.adobetm.com^$domain=docs.netapp.com
||assets.adobetm.com^
||transcend-cdn.com^$domain=docs.netapp.com
! -----------------------Social junk ------------------------!
||avatars.githubusercontent.com^$domain=docs.netapp.com
```

I have other uBO filters (lists) enabled and they catch other stuff in addition to what I have here. Right now I see 21 rules in total are being applied on [this](https://docs.netapp.com/us-en/trident/trident-use/element.html) page.

If you must load stuff from some of these sites - for example, assets.adobetm.com - when something useful is pulled off them, you'd have to limit the rule to docs.netapp.com as it's already done above. The same applies to other filters.

If you use another blocker with different syntax, try to "translate" these into your plugin's filtering syntax.

## Conclusion

For me, it seems to cuts page load time by up to 80%. Now it's down to under two seconds and usually much closer to one second.

If you RTFM, this might matter to you. If you prefer to listen what AI bots tell you and don't RTFM often - it probably won't.

## Update

- 2026/09 - NetApp docs search moved to `ie-docs-chatbot-api.azure-api.net`, so you can't search if you block the annoying AI chat bot. Remedy:
  - Remove any blocker `! ||ie-docs-chatbot-api.azure-api.net^` from uBlock to be able to use search
  - Add `docs.netapp.com##._ai_nm4y2_1` to block AI summary at the top of the page
