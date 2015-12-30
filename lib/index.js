'use strict';

var Hoek = require('hoek');
var Path = require('path');
var Yaml = require('js-yaml');

var internals = {};

internals.BASE_OPTIONS = {
  logger: console,
  warnOnDefault: false,
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
 *
 * @param {Object} epoxyManifest - The Object form of an Epoxy manifest after processing by
 *   Epoxy.bond() (i.e. any tags should have been processed out).
 * @returns {Object} The converted Object that can be JSON serialized into a Glue-compatible
 *   manifest.
 */
internals.convertToGlue = function(epoxyManifest) {
  var glueManifest = Hoek.clone(epoxyManifest);

  if (epoxyManifest.hasOwnProperty('plugins')) {
    var gluePlugins = {};
    var epoxyPlugins = epoxyManifest.plugins;

    Object.keys(epoxyPlugins).forEach(function (epoxyPluginKey) {
      var glueRegistrations = [];

      // NB: The plugin may have no options to pass to it, or an implicit single registration
      var epoxyPlugin = epoxyPlugins[epoxyPluginKey] || {};
      var pluginRegistrations = epoxyPlugin.registrations || [{}];

      // Perform options munging
      pluginRegistrations.forEach(function(epoxyRegistration) {
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
    })

    glueManifest.plugins = gluePlugins;
  }

  return glueManifest;
};

/**
 * Clones and converts the given Glue manifest object into an Epoxy-compatible form, such that
 * JsYaml.safeDump(convertToEpoxy(glueManifest)) can be interpreted by Epoxy.bond(...) without
 * issue.
 *
 * More specifically, it will do the following:
 * - Normalize all plugin names to no longer have the path component
 * - Reassign the path component of the plugin name to `plugin.pluginPath`
 * - Normalize all options to be of the form `Object[]` instead of `Object || Object[]`
 * - For each registration key not named `options`, reassign those as K/V pairs to
 *   `plugin.registrationOptions`
 * - If `options` is present in the plugin, rename the key to `pluginOptions`
 *
 *   Note this will not attempt to do any form of field tagging.  This is primarily to be used as a
 *   starting point for anyone with an existing Glue configuration that wishes to move to Epoxy and
 *   is not used by Epoxy.bond().
 *
 * @param {Object} glueManifest - The Glue manifest to convert into an Epoxy-compatible form.
 * @returns {Object} The converted Object that can be written as Epoxy-compatible YAML without
 *   modification.
 */
exports.convertToEpoxy = function(glueManifest) {
  var epoxyManifest = Hoek.clone(glueManifest);

  if (epoxyManifest.hasOwnProperty('plugins')) {
    var epoxyPlugins = {};
    var gluePlugins = glueManifest.plugins;

    Object.keys(gluePlugins).forEach(function (gluePluginKey) {
      var epoxyRegistrations = [];

      // Figure out the new Epoxy plugin name and path
      var epoxyPluginName = Path.basename(gluePluginKey);
      var epoxyPluginPath = epoxyPluginName === gluePluginKey ? '' : Path.dirname(gluePluginKey);

      // NB: The plugin may have no options to pass to it, or an implicit single registration
      var pluginRegistrations = gluePlugins[gluePluginKey];
      if (!Array.isArray(pluginRegistrations)) {
        var hasOptions = pluginRegistrations && Object.keys(pluginRegistrations).length;
        pluginRegistrations = hasOptions ? [{options: pluginRegistrations}] : [{}];
      }

      // Perform plugin munging
      pluginRegistrations.forEach(function(glueRegistration) {
        var epoxyRegistration = {};

        // Make sure we have options before doing work.  Purely aesthetic.
        if (Object.keys(glueRegistration).length) {
          if (glueRegistration.hasOwnProperty('options')) {
            epoxyRegistration.pluginOptions = glueRegistration.options;
            delete glueRegistration.options;
          }

          var remainingOptions = Object.keys(glueRegistration);
          if (remainingOptions.length) {
            epoxyRegistration.registrationOptions = glueRegistration;
          }
        }

        epoxyRegistrations.push(epoxyRegistration);
      });

      epoxyPlugins[epoxyPluginName] = {
        pluginPath: epoxyPluginPath,
        registrations: epoxyRegistrations,
      };
    });

    epoxyManifest.plugins = epoxyPlugins;
  }

  return epoxyManifest;
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
exports.bond = function(yamlContents, options) {
  // Setup the Schema behavior, given the passed in options
  var _options = Hoek.applyToDefaults(internals.BASE_OPTIONS, options || {});
  var EpoxyYamlType = new Yaml.Type('!epoxy', {
    kind: 'mapping',

    resolve: function(data) {
      // If you're using !epoxy, you should probably write the environment flag
      return data !== null && !!data.env;
    },

    construct: function(data) {
      var fromEnviron = process.env[data.env];
      if (_options.warnOnDefault && fromEnviron === undefined) {
        _options.logger.warn('Missing system value for Epoxy tag:', data.env);
      }

      return fromEnviron ? fromEnviron : data.value;
    },
  });
  var EPOXY_SCHEMA = EPOXY_SCHEMA = Yaml.Schema.create([EpoxyYamlType]);

  // Parse and transform the YAML into the Glue manifest
  var dirtyManifest = Yaml.load(yamlContents, {schema: EPOXY_SCHEMA}) || {};
  return internals.convertToGlue(dirtyManifest);
};
