# SGAC v0.1

Convert NetApp StorageGRID audit log to JSON

## How it begun

Last year I forked a stale community script for StorageGRID audit log analysis and made some improvements to it.

In my opinion it was useful and there have been a few downloads, but I don't know if anyone uses it.

What was useful about it? The reason I refreshed the script was a customer asked for a way to meter downloads and requests.

Because of that I kept the original destination format (CSV) and extracted showback/chargeback-related items.

Those could be loaded to a DB for simple reporting. For example, to show WAN-related egress (where client IPs are WAN IPs), we'd just look for requests where client IP wasn't from LAN (`%10.128.%`):

![StorageGRID egress showback with SGAC](/assets/images/sgac-storagegrid-usage-metering.png)

Some folks told me it's better to just send the log to Splunk or Elastic and let the user sort it out there. I still disagree with that.

That's not a solution, that's just exporting the logs. You still need someone to figure out what to query and how, and maybe don't even have Elastic (let alone Splunk).

Converting audit logs to CSV and importing them to RDMBS seems superior for cost and usage analysis because it:

- it solves the problem (it doesn't just pass the bucket to another app)
- it does so in an easy to understand manner (run the script, import to an DB, run *this* query in order to get *this* result frm *these* columns)
- does it cost-effectively (above screenshot was taken from SQLite; the entire process of conversion and reporting can be run on a desktop or in a container)
- it didn't create and store junk (CSV data you didn't need) - you could retain those in original audit logs; [SGAC(CSV)] extracted only rows and fields required for its purpose

A serverless way to use it was to upload original logs and SGAC output to a StorageGRID WORM bucket and run reports and queries from serverless containers. I know because I tested that with SGAC output converted to Parquet files uploaded to StorageGRID bucket.

What *didn't* work? Because [SGAC(CSV)] was initially focused on cost analysis (chargeback or showback), in order to extract what's necessary and leave out what's not I had to RTFM and figure out what each field was and build SQL queries. That was time-consuming and labor-intensive.

Because of that [SGAC(CSV)] wasn't capable of extracting *everything* and thanks to those limitations it couldn't be used for purposes unrelated to chargeback/showback. That older version can be found [here](https://github.com/scaleoutsean/storagegrid-audit-analysis/blob/0de7882aa0a9a05b0bd8762b644705476be7bab5/sgac/sg_audit_csv_converter.py).

After some thinking how to add additional features to [SGAC(CSV)], I decided to approach the problem differently.

## SGAC v0.1

I solved the features problem by employing the famous "pass the bucket" technique: I parse all audit log entries, convert each line of StorageGRID audit log to a JSON document and append it to a file. There are no features. The rest is up to the user.

There's no more "run the script with `--mode=showback`, import the resulting CSV file to RDBMS, and run *this* query". ~~Problem solved!~~ Bucket passed!

Because everything is converted to JSON, the resulting JSON file ends up being slightly larger than the audit log from which it was converted.

Which reminds me: in [SGAC(CSV)] I used to deliberately drop some "sensitive" fields, so that resulting CSV wouldn't need to be cleansed or masked for simple sharing around IT and Analytics teams purposes, but SGAC v0.1 converts everything so the user needs to think about dealing with PII and other potential challenges (in line with the new bucket-passing concept).

Like its predecessor, SGAC runs fast enough on modest hardware - 1.8 MB/s per CPU core. If you split the log in 8 chunks or run 8 uniprocessor containers or VMs against 8 logs, you could get 10 MB/s). That's why I haven't even tried to optimize it.

SGAC could be easily expanded to send data elsewhere (MongoDB, Elastic, etc.), so feel free to hack it if you want. Or reach out to NetApp Professional Services to do it for you.

Sample output:

```json
{
  "Timestamp": "2021-06-23T04:28:00.173006",
  "RSLT": "SUCS",
  "CNID": 1624422480164404,
  "TIME": 2529,
  "SAIP": "10.128.59.192",
  "TLIP": "10.128.59.241",
  "S3AI": 19663253853227287000,
  "SACC": "solidfire",
  "S3AK": "SGKHulDF8HGK7Az_xR02pVQgooThBQ_rE9dmuuLsLg==",
  "SUSR": "urn:sgws:identity::19663253853227287812:root",
  "SBAI": 19663253853227287000,
  "SBAC": "solidfire",
  "S3BK": "local",
  "S3SR": "policy",
  "AVER": 10,
  "ATIM": 1624422480173006,
  "ATYP": "SGET",
  "ANID": 12470893,
  "AMID": "S3RQ",
  "ATID": 7642530268470403000
}
```

Because there's no more analysis and no more CSV, I no longer call it StorageGRID Audit Analysis (I haven't renamed the Github repo) or [SAGC(CSV)]. Now I just call it StorageGRID Audit log Converter, SGAC.

SGAC v0.1 can be found [here](https://github.com/scaleoutsean/storagegrid-audit-analysis/releases/tag/v0.1).
