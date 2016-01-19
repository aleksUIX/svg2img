describe('CreateCanvas', function() {
  var CreateCanvas = require('../src/modules/CreateCanvas');
  var createCanvas,
      svgArray;

  beforeEach(function() {
    createCanvas = new CreateCanvas();
    // TODO: need to mock document in a proper way...
    svgArray = [document.createElement('svg'), document.createElement('svg')];
  });

  it('should return an array of canvas elements', function() {
    var result = createCanvas.create(svgArray);
    console.log(result);
  });

});
