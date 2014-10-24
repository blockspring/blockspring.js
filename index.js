var argv = require('optimist').argv;
var path = require('path');
var fs = require('fs');
var mime = require('mime');
var request = require("request");

module.exports = {
  run: function(block, data, callback) {
    var api_key = process.env.BLOCKSPRING_API_KEY
    if(!api_key) {
      throw "BLOCKSPRING_API_KEY environment variable not set";
    }

    var blockspring_url = process.env.BLOCKSPRING_URL || 'https://sender.blockspring.com'
    
    var block_parts = block.split('/');
    var block_id = block_parts[block_parts.length - 1];

    request.post({
      url: blockspring_url + "/api_v2/blocks/" + block + "?api_key=" + api_key,
      form: data
    },
    function(err, response, body) {
      body = JSON.parse(body);
      try {
        body.results = JSON.parse(body.results);
      } catch(e) {};
      callback(body);
    });
  },


  define: function(block) {
    var endCalled = false;
    var libUsed = false;

    var result = {
      data: {},
      files: {},
      errors: null
    };

    var request = {
      params: {},
      stdin: ''
    };

    var response = {
      addOutput: function(name, value, callback) {
        libUsed = true;
        result.data[name] = value;
        if(callback) {
          process.nextTick(callback);
        }
        return this;
      },
      addFileOutput: function(name, filepath, callback) {
        libUsed = true;
        var filename = path.basename(filepath);

        fs.readFile(filepath, function (err, data) {
          if (err) throw err;

          result.files[name] = {
            filename: filename,
            mimeType: mime.lookup(filepath),
            data: data.toString('base64')
          };

          if (callback) {
            callback();
          }

          return this;
        });

      },
      end: function() {
        libUsed = true;
        endCalled = true;
        console.log(JSON.stringify(result));
      }
    };

    // make sure we print out data if we have received some
    process.on('exit', function(code) {
      if (libUsed === true && endCalled === false) {
        response.end();
      }
    });

    var processArgs = function(callback) {
      for (key in argv) {
        if(['_', '$0'].indexOf(key) === -1) {
          request.params[key] = argv[key];
        }
      }
      callback.call();
    };

    var processStdin = function(callback) {
      if (process.stdin.isTTY) {
        callback.call();
      } else {
        var stdIn = '';
        process.stdin.setEncoding('utf8');

        process.stdin.on('readable', function() {
          var chunk = process.stdin.read();
          if (chunk !== null) {
            stdIn = stdIn + chunk;
          }
        });

        process.stdin.on('end', function() {
          var data = JSON.parse(stdIn);
          request.params = data.data;
          callback.call();
        });
      }
    };

    // Grab stdin first
    processStdin(function(){
      // Then try to get arguments
      processArgs(function(){
        // call the block when finished
        block.call({}, request, response);
      });
    });
  }
};
