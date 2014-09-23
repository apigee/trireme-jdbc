var assert = require('assert');

var jdbc = require('..');
var config = require('../testconf/config');

var db = new jdbc.Database({
  url: config.url,
  properties: config.properties
});

describe('Queries', function() {
  before(function(done) {
    db.execute('create table names (NAME varchar(128), ID integer)', done);
  });

  after(function(done) {
    db.execute('drop table names', function(err) {
      if (err) {
        done(err);
      } else {
        db.close(done);
      }
    });
  });

  it('Insert', function(done) {
    db.execute("insert into names (name, id) values ('Fred Jones', 1)",
      function(err, result) {
        if (err) {
          done(err);
        } else {
          assert.equal(result.updateCount, 1);
          done();
        }
      });
    });
  it('Select *', function(done) {
    db.execute("select * from names",
      function(err, result, rows) {
        console.log('Select result: %j', rows);
        if (err) {
          done(err);
        } else {
          assert.equal(rows.length, 1);
          assert.deepEqual(rows[0]['NAME'], 'Fred Jones');
          assert.deepEqual(rows[0]['ID'], 1);
          done();
        }
      });
    });
  it('Insert with values', function(done) {
    db.execute('insert into names (name, id) values (?, ?)',
      [ 'Davey Jones', 2 ],
      function(err, result) {
        if (err) {
          done(err);
        } else {
          assert.equal(result.updateCount, 1);
          done();
        }
      });
    });
  it('Select with values', function(done) {
    db.execute("select * from names where id = ?",
      [ 2 ],
      function(err, result, rows) {
        console.log('Select result: %j', rows);
        if (err) {
          done(err);
        } else {
          assert.equal(rows.length, 1);
          assert.deepEqual(rows[0]['NAME'], 'Davey Jones');
          assert.deepEqual(rows[0]['ID'], 2);
          done();
        }
      });
    });
  it('Select not found', function(done) {
    db.execute('select * from names where id = 99999',
      function(err, result, rows) {
        if (err) {
          done(err);
        } else {
          assert.equal(rows.length, 0);
          done();
        }
      });
    });

  it('Select with "as"', function(done) {
    db.execute("select id as FOO, name as BAR from names where id = ?",
      [ 2 ],
      function(err, result, rows) {
        console.log('Select result: %j', rows);
        if (err) {
          done(err);
        } else {
          assert.equal(rows.length, 1);
          assert.deepEqual(rows[0]['BAR'], 'Davey Jones');
          assert.deepEqual(rows[0]['FOO'], 2);
          done();
        }
      });
    });
  it('Select invalid table', function(done) {
    db.execute('select * from nonexistent',
      function(err, result, rows) {
        assert(err);
        done();
      });
    });
});
