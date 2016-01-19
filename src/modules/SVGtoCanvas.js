var canvg = require('../libs/canvg');
var CreateCanvas = require('./CreateCanvas');

function SVGtoCanvas() {

  return function(args) {
    var imgData;
    var canvasCreator = new CreateCanvas();

    //
    var svgSources = canvasCreator.create(args.svgSrc);

    canvg(args.canvasDest, args.svgSrc.innerHTML);
    imgData = args.canvasDest.toDataURL();


    // the below needs to be refactored into separate module
    args.downBtn.removeAttribute('disabled');
    args.downBtn.setAttribute('href', imgData);

    console.log(imgData);
  }
}


module.exports = SVGtoCanvas;
