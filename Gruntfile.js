// Gruntfile.js
module.exports = function(grunt) {
    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);
    // display execution time of tasks
    require('time-grunt')(grunt);

    grunt.initConfig({
        config: {
            app: 'public',
            dist: 'dist/public',
            nodeApp: '.',
            nodeDist: 'dist'
        },
        // watch for changes and trigger sass and livereolad
        watch: {
            gruntfile: {
                files: ['Gruntfile.js'],
                tasks: ['sass', 'autoprefixer']
            },
            sass: {
                files: ['<%= config.app %>/scss/**/*.{scss,sass}'],
                tasks: ['sass', 'autoprefixer']
            },
            livereload: {
                options: {
                    livereload: true
                },
                files: [
                    '<%= config.app %>/css/**/*.css', 
                    '<%= config.app %>/**/*.{php,html}', 
                    '<%= config.app %>/js/**/*.js', 
                    '<%= config.app %>/img/**/*.{png,jpg,jpeg,gif,webp,svg}'
                ]
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
                script: 'app.js',
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
        // wipe dist
        clean: {
            nodeDist: {
                files: [{
                    dot: true,
                    src: ['<%= config.nodeDist %>/*']
                }]
            }
        },
        // sass
        sass: {
            dist: {
                options: {
                    style: 'nested',
                },
                files: {
                    '<%= config.app %>/css/main.css': '<%= config.app %>/scss/main.scss'
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
                src: '<%= config.app %>/css/main.css',
                dest: '<%= config.app %>/css'
            },
        },
        rev: {
            dist: {
                files: {
                    src: [
                        '<%= config.dist %>/js/{,*/}*.js',
                        '<%= config.dist %>/css/{,*/}*.css',
                        '<%= config.dist %>/*.{ico,png}'
                    ]
                }
            }
        },
        // Reads HTML for usemin blocks to enable smart builds that automatically
        // concat, minify and revision files. Creates configurations in memory so
        // additional tasks can operate on them
        useminPrepare: {
            options: {
                dest: '<%= config.dist %>'
            },
            html: '<%= config.app %>/index.html'
        },
        // Performs rewrites based on rev and the useminPrepare configuration
        usemin: {
            options: {
                assetsDirs: ['<%= config.dist %>', '<%= config.dist %>/media/images']
            },
            html: ['<%= config.dist %>/{,*/}*.html'],
            css: ['<%= config.dist %>/css/{,*/}*.css']
        },
        copy: {
            nodeDist: {
                files: [
                    {
                        expand: true,
                        dot: true,
                        cwd: '<%= config.nodeApp %>',
                        dest: '<%= config.nodeDist %>',
                        src: [
                            '<%= config.nodeApp %>/app.js',
                            '<%= config.nodeApp %>/app/*',
                            '<%= config.nodeApp %>/package.json'
                        ]
                    }
                ]
            },
            dist: {
                files: [
                    {
                        expand: true,
                        dot: true,
                        cwd: '<%= config.app %>',
                        dest: '<%= config.dist %>',
                        src: ['index.html']
                    }
                ]
            }
        },
        // run watch and nodemon at the same time
        concurrent: {
            limit: 3,
            options: {
                logConcurrentOutput: true
            },
            serve: ['nodemon', 'watch']
        }
    });
    // register task
    grunt.registerTask('build', function() {
        grunt.task.run([
            'clean', 
            'useminPrepare', 
            'sass', 
            'autoprefixer', 
            'concat',
            'cssmin',
            'uglify',
            'copy',
            'rev', 
            'usemin'
        ]);
    });
    grunt.registerTask('serve', function() {
        grunt.task.run(['sass','autoprefixer']);
        grunt.task.run(['concurrent:serve']);
    });
    grunt.registerTask('default', function() {
        grunt.task.run(['build']);
    });
};