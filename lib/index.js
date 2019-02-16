/* eslint no-process-env: 0, no-console: 0, max-statements: 0, no-sync: 0 */
'use strict';

var argv = require('yargs').argv;
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var gulpMocha = require('gulp-mocha');
var log = require('fancy-log');
var _ = require('lodash');
var styleguide = require('./godaddy-style');
var notifier = require('node-notifier');
var del = require('del');
var sonar = require('gulp-sonar2');
var shrinkwrapper = require('./shrinkwrapper');

var SOURCE_FILES = ['lib/**/*.js'],
  UNIT_FILES   = ['test/unit/**/*.js'],
  INTEGRATION_FILES = ['test/integration/**/*.js'];

var mochaIcon = require.resolve('../assets/mocha.png');

module.exports = function (gulp, options) {
  options = _.defaultsDeep(options || {}, {
    sourceFiles: SOURCE_FILES,
    unitTestFiles: UNIT_FILES,
    integrationTestFiles: INTEGRATION_FILES,
    lint: {
      eslint: {}
    },
    mocha: {
      reporter: process.env.MOCHA_REPORTER || 'spec'
    },
    shrinkwrap: {
      removeExisting: false,
      onlyFormat: false,
      dev: true
    }
  });

  junitOutput(options);

  // allows command line arguments to modify the options object
  // ex: gulp test --mocha.grep @production-only --mocha.invert
  // -- options.mocha == { grep: '@production-only', invert: true }
  _.each(argv, (value, name) => {
    if (name === '_' || name === '$0') return;
    options[name] = _.merge(options[name] || {}, value);
  });

  if (!options.allowUnhandledRejections) {
    process.on('unhandledRejection', function (e) {
      // no swallowed Promise errors
      throw e;
    });
  }

  var lintOptions = options.lint;
  lintOptions.files = _.flattenDeep(lintOptions.files || [
    options.sourceFiles,
    options.unitTestFiles,
    options.integrationTestFiles,
    'index.js',
    'main.js',
    'gulpfile.js',
    'gulpfile.babel.js',
    'config/**/*.json',
    'config/**/*.js',
    'lib/**/*.json',
    'scripts/**/*.js',
    'scripts/**/*.json',
    'test/**/*.json'
  ]);
  const styleTasks = styleguide(gulp, lintOptions);

  shrinkwrap.description = 'Shrinkwrap the existing node modules.';
  function shrinkwrap(cb) {
    shrinkwrapper(options.shrinkwrap);
    cb();
  }

  unit.description = 'Run unit tests';
  function unit() {
    return runMocha(options.unitTestFiles);
  }

  integration.description = 'Run integration tests';
  function integration() {
    return runMocha(options.integrationTestFiles);
  }

  mocha.description = 'Run all tests without code coverage';
  function mocha() {
    return runMocha(_.flattenDeep([options.unitTestFiles, options.integrationTestFiles]));
  }

  const test = gulp.series([styleTasks.lint, unit, integration]);
  test.displayName = 'test';
  test.description = 'Run all the tests with code coverage';

  const defaultTask = gulp.parallel([test]);
  defaultTask.displayName = 'default';
  defaultTask.description = 'Use --no-notify to turn off OS notifications of success and failure.';

  watch.description = 'Watch files for changes and invoke mocha when one changes.';
  function watch() {
    var watchFiles = _.flattenDeep([options.sourceFiles, options.unitTestFiles, options.integrationTestFiles]);
    var watcher = gulp.watch(options.watchFiles || watchFiles);
    var testFiles = _.flattenDeep([options.unitTestFiles, options.integrationTestFiles]);

    runMocha(testFiles);

    watcher.on('change', function (event) {
      notify({
        title: 'Changed: ' + event.path,
        message: 'Running mocha...'
      });

      runMocha(testFiles);
    });
  }

  sonar.description = 'Run sonar';

  clean.description = 'Clean up unnecessary files';
  function clean(cb) {
    del(options.filesToClean || ['./build', '.sonar']).then(function () {
      cb();
    });
  }

  const build = gulp.series([clean, test]);
  build.displayName = 'build';
  build.description = 'Run the clean and test tasks';

  const full = gulp.series([build, sonarTask]);
  full.displayName = 'full';
  full.description = 'Run the build and sonar tasks';

  function runMocha(files) {
    return new Promise(function (resolve, reject) {
      const stream = gulp.src(files, _.merge({ read: false, allowEmpty: true }, options)).pipe(gulpMocha(options.mocha));
      stream.on('error', function (err) {
        notify({
          title: 'Test error!',
          message: 'There was an error in the tests for ' + files + '.\n' + (err && err.stack || err),
          icon: mochaIcon
        });
        reject(err);
      });
      stream.once('end', function () {
        notify({
          title: 'Tests complete!',
          message: 'The tests for ' + files + ' have finished.',
          icon: mochaIcon
        });
        resolve();
      });
    });
  }

  function sonarTask() {
    var config = _.merge({
      sonar: {
        host: {
          url: argv.sonarUrl || 'http://localhost:9000'
        },
        sources: 'lib',
        language: 'js',
        sourceEncoding: 'UTF-8',
        javascript: {
          lcov: {
            reportPath: './build/coverage/lcov.info'
          }
        }
      }
    }, options.sonar);

    return gulp.src('thisFileDoesNotExist.js', { read: false, allowEmpty: true })
      .pipe(sonar(config))
      .on('error', log);
  }

  return Object.assign({}, styleTasks, {
    shrinkwrap,
    default: defaultTask,
    unit,
    integration,
    mocha,
    test,
    watch,
    sonar,
    clean,
    build,
    full
  });
};

function notify(options) {
  log(options.title + ': ' + options.message);
  if (!argv.noNotify) {
    notifier.notify(options);
  }
}

function junitOutput(opts) {
  if (opts.junit) {
    // handle the test output
    var file = typeof opts.junit === 'string' ? opts.junit : (process.env.MOCHA_FILE || './build/test/test-results.xml');
    var dir = path.dirname(file);
    if (!fs.existsSync(dir)) mkdirp.sync(dir, 0o777);
    opts.mocha.reporter = 'mocha-junit-reporter';
    opts.mocha.reporterOptions = { mochaFile: file };

    // set the eslint junit handling as well
    file = typeof opts.junit === 'string' ? opts.junit : (process.env.ESLINT_FILE || './build/test/eslint-results.xml');
    dir = path.dirname(file);
    if (!fs.existsSync(dir)) mkdirp.sync(dir, 0o777);
    opts.lint.eslint.formatter = 'junit';
    opts.lint.eslint.formatterFunction = function (data) { fs.writeFile(file, data); };
  }
}

