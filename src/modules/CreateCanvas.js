module.exports = function CreateCanvas() {
  var $body = document.getElementsByTagName('body');
  var canvasArray = [];

  function createCanvas(svg) {
    svg = svg.tagName === 'svg' ? [svg] : svg.getElementsByTagName('svg');
    console.log(svg);
    if (Array.isArray(svg)) {
      for (var i = 0; i < svg.length; i++) {
        var canvas = $body.appendChild('canvas');
        canvasArray.push(canvas);
      }
    }
  }

  function getCanvas() {
    return canvasArray;
  }

  return {
    createCanvas: createCanvas,
    getCanvas: getCanvas
  }
}
