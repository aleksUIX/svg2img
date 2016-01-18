var Rewriter = require('./modules/Rewriter');

function Converter() {
  this.convert = new Rewriter();
}

module.exports = Converter;
