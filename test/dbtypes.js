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
        SI smallint, INT integer, BINT bigint, \
        NUM numeric, DEC decimal, \
        RE real, FL float, DB double, BOO boolean, BI bit, \
        CH character(10), VCH varchar(32), LVCH longvarchar(64), \
        BIN binary(10), VBIN varbinary(64), \
        BL blob, CL clob, \
        DA date, TI time, TST timestamp with time zone)';

var mssql = 'create table types (ID numeric(8), \
        SMALLINT smallint, INTEGER integer, BIGINT bigint, \
        NUMERIC numeric, DECIMAL decimal, \
        REAL real, FLOAT float, BIT bit, \
        CHARACTER character(10), VARCHAR varchar(32), \
        BINARY binary(10), VARBINARY varbinary(64), \
        DA date, TI time, TST timestamp)';

var oracleSql = 'create table types (ID number(8) primary key, \
        SI number(4), INT number(8), BINT number(38), \
        NUM numeric, DEC decimal, \
        RE real, FL float, DB float, BOO number(1), BI number(1), \
        CH char(10), VCH varchar2(32), LVCH varchar2(1024), \
        BIN raw(10), VBIN raw(64),  \
        BL blob, CL clob, \
        DA date, TST timestamp, TI varchar2(64))';

var sqlToUse = defaultSql;

if (/\:sqlserver\:/.test(config.url)) {
  sqlToUse = mssql;
} else if (/:oracle:/.test(config.url)) {
  sqlToUse = oracleSql;
}

describe('Data Types', function() {
  before(function(done) {
    db.execute(sqlToUse, done);
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
    testType('SI', 1, done);
  });
  it('smallint null', function(done) {
    testType('SI', null, done);
  });
  it('integer', function(done) {
    testType('INT', 1, done);
  });
  it('integer null', function(done) {
    testType('INT', null, done);
  });
  it('bigint', function(done) {
    testType('BINT', 1, done);
  });
  it('bigint null', function(done) {
    testType('BINT', null, done);
  });
  it('numeric', function(done) {
    testType('NUM', 1, done);
  });
  it('numeric null', function(done) {
    testType('NUM', null, done);
  });
  it('decimal', function(done) {
    testType('DEC', '123', done);
  });
  it('decimal null', function(done) {
    testType('DEC', null, done);
  });
  it('real', function(done) {
    testType('RE', 3.14, done);
  });
  it('real null', function(done) {
    testType('RE', null, done);
  });
  it('float', function(done) {
    testType('FL', 3.14, done);
  });
  it('float null', function(done) {
    testType('FL', null, done);
  });
  it('double', function(done) {
    testType('DB', 3.14159265, done);
  });
  it('double null', function(done) {
    testType('DB', null, done);
  });
  it('boolean', function(done) {
    testType('BOO', true, done);
  });
  it('boolean null', function(done) {
    testType('BOO', null, done);
  });
  it('bit', function(done) {
    // Treat as a string
    testType('BI', '1', done);
  });
  it('bit null', function(done) {
    testType('BI', null, done);
  });
  it('character', function(done) {
      // Note space padding as per sql
    testType('CH', 'Hello     ', done);
  });
  it('character null', function(done) {
    testType('CH', null, done);
  });
  it('varchar', function(done) {
    testType('VCH', 'Hi there', done);
  });
  it('varchar null', function(done) {
    testType('VCH', null, done);
  });
  it('longvarchar', function(done) {
    testType('LVCH', 'Greetings and salutations', done);
  });
  it('longvarchar null', function(done) {
    testType('LVCH', null, done);
  });
  it('binary', function(done) {
    // Again with space padding
    testType('BIN', new Buffer('Hey there ', 'ascii'), done);
  });
  it('binary null', function(done) {
    testType('BIN', null, done);
  });
  it('varbinary', function(done) {
    testType('VBIN', new Buffer('And ho there'), done);
  });
  it('varbinary null', function(done) {
    testType('VBIN', null, done);
  });
  it('blob', function(done) {
    testType('BL', new Buffer('Ho ho ho'), done);
  });
  it('blob null', function(done) {
    testType('BL', new Buffer('Ho ho ho'), done);
  });
  it('clob', function(done) {
    testType('CL', 'Clobby aren\'t we?', done);
  });
  it('clob null', function(done) {
    testType('CL', 'Clobby aren\'t we?', done);
  });
  it('time', function(done) {
    testType('TI', '16:00:00', done);
  });
  it('time null', function(done) {
    testType('TI', null, done);
  });
  it('date', function(done) {
    testType('DA', '2014-09-22', done);
  });
  it('date null', function(done) {
    testType('DA', null, done);
  });
  it('timestamp null', function(done) {
    testType('TST', null, done);
  });

  it('timestamp', function(done) {
    // Test timestamp separately.
    // SQL databases don't always have as much precision as Java, so round off
    var now = new Date('Mon Sep 22 2014 12:41:01 GMT');
    console.log('Inserting date %s', now);
    db.execute('insert into types(id, tst) values (?, ?)',
      [ id, now ],
      function(err, result) {
        console.log('Insert result = %j, err = %s', result, err);
        assert(!err);
        assert.equal(result.updateCount, 1);

        db.execute('select tst from types where id = ?',
          [ id ],
          function(err, result, rows) {
            console.log('select result %j err = %s rows = %j type = %s', result, err, rows, typeof rows);
            id++;
            assert(!err);
            assert.equal(rows.length, 1);
            //console.log('Returned timestamp: %s, %d', rows[0]['TST'], rows[0]['TST'].getTime());
            assert.equal(rows[0]['TST'], now.toString());
            done();
          });
      });
    });

  });
