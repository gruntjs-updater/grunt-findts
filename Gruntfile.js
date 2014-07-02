module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({

        // Before generating any new files, remove any previously-created files.
        clean: {
            main: {
                src: [
                    'tmp',
                    'tasks/**/*.js', 'tasks/**/*.js.map'
                ]
            },
            temp: {
                src: [
                    'tmp'
                ]
            }
        },

        typescript: {
            main: {
                src: [
                    'tasks/**/*.ts',
                    'tests/**/*.ts'
                ],
                dest: '.',
                options: {
                    target: 'es5',
                    module: 'commonjs',
                    sourceMap: true,
                    declaration: false,
                    removeComments: false
                }
            }
        },

        // Configuration to be run (and then tested).
        findts: {
            default_options: {
                options: {
                },
                files: {
                    'tmp/default_options': ['tests/fixtures/testing', 'tests/fixtures/123']
                }
            },
            custom_options: {
                options: {
                    separator: ': ',
                    punctuation: ' !!!'
                },
                files: {
                    'tmp/custom_options': ['tests/fixtures/testing', 'tests/fixtures/123']
                }
            }
        },

        // Unit tests.
        nodeunit: {
            tests: ['tests/*_test.js']
        }

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');

    // Whenever the "test" task is run, first clean the "tmp" dir, then run this
    // plugin's task(s), then test the result.
    grunt.registerTask('test', ['findts', 'nodeunit', 'clean:temp']);

    // By default, lint and run all tests.
    grunt.registerTask('build', ['typescript:main']);
    grunt.registerTask('default', ['build', 'test']);

};
