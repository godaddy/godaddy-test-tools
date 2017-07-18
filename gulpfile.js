'use strict';

require('./lib/index.js')(require('gulp'), {
  lint: {
    eslint: {
      fix: true
    }
  }
});
