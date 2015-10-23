# hapi-epoxy

<Stylized image goes here>

*hapi-epoxy* is a module designed to extend off of two things that are limited by the current Glue manifest:

  - Overriding by environment variables (Which is only possible using the CLI provided by rejoice)
  - Inability to document the config inside the config file itself (Since, you know, JSON)

Let's start from there and see what happens.