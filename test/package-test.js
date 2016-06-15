'use strict';

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var async = require('async');
var semver = require('semver');
var jszip = require('jszip');

var chai = require('chai');
chai.should();
chai.use(require('chai-things'));

var projectDir = path.join('/tmp', '/test-project');

var initConfig = {
maven: {
  options: {
      groupId: 'test.project', 
    },
    package: {
      options: {
        goal: 'package',
        src: [ '**', '!node_modules/**' ]
      }
    }
  }
};

// test various package configurations
['package'].forEach(function(target) {
  testPackage(target, 'package.json', { name: 'test-project', version: '1.0.0' });
  testPackage(target, 'package.json', { name: 'test-project', version: '1.0.0-SNAPSHOT', packaging: 'war' });
  testPackage(target, 'package.json', { name: 'test-project', version: '1.0.0', packaging: 'zip' });
  testPackage(target, 'package.json', { name: 'test-project', version: '1.0.0-SNAPSHOT', packaging: 'tgz', mode: 'tgz'});
});

function testPackage(target, versionFile, pkg) {
  describe(target + ' - ' + pkg.version + ':' + pkg.classifier + (pkg.packaging ? ':' + pkg.packaging : '') + ' -', function() {
    before(function(done) {
      async.series([
        function(cb) { setupGruntProject(versionFile, pkg, initConfig, cb); },
        function(cb) { exec('grunt maven:' + target + ' --no-color', done); }
      ], done);
    });
    after(function(done) {
      rimraf(projectDir, done);
    });

    it('should create a package file', function(done) {
      verifyPackageFile(pkg.name, pkg.version, pkg.classifier, pkg.packaging, pkg.mode, done);
    });
  });
}

function exec(command, fn) {
  require('child_process').exec(command, { cwd: projectDir }, function(err, stdout, stderr) {
    if (err) {
      if (stdout) { err.message += '\n' + stdout; }
      if (stderr) { err.message += '\n' + stderr; }
    }
    fn(err, stdout, stderr);
  });
}

function verifyPackageFile(project, version, classifier, packaging, mode, cb) {
  var filename = project + '-' + version + (classifier? '-' + classifier : '') + '.' + getExtension(packaging, classifier, initConfig.maven.options.type);

  fs.readFile(path.join(projectDir, filename),
      function(err, data) {
	if (err) { cb(err); }
    switch(mode) {
      case 'tgz':
        if(!data) {
          cb('File data is null');
        } else if (data.length < 3) {
          cb('tgz package content is too small: ' + data.length);
        } else if (data[0] !== 0x1f) {
          cb('Expect first byte[0x1f], got ' + data[0]);
        } else if (data[1] !== 0x8b) {
          cb('Expect first byte[0x8b], got ' + data[1]);
        } else if (data[2] !== 0x08) {
          cb('Expect first byte[0x08], got ' + data[2]);
        } else {
          cb();
        }
        break;
      default:
        jszip.loadAsync(data).then(function() {
          cb();
        }, cb);
        break;
    }
  });
}

// copy from maven_task
function getExtension(packaging, classifier, type) {
    if(classifier === 'javadoc' || classifier === 'sources') {
      return 'zip';
    }
    return type ||  packaging || 'zip';
  }


function gruntfile(initConfig) {
  return 'var fs = require("fs");\n' +
         'module.exports = function(grunt) {\n' +
         '  grunt.initConfig(' + JSON.stringify(initConfig) + ');\n' +
         '  grunt.loadTasks("' + path.join(__dirname, '..', 'tasks') + '")\n' +
         '};\n';
}

function setupGruntProject(versionFile, pkg, initConfig, fn) {
  var commands = [
    function(cb) { rimraf(projectDir, cb); },
    function(cb) { fs.mkdir(projectDir, cb); },
    function(cb) { fs.writeFile(path.join(projectDir, versionFile), JSON.stringify(pkg), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'Gruntfile.js'), gruntfile(initConfig), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'somefile.txt'), 'somedata', cb); },
    function(cb) { exec('ln -s ' + path.join(__dirname, '..', 'node_modules'), cb); }
  ];
  async.series(commands, fn);
}

