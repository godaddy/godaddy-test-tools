/* eslint no-sync: 0 */
'use strict';

var gutil = require('gulp-util');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var spawn = require('child_process').spawnSync;
var npmCmd = 'npm';

var BASEDIR = process.cwd();
var NODE_MODULES = path.join(BASEDIR, 'node_modules');
var PACKAGE_LOCK = path.join(BASEDIR, 'package-lock.json');


function npm(cmd) {
  var result = spawn(npmCmd, cmd.split(' '), { cwd: BASEDIR, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status); // eslint-disable-line no-process-exit
  }
  return result;
}

function gitDep(rep) {
  return /^git/.test(rep);
}

function replacer(key, val) {
  /* eslint no-invalid-this: 0 */
  if (!this.version) {
    return val;
  }
  if (key === 'from' && !gitDep(this.resolved)) {
    return void (0);
  }
  if (key === 'resolved' && !gitDep(val) && this.from !== val) {
    return void (0);
  }
  return val;
}

module.exports = function (options) {
  const file = options.file || PACKAGE_LOCK;
  if (!options.onlyFormat) {
    if (options.removeExisting) {
      gutil.log('removing "node_modules"');
      rimraf.sync(NODE_MODULES);
    }
    gutil.log('removing package-lock file');
    rimraf.sync(file);
    gutil.log('installing');
    npm('install --silent');
    gutil.log('shrinkwrapping');
    npm('shrinkwrap' + (options.dev ? ' --dev' : ''));
    gutil.log('done!');
  }

  // credit to https://github.com/skybet/shonkwrap
  fs.writeFileSync(file, JSON.stringify(require(file), replacer, 2));
};

