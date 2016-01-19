var SVGtoCanvas = require('./modules/SVGtoCanvas');

function Converter() {
  'use strict';

  return function (args) {
    var svg = args.svgSrc.tagName == 'svg' ? args.svgSrc : args.svgSrc.getElementsByTagName('svg');

    console.log(svg);

    var svg2Canvas = new SVGtoCanvas();
    svg2Canvas(args);
  }

}

module.exports = Converter;
