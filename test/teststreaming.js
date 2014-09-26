var assert = require('assert');

var jdbc = require('..');
var config = require('../testconf/config');

var db = new jdbc.Database({
  url: config.url,
  properties: config.properties
});

var numRows = 100;

function insertRow(id, maxId, done) {
  if (id < maxId) {
    db.executeStreaming('insert into lots (id) values (?)',
      [ id ],
      function(err, result) {
        assert(!err);
        assert.equal(result.updateCount, 1);
        insertRow(id + 1, maxId, done);
      });
  } else {
    console.log('Inserted %d rows', id);
    done();
  }
}

 describe('Streaming', function() {
   this.timeout(10000);
   before(function(done) {
     db.execute('create table lots (ID integer)', function(err) {
       if (err) {
         done(err);
       } else {
         // Populate rows 0-99
         insertRow(0, 100, function(err) {
           if (err) {
             done(err);
           } else {
             // Populate rows 200-206
             insertRow(200, 207, done);
           }
         });
      }
    });
   });

   after(function(done) {
     db.execute('drop table lots', function(err) {
       if (err) {
         done(err);
       } else {
         db.close(done);
       }
     });
   });

  it('Query all rows', function(done) {
    // Query the first 100 rows -- should get 100 results
    db.executeStreaming('select * from lots where id <= 100',
      function(err, result, rowStream) {
        //console.log('Got the row stream');
        var rowCount = 0;
        assert(!err);

        rowStream.on('data', function(row) {
          //console.log('Got row %j', row);
          assert.equal(row['ID'], rowCount);
          rowCount++;
        });
        rowStream.on('end', function() {
          console.log('Got end of input');
          assert.equal(rowCount, numRows);
        });
        rowStream.on('close', function() {
          console.log('Got close');
          done();
        });
      });
    });

  it('Query no results', function(done) {
    // Query really high rows -- should get nothing
    db.executeStreaming('select * from lots where id > 100000',
      function(err, result, rowStream) {
        var rowCount = 0;
        assert(!err);

        rowStream.on('data', function(row) {
          //console.log('Got row %j', row);
          rowCount++;
        });
        rowStream.on('end', function() {
          //console.log('Got end of input');
          assert.equal(rowCount, 0);
        });
        rowStream.on('close', function() {
          //console.log('Got close');
          done();
        });
      });
  });

  it('Query odd result size', function(done) {
    // There should be seven rows between 200 and 300
    // We do this because there is not a consistent "limit" statement between DBs
    db.executeStreaming('select * from lots where id >= 200 and id < 300',
      function(err, result, rowStream) {
        var rowCount = 0;
        assert(!err);

        rowStream.on('data', function(row) {
          //console.log('Got row %j', row);
          rowCount++;
        });
        rowStream.on('end', function() {
          //console.log('Got end of input');
          assert.equal(rowCount, 7);
        });
        rowStream.on('close', function() {
          //console.log('Got close');
          done();
        });
      });
  });

  it('Query inside transaction', function(done) {
    db.beginTransaction(function(err, tran) {
      assert(!err);

      tran.executeStreaming('select * from lots where id <= 100',
        function(err, result, rowStream) {
          var rowCount = 0;
          assert(!err);

          rowStream.on('data', function(row) {
            //console.log('Got row %j', row);
            assert.equal(row['ID'], rowCount);
            rowCount++;
          });
          rowStream.on('end', function() {
            console.log('Got end of input');
            assert.equal(rowCount, numRows);
          });
          rowStream.on('close', function() {
            console.log('Got close');
            tran.commit(function(err) {
              assert(!err);
              done(err);
            });
          });
        });
    });
  });

  it('Abort query', function(done) {
    db.executeStreaming('select * from lots where id <= 100',
      function(err, result, rowStream) {
        var rowCount = 0;
        assert(!err);

        rowStream.on('data', function(row) {
          console.log('Got row %j', row);
          rowCount++;
          if (rowCount === 8) {
            console.log('Closing prematurely');
            rowStream.destroy();
          }
        });
        rowStream.on('end', function() {
          console.error('Got end and should not have');
          assert(false);
        });
        rowStream.on('close', function() {
          console.log('Got close');
          done();
        });
      });
    });

  it('Abort query even', function(done) {
    db.executeStreaming('select * from lots where id <= 100',
      function(err, result, rowStream) {
        var rowCount = 0;
        assert(!err);

        rowStream.on('data', function(row) {
          console.log('Got row %j', row);
          rowCount++;
          if (rowCount === 10) {
            console.log('Closing prematurely');
            rowStream.destroy();
          }
        });
        rowStream.on('end', function() {
          console.error('Got end and should not have');
          assert(false);
        });
        rowStream.on('close', function() {
          console.log('Got close');
          done();
        });
      });
    });

    it('Query error', function(done) {
      db.executeStreaming('select * from tabledoesnotexist',
        function(err, result, rowStream) {
          var rowCount = 0;
          assert(err);
          done();
        });
    });
  });
