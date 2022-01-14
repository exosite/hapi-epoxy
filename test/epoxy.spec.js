'use strict';

const Glue = require('@hapi/glue');
const Epoxy = require('..');
const Fs = require('fs');

describe('The Epoxy file parsing', () => {
  const EPOXY_DEFAULT_CONFIG = {
    warnOnDefault: false,
    logger: jasmine.createSpyObj('logger', ['warn']),
  };

  const EPOXY_LOG_CONFIG = {
    warnOnDefault: true,
    logger: jasmine.createSpyObj('logger', ['warn']),
  };

  it('can run without options', (done) => {
    expect(Epoxy.bond(Fs.readFileSync('./test/fixtures/empty.yaml'))).toEqual({});
    done();
  });

  it('can handle blank files', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/empty.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({});
    done();
  });

  it('can handle simple YAML without Epoxy tags', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagless.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({server: {debug: {log: ['error', 'plugin', 'boom']}}});
    done();
  });

  it('can handle simple YAML with Epoxy tags', (done) => {
    delete process.env.EPOXY_BASIC_TAG_TEST;
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 'Default Value'}}}
    );
    done();
  });

  it('can override the default value with the system variable for Epoxy tags', (done) => {
    process.env.EPOXY_BASIC_TAG_TEST = 'foo';
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 'foo'}}}
    );
    done();
  });

  it('can override the default value with the system variable for Epoxy boolean tags', (done) => {
    process.env.EPOXY_BASIC_TAG_TEST = 'false';
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/bool-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: false}}}
    );
    done();
  });

  it('can override the default value with the system variable for Epoxy number tags', (done) => {
    process.env.EPOXY_BASIC_TAG_TEST = '1337';
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/number-tagged.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual(
      {server: {debug: {log: ['error', 'plugin', 'boom']}, app: {testSetting: 1337}}}
    );
    done();
  });

  it('will warn if the system environment is not set for an Epoxy tag', (done) => {
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

  it('will handle a plugin with no settings at all', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-noop.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({register: {plugins: [{plugin: './noop'}, {plugin: './noop-two'}]}});
    done();
  });

  it('will handle a plugin with only a path', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-path.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      register: {
        plugins: [
          {plugin: './sample/plugin/path/basicReg'},
          {plugin: '/var/plugin/path/absReg'},
          {plugin: './dotReg'},
        ],
      },
    });
    done();
  });

  it('will handle a plugin that is in node_modules', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-module-path.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({register: {plugins: [{plugin: 'npmReg'}]}});
    done();
  });

  it('will handle a plugin with only register options', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-regoptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      register: {
        plugins: [
          {plugin: './sample/plugin/path/regOptions', routes: {prefix: '/api/reg'}, once: true},
        ],
      },
    });
    done();
  });

  it('will handle a plugin with only plugin options', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-pluginoptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      register: {
        plugins: [
          {plugin: './sample/plugin/path/pluginOptions', options: {debugLevel: 'INFO'}},
        ],
      },
    });
    done();
  });

  it('will handle a plugin with a custom path and full options', (done) => {
    expect(Epoxy.bond(
      Fs.readFileSync('./test/fixtures/basic-plugin-alloptions.yaml'), EPOXY_DEFAULT_CONFIG)
    ).toEqual({
      register: {
        plugins: [
          {plugin: './sample/plugin/path/allOptions', options: {debugLevel: 'INFO'}, once: true},
        ],
      },
    });
    done();
  });

  it('will handle a robust configuration file', (done) => {
    expect(Epoxy.bond(Fs.readFileSync('./test/fixtures/sample-application.yaml'))).toEqual(
      {
        server: {
          debug: {log: ['error', 'plugin', 'boom']},
          app: {testSetting: true},
            routes: {
              cors: {
                credentials: true,
              },
            },
          host: '127.0.0.1',
          port: 8001,
        },
        register: {
          plugins: [
            {plugin: 'auth'},
            {plugin: 'utils'},
            {plugin: '/var/path/to/session', options: {allowedDomains: ['localhost', 's.example.com']}},
            {plugin: './plugins/api', options: {showdocs: false }, routes: {prefix: '/api/v1'}},
            {plugin: './plugins/uxtest', options: {useVersion: 20150901}, select: 'uxr-group-142'},
            {plugin: './plugins/uxtest', options: {useVersion: 20151020}, select: 'uxr-group-589'},
            {plugin: 'cdn', routes: {prefix: '/assetfarm'}},
          ],
        },
      }
    );
    done();
  });
});

describe('Epoxy conversion from Glue manifests', () => {

  it('can handle blank files', (done) => {
    expect(Epoxy.convertToEpoxy(require('./fixtures/empty.json'))).toEqual({});
    done();
  });

  it('can handle a manifest without plugins', (done) => {
    expect(Epoxy.convertToEpoxy(require('./fixtures/basic-server.json'))).toEqual({
      server: {
        host: '127.0.0.1',
        port: 8001,
        routes: {cors: {credentials: true}},
        debug: {log: ['error', 'plugin', 'boom']},
        app: {testSetting: true},
      },
    });
    done();
  });

  it('can handle plugins without options', (done) => {
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

  it('can handle plugins with server.register options', (done) => {
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

  it('can handle plugins with plugin options', (done) => {
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

  it('can handle a plugin with custom path and full options', (done) => {
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

  it('can handle a plugin with multiple registrations', (done) => {
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

  it('works cleanly on a robust configuration file', (done) => {
    expect(Epoxy.convertToEpoxy(require('./fixtures/sample-application.json'))).toEqual(
      {
        server: {
          host: '127.0.0.1',
          port: 8001,
          debug: {log: ['error', 'plugin', 'boom']},
          app: {testSetting: true},
          routes: {
            cors: {
              credentials: true,
            },
          },
        },
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

describe('Epoxy composition with Glue', () => {
  it('works cleanly on a robust configuration file', () => {
    pending('Ideally this would verify the manifest is readable by Glue as a regression test');
  });

  it('works cleanly on an empty configuration file', (done) => {
    Glue.compose(
      Epoxy.bond(Fs.readFileSync('./test/fixtures/empty.yaml'))
    ).then(() => done())
  });
});
