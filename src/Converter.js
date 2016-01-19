var Rewriter = require('./modules/Rewriter');
var SVGtoCanvas = require('./modules/SVGtoCanvas');

function Converter() {
  'use strict';
  
  this.convert = new Rewriter();
  return function (args) {
    var svg2Canvas = new SVGtoCanvas();
    svg2Canvas(args); 
  }
  
}

module.exports = Converter;
