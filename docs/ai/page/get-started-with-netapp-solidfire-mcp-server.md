# Build NetApp SolidFire MCP server

Build your SolidFire MCP server in minutes

- [Introduction](#introduction)
- [MCP](#mcp)
- [Use cases?](#use-cases)
- [Get, set, and security](#get-set-and-security)
- [Conclusion](#conclusion)
- [Additional reading](#additional-reading)

## Introduction

I noticed some storage vendors have been highlighting their "commitment" to AI by posting about their MCP servers.

I've received zero queries about GenAI, AIOps and such in the context of SolidFire. 

But:

- I know SolidFire is fine for RAG AI in small and medium environments (IO requirements for those are mostly insignificant)
- Even after years of no updates, SolidFire is still better for AIOps and MCP-style integration than almost any mainstream storage out there

Because of that, I hoped to find time to check it out.

## MCP

So... How hard is it? 

It's laughably easy - with SolidFire.

First, get some MCP SDK. For example, [for Python](https://github.com/modelcontextprotocol/python-sdk). Note that SolidFire SDK for Python [doesn't work](https://github.com/solidfire/solidfire-sdk-python/issues/67) with Python 3.12 (what awesome sustaining!). I used Ubuntu 22.04 and Python 3.10, which worked. Maybe 3.11 is OK, but I haven't tried. Python 3.9 is considered old, so don't even try that one. You *don't have to* use SolidFire SDK, you can use `requests` which is what I did in SFC 2, for example.

Second, copy the top section of some MCP server example to server.py.

```python
# server.py
from mcp.server.fastmcp import FastMCP

# Create an MCP server
mcp = FastMCP("Demo")
```

Third, add some SolidFire stuff to it.

```python
@mcp.resource("volumes://{top}")
def get_large_volumes(top: int = 5) -> list:
    """Get top volumes by size (default: 5)"""
    # don't use an admin account in production! Even read-only admins can get CHAP creds.
    sfe = ElementFactory.create("192.168.1.30","admin","buggger-off-pentest-idiots", print_ascii_art=False, version="12.5")
    common.setLogLevel(logging.ERROR)    
    volumes = (sfe.list_volumes().to_json())['volumes']
    sorted_volumes = sorted(volumes, key=lambda x: x['totalSize'], reverse=True)
    large_volumes = sorted_volumes[:top]
    volume_list = []
    for volume in large_volumes:
        volume_list.append({'name': volume['name'], 'totalSize': volume['totalSize'], 'iqn': volume['iqn']})
    return volume_list
```

Take a break after this exhausting hackathon and then run your MCP server in dev mode like so:

```sh
mcp dev server.py
```

It will tell you something like "MCP Inspector is up and running at http://127.0.0.1:6274". 

Visit the page, find `get_large_volumes` under Resource Templates, pick that, enter some number for `top` value (e.g. 3, if you don't have 5) and you should see something like this:

![SolidFire MCP Resource Template output](/assets/images/solidfire-mcp-00-get-started.png)

If you copy that, you'll get full response onto your clipboard (I've inserted some extra line breaks for easier viewing):

```json
{
  "contents": [
    {
      "uri": "volumes://3",
      "mimeType": "text/plain",
      "text": "[\n  
        {\n \"name\": \"win2\",\n
            \"totalSize\": 20000538624,\n
            \"iqn\": \"iqn.2010-01.com.solidfire:wcwb.win2.135\"\n  },\n 
        {\n \"name\": \"syncJobTest\",\n
            \"totalSize\": 10737418240,\n
            \"iqn\": \"iqn.2010-01.com.solidfire:wcwb.syncjobtest.172\"\n  },\n  
        {\n \"name\": \"vol10g\",\n    
            \"totalSize\": 10000269312,\n
            \"iqn\": \"iqn.2010-01.com.solidfire:wcwb.vol10g.167\"\n  }
        \n]"
    }
  ]
}
```

Yeah, yeah, I could have shown GiB and/or some other details...

If you wonder why the UI looks like crap, that's not the case. It's just the dev Web server.

![SolidFire MCP in development mode](/assets/images/solidfire-mcp-01-get-started.png)

"Real-life" AI that uses SolidFire MCP server would be something like Claude Desktop or other front-ends. 

I didn't feel like subscribing (or installing) Claude Desktop or other software because the convenient dev Web server gives me everything I need to test.

## Use cases?

Are there any use cases for this stuff with SolidFire?

I think there are, mostly in AIOps. 

If you're still using SolidFire and have workflows that you haven't been automated because it was too expensive or you didn't want to invest in it, that would be one situation.

I picked IQN as one of volume properties included in "top N volumes" response because mapping volumes to Linux and Windows devices is one annoying area of server-storage automation.

That's not hard to solve (examples can be found in [SolidFire DBA Tools](https://github.com/scaleoutsean/solidfire-windows/tree/master/SolidFireDbaTools) for Windows or [SolidBackup](https://github.com/scaleoutsean/solidbackup) for Linux and containers), but for *ad-hoc* experimentation and dev-test use, it's probably faster to create workflows with MCP than create automation workflows that's are enough to accomplish the same.

Another area of opportunity is the situation where information is easily available, but difficult to correlate. For example, having a pair of MCP servers - Kubernetes and SolidFire - one should be able to easily identify over-provisioned (in terms of capacity or performance) volumes and get the commands to patch/modify them which could be executed outside of AI context.

Another: most of [BlueXP Workload Factory](https://www.netapp.com/bluexp/workload-factory/) features related to storage configuration could be done in AIOps with an SolidFire MCP server. If [Longhorny](https://github.com/scaleoutsean/longhorny) was put behind an API, SolidFire replication, cluster fail-over and fail-back would all become "AI-ready" as well.

Some MCP servers out there are targeted at DevOps (rather than AIOps or "ChatOps"). One example I saw today is Hashicorp's Terraform MCP server. It seems to just provide access to the Terraform documentation. In other words, it can help with DevOps, but won't tell you anything about your Terraform environment. I don't have this use case for SolidFire MCP server in mind because SolidFire APIs are very easy to use.

## Get, set, and security

Getting large volumes doesn't actually do anything for you. If you have [SFC](/2024/05/29/sfc-v2.html) and Grafana, you can see top volumes in a Grafana dashboard on your own and inspect volumes faster than by interacting with an AI.

But an AI can also create API calls that modify existing resources (e.g. QoS) or create new ones. 

We wouldn't want to let MCP server be able to make changes. In fact (as mentioned in sample code), you must be careful even with MCPs that only use "GET" (or "LIST") types of requests, because once they gain access there's no additional authorization for "DELETE".

In summary, I'd be very careful with "GET" and put the SolidFire API endpoint behind a [reverse proxy](/2023/12/07/solidfire-rbac-for-json-rpc-api.html) or otherwise protect it. For "SET" type operations, DevTest environments are as far as I'd go. (See the MCP Security link at the bottom for a good overview by Cisco.)

## Conclusion

The SolidFire API is almost perfect, which is why it's easy to create an MCP server for it.

Because the API is easy to use, most users already have proper automation workflows and probably don't need ChatOps. Additionally, the security risks of MCP must not be underestimated.

I'd recommend MCP for DevTest environments where SolidFire automation doesn't exist, but can be beneficial. That includes situations where iSCSI clients (Hyper-V, Windows, Proxmox, ESXi) no longer have officially supported methods of integrating with SolidFire.

And - who knows? - maybe it's easier to use an AI with a SolidFire MCP server to get a SolidFire workflow done than using an AI on its own. One such example would be a native SolidFire Proxmox storage plugin - if you're not a Perl guy, you'd probably get it done faster by creating a basic SolidFire MCP server in Python or TS first (something I've been thinking of lately), than struggling with Perl, even with AI's help (when there's no MCP to tell it how to call the SolidFire API).

Another example for this may be Kubernetes operators. I put together [this minimal example](/2022/04/28/solidfire-operator-kubernetes.html) "before the age of AI", but it may be much easier to create a more complete one with the help of an AI. 

Another practical example: if I wanted to automate a VMware-SolidFire workflow, I may not be able to do that well without a VMware stack. But with vSphere and SolidFire MCP servers, I would probably be able to create a reasonable prototype if not functioning code.

## Additional reading

- If you're curious about SolidFire MCP in the context of AIOps, check out [this post](https://medium.com/@native-cloud/mcp-the-aiops-game-changer-8408996b8a05)
- [MCP Server 101: Use Cases & Applications To Know!](https://medium.com/@rapidinnovation/mcp-server-101-use-cases-applications-to-know-ec4ce2e56b0f)
- [AI Model Context Protocol (MCP) and Security](https://community.cisco.com/t5/security-blogs/ai-model-context-protocol-mcp-and-security/ba-p/5274394)
