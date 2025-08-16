const path = require( 'path' );

module.exports = {
	entry: {
		'ext.layers': './resources/ext.layers/init.js',
		'ext.layers.editor': './resources/ext.layers.editor/LayersEditor.js'
	},
	output: {
		path: path.resolve( __dirname, 'resources/dist' ),
		filename: '[name].js',
		library: {
			name: 'Layers[name]',
			type: 'window'
		}
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [ '@babel/preset-env' ]
					}
				}
			}
		]
	},
	optimization: {
		splitChunks: {
			chunks: 'all',
			cacheGroups: {
				common: {
					name: 'common',
					chunks: 'all',
					minChunks: 2,
					enforce: true
				}
			}
		}
	},
	externals: {
		jquery: 'jQuery',
		'oojs-ui': 'OO',
		mediawiki: 'mw'
	}
};
