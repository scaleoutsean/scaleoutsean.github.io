# Kafka notifications in NetApp StorageGRID 11.8

Notes on Kafka notification integration in StorageGRID 11.8

- [Introduction](#introduction)
- [How to configure](#how-to-configure)
- [What do Kafka notifications look like](#what-do-kafka-notifications-look-like)
- [Similarities and differences compared to Elasticsearch search integration](#similarities-and-differences-compared-to-elasticsearch-search-integration)
- [Use cases for StorageGRID notifications](#use-cases-for-storagegrid-notifications)
- [Storage platform for Kafka](#storage-platform-for-kafka)
- [Conclusion](#conclusion)

## Introduction

Since 11.8, NetApp StorageGRID supports Kafka notifications in addition to the previous cloud-only AWS SNS notifications.

SNS works fine, but it requires access to AWS cloud or using a non-AWS alternative in the cloud or locally.

Kafka may therefore be an attractive option for users who already use it, or want a supported local option.

In the cloud there’s also the option of using [Instaclustr for Apache Kafka](https://www.instaclustr.com/platform/managed-apache-kafka/), a fully managed service for Apache Kafka®—SOC 2 certified and hosted in the cloud (or on-prem, and remotely managed by Instaclustr).

## How to configure

You can find the instructions for StorageGRID 11.8 [here](https://docs.netapp.com/us-en/storagegrid-118/tenant/understanding-notifications-for-buckets.html).

## What do Kafka notifications look like

They look like this (notification of a `PUT` of an object key `3copies/kafka/garbage.data`):

```json
{
  "Records": [
    {
      "eventVersion": "2.0",
      "eventSource": "sgws:s3",
      "eventTime": "2024-02-16T00:22:42Z",
      "eventName": "ObjectCreated:Put",
      "userIdentity": {
        "principalId": "24419428051587010483"
      },
      "requestParameters": {
        "sourceIPAddress": "7.7.7.7"
      },
      "responseElements": {
        "x-amz-request-id": "1705364562158800"
      },
      "s3": {
        "s3SchemaVersion": "1.0",
        "configurationId": "Image-created",
        "bucket": {
          "name": "3copies",
          "ownerIdentity": {
            "principalId": "24419428051587010483"
          },
          "arn": "urn:sgws:s3:::3copies"
        },
        "object": {
          "key": "kafka/garbage.data",
          "size": 191874,
          "eTag": "a769fd0119787cac09158fe08971e480",
          "sequencer": "17AAAC08B754819C"
        }
      }
    }
  ]
}
```

## Similarities and differences compared to Elasticsearch search integration

I noticed that some people – even at work - get confused by StorageGRID [search integration](https://docs.netapp.com/us-en/storagegrid-118/tenant/understanding-search-integration-service.html) with Elasticsearch.

There’s no *real* difference. If we consider what happens with Kafka and Elasticsearch, in both cases StorageGRID fires an API call that delivers information to an API endpoint.

In the case of search integration (currently just Elasticsearch), the call contains object metadata (either system or user metadata). Completely unrelated to this, Elasticsearch can be used for log archiving, search and analytics. I wrote a post about that [here](/2023/07/20/storagegrid-and-elaticsearches.html) which has an example of a JSON file StorageGRID search integration sends to Elasticsearch.

In the case of notifications, the call does not contain object metadata (see the JSON above).

That means that there’s no functional difference:
- StorageGRID search integration can be used to drive notifications through Elasticsearch [data streams](https://www.elastic.co/guide/en/elasticsearch/reference/current/data-streams.html) or otherwise
- StorageGRID notifications can be used to for search by querying objects (as metadata are not present) from a Kafka consumer and storing data in Elasticsearch or some other searchable location (here I have an [example of vector search in PostgreSQL](/2023/11/28/postgres-pgvector-instacluster-eseries.html)).

The main reason we think of these as different is that the “advertised” approaches usually make more sense.

For example, if we used Kafka for search we'd have more work to do - first process a notification, then make another API call (to S3 API endpoint) to get object metadata. It's more natural to use search integration here if there's nothing else to do - search notification contains metadata and there's no need to send another call unless you want to use something else rather than Elasticsearch.

## Use cases for StorageGRID notifications

There's nothing new about it - use cases are the same as for AWS SNS notifications.

If we want to know what's happening in a bucket, we send its notifications to a Kafka topic and there we consume those notifications:
- Security (analyze unusual activity)
- Data pipelines (run OCR on PDFs or Speech-to-Text on new MP3 recordings)
- Other processing of bucket data or metadata

Recently I blogged about [anti-malware/anti-virus scanning of StorageGRID buckets](/2024/01/29/antivirus-scanning-for-on-premises-s3.html) where I suggested to get object lists from Elasticsearch.

That's one of use cases for Kafka notifications that could be used as well because we may not need object metadata and don't necessarily need to store anything so we may not want to build and retain many GBs of Elasticsearch data.

As I've mentioned above, the only difference compared to search integration with Elasticsearch is that Kafka notifications do not contain metadata, but we may not need those anyway. There are exceptions - for example, if our front-end application tagged documents with "`isScanned=True|False`" - when using Elasticsearch may be more efficient - but normally Kafka should work just fine for this use case.

One situation in anti-virus scanning in which Kafka notifications should better than search integration is where we use a temporary bucket for objects that need to be scanned, after which objects are moved to the actual "destination" bucket.
- User uploads object to application
- Objects are uploaded to the bucket `avscan` and StorageGRID sends notification to Kafka
- Kafka notification triggers consumer to initiate object analysis (scan or multiple scans by different scan engines)
- A negative result (no threat detected) results in another Kafka message to another topic
- "Mover" worker moves non-infected object to the final bucket destination (whatever it may be)
- A positive scan results in an error that's sent back to the user. These objects may be moved to another bucket (quarantine)

That's one interesting use case for Kafka that may be easier to implement than with Elasticsearch.

## Storage platform for Kafka

Just as an aside - whether it's Kafka or Elasticsearch (or both) - I recommend NetApp E-Series arrays for that.

E/EF arrays [have](/2022/06/28/kafka-eseries-object-storage.html) the features Kafka and Elasticsearch need, and don't have almost any features they don't need: you get the performance, data protection, economics and secure management so that you can use slim 1U servers for services and save the cost of hardware, software, and rack space.

## Conclusion

For StorageGRID users with cloud and hybrid cloud workloads, Kafka notifications provide the option of using services other than AWS SNS (3rd party Kafka as a Service such as Instaclustr for Apache Kafka).

For on-prem users, notifications can now work without a DIY SNS configuration or "indirect" workflows that involve Elasticsearch.
 
While Kafka notifications do not contain object metadata, Kafka consumers with appropriate permissions can access bucket objects to obtain metadata. But in most cases that information isn't required or - if the object is subsequently accessed in the next step of data pipeline - the next app will get both object data and metadata.
