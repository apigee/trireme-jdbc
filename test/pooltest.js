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

  describe('When connection is discarded and closed', function() {
    it('number of allocated connections should decrease', function(done) {
      var P = new pool.Pool({
        min: 1,
        max: 2,
        idleTimeout: 1,
        create: makeObject
      });

      P.alloc(function(err, o) {
        assert(!err);
        assert(o);
        assert.equal(P.allocated, 1);

        P.alloc(function(err, o2) {
          assert(!err);
          assert(o2);
          assert.equal(P.allocated, 2);

          P.discard(o, function() {
            assert.equal(P.allocated, 1);

            P.discard(o2, function() {
              assert.equal(P.allocated, 0);
              done();
            });
          });

        });
      });
    });
  });

  describe('When connections timeouts expire and the connections are closed', function() {
    it('number of allocated connections should decrease to "minConnection"', function(done) {
      this.timeout(5000);

      var minConnections = 1;
      var P = new pool.Pool({
        min: minConnections,
        max: 2,
        idleTimeout: 1,
        create: makeObject
      });

      P.alloc(function(err, o) {
        assert(!err);
        assert(o);
        assert.equal(P.allocated, 1);

        P.alloc(function(err, o2) {
          assert(!err);
          assert(o2);
          assert.equal(P.allocated, 2);

          P.free(o);
          P.free(o2);
          setTimeout(function() {
            assert.equal(P.allocated, minConnections);
            done();
          }, 2000);
        });

      });

    });
  });

  describe('When close() is called', function() {
    it('number of allocated connections should drop down to 0', function(done) {
      this.timeout(5000);

      var minConnections = 1;
      var P = new pool.Pool({
        min: minConnections,
        max: 5,
        idleTimeout: 10,
        create: makeObject
      });

      P.alloc(function(err, o) {
        assert(!err);
        assert(o);
        assert.equal(P.allocated, 1);

        P.alloc(function(err, o2) {
          assert(!err);
          assert(o2);
          assert.equal(P.allocated, 2);

          P.alloc(function(err, o3) {
            assert(!err);
            assert(o3);
            assert.equal(P.allocated, 3);

            P.free(o);
            P.free(o2);
            P.free(o3);
            P.close();

            setTimeout(function() {
              assert.equal(P.allocated, 0);
              done();
            }, 2000);
          });


        });

      });
    });
  });

  describe('When connection is freed and the pool is full', function() {
    it('should be immediately closed and the number of allocated connections should decrease', function(done) {
      this.timeout(5000);

      var minConnections = 1;
      var P = new pool.Pool({
        min: minConnections,
        max: 5,
        idleTimeout: 10,
        create: makeObject
      });

      P.alloc(function(err, o) {
        assert(!err);
        assert(o);
        assert.equal(P.allocated, 1);

        P.alloc(function(err, o2) {
          assert(!err);
          assert(o2);
          assert.equal(P.allocated, 2);

          P.alloc(function(err, o3) {
            assert(!err);
            assert(o3);
            assert.equal(P.allocated, 3);

            // Trick to trigger immediate close in free()
            P.max = 2;

            P.free(o);
            P.free(o2);
            P.free(o3);
            setTimeout(function() {
              assert.equal(P.allocated, 2);
              done();
            }, 1000)

          });
        });
      });
    });
  });
});
