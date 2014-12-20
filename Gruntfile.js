// Gruntfile.js
module.exports = function(grunt) {
    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);
    // display execution time of tasks
    require('time-grunt')(grunt);
    grunt.initConfig({
        // watch for changes and trigger sass and livereolad
        watch: {
            gruntfile: {
                files: ['Gruntfile.js'],
                tasks: ['sass', 'autoprefixer']
            },
            sass: {
                files: ['public/scss/**/*.{scss,sass}'],
                tasks: ['sass', 'autoprefixer']
            },
            livereload: {
                options: {
                    livereload: true
                },
                files: ['public/css/**/*.css', 'public/**/*.php', 'public/js/**/*.js', 'public/img/**/*.{png,jpg,jpeg,gif,webp,svg}']
            },
            server: {
                files: ['.rebooted'],
                options: {
                  livereload: true
                }
            } 
        },
        // nodemon
        nodemon: {
            dev: {
                script: 'server.js',
                // omit this property if you aren't serving HTML files and 
                // don't want to open a browser tab on start
                options: {
                    env: {
                        PORT: '7000'
                    },
                    callback: function(nodemon) {
                        nodemon.on('log', function(event) {
                            console.log(event.colour);
                        });
                        // opens browser on initial server start
                        nodemon.on('config:update', function() {
                            // Delay before server listens on port
                            setTimeout(function() {
                                require('open')('http://localhost:7000');
                            }, 1000);
                        });
                        // refreshes browser when server reboots
                        nodemon.on('restart', function() {
                            // Delay before server listens on port
                            setTimeout(function() {
                                require('fs').writeFileSync('.rebooted', 'rebooted');
                            }, 1000);
                        });
                    }
                }
            }
        },
        // sass
        sass: {
            dist: {
                options: {
                    style: 'nested',
                },
                files: {
                    'public/css/main.css': 'public/scss/main.scss'
                }
            }
        },
        // autoprefixer
        autoprefixer: {
            options: {
                browsers: ['last 2 versions', 'ie >= 9', 'ios 6', 'android 4'],
                map: true
            },
            files: {
                expand: true,
                flatten: true,
                src: 'public/css/main.css',
                dest: 'public/css'
            },
        },
        // run watch and nodemon at the same time
        concurrent: {
            options: {
                logConcurrentOutput: true
            },
            tasks: ['nodemon', 'watch']
        }
    });
    // register task
    grunt.registerTask('build', function() {
        grunt.task.run(['autoprefixer', 'sass']);
    });
    grunt.registerTask('serve', function() {
        grunt.task.run(['build']);
        grunt.task.run(['concurrent']);
    });
    grunt.registerTask('default', function() {
        grunt.task.run(['build']);
    });
};