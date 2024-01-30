const { cleanEnv, str } = require('envalid');
const logger = require('./logger')('parserService');
const httpService = require('./httpService');

// Process ENV Parameters
const env = cleanEnv(process.env, {
  TOKEN: str(),
  INC_ROOM: str(),
  MAINT_ROOM: str(),
  ANNOUNCE_ROOM: str(),
  API_ROOM: str({ default: undefined }),
  DEVICE_ROOM: str({ default: undefined }),
});

// Parse Cluster Filter ENV
let clusterFilter = [];
if (process.env.CLUSTER_FILTER) {
  try {
    clusterFilter = process.env.CLUSTER_FILTER.split(',');
  } catch (error) {
    logger.error('Unable to Parse Cluster Filter...');
    logger.debug(error.message);
    process.exit(2);
  }
  logger.info(`Loaded Cluster Filter: ${clusterFilter}`);
}

function parserService() {
  function parseCluster(content) {
    const clusters = [];
    // Webex Teams
    // if (content.match(/\bWebex Teams[,\s]/)) {
    //   clusters.push('Webex Teams');
    // }
    // Webex Meetings Clusters
    if (content.match(/\bSan Jose[,\s]/)) {
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
    if (content.match(/\bLondon[,\s]/)) {
      clusters.push('AI');
      clusters.push('BI');
      clusters.push('I');
      clusters.push('W');
    }
    if (content.match(/\bVirginia[,\s]/)) {
      clusters.push('AA');
      clusters.push('AB');
    }
    if (content.match(/\bSingapore[,\s]/)) {
      clusters.push('AS');
    }
    if (content.match(/\bFedRAMP[,\s]/)) {
      clusters.push('F');
    }
    if (content.match(/\bSydney[,\s]/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAustralia[,\s]/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAPAC[,\s]/)) {
      clusters.push('AS');
      clusters.push('AP');
      clusters.push('BY');
    }
    if (content.match(/\bAA[,\s]/)) {
      clusters.push('AA');
    }
    if (content.match(/\bAB[,\s]/)) {
      clusters.push('AB');
    }
    if (content.match(/\bAC[,\s]/)) {
      clusters.push('AC');
    }
    if (content.match(/\bAO[,\s]/)) {
      clusters.push('AO');
    }
    if (content.match(/\bAP[,\s]/)) {
      clusters.push('AP');
    }
    if (content.match(/\bAS[,\s]/)) {
      clusters.push('AS');
    }
    if (content.match(/\bAW[,\s]/)) {
      clusters.push('AW');
    }
    if (content.match(/\bB[,\s]/)) {
      clusters.push('B');
    }
    if (content.match(/\bBI[,\s]/)) {
      clusters.push('BI');
    }
    if (content.match(/\bBY[,\s]/)) {
      clusters.push('BY');
    }
    if (content.match(/\bI[,\s]/)) {
      clusters.push('I');
    }
    if (content.match(/\bIB[,\s]/)) {
      clusters.push('IB');
    }
    if (content.match(/\bIC[,\s]/)) {
      clusters.push('IC');
    }
    if (content.match(/\bIE[,\s]/)) {
      clusters.push('IE');
    }
    if (content.match(/\bIJ[,\s]/)) {
      clusters.push('IJ');
    }
    if (content.match(/\bIK[,\s]/)) {
      clusters.push('IJ');
    }
    if (content.match(/\bE[,\s]/)) {
      clusters.push('E');
    }
    if (content.match(/\bF[,\s]/)) {
      clusters.push('F');
    }
    if (content.match(/\bJ[,\s]/)) {
      clusters.push('J');
    }
    if (content.match(/\bL[,\s]/)) {
      clusters.push('L');
    }
    if (content.match(/\bM[,\s]/)) {
      clusters.push('M');
    }
    if (content.match(/\bR[,\s]/)) {
      clusters.push('R');
    }
    if (content.match(/\bS[,\s]/)) {
      clusters.push('S');
    }
    if (content.match(/\bU[,\s]/)) {
      clusters.push('U');
    }
    if (content.match(/\bW[,\s]/)) {
      clusters.push('W');
    }
    return clusters;
  }

  function parseLocation(description) {
    let locations = [];
    const startLoc = description.indexOf('Locations:</strong>');
    const endLoc = description.indexOf(' </font><br /><br />', startLoc);
    if (startLoc !== -1 && endLoc !== -1) {
      locations = description.substring(startLoc + 20, endLoc);
      if (locations === 'f') {
        locations = 'F';
      }
      locations = locations.split(',');
    }
    return locations;
  }

  function formatDescription(description, status) {
    const endDesc = description.indexOf('</small>');
    const statusLoc = description.indexOf(status);
    let formatted = description;
    if (endDesc !== -1) {
      formatted = description.substring(
        // 22 equates for '<strong >' and '</strong > - '
        statusLoc + status.length + 13,
        // 8 equates to '</small>'
        endDesc + 8,
      );
    }
    formatted = formatted.replace(/\r?\n|\r/g, '<br />');
    formatted = formatted.replace(/<strong>-- /g, '<strong>');
    formatted = formatted.replace(/ --<\/strong>/g, '</strong>');
    return formatted;
  }

  function formatBlockquote(status) {
    let blockquote;
    switch (status) {
      case 'investigating':
      case 'identified':
        blockquote = 'danger';
        break;
      case 'monitoring':
      case 'in progress':
      case 'Warning':
        blockquote = 'warning';
        break;
      case 'resolved':
      case 'completed':
      case 'New':
      case 'None':
        blockquote = 'success';
        break;
      case 'scheduled':
        blockquote = 'info';
        break;
      default:
        // Includes 'Breaking Change'
        blockquote = 'danger';
    }
    return blockquote;
  }

  async function getBot() {
    const bot = await httpService.getField(env.TOKEN, 'people/me');
    return bot;
  }

  async function getRoom(roomId) {
    const room = await httpService.getField(env.TOKEN, `rooms/${roomId}`);
    return room;
  }

  function formatTitle(title) {
    let formatted = title;
    formatted = formatted.replace(/'/g, '"');
    formatted = formatted.replace('com/', 'com');
    return formatted;
  }

  function toTitleCase(title) {
    return title.replace(
      /\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase(),
    );
  }

  async function parseMaintenance(item, status) {
    const output = {};
    logger.debug('EVENT: MAINTENANCE');
    output.title = formatTitle(item.title);
    output.type = 'maintenance';
    output.clusters = parseCluster(item.title);
    output.locations = parseLocation(item.description);

    if (output.clusters.length > 0) {
      if (
        // eslint-disable-next-line operator-linebreak
        clusterFilter.length > 0 &&
        !output.clusters.some((c) => clusterFilter.includes(c))
      ) {
        logger.debug(`Maint not relevant, only matching for ${clusterFilter}`);
        return;
      }
    }

    // If defined, identify Start/End Times
    const startIndex = item.description.indexOf('Start: ');
    const endIndex = item.description.indexOf('Complete: ');
    if (startIndex !== -1 && endIndex !== -1) {
      const startEnd = item.description.indexOf('\r', startIndex);
      const startTime = item.description.substring(startIndex + 7, startEnd);
      output.startTime = startTime;
      const endEnd = item.description.indexOf('\r', endIndex);
      const endTime = item.description.substring(endIndex + 10, endEnd);
      output.endTime = endTime;
      // Remove from Item
      const startSchedule = item.description.indexOf('\r\n\r\n<strong>-- Scheduled Maintenance Window');
      const newDesc = `${item.description.substring(0, startSchedule)}${item.description.substring(endEnd, item.description.length)}`;
      // eslint-disable-next-line no-param-reassign
      item.description = newDesc;
    }

    output.description = formatDescription(item.description, status);
    output.blockquote = formatBlockquote(status);
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
    if (output.locations.length > 0) {
      const locations = output.locations.join(', ');
      if (locations.includes(',')) {
        html += `<br><strong>Locations: </strong>${locations}`;
      } else {
        html += `<br><strong>Location: </strong>${locations}`;
      }
    }
    if (output.startTime && output.endTime) {
      html += `<br><strong>Start: </strong>${output.startTime}<br><strong>End: </strong>${output.endTime}`;
    }
    html += `<br><br>${output.description}`;

    await httpService.postMessage(env.TOKEN, env.MAINT_ROOM, html);
  }

  async function parseIncident(item, status) {
    const output = {};
    logger.debug('EVENT: INCIDENT');
    output.title = formatTitle(item.title);
    output.type = 'incident';
    output.clusters = parseCluster(item.title);
    output.locations = parseLocation(item.description);
    output.description = formatDescription(item.description, status);
    output.blockquote = formatBlockquote(status);
    output.guid = item.guid;

    if (output.clusters.length > 0) {
      if (
        // eslint-disable-next-line operator-linebreak
        clusterFilter.length > 0 &&
        !output.clusters.some((c) => clusterFilter.includes(c))
      ) {
        logger.debug(`Incident not relevant, only matching for ${clusterFilter}`);
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
    if (output.locations.length > 0) {
      const locations = output.locations.join(', ');
      if (locations.includes(',')) {
        html += `<br><strong>Locations: </strong>${locations}`;
      } else {
        html += `<br><strong>Location: </strong>${locations}`;
      }
    }
    html += `<br><br>${output.description}`;

    await httpService.postMessage(env.TOKEN, env.INC_ROOM, html);
  }

  async function parseAnnouncement(item) {
    const output = {};
    logger.debug('EVENT: ANNOUNCEMENT');
    output.title = item.title;
    output.type = 'announcement';
    output.clusters = parseCluster(item.title);
    output.description = formatDescription(item.description, 22);
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
    html += `<br><br>${output.description}`;

    await httpService.postMessage(env.TOKEN, env.ANNOUNCE_ROOM, html);
  }

  async function parseDevice(item) {
    const output = {};
    logger.debug('EVENT: DEVICE');
    output.title = item.title;
    output.type = 'device';
    output.description = formatDescription(item.description, 22);
    output.guid = item.guid.replace(/\r\n/g, '');
    output.link = item.link;

    let html = `<strong>${output.title}</strong><blockquote class="info">`;
    html += `<strong>Maintenance Calendar: </strong>${output.link}`;
    html += `<br><br>${output.description}`;

    await httpService.postMessage(env.TOKEN, env.DEVICE_ROOM, html);
  }

  async function parseApi(item) {
    const output = {};
    logger.debug('EVENT: API');
    output.title = formatTitle(item.title);
    output.type = 'api';
    output.description = item.description;
    output.guid = item.guid.replace(/\r\n/g, '');
    output.type = item['rss:type']['#'] || 'New';
    output.blockquote = formatBlockquote(output.type);
    output.link = item.link;

    let html = `<strong><a href='${output.link}'>${output.title}</a></strong><blockquote class="${
      output.blockquote
    }"><strong>Category: </strong>${toTitleCase(output.type)}`;
    html += `${output.description}`;

    await httpService.postMessage(env.TOKEN, env.API_ROOM, html);
  }

  return {
    parseCluster,
    formatDescription,
    formatBlockquote,
    getBot,
    getRoom,
    parseMaintenance,
    parseIncident,
    parseAnnouncement,
    parseDevice,
    parseApi,
  };
}

module.exports = parserService();
