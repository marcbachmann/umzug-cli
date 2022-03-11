const path = require('path')
const test = require('tape')
const knexUmzugCli = require('../api')
const { JSONStorage } = require('umzug/lib/storage/json')
const util = require('util')
const rimraf = require('rimraf').sync
const mkdir = require('fs').mkdirSync
const emptyMig = 'module.exports = {async up () {}, async down () {}}'
rimraf(path.join(__dirname, 'migrations'))
mkdir(path.join(__dirname, 'migrations'))

test('api', function (t) {
  t.plan(5)
  const api = createMigration('migrations/test-api').api

  t.test('exposes a .up command', function (t) {
    t.plan(1)
    t.equal(typeof api.up, 'function')
  })

  t.test('exposes a .down command', function (t) {
    t.plan(1)
    t.equal(typeof api.down, 'function')
  })

  t.test('exposes a .pending command', function (t) {
    t.plan(1)
    t.equal(typeof api.pending, 'function')
  })

  t.test('exposes a .history command', function (t) {
    t.plan(1)
    t.equal(typeof api.history, 'function')
  })

  t.test('exposes a .cli command', function (t) {
    t.plan(1)
    t.equal(typeof api.cli, 'function')
  })
})

test('.up', function (t) {
  t.plan(2)

  t.test('without migrations', function (t) {
    const mig = createMigration('migrations/up-test-1')
    mig.api.up().then(function () {
      t.equal(mig.stdout.pop(), 'No migrations executed\n', 'shows that no migrations got executed')
      t.end()
    })
  })

  t.test('with migrations, executes all', function (t) {
    const mig = createMigration('migrations/up-test-2')
    mig.create('first.js', emptyMig)
    mig.create('second.js', emptyMig)
    mig.api.up().then(function () {
      t.equal(mig.stdout.pop(), [
        'Executed \'up\' of 2 migrations',
        '-----------------------------',
        'first.js                     ',
        'second.js                    \n'
      ].join('\n'))
      t.end()
    })
  })
})

test('.down', function (t) {
  t.plan(2)

  t.test('without migrations', function (t) {
    const mig = createMigration('migrations/down-test-1')
    mig.api.down().then(function () {
      t.equal(mig.stdout.pop(), 'No migrations executed\n', 'shows that no migrations got executed')
      t.end()
    })
  })

  t.test('with migrations, executes 1 at a time', function (t) {
    const mig = createMigration('migrations/down-test-2')
    mig.create('first.js', emptyMig)
    mig.create('second.js', emptyMig)
    mig.api.up().then(function () {
      mig.stdout.length = 0

      mig.api.down().then(function () {
        const lines = mig.stdout.pop()
        t.equal(lines, [
          'Executed \'down\' of 1 migrations',
          '-------------------------------',
          'second.js                      \n'
        ].join('\n'))

        mig.api.down().then(function () {
          t.equal(mig.stdout.pop(), [
            'Executed \'down\' of 1 migrations',
            '-------------------------------',
            'first.js                       \n'
          ].join('\n'))
          t.end()
        })
      })
    })
  })
})

test('.pending', function (t) {
  t.plan(2)

  t.test('without migrations', function (t) {
    const mig = createMigration('migrations/pending-test-1')
    mig.api.pending().then(function () {
      t.equal(mig.stdout.pop(), 'No pending migrations\n')
      t.end()
    })
  })

  t.test('with migrations', function (t) {
    const mig = createMigration('migrations/pending-test-2')
    mig.create('first.js', emptyMig)
    mig.create('second.js', emptyMig)
    mig.api.pending().then(function () {
      t.equal(mig.stdout.pop(), [
        'Pending migrations',
        '------------------',
        'first.js          ',
        'second.js         \n'
      ].join('\n'))
      t.end()
    })
  })
})

test('.history', function (t) {
  t.plan(2)

  t.test('without migrations', function (t) {
    const mig = createMigration('migrations/history-test-1')
    mig.api.history().then(function () {
      t.equal(mig.stdout.pop(), 'No executed migrations\n')
      t.end()
    })
  })

  t.test('with migrations', function (t) {
    const mig = createMigration('migrations/history-test-2')
    mig.create('first.js', emptyMig)
    mig.create('second.js', emptyMig)
    mig.api.up().then(function () {
      mig.api.history().then(function () {
        t.equal(mig.stdout.pop(), [
          'Executed migrations',
          '-------------------',
          'first.js           ',
          'second.js          \n'
        ].join('\n'))
        t.end()
      })
    })
  })
})

test('.cli', function (t) {
  t.plan(2)

  t.test('with arg --help', function (t) {
    const mig = createMigration('migrations/cli-test-1')
    const origExit = process.exit
    process.exit = function () {}
    mig.api.cli(['--help'])
    process.exit = origExit
    const lines = mig.stdout.pop().split('\n')
    t.equal(lines[0], 'Use: umzug-cli [command]')
    t.end()
  })

  t.test('with arg pending', function (t) {
    const mig = createMigration('migrations/cli-test-2')
    mig.create('first.js', emptyMig)
    mig.create('second.js', emptyMig)
    mig.api.cli(['pending']).then(function () {
      t.equal(mig.stdout.pop(), [
        'Pending migrations',
        '------------------',
        'first.js          ',
        'second.js         \n'
      ].join('\n'))
      t.end()
    })
  })
})

function createMigration (directory) {
  const migdir = path.join(__dirname, directory)
  const stdout = new BufferStream()
  const api = knexUmzugCli({
    cli: { stdout: stdout },
    debug: true,
    migrations: {
      glob: path.join(migdir, '*.js')
    },
    storage: new JSONStorage({
      path: path.join(migdir, 'state.json')
    })
  })
  mkdir(migdir)
  return {
    api: api,
    stdout: stdout,
    create: function (name, string) {
      require('fs').writeFileSync(path.join(migdir, name), string)
    }
  }
}

function BufferStream () {}
util.inherits(BufferStream, Array)
BufferStream.prototype.write = BufferStream.prototype.push
