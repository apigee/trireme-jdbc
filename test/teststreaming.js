var assert = require('assert');

var jdbc = require('..');
var config = require('../testconf/config');

var db = new jdbc.Database({
  url: config.url,
  properties: config.properties
});

var numRows = 100;

function insertRow(id, done) {
  if (id < numRows) {
    db.executeStreaming('insert into lots (id) values (?)',
      [ id ],
      function(err, result) {
        assert(!err);
        assert.equal(result.updateCount, 1);
        insertRow(id + 1, done);
      });
  } else {
    console.log('Inserted %d rows', id);
    done();
  }
}

 describe('Streaming', function() {
   this.timeout(10000);
   before(function(done) {
     db.execute('create table lots (ID integer)', done);
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

  it('Populate rows', function(done) {
    insertRow(0, done);
  });

  it('Query all rows', function(done) {
    db.executeStreaming('select * from lots',
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
          done();
        });
      });
    });

  it('Query inside transaction', function(done) {
    db.beginTransaction(function(err, tran) {
      assert(!err);

      tran.executeStreaming('select * from lots',
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
            tran.commit();
            done();
          });
        });
    });
  });

  it('Abort query', function(done) {
    db.executeStreaming('select * from lots',
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

  });
