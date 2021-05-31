const debug = require('debug')('webex-rss:parserService');
const Webex = require('webex');
const chalk = require('chalk');
const retry = require('async-retry');

// Load Webex SDK
let webex;
try {
  webex = Webex.init({
    credentials: {
      access_token: process.env.TOKEN,
    },
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.log(chalk.red('ERROR: Unable to load Webex Bot, check Token.'));
  debug(error.message);
  process.exit(2);
}

// Parse Cluster Filter ENV
let clusterFilter = [];
if (process.env.CLUSTER_FILTER) {
  try {
    clusterFilter = process.env.CLUSTER_FILTER.split(',');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(chalk.red('Unable to Parse Cluster Filter...'));
    debug(error.message);
    process.exit(2);
  }
  // eslint-disable-next-line no-console
  console.log(chalk.green(`Loaded Cluster filter: ${clusterFilter}`));
}

function parserService() {
  async function parseCluster(content) {
    const clusters = [];
    // Webex Teams
    // if (content.match(/\bWebex Teams\b/)) {
    //   clusters.push('Webex Teams');
    // }
    // Webex Meetings Clusters
    if (content.match(/\bSan Jose\b/)) {
      clusters.push('AC');
      clusters.push('AW');
      clusters.push('B');
      clusters.push('E');
      clusters.push('F');
      clusters.push('IB');
      clusters.push('IE');
      clusters.push('IJ');
      clusters.push('S');
      clusters.push('U');
    }
    if (content.match(/\bLondon\b/)) {
      clusters.push('AI');
      clusters.push('BI');
      clusters.push('I');
      clusters.push('W');
    }
    if (content.match(/\bVirginia\b/)) {
      clusters.push('AA');
      clusters.push('AB');
    }
    if (content.match(/\bSingapore\b/)) {
      clusters.push('AS');
    }
    if (content.match(/\bFedRAMP\b/)) {
      clusters.push('F');
    }
    if (content.match(/\bSydney\b/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAustralia\b/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAPAC\b/)) {
      clusters.push('AS');
      clusters.push('AP');
      clusters.push('BY');
    }
    if (content.match(/\bAA\b/)) {
      clusters.push('AA');
    }
    if (content.match(/\bAB\b/)) {
      clusters.push('AB');
    }
    if (content.match(/\bAC\b/)) {
      clusters.push('AC');
    }
    if (content.match(/\bAO\b/)) {
      clusters.push('AO');
    }
    if (content.match(/\bAP\b/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAS\b/)) {
      clusters.push('AS');
    }
    if (content.match(/\bAW\b/)) {
      clusters.push('AW');
    }
    if (content.match(/\bB\b/)) {
      clusters.push('B');
    }
    if (content.match(/\bBI\b/)) {
      clusters.push('BI');
    }
    if (content.match(/\bBY\b/)) {
      clusters.push('BY');
    }
    if (content.match(/\bI\b/)) {
      clusters.push('I');
    }
    if (content.match(/\bIB\b/)) {
      clusters.push('IB');
    }
    if (content.match(/\bIC\b/)) {
      clusters.push('IC');
    }
    if (content.match(/\bIE\b/)) {
      clusters.push('IE');
    }
    if (content.match(/\bIJ\b/)) {
      clusters.push('IJ');
    }
    if (content.match(/\bIK\b/)) {
      clusters.push('IJ');
    }
    if (content.match(/\bE\b/)) {
      clusters.push('E');
    }
    if (content.match(/\bF\b/)) {
      clusters.push('F');
    }
    if (content.match(/\bJ\b/)) {
      clusters.push('J');
    }
    if (content.match(/\bL\b/)) {
      clusters.push('L');
    }
    if (content.match(/\bM\b/)) {
      clusters.push('M');
    }
    if (content.match(/\bR\b/)) {
      clusters.push('R');
    }
    if (content.match(/\bS\b/)) {
      clusters.push('S');
    }
    if (content.match(/\bU\b/)) {
      clusters.push('U');
    }
    if (content.match(/\bW\b/)) {
      clusters.push('W');
    }
    return clusters;
  }

  async function formatDescription(description, status) {
    const endDesc = description.indexOf('</small>');
    let formatted = description;
    if (endDesc !== -1) {
      formatted = description.substring(
        // 22 equates for '<strong >' and '</strong > - '
        status.length + 22,
        // 8 equates to '</small>'
        endDesc + 8,
      );
    }
    formatted = formatted.replace(/\r?\n|\r/g, '<br />');
    return formatted;
  }

  async function formatBlockquote(status) {
    let blockquote;
    switch (status) {
      case 'investigating':
      case 'identified':
        blockquote = 'danger';
        break;
      case 'monitoring':
      case 'in progress':
        blockquote = 'warning';
        break;
      case 'resolved':
      case 'completed':
        blockquote = 'success';
        break;
      case 'scheduled':
        blockquote = 'info';
        break;
      default:
        blockquote = 'danger';
    }
    return blockquote;
  }

  async function postMessage(roomId, html) {
    await retry(
      async () => {
        webex.messages
          .create({
            html,
            roomId,
          })
          .then(() => {
            debug('message sent');
          })
          .catch((error) => {
            debug(error.message);
          });
      },
      {
        retries: 5,
      },
    );
  }

  async function getBot() {
    const bot = await webex.people.get('me');
    return bot;
  }

  async function getRoom(roomId) {
    const incRoom = await webex.rooms.get(roomId);
    return incRoom;
  }

  function toTitleCase(title) {
    return title.replace(
      /\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase(),
    );
  }

  async function parseMaintenance(item, status, jiraService) {
    const output = {};
    debug('EVENT: MAINTENANCE');
    output.title = item.title;
    output.type = 'maintenance';
    output.clusters = await parseCluster(item.title);

    if (output.clusters.length > 0) {
      if (
        // eslint-disable-next-line operator-linebreak
        clusterFilter.length > 0 &&
        !output.clusters.some((c) => clusterFilter.includes(c))
      ) {
        debug(`Maint not relevant, only matching for ${clusterFilter}`);
        return;
      }
    }

    // If defined, identify Start/End Times
    const startIndex = item.description.indexOf('Start: ');
    if (startIndex !== -1) {
      const startEnd = item.description.indexOf('\r', startIndex);
      const startTime = item.description.substring(startIndex + 7, startEnd);
      output.startTime = startTime;
    }
    const endIndex = item.description.indexOf('Complete: ');
    if (endIndex !== -1) {
      const endEnd = item.description.indexOf('\r', endIndex);
      const endTime = item.description.substring(endIndex + 10, endEnd);
      output.endTime = endTime;
    }

    output.description = await formatDescription(item.description, status);
    output.blockquote = await formatBlockquote(status);
    output.guid = item.guid;

    let html = `<strong><a href=${output.guid}>${
      output.title
    }</a></strong><blockquote class="${
      output.blockquote
    }"><strong>Status: </strong>${toTitleCase(status)}`;
    if (output.clusters.length > 0) {
      const clusters = output.clusters.join(', ');
      if (clusters.includes(',')) {
        html += `<br><strong>Clusters: </strong>${clusters}`;
      } else {
        html += `<br><strong>Cluster: </strong>${clusters}`;
      }
    }
    if (output.startTime && output.endTime) {
      html += `<br><strong>Start: </strong>${output.startTime}<br><strong>End: </strong>${output.endTime}`;
    }
    if (jiraService) {
      const response = await jiraService.processJira(output);
      const jiraType = toTitleCase(process.env.JIRA_ISSUE);
      html += `<br><strong>JIRA ${jiraType}: </strong><a href=${response.url}>${response.key}</a>`;
    }
    html += `<br><br>${output.description}`;

    await postMessage(process.env.MAINT_ROOM, html);
  }

  async function parseIncident(item, status, jiraService) {
    const output = {};
    debug('EVENT: INCIDENT');
    output.title = item.title;
    output.type = 'incident';
    output.clusters = await parseCluster(item.title);
    output.description = await formatDescription(item.description, status);
    output.blockquote = await formatBlockquote(status);
    output.guid = item.guid;

    if (output.clusters.length > 0) {
      if (
        // eslint-disable-next-line operator-linebreak
        clusterFilter.length > 0 &&
        !output.clusters.some((c) => clusterFilter.includes(c))
      ) {
        debug(`Incident not relevant, only matching for ${clusterFilter}`);
        return;
      }
    }

    let html = `<strong><a href=${output.guid}>${
      output.title
    }</a></strong><blockquote class="${
      output.blockquote
    }"><strong>Status: </strong>${toTitleCase(status)}`;
    if (output.clusters.length > 0) {
      const clusters = output.clusters.join(', ');
      if (clusters.includes(',')) {
        html += `<br><strong>Clusters: </strong>${output.clusters}`;
      } else {
        html += `<br><strong>Cluster: </strong>${output.clusters}`;
      }
    }
    if (jiraService) {
      const response = await jiraService.processJira(output);
      const jiraType = toTitleCase(process.env.JIRA_ISSUE);
      html += `<br><strong>JIRA ${jiraType}: </strong><a href=${response.url}>${response.key}</a>`;
    }
    html += `<br><br>${output.description}`;

    await postMessage(process.env.INC_ROOM, html);
  }

  async function parseAnnouncement(item, jiraService) {
    const output = {};
    debug('EVENT: ANNOUNCEMENT');
    output.title = item.title;
    output.type = 'announcement';
    output.clusters = await parseCluster(item.title);
    output.description = await formatDescription(item.description, 22);
    output.guid = item.guid.replace(/\r\n/g, '');
    output.link = item.link;

    let html = `<strong>${output.title}</strong><blockquote class="info">`;
    if (output.clusters.length > 0) {
      const clusters = output.clusters.join(', ');
      if (clusters.includes(',')) {
        html += `<br><strong>Clusters: </strong>${output.clusters}`;
      } else {
        html += `<br><strong>Cluster: </strong>${output.clusters}`;
      }
    }
    html += `<strong>Maintenance Calendar: </strong>${output.link}`;
    if (jiraService) {
      const response = await jiraService.processJira(output);
      const jiraType = toTitleCase(process.env.JIRA_ISSUE);
      html += `<br><strong>JIRA ${jiraType}: </strong><a href=${response.url}>${response.key}</a>`;
    }
    html += `<br><br>${output.description}`;

    await postMessage(process.env.ANNOUNCE_ROOM, html);
  }

  async function parseApi(item, jiraService) {
    const output = {};
    debug('EVENT: API');
    output.title = item.title;
    output.type = 'api';
    output.description = item.description;
    output.guid = item.guid.replace(/\r\n/g, '');
    output.link = item.link;

    let html = `<strong><a href='${output.link}'>${output.title}</a></strong><blockquote class="info">`;
    if (jiraService && process.env.JIRA_API_LOG) {
      const response = await jiraService.processJira(output);
      const jiraType = toTitleCase(process.env.JIRA_ISSUE);
      html += `<strong>JIRA ${jiraType}: </strong><a href=${response.url}>${response.key}</a><br>`;
    }
    html += `${output.description}`;

    await postMessage(process.env.API_ROOM, html);
  }

  return {
    parseCluster,
    formatDescription,
    formatBlockquote,
    postMessage,
    getBot,
    getRoom,
    parseMaintenance,
    parseIncident,
    parseAnnouncement,
    parseApi,
  };
}

module.exports = parserService();
