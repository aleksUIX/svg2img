var canvg = require('../libs/canvg');
var CreateCanvas = require('./CreateCanvas');

function SVGtoCanvas() {

  return function(args) {
    var imgData;
    var canvasCreator = new CreateCanvas();

    // this creates and returns array of canvas elements
    var svgSources = canvasCreator.create(args.svgSrc);

    // TODO: this needs to be rewritten to sue newly created canvas elements
    canvg(args.canvasDest, svgSources);
    imgData = args.canvasDest.toDataURL();


    // the below needs to be refactored into separate module
    args.downBtn.removeAttribute('disabled');
    args.downBtn.setAttribute('href', imgData);

    console.log(imgData);
  }
}


module.exports = SVGtoCanvas;
