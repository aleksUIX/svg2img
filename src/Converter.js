var SVGtoCanvas = require('./modules/SVGtoCanvas');

function Converter() {
  'use strict';

  return function (args) {
    var svg2Canvas = new SVGtoCanvas();

    // check if passed DOM element is an SVG element or contains SVG element,
    // or contains a collection of SVG elements
    args.svgSrc = args.svgSrc.tagName == 'svg' ? [args.svgSrc] : args.svgSrc.getElementsByTagName('svg');

    svg2Canvas(args);
  }

}

module.exports = Converter;
