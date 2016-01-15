var Rewriter = require('./modules/Rewriter');


module.exports = function Converter() {
  'use strict';

  return {
    convert: function() {
      new Rewriter(arguments);
    }
  }

};
