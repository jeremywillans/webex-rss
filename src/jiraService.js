const debug = require('debug')('webex-rss:jiraService');
const JiraClient = require('jira-connector');
const TurndownService = require('turndown');

// Load Turndown for HTML to Markdown
const toMd = new TurndownService();

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
      host: process.env.JIRA_SITE,
      strictSSL: true,
      basic_auth: {},
    };
    if (typeof process.env.JIRA_SSL !== 'undefined') {
      config.strictSSL = processEnv(process.env.JIRA_SSL);
    }
    if (process.env.JIRA_BASE64) {
      config.basic_auth.base64 = process.env.JIRA_BASE64;
    }
    if (process.env.JIRA_PASSWORD) {
      config.basic_auth.username = process.env.JIRA_USERNAME;
      config.basic_auth.password = process.env.JIRA_PASSWORD;
    }
    jira = new JiraClient(config);
  } catch (error) {
    debug('Error loading JIRA Connector');
    debug(error);
  }
}

function jiraService() {
  async function getProject(key) {
    const project = await jira.project.getProject(key);
    return project;
  }
  async function toMarkdown(content) {
    debug('process markdown');

    let markdown = toMd.turndown(content);
    markdown = markdown.replace(/\n/g, '\\n');
    markdown = markdown.replace(/\\-/g, '-');
    markdown = markdown.replace(/\\_/g, '_');
    markdown = markdown.replace(/\\\*/g, '*');
    markdown = markdown.replace(/>/g, '');
    markdown = markdown.replace(/"/g, '');

    return markdown;
  }

  async function searchJira(identifier) {
    debug('searchJira');
    // Search for Existing JIRA matching the Identifier
    try {
      const jiraIdentifier = process.env.JIRA_IDENTIFIER_NAME;
      const jql = `${jiraIdentifier} ~ "\\"${identifier}\\""`;
      const response = await jira.search.search({ method: 'POST', jql });
      switch (response.total) {
        case 0:
          debug('no existing issue');
          return false;
        case 1:
          debug(`matching issue - ${response.issues[0].key}`);
          return response.issues[0];
        default:
          debug('more than one matching, abort.');
          return null;
      }
    } catch (error) {
      debug(error);
      return null;
    }
  }

  async function raiseJira(content) {
    debug('raiseJira');

    const jiraProject = process.env.JIRA_PROJECT;
    const jiraIssue = process.env.JIRA_ISSUE;
    const jiraIdentifier = process.env.JIRA_IDENTIFIER_FIELD;

    let prefix;
    switch (content.type) {
      case 'incident':
        prefix = '[INC] ';
        break;
      case 'maintenance':
        prefix = '[MAINT] ';
        break;
      case 'announcement':
        prefix = '[ANN] ';
        break;
      default:
    }

    const markdown = await toMarkdown(content.description);
    const bodyData = `
        {
          "update": {},
          "fields": {
            "summary": "${prefix}${content.title}",
            "project": {
              "key": "${jiraProject}"
            },
            "issuetype": {
              "name": "${jiraIssue}"
            },
            "description": "${markdown}",
            "${jiraIdentifier}": "${content.guid}",
            "labels": [
              "${content.type}"
            ]
          }
        }`;

    try {
      const response = await jira.issue.createIssue(JSON.parse(bodyData));
      debug(`JIRA ${response.id} raised`);
      return response;
    } catch (error) {
      debug(error);
      return null;
    }
  }

  async function commentJira(issue, content) {
    debug('commentJira');

    const markdown = await toMarkdown(content.description);
    const bodyData = `
        {
          "issueKey": "${issue.key}",
          "body": "${markdown}"
        }`;

    try {
      await jira.issue.addComment(JSON.parse(bodyData));
      debug(`JIRA ${issue.key} updated`);
      return issue;
    } catch (error) {
      debug(error);
      return null;
    }
  }

  async function processJira(content) {
    let response;
    response = await searchJira(content.guid);
    switch (response) {
      case false:
        response = await raiseJira(content);
        break;
      case null:
        break;
      default:
        response = await commentJira(response, content);
    }
    const protocol = process.env.JIRA_PROTOCOL || 'https';
    response.url = `${protocol}://${process.env.JIRA_SITE}/browse/${response.key}`;
    return response;
  }

  if (!jira) {
    return false;
  }

  return {
    getProject,
    toMarkdown,
    searchJira,
    raiseJira,
    commentJira,
    processJira,
  };
}

module.exports = jiraService();
