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
var relScriptFile = path.join('script','somescript.sh');
var scriptDir = path.join(projectDir, 'script');
var scriptFile = path.join(scriptDir, 'somescript.sh');

var initConfig = {
  maven: {
    options: {
      groupId: 'test.project',
      type: 'war'
    },
    install: {
      src: [ '**/*', '!node_modules/**' ],
      options: {
      }
    }
  }
};


describe('Test that correct access bits are set', function() {
  var effectiveConfig = initConfig;
  var pkg={ name: 'test-project', version: '1.0.0-SNAPSHOT' };
  var target='install';
  var versionFile='package.json';

  before(function(done) {
    async.series([
      function(cb) { setupGruntProject(versionFile, pkg, effectiveConfig, cb); },
      function(cb) { exec('grunt maven:' + target + ' --no-color', cb); }
    ], done);
  });
  after(function(done) {
    rimraf(projectDir, done);
    //done();
  });
  it('should not destroy file access bits', function(done) {
    verifyZipFile("test-project-1.0.0-SNAPSHOT", done);
  });
});


function exec(command, fn) {
  require('child_process').exec(command, { cwd: projectDir }, function(err, stdout, stderr) {
    if (err) {
      if (stdout) { err.message += '\n' + stdout; }
      if (stderr) { err.message += '\n' + stderr; }
    }
    fn(err, stdout, stderr);
  });
}

function verifyZipFile(project, cb) {

  fs.readFile(path.join(projectDir, project + ".zip"),
	      function(err, data) {
		if (err) throw err;
		var zip = new jszip(data);
		//           var access=(zip.files['test-project-1.0.0-SNAPSHOT/script/somescript.sh'].unixPermissions & 511).toString(8);
		var access=(zip.files[project + '/' + relScriptFile].unixPermissions & 511).toString(8);
	        access.should.equal('755');
		//access.should.equal('0');
		cb();
	      });
}


function gruntfile(initConfig) {
  return 'var fs = require("fs");\n' +
    'module.exports = function(grunt) {\n' +
    '  grunt.initConfig(' + JSON.stringify(initConfig) + ');\n' +
    '  grunt.loadTasks("' + path.join(__dirname, '..', 'tasks') + '")\n' +
    '  grunt.registerTask("maven:install-file", function() {\n' +
    '    var options = grunt.config("maven.install-file.options");\n' +
    '    fs.writeFileSync(options.artifactId + "-install.json", JSON.stringify(options));\n' +
    '  });\n' +
    '};\n';
}

function setupGruntProject(versionFile, pkg, initConfig, fn) {
  var commands = [
    function(cb) { rimraf(projectDir, cb); },
    function(cb) { fs.mkdir(projectDir, cb); },
    function(cb) { fs.mkdir(scriptDir, cb); },
    function(cb) { fs.writeFile(path.join(projectDir, versionFile), JSON.stringify(pkg), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'Gruntfile.js'), gruntfile(initConfig), cb); },
    function(cb) { fs.writeFile(scriptFile, "#!/bin/bash\nwho\n", cb); },
    function(cb) { fs.chmod(scriptFile, '0755', cb); },
    function(cb) { exec('ln -s ' + path.join(__dirname, '..', 'node_modules'), cb); }
  ];
  async.series(commands, fn);
}

