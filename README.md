# grunt-maven-tasks

> Grunt maven tasks - install artifacts locally or deploy and release articats to maven repository.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-maven-tasks --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-maven-tasks');
```

## Supported Maven Goals

### no goal

If no goal is specified, the goal will be set to the target name. This means that the target name must be one of `install`, `deploy` or `release`. For more flexibility with the naming of your targets, and/or having multiple targets with the same goal, specify the goal explicitly.

### install

_Run the `grunt maven` task with the `goal` option set to `install`._

This tasks packages and installs an artifact to your local maven repository.

### deploy

_Run the `grunt maven` task with the `goal` option set to `deploy`._

This tasks packages and deploys an artifact to a maven repository.

### release task

_Run the `grunt maven` task with the `goal` option set to `release`._

This task packages and releases an artifact to a maven repository. It will update the version number in the package.json file to the next development version, and, if this is a git project, it will commit and tag the release.

By default, it will increment the version number using the `minor` version. This can be overridden in the config section using the `mode` option.

_Run this task with the `grunt maven:[your-task-target]:major` command to bump the next development version using the `major` version mode._

_Run this task with the `grunt maven:[your-task-target]:1.2.0` command to release version `1.2.0`._

_Run this task with the `grunt maven:[your-task-target]:1.2.0:major` command to release version 1.2.0 and bump the next development version using the `major` version mode._

### Overview

In your project's Gruntfile, add a section named `maven` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  maven: {
    options: {
      goal: 'deploy',
      groupId: 'com.example',
      url: '<repository-url>',
    },
    src: [ '**', '!node_modules/**' ]
  }
})
```

### Options

#### options.versionFile
Type `String`
Default: package.json

Identifies the file that contains the version file to read.  (E.G. bower.json)

#### options.goal
Type `String`
Default: target name

The maven goal for the target artifact. Valid values are 'deploy' and 'release'. Defaults to the target name

#### options.groupId
Type: `String`
Required

The maven group id to use when deploying and artifact

#### options.artifactId
Type: `String`
Default: name found in package.json

The maven artifact id to use when deploying and artifact

#### options.version
Type: `String`
Default: version found in package.json or the file specified by options.versionFile

The version to use when deploying to the maven repository

#### options.classifier
Type: `String`
Optional

The classifier to use when deploying to the maven repository

#### options.mode
Type: `String`
Default: minor

The mode passed to semver.inc to determine next development version.

#### options.packaging
Type: `String`
Default: zip

The packaging to use when deploying to the maven repository. Will also
determine the archiving type. As internally the grunt-contrib-compress
plugin is used to package the artifact, only archiving types supported
by this module is supported.

#### options.url
Type: `String`
Required

The url for the maven repository to deploy to.

#### options.repositoryId
Type: `String`
Optional

The repository id of the repository to deploy to. Used for looking up authentication in settings.xml.

### options.type
Type: `String`
Optional

Enables you to choose a different file extension for your artifact besides .zip which is useful when using the Maven WAR-plugin

### options.injectDestFolder
Type: `String`
Optional

Enables you to turn off the injection of destination folder inside your artifact allowing you to choose the structure you want by configuring the compress task.

### options.destFolder
Type: `String`
Optional

Specifies the name of the folder to be injected inside the artifact. If not specified, this will be auto-generated.

### options.commitPrefix
Type: `String`
Optional

Prefix for the commit message when releasing.

### options.gitpush
Type: `Boolean`
Optional
Default: false

If `true`, runs git push after updating the `package.json` with the next version.
### options.unsecure
Type: `Boolean`
Optional

If `true`, runs maven with `-Dmaven.wagon.http.ssl.insecure=true` and `-Dmaven.wagon.http.ssl.allowall=true`
### Files

Files may be specified using any of the supported [Grunt file mapping formats](http://gruntjs.com/configuring-tasks#files).

### Usage Examples

#### Default Options
In this example, only required options have been specified and the 'goal' is defaulted to the target name.

Running `grunt maven:deploy` will deploy the artifact to the `snapshot-repos` folder using the groupId `com.example`, the artifactId set to the name in `package.json` and the version set to the version in `package.json`.

Running `grunt maven:release` will deploy the artifact to the `release-repo` folder using the groupId `com.example`, the artifactId set to the name in `package.json` and the version set to the version in `package.json`, but with the `-SNAPSHOT` suffix removed. The version in `package.json` will be incremented to the next minor SNAPSHOT version, ie. if it was `1.0.0-SNAPSHOT` it will end up at `1.1.0-SNAPSHOT`. If this is a git repository, it will also commit and tag the release version, as well as commiting the updated package.json version.

```js
grunt.initConfig({
  maven: {
    options: { groupId: 'com.example' },
    deploy: {
      options: {
        goal: 'deploy',
        url: 'file://snapshot-repo'
      },
      src: [ '**', '!node_modules/**' ]
    },
    release: {
      options: {
        goal: 'release',
        url: 'file://release-repo'
      },
      src: [ '**', '!node_modules/**' ]
    }
  }
})

grunt.registerTask('deploy', [ 'clean', 'test', 'maven:deploy' ]);
grunt.registerTask('release', [ 'clean', 'test', 'maven:release' ]);
```

The `maven` task can be configured to support deployment or release of multiple artifacts:

```js
grunt.initConfig({
  maven: {
    deployA: {
      options: {
        goal: 'deploy',
        groupId: 'com.example',
        artifactId: 'myNodeArtifact',
        url: '<repository-url>',
      },
      src: [ '**', '!node_modules/**' ]
    },
    deployB: {
      options: {
        goal: 'deploy',
        groupId: 'com.example',
        artifactId: 'myBrowserArtifact',
        url: '<repository-url>',
      },
      src: [ 'target/browser/**', '!target/browser/node_modules/**' ]
    }
  }
})
```

#### Custom Options
In this example, the artifactId has been explicitly set, and the version bumping used when releasing is set to `'patch'` level rather than the default `'minor'`.

```js
grunt.initConfig({
  maven: {
    options: { groupId: 'com.example', artifactId: 'example-project' },
    deploy: {
      options: { url: 'file://snapshot-repo' },
      src: [ '**', '!node_modules/**' ]
    },
    release: {
      options: { url: 'file://release-repo', mode: 'patch' },
      src: [ '**', '!node_modules/**' ]
    }
  }
})
```

In order to customize the output archive, please look at the documenations for the [grunt-contrib-compress task](https://github.com/gruntjs/grunt-contrib-compress).

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).
