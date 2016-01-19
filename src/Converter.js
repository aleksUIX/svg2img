var SVGtoCanvas = require('./modules/SVGtoCanvas');

function Converter() {
  'use strict';

  return function (args) {
    args.svgSrc = args.svgSrc.tagName == 'svg' ? [args.svgSrc] : args.svgSrc.getElementsByTagName('svg');

    var svg2Canvas = new SVGtoCanvas();
    svg2Canvas(args);
  }

}

module.exports = Converter;
