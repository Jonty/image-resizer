'use strict';

var _ = require('lodash');

exports.sanitize = function(value, type) {
  if (typeof type === 'undefined') {
    type = 'number';
  }
  switch (type) {
  case 'number':
    return value.toString().replace(/[^0-9]/, '') * 1;
  case 'alpha':
    return value.replace(/[0-9]/, '');
  default:
    return value.replace(/[^0-9]/, '');
  }
};


exports.camelCase = function(input){
  return input.toLowerCase()
    .replace(/_(.)/g, function(match, letter){
      return letter.toUpperCase();
    });
};


// From https://github.com/TheNodeILs/lodash-contrib/blob/19f6386e/_.util.strings.js
var plusRegex = /\+/g;
var bracketRegex = /(?:([^\[]+))|(?:\[(.*?)\])/g;

var urlDecode = function (s) {
  return decodeURIComponent(s.replace(plusRegex, '%20'));
};

exports.fromQuery = function (str) {
  var parameters = str.split('&'),
    obj = {},
    key,
    match,
    lastKey,
    subKey,
    depth;

  // Iterate over key/value pairs
  _.each(parameters, function (parameter) {
    parameter = parameter.split('=');
    key = urlDecode(parameter[0]);
    lastKey = key;
    depth = obj;

    // Reset so we don't have issues when matching the same string
    bracketRegex.lastIndex = 0;

    // Attempt to extract nested values
    while ((match = bracketRegex.exec(key)) !== null) {
      if (!_.isUndefined(match[1])) {

        // If we're at the top nested level, no new object needed
        subKey = match[1];

      } else {

        // If we're at a lower nested level, we need to step down, and make
        // sure that there is an object to place the value into
        subKey = match[2];
        depth[lastKey] = depth[lastKey] || (subKey ? {} : []);
        depth = depth[lastKey];
      }

      // Save the correct key as a hash or an array
      lastKey = subKey || _.size(depth);
    }

    // Assign value to nested object
    depth[lastKey] = urlDecode(parameter[1]);
  });

  return obj;
};
