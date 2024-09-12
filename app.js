const { bootstrap } = require('global-agent');
// eslint-disable-next-line object-curly-newline
const { cleanEnv, str, bool, num } = require('envalid');
const Watcher = require('./lib/feedWatcher');
const logger = require('./src/logger')('app');
const { version } = require('./package.json');

// Initialize Proxy Server, if defined.
if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
  logger.debug('invoke global agent proxy');
  bootstrap();
}

// Process ENV Parameters
const env = cleanEnv(process.env, {
  ANNOUNCE_DEVICE: bool({ default: false }),
  RSS_INTERVAL: num({ default: 5 }),
  INC_ROOM: str(),
  MAINT_ROOM: str(),
  ANNOUNCE_ROOM: str(),
  API_ROOM: str({ default: false }),
});

// Initialize Device Room Status
const deviceEnabled = false;
const announceDevice = env.ANNOUNCE_DEVICE;

const parserService = require('./src/parserService');

// Define RSS Feeds
const incidentFeed = 'https://status.webex.com/incidents.rss';
const maintenanceFeed = 'https://status.webex.com/maintenances.rss';
const announcementFeed = 'https://status.webex.com/updates-upgrades.rss';
const apiFeed = 'https://developer.webex.com/api/content/changelog/feed';

// Load RSS Watcher Instances
const interval = env.RSS_INTERVAL * 60;
const incidentWatcher = new Watcher(incidentFeed, interval);
const maintenanceWatcher = new Watcher(maintenanceFeed, interval);
const announcementWatcher = new Watcher(announcementFeed, interval);
const apiWatcher = new Watcher(apiFeed, interval);

// Process Incident Feed
incidentWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    // Identify Item Type
    logger.debug('new incident item');
    const typeIndex = item.description.indexOf('<strong >');
    if (typeIndex !== -1) {
      const typeEnd = item.description.indexOf('</strong >', typeIndex);
      const itemType = item.description.substring(typeIndex + 9, typeEnd);
      logger.debug(`detected as ${itemType}`);
      switch (itemType) {
        case 'resolved':
        case 'monitoring':
        case 'identified':
        case 'investigating':
          parserService.parseIncident(item, itemType);
          break;
        default:
          logger.debug('EVENT: UNKNOWN');
          logger.debug(item);
      }
    }
  });
});

// Process Incident Feed
maintenanceWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    // Identify Item Type
    logger.debug('new maintenance item');
    const typeIndex = item.description.indexOf('<strong >');
    if (typeIndex !== -1) {
      const typeEnd = item.description.indexOf('</strong >', typeIndex);
      const itemType = item.description.substring(typeIndex + 9, typeEnd);
      logger.debug(`detected as ${itemType}`);
      switch (itemType) {
        case 'scheduled':
        case 'in progress':
        case 'completed':
          parserService.parseMaintenance(item, itemType);
          break;
        default:
          logger.debug('EVENT: UNKNOWN');
          logger.debug(item);
      }
    }
  });
});

// Process Announcement Feed
announcementWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    logger.debug('new announce item');
    if (deviceEnabled && item.title.match(/^RoomOS.*/)) {
      logger.debug('matches device, sending to device room also');
      parserService.parseDevice(item);
      if (!announceDevice) {
        logger.debug('skip sending device to ann space');
        return;
      }
    }
    parserService.parseAnnouncement(item);
  });
});

// Process API Feed
apiWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    logger.debug('new api item');
    parserService.parseApi(item);
  });
});

// Handle Incident Feed Errors
incidentWatcher.on('error', (error) => {
  logger.error(`Inc Feed Error: ${error}`);
});

// Handle Maintenance Feed Errors
maintenanceWatcher.on('error', (error) => {
  logger.error(`Maint Feed Error: ${error}`);
});

// Handle Announcement Feed Errors
announcementWatcher.on('error', (error) => {
  logger.warn(`Ann Feed Error: ${error}`);
});

// Handle API Feed Errors
apiWatcher.on('error', (error) => {
  logger.warn(`Api Feed Error: ${error}`);
});

// Init Function
async function init() {
  logger.info(`Webex RSS Integration, v${version}`);
  try {
    const bot = await parserService.getBot();
    logger.info(`Bot Loaded: ${bot.displayName} (${bot.emails[0]})`);
  } catch (error) {
    logger.error('ERROR: Unable to load Webex Bot, check Token.');
    logger.debug(error.message);
    process.exit(2);
  }
  try {
    const incRoom = await parserService.getRoom(env.INC_ROOM);
    logger.info(`Inc Room: ${incRoom.title}`);
  } catch (error) {
    logger.error('ERROR: Bot is not a member of the Incident Room!');
    process.exit(2);
  }
  try {
    const maintRoom = await parserService.getRoom(env.MAINT_ROOM);
    logger.info(`Maint Room: ${maintRoom.title}`);
  } catch (error) {
    logger.error('ERROR: Bot is not a member of the Maintenance Room!');
    process.exit(2);
  }
  try {
    const announceRoom = await parserService.getRoom(env.ANNOUNCE_ROOM);
    // eslint-disable-next-line no-console
    logger.info(`Announce Room: ${announceRoom.title}`);
  } catch (error) {
    logger.error('ERROR: Bot is not a member of the Announcement Room!');
    process.exit(2);
  }
  // try {
  //   const deviceRoom = await parserService.getRoom(env.DEVICE_ROOM);
  //   logger.info(`Device Room: ${deviceRoom.title}`);
  //   deviceEnabled = true;
  // } catch (error) {
  //   logger.warn('WARN: Bot is not a member of the Device Room!');
  // }
  let apiEnabled = false;
  if (env.API_ROOM) {
    try {
      const apiRoom = await parserService.getRoom(env.API_ROOM);
      logger.info(`API Room: ${apiRoom.title}`);
      apiEnabled = true;
    } catch (error) {
      logger.warn('WARN: Bot is not a member of the API Room!');
    }
  }
  incidentWatcher.start();
  maintenanceWatcher.start();
  announcementWatcher.start();
  if (apiEnabled) {
    apiWatcher.start();
  }
  logger.info('Startup Complete!');
}

// Initiate
init();

// Handle Graceful Shutdown (CTRL+C)
process.on('SIGINT', () => {
  logger.debug('Stopping...');
  incidentWatcher.stop();
  announcementWatcher.stop();
  logger.debug('Feeds Stopped.');
  process.exit(0);
});
