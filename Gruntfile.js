/* eslint-env node, es6 */
module.exports = function ( grunt ) {
	const conf = grunt.file.readJSON( 'extension.json' );

	grunt.loadNpmTasks( 'grunt-banana-checker' );
	grunt.loadNpmTasks( 'grunt-eslint' );
	grunt.loadNpmTasks( 'grunt-stylelint' );

	grunt.initConfig( {
		eslint: {
			options: {
				cache: true,
				fix: grunt.option( 'fix' )
			},
			all: [
				'**/*.js',
				'!node_modules/**',
				'!vendor/**',
				'!resources/dist/**',
				'!resources/ext.layers.editor/shapeLibrary/scripts/**',
				'!scripts/**',
				'!TempToolIcons/**',
				'!docs/api/**',
				'!.eslintrc.json',
				'!**/*.ts'
			]
		},
		stylelint: {
			options: {
				// Ensure the repo config is used so our linebreaks override is respected
				configFile: '.stylelintrc.json'
			},
			all: [
				'**/*.{css,less}',
				'!node_modules/**',
				'!vendor/**',
				'!coverage/**'
			]
		},
		banana: conf.MessagesDirs
	} );

	grunt.registerTask( 'test', [ 'eslint', 'stylelint', 'banana' ] );
	grunt.registerTask( 'default', 'test' );
};
