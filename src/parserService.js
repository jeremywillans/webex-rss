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

function parserService() {
  function parseLocation(description) {
    let locations = [];
    const startLoc = description.indexOf('Locations:</strong>');
    const endLoc = description.indexOf(' <br /><br />', startLoc);
    if (startLoc !== -1 && endLoc !== -1) {
      // 227 equates for 'Locations:</strong></font> '
      locations = description.substring(startLoc + 27, endLoc);
      locations = locations.split(', ');
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
    output.locations = parseLocation(item.description);

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
    output.locations = parseLocation(item.description);
    output.description = formatDescription(item.description, status);
    output.blockquote = formatBlockquote(status);
    output.guid = item.guid;

    let html = `<strong><a href=${output.guid}>${
      output.title
    }</a></strong><blockquote class="${
      output.blockquote
    }"><strong>Status: </strong>${toTitleCase(status)}`;
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
    output.description = formatDescription(item.description, 22);
    output.guid = item.guid.replace(/\r\n/g, '');
    output.link = item.link;

    let html = `<strong>${output.title}</strong><blockquote class="info">`;
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
