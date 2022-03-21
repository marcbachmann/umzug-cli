const { Umzug } = require('umzug')
const yargs = require('yargs-parser')
const table = require('borderless-table')

module.exports = function (opts) {
  const umzug = new Umzug(opts)
  const stdout = (opts.cli && opts.cli.stdout) || process.stdout
  const api = createApi(stdout, umzug)
  const apiMethods = Object.keys(api)
  api.cli = function (args) {
    let opts = yargs(args, { configuration: { 'parse-numbers': false } })
    const command = opts._.splice(0, 1)[0]
    if (!~apiMethods.indexOf(command)) {
      stdout.write([
        'Use: umzug-cli [command]',
        '',
        'Where [command] is one of:',
        '  up                     migrates everything up',
        '  down                   migrates 1 migration down',
        '  up [file-to-migrate]   migrates a specific file up',
        '  down [file-to-migrate] migrates a specific file down',
        '  pending                shows all pending migrations',
        '  history                shows the migration history',
        ''
      ].join('\n'))
      process.exit(1)
    } else {
      if (command === 'up' || command === 'down') {
        if (opts.from || opts.to) opts = { from: opts.from, to: opts.to }
        else if (!opts._.length) opts = undefined
        else opts = { migrations: opts._ }
      }
      return api[command](opts)
    }
  }

  return api
}

function createApi (stdout, umzug) {
  return {
    umzug,
    async history () {
      if (typeof umzug.storage.history === 'function') {
        const events = await umzug.storage.history()
        if (!events.length) return stdout.write('No executed migrations\n')
        const lines = events.map(function (e) {
          const time = new Date(e.time).toLocaleTimeString('en-us', { year: 'numeric', month: 'numeric', day: 'numeric' })
          return Object.assign(e, { time: time })
        })
        table(lines, ['time', 'type', 'name', 'user', 'host'], null, stdout)
      } else {
        const migrations = await umzug.storage.executed()
        const executed = migrations.map(mig => ({ name: mig }))
        if (!migrations.length) stdout.write('No executed migrations\n')
        else table(executed, ['name'], ['Executed migrations'], stdout)
      }
    },
    async pending () {
      const migrations = await umzug.pending()
      if (!migrations.length) stdout.write('No pending migrations\n')
      else table(migrations, ['name'], ['Pending migrations'], stdout)
    },
    up: updown(stdout, umzug, 'up'),
    down: updown(stdout, umzug, 'down')
  }
}

function updown (stdout, umzug, type) {
  const debug = createDebug(stdout)
  return async function (opts) {
    let progress, seconds

    if (umzug.options.debug) {
      umzug.on('migrating', debug('migrate'))
      umzug.on('migrated', debug('migrated'))
      umzug.on('reverting', debug('revert'))
      umzug.on('reverted', debug('reverted'))
      umzug.on('debug', debug('debug'))
    } else {
      seconds = 0
      progress = setInterval(function () {
        seconds += 1
        stdout.write('.')
      }, 1000)
    }

    const migrations = await umzug[type](opts)

    if (!umzug.options.debug) {
      clearInterval(progress)
      if (seconds) stdout.write('\n') // we want a newline as soon as something gets logged.
    }

    if (!migrations || !migrations.length) return stdout.write('No migrations executed\n')
    table(migrations, ['name'], [`Executed '${type}' of ${migrations.length} migrations`], stdout)
  }
}

function createDebug (stdout) {
  return function debug (type) {
    return function (msg) {
      if (msg && msg.name) stdout.write(`${type}: ${msg.name}\n`)
      else stdout.write(`${type}\n`)
    }
  }
}
