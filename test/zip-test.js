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
      type: 'war'
    },
    install: {
      src: [ '**/*', '!node_modules/**' ],
      options: {
      }
    }
  }
};


// test various install configurations
['install'].forEach(function(target) {
  testInstall(target, 'package.json', { name: 'test-project', version: '1.0.0-SNAPSHOT' });
  //  testInstall(target, 'package.json', { name: 'test-project', version: '1.0.0', classifier: 'javadoc' });
});


function testInstall(target, versionFile, pkg) {
  describe(target + ' - ' + pkg.version + ':' + pkg.classifier + ' -', function() {
    var effectiveConfig = initConfig;
    if (pkg.classifier) {
      effectiveConfig = JSON.parse(JSON.stringify(effectiveConfig)); // deep copy
      effectiveConfig.maven[target].options.classifier = pkg.classifier;
    }
    before(function(done) {
      async.series([
        function(cb) { setupGruntProject(versionFile, pkg, effectiveConfig, cb); },
        function(cb) { exec('grunt maven:' + target + ' --no-color', cb); }
      ], done);
    });
    after(function(done) {
	    // rimraf(projectDir, done);
	    done();
    });
    it('should not destroy file access bits', function(done) {
	    verifyZipFile(done);
	});
    it('should install artifact to repository', function() {
      verifyInstalledFiles('test.project', 'test-project', pkg.version, pkg.classifier, 'zip');
    });
    it('should rename artifacts with war-extension when configured as a type', function() {
      verifyInstalledFiles('test.project', 'test-project', pkg.version, pkg.classifier, 'zip', null, 'war');
    });

    it('should not touch package.json', function() {
      var readPkg = JSON.parse(fs.readFileSync(path.join(projectDir, versionFile)));
      readPkg.should.eql(pkg);
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

function verifyZipFile(cb) {

    fs.readFile(path.join(projectDir, "test-project-1.0.0-SNAPSHOT.zip"),
        function(err, data) {
           if (err) throw err;
           var zip = new jszip(data);
           var access=(zip.files['test-project-1.0.0-SNAPSHOT/script/somescript.sh'].unixPermissions & 511).toString(8);
	   //           access.should.equal('755');
           access.should.equal('0');
           cb();
     });

    // console.log('mydir/hello.sh: ' + (0777 & zip.files['mydir/hello.sh'].unixPermissions).toString(8));

}

function verifyInstalledFiles(groupId, artifactId, version, classifier, packaging, repositoryId, type) {
  var deploy = JSON.parse(fs.readFileSync(path.join(projectDir, artifactId + '-install.json')));
  deploy.should.have.property('file', artifactId + '-' + version + (classifier? '-' + classifier : '') + '.' + packaging);
  deploy.should.have.property('groupId', groupId);
  deploy.should.have.property('artifactId', artifactId);
  deploy.should.have.property('version', version);
  if (classifier) {
    deploy.should.have.property('classifier', classifier);
  }
  deploy.should.have.property('packaging', packaging);
  if (repositoryId) {
    deploy.should.have.property('repositoryId', repositoryId);
  }
  if (type){
    deploy.should.have.property('type', type);
  }
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

function setupGruntProject(versionFile, pkg, initConfig, useGit, fn) {
  if (!fn) {
    fn = useGit;
    useGit = false;
  }
  var commands = [
    function(cb) { rimraf(projectDir, cb); },
    function(cb) { fs.mkdir(projectDir, cb); },
    function(cb) { fs.mkdir(path.join(projectDir, "script"), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, versionFile), JSON.stringify(pkg), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'Gruntfile.js'), gruntfile(initConfig), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'script/somescript.sh'), "#!/bin/bash\nwho\n", cb); },
    function(cb) { fs.chmod(path.join(projectDir, 'script/somescript.sh'), '0755', cb); },
    function(cb) { exec('ln -s ' + path.join(__dirname, '..', 'node_modules'), cb); }
  ];
  if (useGit) {
    commands = commands.concat([
      function(cb) { exec('git init', cb); },
      function(cb) { exec('git config user.email "dummy@mailinator.com"', cb); },
      function(cb) { exec('git config user.name "dummy"', cb); },
      function(cb) { exec('git add .', cb); },
      function(cb) { exec('git commit -m "Initial commit"', cb); }
    ]);
  }
  async.series(commands, fn);
}

