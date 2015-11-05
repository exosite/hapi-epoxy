#! /usr/bin/env node
'use strict';

var Bossy = require('bossy');
var Epoxy = require('..');
var Fs = require('fs');
var Yaml = require('js-yaml');
var Path = require('path');

// Deal with the CLI
var bossyDefinition = {
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

var args = Bossy.parse(bossyDefinition);

// Deal with the CLI
if (args instanceof Error) {
  console.error(Bossy.usage(bossyDefinition));
  process.exit(1);
}

// Import, convert, and dump as YAML
var glueJson = require(args.g);
var epoxyYaml = Yaml.safeDump(Epoxy.convertToEpoxy(glueJson));

if (args.e) {
  Fs.writeFileSync(args.e, epoxyYaml);
} else {
  console.log(epoxyYaml);
}
