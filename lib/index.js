'use strict';

const Hoek = require('@hapi/hoek');
const Path = require('path');
const Yaml = require('js-yaml');

const internals = {};

internals.BASE_OPTIONS = {
  logger: console,
  warnOnDefault: false,
  warnOnParse: false,
};

internals.exists = (obj, prop) => {
  return Object.prototype.hasOwnProperty.call(obj, prop);
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
 * - Assign `plugin.register` with the converted plugin registrations to the new plugin key
 *
 * @param {Object} epoxyManifest - The Object form of an Epoxy manifest after processing by
 *   Epoxy.bond() (i.e. any tags should have been processed out).
 * @returns {Object} The converted Object that can be JSON serialized into a Glue-compatible
 *   manifest.
 */
internals.convertToGlue = function(epoxyManifest) {
  const glueManifest = Hoek.clone(epoxyManifest, {shallow: ['plugins']});

  if (internals.exists(epoxyManifest, 'plugins')) {
    const gluePlugins = [];
    const epoxyPlugins = epoxyManifest.plugins;
    delete glueManifest.plugins;

    Object.keys(epoxyPlugins).forEach(function (epoxyPluginKey) {
      // NB: The plugin may have no options to pass to it, or an implicit single registration
      const epoxyPlugin = epoxyPlugins[epoxyPluginKey] || {};
      const pluginRegistrations = epoxyPlugin.registrations || [{}];

      // Perform options munging
      pluginRegistrations.forEach(function(epoxyRegistration) {
        const gluePlugin = {plugin: {}};

        if (internals.exists(epoxyRegistration, 'registrationOptions')) {
          Hoek.merge(gluePlugin, epoxyRegistration.registrationOptions);
        }

        if (internals.exists(epoxyRegistration, 'pluginOptions')) {
          gluePlugin.options = {};
          Hoek.merge(gluePlugin.options, epoxyRegistration.pluginOptions);
        }

        // Create the new Glue registration entry for each plugin.  Assume node module by default
        let gluePluginName = epoxyPluginKey;
        const pluginPath = epoxyPlugin.pluginPath;

        if (pluginPath) {
          // Path.join will actually not include the relative path, so set it manually if it's there
          gluePluginName = pluginPath[0] === '.' ? './' : '';
          gluePluginName += Path.join(pluginPath, epoxyPluginKey);
        }

        gluePlugin.plugin = gluePluginName;

        gluePlugins.push(gluePlugin);
      });
    })

    glueManifest.register = {plugins: gluePlugins};
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
  const epoxyManifest = Hoek.clone(glueManifest, {shallow: ['registrations']});

  if (internals.exists(glueManifest, 'registrations')) {
    const epoxyPlugins = {};
    const glueRegistrations = glueManifest.registrations;
    delete epoxyManifest.registrations;

    glueRegistrations.forEach(function (glueRegistration) {
      // Figure out the new Epoxy plugin name and path
      const gluePluginRegister = glueRegistration.plugin.register || glueRegistration.plugin;
      const epoxyPluginName = Path.basename(gluePluginRegister);
      const epoxyPluginPath = epoxyPluginName === gluePluginRegister ? '' : Path.dirname(gluePluginRegister);

      const epoxyRegistration = {};

      if (glueRegistration.plugin.options) {
        epoxyRegistration.pluginOptions = Hoek.clone(glueRegistration.plugin.options);
      }
      if (glueRegistration.options) {
        epoxyRegistration.registrationOptions = Hoek.clone(glueRegistration.options);
      }

      const epoxyPlugin = epoxyPlugins[epoxyPluginName] || {
        pluginPath: epoxyPluginPath,
        registrations: [],
      };
      epoxyPlugin.registrations.push(epoxyRegistration);
      epoxyPlugins[epoxyPluginName] = epoxyPlugin;
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
  const _options = Hoek.applyToDefaults(internals.BASE_OPTIONS, options || {});
  const EpoxyYamlTypeBase = {
    kind: 'mapping',
    resolve: function(data) {
      // If you're using !epoxy, you should probably write the environment flag
      return data !== null && !!data.env;
    },
  };
  const EpoxyYamlType = new Yaml.Type('!epoxy', Object.assign({
    construct: function(data) {
      const fromEnviron = process.env[data.env];
      if (fromEnviron === undefined) {
        if (_options.warnOnDefault) {
          _options.logger.warn('Missing system value for Epoxy tag:', data.env);
        }
        return data.value;
      }
      return fromEnviron;
    },
  }, EpoxyYamlTypeBase));
  const EpoxyBoolYamlType = new Yaml.Type('!epoxy.bool', Object.assign({
    construct: function(data) {
      let fromEnviron = process.env[data.env];
      if (fromEnviron === undefined) {
        if (_options.warnOnDefault) {
          _options.logger.warn('Missing system value for Epoxy tag:', data.env);
        }
        return data.value;
      }
      switch (fromEnviron.toLowerCase()) {
        case 'true':
          fromEnviron = true;
          break;
        case 'false':
          fromEnviron = false;
          break;
        default:
          if (_options.warnOnParse) {
            _options.logger.warn('Non parsable system value for Epoxy tag:', data.env);
          }
          break;
      }
      // still return the value even if not converted
      return fromEnviron;
    },
  }, EpoxyYamlTypeBase));
  const EpoxyNumberYamlType = new Yaml.Type('!epoxy.number', Object.assign({
    construct: function(data) {
      const fromEnviron = process.env[data.env];
      if (fromEnviron === undefined) {
        if (_options.warnOnDefault) {
          _options.logger.warn('Missing system value for Epoxy tag:', data.env);
        }
        return data.value;
      }
      const number = Number(fromEnviron);
      if (isNaN(number)) {
        if (_options.warnOnParse) {
          _options.logger.warn('Non parsable system value for Epoxy tag:', data.env);
        }
        return fromEnviron;
      }
      return number;
    },
  }, EpoxyYamlTypeBase));

  const EPOXY_SCHEMA = Yaml.DEFAULT_SCHEMA.extend([EpoxyYamlType, EpoxyBoolYamlType, EpoxyNumberYamlType]);

  // Parse and transform the YAML into the Glue manifest
  const dirtyManifest = Yaml.load(yamlContents, {schema: EPOXY_SCHEMA}) || {};
  return internals.convertToGlue(dirtyManifest);
};
