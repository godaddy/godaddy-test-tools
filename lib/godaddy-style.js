/* eslint no-console: 0, no-sync: 0 */
'use strict';

var _ = require('lodash');
var fs = require('fs');
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
  options.files = options.files || ['lib/**/*.js', 'test/**/*.js', 'index.js', 'main.js', 'gulpfile.js', 'gulpfile.babel.js'];

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
    var config = _.defaultsDeep(options.jscs || {}, {
      configPath: require.resolve('godaddy-style/dist/.jscsrc')
    });

    config.fix = config.fix !== false;
    return gulp.src(options.files)
      .pipe(jscs(config))
      .pipe(jscs.reporter())
      .pipe(jscs.reporter('fail'))
      .pipe(through2.obj(function (file, enc, callback) {
        writeFile(file.path, file._contents, callback);
      }));
  });

  gulp.task('lint', 'Lint the js files', options.linters || [options.default || 'eslint', 'jscs']);
};

