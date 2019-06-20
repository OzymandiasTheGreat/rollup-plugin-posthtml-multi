import buble from 'rollup-plugin-buble';
import { terser } from 'rollup-plugin-terser';
import filesize from 'rollup-plugin-filesize';
import notify from 'rollup-plugin-notify';


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
		terser({
			compress: true,
			mangle: true,
			sourcemap: true,
		}),
		filesize(),
		notify(),
	],
};
