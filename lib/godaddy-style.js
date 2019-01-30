/* eslint no-console: 0, no-sync: 0 */
'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var gulpEslint = require('gulp-eslint');
var through2 = require('through2');

var FILENAME_CONVENTIONS = {
  kebob: /^[a-z][a-z\d]+(-[a-z\d]+)*(\.[a-z\d]+)+/,
  camel: /^[a-z][a-z\d]+([A-Z][a-z\d]+)*(\.[a-z\d]+)+/,
  snake: /^[a-z][a-z_\d]+(\.[a-z\d]+)+/
};

module.exports = function (gulp, options) {
  options = options || {};

  eslint.description = 'Lint the js files with eslint';
  function eslint() {
    var eslintOpts = _.defaultsDeep({}, options.eslint);
    return gulp.src(options.files, { allowEmpty: true })
      .pipe(gulpEslint(eslintOpts))
      .pipe(through2.obj(function (file, enc, callback) {
        if (options.eslint.fix && file.eslint.fixed) {
          return fs.writeFile(file.path, file.eslint.output, function (err) { callback(err, file); });
        }
        callback(null, file);
      }))
      .pipe(gulpEslint.format(eslintOpts.formatter, eslintOpts.formatterFunction))
      .pipe(gulpEslint[eslintOpts.fail || 'failAfterError']());
  }

  crFix.displayName = 'carriage-return-fix';
  crFix.description = 'Remove all \\r from the linted files';
  function crFix() {
    return gulp.src(options.files, { allowEmpty: true })
      .pipe(through2.obj(function (file, enc, callback) {
        fs.writeFile(file.path, file._contents.toString().replace(/\r/g, ''), callback);
      }));
  }

  const conventions = Object.keys(FILENAME_CONVENTIONS);
  filenameConvention.displayName = 'filename-convention';
  filenameConvention.description = `'Specify a file naming convention for your linted files in options. ${conventions}`;
  function filenameConvention() {
    if (options.filenameConvention) {
      var checker = FILENAME_CONVENTIONS[options.filenameConvention.type];
      var exclude = options.filenameConvention.exclude || /\?/;
      return gulp.src(options.filenameConvention.files || options.files, { allowEmpty: true })
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
  }

  const lint = gulp.parallel(options.linters || [options.default || eslint]);
  lint.displayName = 'lint';
  lint.description = 'Lint the js files';

  return {
    eslint,
    crFix,
    filenameConvention,
    lint
  };
};
