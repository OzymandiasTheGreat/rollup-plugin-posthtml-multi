const rollup = require('rollup');
const posthtml = require('../dist/index');

const extend = require('posthtml-extend');
const include = require('posthtml-include');
const modules = require('posthtml-modules');


const options = {
	extend: {
		import: {
			input: {
				input: 'test/templates/extend/index.js',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							plugins: [extend({ root: 'test/templates/extend/' })],
							extract: false,
						},
					}),
				],
			},
			output: {
				dir: 'test/result/extend/import/',
				format: 'iife',
				name: 'extend',
			},
		},
		direct: {
			input: {
				input: 'test/templates/extend/index.html',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							plugins: [extend({ root: 'test/templates/extend/' })],
							extract: true,
						},
					}),
				],
			},
			output: {
				dir: 'test/result/extend/direct/',
				format: 'iife',
				name: 'extend',
			},
		},
	},
	include: {
		import: {
			input: {
				input: 'test/templates/include/index.js',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							plugins: [include({ root: 'test/templates/include/' })],
							extract: false,
						},
					}),
				],
			},
			output: {
				dir: 'test/result/include/import/',
				format: 'iife',
				name: 'include',
			},
		},
		direct: {
			input: {
				input: 'test/templates/include/index.html',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							extract: true,
							plugins: [include({ root: 'test/templates/include/' })],
						},
					}),
				],
			},
			output: {
				dir: 'test/result/include/direct/',
				format: 'iife',
				name: 'include',
			},
		},
	},
	modules: {
		import: {
			input: {
				input: 'test/templates/modules/index.js',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							plugins: [modules({ from: 'test/templates/modules/index.html' })],
							extract: false,
						},
					}),
				],
			},
			output: {
				dir: 'test/result/modules/import/',
				format: 'iife',
				name: 'modules',
			},
		},
		direct: {
			input: {
				input: 'test/templates/modules/index.html',
				plugins: [
					posthtml({
						logLevel: 'error',
						options: {
							extract: true,
							plugins: [modules({ from: 'test/templates/modules/index.html' })],
						},
					}),
				],
			},
			output: {
				dir: 'test/result/modules/direct/',
				format: 'iife',
				name: 'modules',
			},
		},
	},
};


const test = async (opts) => {
	const bundle = await rollup.rollup(opts.input);

	// for (let path of bundle.watchFiles) {
	// 	console.log(`watching file: ${path}`);
	// }

	await bundle.write(opts.output);
};


test(options.extend.import);
test(options.extend.direct);
test(options.include.import);
test(options.include.direct);
test(options.modules.import);
test(options.modules.direct);
