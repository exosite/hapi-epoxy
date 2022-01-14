#! /usr/bin/env node
'use strict';

const Bossy = require('@hapi/bossy');
const Epoxy = require('..');
const Fs = require('fs');

const bossyDefinition = {
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

const args = Bossy.parse(bossyDefinition);

// Deal with the CLI
if (args instanceof Error) {
  console.error(Bossy.usage(bossyDefinition));
  process.exit(1);
}

const epoxyFileData = Fs.readFileSync(args.e);
const glueManifest = JSON.stringify(Epoxy.bond(epoxyFileData), null, 2);

if (args.g) {
  Fs.writeFileSync(args.g, glueManifest);
} else {
  console.log(glueManifest);
}
