const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TOKEN = 'test-token';
process.env.INC_ROOM = 'test-incident-room';
process.env.MAINT_ROOM = 'test-maintenance-room';
process.env.ANNOUNCE_ROOM = 'test-announcement-room';

const { formatDescription } = require('../src/parserService');

test('moves a trailing period outside the Webex Help link', () => {
  const description = 'For help and support, visit our website at '
    + '<a href="https://help.webex.com.">https://help.webex.com.</a>';

  assert.equal(
    formatDescription(description, 'scheduled'),
    'For help and support, visit our website at '
      + '<a href="https://help.webex.com">https://help.webex.com</a>.',
  );
});

test('leaves a correctly formatted Webex Help link unchanged', () => {
  const description = 'For help and support, visit our website at '
    + '<a href="https://help.webex.com">https://help.webex.com</a>.';

  assert.equal(formatDescription(description, 'scheduled'), description);
});
