'use strict';

var Hoek = require('hoek');
var Path = require('path');
var Yaml = require('js-yaml');

var internals = {};

internals.BASE_OPTIONS = {
  logger: console,
  warnOnDefault: false
};

/**
 * Clones and converts the given manifest object with Epoxy tags handled into a manifest that can be
 * handled by Glue without modification.
 *
 * More specifically, it will do the following:
 * - Recombine all instances of `plugin.pluginPath` with the name of the plugin to create the new
 *   plugin key
 * - Rename `plugin.registrations.pluginOptions` for all plugins to `plugin.options`
 * - Take all key/value pairs in `plugin.registrations.registerOptions` and move them up to the
 *   plugin directly
 * - Assign `plugin.registrations` with the converted plugin registrations to the new plugin key
 */
internals.convertToGlue = function (epoxyManifest) {
  var glueManifest = Hoek.clone(epoxyManifest);

  if (epoxyManifest.hasOwnProperty('plugins')) {
    var gluePlugins = {};
    var epoxyPlugins = epoxyManifest.plugins;

    for (var epoxyPluginKey of Object.keys(epoxyPlugins)) {
      var glueRegistrations = [];

      // NB: The plugin may have no options to pass to it, or an implicit single registration
      var epoxyPlugin = epoxyPlugins[epoxyPluginKey] || {};
      var pluginRegistrations = epoxyPlugin.registrations || [{}];

      // Perform options munging
      pluginRegistrations.forEach(function (epoxyRegistration) {
        var glueRegistration = {};
        if (epoxyRegistration.hasOwnProperty('registrationOptions')) {
          Hoek.merge(glueRegistration, epoxyRegistration.registrationOptions);
        }
        if (epoxyRegistration.hasOwnProperty('pluginOptions')) {
          glueRegistration.options = {};
          Hoek.merge(glueRegistration.options, epoxyRegistration.pluginOptions);
        }
        glueRegistrations.push(glueRegistration);
      });

      // Create the new Glue manifest entry for each plugin.  Assume node module by default
      var gluePluginName = epoxyPluginKey;
      var pluginPath = epoxyPlugin.pluginPath;

      if (pluginPath) {
        // Path.join will actually not include the relative path, so set it manually if it's there
        gluePluginName = pluginPath[0] === '.' ? './' : '';
        gluePluginName += Path.join(pluginPath, epoxyPluginKey);
      }

      gluePlugins[gluePluginName] = glueRegistrations;
    }

    glueManifest.plugins = gluePlugins;
  }

  return glueManifest;
};

/**
 * Synthesizes the local system environment with the given YAML file, producing a new,
 * Glue-compatible manifest as an Object.
 *
 * @param {String} yamlContents - The Epoxy-compatible YAML manifest that will be converted
 * @param {Object} options - Additional options to use when building the new manifest
 * @param {Object} options.logger - Logger to use by Epoxy when generating a new manifest.  Defaults
 *   to console.
 * @param {boolean} options.warnOnDefault - If true, will log a message at the WARN level for the
 *   configured logger when the environment variable for the !epoxy tag is not found on the
 *   current system.  Defaults to false.
 */
exports.bond = function (yamlContents, options) {
  // Setup the Schema behavior, given the passed in options
  var _options = Hoek.applyToDefaults(internals.BASE_OPTIONS, options || {});
  var EpoxyYamlType = new Yaml.Type('!epoxy', {
    kind: 'mapping',

    resolve: function (data) {
      // If you're using !epoxy, you should probably write the environment flag
      return data !== null && !!data.env;
    },

    construct: function (data) {
      var fromEnviron = process.env[data.env];
      if (_options.warnOnDefault && fromEnviron === undefined) {
        _options.logger.warn('Missing system value for Epoxy tag:', data.env);
      }
      return fromEnviron ? fromEnviron : data.value;
    }
  });
  var EPOXY_SCHEMA = EPOXY_SCHEMA = Yaml.Schema.create([EpoxyYamlType]);

  // Parse and transform the YAML into the Glue manifest
  var dirtyManifest = Yaml.load(yamlContents, {schema: EPOXY_SCHEMA}) || {};
  return internals.convertToGlue(dirtyManifest);
};
