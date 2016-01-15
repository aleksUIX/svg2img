describe('Converter', function() {
  var Converter = require('../../src/Converter');
  var converter;

  beforeEach(function() {
    var converter = new Converter();
  });

  it('should exist', function() {
    expect(typeof converter).toEqual('object');
  });

});
