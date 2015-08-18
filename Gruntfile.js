/*
 * grunt-maven-tasks
 * https://github.com/smh/grunt-maven-tasks
 *
 * Copyright (c) 2013 Stein Martin Hustad
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/**/*.js',
        'test/**/*.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Unit tests.
    simplemocha: {
      options: {
        timeout: 5000,
        ui: 'bdd',
        reporter: 'tap'
      },
      all: ['test/**/*-test.js']
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-simple-mocha');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['simplemocha']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);
};
