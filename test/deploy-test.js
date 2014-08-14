'use strict';

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var async = require('async');
var semver = require('semver');

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
    src: [ '**', '!node_modules/**' ],
    install: {
      options: {
      }
    },
    installBower: {
      options: {
        goal: 'install',
        versionFile: 'bower.json'
      }
    },
    deploy: {
      options: {
        url: 'file://repo'
      }
    },
    deployWithGoal: {
      options: {
        goal: 'deploy',
        url: 'file://repo'
      }
    },
    deployBower: {
      options: {
        goal: 'deploy',
        url: 'file://repo',
        versionFile: 'bower.json'
      }
    },
    release: {
      options: {
        url: 'file://repo'
      }
    },
    releaseWithGoal: {
      options: {
        goal: 'release',
        url: 'file://repo'
      }
    }
  }
};

// test various deploy configurations
['deploy', 'deployWithGoal'].forEach(function(target) {
  testDeploy(target, 'package.json', { name: 'test-project', version: '1.0.0-SNAPSHOT' });
  testDeploy(target, 'package.json', { name: 'test-project', version: '1.0.0', classifier: 'javadoc' });
});

// test various install configurations
['install'].forEach(function(target) {
  testInstall(target, 'package.json', { name: 'test-project', version: '1.0.0-SNAPSHOT' });
  testInstall(target, 'package.json', { name: 'test-project', version: '1.0.0', classifier: 'javadoc' });
});

// test various release configurations, with and without git support
['release', 'releaseWithGoal'].forEach(function(target) {
  describe(target, function() {
    [false, true].forEach(function(withGit) {
      describe(withGit ? '(with git support) -' : '-', function() {
        testRelease('maven:' + target + '', { current: '1.0.0-SNAPSHOT', release: '1.0.0', next: '1.1.0-SNAPSHOT', withGit: withGit });
        testRelease('maven:' + target + ':2.0.0', { current: '1.0.0-SNAPSHOT', release: '2.0.0', next: '2.1.0-SNAPSHOT', withGit: withGit });
        testRelease('maven:' + target + ':major', { current: '1.0.0-SNAPSHOT', release: '1.0.0', next: '2.0.0-SNAPSHOT', withGit: withGit });
        testRelease('maven:' + target + ':1.0.1:patch', { current: '1.0.0-SNAPSHOT', release: '1.0.1', next: '1.0.2-SNAPSHOT', withGit: withGit });
      });
    });
  });
});

// Test bower targets
['deployBower'].forEach(function(target) {
  testDeploy(target, 'bower.json', { name: 'test-project', version: '1.0.0-SNAPSHOT' });
});
['installBower'].forEach(function(target) {
  testInstall(target, 'bower.json', { name: 'test-project', version: '1.0.0-SNAPSHOT' });
});

function testDeploy(target, versionFile, pkg) {
  describe(target + ' - ' + pkg.version + ':' + pkg.classifier + ' -', function() {
    var effectiveConfig = initConfig;
    if (pkg.classifier) {
      effectiveConfig = JSON.parse(JSON.stringify(effectiveConfig)); // deep copy
      effectiveConfig.maven[target].options.classifier = pkg.classifier;
    }
    before(function(done) {
      async.series([
        function(cb) { setupGruntProject(versionFile, pkg, effectiveConfig, cb); },
        function(cb) { exec('grunt maven:' + target + ' --no-color', done); }
      ], done);
    });
    after(function(done) {
      rimraf(projectDir, done);
    });

    it('should deploy artifact to repository', function() {
      verifyDeployedFiles('test.project', 'test-project', pkg.version, pkg.classifier, 'zip', 'file://repo');
    });
    it('should rename artifacts with war-extension when configured as a type', function() {
      verifyDeployedFiles('test.project', 'test-project', pkg.version, pkg.classifier, 'zip', 'file://repo', null, 'war');
    });

    it('should not touch package.json', function() {
      var readPkg = JSON.parse(fs.readFileSync(path.join(projectDir, versionFile)));
      readPkg.should.eql(pkg);
    });
  });
}

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
        function(cb) { exec('grunt maven:' + target + ' --no-color', done); }
      ], done);
    });
    after(function(done) {
      rimraf(projectDir, done);
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

function testRelease(cmd, options) {
  //describe(cmd + (options.withGit ? ' with git project' : ''), function() {
  describe(cmd + ' -', function() {
    var pkg = { name: 'test-project', version: options.current };
    before(function(done) {
      async.series([
        function(cb) { setupGruntProject('package.json', pkg, initConfig, options.withGit, cb); },
        function(cb) { exec('grunt --no-color ' + cmd, done); }
      ], done);
    });
    after(function(done) {
      rimraf(projectDir, done);
    });

    it('should deploy artifact to repository', function() {
      verifyDeployedFiles('test.project', 'test-project', options.release, null, 'zip', 'file://repo');
    });

    it('should update package.json version to ' + options.next, function() {
      var readPkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json')));
      readPkg.version.should.equal(options.next);
    });

    if (options.withGit) {
      it('should add tag for release only', function(done) {
        exec('git tag', function(err, stdout, stderr) {
          if (err) { return done(err); }
          stdout.should.eql('v' + options.release + '\n');
          done();
        });
      });

      it('should add commit for released version', function(done) {
        exec('git log --pretty=format:"%s"', function(err, stdout, stderr) {
          if (err) { return done(err); }
          var commits = stdout.split('\n');
          commits.should.have.length(3);
          commits[0].should.eql(options.next);
          commits[1].should.eql(options.release);
          commits[2].should.eql('Initial commit');
          done();
        });
      });
    }
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

function verifyDeployedFiles(groupId, artifactId, version, classifier, packaging, url, repositoryId, type) {
  var deploy = JSON.parse(fs.readFileSync(path.join(projectDir, artifactId + '-deploy.json')));
  deploy.should.have.property('file', artifactId + '-' + version + (classifier? '-' + classifier : '') + '.' + packaging);
  deploy.should.have.property('groupId', groupId);
  deploy.should.have.property('artifactId', artifactId);
  deploy.should.have.property('version', version);
  if (classifier) {
    deploy.should.have.property('classifier', classifier);
  }
  deploy.should.have.property('packaging', packaging);
  deploy.should.have.property('url', url);
  if (repositoryId) {
    deploy.should.have.property('repositoryId', repositoryId);
  }
  if (type){
    deploy.should.have.property('type', type);
  }
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
         '  grunt.registerTask("maven:deploy-file", function() {\n' +
         '    var options = grunt.config("maven.deploy-file.options");\n' +
         '    fs.writeFileSync(options.artifactId + "-deploy.json", JSON.stringify(options));\n' +
         '  });\n' +
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
    function(cb) { fs.writeFile(path.join(projectDir, versionFile), JSON.stringify(pkg), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'Gruntfile.js'), gruntfile(initConfig), cb); },
    function(cb) { fs.writeFile(path.join(projectDir, 'somefile.txt'), 'somedata', cb); },
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

