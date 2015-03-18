'use strict';

var _, Logger, env, modifiers, stream, util;

_         = require('lodash');
Logger    = require('./utils/logger');
env       = require('./config/environment_vars');
modifiers = require('./lib/modifiers');
stream    = require('stream');
util      = require('util');


// Simple stream to represent an error at an early stage, for instance a
// request to an excluded source.
function ErrorStream(image){
  stream.Readable.call(this, { objectMode : true });
  this.image = image;
}
util.inherits(ErrorStream, stream.Readable);

ErrorStream.prototype._read = function(){
  this.push(this.image);
  this.push(null);
};


function Image(request){
  // placeholder for any error objects
  this.error = null;

  // flag to stop processing
  this.finished = null;

  // store the query string
  this.queryString = util.string.fromQuery(request.query);

  // set a mark for the start of the process
  this.mark = Date.now();

  // determine the requested modifications
  this.modifiers = modifiers.parse(request.path, this.queryString.modifiers);

  // determine file id
  this.parseUrl(request, this.queryString.modifiers);

  // placeholder for the buffer/stream coming from s3, will hold the image
  this.contents = null;

  // placeholder for the size of the original image
  this.originalContentLength = 0;

  // set the default expiry length, can be altered by a source file
  this.expiryLength = env.IMAGE_EXPIRY;

  // all logging strings will be queued here to be written on response
  this.log = new Logger();
}


// Determine the file id for the requested image
Image.prototype.parseUrl = function(request, qsModifiers){
  // Strip leading slash and split on slash
  var parts = request.path.replace(/^\//,'').split('/');

  if (!qsModifiers || this.modifiers.action !== 'original'){
    // unless we've set keyword modifiers or this is an implicit original request, drop the first part (it'll be the modifier bit)
    // Backwards compat until we change the modifier template, remove later
    parts.shift();
  }
  this.fileId = parts.shift().trim();
};


Image.prototype.isError = function(){ return this.error !== null; };
Image.prototype.isFinished = function(){ return this.finished !== null; };

Image.prototype.isStream = function(){
  var Stream = require('stream').Stream;
  return !!this.contents && this.contents instanceof Stream;
};


Image.prototype.isBuffer = function(){
  return !!this.contents &&
    typeof this.contents === 'object' &&
    Object.prototype.toString.call(this.contents.parent) === '[object SlowBuffer]';
};


Image.prototype.getFile = function(){
  var sources = require('./streams/sources'),
      excludes = env.EXCLUDE_SOURCES ? env.EXCLUDE_SOURCES.split(',') : [],
      streamType = env.DEFAULT_SOURCE,
      Stream = null;

  // look to see if the request has a specified source
  if (_.has(this.modifiers, 'external')){
    if (_.has(sources, this.modifiers.external)){
      streamType = this.modifiers.external;
    }
  }

  // if this request is for an excluded source create an ErrorStream
  if (excludes.indexOf(streamType) > -1){
    this.error = new Error(streamType + ' is an excluded source');
    Stream = ErrorStream;
  }

  // if all is well find the appropriate stream
  else {
    this.log.log('new stream created!');
    Stream = sources[streamType];
  }

  return new Stream(this);
};


Image.prototype.sizeReduction = function(){
  var size = this.contents.length;
  return (this.originalContentLength - size)/1000;
};


Image.prototype.sizeSaving = function(){
  var oCnt = this.originalContentLength,
      size = this.contents.length;
  return ((oCnt - size)/oCnt * 100).toFixed(2);
};


module.exports = Image;
