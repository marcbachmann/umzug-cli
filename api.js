var Umzug = require('umzug')
var yargs = require('yargs-parser')
var table = require('borderless-table')

module.exports = function (opts) {
  var umzug = new Umzug(opts)
  var stdout = (opts.cli && opts.cli.stdout) || process.stdout
  var api = createApi(stdout, umzug)
  var apiMethods = Object.keys(api)
  api.cli = function (args) {
    var opts = yargs(args, {configuration: {'parse-numbers': false}})
    var command = opts._.splice(0, 1)[0]
    if (!~apiMethods.indexOf(command)) {
      stdout.write([
        'Use: umzug-cli [command]',
        '',
        'Where [command] is one of:',
        '  up                     migrates everything up',
        '  down                   migrates 1 migration down',
        '  up [file-to-migrate]   migrates a specific file up',
        '  down [file-to-migrate] migrates a specific file down',
        '  execute [direction] [files-to-migrate] migrates a specific file',
        '  pending                shows all pending migrations',
        '  history                shows the migration history',
        ''
      ].join('\n'))
      process.exit(1)
    } else {
      if (command === 'up' || command === 'down') {
        if (opts.from || opts.to) opts = {from: opts.from, to: opts.to}
        else if (!opts._.length) opts = undefined
        else opts = opts._
      } else if (command === 'execute') {
        var direction = opts._.slice(0, 1)[0]
        var migrations = opts._.slice(1)
        if (direction !== 'up' && direction !== 'down') {
          throw new Error('Direction must be up or down.')
        }
        opts = {method: direction, migrations: migrations}
      }
      return api[command](opts)
    }
  }

  return api
}

function createApi (stdout, umzug) {
  return {
    history: function () {
      if (!typeof umzug.storage.history === 'function') {
        stdout.write("The current storage doesn't support a history.\n")
        process.exit(1)
        return
      }

      return umzug.storage.history().then(function (events) {
        var lines = events.map(function (e) {
          var time = new Date(e.time).toLocaleTimeString('en-us', {year: 'numeric', month: 'numeric', day: 'numeric'})
          return Object.assign(e, {time: time})
        })
        table(lines, ['time', 'type', 'name', 'user', 'host'], null, stdout)
      })
    },
    pending: function () {
      return umzug.pending().then(function (migrations) {
        migrations = migrations.map(function (mig) { return {file: mig.file} })
        if (!migrations.length) stdout.write('No pending migrations\n')
        else table(migrations, null, ['Pending migrations'], stdout)
      })
    },
    up: updown(stdout, umzug, 'up'),
    down: updown(stdout, umzug, 'down'),
    execute: updown(stdout, umzug, 'execute')
  }
}

function updown (stdout, umzug, type) {
  var debug = createDebug(stdout)
  return function (opts) {
    var progress, seconds

    if (umzug.options.debug) {
      umzug.on('migrating', debug('migrate'))
      .on('migrated', debug('migrated'))
      .on('reverting', debug('revert'))
      .on('reverted', debug('reverted'))
      .on('debug', debug('debug'))
    } else {
      seconds = 0
      progress = setInterval(function () {
        seconds += 1
        stdout.write('.')
      }, 1000)
    }

    var res = umzug[type](opts)

    if (!umzug.options.debug) {
      res.then(function () {
        clearInterval(progress)
        if (seconds) stdout.write('\n') // we want a newline as soon as something gets logged.
      })
    }

    return res.then(function (migrations) {
      if (!migrations || !migrations.length) stdout.write('No migrations executed\n')
      else table(migrations, ['file'], [`Executed '${type}' of the following files`], stdout)
    })
  }
}

function createDebug (stdout) {
  return function debug (type) {
    return function (message) {
      if (message) stdout.write(`${type}: ${message}\n`)
      else stdout.write(`${type}\n`)
    }
  }
}
