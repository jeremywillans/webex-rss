(function() {
  module.exports = function(url, callback) {
    var FeedParser, domain, options, request, rss;
    FeedParser = require('feedparser');
    request = require('postman-request');
    options = {
      normalize: false,
      addmeta: true,
      feedurl: url
    };
    rss = [];
    domain = require('domain').create();
    domain.on('error', function(e) {
      return callback(e, null);
    });
    return domain.run(function() {

      /* Module Initialize */
      var feedParser, req;
      const reqOptions = {
        headers: {
          'User-Agent': 'request'
        }
      };
      req = request(url, reqOptions);
      feedParser = new FeedParser([options]);

      /* REQUEST */
      req.on('error', function(err) {
        return callback(err, null);
      });
      req.on('response', function(res) {
        var stream;
        stream = this;
        if (res.statusCode !== 200) {
          return this.emit('error', new Error('Bad status code'));
        }
        return stream.pipe(feedParser);
      });

      /* FEEDPARSER */
      feedParser.on('error', function(err) {
        return callback(err, null);
      });
      feedParser.on('readable', function() {
        var item, stream;
        stream = this;
        if (item = stream.read()) {
          return rss.push(item);
        }
      });
      return feedParser.on('end', function() {
        if (rss.length === 0) {
          return callback('no articles');
        }
        return callback(null, rss);
      });
    });
  };

}).call(this);
