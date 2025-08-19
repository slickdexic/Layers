/* eslint-env node, es6 */
module.exports = function ( grunt ) {
	const conf = grunt.file.readJSON( 'extension.json' );

	grunt.loadNpmTasks( 'grunt-banana-checker' );
	grunt.loadNpmTasks( 'grunt-eslint' );
	grunt.loadNpmTasks( 'grunt-stylelint' );

	grunt.initConfig( {
		eslint: {
			options: {
				cache: false,
				fix: grunt.option( 'fix' )
			},
			all: [
				'**/*.js',
				'!node_modules/**',
				'!vendor/**',
				'!resources/dist/**',
				'!tests/jest/**',
				'!resources/ext.layers.editor/LayerPanel.js'
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
				'!vendor/**'
			]
		},
		banana: conf.MessagesDirs
	} );

	grunt.registerTask( 'test', [ 'eslint', 'stylelint', 'banana' ] );
	grunt.registerTask( 'default', 'test' );
};
