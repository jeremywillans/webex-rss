'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('events');

var _parseRss = require('./parseRss');

var _parseRss2 = _interopRequireDefault(_parseRss);

function request(feedUrl) {
  return new Promise(function (resolve, reject) {
    (0, _parseRss2['default'])(feedUrl, function (error, entries) {
      if (error) {
        return reject(error);
      }
      if (!entries) {
        return reject(new Error('No entries were founded. Check your url.'));
      }

      // Sort by release.
      entries.sort(function (ent1, ent2) {
        return ent2.pubDate / 1000 - ent1.pubDate / 1000;
      });
      resolve(entries);
    });
  });
}

var Watcher = (function (_EventEmitter) {
  _inherits(Watcher, _EventEmitter);

  function Watcher(feedUrl, interval) {
    _classCallCheck(this, Watcher);

    _get(Object.getPrototypeOf(Watcher.prototype), 'constructor', this).call(this);

    // Make sure the url exists and it's a string.
    if (!feedUrl || typeof feedUrl !== 'string') {
      throw new Error('feedUrl isn\'t defined');
    }

    this.feedUrl = feedUrl;
    this.interval = interval || 60; // 1 hour by default
    this.lastEntryDate = null; // Used to make sure if there is new entries.
    this.lastEntryTitle = null; // Used to avoid duplicates.
    this.timer = null; // Stores watcher function.
  }

  // Check all entries on the feed.

  _createClass(Watcher, [{
    key: 'checkAll',
    value: function checkAll() {
      return request(this.feedUrl);
    }

    // Set up the watcher.
  }, {
    key: 'config',
    value: function config(cfg) {
      this.feedUrl = cfg && cfg.feedUrl ? cfg.feedUrl : this.feedUrl;
      this.interval = cfg && cfg.interval ? cfg.interval : this.interval;
    }

    // Start watching.
  }, {
    key: 'start',
    value: function start() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.checkAll().then(function (entries) {
          _this.lastEntryDate = entries[0].pubDate / 1000;
          _this.lastEntryTitle = entries[0].title;
          _this.timer = _this.watch();
          resolve(entries);
        })['catch'](function (err) {
          reject(err);
        });
      });
    }

    // Stop watching.
  }, {
    key: 'stop',
    value: function stop() {
      clearInterval(this.timer);
      this.emit('stop');
    }

    // Check the feed.
  }, {
    key: 'watch',
    value: function watch() {
      var _this2 = this;

      var fetch = function fetch() {
        _this2.checkAll().then(function (entries) {
          // Filter older entries.
          var newEntries = entries.filter(function (entry) {
            return _this2.lastEntryDate === null || _this2.lastEntryDate < entry.pubDate / 1000;
          });

          // Update last entry.
          // It uses newEntries[0] because they are ordered from newer to older.
          if (newEntries.length > 0) {
            _this2.lastEntryDate = newEntries[0].pubDate / 1000;
            _this2.lastEntryTitle = newEntries[0].title;
            _this2.emit('new entries', newEntries);
          }
        })['catch'](function (error) {
          return _this2.emit('error', error);
        });
      };

      // Keep checking every n minutes.
      // It returns the timer so it can be cleared after.
      return setInterval(function () {
        fetch(_this2.feedUrl);
      }, this.interval * 1000);
    }
  }]);

  return Watcher;
})(_events.EventEmitter);

exports['default'] = Watcher;
module.exports = exports['default'];