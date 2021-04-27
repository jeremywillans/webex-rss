const debug = require('debug')('webex-rss:clearjira');
const JiraClient = require('jira-connector');
const dotenv = require('dotenv');

// Load ENV if not present
if (!process.env.WEBEX_CLIENT_ID) {
  debug('Load from .env');
  dotenv.config();
}

// Load JIRA Connector if configured
let jira = false;
if (process.env.JIRA_SITE) {
  try {
    jira = new JiraClient({
      host: process.env.JIRA_SITE,
      strictSSL: true,
      basic_auth: {
        base64: process.env.JIRA_BASE64,
      },
    });
  } catch (error) {
    debug('Error loading JIRA Connector');
    debug(error);
  }
}

if (!jira) {
  debug('JIRA not configured');
  process.exit(0);
}

jira.search.search({ method: 'POST', jql: '' }).then((response) => {
  debug(`JIRA Count: ${response.total}`);
  response.issues.forEach((item) => {
    jira.issue.deleteIssue({ issueKey: item.key }).then(() => {
      debug(`Deleted JIRA: ${item.key}`);
    });
  });
});
