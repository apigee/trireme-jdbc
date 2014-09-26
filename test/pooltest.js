var assert = require('assert');

var pool = require('../lib/trireme-jdbc-pool');

var createError = false;

function makeObject(cb) {
  if (createError) {
    cb(new Error('Error on create'));
  } else {
    cb(undefined, {
      foo: 'bar',
      bar: 123,
      close: function(cb) {
        this.closed = true;
        cb();
      }
    });
  }
}

describe('Pool Test', function() {
  it('test1', function(done) {
    var P = new pool.Pool({
      min: 1,
      max: 2,
      idleTimeout: 5,
      create: makeObject
    });

    P.alloc(function(err, o) {
      assert(!err);
      assert(o);

      P.free(o);

      P.alloc(function(err, p) {
        assert(!err);
        assert(p);
        assert.equal(o, p);
        P.free(o);
        P.close(done);
      });
    });
  });

  it('test2', function(done) {
    var P = new pool.Pool({
      min: 1,
      max: 2,
      idleTimeout: 5,
      create: makeObject
    });

    P.alloc(function(err, o) {
      assert(!err);
      assert(o);

      P.alloc(function(err, p) {
        assert(!err);
        assert(p);
        assert.notEqual(o, p);
        P.free(p);
        P.free(o);
        P.close(done);
      });
    });
  });

  it('test3', function(done) {
    var P = new pool.Pool({
      min: 1,
      max: 2,
      idleTimeout: 5,
      create: makeObject
    });

    P.alloc(function(err, o) {
      assert(!err);
      assert(o);

      P.alloc(function(err, p) {
        assert(!err);
        assert(p);
        assert.notEqual(o, p);

        setTimeout(function() {
          P.free(p);
        }, 1000);

        P.alloc(function(err, j) {
          assert(!err);
          assert(j);
          assert.equal(j, p);

          P.free(o);
          P.free(p);
          P.close(done);
        });
      });
    });
  });

  it('test error', function(done) {
    var P = new pool.Pool({
      min: 1,
      max: 2,
      idleTimeout: 5,
      create: makeObject
    });

    createError = true;
    P.alloc(function(err, o) {
      assert(err);
      createError = false;
      if (done) {
        done();
      }
    });
  });

  it('test timeout', function(done) {
    this.timeout(5000);

    var P = new pool.Pool({
      min: 0,
      max: 2,
      idleTimeout: 2,
      create: makeObject
    });

    P.alloc(function(err, o) {
      assert(!err);
      assert(o);

      P.free(o);

      setTimeout(function() {
        P.alloc(function(err, p) {
          assert(!err);
          assert(p);
          assert.notEqual(o, p);
          P.free(p);
          P.close(done);
        });
      }, 3000);
    });
  });

  it('Test discard', function(done) {
    var P = new pool.Pool({
      min: 1,
      max: 2,
      idleTimeout: 5,
      create: makeObject
    });

    P.alloc(function(err, o) {
      assert(!err);
      assert(o);
      P.discard(o);
      assert(o.closed);
      done();
    });
  });
});
