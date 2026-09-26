# OpenAPI and SolidFire

About OpenAPI file for SolidFire

SolidFire doesn't have an OpenAPI interface. See [here](https://docs.netapp.com/us-en/element-software/concepts/concept_intro_solidfire_software_interfaces.html#element-sdks).

I never tried to find out why, but looking from the outside it appears that during NetApp HCI time NetApp tried to work out an OpenAPI interface for [HCC](https://docs.netapp.com/us-en/element-software/hccstorage/index.html) aka "NetApp HCI management node", so *some* indirect and limited use of REST API was possible (as pass-through to back-end SolidFire API endpoint). I have that JSON file [here](https://github.com/scaleoutsean/awesome-solidfire/tree/master/hcc). 

What should have been developed instead was SolidFire integrations with automation frameworks and projects, and not a new management service which added complexity and created problems (one still [can't easily get the logs out](/2020/11/27/solidfire-mnode-hcc-log-forwarding.html), for example).

In any case, it's not clear how much need there is for OpenAPI among SolidFire users.

OpenAPI and Swagger are meant to work with RESTful APIs and SolidFire uses JSON-RPC. 

I just created a "stub" OpenAPI definition file in the folder 'api' in my Awesome SolidFire repo.

![](/assets/images/solidfire-openapi-3.0.3-swagger-01.png)

I'd like to be able to submit request directly from Swagger, but currently this only generates a curl wrapper for CreateVolume. 

Anyone can load it from [Swagger Editor](https://editor.swagger.io/) to improve it and add more API methods. 

Now someone might say "so you're basically suggesting to recreate HCC's API", but I'm pretty sure creating a simple two-way JSONRPC-to-RESTful [translator](https://github.com/navidnabavi/jsonrpc2rest) - or even just a RESTful interface on the same SolidFire API MVIP (/rest/12.7 in addition of /json-rpc/12.7, for example) - would have been easier, faster, better than creating a new "management node". 

The reason I played with Swagger is that Postman has been really going on my nerves lately - it seems on can't even load API collections without having an account - so I've been looking for ways to make SolidFire API and API documentation more accessible to me personally. 

And, while looking at Swagger, I realized that SolidFire Postman Collection *cannot* be converted to OpenAPI that's usable in Swagger, so I decided to manually create a Swagger file for SolidFire. 

I don't have much need to use Swagger to access SolidFire but maybe I'll revisit it at a later time. For example, OpenAPI interface for this [proxy](/2023/12/07/solidfire-rbac-for-json-rpc-api.html#complicate-things-with-custom-apis) attempt could be useful, especially since NetApp never delivered RBAC for SolidFire.
