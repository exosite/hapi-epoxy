'use strict';

var Glue = require('glue');
var Epoxy = require('..');
var Fs = require('fs');

describe('The Epoxy file parsing', function() {
  var EPOXY_DEFAULT_CONFIG = {
    warnOnDefault: false,
    logger: jasmine.createSpyObj('logger', ['warn']),
  };

  var EPOXY_LOG_CONFIG = {
    warnOnDefault: true,
    logger: jasmine.createSpyObj('logger', ['warn']),
  };

  it('can run without options', function(done) {
    expect(Epoxy.bond(Fs.readFileSync('./test/fixtures/empty.yaml'))).toEqual({});
    done();
  });

  it('can handle blank files', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/empty.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({});
    done();
  });

  it('can handle simple YAML without Epoxy tags', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagless.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({server: {debug: {log: ['error', 'plugin', 'boom']}}});
    done();
  });

  it('can handle simple YAML with Epoxy tags', function(done) {
    delete process.env.EPOXY_BASIC_TAG_TEST;
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 'Default Value'}}}
    );
    done();
  });

  it('can override the default value with the system variable for Epoxy tags', function(done) {
    process.env.EPOXY_BASIC_TAG_TEST = 'foo';
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 'foo'}}}
    );
    done();
  });

  it('will warn if the system environment is not set for an Epoxy tag', function(done) {
    delete process.env.EPOXY_BASIC_TAG_TEST;
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagged.yaml'), EPOXY_LOG_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 'Default Value'}}}
    );
    expect(EPOXY_LOG_CONFIG.logger.warn).toHaveBeenCalledWith(
      'Missing system value for Epoxy tag:', 'EPOXY_BASIC_TAG_TEST');
    done();
  });

  it('will handle a plugin with no settings at all', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-noop.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({plugins: {'./noop': [{}], './noop-two': [{}]}});
    done();
  });

  it('will handle a plugin with only a path', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-path.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      plugins: {
        './sample/plugin/path/basicReg': [{}],
        '/var/plugin/path/absReg': [{}],
        './dotReg': [{}],
      },
    });
    done();
  });

  it('will handle a plugin that is in node_modules', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-module-path.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({plugins: {npmReg: [{}]}});
    done();
  });

  it('will handle a plugin with only register options', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-regoptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      plugins: {
        './sample/plugin/path/regOptions': [{once: true, routes: {prefix: '/api/reg'}}],
      },
    });
    done();
  });

  it('will handle a plugin with only plugin options', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-pluginoptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      plugins: {
        './sample/plugin/path/pluginOptions': [{options: {debugLevel: 'INFO'}}],
      },
    });
    done();
  });

  it('will handle a plugin with a custom path and full options', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-alloptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      plugins: {
        './sample/plugin/path/allOptions': [{once: true, options: {debugLevel: 'INFO'}}],
      },
    });
    done();
  });

  it('will handle a plugin with multiple registrations', function(done) {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-multireg.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      plugins: {
        multiples: [
          {select: 'primary', options: {debugLevel: 'WARN'}},
          {select: 'secondary', options: {debugLevel: 'INFO'}},
        ],
      },
    });
    done();
  });

  it('will handle a robust configuration file', function(done) {
    expect(Epoxy.bond(Fs.readFileSync('./test/fixtures/sample-application.yaml'))).toEqual(
      {
        server: {
          debug: {log: ['error', 'plugin', 'boom']},
          app: {testSetting: true},
          connections: {
            routes: {
              cors: {
                credentials: true,
              },
            },
          },
        },
        connections: [{host: '127.0.0.1', port: 8001}],
        plugins: {
          auth: [{}],
          utils: [{}],
          '/var/path/to/session': [{
            options: {
              allowedDomains: ['localhost', 's.example.com'],
            },
          },],
          './plugins/api': [{
            routes: {prefix: '/api/v1'},
            options: {showdocs: false},
          },],
          './plugins/uxtest': [{
            select: 'uxr-group-142',
            options: {useVersion: 20150901},
          }, {
            select: 'uxr-group-589',
            options: {useVersion: 20151020},
          },],
          cdn: [{
            routes: {prefix: '/assetfarm'},
          },],
        },
      }
    );
    done();
  });
});

describe('Epoxy conversion from Glue manifests', function() {

  it('can handle blank files', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/empty.json'))).toEqual({});
    done();
  });

  it('can handle a manifest without plugins', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-server.json'))).toEqual({
      server: {
        debug: {log: ['error', 'plugin', 'boom']},
        app: {testSetting: true},
        connections: {routes: {cors: {credentials: true}}},
      },
      connections: [{host: '127.0.0.1', port: 8001}],
    });
    done();
  });

  it('can handle plugins without options', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-plugin-path.json'))).toEqual({
      plugins: {
        amodule: {
          pluginPath: '',
          registrations: [{}],
        },
        relpath: {
          pluginPath: './a',
          registrations: [{}],
        },
        relpath2: {
          pluginPath: '.',
          registrations: [{}],
        },
        abspath: {
          pluginPath: '/an',
          registrations: [{}],
        },
      },
    });
    done();
  });

  it('can handle plugins with server.register options', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-plugin-regoptions.json'))).toEqual({
      plugins: {
        authy: {
          pluginPath: '',
          registrations: [{
            registrationOptions: {
              once: true,
              routes: {
                prefix: '/api/authy',
              },
            },
          },],
        },
      },
    });
    done();
  });

  it('can handle plugins with plugin options', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-plugin-pluginoptions.json'))).toEqual({
      plugins: {
        stand: {
          pluginPath: '',
          registrations: [{
            pluginOptions: {
              fruits: ['apple', 'orange'],
            },
          },],
        },
        market: {
          pluginPath: '',
          registrations: [{
            pluginOptions: {
              location: 'Main St.',
              allyear: true,
            },
          },],
        },
      },
    });
    done();
  });

  it('can handle a plugin with custom path and full options', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-plugin-alloptions.json'))).toEqual({
      plugins: {
        foodtrucks: {
          pluginPath: './lib',
          registrations: [{
            registrationOptions: {
              select: 'lunch',
            },
            pluginOptions: {
              location: 'Broadway',
            },
          },],
        },
      },
    });
    done();
  });

  it('can handle a plugin with multiple registrations', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-plugin-multireg.json'))).toEqual({
      plugins: {
        markets: {
          pluginPath: '',
          registrations: [{
              registrationOptions: {
                select: 'bnm',
              },
              pluginOptions: {
                location: 'Main St.',
                allyear: true,
              },
            }, {
              registrationOptions: {
                select: 'oam',
              },
              pluginOptions: {
                location: 'Market Square',
                allyear: false,
              },
            },],
        },
      },
    });
    done();
  });

  it('works cleanly on a robust configuration file', function(done) {
    expect(Epoxy.convertToEpoxy(require('./fixtures/sample-application.json'))).toEqual(
      {
        server: {
          debug: {log: ['error', 'plugin', 'boom']},
          app: {testSetting: true},
          connections: {
            routes: {
              cors: {
                credentials: true,
              },
            },
          },
        },
        connections: [{host: '127.0.0.1', port: 8001}],
        plugins: {
          auth: {pluginPath: '', registrations: [{}]},
          utils: {pluginPath: '', registrations: [{}]},
          session: {
            pluginPath: '/var/path/to',
            registrations: [{
              pluginOptions: {
                allowedDomains: ['localhost', 's.example.com'],
              },
            },],
          },
          api: {
            pluginPath: './plugins',
            registrations: [{
              registrationOptions: {
                routes: {prefix: '/api/v1'},
              },
              pluginOptions: {
                showdocs: false,
              },
            },],
          },
          uxtest: {
            pluginPath: './plugins',
            registrations: [{
              registrationOptions: {
                select: 'uxr-group-142',
              },
              pluginOptions: {
                useVersion: 20150901,
              },
            }, {
              registrationOptions: {
                select: 'uxr-group-589',
              },
              pluginOptions: {
                useVersion: 20151020,
              },
            },
            ],
          },
          cdn: {
            pluginPath: '',
            registrations: [{
              registrationOptions: {
                routes: {prefix: '/assetfarm'},
              },
            },],
          },
        },
      }
    );
    done();
  });
});

describe('Epoxy composition with Glue', function() {
  it('works cleanly on a robust configuration file', function(done) {
    pending('Ideally this would verify the manifest is readable by Glue as a regression test');
  });

  it('works cleanly on an empty configuration file', function(done) {
    Glue.compose(
      Epoxy.bond(Fs.readFileSync('./test/fixtures/empty.yaml')), {}, function(err, server) {
        done();
      }
    );
  });

});
