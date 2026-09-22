const test = require('node:test');
const assert = require('node:assert/strict');

test('loads the production HTTP request dependency', () => {
  assert.doesNotThrow(() => require('postman-request'));
});
