var assert = require('assert');
var util = require('util');

var jdbc = require('..');
var config = require('../testconf/config');

var db = new jdbc.Database({
  url: config.url,
  properties: config.properties
});

var id = 1;

function testType(colName, val, done) {
  console.log('Testing %s with %s', colName, val);
  db.execute(util.format('insert into types (id, %s) values (?, ?)', colName),
    [ id, val ],
    function(err, result) {
      if (err) {
        done(err);
      } else {
        assert.equal(result.updateCount, 1);
        db.execute(util.format('select %s from types where id = ?', colName),
          [ id ],
          function(err, result, rows) {
            id++;
            if (err) {
              done(err);
            } else {
              assert.equal(rows.length, 1);
              console.log('  result: %s', rows[0][colName]);
              assert.deepEqual(rows[0][colName], val);
              done();
            }
          });
      }
    });
}

var defaultSql = 'create table types (ID integer primary key, \
        SMALLINT smallint, INTEGER integer, BIGINT bigint, \
        NUMERIC numeric, DECIMAL decimal, \
        REAL real, FLOAT float, DOUBLE double, BOOLEAN boolean, BIT bit, \
        CHARACTER character(10), VARCHAR varchar(32), LONGVARCHAR longvarchar(64), \
        BINARY binary(10), VARBINARY varbinary(64), \
        BLOB blob, CLOB clob, \
        DATE date, TIME time, TIMESTAMP timestamp with time zone)';

var mssql = 'create table types (ID integer primary key, \
        SMALLINT smallint, INTEGER integer, BIGINT bigint, \
        NUMERIC numeric, DECIMAL decimal, \
        REAL real, FLOAT float, BIT bit, \
        CHARACTER character(10), VARCHAR varchar(32), \
        BINARY binary(10), VARBINARY varbinary(64), \
        DATE date, TIME time, TIMESTAMP timestamp)';

describe('Data Types', function() {
  before(function(done) {
    db.execute(defaultSql, done);
  });

  after(function(done) {
    db.execute('drop table types', function(err) {
      if (err) {
        done(err);
      } else {
        db.close(done);
      }
    });
  });

  it('smallint', function(done) {
    testType('SMALLINT', 1, done);
  });
  it('integer', function(done) {
    testType('INTEGER', 1, done);
  });
  it('bigint', function(done) {
    testType('BIGINT', 1, done);
  });
  it('numeric', function(done) {
    testType('NUMERIC', 1, done);
  });
  it('decimal', function(done) {
    testType('DECIMAL', '123', done);
  });
  it('real', function(done) {
    testType('REAL', 3.14, done);
  });
  it('float', function(done) {
    testType('FLOAT', 3.14, done);
  });
  it('double', function(done) {
    testType('DOUBLE', 3.14159265, done);
  });
  it('boolean', function(done) {
    testType('BOOLEAN', true, done);
  });
  it('bit', function(done) {
    // Treat as a string
    testType('BIT', '1', done);
  });
  it('character', function(done) {
      // Note space padding as per sql
    testType('CHARACTER', 'Hello     ', done);
  });
  it('varchar', function(done) {
    testType('VARCHAR', 'Hi there', done);
  });
  it('longvarchar', function(done) {
    testType('LONGVARCHAR', 'Greetings and salutations', done);
  });
  it('binary', function(done) {
    // Again with space padding
    testType('BINARY', new Buffer('Hey there ', 'ascii'), done);
  });
  it('varbinary', function(done) {
    testType('VARBINARY', new Buffer('And ho there'), done);
  });
  it('blob', function(done) {
    testType('BLOB', new Buffer('Ho ho ho'), done);
  });
  it('clob', function(done) {
    testType('CLOB', 'Clobby aren\'t we?', done);
  });
  it('time', function(done) {
    testType('TIME', '16:00:00', done);
  });
  it('date', function(done) {
    testType('DATE', '2014-09-22', done);
  });
  it('timestamp', function(done) {
    // Test timestamp separately.
    // SQL databases don't always have as much precision as Java, so round off
    var now = new Date('Mon Sep 22 2014 12:41:01 GMT');
    db.execute('insert into types(id, timestamp) values (?, ?)',
      [ id, now ],
      function(err, result) {
        assert(!err);
        assert.equal(result.updateCount, 1);

        db.execute('select timestamp from types where id = ?',
          [ id ],
          function(err, result, rows) {
            id++;
            assert(!err);
            assert.equal(rows.length, 1);
            //console.log('Original timestamp: %s, %d', now, now.getTime());
            //console.log('Returned timestamp: %s, %d', rows[0]['TIMESTAMP'], rows[0]['TIMESTAMP'].getTime());
            assert.equal(rows[0]['TIMESTAMP'].getTime(), now.getTime());
            done();
          });
      });
    });

  });
