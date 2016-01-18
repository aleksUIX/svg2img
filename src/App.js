import Converter from './Converter';

(function IIFE() {
  if (!window.svg2img) {
    window.svg2img = new Converter();
  }
})();
