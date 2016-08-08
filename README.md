# umzug-cli

A cli factory for umzug, a migration library

1. Create a executable `migrate.js`
```js
#!/usr/bin/env node
require('umzug-cli')({
	storage: 'knex-umzug',
	storageOptions: {
	   connection: knex({}),
	}
}).cli(process.argv.slice(2))
```

2. Execute `migrate.js`
```bash
$ ./migrate.js

Use: umzug-cli [command]

Where [command] is one of:
  up                     migrates everything up
  down                   migrates 1 migration down
  up [file-to-migrate]   migrates a specific file up
  down [file-to-migrate] migrates a specific file down
  execute [direction] [files-to-migrate] migrates a specific file
  pending                shows all pending migrations
  history                shows the migration history
```


### Why doesn't this library offer an executable?

Because most likely each implementation has a custom config structure.
This library directly uses `umzug`, which you can configure like documented https://www.npmjs.com/package/umzug#configuration
