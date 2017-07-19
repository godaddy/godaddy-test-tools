/* eslint no-process-env: 0, no-console: 0, max-statements: 0, no-sync: 0 */
'use strict';

var argv = require('yargs').argv;
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var gulpHelp = require('gulp-help');
var istanbul = require('gulp-istanbul');
var isparta = require('isparta');
var mocha = require('gulp-mocha');
var util = require('gulp-util');
var _ = require('lodash');
var styleguide = require('./godaddy-style');
var notifier = require('node-notifier');
var del = require('del');
var once = require('one-time');
var sonar = require('gulp-sonar');
var spawn = require('child_process').spawn;
var shrinkwrapper = require('./shrinkwrapper');

var SOURCE_FILES = ['lib/**/*.js'],
  UNIT_FILES   = ['test/unit/**/*.js'],
  INTEGRATION_FILES = ['test/integration/**/*.js'];

var mochaIcon = require.resolve('../assets/mocha.png');

module.exports = function (gulp, options) {
  gulp = gulpHelp(gulp);

  options = _.defaultsDeep(options || {}, {
    sourceFiles: SOURCE_FILES,
    unitTestFiles: UNIT_FILES,
    integrationTestFiles: INTEGRATION_FILES,
    istanbul: {
      includeUntested: true,
      thresholds: {},
      dir: './build/coverage',
      reportOpts: { dir: './build/coverage' },
      reporters: ['lcov', 'json', 'text', 'text-summary', 'cobertura']
    },
    es6: true,
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

  if (options.es6) {
    options.lint.es6 = true;
    options.istanbul.instrumenter = isparta.Instrumenter;
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

  styleguide(gulp, lintOptions);

  gulp.task('shrinkwrap', 'Shrinkwrap the existing node modules.', function () {
    shrinkwrapper(options.shrinkwrap);
  });

  gulp.task('default', 'Use --no-notify to turn off OS notifications of success and failure.', ['test']);

  gulp.task('unit', 'Run unit tests', function (cb) {
    runMocha(options.unitTestFiles, cb);
  });

  gulp.task('integration', 'Run integration tests', function (cb) {
    runWithDependencyProcess(runMocha, options.integrationTestFiles, cb);
  });

  gulp.task('unit-coverage', 'Run all the unit tests with code coverage', unitCoverage);

  gulp.task('integration-coverage', 'Run all the integration tests with code coverage', integrationCoverage);

  gulp.task('mocha', 'Run all tests without code coverage', function (cb) {
    runWithDependencyProcess(runMocha, _.flattenDeep([options.unitTestFiles, options.integrationTestFiles]), cb);
  });

  gulp.task('test', 'Run all the tests with code coverage', ['lint'], function (cb) {
    unitCoverage(function (e) {
      if (e) return void cb(e);
      integrationCoverage(cb);
    });
  });

  gulp.task('combined-test', 'Run all the tests with code coverage at same time', ['lint'], testCoverage);

  var description = 'Watch files for changes and invoke mocha when one changes.';
  gulp.task('watch', description, function () {
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
  });

  gulp.task('sonar', 'Run sonar', sonarTask);

  gulp.task('clean', 'Clean up unnecessary files', function (cb) {
    del(options.filesToClean || ['./build', '.sonar']).then(function () {
      cb();
    });
  });

  gulp.task('build', 'Run the clean and test tasks', ['clean', 'test']);

  gulp.task('full', 'Run the build and sonar tasks', ['build'], sonarTask);

  function runMocha(files, cb) {
    var done = once(cb || function () {});

    return gulp.src(files, _.merge({ read: false }, options))
      .pipe(mocha(options.mocha))
      .on('error', function (err) {
        notify({
          title: 'Test error!',
          message: 'There was an error in the tests for ' + files + '.\n' + (err && err.stack || err),
          icon: mochaIcon
        });

        done(err);
      })
      .once('end', function () {
        notify({
          title: 'Tests complete!',
          message: 'The tests for ' + files + ' have finished.',
          icon: mochaIcon
        });

        done();
      });
  }

  function runIstanbul(files, cb) {
    var done = once(cb || function () {});
    return gulp.src(options.sourceFiles)
      .pipe(istanbul(options.istanbul))
      .pipe(istanbul.hookRequire())
      .on('finish', function () {
        runMocha(files, function (err) {
          if (err) return done(err);
        })
          .pipe(istanbul.writeReports(options.istanbul))
          .pipe(istanbul.enforceThresholds(options.istanbul))
          .on('error', function (err) {
            notify({
              title: 'Istanbul test error!',
              message: 'There was an error in the tests for ' + files + '.\n' + (err && err.stack || err)
            });
            done(err);
          })
          .once('end', function () {
            notify({
              title: 'Istanbul tests complete!',
              message: 'The tests for ' + files + ' have finished.'
            });
            done();
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

    return gulp.src('thisFileDoesNotExist.js', { read: false })
      .pipe(sonar(config))
      .on('error', util.log);
  }

  function runWithDependencyProcess(runner, files, cb) {
    var opts = options.dependencyProcess;
    if (!opts) {
      return void runner(files, cb);
    }
    return void createChildProcess(opts, function (err, child) {
      if (err) throw err;
      runner(files, function (err1) {
        child.send('close');
        cb(err1);
      });
    });
  }

  function createChildProcess(opts, cb) {
    notify({ title: opts.name, message: 'Starting...' });
    var child = spawn(opts.command, opts.args, { stdio: [process.stdin, process.stdout, process.stderr, 'ipc'] });
    child.on('message', function (data) {
      if (data === 'started') {
        return void cb(null, child);
      }
      return void 0;
    });
    child.on('error', function (err) {
      notify({ title: opts.name, message: 'Error: ' + JSON.stringify(err) });
    });
    child.on('exit', function () {
      notify({ title: opts.name, message: 'Exited' });
    });
  }

  function testCoverage(cb) {
    runWithDependencyProcess(runIstanbul, _.flattenDeep([options.unitTestFiles, options.integrationTestFiles]), cb);
  }

  function integrationCoverage(cb) {
    runWithDependencyProcess(runIstanbul, options.integrationTestFiles, cb);
  }

  function unitCoverage(cb) {
    runIstanbul(options.unitTestFiles, cb);
  }
};

function notify(options) {
  util.log(options.title + ': ' + options.message);
  if (!argv.noNotify) {
    notifier.notify(options);
  }
}

function junitOutput(opts) {
  if (argv.junit) {
    // handle the test output
    var file = typeof argv.junit === 'string' ? argv.junit : (process.env.MOCHA_FILE || './build/test/test-results.xml');
    var dir = path.dirname(file);
    if (!fs.existsSync(dir)) mkdirp.sync(dir, 0o777);
    opts.mocha.reporter = 'mocha-junit-reporter';
    opts.mocha.reporterOptions = { mochaFile: file };

    // set the eslint junit handling as well
    file = typeof argv.junit === 'string' ? argv.junit : (process.env.ESLINT_FILE || './build/test/eslint-results.xml');
    dir = path.dirname(file);
    if (!fs.existsSync(dir)) mkdirp.sync(dir, 0o777);
    opts.lint.eslint.formatter = 'junit';
    opts.lint.eslint.formatterFunction = function (data) { fs.writeFile(file, data); };
  }
}

