# Trireme JDBC

This module provides access to JDBC from Node.js.

JDBC is "Java Database Connectivity" and it is the standard API and library set
for connecting to SQL databases from Java.

This module works with [Trireme](https://github.com/apigee/trireme), which is
a Node.js runtime built in Java. It will not work in standard Node.js. There are other modules out there
that use other techniques to attach to databases from Node.

Trireme itself is used at Apigee and elsewhere to embed Node.js scripts
(possibly in large numbers) inside a Java Virtual Machine. However, it cannot
execute the same native code libraries that "normal" node.js code can.
On the other hand, since it runs in Java, we can take advantage of JDBC,
and the huge number of quality drivers that provide database access without
compiling any native code.

## Supported JDBC options

* Connection pooling
* Parameterized queries (aka prepared statements)
* Retrieve results via callback or as a stream
* Transactions

# Usage

## Connecting to the Database

    var jdbc = require('trireme-jdbc');

    var db = new jdbc.Database({
      url: 'jdbc:oracle:thin:@//oraclehostname:1521/ORCL',
      properties: {
        user: 'scott',
        password: 'tiger',
      },
      minConnections: 1,
      maxConnections: 20,
      idleTimeout: 60
    });

Note: If you are running "regular" Node.js and not Trireme, then you will
get an error at this point.

The "Database" object represents a pool of connections to the database.
It may be used to run queries or manage transactions. It takes as its
argument a single object, with the following options:

* *url* (required): The URL for the JDBC driver. It will be specified in the database's
JDBC documentation;
* *properties* (optional): A set of name/value pairs that will be passed to the database.
Almost all JDBC drivers support "user" and "pass". The rest will be
specified in the databases's JDBC documentation.
* *minConnections* (optional): The minimum number of database connections to keep open
even if they are idle. The default is 1.
* *maxConnections* (optional): The maximum number of database connections to keep open
at any time. If more requests are processed in parallel than this number,
then they will wait on a queue until one of the existing connections is
available. The default is 10.
* *idleTimeout* (optional): If a connection is unused for longer than this period of
time (in seconds) and more than "minConnections" are open, the
connection will be closed. The default is 60 seconds.

Since the "Database" does not try to connect to the actual database until it's
used, it does not block and returns the result immediately.

## Basic Queries

    db.execute('select * from employees',
      function(err, result, rows) {
        rows.forEach(function (row) {
          console.log('Row: %j', row);
        });
      });

A basic query is an SQL statement. The callback is called after the
query is complete with three arguments:

* An Error object if the query failed, or "undefined" otherwise.
* A result object containing meta-data about the query
* An array of rows representing the result.

Queries are non-blocking. The result callback will only be delivered when
the query is complete and will never block the thread.

### The Result object

Each successful query returns a "result" object. It may contain one field:

* updateCount: The number of rows affected by the query on an "update"
or "insert" call. Not set for a "select."

### The Rows

Each row is an object. Each column in the row is represented as a single
property, with the name of the propery being the column name, and the value
being the column value. The type of value depends on what the database
returns -- see below for more.

Note that some JDBC drivers return upper-case column names even if the query
used lowercase or mixed-case.

## Parameterized Queries

    db.execute('select * from employees where salary > ?',
             [ 100000 ],
      function(err, result, rows) {
        // ...
      }
    });

    db.execute('insert into employees (name, salary) values (?, ?)',
            [ 'Josiah Carberry', 0 ]
      function(err) {
        // ...
      }
    });

    db.execute('update employees set salary = 10000 where name = ?',
            [ 'Josiah Carberry' ],
      function(err, result) {
        console.log('Affected %d rows', result.updateCount);
        // ...
      }
    });

Parameters may be inserted into any query using "?" just like in regular
JDBC. When parameters are used, the second argument to "execute" must
be an array, with the parameters in the order in which the "?"s appear.

Note that parameterized queries like this are *always* the correct way
to write queries in JDBC for two important reasons:

* They help prevent SQL injection attacks that would otherwise be created
by constructing queries using string concatenation.
* They are faster because the database can optimize for the parameterized
query rather than have to re-optimize the query on every execution.

## Result Streaming

    db.executeStreaming('select * from employees',
      function(err, result, rowStream) {
        rowStream.on('data', function(row) {
          console.log('Got row %j', row);
        });
        rowStream.on('end', function() {
          console.log('End of query');
        });
      });

Large queries will use lots of memory because the entire result set is
streamed into memory, then turned into a JavaScript array, before invoking
the callback.

"executeStreaming" works just like "execute," but the third parameter to the
callback is a stream rather than an array of rows. The caller must then
use normal stream techniques such as calling "read" or listening for
"data" callbacks to receive the results.

Technically, the object that is returned is a "ReadableStream" that runs in
object mode. That means that each time the "data" callback is called, or
"read" is called, the result is a single JavaScript object that represents
a single row.

Since that is the case, the stream may of course be paused and resumed just
like a real stream, which reduces memory pressure on the node app, since
the JDBC driver can buffer batches of rows on the database side as well.

Note that the database connection is kept open and allocated to the stream
until the entire stream has been read. If the goal is not to read the
entire stream, then you must call "destroy" on the stream to return the
connection to the pool.

## Transactions

    db.beginTransaction(function(err, tran) {
      tran.execute('select * from employees where name = ?',
        [ 'Homer Simpson' ],
        function(err, result, rows) {
          // ...

          tran.commit(function(err) {
            // .. Should check the error here
          });
        });
    });

"beginTransaction" starts a database transaction. The transaction object that
is passed to the callback (as the second element) may be used to call
"execute" and "executeStreaming" just like a regular connection.

When finished, you *must* call either "rollback" or "commit." Otherwise,
the connection will never be returned to the pool.

## Cleanup

    db.close();

It's a good idea to call "close" on the Database to return connections if you
know that you are done with the database and don't need it any more.

## Data Types

### Results

When results are returned from the database, the value of each column is
mapped to a JavaScript type depending on the SQL data type that is returned
from the database. The mapping is as follows:

* The numeric types BOOLEAN, SMALLINT, TINYINT, INTEGER, FLOAT, DOUBLE,
NUMERIC, and REAL are converted into a Number.
* The binary types BINARY, BLOB, VARBINARY, and LONGVARBINARY are converted
into Node.js Buffer objects.
* TIMESTAMP types are converted into Date objects.
* NULL is converted into "null."
* Everything else, including DATE, TIME, and BIGINT, is converted into
a String.

### Queries

When passing parameters to the "execute" methods to execute a parameterized
query, the following rules are followed to map each JavaScript object to an
SQL type:

* Strings are converted into Strings.
* Numbers that the JavaScript engine internally represents as a Boolean are
treated as a boolean.
* Numbers that the JavaScript engine internally represents as an int are
treated as an int.
* All other numbers are converted into a double.
* Node.js Buffer objects are converted into arrays of bytes.
* Date objects are turned into SQL "Date" objects.
* Anything else will result in an exception being thrown.

## Connection Pooling

The "Database" object maintains a connection pool automatically. Every
time "execute" is called, a connection is removed from the pool.

Connections are returned in the following cases:

* When an "execute" statement is complete and all rows have been fetched.
* When a transaction is either committed or aborted.
* When the stream from "executeStreaming" has been completely consumed.
* When "destroy" is called on the stream from "executeStreaming."

## Running and Testing

This module is a part of the "trireme-utils" module. When embedding Trireme
into an existing Java application, include "trireme-utils" and this functionality
will be automatically available.

You can also run "trireme" from the command line by pulling it from NPM:

    sudo npm install -g trireme
    trireme <script name>

You will need to have your JDBC driver in the classpath for this to work.
The "trireme" script installed by the NPM module supports the environment
variable "TRIREME_CLASSPATH", which will be appended to the normal
classpath used to run Trireme.

### Testing

The tests are written in Mocha but won't work because Mocha doesn't support
Node. Instead, do the following:

1. Edit "testconf/config.js" to reflect your database. Default is hsqldb.
2. Get your JDBC driver and put it somewhere. For instance, the "drivers" directory.
3. Set the environment variable TRIREME_CLASSPATH to point to the
JDBC driver JAR from the previous step.
4. Run "mocha" with "trireme" rather than just running mocha. Better to show that...

For example:

    export TRIREME_CLASSPATH=$PWD/drivers/hsqldb-2.3.2.jar
    trireme /usr/local/bin/mocha -R spec

Note that not every data type is supported by every JDBC driver, so if
this fails with your database, then let's take a look at the data types.
