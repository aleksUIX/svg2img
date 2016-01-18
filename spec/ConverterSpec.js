describe('Converter', function() {
  'use strict';
  var Converter = require('../src/Converter');
  var converter;

  beforeEach(function() {
    var converter = new Converter();
  });

  it('should exist', function() {
    expect(typeof converter).toEqual('object');
  });
//
//  it('should return 2 + 2 = 4', function() {
//    expect(2 + 2).toEqual(4);
//  });
});
