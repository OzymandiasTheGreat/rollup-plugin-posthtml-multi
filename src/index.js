import path from 'path';
import fs from 'fs-extra';
import { createFilter } from 'rollup-pluginutils';
import posthtml from 'posthtml';
import matchHelper from 'posthtml-match-helper';


const pluginName = 'posthtml-multi';


export default function({
	extract = false,
	fileName = '[name].[ext]',
	watch = false,
	importPath,
	options: optionList = [{}],
}) {
	const output = {};
	let options = Array.isArray(optionList)
		? optionList
		: [optionList];

	for (let config of options) {
		config._filter = config.include
			? createFilter(config.include, config.exclude)
			: createFilter('**/*.html', config.exclude);
	}


	const plugin = {
		name: pluginName,

		async resolveImport(filePath, from) {
			// eslint-disable-next-line multiline-ternary
			const parent = from ? from : filePath;
			if (path.isAbsolute(filePath) && await fs.pathExists(filePath)) return filePath;
			if (importPath) {
				const fromImportPath = path.join(path.resolve(importPath), filePath);
				if (await fs.pathExists(fromImportPath)) return fromImportPath;
			}
			const fromCWD = path.resolve(filePath);
			const fromEntry = path.join(path.resolve(path.dirname(parent)), filePath);
			if (await fs.pathExists(fromCWD)) return fromCWD;
			else if (await fs.pathExists(fromEntry)) return fromEntry;
			return null;
		},

		posthtmlHook(from, context) {
			return (tree) => new Promise((resolve) => {
				const promises = [];
				tree.match(matchHelper('module[href],include[src],extends[src]'), (node) => {
					promises.push(new Promise((resolveTask) => {
						const href = node.attrs.href
							? node.attrs.href
							: node.attrs.src;
						this.resolveImport(href, from).then((nodePath) => {
							if (nodePath !== null) {
								context.addWatchFile(nodePath);
								fs.readFile(nodePath).then((code) => {
									posthtml([this.posthtmlHook(nodePath, context)])
										.process(code)
										.then(() => resolveTask())
										.catch((err) => context.error(err));
								})
									.catch((err) => context.error(err));
							}
						})
							.catch((err) => context.error(err));
					}));
				});
				Promise.all(promises).then(() => resolve(tree))
					.catch((err) => context.error(err));
			});
		},

		async transform(code, id) {
			let matchingConfigs = [];

			for (let config of options) {
				if (config._filter(id)) {
					matchingConfigs.push(config);
				}
			}
			if (!matchingConfigs.length) return null;

			for (let config of matchingConfigs) {
				if (!Array.isArray(output[id])) output[id] = [];
				output[id].push((await posthtml(config.plugins || []).process(code, {
					parser: config.parser,
					directives: config.directives,
				})).html);
				if (watch) {
					await posthtml([plugin.posthtmlHook(id, this)]).process(code, {
						parser: config.parser,
						directives: config.directives,
					});
				}
			}
			return {
				// eslint-disable-next-line multiline-ternary
				code: extract ? '' : `export default ${JSON.stringify(output[id][0])}`,
				map: { mappings: '' },
			};
		},

		async generateBundle(opts, bundle, isWrite) {
			if (!isWrite || !extract) return;

			const genName = (file, iteration = 0) => {
				const baseDir = opts.dir || path.dirname(opts.file);
				const dir = typeof extract === 'string'
					// eslint-disable-next-line no-extra-boolean-cast
					? !!path.extname(extract)
						? path.dirname(extract)
						: extract
					: baseDir;
				const fileParts = path.parse(`${path.basename(file, path.extname(file))}.html`);
				let finalName = fileName.replace('[name]', fileParts.name)
					.replace('[ext]', fileParts.ext.substr(1))
					.replace('[extname]', fileParts.ext);
				finalName = finalName.includes('[fileNo]')
					// eslint-disable-next-line multiline-ternary
					? finalName.replace('[fileNo]', iteration ? iteration : '')
					: iteration
						? `${path.basename(finalName, '.html')}_${iteration}.html`
						: finalName;
				finalName = path.resolve(dir, finalName);
				return finalName;
			};

			for (let [id, codeList] of Object.entries(output)) {
				for (let i = 0; i < codeList.length; i++) {
					let assetName = genName(id, i);
					let codeFile = {
						fileName: assetName,
						isAsset: true,
						source: codeList[i],
					};
					bundle[assetName] = codeFile;
					delete output[id];
				}
			}
		}
	};
	return plugin;
}
