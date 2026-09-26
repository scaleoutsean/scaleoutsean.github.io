# Swagger files for NetApp E-Series

How to get Swagger files for your NetApp E-Series array

If you want to develop or automate E-Series but aren't always connected, you may want to work offline with Swagger API files.

Get them from the array here:

- General API Swagger JSON file (commonly used): `GET /devmgr/v2/swagger`
- SYMbol API Swagger JSON file (rarely used): `GET /devmgr/v2/swagger/symbol`

Then load them to your development environment and that's it!

I'd post them online to Github, but although the SANtricity license (you can see it in the SANtricity Web UI) doesn't seem to disallow the sharing of Swagger files, you never know.

More importantly, though, the API changes every now and then and I don't want the burden of comparing and posting an update every time a new SANtricity version is released.

If you can take advantage of Swagger files for SANtricity, just get them off your array or ask your E-Series administrator to get them for you.

Remember to regularly check for SANtricity updates. You can add a check to your script or application, to warn you when the version is newer than what your code expects.
