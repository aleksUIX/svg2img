var Converter = require('./Converter');

(function() {
  if (!window.svg2img)
    window.svg2img = new Converter();
})();
