'use strict';

module.exports = function(grunt) {
    const config = require('./screeps.json');
    if(!config.branch) {
        config.branch = 'sim';
    }
    if(!config.ptr) {
        config.ptr = false;
    }
    if(!config.publishDir) {
        config.publishDir = 'pub/';
    }

    require('load-grunt-tasks')(grunt);

    // Override branch in screeps.json
    // grunt deploy --branch=<customBranch>
    let branch = grunt.option('branch') ? grunt.option('branch') : config.branch;

    grunt.initConfig({
        screeps: {
            options: {
                email: config.email,
                password: config.password,
                branch,
                ptr: config.ptr
            },
            dist: {
                src: ['dist/*.js']
            }
        },
        watch: {
            scripts: {
                files: [
                    'ocs.public/*.js',
                    'ocs.internal/*.js',
                    'overrides/*.js'
                ],
                tasks: ['deploy'],
                options: {
                    spawn: false
                }
            }
        },
        clean: ['dist/','pack/'],
        copy: {
            src: {
                files: [{
                    expand: true,
                    cwd: 'src/',
                    src: ['**', '!example.main.js'],
                    dest: 'dist/',
                    filter: 'isFile',
                    rename: function (dest, src) {
                        // Change the path name. utilize dots for folders
                        return dest + src.replace(/\//g,'.');
                    }
                }]
            }
        },
        webpack: {
            main: {
                entry: './dist/main.js',
                output: {
                    path: 'pack/',
                    filename: 'main.js',
                    libraryTarget: 'commonjs2'
                },
                module: {
                    loaders: [{
                        test: /\.js$/,
                        exclude: /(src|node_modules|ScreepsAutocomplete)/,
                        loader: 'babel-loader',
                        query: {
                            presets: [
                                require.resolve('babel-preset-es2016')
                            ]
                        }
                    }]
                }
            }
        },
        uglify: {
            my_target: {
                files: [{
                    expand: true,
                    cwd: 'pack',
                    src: 'main.js',
                    dest: 'pack'
                }]
            }
        },
        deploymentnumber: {
            options: {
                file: 'dist/engine.system.js', 
                field: 'DEPLOYMENT',
                configFile: 'screeps.json', 
                configField: 'deployment'
            }
        }
    });

    grunt.registerTask('switch-to-pack-deploy', function () {
        grunt.config.set('screeps.dist.src', ['pack/main.js']);
    });
    grunt.registerTask('deploymentnumber', function () {
        let options = this.options();
        let meta = grunt.file.read( options.file );
        let config = grunt.file.readJSON( options.configFile );
        let number = config[options.configField]+1;
        
        let replaced = false;
        let replace = (match, p1) => {
            replaced = true;
            return match.replace(p1, number.toString());
        };
        let pattern = new RegExp("(?:[ ]*" + options.field + "[ ]*[=][ ]*)(\\d*)(?:;?\\r)");
        let newMeta = meta.replace(pattern, replace);
        if( replaced ){
            config[options.configField] = number;
            grunt.file.write( options.configFile, JSON.stringify( config, null, 2 ) );
            grunt.file.write( options.file, newMeta );
            grunt.log.oklns( 'Deployment number: ' + number );
        } else {
            grunt.log.errorlns( 'Parameter "' + options.field + '" not found in "' + options.file + '".' );
        }
    });
    // clean deployment (dry run)
    grunt.registerTask('default', ['clean', 'copy:src', 'deploymentnumber']);
    // clean deployment
    grunt.registerTask('deploy', ['clean', 'copy:src', 'deploymentnumber', 'screeps']);
    // compressed [experimental] (dry run)
    grunt.registerTask('compress', ['clean', 'copy:src', 'deploymentnumber', 'webpack']);
    // compressed [experimental]
    grunt.registerTask('compress-deploy', ['clean', 'copy:src', 'deploymentnumber', 'webpack', 'switch-to-pack-deploy','screeps']);
    // uglified [experimental] (dry run)
    grunt.registerTask('ugly', ['clean', 'copy:src', 'deploymentnumber', 'webpack', 'uglify']);
    // uglified [experimental]
    grunt.registerTask('ugly-deploy', ['clean', 'copy:src', 'deploymentnumber', 'webpack', 'uglify', 'switch-to-pack-deploy', 'screeps']);

};
