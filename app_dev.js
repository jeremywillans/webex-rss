const debug = require('debug')('webex-rss:appDev');
// eslint-disable-next-line import/no-extraneous-dependencies
const RssFeedEmitter = require('rss-feed-emitter');
const dotenv = require('dotenv');

debug('Loading DEV File');

// Load ENV if not present
if (!process.env.WEBEX_CLIENT_ID) {
  debug('Load from .env');
  dotenv.config();
}

let jiraService = require('./src/jiraService');
const parserService = require('./src/parserService');

// Define RSS Feeds
const incidentFeed = 'https://status.webex.com/history.rss';
const announcementFeed = 'https://status.webex.com/maintenance.rss';
const apiFeed = 'https://developer.webex.com/api/content/changelog/feed';

// Define Interval (default 2mins)
const interval = process.env.RSS_INTERVAL * 1000 || 120000;

// Disable Preload in Production
let config;
if (process.env.NODE_ENV === 'production') {
  config = JSON.parse('{ "skipFirstLoad": true }');
}

// Load Feed Emitter
const feeder = new RssFeedEmitter(config);

// Process Incident Feed
feeder.on('incident', (item) => {
  // Identify Item Type
  debug('new incident item');
  const typeIndex = item.description.indexOf('<strong >');
  if (typeIndex !== -1) {
    const typeEnd = item.description.indexOf('</strong >', typeIndex);
    const itemType = item.description.substring(typeIndex + 9, typeEnd);
    debug(`detected as ${itemType}`);
    switch (itemType) {
      case 'scheduled':
      case 'in progress':
      case 'completed':
        parserService.parseMaintenance(item, itemType);
        break;
      case 'resolved':
      case 'monitoring':
      case 'identified':
      case 'investigating':
        parserService.parseIncident(item, itemType);
        break;
      default:
        debug('EVENT: UNKNOWN');
        debug(item);
    }
  }
});

// Process Announcement Feed
feeder.on('announcement', (item) => {
  // Discard Older Items from Announcement Feed
  if (process.env.NODE_ENV !== 'production') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    if (item.pubdate < d) {
      return;
    }
  }
  debug('new announce item');
  parserService.parseAnnouncement(item);
});

// Process API Feed
feeder.on('api', (item) => {
  // Discard Older Items from Announcement Feed
  if (process.env.NODE_ENV !== 'production') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    if (item.pubdate < d) {
      return;
    }
  }
  debug('new api item');
  parserService.parseApi(item);
});

// Handle Incident Feed Errors
feeder.on('error', (error) => {
  debug(error);
});

// Init Function
async function init() {
  const bot = await parserService.getBot();
  debug(`Bot Loaded: ${bot.displayName} (${bot.emails[0]})`);
  try {
    const jiraProject = await jiraService.getProject(process.env.JIRA_PROJECT);
    debug(`JIRA Project: ${jiraProject[0].name}`);
  } catch (error) {
    debug('Unable to verify JIRA Project');
    jiraService = false;
  }
  try {
    const incRoom = await parserService.getRoom(process.env.INC_ROOM);
    debug(`Inc Room: ${incRoom.title}`);
  } catch (error) {
    debug('ERROR: Bot is not a member of the Incident Room!');
    process.exit(2);
  }
  try {
    const maintRoom = await parserService.getRoom(process.env.MAINT_ROOM);
    debug(`Maint Room: ${maintRoom.title}`);
  } catch (error) {
    debug('ERROR: Bot is not a member of the Maintenance Room!');
    process.exit(2);
  }
  try {
    const announceRoom = await parserService.getRoom(process.env.ANNOUNCE_ROOM);
    debug(`Announce Room: ${announceRoom.title}`);
  } catch (error) {
    debug('ERROR: Bot is not a member of the Announcement Room!');
    process.exit(2);
  }
  let apiEnabled = false;
  try {
    const apiRoom = await parserService.getRoom(process.env.API_ROOM);
    debug(`API Room: ${apiRoom.title}`);
    apiEnabled = true;
  } catch (error) {
    debug('ERROR: Bot is not a member of the API Room!');
  }
  feeder.add({
    url: incidentFeed,
    refresh: interval,
    eventName: 'incident',
  });
  feeder.add({
    url: announcementFeed,
    refresh: interval,
    eventName: 'announcement',
  });
  if (apiEnabled) {
    feeder.add({
      url: apiFeed,
      refresh: interval,
      eventName: 'api',
    });
  }
  debug('Startup Complete!');
}

// Initiate
init();

// Handle Graceful Shutdown (CTRL+C)
process.on('SIGINT', () => {
  debug('Stopping...');
  feeder.destroy();
  debug('Feeds Stopped.');
  process.exit(0);
});
