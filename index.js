var argv = require('optimist').argv;
var path = require('path');
var fs = require('fs');
var mime = require('mime');
var requests = require("request");
var tmp = require("tmp");

var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

module.exports = {
  run: function(block, data, api_key, callback) {
    // allow data and api_key to be optional
    if (typeof data === 'function') {
      callback = data;
      data = {};
      api_key = null;
    }
    // allow api_key to be optional, but keep callback as last argument
    else if (typeof api_key === 'function') {
      callback = api_key;
      api_key = null;
    }

    data = typeof data !== 'undefined' || data === null ? data : {};
    api_key = typeof api_key !== 'undefined' ? api_key : null;

    if (!(toType( data ) == "object")){
      throw "your data needs to be an object.";
    }

    var api_key = api_key || process.env.BLOCKSPRING_API_KEY || "";
    var blockspring_url = process.env.BLOCKSPRING_URL || 'https://sender.blockspring.com'
    var block = block.split("/").slice(-1)[0];

    requests.post({
      url: blockspring_url + "/api_v2/blocks/" + block + "?api_key=" + api_key,
      form: data
    },
    function(err, response, body) {
      try {
        body = JSON.parse(body);
      } catch(e) {};

      if (callback){
        callback(body);
      }
    });
  },


  define: function(block) {
    var endCalled = false;
    var libUsed = false;

    var request = {
      params: {},
      stdin: '',
      errors: [],
      getErrors: function(){
        return this.errors;
      },
      addError: function(error){
        this.errors.push(error);
      }
    };

    var response = {
      result: {
        _blockspring_spec: true,
        _errors: []
      },
      addOutput: function(name, value, callback) {
        libUsed = true;
        this.result[name] = value;
        if(callback) {
          process.nextTick(callback);
        }
        return this;
      },
      addFileOutput: function(name, filepath, callback) {
        libUsed = true;
        var filename = path.basename(filepath);

        fs.readFile(filepath, { encoding: 'base64' }, function (err, data) {
          if (err) throw err;

          this.result[name] = {
            filename: filename,
            mimeType: mime.lookup(filepath),
            data: data
          };

          if (callback) {
            callback();
          }
        }.bind(this));

        return this;
      },
      addErrorOutput: function(title, message, callback) {
        libUsed = true;
        message = typeof message !== 'undefined' ? message : null;

        this.result._errors.push({
          title: title,
          message: message
        })

        if(callback) {
          process.nextTick(callback);
        }
        return this;
      },
      end: function() {
        libUsed = true;
        endCalled = true;
        console.log(JSON.stringify(this.result));
      }
    };

    // make sure we print out data if we have received some
    process.on('exit', function(code) {
      if (libUsed === true && endCalled === false) {
        response.end();
      }
    });

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
          var params = JSON.parse(stdIn);

          var num_files = 0;
          var num_written_files = 0;
          var are_all_inputs_processed = false;

          var checkForEnd = function(){
            num_written_files++;
            if (are_all_inputs_processed && num_files == num_written_files){
              callback.call();
            }
          }

          if (!(toType( params ) == "object")){
            throw "Can't parse keys/values from your json inputs.";
          }

          if (!(("_blockspring_spec" in params) && params._blockspring_spec)){
            request.params = params;
            callback.call();
            return;
          }

          Object.keys(params).forEach(function(var_name){

            // Ignore blockspring_spec flag
            if (var_name == "_blockspring_spec"){
              return;
            }
            // Add any errors to the request object
            else if ((var_name == "_errors") && (toType( params[var_name] ) == "array")){
              params[var_name].forEach(function(error){
                if((toType( error ) == "object") && ("title" in error)){
                  request.errors.push(error);
                }
              });
            }
            // Process file spec
            else if (
                toType(params[var_name]) == "object" &&
                "filename" in params[var_name] &&
                params[var_name].filename &&
                ((("data" in params[var_name]) && params[var_name].data) ||
                  (("url" in params[var_name]) && params[var_name].url))
            ) {
              num_files++;
              tmp.tmpName({postfix: '-' + params[var_name].filename }, function _tempNameGenerated(err, tmp_name) {
                if (err) {
                  request.params[var_name] = params[var_name];
                  checkForEnd();
                } else {
                  if ("data" in params[var_name]){
                    fs.writeFile(tmp_name, params[var_name].data, {encoding:'base64'}, function(err){
                      if(err){
                        request.params[var_name] = params[var_name]
                      } else {
                        request.params[var_name] = tmp_name;
                      }
                      checkForEnd();
                    });
                  } else {
                    var file = fs.createWriteStream(tmp_name);
                    requests(params[var_name].url).pipe(file);
                    file.on('finish', function() {
                      request.params[var_name] = tmp_name;
                      checkForEnd();
                    });
                  }
                }
              });
            }
            // Otherwise treat it as a normal input
            else {
              request.params[var_name] = params[var_name];
            }
          });

          // tmp lib might fire callback before looping through all inputs
          // so we need to keep track of when we finish
          are_all_inputs_processed = true;

          if (num_files == num_written_files){
            callback.call();
          }
        });
      }
    };

    var processArgs = function(callback) {
      for (key in argv) {
        if(['_', '$0'].indexOf(key) === -1) {
          request.params[key] = argv[key];
        }
      }
      callback.call();
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
