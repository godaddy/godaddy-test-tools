/* eslint no-console: 0, no-sync: 0 */
'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var writeFile = fs.writeFile;
var readFileSync = fs.readFileSync;
var jshint = require('gulp-jshint');
var eslint = require('gulp-eslint');
var jscs = require('gulp-jscs');
var map = require('map-stream');
var through2 = require('through2');
var jshintReporter = map(function (file, cb) {
  if (!file.jshint.success) {
    console.error('JSHINT fail in ' + file.path);
    file.jshint.results.forEach(function (err) {
      if (err) {
        console.error(file.path + ': line ' + err.line + ', col ' +
                      err.character + ', code ' + err.code + ', ' + err.reason);
      }
    });
  }
  cb(null, file);
});

var FILENAME_CONVENTIONS = {
  kebob: /^[a-z][a-z\d]+(-[a-z\d]+)*(\.[a-z\d]+)+/,
  camel: /^[a-z][a-z\d]+([A-Z][a-z\d]+)*(\.[a-z\d]+)+/,
  snake: /^[a-z][a-z_\d]+(\.[a-z\d]+)+/
};

function resolveLintConfigFile(name) {
  return require.resolve('godaddy-style/dist/.' + name + 'rc');
}

function loadLintConfig(name) {
  var configFilePath = resolveLintConfigFile(name);
  var config = readFileSync(configFilePath, { encoding: 'utf-8' });
  return JSON.parse(config);
}

module.exports = function (gulp, options) {
  options = options || {};
  var jscsConfig = _.defaultsDeep(options.jscs || {}, {
    configPath: require.resolve('godaddy-style/dist/.jscsrc')
  });
  jscsConfig.fix = jscsConfig.fix !== false;

  gulp.task('jshint', 'Lint the js files with jshint', function () {
    return gulp.src(options.files)
      .pipe(jshint(_.merge(loadLintConfig('jshint'), options.jshint)))
      .pipe(jshint.reporter('jshint-stylish'))
      .pipe(jshintReporter);
  });

  gulp.task('eslint', 'Lint the js files with eslint', function () {
    var baseConfigPath = resolveLintConfigFile('eslint');
    var eslintOpts = _.merge({ baseConfig: baseConfigPath }, options.eslint);
    return gulp.src(options.files)
      .pipe(eslint(eslintOpts))
      .pipe(eslint.format())
      .pipe(options.eslintFailOnError ? eslint.failOnError() : eslint.failAfterError());
  });

  gulp.task('jscs', 'Run jscs', function () {
    return gulp.src(jscsConfig.files || options.files)
      .pipe(jscs(jscsConfig))
      .pipe(through2.obj(function (file, enc, callback) {
        writeFile(file.path, file._contents, callback);
      }));
  });

  gulp.task('jscs-with-reporting', 'Run jscs and report on unfixable violations', function () {
    return gulp.src(jscsConfig.files || options.files)
      .pipe(jscs(jscsConfig))
      .pipe(jscs.reporter(jscsConfig.reporter))
      .pipe(through2.obj(function (file, enc, callback) {
        writeFile(file.path, file._contents, callback);
      }));
  }, ['carriage-return-fix']);

  gulp.task('carriage-return-fix', 'Remove all \\r from the linted files', function () {
    return gulp.src(options.jscs && options.jscs.file || options.files)
      .pipe(through2.obj(function (file, enc, callback) {
        writeFile(file.path, file._contents.toString().replace(/\r/g, ''), callback);
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
            err = new Error('The file at "' + file.path + '" violates the ' + options.filenameConvention.type + ' naming convention.');
          }
          return void callback(err);
        }));
    }
    return void 0;
  });

  gulp.task('lint', 'Lint the js files', options.linters || [options.default || 'eslint', 'jscs']);
};

