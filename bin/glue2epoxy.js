#! /usr/bin/env node
'use strict';

const Bossy = require('@hapi/bossy');
const Epoxy = require('..');
const Fs = require('fs');
const Yaml = require('js-yaml');

// Deal with the CLI
const bossyDefinition = {
  e: {
    description: 'Destination for the Epoxy manifest.  If not specified, prints to stdout.',
    alias: 'epoxy-out',
    default: null,
  },

  g: {
    description: 'The Glue manifest to convert.',
    alias: 'glue-file',
    require: true,
  },
};

const args = Bossy.parse(bossyDefinition);

// Deal with the CLI
if (args instanceof Error) {
  console.error(Bossy.usage(bossyDefinition));
  process.exit(1);
}

// Import, convert, and dump as YAML
const glueJson = require(args.g);
const epoxyYaml = Yaml.safeDump(Epoxy.convertToEpoxy(glueJson));

if (args.e) {
  Fs.writeFileSync(args.e, epoxyYaml);
} else {
  console.log(epoxyYaml);
}
