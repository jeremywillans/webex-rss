# webex-rss

Webex RSS is a parser bot designed to seperate the alerts from the Webex RSS Feeds.

You can also optionally define a filter to limit based on a specific/set of clusters to monitor.

## Deployment

1. Register a Bot at [Webex Developers](https://developer.webex.com/my-apps) for your Organisation
2. Prepare JIRA Credentials

```
> echo -n 'email:api_token' | base64
```

3. Build and Deploy Docker Container (or deploy to Cloud)

```
> docker build --tag webex-rss .
> docker create --name webex-rss \
  -e TOKEN=bot-token-from-developer-dot-webex-dot-com \
  -e INC_ROOM=room-id-for-incident-alerts-room \
  -e MAINT_ROOM=room-id-for-maintenance-alerts-room \
  -e ANNOUNCE_ROOM=room-id-for-announcement-alerts-room \
  -e CLUSTER_FILTER=comma,seperated,list,of,clients,to,monitor \
  -e JIRA_BASE64=amVyZW15QHdpbGxhbnMuaWQuYXU6Zk1XNGN5QkE2aWQ2QmZ4cnJkcmdCNUNF
  -e JIRA_PROJECT=jira-project-code-such-as-NOTIFY
  -e JIRA_ISSUE=jira-issue-type-such-as-Task
  -e JIRA_IDENTIFIER_FIELD=custom-field-name-such-as-customfield_10033
  -e JIRA_IDENTIFIER_NAME=custom-field-label-such-as-Identifier
  webex-rss
```

4. Verify docker logs to ensure bot as started successfully.

## Support

In case you've found a bug, please [open an issue on GitHub](../../issues).

## Disclamer

This script is NOT guaranteed to be bug free and production quality.