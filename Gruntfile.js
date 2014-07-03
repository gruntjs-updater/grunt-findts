module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({

        // Before generating any new files, remove any previously-created files.
        clean: {
            main: {
                src: [
                    'tasks/**/*.js', 'tasks/**/*.js.map'
                ]
            }
        },

        typescript: {
            main: {
                src: [
                    'tasks/**/*.ts'
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
        }
    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-clean');

    // By default, lint and run all tests.
    grunt.registerTask('build', ['typescript:main']);
    grunt.registerTask('default', ['build']);
};
