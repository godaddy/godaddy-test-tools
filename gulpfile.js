'use strict';

require('./lib/index.js')(require('gulp'), {
  lint: {
    eslint: {
      rules: {
        strict: 0
      }
    }
  }
});
