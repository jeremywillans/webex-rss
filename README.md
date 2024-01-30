# webex-rss

## Webex RSS

Webex RSS is a parser bot designed to enrich the data provided from the Webex RSS Feeds.

It provides the following functions
- Separates the feed content into three or four Webex Spaces (Incidents, Maintenance, Announcements and optionally Developer API)
- Define a filter to limit based on a specific/set of clusters to monitor.

## Prerequisites
1. Register a Bot at [Webex Developers](https://developer.webex.com/my-apps) for your Organization, noting the Token ID
2. Create Spaces for Output Messages in Webex App, namely Incidents, Maintenance and Announcements (API as an optional)
3. Obtain RoomId for each room (simply add `astronaut@webex.bot` to space, or get using Developer APIs)
4. Add Bot created in Step 1 to each of the above spaces.

## Deployment (Local)

1. Clone / Download repository
2. Run `npm install` to add the require dependencies (ensure Node and NPM are installed)
3. Create an `.env` file and include the required variables outlined below.
- Recommend adding `CONSOLE_LEVEL=debug` during initial testing
4. Start the integration using `npm run start`
5. Review the console logs to confirm no errors encountered

## Deployment (Docker)

The simplest deployment method is using [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)

1. Clone / Download repository
2. Update the included docker-compose.yml file with the correct Environmental parameters
3. Provision and start the Integration using `docker-compose up -d`, image will be built on load
4. Review the console logs using `docker logs webex-rss -f` (assuming you are using the default container name)

### Environmental Variables

These variables can be individually defined in Docker, or loaded as an `.env` file in the `/app` directory.

| Name | Type | Default | Description
| ---- | ---- | ------- | -----------
| TOKEN | **Required** | ` ` | Bot Token for Webex Messaging Posts
| INC_ROOM | **Required** | ` ` | RoomId for Webex Incident Space
| MAINT_ROOM | **Required** | ` ` | RoomId for Webex Maintenance Space
| ANNOUNCE_ROOM | **Required** | ` ` | RoomId for Webex Announcement Space
| API_ROOM | Optional | ` ` | RoomId for Webex Developer API Space
| RSS_INTERVAL | Optional | `5` | Interval for RSS Checks (Minutes)
| CLUSTER_FILTER | Optional | ` ` | Comma Separated List of Cluster Names to include.
| **Logging Settings**
| CONSOLE_LEVEL | no | bool | `info` | Logging level exposed to console
| APP_NAME | no | string | `webex-rss` | App Name used for logging service
| SYSLOG_ENABLED | no | bool | `false` | Enable external syslog server
| SYSLOG_HOST | no | string | `syslog` | Destination host for syslog server
| SYSLOG_PORT | no | num | `514` | Destination port for syslog server
| SYSLOG_PROTOCOL | no | str | `udp4` | Destination protocol for syslog server
| SYSLOG_SOURCE | no | str | `localhost` | Host to indicate that log messages are coming from
| LOKI_ENABLED | no | bool | `false` | Enable external Loki logging server
| LOKI_HOST| no | string | `http://loki:3100` | Destination host for Loki logging server
| **HTTP Proxy**
| GLOBAL_AGENT_HTTP_PROXY | no | string | ` ` | Container HTTP Proxy Server (format `http://<ip or fqdn>:<port>`)
| GLOBAL_AGENT_NO_PROXY | no | string | ` ` | Comma Separated List of excluded proxy domains (Supports wildcards)
| NODE_EXTRA_CA_CERTS | no | string | ` ` | Include extra CA Cert bundle if required, (PEM format) ensure location is attached as a volume to the container

## Support

In case you've found a bug, please [open an issue on GitHub](../../issues).

## Disclaimer

This application is provided as a sample only is NOT guaranteed to be bug free and production quality.
