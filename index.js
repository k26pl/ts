const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

register('./ts-hooks.mjs', pathToFileURL(__filename));