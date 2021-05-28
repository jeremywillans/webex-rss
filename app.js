const debug = require('debug')('webex-rss:app');
const Watcher = require('feed-watcher');
const dotenv = require('dotenv');
const { bootstrap } = require('global-agent');

// Load ENV if not present
if (!process.env.WEBEX_CLIENT_ID) {
  debug('Load from .env');
  dotenv.config();
}

// Initialize Proxy Server, if defined.
if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
  debug('invoke global agent proxy');
  bootstrap();
}

let jiraService = require('./src/jiraService');
const parserService = require('./src/parserService');

// Define RSS Feeds
const incidentFeed = 'https://status.webex.com/history.rss';
const announcementFeed = 'https://status.webex.com/maintenance.rss';
const apiFeed = 'https://developer.webex.com/api/content/changelog/feed';

// Load RSS Watcher Instances
const interval = process.env.RSS_INTERVAL || 2;
const incidentWatcher = new Watcher(incidentFeed, interval);
const announcementWatcher = new Watcher(announcementFeed, interval);
const apiWatcher = new Watcher(apiFeed, interval);

// Process Incident Feed
incidentWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
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
});

// Process Announcement Feed
announcementWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    debug('new announce item');
    parserService.parseAnnouncement(item);
  });
});

// Process API Feed
apiWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    debug('new api item');
    parserService.parseApi(item);
  });
});

// Handle Incident Feed Errors
incidentWatcher.on('error', (error) => {
  debug(error);
});

// Handle Announcement Feed Errors
announcementWatcher.on('error', (error) => {
  debug(error);
});

// Handle API Feed Errors
apiWatcher.on('error', (error) => {
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
    const apiRoom = await parserService.getRoom(process.env.ANNOUNCE_ROOM);
    debug(`API Room: ${apiRoom.title}`);
    apiEnabled = true;
  } catch (error) {
    debug('ERROR: Bot is not a member of the API Room!');
  }
  incidentWatcher.start();
  announcementWatcher.start();
  if (apiEnabled) {
    apiWatcher.start();
  }
  debug('Startup Complete!');
}

// Initiate
init();

// Handle Graceful Shutdown (CTRL+C)
process.on('SIGINT', () => {
  debug('Stopping...');
  incidentWatcher.stop();
  announcementWatcher.stop();
  debug('Feeds Stopped.');
  process.exit(0);
});
