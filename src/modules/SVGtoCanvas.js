var canvg = require('../libs/canvg');
var CreateCanvas = require('./CreateCanvas');

function SVGtoCanvas() {

  return function(args) {
    var imgData;
    var canvasCreator = new CreateCanvas();


    var svgSources = canvasCreator.createCanvas(args.svgSrc);

    debugger;
    canvg(args.canvasDest, args.svgSrc.innerHTML);
    imgData = args.canvasDest.toDataURL();

    args.downBtn.removeAttribute('disabled');
    args.downBtn.setAttribute('href', imgData);

    console.log(imgData);
  }
}


module.exports = SVGtoCanvas;
