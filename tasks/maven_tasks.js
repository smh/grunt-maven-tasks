/*
 * grunt-maven-tasks
 * https://github.com/smh/grunt-maven-tasks
 *
 * Copyright (c) 2013 Stein Martin Hustad
 * Licensed under the MIT license.
 */

'use strict';

var semver = require('semver');
var fs = require('fs');

function injectDestFolder(targetPath, files) {
  var path = require('path');
  files.forEach(function(file) {
    file.dest = path.join(targetPath, file.dest || '');
  });
  return files;
}

module.exports = function(grunt) {

  grunt.registerMultiTask('maven', 'Packages and deploys artifact to maven repo', function(version, mode) {
    var options = this.options();

    requireOptionProps(options, ['goal', 'groupId', 'url']);

    if (options.goal === 'deploy') {
      deploy(this);
    } else if (options.goal === 'release') {
      release(this, version, mode);
    }
  });

  function deploy(task) {
    var pkg = grunt.file.readJSON('package.json');
    var options = task.options({
      artifactId: pkg.name,
      version: pkg.version,
      packaging: 'zip'
    });

    guaranteeFileName(options);
    configureDestination(options, task);
    configureMaven(options, task);

    grunt.task.run('maven:package',
      'maven:deploy-file');
  }

  function release(task, version, mode) {
    var pkg = grunt.file.readJSON('package.json');
    var options = task.options({
      artifactId: pkg.name,
      packaging: 'zip',
      mode: 'minor'
    });

    if (version && !mode && isValidMode(version)) {
      mode = version;
      version = null;
    }

    options.mode = mode || options.mode;
    options.version = version || pkg.version.substr(0, pkg.version.length - '-SNAPSHOT'.length);

    if (options.nextVersion === 'null-SNAPSHOT') {
      grunt.fail.fatal('Failed to determine next development version ' +
        'based on version (' + options.version.cyan +
        ') and mode (' + options.mode.cyan + ')');
    }
    options.nextVersion = semver.inc(options.version, options.mode) + '-SNAPSHOT';
    if (options.nextVersion === 'null-SNAPSHOT') {
      grunt.fail.fatal('Failed to determine next development version ' +
        'based on version (' + options.version.cyan +
        ') and mode (' + options.mode.cyan + ')');
    }

    guaranteeFileName(options);
    configureDestination(options, task);
    configureMaven(options, task);

    grunt.task.run('maven:version:' + options.version,
      'maven:package',
      'maven:deploy-file',
      'maven:version:' + options.nextVersion + ':deleteTag');
  }

  function guaranteeFileName(options) {
    if (!options.file) {
      options.file = options.artifactId + '-' + options.version + '.' + options.packaging;
    }
  }

  function configureDestination(options, task) {
    if (typeof options.injectDestFolder === 'undefined' || options.injectDestFolder === true) {
      task.files = injectDestFolder(options.artifactId + '-' + options.version, task.files);
    }
  }

  function configureMaven(options, task) {
    grunt.config.set('maven.package.options', { archive: options.file, mode: options.packaging });
    grunt.config.set('maven.package.files', task.files);
    grunt.config.set('maven.deploy-file.options', options);
  }

  grunt.registerTask('maven:package', function() {
    var compress = require('grunt-contrib-compress/tasks/lib/compress')(grunt);
    compress.options = grunt.config('maven.package.options');
    compress.tar(grunt.config('maven.package.files'), this.async());
  });

  grunt.registerTask('maven:deploy-file', function() {
    var options = grunt.config('maven.deploy-file.options');

    options.packaging = (options.type === 'war') ? 'war' : options.packaging;
    if (options.packaging === 'war'){
        options.file = renameForWarTypeArtifacts(options.file);
    }

    var args = [ 'deploy:deploy-file' ];
    args.push('-Dfile='         + options.file);
    args.push('-DgroupId='      + options.groupId);
    args.push('-DartifactId='   + options.artifactId);
    args.push('-Dpackaging='    + options.packaging);
    args.push('-Dversion='      + options.version);
    args.push('-Durl='          + options.url);
    if (options.repositoryId) {
      args.push('-DrepositoryId=' + options.repositoryId);
    }

    var done = this.async();
    var msg = 'Deploying to maven...';
    grunt.verbose.write(msg);
    grunt.util.spawn({ cmd: 'mvn', args: args }, function(err, result, code) {
      if (err) {
        grunt.verbose.or.write(msg);
        grunt.log.error().error('Failed to deploy to maven');
      } else {
        grunt.verbose.ok();
        grunt.log.writeln('Deployed ' + options.file.cyan + ' to ' + options.url.cyan);
      }
      done(err);
    });
  });

  grunt.registerTask('maven:version', 'Bumps version', function(version, deleteTag) {
    var done = this.async();


    var msg = 'Bumping version to ' + version.cyan + '...';
    grunt.verbose.write(msg);

    grunt.util.spawn({ cmd: 'npm', args: ['version', version] }, function(err, result, code) {
      if (err) {
        grunt.verbose.or.write(msg);
        grunt.log.error().error('Failed to bump version to ' + version.cyan);
        return done(err);
      }
      grunt.verbose.ok();
      grunt.log.writeln('Version bumped to ' + version.cyan);
      if (deleteTag) {
        isGitRepo(function(isGit) {
          if (!isGit) { return done(); }
          msg = 'Deleting tag v' + version.cyan + '...';
          grunt.verbose.write(msg);
          grunt.util.spawn({ cmd: 'git', args: ['tag', '-d', 'v' + version] }, function(err, result, code) {
            if (err) {
              grunt.verbose.or.write(msg);
              grunt.log.error().error('Failed to delete tag ' + ('v' + version).cyan);
            } else {
              grunt.verbose.ok();
              grunt.log.writeln('Deleted tag ' + ('v' + version).cyan);
            }
            done(err);
          });
        });
      } else {
        done();
      }
    });
  });

  function isGitRepo(fn) {
    grunt.util.spawn({ cmd: 'git', args: ['status', '--porcelain'] }, function(err, result, code) {
      fn(!err);
    });
  }

  function isValidMode(mode) {
    var validModes = ['major', 'minor', 'patch', 'build'].join('|');

    return mode.indexOf('|') < 0 && validModes.indexOf(mode) >=0;
  }

  function requireOptionProps(options, props) {
    var msg = 'Verifying properties ' + grunt.log.wordlist(props) + ' exists in options...';
    grunt.verbose.write(msg);

    var failProps = props.filter(function(p) {
      return !options.hasOwnProperty(p);
    }).map(function(p) {
      return '"' + p + '"';
    });

    if (failProps.length === 0) {
      grunt.verbose.ok();
    } else {
      grunt.verbose.or.write(msg);
      grunt.log.error().error('Unable to process task.');
      throw grunt.util.error('Required options ' + failProps.join(', ') + ' missing.');
    }
  }

  function renameForWarTypeArtifacts(filename) {
    var warFileName = filename.replace('zip', 'war');
    try {
      fs.renameSync(filename, warFileName);
      return warFileName;
    } catch (e) {
      throw e;
    }
  }
};
