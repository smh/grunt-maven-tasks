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

    requireOptionProps(options, ['groupId']);

    options.goal = options.goal || this.target;
    options.commitPrefix = options.commitPrefix || '%s';

    var pkg = grunt.file.readJSON(options.versionFile || 'package.json');

    if (options.goal === 'deploy') {
      requireOptionProps(options, ['url']);
      deploy(this, pkg);
    } else if (options.goal === 'install') {
      install(this, pkg);
    } else if (options.goal === 'package') {
      fpackage(this, pkg);
    } else if (options.goal === 'release') {
      requireOptionProps(options, ['url']);
      release(this, pkg, version, mode);
    }
  });
  
  function fpackage(task, pkg) {
    var options = task.options({
      artifactId: pkg.name,
      version: pkg.version,
      packaging: pkg.packaging
    });

    guaranteeFileName(options);
    configureDestination(options, task);
    configureMaven(options, task);

    grunt.task.run('mvn:package');
  }

  function install(task, pkg) {
    var options = task.options({
      artifactId: pkg.name,
      version: pkg.version,
      packaging: pkg.packaging
    });

    guaranteeFileName(options);
    configureDestination(options, task);
    configureMaven(options, task);

    grunt.task.run('mvn:package',
      'maven:install-file');
  }

  function deploy(task, pkg) {
    var options = task.options({
      artifactId: pkg.name,
      version: pkg.version,
      packaging: pkg.packaging
    });

    guaranteeFileName(options);
    configureDestination(options, task);
    configureMaven(options, task);

    grunt.task.run('mvn:package',
      'maven:deploy-file');
  }

  function release(task, pkg, version, mode) {
    var options = task.options({
      artifactId: pkg.name,
      packaging: pkg.packaging,
      mode: 'minor',
      gitpush: false,
      gitpushtag: false
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

    grunt.task.run(
      'maven:version:' + options.version,
      'mvn:package',
      'maven:deploy-file',
      'maven:version:' + options.nextVersion + ':deleteTag'
    );

    if (options.gitpush) {
      grunt.task.run(
        'maven:gitpush'
      );
    }
    
    if (options.gitpushtag) {
      grunt.task.run(
        'maven:gitpushtag:v' + options.version
      );
    }
  }

  function getFileNameBase(options) {
    return options.artifactId + '-' + options.version +
      (options.classifier ? '-' + options.classifier : '');
  }

  function guaranteeFileName(options) {
    if (!options.file) {
      options.file = getFileNameBase(options) + '.' + getExtension(options.packaging, options.classifier, options.type);
    }
  }

  function configureDestination(options, task) {
    if (typeof options.injectDestFolder === 'undefined' || options.injectDestFolder === true) {
      var fileNameBase = options.destFolder ? options.destFolder : getFileNameBase(options);
      task.files = injectDestFolder(fileNameBase, task.files);
    }
    grunt.config.set('grunt.maven.commitPrefix', options.commitPrefix);
  }

  function configureMaven(options, task) {
    
    options.packaging = getExtension(options.packaging, options.classifier, options.type);

    grunt.config.set('maven.package.options', { archive: options.file, mode: 'zip', extension: options.packaging });
    grunt.config.set('maven.package.files', task.files);
    grunt.config.set('maven.deploy-file.options', options);
    grunt.config.set('maven.install-file.options', options);
  }

  grunt.registerTask('mvn:package', function() {
    var compress = require('grunt-contrib-compress/tasks/lib/compress')(grunt);
    compress.options = grunt.config('maven.package.options');
    compress.tar(grunt.config('maven.package.files'), this.async());

    renameForKnownPackageTypeArtifacts(compress.options.archive, compress.options.extension);
  });

  grunt.registerTask('maven:install-file', function() {
    var options = grunt.config('maven.install-file.options');

    var args = [ 'install:install-file' ];
    args.push('-Dfile='         + options.file);
    args.push('-DgroupId='      + options.groupId);
    args.push('-DartifactId='   + options.artifactId);
    args.push('-Dpackaging='    + options.packaging);
    args.push('-Dversion='      + options.version);
    if (options.classifier) {
      args.push('-Dclassifier=' + options.classifier);
    }
    if (options.uniqueVersion === 'true') {
      args.push('-DuniqueVersion=true');
    }
    // The lack of a space after the -s is critical
    // otherwise the path will be processed by maven incorrectly.
    if (options.settingsXml) {
      args.push('-s' + options.settingsXml);
    }
    if (grunt.debug || options.debug) {
      args.push('-e');
      args.push('-X');
    }

    var done = this.async();
    var msg = 'Installing to maven...';
    grunt.verbose.write(msg);
    grunt.log.debug('Running command "mvn ' + args.join(' ') + '"');
    grunt.util.spawn({ cmd: 'mvn', args: args, opts: {stdio: 'inherit'} }, function(err, result, code) {
      if (err) {
        grunt.verbose.or.write(msg);
        grunt.log.error().error('Failed to install to maven');
      } else {
        grunt.verbose.ok();
        grunt.log.writeln('Installed ' + options.file.cyan);
      }
      done(err);
    });
  });

  grunt.registerTask('maven:deploy-file', function() {
    var options = grunt.config('maven.deploy-file.options');

    var args = [ 'deploy:deploy-file' ];
    args.push('-Dfile='         + options.file);
    args.push('-DgroupId='      + options.groupId);
    args.push('-DartifactId='   + options.artifactId);
    args.push('-Dpackaging='    + options.packaging);
    args.push('-Dversion='      + options.version);
    if (options.unsecure){
      args.push('-Dmaven.wagon.http.ssl.insecure='+options.unsecure);
      args.push('-Dmaven.wagon.http.ssl.allowall='+options.unsecure);
    }
    if (options.classifier) {
      args.push('-Dclassifier=' + options.classifier);
    }
    if (options.uniqueVersion === 'true') {
      args.push('-DuniqueVersion=true');
    }
    args.push('-Durl='          + options.url);
    if (options.repositoryId) {
      args.push('-DrepositoryId=' + options.repositoryId);
    }
    if (options.settingsXml) {
      // The lack of a space after the -s is critical
      // otherwise the path will be processed by maven incorrectly.
      args.push('-s' + options.settingsXml);
    }
    if (grunt.debug || options.debug) {
      args.push('-e');
      args.push('-X');
    }

    var done = this.async();
    var msg = 'Deploying to maven...';
    grunt.verbose.write(msg);
    grunt.log.debug('Running command "mvn ' + args.join(' ') + '"');
    grunt.util.spawn({ cmd: 'mvn', args: args, opts: {stdio: 'inherit'} }, function(err, result, code) {
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
    var commitPrefix = grunt.config('grunt.maven.commitPrefix') || '';


    var msg = 'Bumping version to ' + version.cyan + '...';
    grunt.verbose.write(msg);

    grunt.util.spawn({ cmd: 'npm', args: ['version', version, '-m', commitPrefix + '%s'] }, function(err, result, code) {
      if (err) {
        grunt.verbose.or.write(msg);
        grunt.log.error().error('Failed to bump version to ' + version.cyan);
        return done(err);
      }

      grunt.verbose.ok();
      grunt.log.writeln('Version bumped to ' + version.cyan);

      if (!deleteTag) {
        return done();
      }

      isGitRepo(function(isGit) {
        if (!isGit) { return done(); }
        msg = 'Deleting tag v' + version.cyan + '...';
        grunt.verbose.write(msg);
        grunt.util.spawn({ cmd: 'git', args: ['tag', '-d', 'v' + version] }, function(err, result, code) {
          if (err) {
            grunt.verbose.or.write(msg);
            grunt.log.error().error('Failed to delete tag ' + ('v' + version).cyan);
          }

          grunt.verbose.ok();
          grunt.log.writeln('Deleted tag ' + ('v' + version).cyan);

          done(err);
        });
      });
    });
  });

  grunt.registerTask('maven:gitpush', 'Pushes to git', function() {
    var done = this.async();

    grunt.verbose.write('Pushing to git');

    gitPush(function(err) {
      if (err) {
        grunt.log.error().error('Failed to push new version to remote');
      } else {
        grunt.log.writeln('Pushed new version to remote');
      }
      done(err);
    });
  });
  
  grunt.registerTask('maven:gitpushtag', 'Pushes tag to git', function(tag) {
    var done = this.async();

    grunt.verbose.write('Pushing tag ' + tag + 'to git');

    gitPushTag(tag, function(err) {
      if (err) {
        grunt.log.error().error('Failed to push new version to remote');
      } else {
        grunt.log.writeln('Pushed new version to remote');
      }
      done(err);
    });
  });


  function isGitRepo(fn) {
    grunt.util.spawn({ cmd: 'git', args: ['status', '--porcelain'] }, function(err, result, code) {
      fn(!err);
    });
  }

  function gitPush(fn) {
    grunt.util.spawn({ cmd: 'git', args: ['push'] }, function(err, result, code) {
      fn(err);
    });
  }

  function gitPushTag(version, fn) {
    grunt.util.spawn({ cmd: 'git', args: ['push', 'origin', version] }, function (err, result, code) {
      fn(err);
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

  function getExtension(packaging, classifier, type) {
    if(classifier === 'javadoc' || classifier === 'sources') {
      return 'zip';
    }
    return type ||  packaging || 'zip';
  }

  function renameForKnownPackageTypeArtifacts(fileName, extension) {
      var newFileName = fileName.replace('zip', extension);
      try {
          fs.renameSync(fileName, newFileName);
          return newFileName;
      } catch (e) {
          throw e;
      }
  }
};
