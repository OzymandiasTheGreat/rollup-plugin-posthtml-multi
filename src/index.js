import path from 'path';
import fs from 'fs-extra';
import { createFilter } from 'rollup-pluginutils';
import posthtml from 'posthtml';
import matchHelper from 'posthtml-match-helper';


const pluginName = 'posthtml-multi';


export default function({
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
			const matchingConfigs = [];
			const parsedList = [];

			for (let config of options) {
				if (config._filter(id)) {
					matchingConfigs.push(config);
				}
			}
			if (!matchingConfigs.length) return null;

			for (let config of matchingConfigs) {
				const parsed = (await posthtml(config.plugins || []).process(code, {
					parser: config.parser,
					directives: config.directives,
				})).html;
				parsedList.push(parsed);
				if (config.extract) {
					if (!Array.isArray(output[id])) output[id] = [];
					output[id].push({
						code: parsed,
						extract: config.extract,
					});
				}
				if (watch) {
					await posthtml([plugin.posthtmlHook(id, this)]).process(code, {
						parser: config.parser,
						directives: config.directives,
					});
				}
			}
			return {
				code: matchingConfigs.some((config) => config.extract)
					? 'export default \'\''
					: `export default ${JSON.stringify(parsedList[0])}`,
				map: { mappings: '' },
			};
		},

		async generateBundle(opts, bundle, isWrite) {
			if (!isWrite) return;

			const getFileName = (file, extract) => {
				const resolvePath = (dir, ...segment) => path.resolve(path.join(dir, ...segment));
				const dir = opts.dir || path.dirname(opts.file);
				const name = path.basename(file, path.extname(file));
				if (typeof extract === 'string') {
					if (path.isAbsolute(extract)) {
						if (path.extname(extract)) return extract;
						return `${path.join(extract, name)}.html`;
					}
					if (path.extname(extract)) return resolvePath(dir, extract);
					return resolvePath(dir, extract, `${name}.html`);
				}
				return resolvePath(dir, `${name}.html`);
			};

			for (let [id, codeList] of Object.entries(output)) {
				for (let i = 0; i < codeList.length; i++) {
					let assetName = getFileName(id, codeList[i].extract, i);
					let codeFile = {
						fileName: assetName,
						isAsset: true,
						source: codeList[i].code,
					};
					bundle[assetName] = codeFile;

					const jsName = `${path.basename(id, path.extname(id))}.js`;
					if (bundle[jsName] && bundle[jsName].facadeModuleId === id && bundle[jsName].isEntry) {
						delete bundle[jsName];
					}
				}
				delete output[id];
			}
		}
	};
	return plugin;
}
