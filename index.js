var argv = require('optimist').argv;
var path = require('path');
var fs = require('fs');
var mime = require('mime');
var requests = require("request");
var tmp = require("tmp");

module.exports = {
  parse: function(input_params, json_parsed, callback){
    json_parsed = typeof json_parsed !== 'undefined' || json_parsed === null ? json_parsed : true;

    var request = new Request()

    if (json_parsed == true) {
      params = input_params
    } else {
      try {
        params = JSON.parse(input_params);
      } catch(e) {
        throw "You didn't pass valid json inputs.";
      };
    }

    var num_files = 0;
    var num_written_files = 0;
    var are_all_inputs_processed = false;

    var checkForEnd = function(){
      num_written_files++;
      if (are_all_inputs_processed && num_files == num_written_files){
        callback(request);
      }
    }

    if (!(toType( params ) == "object")){
      throw "Can't parse keys/values from your json inputs.";
    }

    if (!(("_blockspring_spec" in params) && params._blockspring_spec)){
      request.params = params;
      callback(request);
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
            request._errors.push(error);
          }
        });
      }
      // Add any headers to the request object
      else if ((var_name == "_headers") && (toType( params[var_name] ) == "object")){
        request.addHeaders(params[var_name]);
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
      callback(request);
    }
  },
  run: function(block, data, options, callback) {
    // checks in case callback was provided in place of data or options.
    if (typeof data === 'function') {
      // allow data and api_key to be optional
      callback = data;
      data = {};
    } else if (typeof options === 'function') {
      // allow api_key to be optional, but keep callback as last argument
      callback = options;
    } else if (typeof options === "string"){
      options = {
        api_key: options,
        cache: false,
        expiry: null
      }
    }

    // checks in case callback was provided in place of data or options.

    data = typeof data !== 'undefined' || data === null ? data : {};
    options = typeof options !== 'undefined' ? options : { api_key: null, cache: false, expiry: null }

    if (!("api_key" in options)){
      options.api_key = null;
    }

    if (!(toType( data ) == "object")){
      throw "your data needs to be an object.";
    }

    var api_key = options.api_key || process.env.BLOCKSPRING_API_KEY || "";
    var cache = ("cache" in options) ? options.cache : false;
    var expiry = ("expiry" in options) ? options.expiry : null;

    var blockspring_url = process.env.BLOCKSPRING_URL || 'https://sender.blockspring.com'
    var block = block.split("/").slice(-1)[0];

    requests.post({
      url: blockspring_url + "/api_v2/blocks/" + block + "?api_key=" + api_key + "&cache=" + cache + "&expiry=" + expiry,
      body: data,
      json: true
    }, function(err, response, body) {
      if (callback){
        callback(body);
      }
    });
  },

  runParsed: function(block, data, options, callback) {
    // checks in case callback was provided in place of data or options.
    if (typeof data === 'function') {
      // allow data and api_key to be optional
      callback = data;
      data = {};
    } else if (typeof options === 'function') {
      // allow options to be optional, but keep callback as last argument
      callback = options;
    } else if (typeof options === "string"){
      options = {
        api_key: options,
        cache: false,
        expiry: null
      }
    }

    // checks in case callback was provided in place of data or options.

    data = typeof data !== 'undefined' || data === null ? data : {};
    options = typeof options !== 'undefined' ? options : { api_key: null, cache: false, expiry: null }

    if (!("api_key" in options)){
      options.api_key = null;
    }

    if (!(toType( data ) == "object")){
      throw "your data needs to be an object.";
    }

    var api_key = options.api_key || process.env.BLOCKSPRING_API_KEY || "";
    var cache = ("cache" in options) ? options.cache : false;
    var expiry = ("expiry" in options) ? options.expiry : null;

    var blockspring_url = process.env.BLOCKSPRING_URL || 'https://sender.blockspring.com'
    var block = block.split("/").slice(-1)[0];

    requests.post({
      url: blockspring_url + "/api_v2/blocks/" + block + "?api_key=" + api_key + "&cache=" + cache + "&expiry=" + expiry,
      body: data,
      json: true
    }, function(err, response, body) {
      try {
        if (!(toType( body ) == "object")){
          if (callback){
            callback(body);
          }
          return body;
        } else {
          body["_headers"] = response.headers;
        }
      } catch(e) {
        if (callback){
          callback(body);
        }
        return body;
      };
      return this.parse(body, true, callback)
    }.bind(this));
  },


  define: function(block) {
    var processStdin = function(callback) {
      if (process.stdin.isTTY) {
        var request = new Request;
        callback(request);
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
          this.parse(stdIn, false, callback);
        }.bind(this));
      }
    }.bind(this);

    var processArgs = function(request, callback) {
      for (key in argv) {
        if(['_', '$0'].indexOf(key) === -1) {
          request.params[key] = argv[key];
        }
      }
      callback(request);
    };

    // Grab stdin first
    processStdin(function(request){
      // Then try to get arguments
      processArgs(request, function(request){
        // call the block when finished
        var response = new Response;
        block.call({}, request, response);
      });
    });
  }
};

function toType(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

function Request(){
  this.params = {};
  this.stdin = '';
  this._errors = [];
  this._headers = {};

  this.getErrors = function(){
    return this._errors;
  };

  this.addError = function(error){
    this._errors.push(error);
  };

  this.addHeaders = function(headers){
    this._headers = headers;
  };

  this.getHeaders = function(){
    return this._headers;
  };
}

function Response() {
  this.result = {
    _blockspring_spec: true,
    _errors: []
  };

  this.addOutput = function(name, value, callback) {
    this.result[name] = value;
    if(callback) {
      process.nextTick(callback);
    }
    return this;
  };

  this.addFileOutput = function(name, filepath, callback) {
    var filename = path.basename(filepath);

    fs.readFile(filepath, { encoding: 'base64' }, function (err, data) {
      if (err) throw err;

      this.result[name] = {
        "filename": filename,
        "content-type": mime.lookup(filepath),
        "data": data
      };

      if (callback) {
        callback();
      }
    }.bind(this));

    return this;
  };

  this.addErrorOutput = function(title, message, callback) {
    message = typeof message !== 'undefined' ? message : null;

    this.result._errors.push({
      title: title,
      message: message
    })

    if(callback) {
      process.nextTick(callback);
    }
    return this;
  };

  this.end = function() {
    console.log(JSON.stringify(this.result));
  };
}