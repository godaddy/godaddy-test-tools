'use strict';

var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawnSync;
var isWindows = /^win/.test(process.platform);
var npmCmd = isWindows
  ? 'npm.cmd'
  : 'npm';

var BASEDIR = process.cwd();
var NODE_MODULES = path.join(BASEDIR, 'node_modules');
var SHRINKWRAP = path.join(BASEDIR, 'npm-shrinkwrap.json');

// credit to https://github.com/isaacs/rimraf
function rimrafSync (p) {
  try {
    var stats = fs.lstatSync(p);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return;
    }
  }
  try {
    if (stats && stats.isDirectory()) {
      rmdirSync(p)
    } else {
      fs.unlinkSync(p);
    }
  } catch (e) {
    var code = e.code;
    if (code === 'ENOENT') {
      return;
    }
    if (code === 'EPERM') {
      return isWindows
        ? fixWinEPERMSync(p, e)
        : rmdirSync(p, e);
    }
    if (code !== 'EISDIR') {
      throw e;
    }
    rmdirSync(p, e);
  }
}

function rmdirSync (p, err) {
  try {
    fs.rmdirSync(p);
  } catch (e) {
    var code = e.code;
    if (code === 'ENOENT') {
      return;
    }
    if (code === 'ENOTDIR') {
      throw err;
    }
    if (code === 'ENOTEMPTY' || code === 'EEXIST' || code === 'EPERM') {
      rmkidsSync(p);
    }
  }
}

function fixWinEPERMSync (p, err) {
  try {
    fs.chmodSync(p, 666)
  } catch (e) {
    if (e.code === 'ENOENT') {
      return;
    }
    throw err;
  }

  try {
    var stats = fs.statSync(p)
  } catch (e) {
    if (e.code === 'ENOENT') {
      return;
    }
    throw err;
  }

  if (stats.isDirectory()) {
    rmdirSync(p, err);
  } else {
    fs.unlinkSync(p);
  }
}

function rmkidsSync (p) {
  fs.readdirSync(p).forEach(function (f) {
    rimrafSync(path.join(p, f));
  });
  fs.rmdirSync(p);
}


function npm (cmd) {
  var result = spawn(npmCmd, cmd.split(' '), { cwd: BASEDIR, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status);
  }
  return result;
}

function gitDep (rep) {
  return /^git/.test(rep);
}

function replacer (key, val) {
  if (!this.version) {
    return val;
  }
  if (key === "from" && !gitDep(this.resolved)) {
    return undefined;
  }
  if (key === "resolved" && !gitDep(val) && this.from !== val) {
    return undefined;
  }
  return val;
}

module.exports = function (options) {
  if (!options.format) {
    if (!options.existing) {
      gutil.log('removing "node_modules"');
      rimrafSync(NODE_MODULES);
    }
    gutil.log('removing "npm-shrinkwrap.json"');
    rimrafSync(SHRINKWRAP);
    gutil.log('installing');
    npm('install --silent');
    gutil.log('shrinkwrapping');
    npm('shrinkwrap --dev');
  }

  // credit to https://github.com/skybet/shonkwrap
  fs.writeFileSync(SHRINKWRAP, JSON.stringify(require(SHRINKWRAP), replacer, 2));
};

