# Keep going with NetApp SolidFire MCP server

Public and private SolidFire MCP documentation server and tools for 12.7+

## Introduction

My [Build NetApp SolidFire MCP server](/2025/05/20/get-started-with-netapp-solidfire-mcp-server.html) post was done in the relatively early days of MCP servers in VS Code, when Bash scripts were enough. It was also very basic, more of an encouragement to consider creating your own.

Since [I've been working with MCP again](/2026/11/21/kompromise-lite-s3-tag-on-upload.html), I thought to do a little bit more and help the remaining SolidFire users get more out of their investment.

This is part two: "Keep going with NetApp SolidFire MCP server".

## What's new or different

This is not a full implementation of everything. It's not a toy either. 

What you get now is:

- Split-horizon MCP server for secure local and remote use
- **Remote**: MCP HTTP server ([the API endpoint, not for human access, is here](https://solidfire.mcp.scaleoutsean.com/mcp)) with SolidFire 12.7 API documentation
- **Local**: `stdio` server (modern implementation, NodeJS) with several **read-only** tools

What's cool about this:

- If you're just developing, all your agents need is HTTP access to get API examples. Just use it.
- If you have agents that access the SolidFire API, then you need the local `stdio` server component. Download, install and use!
- If you want to run the HTTP API documentation server locally - guess what? - download, install and use!

What it does and doesn't do:

- It's 12.7 only. That's not bad because the API hasn't changed much.
  - if you have a *newer* version, you can still use the old API endpoint. You can also download the source and add the new API methods
  - if you have an *older* version (like I, mine is 12.5), you can still use it, just remember ignore the newer API commands or edit them out to avoid confusing your AI
- MCP tools for local use are just 4-5. What's good about this is you can easily add more of the same. What's both good *and* bad is the server *cannot* make any changes to your SolidFire. On the one hand, it's safe and secure. On the other, you can't make configuration changes

Security and privacy are first priorities, so I'm not rushing with anything that can modify your storage. If you do need it, please try adding those on your own *or* let me know in Github issues and I may try adding them.

Let's check out some (console) screenshot pr0n.

## HTTP

In this use case, you simply ask about the API. For example, you can get all API methods, or ask about individual methods.

![HTTP](/assets/images/solidfire-mcp-02-http-version.png)

If you look closer, there are three questions in this screenshot (which can be opened in a new tab for a better resolution).

This server doesn't require (in fact, it rejects) any credentials. It's just "man pages for MCP clients".

If you want to run this locally, you can. I run a community service for those who don't want to run their own and various bots on the Internet.

## stdio

This one requires at least read credentials, and uses `stdio` on localhost (your development machine). It doesn't do anything weird and it doesn't spit out passwords and other sensitive information. It also does **not** have tools that can query tenant accounts (and their passwords).

It is deliberately limited and secure. In fact, I run it with a `monitor` user that that has the following access: read, reporting, supportAdmin.

In this example I ask about schedules. It queries the API and shows there are two.

![Local MCP tool that lists SolidFire snapshot schedules](/assets/images/solidfire-mcp-03-tools-schedule.png)

There are 3-4 similar "Get" and "List" commands. You can use the source code to create dozens more if you want. 

This one is a bit special: it's a "Test" command. **If** your client has access to iSCSI network and your account has administrator access (the one above won't work), you can execute this command:

![Local MCP tool that tests SVIP access](/assets/images/solidfire-mcp-04-tools-svip-reachability-check.png)

Local configuration may be tricky. This is mine, with DNS resolution for MVIP and NVIP, SolidFire password in environment variable, and MCP server executed from the repository/build location. There's more in the README on Github.

![Local MCP server configuration](/assets/images/solidfire-mcp-06-stdio-configuration.png)

### Use cases and customization

This is deliberate, to remind you that you can use these tools in infrastructure troubleshooting.

The Get/List tools were also selected to be useful by clients that don't automate SolidFire, but can use the information about limits, configuration (including SVIP) and more to orchestrate the entire stack end to end, because the information is available.

Remember to **not** create tools for GetAccount, ListAccounts, GetAccountByID and other methods that expose sensitive information. But of course you'll do that too, because you must. Carefully check API responses and create filters that immediately redact sensitive information, but remember it can still end up in dumps and logs. So better don't.

## Future development

I think this version is usable for development and secure operations that don't need to change storage configuration.

I don't have big plans for this MCP server since I never get any feedback, so I don't think I'll change it much. I do have some cool ideas for it (related to backup to S3 and more), as always. 

You're welcome to [hack away](https://github.com/scaleoutsean/solidfire-mcp-server), submit enhancement requests or report bugs.

## Conclusion

And **still**, the best storage array in NetApp portfolio...

![And STILL](/assets/images/solidfire-mcp-05-and-still.png)
