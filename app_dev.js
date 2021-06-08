/* eslint-disable no-console */
const debug = require('debug')('webex-rss:appDev');
const RssFeedEmitter = require('rss-feed-emitter');
const dotenv = require('dotenv');
const { bootstrap } = require('global-agent');
const chalk = require('chalk');

debug('Loading DEV File');

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

let jiraService = require('./src/jiraService');
const parserService = require('./src/parserService');

// Define RSS Feeds
const incidentFeed = 'https://status.webex.com/history.rss';
const announcementFeed = 'https://status.webex.com/maintenance.rss';
const apiFeed = 'https://developer.webex.com/api/content/changelog/feed';

// Define Interval (default 2mins)
const interval = process.env.RSS_INTERVAL * 1000 || 120000;

// Load Feed Emitter
const feeder = new RssFeedEmitter();

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

// Process Announcement Feed
feeder.on('announcement', (item) => {
  // Discard Older Items from Announcement Feed
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  if (item.pubdate < d) {
    return;
  }
  debug('new announce item');
  parserService.parseAnnouncement(item, jiraService);
});

// Process API Feed
feeder.on('api', (item) => {
  // Discard Older Items from Announcement Feed
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  if (item.pubdate < d) {
    return;
  }
  debug('new api item');
  parserService.parseApi(item, jiraService);
});

// Handle Incident Feed Errors
feeder.on('error', (error) => {
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
  console.log(chalk.green('Startup Complete!'));
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
