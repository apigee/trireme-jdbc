/*
 * Copyright 2014 Apigee Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

/*
 * This is a simple connection pool for anything. We're using it here so that we have a little pool that
 * meets our exact requirements. It supports a max size, and once that size is reached, new requests block.
 * Idle connections are closed after "idleTimeout" seconds. Objects in the pool should have a method called
 * "close" that takes a single callback.
 */

function Pool(opts) {
  this.min = opts.min;
  this.max = opts.max;
  this.idleTimeout = opts.idleTimeout * 1000;
  this.create = opts.create;

  this.allocated = 0;
  this.pool = [];
  this.waiters = [];
}
module.exports.Pool = Pool;

Pool.prototype.alloc = function(cb) {
  if (this.pool.length > 0) {
    // Objects in the pool -- return right away
    cb(undefined, this.pool.pop());

  } else if (this.allocated < this.max) {
    // Pool has room -- create a new object and return when it's ready
    var self = this;
    this.create(function(err, o) {
      if (err) {
        cb(err);
      } else {
        self.allocated++;
        cb(undefined, o);
      }
    });

  } else {
    // Pool is full, so we have to wait
    this.waiters.push(function(err, o) {
      cb(err, o);
    });
  }
};

Pool.prototype.free = function(o) {
  if (this.pool.length >= this.max) {
    // Pool full -- close!
    this._closeItem(o);

  } else {
    resetItem(o);
    if (this.waiters.length > 0) {
      // Give to a waiting guy
      var cb = this.waiters.shift();
      cb(undefined, o);

    } else {
      o._idleTime = Date.now();
      this.pool.push(o);
      if (!this.timer) {
        var self = this;
        this.timer = setInterval(function() {
          self._checkIdle();
        }, this.idleTimeout);
      }
    }
  }
};

Pool.prototype.discard = function(o, cb) {
  this._closeItem(o, cb);
};

Pool.prototype.close = function(cb) {
  doClose(this, cb);
};

function doClose(self, cb) {
  var o = self.pool.pop();
  if (o) {
     self._closeItem(o, function() {
       doClose(self, cb);
     });
  } else {
    // All done
    if (self.timer) {
      clearInterval(self.timer);
    }
    if (cb) {
      cb();
    }
  }
}

Pool.prototype._checkIdle = function() {
  var now = Date.now();
  while (this.pool.length > this.min) {
    if (now >= (this.pool[0]._idleTime + this.idleTimeout)) {
      this._closeItem(this.pool.shift());
    } else {
      break;
    }
  }
};

Pool.prototype._closeItem = function(o, cb) {
  var self = this;
  if (o.close) {
    o.close(function() {
      self.allocated--;
      if (cb) {
        cb();
      }
    });
  }
};

function closeItem(o, cb) {
  if (o.close) {
    o.close(function() {
      if (cb) {
        cb();
      }
    });
  }
}

function resetItem(o) {
  if (o.reset) {
    o.reset();
  }
}
