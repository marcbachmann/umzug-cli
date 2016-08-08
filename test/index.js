var path = require('path')
var test = require('tape')
var knexUmzugCli = require('../api')
var util = require('util')
var rimraf = require('rimraf').sync
var mkdir = require('fs').mkdirSync
rimraf(path.join(__dirname, 'migrations'))
mkdir(path.join(__dirname, 'migrations'))

test('api', function (t) {
  t.plan(5)
  var api = knexUmzugCli({})

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
  t.plan(1)

  var mig1 = createMigration('migrations/up-test-1')
  mig1.api.up().then(function () {
    t.equal(mig1.stdout.pop(), 'No migrations executed\n', 'shows that no migrations got executed')
  })
})

function createMigration (directory) {
  var migdir = path.join(__dirname, directory)
  var stdout = new BufferStream()
  var api = knexUmzugCli({cli: {stdout: stdout}, migrations: {directory: migdir}})
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
