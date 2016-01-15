var Rewriter = require('./modules/Rewriter');


module.exports = function Converter() {

  return {
    convert: function() {
      new Rewriter(arguments);
    }
  }

};
