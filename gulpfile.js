'use strict';

module.exports = require('./lib/index.js')(require('gulp'), {
  lint: {
    eslint: {
      fix: true
    }
  }
});
