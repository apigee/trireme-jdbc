var assert = require('assert');

var jdbc = require('..');
var config = require('../testconf/config');

var db = new jdbc.Database({
  url: config.url,
  properties: config.properties
});

describe('Transactions', function() {
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

  describe('Commit', function() {
    var trans;

    it('Begin', function(done) {
      db.beginTransaction(function(err, t) {
        if (err) {
          done(err);
        } else {
          trans = t;
          done();
        }
      });
    });

    it('Insert', function(done) {
      trans.execute("insert into names (name, id) values ('Jonesey Jones', 3)",
        function(err, result) {
          if (err) {
            done(err);
          } else {
            assert.equal(result.updateCount, 1);
            done();
          }
        });
      });

    it('Insert', function(done) {
      trans.execute("insert into names (name, id) values ('Janey Jones', 4)",
        function(err, result) {
          if (err) {
            done(err);
          } else {
            assert.equal(result.updateCount, 1);
            done();
          }
        });
      });

    it('Commit', function(done) {
      trans.commit(function(err) {
        done(err);
      });
    });

    it('Verify data', function(done) {
      db.execute("select * from names where id = ?", [ 4 ],
        function(err, result, rows) {
          console.log('Select result: %j', rows);
          if (err) {
            done(err);
          } else {
            assert.equal(rows.length, 1);
            assert.deepEqual(rows[0]['NAME'], 'Janey Jones');
            assert.deepEqual(rows[0]['ID'], 4);
            done();
          }
        });
      });
    });

    describe('Rollback', function() {
      it('Begin transaction', function(done) {
        db.beginTransaction(function(err, t) {
          if (err) {
            done(err);
          } else {
            trans = t;
            done();
          }
        });
      });

      it('Insert', function(done) {
        trans.execute('insert into names (name, id) values (?, ?)',
          [ 'Weirdo Jones', 5 ],
          function(err, result) {
            if (err) {
              done(err);
            } else {
              assert.equal(result.updateCount, 1);
              done();
            }
          });
        });

      it('Rollback', function(done) {
        trans.rollback(function(err) {
          done(err);
        });
      });

      it('Verify rollback', function(done) {
        db.execute("select * from names where id = ?",
          [ 5 ],
          function(err, result, rows) {
            if (err) {
              done(err);
            } else {
              assert.equal(rows.length, 0);
              done();
            }
          });
        });
      });
    });
