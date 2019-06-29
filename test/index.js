/* eslint-disable no-sync,object-property-newline */
/* global describe it afterEach */
import path from 'path';
import fs from 'fs';
import assert from 'better-assert';
import { rollup } from 'rollup';
import rimraf from 'rimraf';
import plugin from '../dist';


import extend from 'posthtml-extend';
import include from 'posthtml-include';
import modules from 'posthtml-modules';
import { rejects } from 'assert';


const fixture = (...args) => path.resolve(path.join('test/fixtures', ...args));
const result = (...args) => path.resolve(path.join('test/result', ...args));
// eslint-disable-next-line no-confusing-arrow,multiline-ternary
const promise = (fn, ...args) => new Promise((resolve, reject) => fn(...args, (err, res) => err ? reject(err) : resolve(res)));
const run = (inputFile, { watch = false, extract = true, plugins = [], importPath, ...options } = {}) => rollup({
	input: inputFile,
	plugins: [
		plugin({
			watch,
			importPath,
			options: [
				{
					extract,
					plugins,
					...options,
				},
			],
		}),
	],
});
const generate = (out, format = 'iife') => out.then((bundle) => bundle.generate({
	format,
	name: 'bundle',
}));
const write = (out, dir = '', format = 'iife') => out.then((bundle) => bundle.write({
	format,
	name: 'bundle',
	dir: result(dir),
}));


describe('rollup-plugin-posthtml-multi', () => {
	afterEach(() => promise(rimraf, 'test/result'));

	it('should import html as string', () => generate(run(fixture('basic', 'index.js'), { extract: false })).then((bundle) => {
		const a = JSON.stringify(fs.readFileSync(fixture('basic', 'a.html')).toString());
		const b = JSON.stringify(fs.readFileSync(fixture('basic', 'b.html')).toString());
		return Promise.all([
			assert(bundle.output.some(({ code }) => code.includes(a))),
			assert(bundle.output.some(({ code }) => code.includes(b))),
		]);
	}));

	it('should output html', () => write(run(fixture('basic', 'index.js')), 'basic').then((bundle) => {
		const a = JSON.stringify(fs.readFileSync(fixture('basic', 'a.html')).toString());
		const b = JSON.stringify(fs.readFileSync(fixture('basic', 'b.html')).toString());
		const output = {};
		bundle.output.forEach(({ fileName, code, source }) => {
			output[fileName] = { code, source };
		});
		return Promise.all([
			assert(!output['index.js'].code.includes(a)),
			assert(!output['index.js'].code.includes(b)),
			assert(JSON.stringify(output[result('basic', 'a.html')].source) === a),
			assert(JSON.stringify(output[result('basic', 'b.html')].source) === b),
		]);
	}));

	it('should write output according to extract option', () => write(run(fixture('basic', 'index.js'), { extract: 'basic/extract/' })).then((bundle) => {
		const a = JSON.stringify(fs.readFileSync(fixture('basic', 'a.html')).toString());
		const b = JSON.stringify(fs.readFileSync(fixture('basic', 'b.html')).toString());
		const output = {};
		bundle.output.forEach(({ fileName, code, source }) => {
			output[fileName] = { code, source };
		});
		return Promise.all([
			assert(!output['index.js'].code.includes(a)),
			assert(!output['index.js'].code.includes(b)),
			assert(JSON.stringify(output[result('basic', 'extract', 'a.html')].source) === a),
			assert(JSON.stringify(output[result('basic', 'extract', 'b.html')].source) === b),
		]);
	}));

	it('should NOT produce empty bundles when using html entry points', async () => {
		const outDir = 'htmlOutput';
		return write(run([fixture('basic', 'a.html'), fixture('basic', 'b.html')]), outDir, 'cjs')
			.then(() => Promise.all([
				assert(fs.existsSync(result(outDir, 'a.html'))),
				assert(fs.existsSync(result(outDir, 'b.html'))),
				assert(!fs.existsSync(result(outDir, 'a.js'))),
				assert(!fs.existsSync(result(outDir, 'b.js'))),
			]));
	});

	describe('should watch html modules', () => {
		it('imported by posthtml-extend', () => run(fixture('extend', 'index.js'), {
			watch: true,
			plugins: [extend({ root: fixture('extend') })],
		}).then((bundle) => Promise.all([
			assert(bundle.watchFiles.includes(fixture('extend', 'base.html'))),
			assert(bundle.watchFiles.includes(fixture('extend', 'middle.html'))),
		])));

		it('imported by posthtml-include', () => run(fixture('include', 'index.js'), {
			watch: true,
			plugins: [include({ root: fixture('include') })],
		}).then((bundle) => Promise.all([
			assert(bundle.watchFiles.includes(fixture('include', 'components', 'button.html'))),
			assert(bundle.watchFiles.includes(fixture('include', 'components', 'title.html'))),
		])));

		it('imported by posthtml-modules', () => run(fixture('modules', 'index.js'), {
			watch: true,
			plugins: [modules({ from: fixture('modules', 'index.html') })],
		}).then((bundle) => Promise.all([
			assert(bundle.watchFiles.includes(fixture('modules', 'module.html'))),
			assert(bundle.watchFiles.includes(fixture('modules', 'deep_module.html'))),
		])));
	});
});
