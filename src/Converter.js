const Rewriter = require('./modules/Rewriter');


module.exports = function Converter() {
  return {
    convert: new Rewriter(arguments),
  };
};
