'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var fs = _interopDefault(require('fs-extra'));
var rollupPluginutils = require('rollup-pluginutils');
var posthtml = _interopDefault(require('posthtml'));
var matchHelper = _interopDefault(require('posthtml-match-helper'));

var pluginName = 'posthtml-multi';


function index(ref) {
	var watch = ref.watch; if ( watch === void 0 ) watch = false;
	var importPath = ref.importPath;
	var optionList = ref.options; if ( optionList === void 0 ) optionList = [{}];

	var output = {};
	var options = Array.isArray(optionList)
		? optionList
		: [optionList];

	for (var i = 0, list = options; i < list.length; i += 1) {
		var config = list[i];

		config._filter = config.include
			? rollupPluginutils.createFilter(config.include, config.exclude)
			: rollupPluginutils.createFilter('**/*.html', config.exclude);
	}


	var plugin = {
		name: pluginName,

		resolveImport: async function resolveImport(filePath, from) {
			// eslint-disable-next-line multiline-ternary
			var parent = from ? from : filePath;
			if (path.isAbsolute(filePath) && await fs.pathExists(filePath)) { return filePath; }
			if (importPath) {
				var fromImportPath = path.join(path.resolve(importPath), filePath);
				if (await fs.pathExists(fromImportPath)) { return fromImportPath; }
			}
			var fromCWD = path.resolve(filePath);
			var fromEntry = path.join(path.resolve(path.dirname(parent)), filePath);
			if (await fs.pathExists(fromCWD)) { return fromCWD; }
			else if (await fs.pathExists(fromEntry)) { return fromEntry; }
			return null;
		},

		posthtmlHook: function posthtmlHook(from, context) {
			var this$1 = this;

			return function (tree) { return new Promise(function (resolve) {
				var promises = [];
				tree.match(matchHelper('module[href],include[src],extends[src]'), function (node) {
					promises.push(new Promise(function (resolveTask) {
						var href = node.attrs.href
							? node.attrs.href
							: node.attrs.src;
						this$1.resolveImport(href, from).then(function (nodePath) {
							if (nodePath !== null) {
								context.addWatchFile(nodePath);
								fs.readFile(nodePath).then(function (code) {
									posthtml([this$1.posthtmlHook(nodePath, context)])
										.process(code)
										.then(function () { return resolveTask(); })
										.catch(function (err) { return context.error(err); });
								})
									.catch(function (err) { return context.error(err); });
							}
						})
							.catch(function (err) { return context.error(err); });
					}));
				});
				Promise.all(promises).then(function () { return resolve(tree); })
					.catch(function (err) { return context.error(err); });
			}); };
		},

		transform: async function transform(code, id) {
			var matchingConfigs = [];
			var parsedList = [];

			for (var i = 0, list = options; i < list.length; i += 1) {
				var config = list[i];

				if (config._filter(id)) {
					matchingConfigs.push(config);
				}
			}
			if (!matchingConfigs.length) { return null; }

			for (var i$1 = 0, list$1 = matchingConfigs; i$1 < list$1.length; i$1 += 1) {
				var config$1 = list$1[i$1];

				var parsed = (await posthtml(config$1.plugins || []).process(code, {
					parser: config$1.parser,
					directives: config$1.directives,
				})).html;
				parsedList.push(parsed);
				if (config$1.extract) {
					if (!Array.isArray(output[id])) { output[id] = []; }
					output[id].push({
						code: parsed,
						extract: config$1.extract,
					});
				}
				if (watch) {
					await posthtml([plugin.posthtmlHook(id, this)]).process(code, {
						parser: config$1.parser,
						directives: config$1.directives,
					});
				}
			}
			return {
				code: matchingConfigs.some(function (config) { return config.extract; })
					? 'export default \'\''
					: ("export default " + (JSON.stringify(parsedList[0]))),
				map: { mappings: '' },
			};
		},

		generateBundle: async function generateBundle(opts, bundle, isWrite) {
			if (!isWrite) { return; }

			var getFileName = function (file, extract) {
				var resolvePath = function (dir) {
					var segment = [], len = arguments.length - 1;
					while ( len-- > 0 ) segment[ len ] = arguments[ len + 1 ];

					return path.resolve(path.join.apply(path, [ dir ].concat( segment )));
				};
				var dir = opts.dir || path.dirname(opts.file);
				var name = path.basename(file, path.extname(file));
				if (typeof extract === 'string') {
					if (path.isAbsolute(extract)) {
						if (path.extname(extract)) { return extract; }
						return ((path.join(extract, name)) + ".html");
					}
					if (path.extname(extract)) { return resolvePath(dir, extract); }
					return resolvePath(dir, extract, (name + ".html"));
				}
				return resolvePath(dir, (name + ".html"));
			};

			for (var i$1 = 0, list = Object.entries(output); i$1 < list.length; i$1 += 1) {
				var ref = list[i$1];
				var id = ref[0];
				var codeList = ref[1];

				for (var i = 0; i < codeList.length; i++) {
					var assetName = getFileName(id, codeList[i].extract);
					var codeFile = {
						fileName: assetName,
						isAsset: true,
						source: codeList[i].code,
					};
					bundle[assetName] = codeFile;

					var jsName = (path.basename(id, path.extname(id))) + ".js";
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

module.exports = index;
//# sourceMappingURL=index.js.map
