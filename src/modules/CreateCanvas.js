module.exports = function CreateCanvas() {
  var $body = document.getElementsByTagName('body')[0];
  var canvasArray = [];

  function createCanvas(svg) {
    debugger;

    for (var i = 0; i < svg.length; i++) {
      var canvasPartial = document.createElement('canvas');
      $body.appendChild(canvasPartial);
      canvasArray.push(canvasPartial);
    }

    return canvasArray;
  }

  function getCanvas() {
    return canvasArray;
  }

  return {
    createCanvas: createCanvas,
    getCanvas: getCanvas
  }
}
