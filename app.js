/* eslint-disable no-console */
const debug = require('debug')('webex-rss:app');
const dotenv = require('dotenv');
const { bootstrap } = require('global-agent');
const chalk = require('chalk');
const Watcher = require('./lib/feedWatcher');

// Load ENV if not present
if (!process.env.TOKEN) {
  debug('Load from .env');
  dotenv.config();
}

// Initialize Proxy Server, if defined.
if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
  debug('invoke global agent proxy');
  bootstrap();
}

function processEnv(env) {
  let result = env;
  if (!Number.isNaN(Number(result))) result = Number(result);
  if (result === 'true') result = true;
  if (result === 'false') result = false;
  if (result === 'null') result = null;
  return result;
}

let jiraService = require('./src/jiraService');
const parserService = require('./src/parserService');

// Define RSS Feeds
const incidentFeed = 'https://status.webex.com/history.rss';
const announcementFeed = 'https://status.webex.com/maintenance.rss';
const apiFeed = 'https://developer.webex.com/api/content/changelog/feed';

// Load RSS Watcher Instances
const interval = processEnv(process.env.RSS_INTERVAL) * 60 || 300;
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
          parserService.parseMaintenance(item, itemType, jiraService);
          break;
        case 'resolved':
        case 'monitoring':
        case 'identified':
        case 'investigating':
          parserService.parseIncident(item, itemType, jiraService);
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
    parserService.parseAnnouncement(item, jiraService);
  });
});

// Process API Feed
apiWatcher.on('new entries', (entries) => {
  entries.forEach((item) => {
    debug('new api item');
    parserService.parseApi(item, jiraService);
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
  try {
    const bot = await parserService.getBot();
    console.log(chalk.green(`Bot Loaded: ${bot.displayName} (${bot.emails[0]})`));
  } catch (error) {
    console.log(chalk.red('ERROR: Unable to load Webex Bot, check Token.'));
    debug(error.message);
    process.exit(2);
  }
  try {
    if (process.env.JIRA_SITE) {
      const jiraProject = await jiraService.getProject(process.env.JIRA_PROJECT);
      console.log(chalk.green(`JIRA Project: ${jiraProject.name}`));
    }
  } catch (error) {
    console.log(chalk.yellow('WARN: Unable to verify JIRA Project'));
    jiraService = false;
    debug(error.message);
  }
  try {
    const incRoom = await parserService.getRoom(process.env.INC_ROOM);
    console.log(chalk.green(`Inc Room: ${incRoom.title}`));
  } catch (error) {
    console.log(chalk.red('ERROR: Bot is not a member of the Incident Room!'));
    process.exit(2);
  }
  try {
    const maintRoom = await parserService.getRoom(process.env.MAINT_ROOM);
    console.log(chalk.green(`Maint Room: ${maintRoom.title}`));
  } catch (error) {
    console.log(chalk.red('ERROR: Bot is not a member of the Maintenance Room!'));
    process.exit(2);
  }
  try {
    const announceRoom = await parserService.getRoom(process.env.ANNOUNCE_ROOM);
    // eslint-disable-next-line no-console
    console.log(chalk.green(`Announce Room: ${announceRoom.title}`));
  } catch (error) {
    console.log(chalk.red('ERROR: Bot is not a member of the Announcement Room!'));
    process.exit(2);
  }
  let apiEnabled = false;
  try {
    const apiRoom = await parserService.getRoom(process.env.API_ROOM);
    console.log(chalk.green(`API Room: ${apiRoom.title}`));
    apiEnabled = true;
  } catch (error) {
    console.log(chalk.yellow('WARN: Bot is not a member of the API Room!'));
  }
  incidentWatcher.start();
  announcementWatcher.start();
  if (apiEnabled) {
    apiWatcher.start();
  }
  console.log(chalk.green('Startup Complete!'));
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
