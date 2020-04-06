# rollup-plugin-posthtml-multi

This plugin allows you to seamlessly integrate [posthtml post-processor](https://github.com/posthtml/posthtml) in [rollup](https://github.com/rollup/rollup)
build environment.

It allows importing html files as strings, extracting imported html files to output directory (custom paths also supported), watching modules imported from html (when using [posthtml-extend](https://github.com/posthtml/posthtml-extend), [posthtml-include](https://github.com/posthtml/posthtml-include) or [posthtml-modules](https://github.com/posthtml/posthtml-modules)).

You can also pass array of configs, with their own include and exclude patterns, generating as many variations of templates as needed.
This can be particullary useful e.g. when generating a static website from markdown sources.

-------------------

If you find this software useful do not hesitate to click that star and [consider becoming a patron](https://www.patreon.com/ozymandias)

-------------------

## Install

```
npm i -D rollup-plugin-posthtml-multi
```


## Usage


### Basic

`index.html`
```html
<p>Hello, World!</p>
```

`index.js`
```javascript
export { default as hello } from './index.html';
```

`rollup.config.js`
```javascript
import posthtml from 'rollup-plugin-posthtml-multi';

module.exports = {
	input: 'index.js',
	output: {
		dir: 'dist',
		format: 'iife',
	},
	plugins: [posthtml()],
};
```

will produce a bundle with following content:
```javascript
var hello = '<p>Hello, World!</p>\n'
```

If you specify `extract: true` in `rollup.config.js` like
```javascript
/* ... */
plugins: [posthtml({ options: { extract: true } })],
/* ... */
```

the `hello` variable will be an empty string and `index.html` file will be written to output directory
(`dist/` in this case).

`extract` can also be a path. If it contains an extension it's considered a filename, else it will be used as output directory.
It can be an absolute path, otherwise it will be resolved relative to rollup's output directory.


### Advanced

`src/modules/module.html`
```html
<h1>This is a Title!</h1>
```

`src/index.html`
```html
<module href='./modules/module.html'></module>
<p>I am a lonely paragraph...</p>
```

`index.js`
```javascript
export { default as template } from './index.html'
```

`rollup.config.js`
```javascript
import posthtml from 'rollup-plugin-posthtml-multi';
import modules from 'posthtml-modules';
/* ... */
plugins: [posthtml({
	watch: true,
	// usually not necessary, but if watching fails you should specify module path here
	importPath: 'src/modules/',
	options: {
		exclude: '**/modules/*',
		plugins: [modules({ from: 'src/index.html' })],
	},
})],
```

Now if you start rollup in watch mode (`--watch`),
any edits to `index.html`, as well as `module.html`
will be picked up by rollup and trigger rebuild.


### And beyond...

Now you might wonder why `options` is an object.
That's because it can also be an array of objects with their own includes, excludes, plugins, parsers and so on.

Imagine you have a bunch of markdown files. Their content is irrelevant to this example.
Now you have a single html template and you need to generate a page for every markdown file.

This is easy with the help of some extra modules.

`template.html`
```html
<!--...-->
<main markdown>{{ content }}</main>
<!--...-->
```

We don't necessarily need any javascript here.

`rollup.config.js`
```javascript
import posthtml from 'rollup-plugin-posthtml-multi';

import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import expressions from 'posthtml-expressions';
import markdown from 'posthtml-markdown';

// no point in using async here
const configureTemplates = () => fastGlob.sync('markdown/*.md').map((md) => ({
	// name resulting files after source markdown
	extract: `${path.basename(md, path.extname(md))}.html`,
	plugins: [
		expressions({ locals: { content: fs.readFileSync(md).toString() } }),
		markdown(),
	],
}));

module.exports = {
	// yes, you can do this
	input: 'template.html',
	output: {
		dir: 'dist/',
		format: 'iife',
		// since we're using html as input no bundle will be written
		// but rollup still complains about missing name with iife
		name: 'bundle',
	},
	plugins: [
		posthtml({ options: configureTemplates() }),
	],
};
```

For more examples check the tests.
If you have an interesting use case in mind, open an issue we'll add it here.


## Options

- `watch: (boolean; default: false)`: If true watch files imported by posthtml plugins.
- `importPath: (string; default: undefined)`: Path to search for files imported by posthtml plugins.
- `options: (Object | [Object ...]; default: {})`: An (array of) object(s) specifying options and plugins.
	+ `options.include: (string; default: '**/*.html')`: A glob matching files to process according to this config.
	+ `options.exclude: (string; default: undefined)`: A glob matching files to skip for this config.
	+ `options.extract: (boolean | string; default: undefined)`: Whether to extract html to files. Can be a file name or relative/absolute path (determined by presence of extension). If non-falsy, javascript variables contain empty strings.
	+ `options.plugins: (Array; default: [])`: An array of plugins to pass to posthtml.
	+ `options.parser: (Function; default: undefined)`: Passed directly to posthtml.
	+ `options.directives: (Array; default: undefined)`: Passed directly to posthtml.
