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

var util = require('util');
var stream = require('stream');
var semver = require('semver');

var pool = require('./trireme-jdbc-pool');

var jdbc;

try {
  jdbc = process.binding('trireme-jdbc-wrap');
} catch (e) {
  throw new Error('trireme-jdbc does not appear to be running on Trireme.');
}

if (!semver.satisfies(jdbc.interfaceVersion, '>=1.0.0 < 2.0.0')) {
  throw new Error('Trireme does not support a compatible version of the interface');
}

var DEFAULT_POOL_MIN = 1;
var DEFAULT_POOL_MAX = 10;
var DEFAULT_IDLE_TIMEOUT = 60;

var debug;
var debugEnabled;
if (process.env.NODE_DEBUG && /jdbc/.test(process.env.NODE_DEBUG)) {
  debug = function(a) { console.error('JDBC:', a); };
  debugEnabled = true;
} else {
  debug = function() { };
  debugEnabled = false;
}

function Database(opts) {
  if (!opts) {
    throw new Error('options argument is required');
  }

  if (!opts.url) {
    throw new Error('JDBC connection URL is required');
  }

  if (!opts.minConnections) {
    opts.minConnections = DEFAULT_POOL_MIN;
  }
  if (!opts.maxConnections) {
    opts.maxConnections = DEFAULT_POOL_MAX;
  }
  if (!opts.idleTimeout) {
    opts.idleTimeout = DEFAULT_IDLE_TIMEOUT;
  }
  if (opts.properties) {
    if (typeof opts.properties !== 'object') {
      throw new Error('properties must be an object');
    }
  }

  var self = this;
  var poolOpts = {
    min: opts.minConnections,
    max: opts.maxConnections,
    idleTimeout: opts.idleTimeout * 1000,
    create: function(cb) {
      if (debugEnabled) {
        debug('Creating a new connection for ' + self.url);
      }
      jdbc.createConnection(self.url, opts.properties, cb);
    }
  };

  this.pool = new pool.Pool(poolOpts);

  this.url = opts.url;
}
module.exports.Database = Database;

Database.prototype.close = function(cb) {
  this.pool.close(cb);
};

function checkExecArgs(sql, params, cb) {
  if (typeof sql !== 'string') {
    throw new Error('sql must be a String');
  }
  if (params && !Array.isArray(params)) {
    throw new Error('params should be an array');
  }
  if (typeof cb !== 'function') {
    throw new Error('callback must be a function');
  }
}

Database.prototype.execute = function(sql, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = undefined;
  }
  checkExecArgs(sql, params, cb);

  var self = this;
  debug('Getting a connection from the pool');
  this.pool.alloc(function(err, conn) {
    if (err) {
      if (debugEnabled) {
        debug('JDBC pool error: ' + err);
      }
      cb(err);

    } else {
      debug('Got a connection');
      conn.execute(sql, params, function(err, result, rows) {
        if (debugEnabled) {
          debug('Got an SQL result. err = ' + err);
        }
        self.pool.free(conn);
        cb(err, result, rows);
      });
    }
  });
};

Database.prototype.executeStreaming = function(sql, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = undefined;
  }
  checkExecArgs(sql, params, cb);

  var self = this;
  debug('Getting a connection from the pool');
  this.pool.alloc(function(err, conn) {
    if (err) {
      if (debugEnabled) {
        debug('JDBC pool error: ' + err);
      }
      cb(err);

    } else {
      debug('Got a connection');
      conn.executeStreaming(sql, params, function(err, result, handle) {
        if (debugEnabled) {
          debug('Got an SQL result. err = ' + err);
        }
        if (handle) {
          cb(err, result, new ResultStream(handle, conn, self));
        } else {
          self.pool.free(conn);
          cb(err, result);
        }
      });
    }
  });
};

Database.prototype.beginTransaction = function(cb) {
  var self = this;
  debug('Getting a connection from the pool for a transaction');
  this.pool.alloc(function(err, conn) {
    if (err) {
      if (debugEnabled) {
        debug('JDBC pool error: ' + err);
      }
      cb(err);

    } else {
      debug('Got a connection. Making it transactional.');
      conn.setAutoCommit(false);
      var txn = new Transaction(conn, self);
      cb(undefined, txn);
    }
  });
};

function Transaction(conn, parent) {
  this.conn = conn;
  this.parent = parent;
}

Transaction.prototype.execute = function(sql, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = undefined;
  }
  checkExecArgs(sql, params, cb);

  if (this.closed) {
    throw new Error('Transaction has already completed');
  }

  var self = this;
  debug('Executing SQL inside the transaction');
  this.conn.execute(sql, params, function(err, result, rows) {
    if (debugEnabled) {
      debug('Got an SQL result. err = ' + err);
    }
    cb(err, result, rows);
  });
};

Transaction.prototype.executeStreaming = function(sql, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = undefined;
  }
  checkExecArgs(sql, params, cb);

  if (this.closed) {
    throw new Error('Transaction has already completed');
  }

  var self = this;
  debug('Executing SQL inside the transaction');
  this.conn.executeStreaming(sql, params, function(err, result, handle) {
    if (debugEnabled) {
      debug('Got an SQL result. err = ' + err);
    }
    cb(err, result, new ResultStream(handle, self.conn, self.parent));
  });
};

Transaction.prototype.commit = function(cb) {
  var self = this;
  debug('Committing transaction');

  this.conn.commit(function(err) {
    if (err && debugEnabled) {
      debug('Error on commit: ' + err);
    }
    self.closed = true;
    self.parent.pool.free(self.conn);
    if (cb) {
      cb(err);
    }
  });
};

Transaction.prototype.rollback = function(cb) {
  var self = this;
  debug('Rolling back transaction');

  this.conn.rollback(function(err) {
    if (err && debugEnabled) {
      debug('Error on rollback: ' + err);
    }
    self.closed = true;
    self.parent.pool.free(self.conn);
    if (cb) {
      cb(err);
    }
  });
};

function ResultStream(handle, conn, parent) {
  if (!(this instanceof ResultStream)) {
    return new ResultStream(handle);
  }

  stream.Readable.call(this, { objectMode: true });
  this.handle = handle;
  this.conn = conn;
  this.parent = parent;
}
util.inherits(ResultStream, stream.Readable);

ResultStream.prototype._read = function(size) {
  if (debugEnabled) {
    debug('_read called with ' + size);
  }

  var self = this;
  this.handle.fetchRow(function(err, row, eof) {
    if (err) {
      self.emit('error', err);
    } else {
      if (debugEnabled) {
        debug('Got row. eof = ' + eof);
      }
      if (row) {
        self.push(row);
      }
      if (eof) {
        if (!self.closed) {
          self._close();
        }
        self.push(null);
      }
    }
  });
};

ResultStream.prototype.destroy = function() {
  if (this.closed) {
    throw new Error('Already closed');
  }
  if (!this.ended) {
    this._close();
  }
};

ResultStream.prototype._close = function() {
  debug('Closing handle and returning to pool');
  this.handle.close();
  this.parent.pool.free(this.conn);
  this.closed = true;
  this.emit('close');
};
