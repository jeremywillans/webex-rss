const debug = require('debug')('webex-rss:clearJira');
const JiraApi = require('jira-client');
const dotenv = require('dotenv');

// Load ENV if not present
if (!process.env.WEBEX_CLIENT_ID) {
  debug('Load from .env');
  dotenv.config();
}

function processEnv(env) {
  let result = env;
  if (result === 'true') result = true;
  if (result === 'false') result = false;
  if (result === 'null') result = null;
  return result;
}

let jira = false;
if (process.env.JIRA_SITE) {
  try {
    const config = {
      protocol: process.env.JIRA_PROTOCOL || 'https',
      host: process.env.JIRA_SITE,
      strictSSL: true,
      basic_auth: {},
      username: process.env.JIRA_USERNAME,
      password: process.env.JIRA_PASSWORD,
    };
    if (typeof process.env.JIRA_SSL !== 'undefined') {
      config.strictSSL = processEnv(process.env.JIRA_SSL);
    }
    jira = new JiraApi(config);
  } catch (error) {
    debug('Error loading JIRA Connector');
    debug(error);
  }
}

if (!jira) {
  debug('JIRA not configured');
  process.exit(0);
}

jira.searchJira().then((response) => {
  debug(`JIRA Count: ${response.total}`);
  response.issues.forEach((item) => {
    jira.deleteIssue(item.key).then(() => {
      debug(`Deleted JIRA: ${item.key}`);
    });
  });
});
