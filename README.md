# godaddy-test-tools

`gulp` tools for testing node libraries with mocha and istanbul as well as linting using [`godaddy-style`](https://github.com/godaddy/javascript).

### Usage
```
npm install --save-dev godaddy-test-tools
```

Also install one of the configuration packages part of the https://github.com/godaddy/javascript project.
Choosing the configuration package depends on what packages your project will use.

... add the package to your `gulpfile.js`
```js
'use strict';

var gulp = require('gulp');
module.exports = require('godaddy-test-tools')(gulp, {
  // change any of the options listed below as needed
});

// define other gulp tasks or override already defined tasks as desired
```

... or `gulpfile.babel.js` if you are using ES6
```js
import testTools from 'godaddy-test-tools';
import gulp from 'gulp';

module.exports = testTools(gulp, {
  // change any of the options listed below as needed
});

```

Running `gulp --tasks` will show all the tasks and a description (if provided) for each of the tasks.


### Options
 - junit: Use junit reporting for the currently run task and output to the specified file. If has a string value, it will be interpretted
   as the file where the results should be written, if simply present, the argument will trigger the junit default file at
   `./build/test/*-results.xml`. This options is currently supported by unit, integration, and eslint tasks.
 - allowUnhandledRejections: The test tools will not throw an exception when a promise has an unresolved rejection. Defaults to `false`.
 - sourceFiles: The source files that will be watched or tested. default: `lib/**/*.js`
 - unitTestFiles: A glob-able path(s) to all the unit test files. default: `test/unit/**/*.js`
 - integrationTestFiles: A glob-able path(s) to all the integration test files. defaut: `test/integration/**/*.js`
 - mocha: Options for [`mocha`](https://mochajs.org/#command-line-usage), note all keys in the options will be prefixed with `--` to map to the CLI flag. Example `{ require: ['@babel/register'] }` will convert to `--require "@babel/register"`.
 - watchFiles: default: `[sourceFiles, unitTestFiles, integrationTestFiles]`
 - shrinkwrap:
    - removeExisting: remove the existing files by default, default: false
    - onlyFormat: only remove the artifacts from the existing npm-shrinkwrap.json file, default: false
    - dev: include devDependencies in shrinkwrap, default: true
    - file: the path to the shrinkwrap file. default: ./package-lock.json
 - lint:
    - filenameConvention: example: `{ type: (kebob, snake, camel), exclude: /regex/, files: ['lib/**/*.js', 'test/**/*.js'] }`
    - files: a list of glob-able file paths to include in the lint checks.
        default:
        ```js
          [
            sourceFiles,
            unitTestFiles,
            integrationTestFiles,
            'index.js',
            'main.js',
            'gulpfile.js',
            'gulpfile.babel.js',
            'config/**/*.json',
            'config/**/*.js',
            'lib/**/*.json',
            'test/**/*.json'
          ]
        ```
    - eslint: the argument passed to [`gulp-eslint`](https://www.npmjs.com/package/gulp-eslint). default: `require.resolve('godaddy-style/dist/es5/.eslintrc')`.
    - default: change the default linter from `eslint`
    - linters: change which linters are run when calling `gulp lint`
    - eslintFailOnError: failure after the first lint error is found.
        default: fail after all files have been linted

Options can be modified from the command line using dot separated
argument names. i.e.: `gulp unit --mocha.grep '@production'` will set
the `grep` value of the `mocha` options.

This tool defaults to a specific folder structure, but the options above
allow for configuring that as needed:

```
your-project/
  build/
  lib/
  test/
    unit/
    integration/
```

Additionally, this project will send system notifications through
[`node-notifier`](https://www.npmjs.com/package/node-notifier) when
there are errors in your tests and when tests have run successfully unless
you pass the `--no-notify` option.

### Changelog

17.0.0:
* The watch command no longer exits if errors are encountered in tests

16.0.0:
* Due to dependency bumps for security fixes, node 8 is no-longer supported; official support is now declared to be node 10 or above.

15.0.0:
* This was an erroneous major version bump

14.0.0:
* Replace `gulp-mocha` with calling `mocha` directly via [cross-spawn](https://www.npmjs.com/package/cross-spawn). Consumer must have `mocha` installed and all setup requirements must be defined in the mocha [options](#options).
```js
// mocha@5+
mocha: {
  ...
  file: "test/unit/global-hooks.js" // setup loaded prior to root suite execution
}
```

12.0.2:
* Use _result instead of end event for identifying the tests have
  completed

12.0.1:
* When tests fail, the process should throw the error instead of only
  displaying it in stdout/stderr

12.x.x:
* Gulp 4 is now required
* Code coverage tasks are removed and [nyc](https://www.npmjs.com/package/nyc) package is recommended
* You must now export the tasks returned by this function in your gulpfile
* `gulp help` no-longer works; use `gulp --tasks` to see available tasks

9.x.x:
* No `baseConfig` is defined by default anymore. Please extend the appropriate `eslint-config` package on your `eslintrc` file.
* `es6` option was removed and became the default. This also means that the `istanbul.instrumenter` option became the `isparta.Instrumenter` by default. If you want to keep the previous behavior, you can pass the `{ istanbul: { instrumenter: null } }` as option.
* Removing `jscs` and `jshint` tasks. They were already not doing anything.

