module.exports = function CreateCanvas() {
  var $body = document.getElementsByTagName('body')[0];
  var canvasArray = [];

  function create(svg) {
    // wrapper for all canvas elements that will be exported
    var canvasWrapper = document.createElement('div');

    // create each canvas on the document fragment
    for (var i = 0; i < svg.length; i++) {
      var canvasPartial = document.createElement('canvas');
      canvasWrapper.appendChild(canvasPartial);
      canvasArray.push(canvasPartial);
    }

    // append canvas elements to the DOM
    $body.appendChild(canvasWrapper);

    // this method will return canvas wrapper for future work
    return canvasArray;
  }

  function getCanvas() {
    return canvasArray;
  }

  return {
    create: create,
    getCanvas: getCanvas
  }
}
