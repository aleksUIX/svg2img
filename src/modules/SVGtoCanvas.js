var canvg = require('../libs/canvg');


function SVGtoCanvas() {

  return function(args) {
    var imgData;

    console.log(args.svgSrc);
    canvg(args.canvasDest, args.svgSrc.innerHTML);
    imgData = args.canvasDest.toDataURL();

    args.downBtn.removeAttribute('disabled');
    args.downBtn.setAttribute('href', imgData);

    console.log(imgData);
  }
}


module.exports = SVGtoCanvas;
