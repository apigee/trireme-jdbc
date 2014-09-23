# Trireme JDBC

This module provides access to JDBC from Node.js.

JDBC is "Java Database Connectivity" and it is the standard API and library set
for connecting to SQL databases from Java.

This module works with Trireme, which is a Node.js runtime built in Java.
It will not work in standard Node.js. There are other modules out there
that use other techniques to attach to databases from Node.

This module exists for two reasons:

* Trireme cannot execute native code, so some existing drivers such as the
Oracle drivers on NPM do not work there.
* There are a lot of quality database drivers out there for JDBC and this
module provides a consistent way to use them all.

## Supported JDBC options

* Connection pooling
* Regular and prepared statements
* Retrieve results via callback or as a stream that may be paused

# Usage

## Connecting to the Database

    var jdbc = require('trireme-jdbc');

    var db = new jdbc.Database({
      url: 'jdbc:foosql:myhost:myport',
      username: 'foobar',
      password: 'secure',
      minConnections: 1,
      maxConnections: 20,
      idleTimeout: 60
    });

## Basic Queries

    db.query('select * from customers',
      function(err, result, rows) {
        console.log('Result: %j', result);
        console.log('Row zero: %j', rows[0]);
      }
    });

    db.query('select * from customers where state = ?',
             { state: 'CA' },
      function(err, result, rows) {
        // ...
      }
    });

## Basic Updates

TODO Can we use "executeQuery" in JDBC or must the user choose?

## Result Streaming

TODO

## Transactions

    var txn = db.beginTransaction();
    txn.query(db.query('update customers set foo = bar where state = ?',
      { state: 'CA' },
      function(err, result, rows) {
        console.log('Result: %j', result);
        console.log('Row zero: %j', rows[0]);
        txn.commit();
      }
    });

# Data Types

TODO
