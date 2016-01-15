var Converter = require('./Converter');

(function() {
  'use strict';

  if (!window.svg2img)
    window.svg2img = new Converter();
})();
