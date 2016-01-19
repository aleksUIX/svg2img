var canvg = require('../libs/canvg');


function SVGtoCanvas() {

  return function(args) {
    var imgData;

    canvg(args.canvasDest, args.svgSrc.innerHTML);
    imgData = args.canvasDest.toDataURL();
    console.log(imgData);
  }
}


module.exports = SVGtoCanvas;
