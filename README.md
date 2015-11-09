# hapi-epoxy

<Stylized image goes here>

*hapi-epoxy* is a module designed to extend off of two things that are limited by the current Glue
manifest:

  - Overriding by environment variables (Which is currently only possible on the command-line,
    assuming you are using rejoice)
  - Inability to document the config inside the config file itself (Since JSON doesn't natively
    support comments)

It is designed to work alongside Glue, generating the object / JSON that Glue normally consumes
from a given YAML as follows:

    Glue.compose(Epoxy.bond(...), glueOptions, function (err, server) { ...});

Examples of sample formats can be found in the `./test/fixtures/` directory.  In particular, the
`sample-application.yaml` file has a decent example of the various forms of plugin configuration
and general server setup, with a few examples of Epoxy being used to override values with the local
system as desired.

In contrast, `sample-application.json` is an example Glue manifest for the equivalently-named YAML
file, using the default values where the Epoxy tags are used in the YAML.
