/* eslint no-console: 0, no-sync: 0 */
'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var eslint = require('gulp-eslint');
var through2 = require('through2');

var FILENAME_CONVENTIONS = {
  kebob: /^[a-z][a-z\d]+(-[a-z\d]+)*(\.[a-z\d]+)+/,
  camel: /^[a-z][a-z\d]+([A-Z][a-z\d]+)*(\.[a-z\d]+)+/,
  snake: /^[a-z][a-z_\d]+(\.[a-z\d]+)+/
};

module.exports = function (gulp, options) {
  options = options || {};

  gulp.task('jshint', 'Lint the js files with jshint', function () {
    console.log('jshint is deprecated');
  });

  gulp.task('eslint', 'Lint the js files with eslint', function () {
    var version = !options.es6 ? '-es5' : '';
    var eslintOpts = _.defaultsDeep({}, options.eslint, {
      baseConfig: {
        extends: [
          'godaddy' + version,
          'godaddy-react'
        ].concat(options.eslint.extends || [])
      }
    });
    return gulp.src(options.files)
      .pipe(eslint(eslintOpts))
      .pipe(eslint.format(eslintOpts.formatter, eslintOpts.formatterFunction))
      .pipe(eslint[eslintOpts.fail || 'failAfterError']());
  });

  gulp.task('jscs', 'Run jscs', ['eslint'], function () {
    console.log('jscs is deprecated. Please use eslint.');
  });

  gulp.task('carriage-return-fix', 'Remove all \\r from the linted files', function () {
    return gulp.src(options.files)
      .pipe(through2.obj(function (file, enc, callback) {
        fs.writeFile(file.path, file._contents.toString().replace(/\r/g, ''), callback);
      }));
  });

  var filenameDescription = 'Specify a file naming convention for your linted files in options. ' +
      Object.keys(FILENAME_CONVENTIONS);
  gulp.task('filename-convention', filenameDescription, function () {
    if (options.filenameConvention) {
      var checker = FILENAME_CONVENTIONS[options.filenameConvention.type];
      var exclude = options.filenameConvention.exclude || /\?/;
      return gulp.src(options.filenameConvention.files || options.files)
        .pipe(through2.obj(function (file, enc, callback) {
          var basename = path.basename(file.path);
          var err;
          if (!exclude.test(file.path) && !checker.test(basename)) {
            err = new Error('The file at "' + file.path + '" violates the ' +
                            options.filenameConvention.type + ' naming convention.');
          }
          return void callback(err);
        }));
    }
    return void 0;
  });

  gulp.task('lint', 'Lint the js files', options.linters || [options.default || 'eslint']);
};

