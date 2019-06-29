import buble from 'rollup-plugin-buble';
import filesize from 'rollup-plugin-filesize';


const pkg = require('./package.json');


module.exports = {
	external: ['path', ...Object.keys(pkg.dependencies)],
	input: 'src/index.js',
	output: [
		{
			file: 'dist/index.js',
			format: 'cjs',
			sourcemap: true,
		},
		{
			file: 'dist/module.js',
			format: 'esm',
			sourcemap: true,
		},
	],
	plugins: [
		buble({
			transforms: {
				dangerousForOf: true,
				asyncAwait: false,
			},
		}),
		filesize(),
	],
};
