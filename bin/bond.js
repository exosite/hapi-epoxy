#! /usr/bin/env node
'use strict';

var Bossy = require('bossy');
var Epoxy = require('..');
var Fs = require('fs');
var Yaml = require('js-yaml');

var bossyDefinition = {
  e: {
    description: 'The Epoxy-compatible YAML manifest.',
    alias: 'epoxy-file',
    require: true,
  },

  g: {
    description: 'The destination to write the Glue manifest.  If not specified, prints to stdout.',
    alias: 'glue-out',
    default: null,
  },
};

var args = Bossy.parse(bossyDefinition);

// Deal with the CLI
if (args instanceof Error) {
  console.error(Bossy.usage(bossyDefinition));
  process.exit(1);
}

var epoxyFileData = Fs.readFileSync(args.e);
var glueManifest = JSON.stringify(Epoxy.bond(epoxyFileData), null, 2);

if (args.g) {
  Fs.writeFileSync(args.g, glueManifest);
} else {
  console.log(glueManifest);
}
