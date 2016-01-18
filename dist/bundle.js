(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Converter = require('./Converter');

(function IIFE() {
  if (!window.svg2img) {
    window.svg2img = new Converter();
  }
})();

},{"./Converter":2}],2:[function(require,module,exports){
var Rewriter = require('./modules/Rewriter');

function Converter() {
  this.convert = new Rewriter();
}

module.exports = Converter;

},{"./modules/Rewriter":6}],3:[function(require,module,exports){
/*
 * canvg.js - Javascript SVG parser and renderer on Canvas
 * MIT Licensed
 * Gabe Lerner (gabelerner@gmail.com)
 * http://code.google.com/p/canvg/
 *
 * Requires: rgbcolor.js - http://www.phpied.com/rgb-color-parser-in-javascript/
 */
 (function ( global, factory ) {

    'use strict';

    // export as AMD...
    if ( typeof define !== 'undefined' && define.amd ) {
        define('canvgModule', [ 'rgbcolor', 'stackblur' ], factory );
    }

    // ...or as browserify
    else if ( typeof module !== 'undefined' && module.exports ) {
        module.exports = factory( require( './rgbcolor' ), require( './stackblur' ) );
    }

    global.canvg = factory( global.RGBColor, global.stackBlur );

}( typeof window !== 'undefined' ? window : this, function ( RGBColor, stackBlur ) {

    // canvg(target, s)
    // empty parameters: replace all 'svg' elements on page with 'canvas' elements
    // target: canvas element or the id of a canvas element
    // s: svg string, url to svg file, or xml document
    // opts: optional hash of options
    //		 ignoreMouse: true => ignore mouse events
    //		 ignoreAnimation: true => ignore animations
    //		 ignoreDimensions: true => does not try to resize canvas
    //		 ignoreClear: true => does not clear canvas
    //		 offsetX: int => draws at a x offset
    //		 offsetY: int => draws at a y offset
    //		 scaleWidth: int => scales horizontally to width
    //		 scaleHeight: int => scales vertically to height
    //		 renderCallback: function => will call the function after the first render is completed
    //		 forceRedraw: function => will call the function on every frame, if it returns true, will redraw
    var canvg = function (target, s, opts) {
        // no parameters
        if (target == null && s == null && opts == null) {
            var svgTags = document.querySelectorAll('svg');
            for (var i=0; i<svgTags.length; i++) {
                var svgTag = svgTags[i];
                var c = document.createElement('canvas');
                c.width = svgTag.clientWidth;
                c.height = svgTag.clientHeight;
                svgTag.parentNode.insertBefore(c, svgTag);
                svgTag.parentNode.removeChild(svgTag);
                var div = document.createElement('div');
                div.appendChild(svgTag);
                canvg(c, div.innerHTML);
            }
            return;
        }

        if (typeof target == 'string') {
            target = document.getElementById(target);
        }

        // store class on canvas
        if (target.svg != null) target.svg.stop();
        var svg = build(opts || {});
        // on i.e. 8 for flash canvas, we can't assign the property so check for it
        if (!(target.childNodes.length == 1 && target.childNodes[0].nodeName == 'OBJECT')) target.svg = svg;

        var ctx = target.getContext('2d');
        if (typeof(s.documentElement) != 'undefined') {
            // load from xml doc
            svg.loadXmlDoc(ctx, s);
        }
        else if (s.substr(0,1) == '<') {
            // load from xml string
            svg.loadXml(ctx, s);
        }
        else {
            // load from url
            svg.load(ctx, s);
        }
    }

    // see https://developer.mozilla.org/en-US/docs/Web/API/Element.matches
    var matchesSelector;
    if (typeof(Element.prototype.matches) != 'undefined') {
        matchesSelector = function(node, selector) {
            return node.matches(selector);
        };
    } else if (typeof(Element.prototype.webkitMatchesSelector) != 'undefined') {
        matchesSelector = function(node, selector) {
            return node.webkitMatchesSelector(selector);
        };
    } else if (typeof(Element.prototype.mozMatchesSelector) != 'undefined') {
        matchesSelector = function(node, selector) {
            return node.mozMatchesSelector(selector);
        };
    } else if (typeof(Element.prototype.msMatchesSelector) != 'undefined') {
        matchesSelector = function(node, selector) {
            return node.msMatchesSelector(selector);
        };
    } else if (typeof(Element.prototype.oMatchesSelector) != 'undefined') {
        matchesSelector = function(node, selector) {
            return node.oMatchesSelector(selector);
        };
    } else {
        // requires Sizzle: https://github.com/jquery/sizzle/wiki/Sizzle-Documentation
        // or jQuery: http://jquery.com/download/
        // or Zepto: http://zeptojs.com/#
        // without it, this is a ReferenceError

        if (typeof jQuery === 'function' || typeof Zepto === 'function') {
            matchesSelector = function (node, selector) {
                return $(node).is(selector);
            };
        }

        if (typeof matchesSelector === 'undefined') {
            matchesSelector = Sizzle.matchesSelector;
        }
    }

    // slightly modified version of https://github.com/keeganstreet/specificity/blob/master/specificity.js
    var attributeRegex = /(\[[^\]]+\])/g;
    var idRegex = /(#[^\s\+>~\.\[:]+)/g;
    var classRegex = /(\.[^\s\+>~\.\[:]+)/g;
    var pseudoElementRegex = /(::[^\s\+>~\.\[:]+|:first-line|:first-letter|:before|:after)/gi;
    var pseudoClassWithBracketsRegex = /(:[\w-]+\([^\)]*\))/gi;
    var pseudoClassRegex = /(:[^\s\+>~\.\[:]+)/g;
    var elementRegex = /([^\s\+>~\.\[:]+)/g;
    function getSelectorSpecificity(selector) {
        var typeCount = [0, 0, 0];
        var findMatch = function(regex, type) {
            var matches = selector.match(regex);
            if (matches == null) {
                return;
            }
            typeCount[type] += matches.length;
            selector = selector.replace(regex, ' ');
        };

        selector = selector.replace(/:not\(([^\)]*)\)/g, '     $1 ');
        selector = selector.replace(/{[^]*/gm, ' ');
        findMatch(attributeRegex, 1);
        findMatch(idRegex, 0);
        findMatch(classRegex, 1);
        findMatch(pseudoElementRegex, 2);
        findMatch(pseudoClassWithBracketsRegex, 1);
        findMatch(pseudoClassRegex, 1);
        selector = selector.replace(/[\*\s\+>~]/g, ' ');
        selector = selector.replace(/[#\.]/g, ' ');
        findMatch(elementRegex, 2);
        return typeCount.join('');
    }

    function build(opts) {
        var svg = { opts: opts };

        svg.FRAMERATE = 30;
        svg.MAX_VIRTUAL_PIXELS = 30000;

        svg.log = function(msg) {};
        if (svg.opts['log'] == true && typeof(console) != 'undefined') {
            svg.log = function(msg) { console.log(msg); };
        };

        // globals
        svg.init = function(ctx) {
            var uniqueId = 0;
            svg.UniqueId = function () { uniqueId++; return 'canvg' + uniqueId;	};
            svg.Definitions = {};
            svg.Styles = {};
            svg.StylesSpecificity = {};
            svg.Animations = [];
            svg.Images = [];
            svg.ctx = ctx;
            svg.ViewPort = new (function () {
                this.viewPorts = [];
                this.Clear = function() { this.viewPorts = []; }
                this.SetCurrent = function(width, height) { this.viewPorts.push({ width: width, height: height }); }
                this.RemoveCurrent = function() { this.viewPorts.pop(); }
                this.Current = function() { return this.viewPorts[this.viewPorts.length - 1]; }
                this.width = function() { return this.Current().width; }
                this.height = function() { return this.Current().height; }
                this.ComputeSize = function(d) {
                    if (d != null && typeof(d) == 'number') return d;
                    if (d == 'x') return this.width();
                    if (d == 'y') return this.height();
                    return Math.sqrt(Math.pow(this.width(), 2) + Math.pow(this.height(), 2)) / Math.sqrt(2);
                }
            });
        }
        svg.init();

        // images loaded
        svg.ImagesLoaded = function() {
            for (var i=0; i<svg.Images.length; i++) {
                if (!svg.Images[i].loaded) return false;
            }
            return true;
        }

        // trim
        svg.trim = function(s) { return s.replace(/^\s+|\s+$/g, ''); }

        // compress spaces
        svg.compressSpaces = function(s) { return s.replace(/[\s\r\t\n]+/gm,' '); }

        // ajax
        svg.ajax = function(url) {
            var AJAX;
            if(window.XMLHttpRequest){AJAX=new XMLHttpRequest();}
            else{AJAX=new ActiveXObject('Microsoft.XMLHTTP');}
            if(AJAX){
               AJAX.open('GET',url,false);
               AJAX.send(null);
               return AJAX.responseText;
            }
            return null;
        }

        // parse xml
        svg.parseXml = function(xml) {
            if (typeof(Windows) != 'undefined' && typeof(Windows.Data) != 'undefined' && typeof(Windows.Data.Xml) != 'undefined') {
                var xmlDoc = new Windows.Data.Xml.Dom.XmlDocument();
                var settings = new Windows.Data.Xml.Dom.XmlLoadSettings();
                settings.prohibitDtd = false;
                xmlDoc.loadXml(xml, settings);
                return xmlDoc;
            }
            else if (window.DOMParser)
            {
                var parser = new DOMParser();
                return parser.parseFromString(xml, 'text/xml');
            }
            else
            {
                xml = xml.replace(/<!DOCTYPE svg[^>]*>/, '');
                var xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
                xmlDoc.async = 'false';
                xmlDoc.loadXML(xml);
                return xmlDoc;
            }
        }

        svg.Property = function(name, value) {
            this.name = name;
            this.value = value;
        }
            svg.Property.prototype.getValue = function() {
                return this.value;
            }

            svg.Property.prototype.hasValue = function() {
                return (this.value != null && this.value !== '');
            }

            // return the numerical value of the property
            svg.Property.prototype.numValue = function() {
                if (!this.hasValue()) return 0;

                var n = parseFloat(this.value);
                if ((this.value + '').match(/%$/)) {
                    n = n / 100.0;
                }
                return n;
            }

            svg.Property.prototype.valueOrDefault = function(def) {
                if (this.hasValue()) return this.value;
                return def;
            }

            svg.Property.prototype.numValueOrDefault = function(def) {
                if (this.hasValue()) return this.numValue();
                return def;
            }

            // color extensions
                // augment the current color value with the opacity
                svg.Property.prototype.addOpacity = function(opacityProp) {
                    var newValue = this.value;
                    if (opacityProp.value != null && opacityProp.value != '' && typeof(this.value)=='string') { // can only add opacity to colors, not patterns
                        var color = new RGBColor(this.value);
                        if (color.ok) {
                            newValue = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + opacityProp.numValue() + ')';
                        }
                    }
                    return new svg.Property(this.name, newValue);
                }

            // definition extensions
                // get the definition from the definitions table
                svg.Property.prototype.getDefinition = function() {
                    var name = this.value.match(/#([^\)'"]+)/);
                    if (name) { name = name[1]; }
                    if (!name) { name = this.value; }
                    return svg.Definitions[name];
                }

                svg.Property.prototype.isUrlDefinition = function() {
                    return this.value.indexOf('url(') == 0
                }

                svg.Property.prototype.getFillStyleDefinition = function(e, opacityProp) {
                    var def = this.getDefinition();

                    // gradient
                    if (def != null && def.createGradient) {
                        return def.createGradient(svg.ctx, e, opacityProp);
                    }

                    // pattern
                    if (def != null && def.createPattern) {
                        if (def.getHrefAttribute().hasValue()) {
                            var pt = def.attribute('patternTransform');
                            def = def.getHrefAttribute().getDefinition();
                            if (pt.hasValue()) { def.attribute('patternTransform', true).value = pt.value; }
                        }
                        return def.createPattern(svg.ctx, e);
                    }

                    return null;
                }

            // length extensions
                svg.Property.prototype.getDPI = function(viewPort) {
                    return 96.0; // TODO: compute?
                }

                svg.Property.prototype.getEM = function(viewPort) {
                    var em = 12;

                    var fontSize = new svg.Property('fontSize', svg.Font.Parse(svg.ctx.font).fontSize);
                    if (fontSize.hasValue()) em = fontSize.toPixels(viewPort);

                    return em;
                }

                svg.Property.prototype.getUnits = function() {
                    var s = this.value+'';
                    return s.replace(/[0-9\.\-]/g,'');
                }

                // get the length as pixels
                svg.Property.prototype.toPixels = function(viewPort, processPercent) {
                    if (!this.hasValue()) return 0;
                    var s = this.value+'';
                    if (s.match(/em$/)) return this.numValue() * this.getEM(viewPort);
                    if (s.match(/ex$/)) return this.numValue() * this.getEM(viewPort) / 2.0;
                    if (s.match(/px$/)) return this.numValue();
                    if (s.match(/pt$/)) return this.numValue() * this.getDPI(viewPort) * (1.0 / 72.0);
                    if (s.match(/pc$/)) return this.numValue() * 15;
                    if (s.match(/cm$/)) return this.numValue() * this.getDPI(viewPort) / 2.54;
                    if (s.match(/mm$/)) return this.numValue() * this.getDPI(viewPort) / 25.4;
                    if (s.match(/in$/)) return this.numValue() * this.getDPI(viewPort);
                    if (s.match(/%$/)) return this.numValue() * svg.ViewPort.ComputeSize(viewPort);
                    var n = this.numValue();
                    if (processPercent && n < 1.0) return n * svg.ViewPort.ComputeSize(viewPort);
                    return n;
                }

            // time extensions
                // get the time as milliseconds
                svg.Property.prototype.toMilliseconds = function() {
                    if (!this.hasValue()) return 0;
                    var s = this.value+'';
                    if (s.match(/s$/)) return this.numValue() * 1000;
                    if (s.match(/ms$/)) return this.numValue();
                    return this.numValue();
                }

            // angle extensions
                // get the angle as radians
                svg.Property.prototype.toRadians = function() {
                    if (!this.hasValue()) return 0;
                    var s = this.value+'';
                    if (s.match(/deg$/)) return this.numValue() * (Math.PI / 180.0);
                    if (s.match(/grad$/)) return this.numValue() * (Math.PI / 200.0);
                    if (s.match(/rad$/)) return this.numValue();
                    return this.numValue() * (Math.PI / 180.0);
                }

            // text extensions
                // get the text baseline
                var textBaselineMapping = {
                    'baseline': 'alphabetic',
                    'before-edge': 'top',
                    'text-before-edge': 'top',
                    'middle': 'middle',
                    'central': 'middle',
                    'after-edge': 'bottom',
                    'text-after-edge': 'bottom',
                    'ideographic': 'ideographic',
                    'alphabetic': 'alphabetic',
                    'hanging': 'hanging',
                    'mathematical': 'alphabetic'
                };
                svg.Property.prototype.toTextBaseline = function () {
                    if (!this.hasValue()) return null;
                    return textBaselineMapping[this.value];
                }

        // fonts
        svg.Font = new (function() {
            this.Styles = 'normal|italic|oblique|inherit';
            this.Variants = 'normal|small-caps|inherit';
            this.Weights = 'normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900|inherit';

            this.CreateFont = function(fontStyle, fontVariant, fontWeight, fontSize, fontFamily, inherit) {
                var f = inherit != null ? this.Parse(inherit) : this.CreateFont('', '', '', '', '', svg.ctx.font);
                return {
                    fontFamily: fontFamily || f.fontFamily,
                    fontSize: fontSize || f.fontSize,
                    fontStyle: fontStyle || f.fontStyle,
                    fontWeight: fontWeight || f.fontWeight,
                    fontVariant: fontVariant || f.fontVariant,
                    toString: function () { return [this.fontStyle, this.fontVariant, this.fontWeight, this.fontSize, this.fontFamily].join(' ') }
                }
            }

            var that = this;
            this.Parse = function(s) {
                var f = {};
                var d = svg.trim(svg.compressSpaces(s || '')).split(' ');
                var set = { fontSize: false, fontStyle: false, fontWeight: false, fontVariant: false }
                var ff = '';
                for (var i=0; i<d.length; i++) {
                    if (!set.fontStyle && that.Styles.indexOf(d[i]) != -1) { if (d[i] != 'inherit') f.fontStyle = d[i]; set.fontStyle = true; }
                    else if (!set.fontVariant && that.Variants.indexOf(d[i]) != -1) { if (d[i] != 'inherit') f.fontVariant = d[i]; set.fontStyle = set.fontVariant = true;	}
                    else if (!set.fontWeight && that.Weights.indexOf(d[i]) != -1) {	if (d[i] != 'inherit') f.fontWeight = d[i]; set.fontStyle = set.fontVariant = set.fontWeight = true; }
                    else if (!set.fontSize) { if (d[i] != 'inherit') f.fontSize = d[i].split('/')[0]; set.fontStyle = set.fontVariant = set.fontWeight = set.fontSize = true; }
                    else { if (d[i] != 'inherit') ff += d[i]; }
                } if (ff != '') f.fontFamily = ff;
                return f;
            }
        });

        // points and paths
        svg.ToNumberArray = function(s) {
            var a = svg.trim(svg.compressSpaces((s || '').replace(/,/g, ' '))).split(' ');
            for (var i=0; i<a.length; i++) {
                a[i] = parseFloat(a[i]);
            }
            return a;
        }
        svg.Point = function(x, y) {
            this.x = x;
            this.y = y;
        }
            svg.Point.prototype.angleTo = function(p) {
                return Math.atan2(p.y - this.y, p.x - this.x);
            }

            svg.Point.prototype.applyTransform = function(v) {
                var xp = this.x * v[0] + this.y * v[2] + v[4];
                var yp = this.x * v[1] + this.y * v[3] + v[5];
                this.x = xp;
                this.y = yp;
            }

        svg.CreatePoint = function(s) {
            var a = svg.ToNumberArray(s);
            return new svg.Point(a[0], a[1]);
        }
        svg.CreatePath = function(s) {
            var a = svg.ToNumberArray(s);
            var path = [];
            for (var i=0; i<a.length; i+=2) {
                path.push(new svg.Point(a[i], a[i+1]));
            }
            return path;
        }

        // bounding box
        svg.BoundingBox = function(x1, y1, x2, y2) { // pass in initial points if you want
            this.x1 = Number.NaN;
            this.y1 = Number.NaN;
            this.x2 = Number.NaN;
            this.y2 = Number.NaN;

            this.x = function() { return this.x1; }
            this.y = function() { return this.y1; }
            this.width = function() { return this.x2 - this.x1; }
            this.height = function() { return this.y2 - this.y1; }

            this.addPoint = function(x, y) {
                if (x != null) {
                    if (isNaN(this.x1) || isNaN(this.x2)) {
                        this.x1 = x;
                        this.x2 = x;
                    }
                    if (x < this.x1) this.x1 = x;
                    if (x > this.x2) this.x2 = x;
                }

                if (y != null) {
                    if (isNaN(this.y1) || isNaN(this.y2)) {
                        this.y1 = y;
                        this.y2 = y;
                    }
                    if (y < this.y1) this.y1 = y;
                    if (y > this.y2) this.y2 = y;
                }
            }
            this.addX = function(x) { this.addPoint(x, null); }
            this.addY = function(y) { this.addPoint(null, y); }

            this.addBoundingBox = function(bb) {
                this.addPoint(bb.x1, bb.y1);
                this.addPoint(bb.x2, bb.y2);
            }

            this.addQuadraticCurve = function(p0x, p0y, p1x, p1y, p2x, p2y) {
                var cp1x = p0x + 2/3 * (p1x - p0x); // CP1 = QP0 + 2/3 *(QP1-QP0)
                var cp1y = p0y + 2/3 * (p1y - p0y); // CP1 = QP0 + 2/3 *(QP1-QP0)
                var cp2x = cp1x + 1/3 * (p2x - p0x); // CP2 = CP1 + 1/3 *(QP2-QP0)
                var cp2y = cp1y + 1/3 * (p2y - p0y); // CP2 = CP1 + 1/3 *(QP2-QP0)
                this.addBezierCurve(p0x, p0y, cp1x, cp2x, cp1y,	cp2y, p2x, p2y);
            }

            this.addBezierCurve = function(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
                // from http://blog.hackers-cafe.net/2009/06/how-to-calculate-bezier-curves-bounding.html
                var p0 = [p0x, p0y], p1 = [p1x, p1y], p2 = [p2x, p2y], p3 = [p3x, p3y];
                this.addPoint(p0[0], p0[1]);
                this.addPoint(p3[0], p3[1]);

                for (i=0; i<=1; i++) {
                    var f = function(t) {
                        return Math.pow(1-t, 3) * p0[i]
                        + 3 * Math.pow(1-t, 2) * t * p1[i]
                        + 3 * (1-t) * Math.pow(t, 2) * p2[i]
                        + Math.pow(t, 3) * p3[i];
                    }

                    var b = 6 * p0[i] - 12 * p1[i] + 6 * p2[i];
                    var a = -3 * p0[i] + 9 * p1[i] - 9 * p2[i] + 3 * p3[i];
                    var c = 3 * p1[i] - 3 * p0[i];

                    if (a == 0) {
                        if (b == 0) continue;
                        var t = -c / b;
                        if (0 < t && t < 1) {
                            if (i == 0) this.addX(f(t));
                            if (i == 1) this.addY(f(t));
                        }
                        continue;
                    }

                    var b2ac = Math.pow(b, 2) - 4 * c * a;
                    if (b2ac < 0) continue;
                    var t1 = (-b + Math.sqrt(b2ac)) / (2 * a);
                    if (0 < t1 && t1 < 1) {
                        if (i == 0) this.addX(f(t1));
                        if (i == 1) this.addY(f(t1));
                    }
                    var t2 = (-b - Math.sqrt(b2ac)) / (2 * a);
                    if (0 < t2 && t2 < 1) {
                        if (i == 0) this.addX(f(t2));
                        if (i == 1) this.addY(f(t2));
                    }
                }
            }

            this.isPointInBox = function(x, y) {
                return (this.x1 <= x && x <= this.x2 && this.y1 <= y && y <= this.y2);
            }

            this.addPoint(x1, y1);
            this.addPoint(x2, y2);
        }

        // transforms
        svg.Transform = function(v) {
            var that = this;
            this.Type = {}

            // translate
            this.Type.translate = function(s) {
                this.p = svg.CreatePoint(s);
                this.apply = function(ctx) {
                    ctx.translate(this.p.x || 0.0, this.p.y || 0.0);
                }
                this.unapply = function(ctx) {
                    ctx.translate(-1.0 * this.p.x || 0.0, -1.0 * this.p.y || 0.0);
                }
                this.applyToPoint = function(p) {
                    p.applyTransform([1, 0, 0, 1, this.p.x || 0.0, this.p.y || 0.0]);
                }
            }

            // rotate
            this.Type.rotate = function(s) {
                var a = svg.ToNumberArray(s);
                this.angle = new svg.Property('angle', a[0]);
                this.cx = a[1] || 0;
                this.cy = a[2] || 0;
                this.apply = function(ctx) {
                    ctx.translate(this.cx, this.cy);
                    ctx.rotate(this.angle.toRadians());
                    ctx.translate(-this.cx, -this.cy);
                }
                this.unapply = function(ctx) {
                    ctx.translate(this.cx, this.cy);
                    ctx.rotate(-1.0 * this.angle.toRadians());
                    ctx.translate(-this.cx, -this.cy);
                }
                this.applyToPoint = function(p) {
                    var a = this.angle.toRadians();
                    p.applyTransform([1, 0, 0, 1, this.p.x || 0.0, this.p.y || 0.0]);
                    p.applyTransform([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
                    p.applyTransform([1, 0, 0, 1, -this.p.x || 0.0, -this.p.y || 0.0]);
                }
            }

            this.Type.scale = function(s) {
                this.p = svg.CreatePoint(s);
                this.apply = function(ctx) {
                    ctx.scale(this.p.x || 1.0, this.p.y || this.p.x || 1.0);
                }
                this.unapply = function(ctx) {
                    ctx.scale(1.0 / this.p.x || 1.0, 1.0 / this.p.y || this.p.x || 1.0);
                }
                this.applyToPoint = function(p) {
                    p.applyTransform([this.p.x || 0.0, 0, 0, this.p.y || 0.0, 0, 0]);
                }
            }

            this.Type.matrix = function(s) {
                this.m = svg.ToNumberArray(s);
                this.apply = function(ctx) {
                    ctx.transform(this.m[0], this.m[1], this.m[2], this.m[3], this.m[4], this.m[5]);
                }
                this.unapply = function(ctx) {
                    var a = this.m[0];
                    var b = this.m[2];
                    var c = this.m[4];
                    var d = this.m[1];
                    var e = this.m[3];
                    var f = this.m[5];
                    var g = 0.0;
                    var h = 0.0;
                    var i = 1.0;
                    var det = 1 / (a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g));
                    ctx.transform(
                        det*(e*i-f*h),
                        det*(f*g-d*i),
                        det*(c*h-b*i),
                        det*(a*i-c*g),
                        det*(b*f-c*e),
                        det*(c*d-a*f)
                    );
                }
                this.applyToPoint = function(p) {
                    p.applyTransform(this.m);
                }
            }

            this.Type.SkewBase = function(s) {
                this.base = that.Type.matrix;
                this.base(s);
                this.angle = new svg.Property('angle', s);
            }
            this.Type.SkewBase.prototype = new this.Type.matrix;

            this.Type.skewX = function(s) {
                this.base = that.Type.SkewBase;
                this.base(s);
                this.m = [1, 0, Math.tan(this.angle.toRadians()), 1, 0, 0];
            }
            this.Type.skewX.prototype = new this.Type.SkewBase;

            this.Type.skewY = function(s) {
                this.base = that.Type.SkewBase;
                this.base(s);
                this.m = [1, Math.tan(this.angle.toRadians()), 0, 1, 0, 0];
            }
            this.Type.skewY.prototype = new this.Type.SkewBase;

            this.transforms = [];

            this.apply = function(ctx) {
                for (var i=0; i<this.transforms.length; i++) {
                    this.transforms[i].apply(ctx);
                }
            }

            this.unapply = function(ctx) {
                for (var i=this.transforms.length-1; i>=0; i--) {
                    this.transforms[i].unapply(ctx);
                }
            }

            this.applyToPoint = function(p) {
                for (var i=0; i<this.transforms.length; i++) {
                    this.transforms[i].applyToPoint(p);
                }
            }

            var data = svg.trim(svg.compressSpaces(v)).replace(/\)([a-zA-Z])/g, ') $1').replace(/\)(\s?,\s?)/g,') ').split(/\s(?=[a-z])/);
            for (var i=0; i<data.length; i++) {
                var type = svg.trim(data[i].split('(')[0]);
                var s = data[i].split('(')[1].replace(')','');
                var transform = new this.Type[type](s);
                transform.type = type;
                this.transforms.push(transform);
            }
        }

        // aspect ratio
        svg.AspectRatio = function(ctx, aspectRatio, width, desiredWidth, height, desiredHeight, minX, minY, refX, refY) {
            // aspect ratio - http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
            aspectRatio = svg.compressSpaces(aspectRatio);
            aspectRatio = aspectRatio.replace(/^defer\s/,''); // ignore defer
            var align = aspectRatio.split(' ')[0] || 'xMidYMid';
            var meetOrSlice = aspectRatio.split(' ')[1] || 'meet';

            // calculate scale
            var scaleX = width / desiredWidth;
            var scaleY = height / desiredHeight;
            var scaleMin = Math.min(scaleX, scaleY);
            var scaleMax = Math.max(scaleX, scaleY);
            if (meetOrSlice == 'meet') { desiredWidth *= scaleMin; desiredHeight *= scaleMin; }
            if (meetOrSlice == 'slice') { desiredWidth *= scaleMax; desiredHeight *= scaleMax; }

            refX = new svg.Property('refX', refX);
            refY = new svg.Property('refY', refY);
            if (refX.hasValue() && refY.hasValue()) {
                ctx.translate(-scaleMin * refX.toPixels('x'), -scaleMin * refY.toPixels('y'));
            }
            else {
                // align
                if (align.match(/^xMid/) && ((meetOrSlice == 'meet' && scaleMin == scaleY) || (meetOrSlice == 'slice' && scaleMax == scaleY))) ctx.translate(width / 2.0 - desiredWidth / 2.0, 0);
                if (align.match(/YMid$/) && ((meetOrSlice == 'meet' && scaleMin == scaleX) || (meetOrSlice == 'slice' && scaleMax == scaleX))) ctx.translate(0, height / 2.0 - desiredHeight / 2.0);
                if (align.match(/^xMax/) && ((meetOrSlice == 'meet' && scaleMin == scaleY) || (meetOrSlice == 'slice' && scaleMax == scaleY))) ctx.translate(width - desiredWidth, 0);
                if (align.match(/YMax$/) && ((meetOrSlice == 'meet' && scaleMin == scaleX) || (meetOrSlice == 'slice' && scaleMax == scaleX))) ctx.translate(0, height - desiredHeight);
            }

            // scale
            if (align == 'none') ctx.scale(scaleX, scaleY);
            else if (meetOrSlice == 'meet') ctx.scale(scaleMin, scaleMin);
            else if (meetOrSlice == 'slice') ctx.scale(scaleMax, scaleMax);

            // translate
            ctx.translate(minX == null ? 0 : -minX, minY == null ? 0 : -minY);
        }

        // elements
        svg.Element = {}

        svg.EmptyProperty = new svg.Property('EMPTY', '');

        svg.Element.ElementBase = function(node) {
            this.attributes = {};
            this.styles = {};
            this.stylesSpecificity = {};
            this.children = [];

            // get or create attribute
            this.attribute = function(name, createIfNotExists) {
                var a = this.attributes[name];
                if (a != null) return a;

                if (createIfNotExists == true) { a = new svg.Property(name, ''); this.attributes[name] = a; }
                return a || svg.EmptyProperty;
            }

            this.getHrefAttribute = function() {
                for (var a in this.attributes) {
                    if (a == 'href' || a.match(/:href$/)) {
                        return this.attributes[a];
                    }
                }
                return svg.EmptyProperty;
            }

            // get or create style, crawls up node tree
            this.style = function(name, createIfNotExists, skipAncestors) {
                var s = this.styles[name];
                if (s != null) return s;

                var a = this.attribute(name);
                if (a != null && a.hasValue()) {
                    this.styles[name] = a; // move up to me to cache
                    return a;
                }

                if (skipAncestors != true) {
                    var p = this.parent;
                    if (p != null) {
                        var ps = p.style(name);
                        if (ps != null && ps.hasValue()) {
                            return ps;
                        }
                    }
                }

                if (createIfNotExists == true) { s = new svg.Property(name, ''); this.styles[name] = s; }
                return s || svg.EmptyProperty;
            }

            // base render
            this.render = function(ctx) {
                // don't render display=none
                if (this.style('display').value == 'none') return;

                // don't render visibility=hidden
                if (this.style('visibility').value == 'hidden') return;

                ctx.save();
                if (this.style('mask').hasValue()) { // mask
                    var mask = this.style('mask').getDefinition();
                    if (mask != null) mask.apply(ctx, this);
                }
                else if (this.style('filter').hasValue()) { // filter
                    var filter = this.style('filter').getDefinition();
                    if (filter != null) filter.apply(ctx, this);
                }
                else {
                    this.setContext(ctx);
                    this.renderChildren(ctx);
                    this.clearContext(ctx);
                }
                ctx.restore();
            }

            // base set context
            this.setContext = function(ctx) {
                // OVERRIDE ME!
            }

            // base clear context
            this.clearContext = function(ctx) {
                // OVERRIDE ME!
            }

            // base render children
            this.renderChildren = function(ctx) {
                for (var i=0; i<this.children.length; i++) {
                    this.children[i].render(ctx);
                }
            }

            this.addChild = function(childNode, create) {
                var child = childNode;
                if (create) child = svg.CreateElement(childNode);
                child.parent = this;
                if (child.type != 'title') { this.children.push(child);	}
            }

            this.addStylesFromStyleDefinition = function () {
                // add styles
                for (var selector in svg.Styles) {
                    if (selector[0] != '@' && matchesSelector(node, selector)) {
                        var styles = svg.Styles[selector];
                        var specificity = svg.StylesSpecificity[selector];
                        if (styles != null) {
                            for (var name in styles) {
                                var existingSpecificity = this.stylesSpecificity[name];
                                if (typeof(existingSpecificity) == 'undefined') {
                                    existingSpecificity = '000';
                                }
                                if (specificity > existingSpecificity) {
                                    this.styles[name] = styles[name];
                                    this.stylesSpecificity[name] = specificity;
                                }
                            }
                        }
                    }
                }
            };

            if (node != null && node.nodeType == 1) { //ELEMENT_NODE
                // add attributes
                for (var i=0; i<node.attributes.length; i++) {
                    var attribute = node.attributes[i];
                    this.attributes[attribute.nodeName] = new svg.Property(attribute.nodeName, attribute.value);
                }

                this.addStylesFromStyleDefinition();

                // add inline styles
                if (this.attribute('style').hasValue()) {
                    var styles = this.attribute('style').value.split(';');
                    for (var i=0; i<styles.length; i++) {
                        if (svg.trim(styles[i]) != '') {
                            var style = styles[i].split(':');
                            var name = svg.trim(style[0]);
                            var value = svg.trim(style[1]);
                            this.styles[name] = new svg.Property(name, value);
                        }
                    }
                }

                // add id
                if (this.attribute('id').hasValue()) {
                    if (svg.Definitions[this.attribute('id').value] == null) {
                        svg.Definitions[this.attribute('id').value] = this;
                    }
                }

                // add children
                for (var i=0; i<node.childNodes.length; i++) {
                    var childNode = node.childNodes[i];
                    if (childNode.nodeType == 1) this.addChild(childNode, true); //ELEMENT_NODE
                    if (this.captureTextNodes && (childNode.nodeType == 3 || childNode.nodeType == 4)) {
                        var text = childNode.value || childNode.text || childNode.textContent || '';
                        if (svg.compressSpaces(text) != '') {
                            this.addChild(new svg.Element.tspan(childNode), false); // TEXT_NODE
                        }
                    }
                }
            }
        }

        svg.Element.RenderedElementBase = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.setContext = function(ctx) {
                // fill
                if (this.style('fill').isUrlDefinition()) {
                    var fs = this.style('fill').getFillStyleDefinition(this, this.style('fill-opacity'));
                    if (fs != null) ctx.fillStyle = fs;
                }
                else if (this.style('fill').hasValue()) {
                    var fillStyle = this.style('fill');
                    if (fillStyle.value == 'currentColor') fillStyle.value = this.style('color').value;
                    if (fillStyle.value != 'inherit') ctx.fillStyle = (fillStyle.value == 'none' ? 'rgba(0,0,0,0)' : fillStyle.value);
                }
                if (this.style('fill-opacity').hasValue()) {
                    var fillStyle = new svg.Property('fill', ctx.fillStyle);
                    fillStyle = fillStyle.addOpacity(this.style('fill-opacity'));
                    ctx.fillStyle = fillStyle.value;
                }

                // stroke
                if (this.style('stroke').isUrlDefinition()) {
                    var fs = this.style('stroke').getFillStyleDefinition(this, this.style('stroke-opacity'));
                    if (fs != null) ctx.strokeStyle = fs;
                }
                else if (this.style('stroke').hasValue()) {
                    var strokeStyle = this.style('stroke');
                    if (strokeStyle.value == 'currentColor') strokeStyle.value = this.style('color').value;
                    if (strokeStyle.value != 'inherit') ctx.strokeStyle = (strokeStyle.value == 'none' ? 'rgba(0,0,0,0)' : strokeStyle.value);
                }
                if (this.style('stroke-opacity').hasValue()) {
                    var strokeStyle = new svg.Property('stroke', ctx.strokeStyle);
                    strokeStyle = strokeStyle.addOpacity(this.style('stroke-opacity'));
                    ctx.strokeStyle = strokeStyle.value;
                }
                if (this.style('stroke-width').hasValue()) {
                    var newLineWidth = this.style('stroke-width').toPixels();
                    ctx.lineWidth = newLineWidth == 0 ? 0.001 : newLineWidth; // browsers don't respect 0
                }
                if (this.style('stroke-linecap').hasValue()) ctx.lineCap = this.style('stroke-linecap').value;
                if (this.style('stroke-linejoin').hasValue()) ctx.lineJoin = this.style('stroke-linejoin').value;
                if (this.style('stroke-miterlimit').hasValue()) ctx.miterLimit = this.style('stroke-miterlimit').value;
                if (this.style('stroke-dasharray').hasValue() && this.style('stroke-dasharray').value != 'none') {
                    var gaps = svg.ToNumberArray(this.style('stroke-dasharray').value);
                    if (typeof(ctx.setLineDash) != 'undefined') { ctx.setLineDash(gaps); }
                    else if (typeof(ctx.webkitLineDash) != 'undefined') { ctx.webkitLineDash = gaps; }
                    else if (typeof(ctx.mozDash) != 'undefined' && !(gaps.length==1 && gaps[0]==0)) { ctx.mozDash = gaps; }

                    var offset = this.style('stroke-dashoffset').numValueOrDefault(1);
                    if (typeof(ctx.lineDashOffset) != 'undefined') { ctx.lineDashOffset = offset; }
                    else if (typeof(ctx.webkitLineDashOffset) != 'undefined') { ctx.webkitLineDashOffset = offset; }
                    else if (typeof(ctx.mozDashOffset) != 'undefined') { ctx.mozDashOffset = offset; }
                }

                // font
                if (typeof(ctx.font) != 'undefined') {
                    ctx.font = svg.Font.CreateFont(
                        this.style('font-style').value,
                        this.style('font-variant').value,
                        this.style('font-weight').value,
                        this.style('font-size').hasValue() ? this.style('font-size').toPixels() + 'px' : '',
                        this.style('font-family').value).toString();
                }

                // transform
                if (this.style('transform', false, true).hasValue()) {
                    var transform = new svg.Transform(this.style('transform', false, true).value);
                    transform.apply(ctx);
                }

                // clip
                if (this.style('clip-path', false, true).hasValue()) {
                    var clip = this.style('clip-path', false, true).getDefinition();
                    if (clip != null) clip.apply(ctx);
                }

                // opacity
                if (this.style('opacity').hasValue()) {
                    ctx.globalAlpha = this.style('opacity').numValue();
                }
            }
        }
        svg.Element.RenderedElementBase.prototype = new svg.Element.ElementBase;

        svg.Element.PathElementBase = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.path = function(ctx) {
                if (ctx != null) ctx.beginPath();
                return new svg.BoundingBox();
            }

            this.renderChildren = function(ctx) {
                this.path(ctx);
                svg.Mouse.checkPath(this, ctx);
                if (ctx.fillStyle != '') {
                    if (this.style('fill-rule').valueOrDefault('inherit') != 'inherit') { ctx.fill(this.style('fill-rule').value); }
                    else { ctx.fill(); }
                }
                if (ctx.strokeStyle != '') ctx.stroke();

                var markers = this.getMarkers();
                if (markers != null) {
                    if (this.style('marker-start').isUrlDefinition()) {
                        var marker = this.style('marker-start').getDefinition();
                        marker.render(ctx, markers[0][0], markers[0][1]);
                    }
                    if (this.style('marker-mid').isUrlDefinition()) {
                        var marker = this.style('marker-mid').getDefinition();
                        for (var i=1;i<markers.length-1;i++) {
                            marker.render(ctx, markers[i][0], markers[i][1]);
                        }
                    }
                    if (this.style('marker-end').isUrlDefinition()) {
                        var marker = this.style('marker-end').getDefinition();
                        marker.render(ctx, markers[markers.length-1][0], markers[markers.length-1][1]);
                    }
                }
            }

            this.getBoundingBox = function() {
                return this.path();
            }

            this.getMarkers = function() {
                return null;
            }
        }
        svg.Element.PathElementBase.prototype = new svg.Element.RenderedElementBase;

        // svg element
        svg.Element.svg = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.baseClearContext = this.clearContext;
            this.clearContext = function(ctx) {
                this.baseClearContext(ctx);
                svg.ViewPort.RemoveCurrent();
            }

            this.baseSetContext = this.setContext;
            this.setContext = function(ctx) {
                // initial values and defaults
                ctx.strokeStyle = 'rgba(0,0,0,0)';
                ctx.lineCap = 'butt';
                ctx.lineJoin = 'miter';
                ctx.miterLimit = 4;
                if (typeof(ctx.font) != 'undefined' && typeof(window.getComputedStyle) != 'undefined') {
                    ctx.font = window.getComputedStyle(ctx.canvas).getPropertyValue('font');
                }

                this.baseSetContext(ctx);

                // create new view port
                if (!this.attribute('x').hasValue()) this.attribute('x', true).value = 0;
                if (!this.attribute('y').hasValue()) this.attribute('y', true).value = 0;
                ctx.translate(this.attribute('x').toPixels('x'), this.attribute('y').toPixels('y'));

                var width = svg.ViewPort.width();
                var height = svg.ViewPort.height();

                if (!this.attribute('width').hasValue()) this.attribute('width', true).value = '100%';
                if (!this.attribute('height').hasValue()) this.attribute('height', true).value = '100%';
                if (typeof(this.root) == 'undefined') {
                    width = this.attribute('width').toPixels('x');
                    height = this.attribute('height').toPixels('y');

                    var x = 0;
                    var y = 0;
                    if (this.attribute('refX').hasValue() && this.attribute('refY').hasValue()) {
                        x = -this.attribute('refX').toPixels('x');
                        y = -this.attribute('refY').toPixels('y');
                    }

                    if (this.attribute('overflow').valueOrDefault('hidden') != 'visible') {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(width, y);
                        ctx.lineTo(width, height);
                        ctx.lineTo(x, height);
                        ctx.closePath();
                        ctx.clip();
                    }
                }
                svg.ViewPort.SetCurrent(width, height);

                // viewbox
                if (this.attribute('viewBox').hasValue()) {
                    var viewBox = svg.ToNumberArray(this.attribute('viewBox').value);
                    var minX = viewBox[0];
                    var minY = viewBox[1];
                    width = viewBox[2];
                    height = viewBox[3];

                    svg.AspectRatio(ctx,
                                    this.attribute('preserveAspectRatio').value,
                                    svg.ViewPort.width(),
                                    width,
                                    svg.ViewPort.height(),
                                    height,
                                    minX,
                                    minY,
                                    this.attribute('refX').value,
                                    this.attribute('refY').value);

                    svg.ViewPort.RemoveCurrent();
                    svg.ViewPort.SetCurrent(viewBox[2], viewBox[3]);
                }
            }
        }
        svg.Element.svg.prototype = new svg.Element.RenderedElementBase;

        // rect element
        svg.Element.rect = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            this.path = function(ctx) {
                var x = this.attribute('x').toPixels('x');
                var y = this.attribute('y').toPixels('y');
                var width = this.attribute('width').toPixels('x');
                var height = this.attribute('height').toPixels('y');
                var rx = this.attribute('rx').toPixels('x');
                var ry = this.attribute('ry').toPixels('y');
                if (this.attribute('rx').hasValue() && !this.attribute('ry').hasValue()) ry = rx;
                if (this.attribute('ry').hasValue() && !this.attribute('rx').hasValue()) rx = ry;
                rx = Math.min(rx, width / 2.0);
                ry = Math.min(ry, height / 2.0);
                if (ctx != null) {
                    ctx.beginPath();
                    ctx.moveTo(x + rx, y);
                    ctx.lineTo(x + width - rx, y);
                    ctx.quadraticCurveTo(x + width, y, x + width, y + ry)
                    ctx.lineTo(x + width, y + height - ry);
                    ctx.quadraticCurveTo(x + width, y + height, x + width - rx, y + height)
                    ctx.lineTo(x + rx, y + height);
                    ctx.quadraticCurveTo(x, y + height, x, y + height - ry)
                    ctx.lineTo(x, y + ry);
                    ctx.quadraticCurveTo(x, y, x + rx, y)
                    ctx.closePath();
                }

                return new svg.BoundingBox(x, y, x + width, y + height);
            }
        }
        svg.Element.rect.prototype = new svg.Element.PathElementBase;

        // circle element
        svg.Element.circle = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            this.path = function(ctx) {
                var cx = this.attribute('cx').toPixels('x');
                var cy = this.attribute('cy').toPixels('y');
                var r = this.attribute('r').toPixels();

                if (ctx != null) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                    ctx.closePath();
                }

                return new svg.BoundingBox(cx - r, cy - r, cx + r, cy + r);
            }
        }
        svg.Element.circle.prototype = new svg.Element.PathElementBase;

        // ellipse element
        svg.Element.ellipse = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            this.path = function(ctx) {
                var KAPPA = 4 * ((Math.sqrt(2) - 1) / 3);
                var rx = this.attribute('rx').toPixels('x');
                var ry = this.attribute('ry').toPixels('y');
                var cx = this.attribute('cx').toPixels('x');
                var cy = this.attribute('cy').toPixels('y');

                if (ctx != null) {
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - ry);
                    ctx.bezierCurveTo(cx + (KAPPA * rx), cy - ry,  cx + rx, cy - (KAPPA * ry), cx + rx, cy);
                    ctx.bezierCurveTo(cx + rx, cy + (KAPPA * ry), cx + (KAPPA * rx), cy + ry, cx, cy + ry);
                    ctx.bezierCurveTo(cx - (KAPPA * rx), cy + ry, cx - rx, cy + (KAPPA * ry), cx - rx, cy);
                    ctx.bezierCurveTo(cx - rx, cy - (KAPPA * ry), cx - (KAPPA * rx), cy - ry, cx, cy - ry);
                    ctx.closePath();
                }

                return new svg.BoundingBox(cx - rx, cy - ry, cx + rx, cy + ry);
            }
        }
        svg.Element.ellipse.prototype = new svg.Element.PathElementBase;

        // line element
        svg.Element.line = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            this.getPoints = function() {
                return [
                    new svg.Point(this.attribute('x1').toPixels('x'), this.attribute('y1').toPixels('y')),
                    new svg.Point(this.attribute('x2').toPixels('x'), this.attribute('y2').toPixels('y'))];
            }

            this.path = function(ctx) {
                var points = this.getPoints();

                if (ctx != null) {
                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);
                    ctx.lineTo(points[1].x, points[1].y);
                }

                return new svg.BoundingBox(points[0].x, points[0].y, points[1].x, points[1].y);
            }

            this.getMarkers = function() {
                var points = this.getPoints();
                var a = points[0].angleTo(points[1]);
                return [[points[0], a], [points[1], a]];
            }
        }
        svg.Element.line.prototype = new svg.Element.PathElementBase;

        // polyline element
        svg.Element.polyline = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            this.points = svg.CreatePath(this.attribute('points').value);
            this.path = function(ctx) {
                var bb = new svg.BoundingBox(this.points[0].x, this.points[0].y);
                if (ctx != null) {
                    ctx.beginPath();
                    ctx.moveTo(this.points[0].x, this.points[0].y);
                }
                for (var i=1; i<this.points.length; i++) {
                    bb.addPoint(this.points[i].x, this.points[i].y);
                    if (ctx != null) ctx.lineTo(this.points[i].x, this.points[i].y);
                }
                return bb;
            }

            this.getMarkers = function() {
                var markers = [];
                for (var i=0; i<this.points.length - 1; i++) {
                    markers.push([this.points[i], this.points[i].angleTo(this.points[i+1])]);
                }
                markers.push([this.points[this.points.length-1], markers[markers.length-1][1]]);
                return markers;
            }
        }
        svg.Element.polyline.prototype = new svg.Element.PathElementBase;

        // polygon element
        svg.Element.polygon = function(node) {
            this.base = svg.Element.polyline;
            this.base(node);

            this.basePath = this.path;
            this.path = function(ctx) {
                var bb = this.basePath(ctx);
                if (ctx != null) {
                    ctx.lineTo(this.points[0].x, this.points[0].y);
                    ctx.closePath();
                }
                return bb;
            }
        }
        svg.Element.polygon.prototype = new svg.Element.polyline;

        // path element
        svg.Element.path = function(node) {
            this.base = svg.Element.PathElementBase;
            this.base(node);

            var d = this.attribute('d').value;
            // TODO: convert to real lexer based on http://www.w3.org/TR/SVG11/paths.html#PathDataBNF
            d = d.replace(/,/gm,' '); // get rid of all commas
            // As the end of a match can also be the start of the next match, we need to run this replace twice.
            for(var i=0; i<2; i++)
                d = d.replace(/([MmZzLlHhVvCcSsQqTtAa])([^\s])/gm,'$1 $2'); // suffix commands with spaces
            d = d.replace(/([^\s])([MmZzLlHhVvCcSsQqTtAa])/gm,'$1 $2'); // prefix commands with spaces
            d = d.replace(/([0-9])([+\-])/gm,'$1 $2'); // separate digits on +- signs
            // Again, we need to run this twice to find all occurances
            for(var i=0; i<2; i++)
                d = d.replace(/(\.[0-9]*)(\.)/gm,'$1 $2'); // separate digits when they start with a comma
            d = d.replace(/([Aa](\s+[0-9]+){3})\s+([01])\s*([01])/gm,'$1 $3 $4 '); // shorthand elliptical arc path syntax
            d = svg.compressSpaces(d); // compress multiple spaces
            d = svg.trim(d);
            this.PathParser = new (function(d) {
                this.tokens = d.split(' ');

                this.reset = function() {
                    this.i = -1;
                    this.command = '';
                    this.previousCommand = '';
                    this.start = new svg.Point(0, 0);
                    this.control = new svg.Point(0, 0);
                    this.current = new svg.Point(0, 0);
                    this.points = [];
                    this.angles = [];
                }

                this.isEnd = function() {
                    return this.i >= this.tokens.length - 1;
                }

                this.isCommandOrEnd = function() {
                    if (this.isEnd()) return true;
                    return this.tokens[this.i + 1].match(/^[A-Za-z]$/) != null;
                }

                this.isRelativeCommand = function() {
                    switch(this.command)
                    {
                        case 'm':
                        case 'l':
                        case 'h':
                        case 'v':
                        case 'c':
                        case 's':
                        case 'q':
                        case 't':
                        case 'a':
                        case 'z':
                            return true;
                            break;
                    }
                    return false;
                }

                this.getToken = function() {
                    this.i++;
                    return this.tokens[this.i];
                }

                this.getScalar = function() {
                    return parseFloat(this.getToken());
                }

                this.nextCommand = function() {
                    this.previousCommand = this.command;
                    this.command = this.getToken();
                }

                this.getPoint = function() {
                    var p = new svg.Point(this.getScalar(), this.getScalar());
                    return this.makeAbsolute(p);
                }

                this.getAsControlPoint = function() {
                    var p = this.getPoint();
                    this.control = p;
                    return p;
                }

                this.getAsCurrentPoint = function() {
                    var p = this.getPoint();
                    this.current = p;
                    return p;
                }

                this.getReflectedControlPoint = function() {
                    if (this.previousCommand.toLowerCase() != 'c' &&
                        this.previousCommand.toLowerCase() != 's' &&
                        this.previousCommand.toLowerCase() != 'q' &&
                        this.previousCommand.toLowerCase() != 't' ){
                        return this.current;
                    }

                    // reflect point
                    var p = new svg.Point(2 * this.current.x - this.control.x, 2 * this.current.y - this.control.y);
                    return p;
                }

                this.makeAbsolute = function(p) {
                    if (this.isRelativeCommand()) {
                        p.x += this.current.x;
                        p.y += this.current.y;
                    }
                    return p;
                }

                this.addMarker = function(p, from, priorTo) {
                    // if the last angle isn't filled in because we didn't have this point yet ...
                    if (priorTo != null && this.angles.length > 0 && this.angles[this.angles.length-1] == null) {
                        this.angles[this.angles.length-1] = this.points[this.points.length-1].angleTo(priorTo);
                    }
                    this.addMarkerAngle(p, from == null ? null : from.angleTo(p));
                }

                this.addMarkerAngle = function(p, a) {
                    this.points.push(p);
                    this.angles.push(a);
                }

                this.getMarkerPoints = function() { return this.points; }
                this.getMarkerAngles = function() {
                    for (var i=0; i<this.angles.length; i++) {
                        if (this.angles[i] == null) {
                            for (var j=i+1; j<this.angles.length; j++) {
                                if (this.angles[j] != null) {
                                    this.angles[i] = this.angles[j];
                                    break;
                                }
                            }
                        }
                    }
                    return this.angles;
                }
            })(d);

            this.path = function(ctx) {
                var pp = this.PathParser;
                pp.reset();

                var bb = new svg.BoundingBox();
                if (ctx != null) ctx.beginPath();
                while (!pp.isEnd()) {
                    pp.nextCommand();
                    switch (pp.command) {
                    case 'M':
                    case 'm':
                        var p = pp.getAsCurrentPoint();
                        pp.addMarker(p);
                        bb.addPoint(p.x, p.y);
                        if (ctx != null) ctx.moveTo(p.x, p.y);
                        pp.start = pp.current;
                        while (!pp.isCommandOrEnd()) {
                            var p = pp.getAsCurrentPoint();
                            pp.addMarker(p, pp.start);
                            bb.addPoint(p.x, p.y);
                            if (ctx != null) ctx.lineTo(p.x, p.y);
                        }
                        break;
                    case 'L':
                    case 'l':
                        while (!pp.isCommandOrEnd()) {
                            var c = pp.current;
                            var p = pp.getAsCurrentPoint();
                            pp.addMarker(p, c);
                            bb.addPoint(p.x, p.y);
                            if (ctx != null) ctx.lineTo(p.x, p.y);
                        }
                        break;
                    case 'H':
                    case 'h':
                        while (!pp.isCommandOrEnd()) {
                            var newP = new svg.Point((pp.isRelativeCommand() ? pp.current.x : 0) + pp.getScalar(), pp.current.y);
                            pp.addMarker(newP, pp.current);
                            pp.current = newP;
                            bb.addPoint(pp.current.x, pp.current.y);
                            if (ctx != null) ctx.lineTo(pp.current.x, pp.current.y);
                        }
                        break;
                    case 'V':
                    case 'v':
                        while (!pp.isCommandOrEnd()) {
                            var newP = new svg.Point(pp.current.x, (pp.isRelativeCommand() ? pp.current.y : 0) + pp.getScalar());
                            pp.addMarker(newP, pp.current);
                            pp.current = newP;
                            bb.addPoint(pp.current.x, pp.current.y);
                            if (ctx != null) ctx.lineTo(pp.current.x, pp.current.y);
                        }
                        break;
                    case 'C':
                    case 'c':
                        while (!pp.isCommandOrEnd()) {
                            var curr = pp.current;
                            var p1 = pp.getPoint();
                            var cntrl = pp.getAsControlPoint();
                            var cp = pp.getAsCurrentPoint();
                            pp.addMarker(cp, cntrl, p1);
                            bb.addBezierCurve(curr.x, curr.y, p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
                            if (ctx != null) ctx.bezierCurveTo(p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
                        }
                        break;
                    case 'S':
                    case 's':
                        while (!pp.isCommandOrEnd()) {
                            var curr = pp.current;
                            var p1 = pp.getReflectedControlPoint();
                            var cntrl = pp.getAsControlPoint();
                            var cp = pp.getAsCurrentPoint();
                            pp.addMarker(cp, cntrl, p1);
                            bb.addBezierCurve(curr.x, curr.y, p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
                            if (ctx != null) ctx.bezierCurveTo(p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
                        }
                        break;
                    case 'Q':
                    case 'q':
                        while (!pp.isCommandOrEnd()) {
                            var curr = pp.current;
                            var cntrl = pp.getAsControlPoint();
                            var cp = pp.getAsCurrentPoint();
                            pp.addMarker(cp, cntrl, cntrl);
                            bb.addQuadraticCurve(curr.x, curr.y, cntrl.x, cntrl.y, cp.x, cp.y);
                            if (ctx != null) ctx.quadraticCurveTo(cntrl.x, cntrl.y, cp.x, cp.y);
                        }
                        break;
                    case 'T':
                    case 't':
                        while (!pp.isCommandOrEnd()) {
                            var curr = pp.current;
                            var cntrl = pp.getReflectedControlPoint();
                            pp.control = cntrl;
                            var cp = pp.getAsCurrentPoint();
                            pp.addMarker(cp, cntrl, cntrl);
                            bb.addQuadraticCurve(curr.x, curr.y, cntrl.x, cntrl.y, cp.x, cp.y);
                            if (ctx != null) ctx.quadraticCurveTo(cntrl.x, cntrl.y, cp.x, cp.y);
                        }
                        break;
                    case 'A':
                    case 'a':
                        while (!pp.isCommandOrEnd()) {
                            var curr = pp.current;
                            var rx = pp.getScalar();
                            var ry = pp.getScalar();
                            var xAxisRotation = pp.getScalar() * (Math.PI / 180.0);
                            var largeArcFlag = pp.getScalar();
                            var sweepFlag = pp.getScalar();
                            var cp = pp.getAsCurrentPoint();

                            // Conversion from endpoint to center parameterization
                            // http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
                            // x1', y1'
                            var currp = new svg.Point(
                                Math.cos(xAxisRotation) * (curr.x - cp.x) / 2.0 + Math.sin(xAxisRotation) * (curr.y - cp.y) / 2.0,
                                -Math.sin(xAxisRotation) * (curr.x - cp.x) / 2.0 + Math.cos(xAxisRotation) * (curr.y - cp.y) / 2.0
                            );
                            // adjust radii
                            var l = Math.pow(currp.x,2)/Math.pow(rx,2)+Math.pow(currp.y,2)/Math.pow(ry,2);
                            if (l > 1) {
                                rx *= Math.sqrt(l);
                                ry *= Math.sqrt(l);
                            }
                            // cx', cy'
                            var s = (largeArcFlag == sweepFlag ? -1 : 1) * Math.sqrt(
                                ((Math.pow(rx,2)*Math.pow(ry,2))-(Math.pow(rx,2)*Math.pow(currp.y,2))-(Math.pow(ry,2)*Math.pow(currp.x,2))) /
                                (Math.pow(rx,2)*Math.pow(currp.y,2)+Math.pow(ry,2)*Math.pow(currp.x,2))
                            );
                            if (isNaN(s)) s = 0;
                            var cpp = new svg.Point(s * rx * currp.y / ry, s * -ry * currp.x / rx);
                            // cx, cy
                            var centp = new svg.Point(
                                (curr.x + cp.x) / 2.0 + Math.cos(xAxisRotation) * cpp.x - Math.sin(xAxisRotation) * cpp.y,
                                (curr.y + cp.y) / 2.0 + Math.sin(xAxisRotation) * cpp.x + Math.cos(xAxisRotation) * cpp.y
                            );
                            // vector magnitude
                            var m = function(v) { return Math.sqrt(Math.pow(v[0],2) + Math.pow(v[1],2)); }
                            // ratio between two vectors
                            var r = function(u, v) { return (u[0]*v[0]+u[1]*v[1]) / (m(u)*m(v)) }
                            // angle between two vectors
                            var a = function(u, v) { return (u[0]*v[1] < u[1]*v[0] ? -1 : 1) * Math.acos(r(u,v)); }
                            // initial angle
                            var a1 = a([1,0], [(currp.x-cpp.x)/rx,(currp.y-cpp.y)/ry]);
                            // angle delta
                            var u = [(currp.x-cpp.x)/rx,(currp.y-cpp.y)/ry];
                            var v = [(-currp.x-cpp.x)/rx,(-currp.y-cpp.y)/ry];
                            var ad = a(u, v);
                            if (r(u,v) <= -1) ad = Math.PI;
                            if (r(u,v) >= 1) ad = 0;

                            // for markers
                            var dir = 1 - sweepFlag ? 1.0 : -1.0;
                            var ah = a1 + dir * (ad / 2.0);
                            var halfWay = new svg.Point(
                                centp.x + rx * Math.cos(ah),
                                centp.y + ry * Math.sin(ah)
                            );
                            pp.addMarkerAngle(halfWay, ah - dir * Math.PI / 2);
                            pp.addMarkerAngle(cp, ah - dir * Math.PI);

                            bb.addPoint(cp.x, cp.y); // TODO: this is too naive, make it better
                            if (ctx != null) {
                                var r = rx > ry ? rx : ry;
                                var sx = rx > ry ? 1 : rx / ry;
                                var sy = rx > ry ? ry / rx : 1;

                                ctx.translate(centp.x, centp.y);
                                ctx.rotate(xAxisRotation);
                                ctx.scale(sx, sy);
                                ctx.arc(0, 0, r, a1, a1 + ad, 1 - sweepFlag);
                                ctx.scale(1/sx, 1/sy);
                                ctx.rotate(-xAxisRotation);
                                ctx.translate(-centp.x, -centp.y);
                            }
                        }
                        break;
                    case 'Z':
                    case 'z':
                        if (ctx != null) ctx.closePath();
                        pp.current = pp.start;
                    }
                }

                return bb;
            }

            this.getMarkers = function() {
                var points = this.PathParser.getMarkerPoints();
                var angles = this.PathParser.getMarkerAngles();

                var markers = [];
                for (var i=0; i<points.length; i++) {
                    markers.push([points[i], angles[i]]);
                }
                return markers;
            }
        }
        svg.Element.path.prototype = new svg.Element.PathElementBase;

        // pattern element
        svg.Element.pattern = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.createPattern = function(ctx, element) {
                var width = this.attribute('width').toPixels('x', true);
                var height = this.attribute('height').toPixels('y', true);

                // render me using a temporary svg element
                var tempSvg = new svg.Element.svg();
                tempSvg.attributes['viewBox'] = new svg.Property('viewBox', this.attribute('viewBox').value);
                tempSvg.attributes['width'] = new svg.Property('width', width + 'px');
                tempSvg.attributes['height'] = new svg.Property('height', height + 'px');
                tempSvg.attributes['transform'] = new svg.Property('transform', this.attribute('patternTransform').value);
                tempSvg.children = this.children;

                var c = document.createElement('canvas');
                c.width = width;
                c.height = height;
                var cctx = c.getContext('2d');
                if (this.attribute('x').hasValue() && this.attribute('y').hasValue()) {
                    cctx.translate(this.attribute('x').toPixels('x', true), this.attribute('y').toPixels('y', true));
                }
                // render 3x3 grid so when we transform there's no white space on edges
                for (var x=-1; x<=1; x++) {
                    for (var y=-1; y<=1; y++) {
                        cctx.save();
                        tempSvg.attributes['x'] = new svg.Property('x', x * c.width);
                        tempSvg.attributes['y'] = new svg.Property('y', y * c.height);
                        tempSvg.render(cctx);
                        cctx.restore();
                    }
                }
                var pattern = ctx.createPattern(c, 'repeat');
                return pattern;
            }
        }
        svg.Element.pattern.prototype = new svg.Element.ElementBase;

        // marker element
        svg.Element.marker = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.baseRender = this.render;
            this.render = function(ctx, point, angle) {
                ctx.translate(point.x, point.y);
                if (this.attribute('orient').valueOrDefault('auto') == 'auto') ctx.rotate(angle);
                if (this.attribute('markerUnits').valueOrDefault('strokeWidth') == 'strokeWidth') ctx.scale(ctx.lineWidth, ctx.lineWidth);
                ctx.save();

                // render me using a temporary svg element
                var tempSvg = new svg.Element.svg();
                tempSvg.attributes['viewBox'] = new svg.Property('viewBox', this.attribute('viewBox').value);
                tempSvg.attributes['refX'] = new svg.Property('refX', this.attribute('refX').value);
                tempSvg.attributes['refY'] = new svg.Property('refY', this.attribute('refY').value);
                tempSvg.attributes['width'] = new svg.Property('width', this.attribute('markerWidth').value);
                tempSvg.attributes['height'] = new svg.Property('height', this.attribute('markerHeight').value);
                tempSvg.attributes['fill'] = new svg.Property('fill', this.attribute('fill').valueOrDefault('black'));
                tempSvg.attributes['stroke'] = new svg.Property('stroke', this.attribute('stroke').valueOrDefault('none'));
                tempSvg.children = this.children;
                tempSvg.render(ctx);

                ctx.restore();
                if (this.attribute('markerUnits').valueOrDefault('strokeWidth') == 'strokeWidth') ctx.scale(1/ctx.lineWidth, 1/ctx.lineWidth);
                if (this.attribute('orient').valueOrDefault('auto') == 'auto') ctx.rotate(-angle);
                ctx.translate(-point.x, -point.y);
            }
        }
        svg.Element.marker.prototype = new svg.Element.ElementBase;

        // definitions element
        svg.Element.defs = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.render = function(ctx) {
                // NOOP
            }
        }
        svg.Element.defs.prototype = new svg.Element.ElementBase;

        // base for gradients
        svg.Element.GradientBase = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.stops = [];
            for (var i=0; i<this.children.length; i++) {
                var child = this.children[i];
                if (child.type == 'stop') this.stops.push(child);
            }

            this.getGradient = function() {
                // OVERRIDE ME!
            }

            this.gradientUnits = function () {
                return this.attribute('gradientUnits').valueOrDefault('objectBoundingBox');
            }

            this.attributesToInherit = ['gradientUnits'];

            this.inheritStopContainer = function (stopsContainer) {
                for (var i=0; i<this.attributesToInherit.length; i++) {
                    var attributeToInherit = this.attributesToInherit[i];
                    if (!this.attribute(attributeToInherit).hasValue() && stopsContainer.attribute(attributeToInherit).hasValue()) {
                        this.attribute(attributeToInherit, true).value = stopsContainer.attribute(attributeToInherit).value;
                    }
                }
            }

            this.createGradient = function(ctx, element, parentOpacityProp) {
                var stopsContainer = this;
                if (this.getHrefAttribute().hasValue()) {
                    stopsContainer = this.getHrefAttribute().getDefinition();
                    this.inheritStopContainer(stopsContainer);
                }

                var addParentOpacity = function (color) {
                    if (parentOpacityProp.hasValue()) {
                        var p = new svg.Property('color', color);
                        return p.addOpacity(parentOpacityProp).value;
                    }
                    return color;
                };

                var g = this.getGradient(ctx, element);
                if (g == null) return addParentOpacity(stopsContainer.stops[stopsContainer.stops.length - 1].color);
                for (var i=0; i<stopsContainer.stops.length; i++) {
                    g.addColorStop(stopsContainer.stops[i].offset, addParentOpacity(stopsContainer.stops[i].color));
                }

                if (this.attribute('gradientTransform').hasValue()) {
                    // render as transformed pattern on temporary canvas
                    var rootView = svg.ViewPort.viewPorts[0];

                    var rect = new svg.Element.rect();
                    rect.attributes['x'] = new svg.Property('x', -svg.MAX_VIRTUAL_PIXELS/3.0);
                    rect.attributes['y'] = new svg.Property('y', -svg.MAX_VIRTUAL_PIXELS/3.0);
                    rect.attributes['width'] = new svg.Property('width', svg.MAX_VIRTUAL_PIXELS);
                    rect.attributes['height'] = new svg.Property('height', svg.MAX_VIRTUAL_PIXELS);

                    var group = new svg.Element.g();
                    group.attributes['transform'] = new svg.Property('transform', this.attribute('gradientTransform').value);
                    group.children = [ rect ];

                    var tempSvg = new svg.Element.svg();
                    tempSvg.attributes['x'] = new svg.Property('x', 0);
                    tempSvg.attributes['y'] = new svg.Property('y', 0);
                    tempSvg.attributes['width'] = new svg.Property('width', rootView.width);
                    tempSvg.attributes['height'] = new svg.Property('height', rootView.height);
                    tempSvg.children = [ group ];

                    var c = document.createElement('canvas');
                    c.width = rootView.width;
                    c.height = rootView.height;
                    var tempCtx = c.getContext('2d');
                    tempCtx.fillStyle = g;
                    tempSvg.render(tempCtx);
                    return tempCtx.createPattern(c, 'no-repeat');
                }

                return g;
            }
        }
        svg.Element.GradientBase.prototype = new svg.Element.ElementBase;

        // linear gradient element
        svg.Element.linearGradient = function(node) {
            this.base = svg.Element.GradientBase;
            this.base(node);

            this.attributesToInherit.push('x1');
            this.attributesToInherit.push('y1');
            this.attributesToInherit.push('x2');
            this.attributesToInherit.push('y2');

            this.getGradient = function(ctx, element) {
                var bb = this.gradientUnits() == 'objectBoundingBox' ? element.getBoundingBox() : null;

                if (!this.attribute('x1').hasValue()
                 && !this.attribute('y1').hasValue()
                 && !this.attribute('x2').hasValue()
                 && !this.attribute('y2').hasValue()) {
                    this.attribute('x1', true).value = 0;
                    this.attribute('y1', true).value = 0;
                    this.attribute('x2', true).value = 1;
                    this.attribute('y2', true).value = 0;
                 }

                var x1 = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.x() + bb.width() * this.attribute('x1').numValue()
                    : this.attribute('x1').toPixels('x'));
                var y1 = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.y() + bb.height() * this.attribute('y1').numValue()
                    : this.attribute('y1').toPixels('y'));
                var x2 = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.x() + bb.width() * this.attribute('x2').numValue()
                    : this.attribute('x2').toPixels('x'));
                var y2 = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.y() + bb.height() * this.attribute('y2').numValue()
                    : this.attribute('y2').toPixels('y'));

                if (x1 == x2 && y1 == y2) return null;
                return ctx.createLinearGradient(x1, y1, x2, y2);
            }
        }
        svg.Element.linearGradient.prototype = new svg.Element.GradientBase;

        // radial gradient element
        svg.Element.radialGradient = function(node) {
            this.base = svg.Element.GradientBase;
            this.base(node);

            this.attributesToInherit.push('cx');
            this.attributesToInherit.push('cy');
            this.attributesToInherit.push('r');
            this.attributesToInherit.push('fx');
            this.attributesToInherit.push('fy');

            this.getGradient = function(ctx, element) {
                var bb = element.getBoundingBox();

                if (!this.attribute('cx').hasValue()) this.attribute('cx', true).value = '50%';
                if (!this.attribute('cy').hasValue()) this.attribute('cy', true).value = '50%';
                if (!this.attribute('r').hasValue()) this.attribute('r', true).value = '50%';

                var cx = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.x() + bb.width() * this.attribute('cx').numValue()
                    : this.attribute('cx').toPixels('x'));
                var cy = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.y() + bb.height() * this.attribute('cy').numValue()
                    : this.attribute('cy').toPixels('y'));

                var fx = cx;
                var fy = cy;
                if (this.attribute('fx').hasValue()) {
                    fx = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.x() + bb.width() * this.attribute('fx').numValue()
                    : this.attribute('fx').toPixels('x'));
                }
                if (this.attribute('fy').hasValue()) {
                    fy = (this.gradientUnits() == 'objectBoundingBox'
                    ? bb.y() + bb.height() * this.attribute('fy').numValue()
                    : this.attribute('fy').toPixels('y'));
                }

                var r = (this.gradientUnits() == 'objectBoundingBox'
                    ? (bb.width() + bb.height()) / 2.0 * this.attribute('r').numValue()
                    : this.attribute('r').toPixels());

                return ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
            }
        }
        svg.Element.radialGradient.prototype = new svg.Element.GradientBase;

        // gradient stop element
        svg.Element.stop = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.offset = this.attribute('offset').numValue();
            if (this.offset < 0) this.offset = 0;
            if (this.offset > 1) this.offset = 1;

            var stopColor = this.style('stop-color', true);
            if (stopColor.value === '') stopColor.value = '#000';
            if (this.style('stop-opacity').hasValue()) stopColor = stopColor.addOpacity(this.style('stop-opacity'));
            this.color = stopColor.value;
        }
        svg.Element.stop.prototype = new svg.Element.ElementBase;

        // animation base element
        svg.Element.AnimateBase = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            svg.Animations.push(this);

            this.duration = 0.0;
            this.begin = this.attribute('begin').toMilliseconds();
            this.maxDuration = this.begin + this.attribute('dur').toMilliseconds();

            this.getProperty = function() {
                var attributeType = this.attribute('attributeType').value;
                var attributeName = this.attribute('attributeName').value;

                if (attributeType == 'CSS') {
                    return this.parent.style(attributeName, true);
                }
                return this.parent.attribute(attributeName, true);
            };

            this.initialValue = null;
            this.initialUnits = '';
            this.removed = false;

            this.calcValue = function() {
                // OVERRIDE ME!
                return '';
            }

            this.update = function(delta) {
                // set initial value
                if (this.initialValue == null) {
                    this.initialValue = this.getProperty().value;
                    this.initialUnits = this.getProperty().getUnits();
                }

                // if we're past the end time
                if (this.duration > this.maxDuration) {
                    // loop for indefinitely repeating animations
                    if (this.attribute('repeatCount').value == 'indefinite'
                     || this.attribute('repeatDur').value == 'indefinite') {
                        this.duration = 0.0
                    }
                    else if (this.attribute('fill').valueOrDefault('remove') == 'freeze' && !this.frozen) {
                        this.frozen = true;
                        this.parent.animationFrozen = true;
                        this.parent.animationFrozenValue = this.getProperty().value;
                    }
                    else if (this.attribute('fill').valueOrDefault('remove') == 'remove' && !this.removed) {
                        this.removed = true;
                        this.getProperty().value = this.parent.animationFrozen ? this.parent.animationFrozenValue : this.initialValue;
                        return true;
                    }
                    return false;
                }
                this.duration = this.duration + delta;

                // if we're past the begin time
                var updated = false;
                if (this.begin < this.duration) {
                    var newValue = this.calcValue(); // tween

                    if (this.attribute('type').hasValue()) {
                        // for transform, etc.
                        var type = this.attribute('type').value;
                        newValue = type + '(' + newValue + ')';
                    }

                    this.getProperty().value = newValue;
                    updated = true;
                }

                return updated;
            }

            this.from = this.attribute('from');
            this.to = this.attribute('to');
            this.values = this.attribute('values');
            if (this.values.hasValue()) this.values.value = this.values.value.split(';');

            // fraction of duration we've covered
            this.progress = function() {
                var ret = { progress: (this.duration - this.begin) / (this.maxDuration - this.begin) };
                if (this.values.hasValue()) {
                    var p = ret.progress * (this.values.value.length - 1);
                    var lb = Math.floor(p), ub = Math.ceil(p);
                    ret.from = new svg.Property('from', parseFloat(this.values.value[lb]));
                    ret.to = new svg.Property('to', parseFloat(this.values.value[ub]));
                    ret.progress = (p - lb) / (ub - lb);
                }
                else {
                    ret.from = this.from;
                    ret.to = this.to;
                }
                return ret;
            }
        }
        svg.Element.AnimateBase.prototype = new svg.Element.ElementBase;

        // animate element
        svg.Element.animate = function(node) {
            this.base = svg.Element.AnimateBase;
            this.base(node);

            this.calcValue = function() {
                var p = this.progress();

                // tween value linearly
                var newValue = p.from.numValue() + (p.to.numValue() - p.from.numValue()) * p.progress;
                return newValue + this.initialUnits;
            };
        }
        svg.Element.animate.prototype = new svg.Element.AnimateBase;

        // animate color element
        svg.Element.animateColor = function(node) {
            this.base = svg.Element.AnimateBase;
            this.base(node);

            this.calcValue = function() {
                var p = this.progress();
                var from = new RGBColor(p.from.value);
                var to = new RGBColor(p.to.value);

                if (from.ok && to.ok) {
                    // tween color linearly
                    var r = from.r + (to.r - from.r) * p.progress;
                    var g = from.g + (to.g - from.g) * p.progress;
                    var b = from.b + (to.b - from.b) * p.progress;
                    return 'rgb('+parseInt(r,10)+','+parseInt(g,10)+','+parseInt(b,10)+')';
                }
                return this.attribute('from').value;
            };
        }
        svg.Element.animateColor.prototype = new svg.Element.AnimateBase;

        // animate transform element
        svg.Element.animateTransform = function(node) {
            this.base = svg.Element.AnimateBase;
            this.base(node);

            this.calcValue = function() {
                var p = this.progress();

                // tween value linearly
                var from = svg.ToNumberArray(p.from.value);
                var to = svg.ToNumberArray(p.to.value);
                var newValue = '';
                for (var i=0; i<from.length; i++) {
                    newValue += from[i] + (to[i] - from[i]) * p.progress + ' ';
                }
                return newValue;
            };
        }
        svg.Element.animateTransform.prototype = new svg.Element.animate;

        // font element
        svg.Element.font = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.horizAdvX = this.attribute('horiz-adv-x').numValue();

            this.isRTL = false;
            this.isArabic = false;
            this.fontFace = null;
            this.missingGlyph = null;
            this.glyphs = [];
            for (var i=0; i<this.children.length; i++) {
                var child = this.children[i];
                if (child.type == 'font-face') {
                    this.fontFace = child;
                    if (child.style('font-family').hasValue()) {
                        svg.Definitions[child.style('font-family').value] = this;
                    }
                }
                else if (child.type == 'missing-glyph') this.missingGlyph = child;
                else if (child.type == 'glyph') {
                    if (child.arabicForm != '') {
                        this.isRTL = true;
                        this.isArabic = true;
                        if (typeof(this.glyphs[child.unicode]) == 'undefined') this.glyphs[child.unicode] = [];
                        this.glyphs[child.unicode][child.arabicForm] = child;
                    }
                    else {
                        this.glyphs[child.unicode] = child;
                    }
                }
            }
        }
        svg.Element.font.prototype = new svg.Element.ElementBase;

        // font-face element
        svg.Element.fontface = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.ascent = this.attribute('ascent').value;
            this.descent = this.attribute('descent').value;
            this.unitsPerEm = this.attribute('units-per-em').numValue();
        }
        svg.Element.fontface.prototype = new svg.Element.ElementBase;

        // missing-glyph element
        svg.Element.missingglyph = function(node) {
            this.base = svg.Element.path;
            this.base(node);

            this.horizAdvX = 0;
        }
        svg.Element.missingglyph.prototype = new svg.Element.path;

        // glyph element
        svg.Element.glyph = function(node) {
            this.base = svg.Element.path;
            this.base(node);

            this.horizAdvX = this.attribute('horiz-adv-x').numValue();
            this.unicode = this.attribute('unicode').value;
            this.arabicForm = this.attribute('arabic-form').value;
        }
        svg.Element.glyph.prototype = new svg.Element.path;

        // text element
        svg.Element.text = function(node) {
            this.captureTextNodes = true;
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.baseSetContext = this.setContext;
            this.setContext = function(ctx) {
                this.baseSetContext(ctx);

                var textBaseline = this.style('dominant-baseline').toTextBaseline();
                if (textBaseline == null) textBaseline = this.style('alignment-baseline').toTextBaseline();
                if (textBaseline != null) ctx.textBaseline = textBaseline;
            }

            this.getBoundingBox = function () {
                var x = this.attribute('x').toPixels('x');
                var y = this.attribute('y').toPixels('y');
                var fontSize = this.parent.style('font-size').numValueOrDefault(svg.Font.Parse(svg.ctx.font).fontSize);
                return new svg.BoundingBox(x, y - fontSize, x + Math.floor(fontSize * 2.0 / 3.0) * this.children[0].getText().length, y);
            }

            this.renderChildren = function(ctx) {
                this.x = this.attribute('x').toPixels('x');
                this.y = this.attribute('y').toPixels('y');
                if (this.attribute('dx').hasValue()) this.x += this.attribute('dx').toPixels('x');
                if (this.attribute('dy').hasValue()) this.y += this.attribute('dy').toPixels('y');
                this.x += this.getAnchorDelta(ctx, this, 0);
                for (var i=0; i<this.children.length; i++) {
                    this.renderChild(ctx, this, i);
                }
            }

            this.getAnchorDelta = function (ctx, parent, startI) {
                var textAnchor = this.style('text-anchor').valueOrDefault('start');
                if (textAnchor != 'start') {
                    var width = 0;
                    for (var i=startI; i<parent.children.length; i++) {
                        var child = parent.children[i];
                        if (i > startI && child.attribute('x').hasValue()) break; // new group
                        width += child.measureTextRecursive(ctx);
                    }
                    return -1 * (textAnchor == 'end' ? width : width / 2.0);
                }
                return 0;
            }

            this.renderChild = function(ctx, parent, i) {
                var child = parent.children[i];
                if (child.attribute('x').hasValue()) {
                    child.x = child.attribute('x').toPixels('x') + parent.getAnchorDelta(ctx, parent, i);
                    if (child.attribute('dx').hasValue()) child.x += child.attribute('dx').toPixels('x');
                }
                else {
                    if (child.attribute('dx').hasValue()) parent.x += child.attribute('dx').toPixels('x');
                    child.x = parent.x;
                }
                parent.x = child.x + child.measureText(ctx);

                if (child.attribute('y').hasValue()) {
                    child.y = child.attribute('y').toPixels('y');
                    if (child.attribute('dy').hasValue()) child.y += child.attribute('dy').toPixels('y');
                }
                else {
                    if (child.attribute('dy').hasValue()) parent.y += child.attribute('dy').toPixels('y');
                    child.y = parent.y;
                }
                parent.y = child.y;

                child.render(ctx);

                for (var i=0; i<child.children.length; i++) {
                    parent.renderChild(ctx, child, i);
                }
            }
        }
        svg.Element.text.prototype = new svg.Element.RenderedElementBase;

        // text base
        svg.Element.TextElementBase = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.getGlyph = function(font, text, i) {
                var c = text[i];
                var glyph = null;
                if (font.isArabic) {
                    var arabicForm = 'isolated';
                    if ((i==0 || text[i-1]==' ') && i<text.length-2 && text[i+1]!=' ') arabicForm = 'terminal';
                    if (i>0 && text[i-1]!=' ' && i<text.length-2 && text[i+1]!=' ') arabicForm = 'medial';
                    if (i>0 && text[i-1]!=' ' && (i == text.length-1 || text[i+1]==' ')) arabicForm = 'initial';
                    if (typeof(font.glyphs[c]) != 'undefined') {
                        glyph = font.glyphs[c][arabicForm];
                        if (glyph == null && font.glyphs[c].type == 'glyph') glyph = font.glyphs[c];
                    }
                }
                else {
                    glyph = font.glyphs[c];
                }
                if (glyph == null) glyph = font.missingGlyph;
                return glyph;
            }

            this.renderChildren = function(ctx) {
                var customFont = this.parent.style('font-family').getDefinition();
                if (customFont != null) {
                    var fontSize = this.parent.style('font-size').numValueOrDefault(svg.Font.Parse(svg.ctx.font).fontSize);
                    var fontStyle = this.parent.style('font-style').valueOrDefault(svg.Font.Parse(svg.ctx.font).fontStyle);
                    var text = this.getText();
                    if (customFont.isRTL) text = text.split("").reverse().join("");

                    var dx = svg.ToNumberArray(this.parent.attribute('dx').value);
                    for (var i=0; i<text.length; i++) {
                        var glyph = this.getGlyph(customFont, text, i);
                        var scale = fontSize / customFont.fontFace.unitsPerEm;
                        ctx.translate(this.x, this.y);
                        ctx.scale(scale, -scale);
                        var lw = ctx.lineWidth;
                        ctx.lineWidth = ctx.lineWidth * customFont.fontFace.unitsPerEm / fontSize;
                        if (fontStyle == 'italic') ctx.transform(1, 0, .4, 1, 0, 0);
                        glyph.render(ctx);
                        if (fontStyle == 'italic') ctx.transform(1, 0, -.4, 1, 0, 0);
                        ctx.lineWidth = lw;
                        ctx.scale(1/scale, -1/scale);
                        ctx.translate(-this.x, -this.y);

                        this.x += fontSize * (glyph.horizAdvX || customFont.horizAdvX) / customFont.fontFace.unitsPerEm;
                        if (typeof(dx[i]) != 'undefined' && !isNaN(dx[i])) {
                            this.x += dx[i];
                        }
                    }
                    return;
                }

                if (ctx.fillStyle != '') ctx.fillText(svg.compressSpaces(this.getText()), this.x, this.y);
                if (ctx.strokeStyle != '') ctx.strokeText(svg.compressSpaces(this.getText()), this.x, this.y);
            }

            this.getText = function() {
                // OVERRIDE ME
            }

            this.measureTextRecursive = function(ctx) {
                var width = this.measureText(ctx);
                for (var i=0; i<this.children.length; i++) {
                    width += this.children[i].measureTextRecursive(ctx);
                }
                return width;
            }

            this.measureText = function(ctx) {
                var customFont = this.parent.style('font-family').getDefinition();
                if (customFont != null) {
                    var fontSize = this.parent.style('font-size').numValueOrDefault(svg.Font.Parse(svg.ctx.font).fontSize);
                    var measure = 0;
                    var text = this.getText();
                    if (customFont.isRTL) text = text.split("").reverse().join("");
                    var dx = svg.ToNumberArray(this.parent.attribute('dx').value);
                    for (var i=0; i<text.length; i++) {
                        var glyph = this.getGlyph(customFont, text, i);
                        measure += (glyph.horizAdvX || customFont.horizAdvX) * fontSize / customFont.fontFace.unitsPerEm;
                        if (typeof(dx[i]) != 'undefined' && !isNaN(dx[i])) {
                            measure += dx[i];
                        }
                    }
                    return measure;
                }

                var textToMeasure = svg.compressSpaces(this.getText());
                if (!ctx.measureText) return textToMeasure.length * 10;

                ctx.save();
                this.setContext(ctx);
                var width = ctx.measureText(textToMeasure).width;
                ctx.restore();
                return width;
            }
        }
        svg.Element.TextElementBase.prototype = new svg.Element.RenderedElementBase;

        // tspan
        svg.Element.tspan = function(node) {
            this.captureTextNodes = true;
            this.base = svg.Element.TextElementBase;
            this.base(node);

            this.text = svg.compressSpaces(node.value || node.text || node.textContent || '');
            this.getText = function() {
                // if this node has children, then they own the text
                if (this.children.length > 0) { return ''; }
                return this.text;
            }
        }
        svg.Element.tspan.prototype = new svg.Element.TextElementBase;

        // tref
        svg.Element.tref = function(node) {
            this.base = svg.Element.TextElementBase;
            this.base(node);

            this.getText = function() {
                var element = this.getHrefAttribute().getDefinition();
                if (element != null) return element.children[0].getText();
            }
        }
        svg.Element.tref.prototype = new svg.Element.TextElementBase;

        // a element
        svg.Element.a = function(node) {
            this.base = svg.Element.TextElementBase;
            this.base(node);

            this.hasText = node.childNodes.length > 0;
            for (var i=0; i<node.childNodes.length; i++) {
                if (node.childNodes[i].nodeType != 3) this.hasText = false;
            }

            // this might contain text
            this.text = this.hasText ? node.childNodes[0].value : '';
            this.getText = function() {
                return this.text;
            }

            this.baseRenderChildren = this.renderChildren;
            this.renderChildren = function(ctx) {
                if (this.hasText) {
                    // render as text element
                    this.baseRenderChildren(ctx);
                    var fontSize = new svg.Property('fontSize', svg.Font.Parse(svg.ctx.font).fontSize);
                    svg.Mouse.checkBoundingBox(this, new svg.BoundingBox(this.x, this.y - fontSize.toPixels('y'), this.x + this.measureText(ctx), this.y));
                }
                else if (this.children.length > 0) {
                    // render as temporary group
                    var g = new svg.Element.g();
                    g.children = this.children;
                    g.parent = this;
                    g.render(ctx);
                }
            }

            this.onclick = function() {
                window.open(this.getHrefAttribute().value);
            }

            this.onmousemove = function() {
                svg.ctx.canvas.style.cursor = 'pointer';
            }
        }
        svg.Element.a.prototype = new svg.Element.TextElementBase;

        // image element
        svg.Element.image = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            var href = this.getHrefAttribute().value;
            if (href == '') { return; }
            var isSvg = href.match(/\.svg$/)

            svg.Images.push(this);
            this.loaded = false;
            if (!isSvg) {
                this.img = document.createElement('img');
                if (svg.opts['useCORS'] == true) { this.img.crossOrigin = 'Anonymous'; }
                var self = this;
                this.img.onload = function() { self.loaded = true; }
                this.img.onerror = function() { svg.log('ERROR: image "' + href + '" not found'); self.loaded = true; }
                this.img.src = href;
            }
            else {
                this.img = svg.ajax(href);
                this.loaded = true;
            }

            this.renderChildren = function(ctx) {
                var x = this.attribute('x').toPixels('x');
                var y = this.attribute('y').toPixels('y');

                var width = this.attribute('width').toPixels('x');
                var height = this.attribute('height').toPixels('y');
                if (width == 0 || height == 0) return;

                ctx.save();
                if (isSvg) {
                    ctx.drawSvg(this.img, x, y, width, height);
                }
                else {
                    ctx.translate(x, y);
                    svg.AspectRatio(ctx,
                                    this.attribute('preserveAspectRatio').value,
                                    width,
                                    this.img.width,
                                    height,
                                    this.img.height,
                                    0,
                                    0);
                    ctx.drawImage(this.img, 0, 0);
                }
                ctx.restore();
            }

            this.getBoundingBox = function() {
                var x = this.attribute('x').toPixels('x');
                var y = this.attribute('y').toPixels('y');
                var width = this.attribute('width').toPixels('x');
                var height = this.attribute('height').toPixels('y');
                return new svg.BoundingBox(x, y, x + width, y + height);
            }
        }
        svg.Element.image.prototype = new svg.Element.RenderedElementBase;

        // group element
        svg.Element.g = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.getBoundingBox = function() {
                var bb = new svg.BoundingBox();
                for (var i=0; i<this.children.length; i++) {
                    bb.addBoundingBox(this.children[i].getBoundingBox());
                }
                return bb;
            };
        }
        svg.Element.g.prototype = new svg.Element.RenderedElementBase;

        // symbol element
        svg.Element.symbol = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.render = function(ctx) {
                // NO RENDER
            };
        }
        svg.Element.symbol.prototype = new svg.Element.RenderedElementBase;

        // style element
        svg.Element.style = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            // text, or spaces then CDATA
            var css = ''
            for (var i=0; i<node.childNodes.length; i++) {
              css += node.childNodes[i].data;
            }
            css = css.replace(/(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(^[\s]*\/\/.*)/gm, ''); // remove comments
            css = svg.compressSpaces(css); // replace whitespace
            var cssDefs = css.split('}');
            for (var i=0; i<cssDefs.length; i++) {
                if (svg.trim(cssDefs[i]) != '') {
                    var cssDef = cssDefs[i].split('{');
                    var cssClasses = cssDef[0].split(',');
                    var cssProps = cssDef[1].split(';');
                    for (var j=0; j<cssClasses.length; j++) {
                        var cssClass = svg.trim(cssClasses[j]);
                        if (cssClass != '') {
                            var props = svg.Styles[cssClass] || {};
                            for (var k=0; k<cssProps.length; k++) {
                                var prop = cssProps[k].indexOf(':');
                                var name = cssProps[k].substr(0, prop);
                                var value = cssProps[k].substr(prop + 1, cssProps[k].length - prop);
                                if (name != null && value != null) {
                                    props[svg.trim(name)] = new svg.Property(svg.trim(name), svg.trim(value));
                                }
                            }
                            svg.Styles[cssClass] = props;
                            svg.StylesSpecificity[cssClass] = getSelectorSpecificity(cssClass);
                            if (cssClass == '@font-face') {
                                var fontFamily = props['font-family'].value.replace(/"/g,'');
                                var srcs = props['src'].value.split(',');
                                for (var s=0; s<srcs.length; s++) {
                                    if (srcs[s].indexOf('format("svg")') > 0) {
                                        var urlStart = srcs[s].indexOf('url');
                                        var urlEnd = srcs[s].indexOf(')', urlStart);
                                        var url = srcs[s].substr(urlStart + 5, urlEnd - urlStart - 6);
                                        var doc = svg.parseXml(svg.ajax(url));
                                        var fonts = doc.getElementsByTagName('font');
                                        for (var f=0; f<fonts.length; f++) {
                                            var font = svg.CreateElement(fonts[f]);
                                            svg.Definitions[fontFamily] = font;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        svg.Element.style.prototype = new svg.Element.ElementBase;

        // use element
        svg.Element.use = function(node) {
            this.base = svg.Element.RenderedElementBase;
            this.base(node);

            this.baseSetContext = this.setContext;
            this.setContext = function(ctx) {
                this.baseSetContext(ctx);
                if (this.attribute('x').hasValue()) ctx.translate(this.attribute('x').toPixels('x'), 0);
                if (this.attribute('y').hasValue()) ctx.translate(0, this.attribute('y').toPixels('y'));
            }

            var element = this.getHrefAttribute().getDefinition();

            this.path = function(ctx) {
                if (element != null) element.path(ctx);
            }

            this.getBoundingBox = function() {
                if (element != null) return element.getBoundingBox();
            }

            this.renderChildren = function(ctx) {
                if (element != null) {
                    var tempSvg = element;
                    if (element.type == 'symbol') {
                        // render me using a temporary svg element in symbol cases (http://www.w3.org/TR/SVG/struct.html#UseElement)
                        tempSvg = new svg.Element.svg();
                        tempSvg.type = 'svg';
                        tempSvg.attributes['viewBox'] = new svg.Property('viewBox', element.attribute('viewBox').value);
                        tempSvg.attributes['preserveAspectRatio'] = new svg.Property('preserveAspectRatio', element.attribute('preserveAspectRatio').value);
                        tempSvg.attributes['overflow'] = new svg.Property('overflow', element.attribute('overflow').value);
                        tempSvg.children = element.children;
                    }
                    if (tempSvg.type == 'svg') {
                        // if symbol or svg, inherit width/height from me
                        if (this.attribute('width').hasValue()) tempSvg.attributes['width'] = new svg.Property('width', this.attribute('width').value);
                        if (this.attribute('height').hasValue()) tempSvg.attributes['height'] = new svg.Property('height', this.attribute('height').value);
                    }
                    var oldParent = tempSvg.parent;
                    tempSvg.parent = null;
                    tempSvg.render(ctx);
                    tempSvg.parent = oldParent;
                }
            }
        }
        svg.Element.use.prototype = new svg.Element.RenderedElementBase;

        // mask element
        svg.Element.mask = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.apply = function(ctx, element) {
                // render as temp svg
                var x = this.attribute('x').toPixels('x');
                var y = this.attribute('y').toPixels('y');
                var width = this.attribute('width').toPixels('x');
                var height = this.attribute('height').toPixels('y');

                if (width == 0 && height == 0) {
                    var bb = new svg.BoundingBox();
                    for (var i=0; i<this.children.length; i++) {
                        bb.addBoundingBox(this.children[i].getBoundingBox());
                    }
                    var x = Math.floor(bb.x1);
                    var y = Math.floor(bb.y1);
                    var width = Math.floor(bb.width());
                    var	height = Math.floor(bb.height());
                }

                // temporarily remove mask to avoid recursion
                var mask = element.attribute('mask').value;
                element.attribute('mask').value = '';

                    var cMask = document.createElement('canvas');
                    cMask.width = x + width;
                    cMask.height = y + height;
                    var maskCtx = cMask.getContext('2d');
                    this.renderChildren(maskCtx);

                    var c = document.createElement('canvas');
                    c.width = x + width;
                    c.height = y + height;
                    var tempCtx = c.getContext('2d');
                    element.render(tempCtx);
                    tempCtx.globalCompositeOperation = 'destination-in';
                    tempCtx.fillStyle = maskCtx.createPattern(cMask, 'no-repeat');
                    tempCtx.fillRect(0, 0, x + width, y + height);

                    ctx.fillStyle = tempCtx.createPattern(c, 'no-repeat');
                    ctx.fillRect(0, 0, x + width, y + height);

                // reassign mask
                element.attribute('mask').value = mask;
            }

            this.render = function(ctx) {
                // NO RENDER
            }
        }
        svg.Element.mask.prototype = new svg.Element.ElementBase;

        // clip element
        svg.Element.clipPath = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.apply = function(ctx) {
                var oldBeginPath = CanvasRenderingContext2D.prototype.beginPath;
                CanvasRenderingContext2D.prototype.beginPath = function () { };

                var oldClosePath = CanvasRenderingContext2D.prototype.closePath;
                CanvasRenderingContext2D.prototype.closePath = function () { };

                oldBeginPath.call(ctx);
                for (var i=0; i<this.children.length; i++) {
                    var child = this.children[i];
                    if (typeof(child.path) != 'undefined') {
                        var transform = null;
                        if (child.style('transform', false, true).hasValue()) {
                            transform = new svg.Transform(child.style('transform', false, true).value);
                            transform.apply(ctx);
                        }
                        child.path(ctx);
                        CanvasRenderingContext2D.prototype.closePath = oldClosePath;
                        if (transform) { transform.unapply(ctx); }
                    }
                }
                oldClosePath.call(ctx);
                ctx.clip();

                CanvasRenderingContext2D.prototype.beginPath = oldBeginPath;
                CanvasRenderingContext2D.prototype.closePath = oldClosePath;
            }

            this.render = function(ctx) {
                // NO RENDER
            }
        }
        svg.Element.clipPath.prototype = new svg.Element.ElementBase;

        // filters
        svg.Element.filter = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.apply = function(ctx, element) {
                // render as temp svg
                var bb = element.getBoundingBox();
                var x = Math.floor(bb.x1);
                var y = Math.floor(bb.y1);
                var width = Math.floor(bb.width());
                var	height = Math.floor(bb.height());

                // temporarily remove filter to avoid recursion
                var filter = element.style('filter').value;
                element.style('filter').value = '';

                var px = 0, py = 0;
                for (var i=0; i<this.children.length; i++) {
                    var efd = this.children[i].extraFilterDistance || 0;
                    px = Math.max(px, efd);
                    py = Math.max(py, efd);
                }

                var c = document.createElement('canvas');
                c.width = width + 2*px;
                c.height = height + 2*py;
                var tempCtx = c.getContext('2d');
                tempCtx.translate(-x + px, -y + py);
                element.render(tempCtx);

                // apply filters
                for (var i=0; i<this.children.length; i++) {
                    if (typeof(this.children[i].apply) === 'function') {
                        this.children[i].apply(tempCtx, 0, 0, width + 2*px, height + 2*py);
                    }
                }

                // render on me
                ctx.drawImage(c, 0, 0, width + 2*px, height + 2*py, x - px, y - py, width + 2*px, height + 2*py);

                // reassign filter
                element.style('filter', true).value = filter;
            }

            this.render = function(ctx) {
                // NO RENDER
            }
        }
        svg.Element.filter.prototype = new svg.Element.ElementBase;

        svg.Element.feMorphology = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.apply = function(ctx, x, y, width, height) {
                // TODO: implement
            }
        }
        svg.Element.feMorphology.prototype = new svg.Element.ElementBase;

        svg.Element.feComposite = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.apply = function(ctx, x, y, width, height) {
                // TODO: implement
            }
        }
        svg.Element.feComposite.prototype = new svg.Element.ElementBase;

        svg.Element.feColorMatrix = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            var matrix = svg.ToNumberArray(this.attribute('values').value);
            switch (this.attribute('type').valueOrDefault('matrix')) { // http://www.w3.org/TR/SVG/filters.html#feColorMatrixElement
                case 'saturate':
                    var s = matrix[0];
                    matrix = [0.213+0.787*s,0.715-0.715*s,0.072-0.072*s,0,0,
                              0.213-0.213*s,0.715+0.285*s,0.072-0.072*s,0,0,
                              0.213-0.213*s,0.715-0.715*s,0.072+0.928*s,0,0,
                              0,0,0,1,0,
                              0,0,0,0,1];
                    break;
                case 'hueRotate':
                    var a = matrix[0] * Math.PI / 180.0;
                    var c = function (m1,m2,m3) { return m1 + Math.cos(a)*m2 + Math.sin(a)*m3; };
                    matrix = [c(0.213,0.787,-0.213),c(0.715,-0.715,-0.715),c(0.072,-0.072,0.928),0,0,
                              c(0.213,-0.213,0.143),c(0.715,0.285,0.140),c(0.072,-0.072,-0.283),0,0,
                              c(0.213,-0.213,-0.787),c(0.715,-0.715,0.715),c(0.072,0.928,0.072),0,0,
                              0,0,0,1,0,
                              0,0,0,0,1];
                    break;
                case 'luminanceToAlpha':
                    matrix = [0,0,0,0,0,
                              0,0,0,0,0,
                              0,0,0,0,0,
                              0.2125,0.7154,0.0721,0,0,
                              0,0,0,0,1];
                    break;
            }

            function imGet(img, x, y, width, height, rgba) {
                return img[y*width*4 + x*4 + rgba];
            }

            function imSet(img, x, y, width, height, rgba, val) {
                img[y*width*4 + x*4 + rgba] = val;
            }

            function m(i, v) {
                var mi = matrix[i];
                return mi * (mi < 0 ? v - 255 : v);
            }

            this.apply = function(ctx, x, y, width, height) {
                // assuming x==0 && y==0 for now
                var srcData = ctx.getImageData(0, 0, width, height);
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        var r = imGet(srcData.data, x, y, width, height, 0);
                        var g = imGet(srcData.data, x, y, width, height, 1);
                        var b = imGet(srcData.data, x, y, width, height, 2);
                        var a = imGet(srcData.data, x, y, width, height, 3);
                        imSet(srcData.data, x, y, width, height, 0, m(0,r)+m(1,g)+m(2,b)+m(3,a)+m(4,1));
                        imSet(srcData.data, x, y, width, height, 1, m(5,r)+m(6,g)+m(7,b)+m(8,a)+m(9,1));
                        imSet(srcData.data, x, y, width, height, 2, m(10,r)+m(11,g)+m(12,b)+m(13,a)+m(14,1));
                        imSet(srcData.data, x, y, width, height, 3, m(15,r)+m(16,g)+m(17,b)+m(18,a)+m(19,1));
                    }
                }
                ctx.clearRect(0, 0, width, height);
                ctx.putImageData(srcData, 0, 0);
            }
        }
        svg.Element.feColorMatrix.prototype = new svg.Element.ElementBase;

        svg.Element.feGaussianBlur = function(node) {
            this.base = svg.Element.ElementBase;
            this.base(node);

            this.blurRadius = Math.floor(this.attribute('stdDeviation').numValue());
            this.extraFilterDistance = this.blurRadius;

            this.apply = function(ctx, x, y, width, height) {
                if (typeof(stackBlur.canvasRGBA) == 'undefined') {
                    svg.log('ERROR: StackBlur.js must be included for blur to work');
                    return;
                }

                // StackBlur requires canvas be on document
                ctx.canvas.id = svg.UniqueId();
                ctx.canvas.style.display = 'none';
                document.body.appendChild(ctx.canvas);
                stackBlur.canvasRGBA(ctx.canvas.id, x, y, width, height, this.blurRadius);
                document.body.removeChild(ctx.canvas);
            }
        }
        svg.Element.feGaussianBlur.prototype = new svg.Element.ElementBase;

        // title element, do nothing
        svg.Element.title = function(node) {
        }
        svg.Element.title.prototype = new svg.Element.ElementBase;

        // desc element, do nothing
        svg.Element.desc = function(node) {
        }
        svg.Element.desc.prototype = new svg.Element.ElementBase;

        svg.Element.MISSING = function(node) {
            svg.log('ERROR: Element \'' + node.nodeName + '\' not yet implemented.');
        }
        svg.Element.MISSING.prototype = new svg.Element.ElementBase;

        // element factory
        svg.CreateElement = function(node) {
            var className = node.nodeName.replace(/^[^:]+:/,''); // remove namespace
            className = className.replace(/\-/g,''); // remove dashes
            var e = null;
            if (typeof(svg.Element[className]) != 'undefined') {
                e = new svg.Element[className](node);
            }
            else {
                e = new svg.Element.MISSING(node);
            }

            e.type = node.nodeName;
            return e;
        }

        // load from url
        svg.load = function(ctx, url) {
            svg.loadXml(ctx, svg.ajax(url));
        }

        // load from xml
        svg.loadXml = function(ctx, xml) {
            svg.loadXmlDoc(ctx, svg.parseXml(xml));
        }

        svg.loadXmlDoc = function(ctx, dom) {
            svg.init(ctx);

            var mapXY = function(p) {
                var e = ctx.canvas;
                while (e) {
                    p.x -= e.offsetLeft;
                    p.y -= e.offsetTop;
                    e = e.offsetParent;
                }
                if (window.scrollX) p.x += window.scrollX;
                if (window.scrollY) p.y += window.scrollY;
                return p;
            }

            // bind mouse
            if (svg.opts['ignoreMouse'] != true) {
                ctx.canvas.onclick = function(e) {
                    var p = mapXY(new svg.Point(e != null ? e.clientX : event.clientX, e != null ? e.clientY : event.clientY));
                    svg.Mouse.onclick(p.x, p.y);
                };
                ctx.canvas.onmousemove = function(e) {
                    var p = mapXY(new svg.Point(e != null ? e.clientX : event.clientX, e != null ? e.clientY : event.clientY));
                    svg.Mouse.onmousemove(p.x, p.y);
                };
            }

            var e = svg.CreateElement(dom.documentElement);
            e.root = true;
            e.addStylesFromStyleDefinition();

            // render loop
            var isFirstRender = true;
            var draw = function() {
                svg.ViewPort.Clear();
                if (ctx.canvas.parentNode) svg.ViewPort.SetCurrent(ctx.canvas.parentNode.clientWidth, ctx.canvas.parentNode.clientHeight);

                if (svg.opts['ignoreDimensions'] != true) {
                    // set canvas size
                    if (e.style('width').hasValue()) {
                        ctx.canvas.width = e.style('width').toPixels('x');
                        ctx.canvas.style.width = ctx.canvas.width + 'px';
                    }
                    if (e.style('height').hasValue()) {
                        ctx.canvas.height = e.style('height').toPixels('y');
                        ctx.canvas.style.height = ctx.canvas.height + 'px';
                    }
                }
                var cWidth = ctx.canvas.clientWidth || ctx.canvas.width;
                var cHeight = ctx.canvas.clientHeight || ctx.canvas.height;
                if (svg.opts['ignoreDimensions'] == true && e.style('width').hasValue() && e.style('height').hasValue()) {
                    cWidth = e.style('width').toPixels('x');
                    cHeight = e.style('height').toPixels('y');
                }
                svg.ViewPort.SetCurrent(cWidth, cHeight);

                if (svg.opts['offsetX'] != null) e.attribute('x', true).value = svg.opts['offsetX'];
                if (svg.opts['offsetY'] != null) e.attribute('y', true).value = svg.opts['offsetY'];
                if (svg.opts['scaleWidth'] != null || svg.opts['scaleHeight'] != null) {
                    var xRatio = null, yRatio = null, viewBox = svg.ToNumberArray(e.attribute('viewBox').value);

                    if (svg.opts['scaleWidth'] != null) {
                        if (e.attribute('width').hasValue()) xRatio = e.attribute('width').toPixels('x') / svg.opts['scaleWidth'];
                        else if (!isNaN(viewBox[2])) xRatio = viewBox[2] / svg.opts['scaleWidth'];
                    }

                    if (svg.opts['scaleHeight'] != null) {
                        if (e.attribute('height').hasValue()) yRatio = e.attribute('height').toPixels('y') / svg.opts['scaleHeight'];
                        else if (!isNaN(viewBox[3])) yRatio = viewBox[3] / svg.opts['scaleHeight'];
                    }

                    if (xRatio == null) { xRatio = yRatio; }
                    if (yRatio == null) { yRatio = xRatio; }

                    e.attribute('width', true).value = svg.opts['scaleWidth'];
                    e.attribute('height', true).value = svg.opts['scaleHeight'];
                    e.style('transform', true, true).value += ' scale('+(1.0/xRatio)+','+(1.0/yRatio)+')';
                }

                // clear and render
                if (svg.opts['ignoreClear'] != true) {
                    ctx.clearRect(0, 0, cWidth, cHeight);
                }
                e.render(ctx);
                if (isFirstRender) {
                    isFirstRender = false;
                    if (typeof(svg.opts['renderCallback']) == 'function') svg.opts['renderCallback'](dom);
                }
            }

            var waitingForImages = true;
            if (svg.ImagesLoaded()) {
                waitingForImages = false;
                draw();
            }
            svg.intervalID = setInterval(function() {
                var needUpdate = false;

                if (waitingForImages && svg.ImagesLoaded()) {
                    waitingForImages = false;
                    needUpdate = true;
                }

                // need update from mouse events?
                if (svg.opts['ignoreMouse'] != true) {
                    needUpdate = needUpdate | svg.Mouse.hasEvents();
                }

                // need update from animations?
                if (svg.opts['ignoreAnimation'] != true) {
                    for (var i=0; i<svg.Animations.length; i++) {
                        needUpdate = needUpdate | svg.Animations[i].update(1000 / svg.FRAMERATE);
                    }
                }

                // need update from redraw?
                if (typeof(svg.opts['forceRedraw']) == 'function') {
                    if (svg.opts['forceRedraw']() == true) needUpdate = true;
                }

                // render if needed
                if (needUpdate) {
                    draw();
                    svg.Mouse.runEvents(); // run and clear our events
                }
            }, 1000 / svg.FRAMERATE);
        }

        svg.stop = function() {
            if (svg.intervalID) {
                clearInterval(svg.intervalID);
            }
        }

        svg.Mouse = new (function() {
            this.events = [];
            this.hasEvents = function() { return this.events.length != 0; }

            this.onclick = function(x, y) {
                this.events.push({ type: 'onclick', x: x, y: y,
                    run: function(e) { if (e.onclick) e.onclick(); }
                });
            }

            this.onmousemove = function(x, y) {
                this.events.push({ type: 'onmousemove', x: x, y: y,
                    run: function(e) { if (e.onmousemove) e.onmousemove(); }
                });
            }

            this.eventElements = [];

            this.checkPath = function(element, ctx) {
                for (var i=0; i<this.events.length; i++) {
                    var e = this.events[i];
                    if (ctx.isPointInPath && ctx.isPointInPath(e.x, e.y)) this.eventElements[i] = element;
                }
            }

            this.checkBoundingBox = function(element, bb) {
                for (var i=0; i<this.events.length; i++) {
                    var e = this.events[i];
                    if (bb.isPointInBox(e.x, e.y)) this.eventElements[i] = element;
                }
            }

            this.runEvents = function() {
                svg.ctx.canvas.style.cursor = '';

                for (var i=0; i<this.events.length; i++) {
                    var e = this.events[i];
                    var element = this.eventElements[i];
                    while (element) {
                        e.run(element);
                        element = element.parent;
                    }
                }

                // done running, clear
                this.events = [];
                this.eventElements = [];
            }
        });

        return svg;
    };

    if (typeof(CanvasRenderingContext2D) != 'undefined') {
        CanvasRenderingContext2D.prototype.drawSvg = function(s, dx, dy, dw, dh) {
            canvg(this.canvas, s, {
                ignoreMouse: true,
                ignoreAnimation: true,
                ignoreDimensions: true,
                ignoreClear: true,
                offsetX: dx,
                offsetY: dy,
                scaleWidth: dw,
                scaleHeight: dh
            });
        }
    }

    return canvg;

}));

},{"./rgbcolor":4,"./stackblur":5}],4:[function(require,module,exports){
/**
 * A class to parse color values
 * @author Stoyan Stefanov <sstoo@gmail.com>
 * @link   http://www.phpied.com/rgb-color-parser-in-javascript/
 * @license Use it if you like it
 */

(function ( global ) {

  function RGBColor(color_string)
  {
    this.ok = false;

    // strip any leading #
    if (color_string.charAt(0) == '#') { // remove # if any
      color_string = color_string.substr(1,6);
    }

    color_string = color_string.replace(/ /g,'');
    color_string = color_string.toLowerCase();

    // before getting into regexps, try simple matches
    // and overwrite the input
    var simple_colors = {
      aliceblue: 'f0f8ff',
      antiquewhite: 'faebd7',
      aqua: '00ffff',
      aquamarine: '7fffd4',
      azure: 'f0ffff',
      beige: 'f5f5dc',
      bisque: 'ffe4c4',
      black: '000000',
      blanchedalmond: 'ffebcd',
      blue: '0000ff',
      blueviolet: '8a2be2',
      brown: 'a52a2a',
      burlywood: 'deb887',
      cadetblue: '5f9ea0',
      chartreuse: '7fff00',
      chocolate: 'd2691e',
      coral: 'ff7f50',
      cornflowerblue: '6495ed',
      cornsilk: 'fff8dc',
      crimson: 'dc143c',
      cyan: '00ffff',
      darkblue: '00008b',
      darkcyan: '008b8b',
      darkgoldenrod: 'b8860b',
      darkgray: 'a9a9a9',
      darkgreen: '006400',
      darkkhaki: 'bdb76b',
      darkmagenta: '8b008b',
      darkolivegreen: '556b2f',
      darkorange: 'ff8c00',
      darkorchid: '9932cc',
      darkred: '8b0000',
      darksalmon: 'e9967a',
      darkseagreen: '8fbc8f',
      darkslateblue: '483d8b',
      darkslategray: '2f4f4f',
      darkturquoise: '00ced1',
      darkviolet: '9400d3',
      deeppink: 'ff1493',
      deepskyblue: '00bfff',
      dimgray: '696969',
      dodgerblue: '1e90ff',
      feldspar: 'd19275',
      firebrick: 'b22222',
      floralwhite: 'fffaf0',
      forestgreen: '228b22',
      fuchsia: 'ff00ff',
      gainsboro: 'dcdcdc',
      ghostwhite: 'f8f8ff',
      gold: 'ffd700',
      goldenrod: 'daa520',
      gray: '808080',
      green: '008000',
      greenyellow: 'adff2f',
      honeydew: 'f0fff0',
      hotpink: 'ff69b4',
      indianred : 'cd5c5c',
      indigo : '4b0082',
      ivory: 'fffff0',
      khaki: 'f0e68c',
      lavender: 'e6e6fa',
      lavenderblush: 'fff0f5',
      lawngreen: '7cfc00',
      lemonchiffon: 'fffacd',
      lightblue: 'add8e6',
      lightcoral: 'f08080',
      lightcyan: 'e0ffff',
      lightgoldenrodyellow: 'fafad2',
      lightgrey: 'd3d3d3',
      lightgreen: '90ee90',
      lightpink: 'ffb6c1',
      lightsalmon: 'ffa07a',
      lightseagreen: '20b2aa',
      lightskyblue: '87cefa',
      lightslateblue: '8470ff',
      lightslategray: '778899',
      lightsteelblue: 'b0c4de',
      lightyellow: 'ffffe0',
      lime: '00ff00',
      limegreen: '32cd32',
      linen: 'faf0e6',
      magenta: 'ff00ff',
      maroon: '800000',
      mediumaquamarine: '66cdaa',
      mediumblue: '0000cd',
      mediumorchid: 'ba55d3',
      mediumpurple: '9370d8',
      mediumseagreen: '3cb371',
      mediumslateblue: '7b68ee',
      mediumspringgreen: '00fa9a',
      mediumturquoise: '48d1cc',
      mediumvioletred: 'c71585',
      midnightblue: '191970',
      mintcream: 'f5fffa',
      mistyrose: 'ffe4e1',
      moccasin: 'ffe4b5',
      navajowhite: 'ffdead',
      navy: '000080',
      oldlace: 'fdf5e6',
      olive: '808000',
      olivedrab: '6b8e23',
      orange: 'ffa500',
      orangered: 'ff4500',
      orchid: 'da70d6',
      palegoldenrod: 'eee8aa',
      palegreen: '98fb98',
      paleturquoise: 'afeeee',
      palevioletred: 'd87093',
      papayawhip: 'ffefd5',
      peachpuff: 'ffdab9',
      peru: 'cd853f',
      pink: 'ffc0cb',
      plum: 'dda0dd',
      powderblue: 'b0e0e6',
      purple: '800080',
      red: 'ff0000',
      rosybrown: 'bc8f8f',
      royalblue: '4169e1',
      saddlebrown: '8b4513',
      salmon: 'fa8072',
      sandybrown: 'f4a460',
      seagreen: '2e8b57',
      seashell: 'fff5ee',
      sienna: 'a0522d',
      silver: 'c0c0c0',
      skyblue: '87ceeb',
      slateblue: '6a5acd',
      slategray: '708090',
      snow: 'fffafa',
      springgreen: '00ff7f',
      steelblue: '4682b4',
      tan: 'd2b48c',
      teal: '008080',
      thistle: 'd8bfd8',
      tomato: 'ff6347',
      turquoise: '40e0d0',
      violet: 'ee82ee',
      violetred: 'd02090',
      wheat: 'f5deb3',
      white: 'ffffff',
      whitesmoke: 'f5f5f5',
      yellow: 'ffff00',
      yellowgreen: '9acd32'
    };
    for (var key in simple_colors) {
      if (color_string == key) {
        color_string = simple_colors[key];
      }
    }
    // emd of simple type-in colors

    // array of color definition objects
    var color_defs = [
      {
        re: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
        example: ['rgb(123, 234, 45)', 'rgb(255,234,245)'],
        process: function (bits){
          return [
            parseInt(bits[1]),
            parseInt(bits[2]),
            parseInt(bits[3])
          ];
        }
      },
      {
        re: /^(\w{2})(\w{2})(\w{2})$/,
        example: ['#00ff00', '336699'],
        process: function (bits){
          return [
            parseInt(bits[1], 16),
            parseInt(bits[2], 16),
            parseInt(bits[3], 16)
          ];
        }
      },
      {
        re: /^(\w{1})(\w{1})(\w{1})$/,
        example: ['#fb0', 'f0f'],
        process: function (bits){
          return [
            parseInt(bits[1] + bits[1], 16),
            parseInt(bits[2] + bits[2], 16),
            parseInt(bits[3] + bits[3], 16)
          ];
        }
      }
    ];

    // search through the definitions to find a match
    for (var i = 0; i < color_defs.length; i++) {
      var re = color_defs[i].re;
      var processor = color_defs[i].process;
      var bits = re.exec(color_string);
      if (bits) {
        channels = processor(bits);
        this.r = channels[0];
        this.g = channels[1];
        this.b = channels[2];
        this.ok = true;
      }

    }

    // validate/cleanup values
    this.r = (this.r < 0 || isNaN(this.r)) ? 0 : ((this.r > 255) ? 255 : this.r);
    this.g = (this.g < 0 || isNaN(this.g)) ? 0 : ((this.g > 255) ? 255 : this.g);
    this.b = (this.b < 0 || isNaN(this.b)) ? 0 : ((this.b > 255) ? 255 : this.b);

    // some getters
    this.toRGB = function () {
      return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
    }
    this.toHex = function () {
      var r = this.r.toString(16);
      var g = this.g.toString(16);
      var b = this.b.toString(16);
      if (r.length == 1) r = '0' + r;
      if (g.length == 1) g = '0' + g;
      if (b.length == 1) b = '0' + b;
      return '#' + r + g + b;
    }

    // help
    this.getHelpXML = function () {

      var examples = new Array();
      // add regexps
      for (var i = 0; i < color_defs.length; i++) {
        var example = color_defs[i].example;
        for (var j = 0; j < example.length; j++) {
          examples[examples.length] = example[j];
        }
      }
      // add type-in colors
      for (var sc in simple_colors) {
        examples[examples.length] = sc;
      }

      var xml = document.createElement('ul');
      xml.setAttribute('id', 'rgbcolor-examples');
      for (var i = 0; i < examples.length; i++) {
        try {
          var list_item = document.createElement('li');
          var list_color = new RGBColor(examples[i]);
          var example_div = document.createElement('div');
          example_div.style.cssText =
              'margin: 3px; '
              + 'border: 1px solid black; '
              + 'background:' + list_color.toHex() + '; '
              + 'color:' + list_color.toHex()
          ;
          example_div.appendChild(document.createTextNode('test'));
          var list_item_value = document.createTextNode(
            ' ' + examples[i] + ' -> ' + list_color.toRGB() + ' -> ' + list_color.toHex()
          );
          list_item.appendChild(example_div);
          list_item.appendChild(list_item_value);
          xml.appendChild(list_item);

        } catch(e){}
      }
      return xml;

    }

  }

    // export as AMD...
    if ( typeof define !== 'undefined' && define.amd ) {
        define( function () { return RGBColor; });
    }

    // ...or as browserify
    else if ( typeof module !== 'undefined' && module.exports ) {
        module.exports = RGBColor;
    }

    global.RGBColor = RGBColor;

}( typeof window !== 'undefined' ? window : this ));

},{}],5:[function(require,module,exports){
/*

StackBlur - a fast almost Gaussian Blur For Canvas

Version: 	0.5
Author:		Mario Klingemann
Contact: 	mario@quasimondo.com
Website:	http://www.quasimondo.com/StackBlurForCanvas
Twitter:	@quasimondo

In case you find this class useful - especially in commercial projects -
I am not totally unhappy for a small donation to my PayPal account
mario@quasimondo.de

Or support me on flattr:
https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript

Copyright (c) 2010 Mario Klingemann

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

(function ( global ) {

  var mul_table = [
      512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
      454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
      482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
      437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
      497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
      320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
      446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
      329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
      505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
      399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
      324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
      268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
      451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
      385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
      332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
      289,287,285,282,280,278,275,273,271,269,267,265,263,261,259];


  var shg_table = [
       9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
      17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
      19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
      21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
      21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];

  function premultiplyAlpha(imageData)
  {
    var pixels = imageData.data;
    var size = imageData.width * imageData.height * 4;

    for (var i=0; i<size; i+=4)
    {
      var a = pixels[i+3] / 255;
      pixels[i  ] *= a;
      pixels[i+1] *= a;
      pixels[i+2] *= a;
    }
  }

  function unpremultiplyAlpha(imageData)
  {
    var pixels = imageData.data;
    var size = imageData.width * imageData.height * 4;

    for (var i=0; i<size; i+=4)
    {
      var a = pixels[i+3];
      if (a != 0)
      {
        a = 255 / a;
        pixels[i  ] *= a;
        pixels[i+1] *= a;
        pixels[i+2] *= a;
      }
    }
  }

  function stackBlurImage( imageID, canvasID, radius, blurAlphaChannel )
  {

    var img = document.getElementById( imageID );
    var w = img.naturalWidth;
    var h = img.naturalHeight;

    var canvas = document.getElementById( canvasID );

    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w;
    canvas.height = h;

    var context = canvas.getContext("2d");
    context.clearRect( 0, 0, w, h );
    context.drawImage( img, 0, 0 );

    if ( isNaN(radius) || radius < 1 ) return;

    if ( blurAlphaChannel )
      stackBlurCanvasRGBA( canvasID, 0, 0, w, h, radius );
    else
      stackBlurCanvasRGB( canvasID, 0, 0, w, h, radius );
  }


  function stackBlurCanvasRGBA( id, top_x, top_y, width, height, radius )
  {
    if ( isNaN(radius) || radius < 1 ) return;
    radius |= 0;

    var canvas  = document.getElementById( id );
    var context = canvas.getContext("2d");
    var imageData;

    try {
      try {
      imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {

      // NOTE: this part is supposedly only needed if you want to work with local files
      // so it might be okay to remove the whole try/catch block and just use
      // imageData = context.getImageData( top_x, top_y, width, height );
      try {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead");
        imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {
        alert("Cannot access local image");
        throw new Error("unable to access local image data: " + e);
        return;
      }
      }
    } catch(e) {
      alert("Cannot access image");
      throw new Error("unable to access image data: " + e);
    }

    premultiplyAlpha(imageData);

    var pixels = imageData.data;

    var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum,
    r_out_sum, g_out_sum, b_out_sum, a_out_sum,
    r_in_sum, g_in_sum, b_in_sum, a_in_sum,
    pr, pg, pb, pa, rbs;

    var div = radius + radius + 1;
    var w4 = width << 2;
    var widthMinus1  = width - 1;
    var heightMinus1 = height - 1;
    var radiusPlus1  = radius + 1;
    var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;

    var stackStart = new BlurStack();
    var stack = stackStart;
    for ( i = 1; i < div; i++ )
    {
      stack = stack.next = new BlurStack();
      if ( i == radiusPlus1 ) var stackEnd = stack;
    }
    stack.next = stackStart;
    var stackIn = null;
    var stackOut = null;

    yw = yi = 0;

    var mul_sum = mul_table[radius];
    var shg_sum = shg_table[radius];

    for ( y = 0; y < height; y++ )
    {
      r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;

      r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );
      a_out_sum = radiusPlus1 * ( pa = pixels[yi+3] );

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
      a_sum += sumFactor * pa;

      stack = stackStart;

      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack.a = pa;
        stack = stack.next;
      }

      for( i = 1; i < radiusPlus1; i++ )
      {
        p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
        r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;
        a_sum += ( stack.a = ( pa = pixels[p+3])) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
        a_in_sum += pa;

        stack = stack.next;
      }

      stackIn = stackStart;
      stackOut = stackEnd;
      for ( x = 0; x < width; x++ )
      {
        pixels[yi]   = (r_sum * mul_sum) >> shg_sum;
        pixels[yi+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[yi+2] = (b_sum * mul_sum) >> shg_sum;
        pixels[yi+3] = (a_sum * mul_sum) >> shg_sum;

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
        a_sum -= a_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
        a_out_sum -= stackIn.a;

        p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;

        r_in_sum += ( stackIn.r = pixels[p]);
        g_in_sum += ( stackIn.g = pixels[p+1]);
        b_in_sum += ( stackIn.b = pixels[p+2]);
        a_in_sum += ( stackIn.a = pixels[p+3]);

        r_sum += r_in_sum;
        g_sum += g_in_sum;
        b_sum += b_in_sum;
        a_sum += a_in_sum;

        stackIn = stackIn.next;

        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );
        a_out_sum += ( pa = stackOut.a );

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
        a_in_sum -= pa;

        stackOut = stackOut.next;

        yi += 4;
      }
      yw += width;
    }


    for ( x = 0; x < width; x++ )
    {
      g_in_sum = b_in_sum = a_in_sum = r_in_sum = g_sum = b_sum = a_sum = r_sum = 0;

      yi = x << 2;
      r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);
      a_out_sum = radiusPlus1 * ( pa = pixels[yi+3]);

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
      a_sum += sumFactor * pa;

      stack = stackStart;

      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack.a = pa;
        stack = stack.next;
      }

      yp = width;

      for( i = 1; i <= radius; i++ )
      {
        yi = ( yp + x ) << 2;

        r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;
        a_sum += ( stack.a = ( pa = pixels[yi+3])) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
        a_in_sum += pa;

        stack = stack.next;

        if( i < heightMinus1 )
        {
          yp += width;
        }
      }

      yi = x;
      stackIn = stackStart;
      stackOut = stackEnd;
      for ( y = 0; y < height; y++ )
      {
        p = yi << 2;
        pixels[p]   = (r_sum * mul_sum) >> shg_sum;
        pixels[p+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[p+2] = (b_sum * mul_sum) >> shg_sum;
        pixels[p+3] = (a_sum * mul_sum) >> shg_sum;

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
        a_sum -= a_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
        a_out_sum -= stackIn.a;

        p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;

        r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
        g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
        b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));
        a_sum += ( a_in_sum += ( stackIn.a = pixels[p+3]));

        stackIn = stackIn.next;

        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );
        a_out_sum += ( pa = stackOut.a );

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
        a_in_sum -= pa;

        stackOut = stackOut.next;

        yi += width;
      }
    }

    unpremultiplyAlpha(imageData);

    context.putImageData( imageData, top_x, top_y );
  }


  function stackBlurCanvasRGB( id, top_x, top_y, width, height, radius )
  {
    if ( isNaN(radius) || radius < 1 ) return;
    radius |= 0;

    var canvas  = document.getElementById( id );
    var context = canvas.getContext("2d");
    var imageData;

    try {
      try {
      imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {

      // NOTE: this part is supposedly only needed if you want to work with local files
      // so it might be okay to remove the whole try/catch block and just use
      // imageData = context.getImageData( top_x, top_y, width, height );
      try {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead");
        imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {
        alert("Cannot access local image");
        throw new Error("unable to access local image data: " + e);
        return;
      }
      }
    } catch(e) {
      alert("Cannot access image");
      throw new Error("unable to access image data: " + e);
    }

    var pixels = imageData.data;

    var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum,
    r_out_sum, g_out_sum, b_out_sum,
    r_in_sum, g_in_sum, b_in_sum,
    pr, pg, pb, rbs;

    var div = radius + radius + 1;
    var w4 = width << 2;
    var widthMinus1  = width - 1;
    var heightMinus1 = height - 1;
    var radiusPlus1  = radius + 1;
    var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;

    var stackStart = new BlurStack();
    var stack = stackStart;
    for ( i = 1; i < div; i++ )
    {
      stack = stack.next = new BlurStack();
      if ( i == radiusPlus1 ) var stackEnd = stack;
    }
    stack.next = stackStart;
    var stackIn = null;
    var stackOut = null;

    yw = yi = 0;

    var mul_sum = mul_table[radius];
    var shg_sum = shg_table[radius];

    for ( y = 0; y < height; y++ )
    {
      r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;

      r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;

      stack = stackStart;

      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack = stack.next;
      }

      for( i = 1; i < radiusPlus1; i++ )
      {
        p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
        r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;

        stack = stack.next;
      }


      stackIn = stackStart;
      stackOut = stackEnd;
      for ( x = 0; x < width; x++ )
      {
        pixels[yi]   = (r_sum * mul_sum) >> shg_sum;
        pixels[yi+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[yi+2] = (b_sum * mul_sum) >> shg_sum;

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;

        p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;

        r_in_sum += ( stackIn.r = pixels[p]);
        g_in_sum += ( stackIn.g = pixels[p+1]);
        b_in_sum += ( stackIn.b = pixels[p+2]);

        r_sum += r_in_sum;
        g_sum += g_in_sum;
        b_sum += b_in_sum;

        stackIn = stackIn.next;

        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;

        stackOut = stackOut.next;

        yi += 4;
      }
      yw += width;
    }


    for ( x = 0; x < width; x++ )
    {
      g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;

      yi = x << 2;
      r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;

      stack = stackStart;

      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack = stack.next;
      }

      yp = width;

      for( i = 1; i <= radius; i++ )
      {
        yi = ( yp + x ) << 2;

        r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;

        stack = stack.next;

        if( i < heightMinus1 )
        {
          yp += width;
        }
      }

      yi = x;
      stackIn = stackStart;
      stackOut = stackEnd;
      for ( y = 0; y < height; y++ )
      {
        p = yi << 2;
        pixels[p]   = (r_sum * mul_sum) >> shg_sum;
        pixels[p+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[p+2] = (b_sum * mul_sum) >> shg_sum;

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;

        p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;

        r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
        g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
        b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));

        stackIn = stackIn.next;

        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;

        stackOut = stackOut.next;

        yi += width;
      }
    }

    context.putImageData( imageData, top_x, top_y );

  }

  function BlurStack()
  {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 0;
    this.next = null;
  }

  var stackBlur = {
    image: stackBlurImage,
    canvasRGBA: stackBlurCanvasRGBA,
    canvasRGB: stackBlurCanvasRGB
  };

  // export as AMD...
  if ( typeof define !== 'undefined' && define.amd ) {
      define( function () { return stackBlur; });
  }

  // ...or as browserify
  else if ( typeof module !== 'undefined' && module.exports ) {
      module.exports = stackBlur;
  }

  global.stackBlur = stackBlur;

}( typeof window !== 'undefined' ? window : this ));

},{}],6:[function(require,module,exports){
//var CanvasExport = require('CanvasExport');
//var MarkupCleaner = require('MarkupCleaner');
var SVGtoCanvas = require('./SVGtoCanvas');


module.exports = function Rewriter() {
  'use strict';
  console.log(arguments);
}

},{"./SVGtoCanvas":7}],7:[function(require,module,exports){
var canvg = require('../libs/canvg');


function SVGtoCanvas() {

}


module.exports = SVGtoCanvas;

},{"../libs/canvg":3}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvQXBwLmpzIiwic3JjL0NvbnZlcnRlci5qcyIsInNyYy9saWJzL2NhbnZnLmpzIiwic3JjL2xpYnMvcmdiY29sb3IuanMiLCJzcmMvbGlicy9zdGFja2JsdXIuanMiLCJzcmMvbW9kdWxlcy9SZXdyaXRlci5qcyIsInNyYy9tb2R1bGVzL1NWR3RvQ2FudmFzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9vQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIENvbnZlcnRlciA9IHJlcXVpcmUoJy4vQ29udmVydGVyJyk7XHJcblxyXG4oZnVuY3Rpb24gSUlGRSgpIHtcclxuICBpZiAoIXdpbmRvdy5zdmcyaW1nKSB7XHJcbiAgICB3aW5kb3cuc3ZnMmltZyA9IG5ldyBDb252ZXJ0ZXIoKTtcclxuICB9XHJcbn0pKCk7XHJcbiIsInZhciBSZXdyaXRlciA9IHJlcXVpcmUoJy4vbW9kdWxlcy9SZXdyaXRlcicpO1xyXG5cclxuZnVuY3Rpb24gQ29udmVydGVyKCkge1xyXG4gIHRoaXMuY29udmVydCA9IG5ldyBSZXdyaXRlcigpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnRlcjtcclxuIiwiLypcclxuICogY2FudmcuanMgLSBKYXZhc2NyaXB0IFNWRyBwYXJzZXIgYW5kIHJlbmRlcmVyIG9uIENhbnZhc1xyXG4gKiBNSVQgTGljZW5zZWRcclxuICogR2FiZSBMZXJuZXIgKGdhYmVsZXJuZXJAZ21haWwuY29tKVxyXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvY2FudmcvXHJcbiAqXHJcbiAqIFJlcXVpcmVzOiByZ2Jjb2xvci5qcyAtIGh0dHA6Ly93d3cucGhwaWVkLmNvbS9yZ2ItY29sb3ItcGFyc2VyLWluLWphdmFzY3JpcHQvXHJcbiAqL1xyXG4gKGZ1bmN0aW9uICggZ2xvYmFsLCBmYWN0b3J5ICkge1xyXG5cclxuICAgICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgICAvLyBleHBvcnQgYXMgQU1ELi4uXHJcbiAgICBpZiAoIHR5cGVvZiBkZWZpbmUgIT09ICd1bmRlZmluZWQnICYmIGRlZmluZS5hbWQgKSB7XHJcbiAgICAgICAgZGVmaW5lKCdjYW52Z01vZHVsZScsIFsgJ3JnYmNvbG9yJywgJ3N0YWNrYmx1cicgXSwgZmFjdG9yeSApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIC4uLm9yIGFzIGJyb3dzZXJpZnlcclxuICAgIGVsc2UgaWYgKCB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyApIHtcclxuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoIHJlcXVpcmUoICcuL3JnYmNvbG9yJyApLCByZXF1aXJlKCAnLi9zdGFja2JsdXInICkgKTtcclxuICAgIH1cclxuXHJcbiAgICBnbG9iYWwuY2FudmcgPSBmYWN0b3J5KCBnbG9iYWwuUkdCQ29sb3IsIGdsb2JhbC5zdGFja0JsdXIgKTtcclxuXHJcbn0oIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdGhpcywgZnVuY3Rpb24gKCBSR0JDb2xvciwgc3RhY2tCbHVyICkge1xyXG5cclxuICAgIC8vIGNhbnZnKHRhcmdldCwgcylcclxuICAgIC8vIGVtcHR5IHBhcmFtZXRlcnM6IHJlcGxhY2UgYWxsICdzdmcnIGVsZW1lbnRzIG9uIHBhZ2Ugd2l0aCAnY2FudmFzJyBlbGVtZW50c1xyXG4gICAgLy8gdGFyZ2V0OiBjYW52YXMgZWxlbWVudCBvciB0aGUgaWQgb2YgYSBjYW52YXMgZWxlbWVudFxyXG4gICAgLy8gczogc3ZnIHN0cmluZywgdXJsIHRvIHN2ZyBmaWxlLCBvciB4bWwgZG9jdW1lbnRcclxuICAgIC8vIG9wdHM6IG9wdGlvbmFsIGhhc2ggb2Ygb3B0aW9uc1xyXG4gICAgLy9cdFx0IGlnbm9yZU1vdXNlOiB0cnVlID0+IGlnbm9yZSBtb3VzZSBldmVudHNcclxuICAgIC8vXHRcdCBpZ25vcmVBbmltYXRpb246IHRydWUgPT4gaWdub3JlIGFuaW1hdGlvbnNcclxuICAgIC8vXHRcdCBpZ25vcmVEaW1lbnNpb25zOiB0cnVlID0+IGRvZXMgbm90IHRyeSB0byByZXNpemUgY2FudmFzXHJcbiAgICAvL1x0XHQgaWdub3JlQ2xlYXI6IHRydWUgPT4gZG9lcyBub3QgY2xlYXIgY2FudmFzXHJcbiAgICAvL1x0XHQgb2Zmc2V0WDogaW50ID0+IGRyYXdzIGF0IGEgeCBvZmZzZXRcclxuICAgIC8vXHRcdCBvZmZzZXRZOiBpbnQgPT4gZHJhd3MgYXQgYSB5IG9mZnNldFxyXG4gICAgLy9cdFx0IHNjYWxlV2lkdGg6IGludCA9PiBzY2FsZXMgaG9yaXpvbnRhbGx5IHRvIHdpZHRoXHJcbiAgICAvL1x0XHQgc2NhbGVIZWlnaHQ6IGludCA9PiBzY2FsZXMgdmVydGljYWxseSB0byBoZWlnaHRcclxuICAgIC8vXHRcdCByZW5kZXJDYWxsYmFjazogZnVuY3Rpb24gPT4gd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiBhZnRlciB0aGUgZmlyc3QgcmVuZGVyIGlzIGNvbXBsZXRlZFxyXG4gICAgLy9cdFx0IGZvcmNlUmVkcmF3OiBmdW5jdGlvbiA9PiB3aWxsIGNhbGwgdGhlIGZ1bmN0aW9uIG9uIGV2ZXJ5IGZyYW1lLCBpZiBpdCByZXR1cm5zIHRydWUsIHdpbGwgcmVkcmF3XHJcbiAgICB2YXIgY2FudmcgPSBmdW5jdGlvbiAodGFyZ2V0LCBzLCBvcHRzKSB7XHJcbiAgICAgICAgLy8gbm8gcGFyYW1ldGVyc1xyXG4gICAgICAgIGlmICh0YXJnZXQgPT0gbnVsbCAmJiBzID09IG51bGwgJiYgb3B0cyA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciBzdmdUYWdzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnc3ZnJyk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxzdmdUYWdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3ZnVGFnID0gc3ZnVGFnc1tpXTtcclxuICAgICAgICAgICAgICAgIHZhciBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XHJcbiAgICAgICAgICAgICAgICBjLndpZHRoID0gc3ZnVGFnLmNsaWVudFdpZHRoO1xyXG4gICAgICAgICAgICAgICAgYy5oZWlnaHQgPSBzdmdUYWcuY2xpZW50SGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgc3ZnVGFnLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGMsIHN2Z1RhZyk7XHJcbiAgICAgICAgICAgICAgICBzdmdUYWcucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzdmdUYWcpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgZGl2LmFwcGVuZENoaWxkKHN2Z1RhZyk7XHJcbiAgICAgICAgICAgICAgICBjYW52ZyhjLCBkaXYuaW5uZXJIVE1MKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHRhcmdldCA9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0YXJnZXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gc3RvcmUgY2xhc3Mgb24gY2FudmFzXHJcbiAgICAgICAgaWYgKHRhcmdldC5zdmcgIT0gbnVsbCkgdGFyZ2V0LnN2Zy5zdG9wKCk7XHJcbiAgICAgICAgdmFyIHN2ZyA9IGJ1aWxkKG9wdHMgfHwge30pO1xyXG4gICAgICAgIC8vIG9uIGkuZS4gOCBmb3IgZmxhc2ggY2FudmFzLCB3ZSBjYW4ndCBhc3NpZ24gdGhlIHByb3BlcnR5IHNvIGNoZWNrIGZvciBpdFxyXG4gICAgICAgIGlmICghKHRhcmdldC5jaGlsZE5vZGVzLmxlbmd0aCA9PSAxICYmIHRhcmdldC5jaGlsZE5vZGVzWzBdLm5vZGVOYW1lID09ICdPQkpFQ1QnKSkgdGFyZ2V0LnN2ZyA9IHN2ZztcclxuXHJcbiAgICAgICAgdmFyIGN0eCA9IHRhcmdldC5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgICAgIGlmICh0eXBlb2Yocy5kb2N1bWVudEVsZW1lbnQpICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIC8vIGxvYWQgZnJvbSB4bWwgZG9jXHJcbiAgICAgICAgICAgIHN2Zy5sb2FkWG1sRG9jKGN0eCwgcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHMuc3Vic3RyKDAsMSkgPT0gJzwnKSB7XHJcbiAgICAgICAgICAgIC8vIGxvYWQgZnJvbSB4bWwgc3RyaW5nXHJcbiAgICAgICAgICAgIHN2Zy5sb2FkWG1sKGN0eCwgcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBsb2FkIGZyb20gdXJsXHJcbiAgICAgICAgICAgIHN2Zy5sb2FkKGN0eCwgcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRWxlbWVudC5tYXRjaGVzXHJcbiAgICB2YXIgbWF0Y2hlc1NlbGVjdG9yO1xyXG4gICAgaWYgKHR5cGVvZihFbGVtZW50LnByb3RvdHlwZS5tYXRjaGVzKSAhPSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIG1hdGNoZXNTZWxlY3RvciA9IGZ1bmN0aW9uKG5vZGUsIHNlbGVjdG9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub2RlLm1hdGNoZXMoc2VsZWN0b3IpO1xyXG4gICAgICAgIH07XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihFbGVtZW50LnByb3RvdHlwZS53ZWJraXRNYXRjaGVzU2VsZWN0b3IpICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgbWF0Y2hlc1NlbGVjdG9yID0gZnVuY3Rpb24obm9kZSwgc2VsZWN0b3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5vZGUud2Via2l0TWF0Y2hlc1NlbGVjdG9yKHNlbGVjdG9yKTtcclxuICAgICAgICB9O1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YoRWxlbWVudC5wcm90b3R5cGUubW96TWF0Y2hlc1NlbGVjdG9yKSAhPSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIG1hdGNoZXNTZWxlY3RvciA9IGZ1bmN0aW9uKG5vZGUsIHNlbGVjdG9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub2RlLm1vek1hdGNoZXNTZWxlY3RvcihzZWxlY3Rvcik7XHJcbiAgICAgICAgfTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mKEVsZW1lbnQucHJvdG90eXBlLm1zTWF0Y2hlc1NlbGVjdG9yKSAhPSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIG1hdGNoZXNTZWxlY3RvciA9IGZ1bmN0aW9uKG5vZGUsIHNlbGVjdG9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub2RlLm1zTWF0Y2hlc1NlbGVjdG9yKHNlbGVjdG9yKTtcclxuICAgICAgICB9O1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YoRWxlbWVudC5wcm90b3R5cGUub01hdGNoZXNTZWxlY3RvcikgIT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBtYXRjaGVzU2VsZWN0b3IgPSBmdW5jdGlvbihub2RlLCBzZWxlY3Rvcikge1xyXG4gICAgICAgICAgICByZXR1cm4gbm9kZS5vTWF0Y2hlc1NlbGVjdG9yKHNlbGVjdG9yKTtcclxuICAgICAgICB9O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyByZXF1aXJlcyBTaXp6bGU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qcXVlcnkvc2l6emxlL3dpa2kvU2l6emxlLURvY3VtZW50YXRpb25cclxuICAgICAgICAvLyBvciBqUXVlcnk6IGh0dHA6Ly9qcXVlcnkuY29tL2Rvd25sb2FkL1xyXG4gICAgICAgIC8vIG9yIFplcHRvOiBodHRwOi8vemVwdG9qcy5jb20vI1xyXG4gICAgICAgIC8vIHdpdGhvdXQgaXQsIHRoaXMgaXMgYSBSZWZlcmVuY2VFcnJvclxyXG5cclxuICAgICAgICBpZiAodHlwZW9mIGpRdWVyeSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgWmVwdG8gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgbWF0Y2hlc1NlbGVjdG9yID0gZnVuY3Rpb24gKG5vZGUsIHNlbGVjdG9yKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJChub2RlKS5pcyhzZWxlY3Rvcik7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXNTZWxlY3RvciA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgbWF0Y2hlc1NlbGVjdG9yID0gU2l6emxlLm1hdGNoZXNTZWxlY3RvcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gc2xpZ2h0bHkgbW9kaWZpZWQgdmVyc2lvbiBvZiBodHRwczovL2dpdGh1Yi5jb20va2VlZ2Fuc3RyZWV0L3NwZWNpZmljaXR5L2Jsb2IvbWFzdGVyL3NwZWNpZmljaXR5LmpzXHJcbiAgICB2YXIgYXR0cmlidXRlUmVnZXggPSAvKFxcW1teXFxdXStcXF0pL2c7XHJcbiAgICB2YXIgaWRSZWdleCA9IC8oI1teXFxzXFwrPn5cXC5cXFs6XSspL2c7XHJcbiAgICB2YXIgY2xhc3NSZWdleCA9IC8oXFwuW15cXHNcXCs+flxcLlxcWzpdKykvZztcclxuICAgIHZhciBwc2V1ZG9FbGVtZW50UmVnZXggPSAvKDo6W15cXHNcXCs+flxcLlxcWzpdK3w6Zmlyc3QtbGluZXw6Zmlyc3QtbGV0dGVyfDpiZWZvcmV8OmFmdGVyKS9naTtcclxuICAgIHZhciBwc2V1ZG9DbGFzc1dpdGhCcmFja2V0c1JlZ2V4ID0gLyg6W1xcdy1dK1xcKFteXFwpXSpcXCkpL2dpO1xyXG4gICAgdmFyIHBzZXVkb0NsYXNzUmVnZXggPSAvKDpbXlxcc1xcKz5+XFwuXFxbOl0rKS9nO1xyXG4gICAgdmFyIGVsZW1lbnRSZWdleCA9IC8oW15cXHNcXCs+flxcLlxcWzpdKykvZztcclxuICAgIGZ1bmN0aW9uIGdldFNlbGVjdG9yU3BlY2lmaWNpdHkoc2VsZWN0b3IpIHtcclxuICAgICAgICB2YXIgdHlwZUNvdW50ID0gWzAsIDAsIDBdO1xyXG4gICAgICAgIHZhciBmaW5kTWF0Y2ggPSBmdW5jdGlvbihyZWdleCwgdHlwZSkge1xyXG4gICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGVjdG9yLm1hdGNoKHJlZ2V4KTtcclxuICAgICAgICAgICAgaWYgKG1hdGNoZXMgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHR5cGVDb3VudFt0eXBlXSArPSBtYXRjaGVzLmxlbmd0aDtcclxuICAgICAgICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKHJlZ2V4LCAnICcpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZSgvOm5vdFxcKChbXlxcKV0qKVxcKS9nLCAnICAgICAkMSAnKTtcclxuICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnJlcGxhY2UoL3tbXl0qL2dtLCAnICcpO1xyXG4gICAgICAgIGZpbmRNYXRjaChhdHRyaWJ1dGVSZWdleCwgMSk7XHJcbiAgICAgICAgZmluZE1hdGNoKGlkUmVnZXgsIDApO1xyXG4gICAgICAgIGZpbmRNYXRjaChjbGFzc1JlZ2V4LCAxKTtcclxuICAgICAgICBmaW5kTWF0Y2gocHNldWRvRWxlbWVudFJlZ2V4LCAyKTtcclxuICAgICAgICBmaW5kTWF0Y2gocHNldWRvQ2xhc3NXaXRoQnJhY2tldHNSZWdleCwgMSk7XHJcbiAgICAgICAgZmluZE1hdGNoKHBzZXVkb0NsYXNzUmVnZXgsIDEpO1xyXG4gICAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZSgvW1xcKlxcc1xcKz5+XS9nLCAnICcpO1xyXG4gICAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZSgvWyNcXC5dL2csICcgJyk7XHJcbiAgICAgICAgZmluZE1hdGNoKGVsZW1lbnRSZWdleCwgMik7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVDb3VudC5qb2luKCcnKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBidWlsZChvcHRzKSB7XHJcbiAgICAgICAgdmFyIHN2ZyA9IHsgb3B0czogb3B0cyB9O1xyXG5cclxuICAgICAgICBzdmcuRlJBTUVSQVRFID0gMzA7XHJcbiAgICAgICAgc3ZnLk1BWF9WSVJUVUFMX1BJWEVMUyA9IDMwMDAwO1xyXG5cclxuICAgICAgICBzdmcubG9nID0gZnVuY3Rpb24obXNnKSB7fTtcclxuICAgICAgICBpZiAoc3ZnLm9wdHNbJ2xvZyddID09IHRydWUgJiYgdHlwZW9mKGNvbnNvbGUpICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIHN2Zy5sb2cgPSBmdW5jdGlvbihtc2cpIHsgY29uc29sZS5sb2cobXNnKTsgfTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBnbG9iYWxzXHJcbiAgICAgICAgc3ZnLmluaXQgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgdmFyIHVuaXF1ZUlkID0gMDtcclxuICAgICAgICAgICAgc3ZnLlVuaXF1ZUlkID0gZnVuY3Rpb24gKCkgeyB1bmlxdWVJZCsrOyByZXR1cm4gJ2NhbnZnJyArIHVuaXF1ZUlkO1x0fTtcclxuICAgICAgICAgICAgc3ZnLkRlZmluaXRpb25zID0ge307XHJcbiAgICAgICAgICAgIHN2Zy5TdHlsZXMgPSB7fTtcclxuICAgICAgICAgICAgc3ZnLlN0eWxlc1NwZWNpZmljaXR5ID0ge307XHJcbiAgICAgICAgICAgIHN2Zy5BbmltYXRpb25zID0gW107XHJcbiAgICAgICAgICAgIHN2Zy5JbWFnZXMgPSBbXTtcclxuICAgICAgICAgICAgc3ZnLmN0eCA9IGN0eDtcclxuICAgICAgICAgICAgc3ZnLlZpZXdQb3J0ID0gbmV3IChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdQb3J0cyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5DbGVhciA9IGZ1bmN0aW9uKCkgeyB0aGlzLnZpZXdQb3J0cyA9IFtdOyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLlNldEN1cnJlbnQgPSBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0KSB7IHRoaXMudmlld1BvcnRzLnB1c2goeyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH0pOyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLlJlbW92ZUN1cnJlbnQgPSBmdW5jdGlvbigpIHsgdGhpcy52aWV3UG9ydHMucG9wKCk7IH1cclxuICAgICAgICAgICAgICAgIHRoaXMuQ3VycmVudCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy52aWV3UG9ydHNbdGhpcy52aWV3UG9ydHMubGVuZ3RoIC0gMV07IH1cclxuICAgICAgICAgICAgICAgIHRoaXMud2lkdGggPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuQ3VycmVudCgpLndpZHRoOyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhlaWdodCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5DdXJyZW50KCkuaGVpZ2h0OyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLkNvbXB1dGVTaXplID0gZnVuY3Rpb24oZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkICE9IG51bGwgJiYgdHlwZW9mKGQpID09ICdudW1iZXInKSByZXR1cm4gZDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZCA9PSAneCcpIHJldHVybiB0aGlzLndpZHRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGQgPT0gJ3knKSByZXR1cm4gdGhpcy5oZWlnaHQoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KHRoaXMud2lkdGgoKSwgMikgKyBNYXRoLnBvdyh0aGlzLmhlaWdodCgpLCAyKSkgLyBNYXRoLnNxcnQoMik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuaW5pdCgpO1xyXG5cclxuICAgICAgICAvLyBpbWFnZXMgbG9hZGVkXHJcbiAgICAgICAgc3ZnLkltYWdlc0xvYWRlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8c3ZnLkltYWdlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFzdmcuSW1hZ2VzW2ldLmxvYWRlZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdHJpbVxyXG4gICAgICAgIHN2Zy50cmltID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcy5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7IH1cclxuXHJcbiAgICAgICAgLy8gY29tcHJlc3Mgc3BhY2VzXHJcbiAgICAgICAgc3ZnLmNvbXByZXNzU3BhY2VzID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcy5yZXBsYWNlKC9bXFxzXFxyXFx0XFxuXSsvZ20sJyAnKTsgfVxyXG5cclxuICAgICAgICAvLyBhamF4XHJcbiAgICAgICAgc3ZnLmFqYXggPSBmdW5jdGlvbih1cmwpIHtcclxuICAgICAgICAgICAgdmFyIEFKQVg7XHJcbiAgICAgICAgICAgIGlmKHdpbmRvdy5YTUxIdHRwUmVxdWVzdCl7QUpBWD1uZXcgWE1MSHR0cFJlcXVlc3QoKTt9XHJcbiAgICAgICAgICAgIGVsc2V7QUpBWD1uZXcgQWN0aXZlWE9iamVjdCgnTWljcm9zb2Z0LlhNTEhUVFAnKTt9XHJcbiAgICAgICAgICAgIGlmKEFKQVgpe1xyXG4gICAgICAgICAgICAgICBBSkFYLm9wZW4oJ0dFVCcsdXJsLGZhbHNlKTtcclxuICAgICAgICAgICAgICAgQUpBWC5zZW5kKG51bGwpO1xyXG4gICAgICAgICAgICAgICByZXR1cm4gQUpBWC5yZXNwb25zZVRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBwYXJzZSB4bWxcclxuICAgICAgICBzdmcucGFyc2VYbWwgPSBmdW5jdGlvbih4bWwpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZihXaW5kb3dzKSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YoV2luZG93cy5EYXRhKSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YoV2luZG93cy5EYXRhLlhtbCkgIT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgIHZhciB4bWxEb2MgPSBuZXcgV2luZG93cy5EYXRhLlhtbC5Eb20uWG1sRG9jdW1lbnQoKTtcclxuICAgICAgICAgICAgICAgIHZhciBzZXR0aW5ncyA9IG5ldyBXaW5kb3dzLkRhdGEuWG1sLkRvbS5YbWxMb2FkU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIHNldHRpbmdzLnByb2hpYml0RHRkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB4bWxEb2MubG9hZFhtbCh4bWwsIHNldHRpbmdzKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB4bWxEb2M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAod2luZG93LkRPTVBhcnNlcilcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBhcnNlciA9IG5ldyBET01QYXJzZXIoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHhtbCwgJ3RleHQveG1sJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB4bWwgPSB4bWwucmVwbGFjZSgvPCFET0NUWVBFIHN2Z1tePl0qPi8sICcnKTtcclxuICAgICAgICAgICAgICAgIHZhciB4bWxEb2MgPSBuZXcgQWN0aXZlWE9iamVjdCgnTWljcm9zb2Z0LlhNTERPTScpO1xyXG4gICAgICAgICAgICAgICAgeG1sRG9jLmFzeW5jID0gJ2ZhbHNlJztcclxuICAgICAgICAgICAgICAgIHhtbERvYy5sb2FkWE1MKHhtbCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geG1sRG9jO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzdmcuUHJvcGVydHkgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xyXG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS5oYXNWYWx1ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICh0aGlzLnZhbHVlICE9IG51bGwgJiYgdGhpcy52YWx1ZSAhPT0gJycpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIG51bWVyaWNhbCB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcclxuICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS5udW1WYWx1ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc1ZhbHVlKCkpIHJldHVybiAwO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBuID0gcGFyc2VGbG9hdCh0aGlzLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgIGlmICgodGhpcy52YWx1ZSArICcnKS5tYXRjaCgvJSQvKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG4gPSBuIC8gMTAwLjA7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS52YWx1ZU9yRGVmYXVsdCA9IGZ1bmN0aW9uKGRlZikge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaGFzVmFsdWUoKSkgcmV0dXJuIHRoaXMudmFsdWU7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLm51bVZhbHVlT3JEZWZhdWx0ID0gZnVuY3Rpb24oZGVmKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5oYXNWYWx1ZSgpKSByZXR1cm4gdGhpcy5udW1WYWx1ZSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gY29sb3IgZXh0ZW5zaW9uc1xyXG4gICAgICAgICAgICAgICAgLy8gYXVnbWVudCB0aGUgY3VycmVudCBjb2xvciB2YWx1ZSB3aXRoIHRoZSBvcGFjaXR5XHJcbiAgICAgICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLmFkZE9wYWNpdHkgPSBmdW5jdGlvbihvcGFjaXR5UHJvcCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wYWNpdHlQcm9wLnZhbHVlICE9IG51bGwgJiYgb3BhY2l0eVByb3AudmFsdWUgIT0gJycgJiYgdHlwZW9mKHRoaXMudmFsdWUpPT0nc3RyaW5nJykgeyAvLyBjYW4gb25seSBhZGQgb3BhY2l0eSB0byBjb2xvcnMsIG5vdCBwYXR0ZXJuc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sb3IgPSBuZXcgUkdCQ29sb3IodGhpcy52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2xvci5vaykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWUgPSAncmdiYSgnICsgY29sb3IuciArICcsICcgKyBjb2xvci5nICsgJywgJyArIGNvbG9yLmIgKyAnLCAnICsgb3BhY2l0eVByb3AubnVtVmFsdWUoKSArICcpJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHN2Zy5Qcm9wZXJ0eSh0aGlzLm5hbWUsIG5ld1ZhbHVlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGRlZmluaXRpb24gZXh0ZW5zaW9uc1xyXG4gICAgICAgICAgICAgICAgLy8gZ2V0IHRoZSBkZWZpbml0aW9uIGZyb20gdGhlIGRlZmluaXRpb25zIHRhYmxlXHJcbiAgICAgICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLmdldERlZmluaXRpb24gPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IHRoaXMudmFsdWUubWF0Y2goLyMoW15cXCknXCJdKykvKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobmFtZSkgeyBuYW1lID0gbmFtZVsxXTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghbmFtZSkgeyBuYW1lID0gdGhpcy52YWx1ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdmcuRGVmaW5pdGlvbnNbbmFtZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS5pc1VybERlZmluaXRpb24gPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZS5pbmRleE9mKCd1cmwoJykgPT0gMFxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHN2Zy5Qcm9wZXJ0eS5wcm90b3R5cGUuZ2V0RmlsbFN0eWxlRGVmaW5pdGlvbiA9IGZ1bmN0aW9uKGUsIG9wYWNpdHlQcm9wKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlZiA9IHRoaXMuZ2V0RGVmaW5pdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBncmFkaWVudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWYgIT0gbnVsbCAmJiBkZWYuY3JlYXRlR3JhZGllbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlZi5jcmVhdGVHcmFkaWVudChzdmcuY3R4LCBlLCBvcGFjaXR5UHJvcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBwYXR0ZXJuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlZiAhPSBudWxsICYmIGRlZi5jcmVhdGVQYXR0ZXJuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZWYuZ2V0SHJlZkF0dHJpYnV0ZSgpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwdCA9IGRlZi5hdHRyaWJ1dGUoJ3BhdHRlcm5UcmFuc2Zvcm0nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZiA9IGRlZi5nZXRIcmVmQXR0cmlidXRlKCkuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHB0Lmhhc1ZhbHVlKCkpIHsgZGVmLmF0dHJpYnV0ZSgncGF0dGVyblRyYW5zZm9ybScsIHRydWUpLnZhbHVlID0gcHQudmFsdWU7IH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmLmNyZWF0ZVBhdHRlcm4oc3ZnLmN0eCwgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGxlbmd0aCBleHRlbnNpb25zXHJcbiAgICAgICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLmdldERQSSA9IGZ1bmN0aW9uKHZpZXdQb3J0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDk2LjA7IC8vIFRPRE86IGNvbXB1dGU/XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS5nZXRFTSA9IGZ1bmN0aW9uKHZpZXdQb3J0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVtID0gMTI7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBmb250U2l6ZSA9IG5ldyBzdmcuUHJvcGVydHkoJ2ZvbnRTaXplJywgc3ZnLkZvbnQuUGFyc2Uoc3ZnLmN0eC5mb250KS5mb250U2l6ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZvbnRTaXplLmhhc1ZhbHVlKCkpIGVtID0gZm9udFNpemUudG9QaXhlbHModmlld1BvcnQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZW07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS5nZXRVbml0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gdGhpcy52YWx1ZSsnJztcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcy5yZXBsYWNlKC9bMC05XFwuXFwtXS9nLCcnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBnZXQgdGhlIGxlbmd0aCBhcyBwaXhlbHNcclxuICAgICAgICAgICAgICAgIHN2Zy5Qcm9wZXJ0eS5wcm90b3R5cGUudG9QaXhlbHMgPSBmdW5jdGlvbih2aWV3UG9ydCwgcHJvY2Vzc1BlcmNlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSkgcmV0dXJuIDA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSB0aGlzLnZhbHVlKycnO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9lbSQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKSAqIHRoaXMuZ2V0RU0odmlld1BvcnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9leCQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKSAqIHRoaXMuZ2V0RU0odmlld1BvcnQpIC8gMi4wO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9weCQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocy5tYXRjaCgvcHQkLykpIHJldHVybiB0aGlzLm51bVZhbHVlKCkgKiB0aGlzLmdldERQSSh2aWV3UG9ydCkgKiAoMS4wIC8gNzIuMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMubWF0Y2goL3BjJC8pKSByZXR1cm4gdGhpcy5udW1WYWx1ZSgpICogMTU7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMubWF0Y2goL2NtJC8pKSByZXR1cm4gdGhpcy5udW1WYWx1ZSgpICogdGhpcy5nZXREUEkodmlld1BvcnQpIC8gMi41NDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocy5tYXRjaCgvbW0kLykpIHJldHVybiB0aGlzLm51bVZhbHVlKCkgKiB0aGlzLmdldERQSSh2aWV3UG9ydCkgLyAyNS40O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9pbiQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKSAqIHRoaXMuZ2V0RFBJKHZpZXdQb3J0KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocy5tYXRjaCgvJSQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKSAqIHN2Zy5WaWV3UG9ydC5Db21wdXRlU2l6ZSh2aWV3UG9ydCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG4gPSB0aGlzLm51bVZhbHVlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb2Nlc3NQZXJjZW50ICYmIG4gPCAxLjApIHJldHVybiBuICogc3ZnLlZpZXdQb3J0LkNvbXB1dGVTaXplKHZpZXdQb3J0KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIHRpbWUgZXh0ZW5zaW9uc1xyXG4gICAgICAgICAgICAgICAgLy8gZ2V0IHRoZSB0aW1lIGFzIG1pbGxpc2Vjb25kc1xyXG4gICAgICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS50b01pbGxpc2Vjb25kcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKSByZXR1cm4gMDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcyA9IHRoaXMudmFsdWUrJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMubWF0Y2goL3MkLykpIHJldHVybiB0aGlzLm51bVZhbHVlKCkgKiAxMDAwO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9tcyQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5udW1WYWx1ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gYW5nbGUgZXh0ZW5zaW9uc1xyXG4gICAgICAgICAgICAgICAgLy8gZ2V0IHRoZSBhbmdsZSBhcyByYWRpYW5zXHJcbiAgICAgICAgICAgICAgICBzdmcuUHJvcGVydHkucHJvdG90eXBlLnRvUmFkaWFucyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKSByZXR1cm4gMDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcyA9IHRoaXMudmFsdWUrJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMubWF0Y2goL2RlZyQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKSAqIChNYXRoLlBJIC8gMTgwLjApO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzLm1hdGNoKC9ncmFkJC8pKSByZXR1cm4gdGhpcy5udW1WYWx1ZSgpICogKE1hdGguUEkgLyAyMDAuMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMubWF0Y2goL3JhZCQvKSkgcmV0dXJuIHRoaXMubnVtVmFsdWUoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5udW1WYWx1ZSgpICogKE1hdGguUEkgLyAxODAuMCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyB0ZXh0IGV4dGVuc2lvbnNcclxuICAgICAgICAgICAgICAgIC8vIGdldCB0aGUgdGV4dCBiYXNlbGluZVxyXG4gICAgICAgICAgICAgICAgdmFyIHRleHRCYXNlbGluZU1hcHBpbmcgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJ2Jhc2VsaW5lJzogJ2FscGhhYmV0aWMnLFxyXG4gICAgICAgICAgICAgICAgICAgICdiZWZvcmUtZWRnZSc6ICd0b3AnLFxyXG4gICAgICAgICAgICAgICAgICAgICd0ZXh0LWJlZm9yZS1lZGdlJzogJ3RvcCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ21pZGRsZSc6ICdtaWRkbGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICdjZW50cmFsJzogJ21pZGRsZScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2FmdGVyLWVkZ2UnOiAnYm90dG9tJyxcclxuICAgICAgICAgICAgICAgICAgICAndGV4dC1hZnRlci1lZGdlJzogJ2JvdHRvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2lkZW9ncmFwaGljJzogJ2lkZW9ncmFwaGljJyxcclxuICAgICAgICAgICAgICAgICAgICAnYWxwaGFiZXRpYyc6ICdhbHBoYWJldGljJyxcclxuICAgICAgICAgICAgICAgICAgICAnaGFuZ2luZyc6ICdoYW5naW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAnbWF0aGVtYXRpY2FsJzogJ2FscGhhYmV0aWMnXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgc3ZnLlByb3BlcnR5LnByb3RvdHlwZS50b1RleHRCYXNlbGluZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSkgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRleHRCYXNlbGluZU1hcHBpbmdbdGhpcy52YWx1ZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGZvbnRzXHJcbiAgICAgICAgc3ZnLkZvbnQgPSBuZXcgKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGlzLlN0eWxlcyA9ICdub3JtYWx8aXRhbGljfG9ibGlxdWV8aW5oZXJpdCc7XHJcbiAgICAgICAgICAgIHRoaXMuVmFyaWFudHMgPSAnbm9ybWFsfHNtYWxsLWNhcHN8aW5oZXJpdCc7XHJcbiAgICAgICAgICAgIHRoaXMuV2VpZ2h0cyA9ICdub3JtYWx8Ym9sZHxib2xkZXJ8bGlnaHRlcnwxMDB8MjAwfDMwMHw0MDB8NTAwfDYwMHw3MDB8ODAwfDkwMHxpbmhlcml0JztcclxuXHJcbiAgICAgICAgICAgIHRoaXMuQ3JlYXRlRm9udCA9IGZ1bmN0aW9uKGZvbnRTdHlsZSwgZm9udFZhcmlhbnQsIGZvbnRXZWlnaHQsIGZvbnRTaXplLCBmb250RmFtaWx5LCBpbmhlcml0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZiA9IGluaGVyaXQgIT0gbnVsbCA/IHRoaXMuUGFyc2UoaW5oZXJpdCkgOiB0aGlzLkNyZWF0ZUZvbnQoJycsICcnLCAnJywgJycsICcnLCBzdmcuY3R4LmZvbnQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBmb250RmFtaWx5OiBmb250RmFtaWx5IHx8IGYuZm9udEZhbWlseSxcclxuICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogZm9udFNpemUgfHwgZi5mb250U2l6ZSxcclxuICAgICAgICAgICAgICAgICAgICBmb250U3R5bGU6IGZvbnRTdHlsZSB8fCBmLmZvbnRTdHlsZSxcclxuICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiBmb250V2VpZ2h0IHx8IGYuZm9udFdlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICBmb250VmFyaWFudDogZm9udFZhcmlhbnQgfHwgZi5mb250VmFyaWFudCxcclxuICAgICAgICAgICAgICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkgeyByZXR1cm4gW3RoaXMuZm9udFN0eWxlLCB0aGlzLmZvbnRWYXJpYW50LCB0aGlzLmZvbnRXZWlnaHQsIHRoaXMuZm9udFNpemUsIHRoaXMuZm9udEZhbWlseV0uam9pbignICcpIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICB0aGlzLlBhcnNlID0gZnVuY3Rpb24ocykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGYgPSB7fTtcclxuICAgICAgICAgICAgICAgIHZhciBkID0gc3ZnLnRyaW0oc3ZnLmNvbXByZXNzU3BhY2VzKHMgfHwgJycpKS5zcGxpdCgnICcpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHNldCA9IHsgZm9udFNpemU6IGZhbHNlLCBmb250U3R5bGU6IGZhbHNlLCBmb250V2VpZ2h0OiBmYWxzZSwgZm9udFZhcmlhbnQ6IGZhbHNlIH1cclxuICAgICAgICAgICAgICAgIHZhciBmZiA9ICcnO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPGQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNldC5mb250U3R5bGUgJiYgdGhhdC5TdHlsZXMuaW5kZXhPZihkW2ldKSAhPSAtMSkgeyBpZiAoZFtpXSAhPSAnaW5oZXJpdCcpIGYuZm9udFN0eWxlID0gZFtpXTsgc2V0LmZvbnRTdHlsZSA9IHRydWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICghc2V0LmZvbnRWYXJpYW50ICYmIHRoYXQuVmFyaWFudHMuaW5kZXhPZihkW2ldKSAhPSAtMSkgeyBpZiAoZFtpXSAhPSAnaW5oZXJpdCcpIGYuZm9udFZhcmlhbnQgPSBkW2ldOyBzZXQuZm9udFN0eWxlID0gc2V0LmZvbnRWYXJpYW50ID0gdHJ1ZTtcdH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICghc2V0LmZvbnRXZWlnaHQgJiYgdGhhdC5XZWlnaHRzLmluZGV4T2YoZFtpXSkgIT0gLTEpIHtcdGlmIChkW2ldICE9ICdpbmhlcml0JykgZi5mb250V2VpZ2h0ID0gZFtpXTsgc2V0LmZvbnRTdHlsZSA9IHNldC5mb250VmFyaWFudCA9IHNldC5mb250V2VpZ2h0ID0gdHJ1ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKCFzZXQuZm9udFNpemUpIHsgaWYgKGRbaV0gIT0gJ2luaGVyaXQnKSBmLmZvbnRTaXplID0gZFtpXS5zcGxpdCgnLycpWzBdOyBzZXQuZm9udFN0eWxlID0gc2V0LmZvbnRWYXJpYW50ID0gc2V0LmZvbnRXZWlnaHQgPSBzZXQuZm9udFNpemUgPSB0cnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGlmIChkW2ldICE9ICdpbmhlcml0JykgZmYgKz0gZFtpXTsgfVxyXG4gICAgICAgICAgICAgICAgfSBpZiAoZmYgIT0gJycpIGYuZm9udEZhbWlseSA9IGZmO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGY7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gcG9pbnRzIGFuZCBwYXRoc1xyXG4gICAgICAgIHN2Zy5Ub051bWJlckFycmF5ID0gZnVuY3Rpb24ocykge1xyXG4gICAgICAgICAgICB2YXIgYSA9IHN2Zy50cmltKHN2Zy5jb21wcmVzc1NwYWNlcygocyB8fCAnJykucmVwbGFjZSgvLC9nLCAnICcpKSkuc3BsaXQoJyAnKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPGEubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGFbaV0gPSBwYXJzZUZsb2F0KGFbaV0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBhO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuUG9pbnQgPSBmdW5jdGlvbih4LCB5KSB7XHJcbiAgICAgICAgICAgIHRoaXMueCA9IHg7XHJcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICAgICBzdmcuUG9pbnQucHJvdG90eXBlLmFuZ2xlVG8gPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihwLnkgLSB0aGlzLnksIHAueCAtIHRoaXMueCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHN2Zy5Qb2ludC5wcm90b3R5cGUuYXBwbHlUcmFuc2Zvcm0gPSBmdW5jdGlvbih2KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgeHAgPSB0aGlzLnggKiB2WzBdICsgdGhpcy55ICogdlsyXSArIHZbNF07XHJcbiAgICAgICAgICAgICAgICB2YXIgeXAgPSB0aGlzLnggKiB2WzFdICsgdGhpcy55ICogdlszXSArIHZbNV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLnggPSB4cDtcclxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHlwO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIHN2Zy5DcmVhdGVQb2ludCA9IGZ1bmN0aW9uKHMpIHtcclxuICAgICAgICAgICAgdmFyIGEgPSBzdmcuVG9OdW1iZXJBcnJheShzKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBzdmcuUG9pbnQoYVswXSwgYVsxXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5DcmVhdGVQYXRoID0gZnVuY3Rpb24ocykge1xyXG4gICAgICAgICAgICB2YXIgYSA9IHN2Zy5Ub051bWJlckFycmF5KHMpO1xyXG4gICAgICAgICAgICB2YXIgcGF0aCA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8YS5sZW5ndGg7IGkrPTIpIHtcclxuICAgICAgICAgICAgICAgIHBhdGgucHVzaChuZXcgc3ZnLlBvaW50KGFbaV0sIGFbaSsxXSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYm91bmRpbmcgYm94XHJcbiAgICAgICAgc3ZnLkJvdW5kaW5nQm94ID0gZnVuY3Rpb24oeDEsIHkxLCB4MiwgeTIpIHsgLy8gcGFzcyBpbiBpbml0aWFsIHBvaW50cyBpZiB5b3Ugd2FudFxyXG4gICAgICAgICAgICB0aGlzLngxID0gTnVtYmVyLk5hTjtcclxuICAgICAgICAgICAgdGhpcy55MSA9IE51bWJlci5OYU47XHJcbiAgICAgICAgICAgIHRoaXMueDIgPSBOdW1iZXIuTmFOO1xyXG4gICAgICAgICAgICB0aGlzLnkyID0gTnVtYmVyLk5hTjtcclxuXHJcbiAgICAgICAgICAgIHRoaXMueCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy54MTsgfVxyXG4gICAgICAgICAgICB0aGlzLnkgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMueTE7IH1cclxuICAgICAgICAgICAgdGhpcy53aWR0aCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy54MiAtIHRoaXMueDE7IH1cclxuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMueTIgLSB0aGlzLnkxOyB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFkZFBvaW50ID0gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHggIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc05hTih0aGlzLngxKSB8fCBpc05hTih0aGlzLngyKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLngxID0geDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54MiA9IHg7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh4IDwgdGhpcy54MSkgdGhpcy54MSA9IHg7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHggPiB0aGlzLngyKSB0aGlzLngyID0geDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoeSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTmFOKHRoaXMueTEpIHx8IGlzTmFOKHRoaXMueTIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueTEgPSB5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnkyID0geTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHkgPCB0aGlzLnkxKSB0aGlzLnkxID0geTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoeSA+IHRoaXMueTIpIHRoaXMueTIgPSB5O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuYWRkWCA9IGZ1bmN0aW9uKHgpIHsgdGhpcy5hZGRQb2ludCh4LCBudWxsKTsgfVxyXG4gICAgICAgICAgICB0aGlzLmFkZFkgPSBmdW5jdGlvbih5KSB7IHRoaXMuYWRkUG9pbnQobnVsbCwgeSk7IH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuYWRkQm91bmRpbmdCb3ggPSBmdW5jdGlvbihiYikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRQb2ludChiYi54MSwgYmIueTEpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRQb2ludChiYi54MiwgYmIueTIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFkZFF1YWRyYXRpY0N1cnZlID0gZnVuY3Rpb24ocDB4LCBwMHksIHAxeCwgcDF5LCBwMngsIHAyeSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNwMXggPSBwMHggKyAyLzMgKiAocDF4IC0gcDB4KTsgLy8gQ1AxID0gUVAwICsgMi8zICooUVAxLVFQMClcclxuICAgICAgICAgICAgICAgIHZhciBjcDF5ID0gcDB5ICsgMi8zICogKHAxeSAtIHAweSk7IC8vIENQMSA9IFFQMCArIDIvMyAqKFFQMS1RUDApXHJcbiAgICAgICAgICAgICAgICB2YXIgY3AyeCA9IGNwMXggKyAxLzMgKiAocDJ4IC0gcDB4KTsgLy8gQ1AyID0gQ1AxICsgMS8zICooUVAyLVFQMClcclxuICAgICAgICAgICAgICAgIHZhciBjcDJ5ID0gY3AxeSArIDEvMyAqIChwMnkgLSBwMHkpOyAvLyBDUDIgPSBDUDEgKyAxLzMgKihRUDItUVAwKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRCZXppZXJDdXJ2ZShwMHgsIHAweSwgY3AxeCwgY3AyeCwgY3AxeSxcdGNwMnksIHAyeCwgcDJ5KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5hZGRCZXppZXJDdXJ2ZSA9IGZ1bmN0aW9uKHAweCwgcDB5LCBwMXgsIHAxeSwgcDJ4LCBwMnksIHAzeCwgcDN5KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmcm9tIGh0dHA6Ly9ibG9nLmhhY2tlcnMtY2FmZS5uZXQvMjAwOS8wNi9ob3ctdG8tY2FsY3VsYXRlLWJlemllci1jdXJ2ZXMtYm91bmRpbmcuaHRtbFxyXG4gICAgICAgICAgICAgICAgdmFyIHAwID0gW3AweCwgcDB5XSwgcDEgPSBbcDF4LCBwMXldLCBwMiA9IFtwMngsIHAyeV0sIHAzID0gW3AzeCwgcDN5XTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkUG9pbnQocDBbMF0sIHAwWzFdKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkUG9pbnQocDNbMF0sIHAzWzFdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBmb3IgKGk9MDsgaTw9MTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGYgPSBmdW5jdGlvbih0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLnBvdygxLXQsIDMpICogcDBbaV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgKyAzICogTWF0aC5wb3coMS10LCAyKSAqIHQgKiBwMVtpXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICArIDMgKiAoMS10KSAqIE1hdGgucG93KHQsIDIpICogcDJbaV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgKyBNYXRoLnBvdyh0LCAzKSAqIHAzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSA2ICogcDBbaV0gLSAxMiAqIHAxW2ldICsgNiAqIHAyW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhID0gLTMgKiBwMFtpXSArIDkgKiBwMVtpXSAtIDkgKiBwMltpXSArIDMgKiBwM1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYyA9IDMgKiBwMVtpXSAtIDMgKiBwMFtpXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGEgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYiA9PSAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHQgPSAtYyAvIGI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgwIDwgdCAmJiB0IDwgMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT0gMCkgdGhpcy5hZGRYKGYodCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT0gMSkgdGhpcy5hZGRZKGYodCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIyYWMgPSBNYXRoLnBvdyhiLCAyKSAtIDQgKiBjICogYTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYjJhYyA8IDApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0MSA9ICgtYiArIE1hdGguc3FydChiMmFjKSkgLyAoMiAqIGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICgwIDwgdDEgJiYgdDEgPCAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09IDApIHRoaXMuYWRkWChmKHQxKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09IDEpIHRoaXMuYWRkWShmKHQxKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0MiA9ICgtYiAtIE1hdGguc3FydChiMmFjKSkgLyAoMiAqIGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICgwIDwgdDIgJiYgdDIgPCAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09IDApIHRoaXMuYWRkWChmKHQyKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09IDEpIHRoaXMuYWRkWShmKHQyKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmlzUG9pbnRJbkJveCA9IGZ1bmN0aW9uKHgsIHkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAodGhpcy54MSA8PSB4ICYmIHggPD0gdGhpcy54MiAmJiB0aGlzLnkxIDw9IHkgJiYgeSA8PSB0aGlzLnkyKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5hZGRQb2ludCh4MSwgeTEpO1xyXG4gICAgICAgICAgICB0aGlzLmFkZFBvaW50KHgyLCB5Mik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyB0cmFuc2Zvcm1zXHJcbiAgICAgICAgc3ZnLlRyYW5zZm9ybSA9IGZ1bmN0aW9uKHYpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICB0aGlzLlR5cGUgPSB7fVxyXG5cclxuICAgICAgICAgICAgLy8gdHJhbnNsYXRlXHJcbiAgICAgICAgICAgIHRoaXMuVHlwZS50cmFuc2xhdGUgPSBmdW5jdGlvbihzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnAgPSBzdmcuQ3JlYXRlUG9pbnQocyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGx5ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh0aGlzLnAueCB8fCAwLjAsIHRoaXMucC55IHx8IDAuMCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKC0xLjAgKiB0aGlzLnAueCB8fCAwLjAsIC0xLjAgKiB0aGlzLnAueSB8fCAwLjApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseVRvUG9pbnQgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcC5hcHBseVRyYW5zZm9ybShbMSwgMCwgMCwgMSwgdGhpcy5wLnggfHwgMC4wLCB0aGlzLnAueSB8fCAwLjBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gcm90YXRlXHJcbiAgICAgICAgICAgIHRoaXMuVHlwZS5yb3RhdGUgPSBmdW5jdGlvbihzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYSA9IHN2Zy5Ub051bWJlckFycmF5KHMpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hbmdsZSA9IG5ldyBzdmcuUHJvcGVydHkoJ2FuZ2xlJywgYVswXSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN4ID0gYVsxXSB8fCAwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jeSA9IGFbMl0gfHwgMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKHRoaXMuY3gsIHRoaXMuY3kpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5yb3RhdGUodGhpcy5hbmdsZS50b1JhZGlhbnMoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSgtdGhpcy5jeCwgLXRoaXMuY3kpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy51bmFwcGx5ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh0aGlzLmN4LCB0aGlzLmN5KTtcclxuICAgICAgICAgICAgICAgICAgICBjdHgucm90YXRlKC0xLjAgKiB0aGlzLmFuZ2xlLnRvUmFkaWFucygpKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKC10aGlzLmN4LCAtdGhpcy5jeSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGx5VG9Qb2ludCA9IGZ1bmN0aW9uKHApIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IHRoaXMuYW5nbGUudG9SYWRpYW5zKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcC5hcHBseVRyYW5zZm9ybShbMSwgMCwgMCwgMSwgdGhpcy5wLnggfHwgMC4wLCB0aGlzLnAueSB8fCAwLjBdKTtcclxuICAgICAgICAgICAgICAgICAgICBwLmFwcGx5VHJhbnNmb3JtKFtNYXRoLmNvcyhhKSwgTWF0aC5zaW4oYSksIC1NYXRoLnNpbihhKSwgTWF0aC5jb3MoYSksIDAsIDBdKTtcclxuICAgICAgICAgICAgICAgICAgICBwLmFwcGx5VHJhbnNmb3JtKFsxLCAwLCAwLCAxLCAtdGhpcy5wLnggfHwgMC4wLCAtdGhpcy5wLnkgfHwgMC4wXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuVHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucCA9IHN2Zy5DcmVhdGVQb2ludChzKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguc2NhbGUodGhpcy5wLnggfHwgMS4wLCB0aGlzLnAueSB8fCB0aGlzLnAueCB8fCAxLjApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy51bmFwcGx5ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnNjYWxlKDEuMCAvIHRoaXMucC54IHx8IDEuMCwgMS4wIC8gdGhpcy5wLnkgfHwgdGhpcy5wLnggfHwgMS4wKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlUb1BvaW50ID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHAuYXBwbHlUcmFuc2Zvcm0oW3RoaXMucC54IHx8IDAuMCwgMCwgMCwgdGhpcy5wLnkgfHwgMC4wLCAwLCAwXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuVHlwZS5tYXRyaXggPSBmdW5jdGlvbihzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm0gPSBzdmcuVG9OdW1iZXJBcnJheShzKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNmb3JtKHRoaXMubVswXSwgdGhpcy5tWzFdLCB0aGlzLm1bMl0sIHRoaXMubVszXSwgdGhpcy5tWzRdLCB0aGlzLm1bNV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy51bmFwcGx5ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSB0aGlzLm1bMF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSB0aGlzLm1bMl07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSB0aGlzLm1bNF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGQgPSB0aGlzLm1bMV07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGUgPSB0aGlzLm1bM107XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGYgPSB0aGlzLm1bNV07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGcgPSAwLjA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGggPSAwLjA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSAxLjA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRldCA9IDEgLyAoYSooZSppLWYqaCktYiooZCppLWYqZykrYyooZCpoLWUqZykpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC50cmFuc2Zvcm0oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooZSppLWYqaCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooZipnLWQqaSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooYypoLWIqaSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooYSppLWMqZyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooYipmLWMqZSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldCooYypkLWEqZilcclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseVRvUG9pbnQgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcC5hcHBseVRyYW5zZm9ybSh0aGlzLm0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLlR5cGUuU2tld0Jhc2UgPSBmdW5jdGlvbihzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2UgPSB0aGF0LlR5cGUubWF0cml4O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlKHMpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hbmdsZSA9IG5ldyBzdmcuUHJvcGVydHkoJ2FuZ2xlJywgcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5UeXBlLlNrZXdCYXNlLnByb3RvdHlwZSA9IG5ldyB0aGlzLlR5cGUubWF0cml4O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5UeXBlLnNrZXdYID0gZnVuY3Rpb24ocykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlID0gdGhhdC5UeXBlLlNrZXdCYXNlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlKHMpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tID0gWzEsIDAsIE1hdGgudGFuKHRoaXMuYW5nbGUudG9SYWRpYW5zKCkpLCAxLCAwLCAwXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLlR5cGUuc2tld1gucHJvdG90eXBlID0gbmV3IHRoaXMuVHlwZS5Ta2V3QmFzZTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuVHlwZS5za2V3WSA9IGZ1bmN0aW9uKHMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYmFzZSA9IHRoYXQuVHlwZS5Ta2V3QmFzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYmFzZShzKTtcclxuICAgICAgICAgICAgICAgIHRoaXMubSA9IFsxLCBNYXRoLnRhbih0aGlzLmFuZ2xlLnRvUmFkaWFucygpKSwgMCwgMSwgMCwgMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5UeXBlLnNrZXdZLnByb3RvdHlwZSA9IG5ldyB0aGlzLlR5cGUuU2tld0Jhc2U7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnRyYW5zZm9ybXMgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLnRyYW5zZm9ybXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyYW5zZm9ybXNbaV0uYXBwbHkoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy51bmFwcGx5ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPXRoaXMudHJhbnNmb3Jtcy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1zW2ldLnVuYXBwbHkoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5hcHBseVRvUG9pbnQgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy50cmFuc2Zvcm1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1zW2ldLmFwcGx5VG9Qb2ludChwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIGRhdGEgPSBzdmcudHJpbShzdmcuY29tcHJlc3NTcGFjZXModikpLnJlcGxhY2UoL1xcKShbYS16QS1aXSkvZywgJykgJDEnKS5yZXBsYWNlKC9cXCkoXFxzPyxcXHM/KS9nLCcpICcpLnNwbGl0KC9cXHMoPz1bYS16XSkvKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPGRhdGEubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciB0eXBlID0gc3ZnLnRyaW0oZGF0YVtpXS5zcGxpdCgnKCcpWzBdKTtcclxuICAgICAgICAgICAgICAgIHZhciBzID0gZGF0YVtpXS5zcGxpdCgnKCcpWzFdLnJlcGxhY2UoJyknLCcnKTtcclxuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSBuZXcgdGhpcy5UeXBlW3R5cGVdKHMpO1xyXG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtLnR5cGUgPSB0eXBlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1zLnB1c2godHJhbnNmb3JtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYXNwZWN0IHJhdGlvXHJcbiAgICAgICAgc3ZnLkFzcGVjdFJhdGlvID0gZnVuY3Rpb24oY3R4LCBhc3BlY3RSYXRpbywgd2lkdGgsIGRlc2lyZWRXaWR0aCwgaGVpZ2h0LCBkZXNpcmVkSGVpZ2h0LCBtaW5YLCBtaW5ZLCByZWZYLCByZWZZKSB7XHJcbiAgICAgICAgICAgIC8vIGFzcGVjdCByYXRpbyAtIGh0dHA6Ly93d3cudzMub3JnL1RSL1NWRy9jb29yZHMuaHRtbCNQcmVzZXJ2ZUFzcGVjdFJhdGlvQXR0cmlidXRlXHJcbiAgICAgICAgICAgIGFzcGVjdFJhdGlvID0gc3ZnLmNvbXByZXNzU3BhY2VzKGFzcGVjdFJhdGlvKTtcclxuICAgICAgICAgICAgYXNwZWN0UmF0aW8gPSBhc3BlY3RSYXRpby5yZXBsYWNlKC9eZGVmZXJcXHMvLCcnKTsgLy8gaWdub3JlIGRlZmVyXHJcbiAgICAgICAgICAgIHZhciBhbGlnbiA9IGFzcGVjdFJhdGlvLnNwbGl0KCcgJylbMF0gfHwgJ3hNaWRZTWlkJztcclxuICAgICAgICAgICAgdmFyIG1lZXRPclNsaWNlID0gYXNwZWN0UmF0aW8uc3BsaXQoJyAnKVsxXSB8fCAnbWVldCc7XHJcblxyXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgc2NhbGVcclxuICAgICAgICAgICAgdmFyIHNjYWxlWCA9IHdpZHRoIC8gZGVzaXJlZFdpZHRoO1xyXG4gICAgICAgICAgICB2YXIgc2NhbGVZID0gaGVpZ2h0IC8gZGVzaXJlZEhlaWdodDtcclxuICAgICAgICAgICAgdmFyIHNjYWxlTWluID0gTWF0aC5taW4oc2NhbGVYLCBzY2FsZVkpO1xyXG4gICAgICAgICAgICB2YXIgc2NhbGVNYXggPSBNYXRoLm1heChzY2FsZVgsIHNjYWxlWSk7XHJcbiAgICAgICAgICAgIGlmIChtZWV0T3JTbGljZSA9PSAnbWVldCcpIHsgZGVzaXJlZFdpZHRoICo9IHNjYWxlTWluOyBkZXNpcmVkSGVpZ2h0ICo9IHNjYWxlTWluOyB9XHJcbiAgICAgICAgICAgIGlmIChtZWV0T3JTbGljZSA9PSAnc2xpY2UnKSB7IGRlc2lyZWRXaWR0aCAqPSBzY2FsZU1heDsgZGVzaXJlZEhlaWdodCAqPSBzY2FsZU1heDsgfVxyXG5cclxuICAgICAgICAgICAgcmVmWCA9IG5ldyBzdmcuUHJvcGVydHkoJ3JlZlgnLCByZWZYKTtcclxuICAgICAgICAgICAgcmVmWSA9IG5ldyBzdmcuUHJvcGVydHkoJ3JlZlknLCByZWZZKTtcclxuICAgICAgICAgICAgaWYgKHJlZlguaGFzVmFsdWUoKSAmJiByZWZZLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUoLXNjYWxlTWluICogcmVmWC50b1BpeGVscygneCcpLCAtc2NhbGVNaW4gKiByZWZZLnRvUGl4ZWxzKCd5JykpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gYWxpZ25cclxuICAgICAgICAgICAgICAgIGlmIChhbGlnbi5tYXRjaCgvXnhNaWQvKSAmJiAoKG1lZXRPclNsaWNlID09ICdtZWV0JyAmJiBzY2FsZU1pbiA9PSBzY2FsZVkpIHx8IChtZWV0T3JTbGljZSA9PSAnc2xpY2UnICYmIHNjYWxlTWF4ID09IHNjYWxlWSkpKSBjdHgudHJhbnNsYXRlKHdpZHRoIC8gMi4wIC0gZGVzaXJlZFdpZHRoIC8gMi4wLCAwKTtcclxuICAgICAgICAgICAgICAgIGlmIChhbGlnbi5tYXRjaCgvWU1pZCQvKSAmJiAoKG1lZXRPclNsaWNlID09ICdtZWV0JyAmJiBzY2FsZU1pbiA9PSBzY2FsZVgpIHx8IChtZWV0T3JTbGljZSA9PSAnc2xpY2UnICYmIHNjYWxlTWF4ID09IHNjYWxlWCkpKSBjdHgudHJhbnNsYXRlKDAsIGhlaWdodCAvIDIuMCAtIGRlc2lyZWRIZWlnaHQgLyAyLjApO1xyXG4gICAgICAgICAgICAgICAgaWYgKGFsaWduLm1hdGNoKC9eeE1heC8pICYmICgobWVldE9yU2xpY2UgPT0gJ21lZXQnICYmIHNjYWxlTWluID09IHNjYWxlWSkgfHwgKG1lZXRPclNsaWNlID09ICdzbGljZScgJiYgc2NhbGVNYXggPT0gc2NhbGVZKSkpIGN0eC50cmFuc2xhdGUod2lkdGggLSBkZXNpcmVkV2lkdGgsIDApO1xyXG4gICAgICAgICAgICAgICAgaWYgKGFsaWduLm1hdGNoKC9ZTWF4JC8pICYmICgobWVldE9yU2xpY2UgPT0gJ21lZXQnICYmIHNjYWxlTWluID09IHNjYWxlWCkgfHwgKG1lZXRPclNsaWNlID09ICdzbGljZScgJiYgc2NhbGVNYXggPT0gc2NhbGVYKSkpIGN0eC50cmFuc2xhdGUoMCwgaGVpZ2h0IC0gZGVzaXJlZEhlaWdodCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIHNjYWxlXHJcbiAgICAgICAgICAgIGlmIChhbGlnbiA9PSAnbm9uZScpIGN0eC5zY2FsZShzY2FsZVgsIHNjYWxlWSk7XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKG1lZXRPclNsaWNlID09ICdtZWV0JykgY3R4LnNjYWxlKHNjYWxlTWluLCBzY2FsZU1pbik7XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKG1lZXRPclNsaWNlID09ICdzbGljZScpIGN0eC5zY2FsZShzY2FsZU1heCwgc2NhbGVNYXgpO1xyXG5cclxuICAgICAgICAgICAgLy8gdHJhbnNsYXRlXHJcbiAgICAgICAgICAgIGN0eC50cmFuc2xhdGUobWluWCA9PSBudWxsID8gMCA6IC1taW5YLCBtaW5ZID09IG51bGwgPyAwIDogLW1pblkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZWxlbWVudHNcclxuICAgICAgICBzdmcuRWxlbWVudCA9IHt9XHJcblxyXG4gICAgICAgIHN2Zy5FbXB0eVByb3BlcnR5ID0gbmV3IHN2Zy5Qcm9wZXJ0eSgnRU1QVFknLCAnJyk7XHJcblxyXG4gICAgICAgIHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5zdHlsZXMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5zdHlsZXNTcGVjaWZpY2l0eSA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XHJcblxyXG4gICAgICAgICAgICAvLyBnZXQgb3IgY3JlYXRlIGF0dHJpYnV0ZVxyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZSA9IGZ1bmN0aW9uKG5hbWUsIGNyZWF0ZUlmTm90RXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYSA9IHRoaXMuYXR0cmlidXRlc1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIGlmIChhICE9IG51bGwpIHJldHVybiBhO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChjcmVhdGVJZk5vdEV4aXN0cyA9PSB0cnVlKSB7IGEgPSBuZXcgc3ZnLlByb3BlcnR5KG5hbWUsICcnKTsgdGhpcy5hdHRyaWJ1dGVzW25hbWVdID0gYTsgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGEgfHwgc3ZnLkVtcHR5UHJvcGVydHk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0SHJlZkF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgYSBpbiB0aGlzLmF0dHJpYnV0ZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYSA9PSAnaHJlZicgfHwgYS5tYXRjaCgvOmhyZWYkLykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXR0cmlidXRlc1thXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3ZnLkVtcHR5UHJvcGVydHk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGdldCBvciBjcmVhdGUgc3R5bGUsIGNyYXdscyB1cCBub2RlIHRyZWVcclxuICAgICAgICAgICAgdGhpcy5zdHlsZSA9IGZ1bmN0aW9uKG5hbWUsIGNyZWF0ZUlmTm90RXhpc3RzLCBza2lwQW5jZXN0b3JzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcyA9IHRoaXMuc3R5bGVzW25hbWVdO1xyXG4gICAgICAgICAgICAgICAgaWYgKHMgIT0gbnVsbCkgcmV0dXJuIHM7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGEgPSB0aGlzLmF0dHJpYnV0ZShuYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChhICE9IG51bGwgJiYgYS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZXNbbmFtZV0gPSBhOyAvLyBtb3ZlIHVwIHRvIG1lIHRvIGNhY2hlXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGE7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHNraXBBbmNlc3RvcnMgIT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gdGhpcy5wYXJlbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHAgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHMgPSBwLnN0eWxlKG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHMgIT0gbnVsbCAmJiBwcy5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGNyZWF0ZUlmTm90RXhpc3RzID09IHRydWUpIHsgcyA9IG5ldyBzdmcuUHJvcGVydHkobmFtZSwgJycpOyB0aGlzLnN0eWxlc1tuYW1lXSA9IHM7IH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBzIHx8IHN2Zy5FbXB0eVByb3BlcnR5O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBiYXNlIHJlbmRlclxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlciA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgcmVuZGVyIGRpc3BsYXk9bm9uZVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ2Rpc3BsYXknKS52YWx1ZSA9PSAnbm9uZScpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBkb24ndCByZW5kZXIgdmlzaWJpbGl0eT1oaWRkZW5cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCd2aXNpYmlsaXR5JykudmFsdWUgPT0gJ2hpZGRlbicpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ21hc2snKS5oYXNWYWx1ZSgpKSB7IC8vIG1hc2tcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbWFzayA9IHRoaXMuc3R5bGUoJ21hc2snKS5nZXREZWZpbml0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hc2sgIT0gbnVsbCkgbWFzay5hcHBseShjdHgsIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5zdHlsZSgnZmlsdGVyJykuaGFzVmFsdWUoKSkgeyAvLyBmaWx0ZXJcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZmlsdGVyID0gdGhpcy5zdHlsZSgnZmlsdGVyJykuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWx0ZXIgIT0gbnVsbCkgZmlsdGVyLmFwcGx5KGN0eCwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldENvbnRleHQoY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNoaWxkcmVuKGN0eCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckNvbnRleHQoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGJhc2Ugc2V0IGNvbnRleHRcclxuICAgICAgICAgICAgdGhpcy5zZXRDb250ZXh0ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBPVkVSUklERSBNRSFcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gYmFzZSBjbGVhciBjb250ZXh0XHJcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDb250ZXh0ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBPVkVSUklERSBNRSFcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gYmFzZSByZW5kZXIgY2hpbGRyZW5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJDaGlsZHJlbiA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuW2ldLnJlbmRlcihjdHgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGROb2RlLCBjcmVhdGUpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkTm9kZTtcclxuICAgICAgICAgICAgICAgIGlmIChjcmVhdGUpIGNoaWxkID0gc3ZnLkNyZWF0ZUVsZW1lbnQoY2hpbGROb2RlKTtcclxuICAgICAgICAgICAgICAgIGNoaWxkLnBhcmVudCA9IHRoaXM7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQudHlwZSAhPSAndGl0bGUnKSB7IHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZCk7XHR9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuYWRkU3R5bGVzRnJvbVN0eWxlRGVmaW5pdGlvbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIC8vIGFkZCBzdHlsZXNcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIHNlbGVjdG9yIGluIHN2Zy5TdHlsZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0b3JbMF0gIT0gJ0AnICYmIG1hdGNoZXNTZWxlY3Rvcihub2RlLCBzZWxlY3RvcikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0eWxlcyA9IHN2Zy5TdHlsZXNbc2VsZWN0b3JdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BlY2lmaWNpdHkgPSBzdmcuU3R5bGVzU3BlY2lmaWNpdHlbc2VsZWN0b3JdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3R5bGVzICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc3R5bGVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGV4aXN0aW5nU3BlY2lmaWNpdHkgPSB0aGlzLnN0eWxlc1NwZWNpZmljaXR5W25hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZXhpc3RpbmdTcGVjaWZpY2l0eSkgPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmdTcGVjaWZpY2l0eSA9ICcwMDAnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BlY2lmaWNpdHkgPiBleGlzdGluZ1NwZWNpZmljaXR5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGVzW25hbWVdID0gc3R5bGVzW25hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0eWxlc1NwZWNpZmljaXR5W25hbWVdID0gc3BlY2lmaWNpdHk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKG5vZGUgIT0gbnVsbCAmJiBub2RlLm5vZGVUeXBlID09IDEpIHsgLy9FTEVNRU5UX05PREVcclxuICAgICAgICAgICAgICAgIC8vIGFkZCBhdHRyaWJ1dGVzXHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8bm9kZS5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZSA9IG5vZGUuYXR0cmlidXRlc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNbYXR0cmlidXRlLm5vZGVOYW1lXSA9IG5ldyBzdmcuUHJvcGVydHkoYXR0cmlidXRlLm5vZGVOYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkU3R5bGVzRnJvbVN0eWxlRGVmaW5pdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFkZCBpbmxpbmUgc3R5bGVzXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3N0eWxlJykuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdHlsZXMgPSB0aGlzLmF0dHJpYnV0ZSgnc3R5bGUnKS52YWx1ZS5zcGxpdCgnOycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxzdHlsZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN2Zy50cmltKHN0eWxlc1tpXSkgIT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHlsZSA9IHN0eWxlc1tpXS5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBzdmcudHJpbShzdHlsZVswXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdmcudHJpbShzdHlsZVsxXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0eWxlc1tuYW1lXSA9IG5ldyBzdmcuUHJvcGVydHkobmFtZSwgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFkZCBpZFxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdpZCcpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3ZnLkRlZmluaXRpb25zW3RoaXMuYXR0cmlidXRlKCdpZCcpLnZhbHVlXSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Zy5EZWZpbml0aW9uc1t0aGlzLmF0dHJpYnV0ZSgnaWQnKS52YWx1ZV0gPSB0aGlzO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBhZGQgY2hpbGRyZW5cclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGROb2RlID0gbm9kZS5jaGlsZE5vZGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZE5vZGUubm9kZVR5cGUgPT0gMSkgdGhpcy5hZGRDaGlsZChjaGlsZE5vZGUsIHRydWUpOyAvL0VMRU1FTlRfTk9ERVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNhcHR1cmVUZXh0Tm9kZXMgJiYgKGNoaWxkTm9kZS5ub2RlVHlwZSA9PSAzIHx8IGNoaWxkTm9kZS5ub2RlVHlwZSA9PSA0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGV4dCA9IGNoaWxkTm9kZS52YWx1ZSB8fCBjaGlsZE5vZGUudGV4dCB8fCBjaGlsZE5vZGUudGV4dENvbnRlbnQgfHwgJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdmcuY29tcHJlc3NTcGFjZXModGV4dCkgIT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2hpbGQobmV3IHN2Zy5FbGVtZW50LnRzcGFuKGNoaWxkTm9kZSksIGZhbHNlKTsgLy8gVEVYVF9OT0RFXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2UgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnNldENvbnRleHQgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIC8vIGZpbGxcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCdmaWxsJykuaXNVcmxEZWZpbml0aW9uKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZnMgPSB0aGlzLnN0eWxlKCdmaWxsJykuZ2V0RmlsbFN0eWxlRGVmaW5pdGlvbih0aGlzLCB0aGlzLnN0eWxlKCdmaWxsLW9wYWNpdHknKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzICE9IG51bGwpIGN0eC5maWxsU3R5bGUgPSBmcztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc3R5bGUoJ2ZpbGwnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGxTdHlsZSA9IHRoaXMuc3R5bGUoJ2ZpbGwnKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZmlsbFN0eWxlLnZhbHVlID09ICdjdXJyZW50Q29sb3InKSBmaWxsU3R5bGUudmFsdWUgPSB0aGlzLnN0eWxlKCdjb2xvcicpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWxsU3R5bGUudmFsdWUgIT0gJ2luaGVyaXQnKSBjdHguZmlsbFN0eWxlID0gKGZpbGxTdHlsZS52YWx1ZSA9PSAnbm9uZScgPyAncmdiYSgwLDAsMCwwKScgOiBmaWxsU3R5bGUudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ2ZpbGwtb3BhY2l0eScpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZmlsbFN0eWxlID0gbmV3IHN2Zy5Qcm9wZXJ0eSgnZmlsbCcsIGN0eC5maWxsU3R5bGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGxTdHlsZSA9IGZpbGxTdHlsZS5hZGRPcGFjaXR5KHRoaXMuc3R5bGUoJ2ZpbGwtb3BhY2l0eScpKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gZmlsbFN0eWxlLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIHN0cm9rZVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3N0cm9rZScpLmlzVXJsRGVmaW5pdGlvbigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZzID0gdGhpcy5zdHlsZSgnc3Ryb2tlJykuZ2V0RmlsbFN0eWxlRGVmaW5pdGlvbih0aGlzLCB0aGlzLnN0eWxlKCdzdHJva2Utb3BhY2l0eScpKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMgIT0gbnVsbCkgY3R4LnN0cm9rZVN0eWxlID0gZnM7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnN0eWxlKCdzdHJva2UnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0cm9rZVN0eWxlID0gdGhpcy5zdHlsZSgnc3Ryb2tlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0cm9rZVN0eWxlLnZhbHVlID09ICdjdXJyZW50Q29sb3InKSBzdHJva2VTdHlsZS52YWx1ZSA9IHRoaXMuc3R5bGUoJ2NvbG9yJykudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0cm9rZVN0eWxlLnZhbHVlICE9ICdpbmhlcml0JykgY3R4LnN0cm9rZVN0eWxlID0gKHN0cm9rZVN0eWxlLnZhbHVlID09ICdub25lJyA/ICdyZ2JhKDAsMCwwLDApJyA6IHN0cm9rZVN0eWxlLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCdzdHJva2Utb3BhY2l0eScpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3Ryb2tlU3R5bGUgPSBuZXcgc3ZnLlByb3BlcnR5KCdzdHJva2UnLCBjdHguc3Ryb2tlU3R5bGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN0cm9rZVN0eWxlID0gc3Ryb2tlU3R5bGUuYWRkT3BhY2l0eSh0aGlzLnN0eWxlKCdzdHJva2Utb3BhY2l0eScpKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBzdHJva2VTdHlsZS52YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCdzdHJva2Utd2lkdGgnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0xpbmVXaWR0aCA9IHRoaXMuc3R5bGUoJ3N0cm9rZS13aWR0aCcpLnRvUGl4ZWxzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmxpbmVXaWR0aCA9IG5ld0xpbmVXaWR0aCA9PSAwID8gMC4wMDEgOiBuZXdMaW5lV2lkdGg7IC8vIGJyb3dzZXJzIGRvbid0IHJlc3BlY3QgMFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3N0cm9rZS1saW5lY2FwJykuaGFzVmFsdWUoKSkgY3R4LmxpbmVDYXAgPSB0aGlzLnN0eWxlKCdzdHJva2UtbGluZWNhcCcpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3N0cm9rZS1saW5lam9pbicpLmhhc1ZhbHVlKCkpIGN0eC5saW5lSm9pbiA9IHRoaXMuc3R5bGUoJ3N0cm9rZS1saW5lam9pbicpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3N0cm9rZS1taXRlcmxpbWl0JykuaGFzVmFsdWUoKSkgY3R4Lm1pdGVyTGltaXQgPSB0aGlzLnN0eWxlKCdzdHJva2UtbWl0ZXJsaW1pdCcpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3N0cm9rZS1kYXNoYXJyYXknKS5oYXNWYWx1ZSgpICYmIHRoaXMuc3R5bGUoJ3N0cm9rZS1kYXNoYXJyYXknKS52YWx1ZSAhPSAnbm9uZScpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZ2FwcyA9IHN2Zy5Ub051bWJlckFycmF5KHRoaXMuc3R5bGUoJ3N0cm9rZS1kYXNoYXJyYXknKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZihjdHguc2V0TGluZURhc2gpICE9ICd1bmRlZmluZWQnKSB7IGN0eC5zZXRMaW5lRGFzaChnYXBzKTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZihjdHgud2Via2l0TGluZURhc2gpICE9ICd1bmRlZmluZWQnKSB7IGN0eC53ZWJraXRMaW5lRGFzaCA9IGdhcHM7IH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YoY3R4Lm1vekRhc2gpICE9ICd1bmRlZmluZWQnICYmICEoZ2Fwcy5sZW5ndGg9PTEgJiYgZ2Fwc1swXT09MCkpIHsgY3R4Lm1vekRhc2ggPSBnYXBzOyB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLnN0eWxlKCdzdHJva2UtZGFzaG9mZnNldCcpLm51bVZhbHVlT3JEZWZhdWx0KDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoY3R4LmxpbmVEYXNoT2Zmc2V0KSAhPSAndW5kZWZpbmVkJykgeyBjdHgubGluZURhc2hPZmZzZXQgPSBvZmZzZXQ7IH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YoY3R4LndlYmtpdExpbmVEYXNoT2Zmc2V0KSAhPSAndW5kZWZpbmVkJykgeyBjdHgud2Via2l0TGluZURhc2hPZmZzZXQgPSBvZmZzZXQ7IH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YoY3R4Lm1vekRhc2hPZmZzZXQpICE9ICd1bmRlZmluZWQnKSB7IGN0eC5tb3pEYXNoT2Zmc2V0ID0gb2Zmc2V0OyB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gZm9udFxyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZihjdHguZm9udCkgIT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguZm9udCA9IHN2Zy5Gb250LkNyZWF0ZUZvbnQoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGUoJ2ZvbnQtc3R5bGUnKS52YWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZSgnZm9udC12YXJpYW50JykudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGUoJ2ZvbnQtd2VpZ2h0JykudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGUoJ2ZvbnQtc2l6ZScpLmhhc1ZhbHVlKCkgPyB0aGlzLnN0eWxlKCdmb250LXNpemUnKS50b1BpeGVscygpICsgJ3B4JyA6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0eWxlKCdmb250LWZhbWlseScpLnZhbHVlKS50b1N0cmluZygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIHRyYW5zZm9ybVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ3RyYW5zZm9ybScsIGZhbHNlLCB0cnVlKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IG5ldyBzdmcuVHJhbnNmb3JtKHRoaXMuc3R5bGUoJ3RyYW5zZm9ybScsIGZhbHNlLCB0cnVlKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLmFwcGx5KGN0eCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gY2xpcFxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ2NsaXAtcGF0aCcsIGZhbHNlLCB0cnVlKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNsaXAgPSB0aGlzLnN0eWxlKCdjbGlwLXBhdGgnLCBmYWxzZSwgdHJ1ZSkuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbGlwICE9IG51bGwpIGNsaXAuYXBwbHkoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBvcGFjaXR5XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdHlsZSgnb3BhY2l0eScpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguZ2xvYmFsQWxwaGEgPSB0aGlzLnN0eWxlKCdvcGFjaXR5JykubnVtVmFsdWUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5SZW5kZXJlZEVsZW1lbnRCYXNlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5SZW5kZXJlZEVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBzdmcuQm91bmRpbmdCb3goKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJDaGlsZHJlbiA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYXRoKGN0eCk7XHJcbiAgICAgICAgICAgICAgICBzdmcuTW91c2UuY2hlY2tQYXRoKHRoaXMsIGN0eCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4LmZpbGxTdHlsZSAhPSAnJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCdmaWxsLXJ1bGUnKS52YWx1ZU9yRGVmYXVsdCgnaW5oZXJpdCcpICE9ICdpbmhlcml0JykgeyBjdHguZmlsbCh0aGlzLnN0eWxlKCdmaWxsLXJ1bGUnKS52YWx1ZSk7IH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgY3R4LmZpbGwoKTsgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGN0eC5zdHJva2VTdHlsZSAhPSAnJykgY3R4LnN0cm9rZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXJzID0gdGhpcy5nZXRNYXJrZXJzKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAobWFya2VycyAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ21hcmtlci1zdGFydCcpLmlzVXJsRGVmaW5pdGlvbigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSB0aGlzLnN0eWxlKCdtYXJrZXItc3RhcnQnKS5nZXREZWZpbml0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmtlci5yZW5kZXIoY3R4LCBtYXJrZXJzWzBdWzBdLCBtYXJrZXJzWzBdWzFdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc3R5bGUoJ21hcmtlci1taWQnKS5pc1VybERlZmluaXRpb24oKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWFya2VyID0gdGhpcy5zdHlsZSgnbWFya2VyLW1pZCcpLmdldERlZmluaXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT0xO2k8bWFya2Vycy5sZW5ndGgtMTtpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcmtlci5yZW5kZXIoY3R4LCBtYXJrZXJzW2ldWzBdLCBtYXJrZXJzW2ldWzFdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zdHlsZSgnbWFya2VyLWVuZCcpLmlzVXJsRGVmaW5pdGlvbigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSB0aGlzLnN0eWxlKCdtYXJrZXItZW5kJykuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJrZXIucmVuZGVyKGN0eCwgbWFya2Vyc1ttYXJrZXJzLmxlbmd0aC0xXVswXSwgbWFya2Vyc1ttYXJrZXJzLmxlbmd0aC0xXVsxXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldEJvdW5kaW5nQm94ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0TWFya2VycyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5SZW5kZXJlZEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBzdmcgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnN2ZyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5iYXNlQ2xlYXJDb250ZXh0ID0gdGhpcy5jbGVhckNvbnRleHQ7XHJcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDb250ZXh0ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VDbGVhckNvbnRleHQoY3R4KTtcclxuICAgICAgICAgICAgICAgIHN2Zy5WaWV3UG9ydC5SZW1vdmVDdXJyZW50KCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuYmFzZVNldENvbnRleHQgPSB0aGlzLnNldENvbnRleHQ7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0Q29udGV4dCA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgLy8gaW5pdGlhbCB2YWx1ZXMgYW5kIGRlZmF1bHRzXHJcbiAgICAgICAgICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAncmdiYSgwLDAsMCwwKSc7XHJcbiAgICAgICAgICAgICAgICBjdHgubGluZUNhcCA9ICdidXR0JztcclxuICAgICAgICAgICAgICAgIGN0eC5saW5lSm9pbiA9ICdtaXRlcic7XHJcbiAgICAgICAgICAgICAgICBjdHgubWl0ZXJMaW1pdCA9IDQ7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGN0eC5mb250KSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2Yod2luZG93LmdldENvbXB1dGVkU3R5bGUpICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmZvbnQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShjdHguY2FudmFzKS5nZXRQcm9wZXJ0eVZhbHVlKCdmb250Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlU2V0Q29udGV4dChjdHgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBuZXcgdmlldyBwb3J0XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYXR0cmlidXRlKCd4JykuaGFzVmFsdWUoKSkgdGhpcy5hdHRyaWJ1dGUoJ3gnLCB0cnVlKS52YWx1ZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYXR0cmlidXRlKCd5JykuaGFzVmFsdWUoKSkgdGhpcy5hdHRyaWJ1dGUoJ3knLCB0cnVlKS52YWx1ZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKHRoaXMuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKSwgdGhpcy5hdHRyaWJ1dGUoJ3knKS50b1BpeGVscygneScpKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgd2lkdGggPSBzdmcuVmlld1BvcnQud2lkdGgoKTtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSBzdmcuVmlld1BvcnQuaGVpZ2h0KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSgnd2lkdGgnKS5oYXNWYWx1ZSgpKSB0aGlzLmF0dHJpYnV0ZSgnd2lkdGgnLCB0cnVlKS52YWx1ZSA9ICcxMDAlJztcclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5hdHRyaWJ1dGUoJ2hlaWdodCcpLmhhc1ZhbHVlKCkpIHRoaXMuYXR0cmlidXRlKCdoZWlnaHQnLCB0cnVlKS52YWx1ZSA9ICcxMDAlJztcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5yb290KSA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gdGhpcy5hdHRyaWJ1dGUoJ3dpZHRoJykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSB0aGlzLmF0dHJpYnV0ZSgnaGVpZ2h0JykudG9QaXhlbHMoJ3knKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHggPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB5ID0gMDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3JlZlgnKS5oYXNWYWx1ZSgpICYmIHRoaXMuYXR0cmlidXRlKCdyZWZZJykuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB4ID0gLXRoaXMuYXR0cmlidXRlKCdyZWZYJykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgeSA9IC10aGlzLmF0dHJpYnV0ZSgncmVmWScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ292ZXJmbG93JykudmFsdWVPckRlZmF1bHQoJ2hpZGRlbicpICE9ICd2aXNpYmxlJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5tb3ZlVG8oeCwgeSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5saW5lVG8od2lkdGgsIHkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHdpZHRoLCBoZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHgsIGhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3R4LmNsaXAoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBzdmcuVmlld1BvcnQuU2V0Q3VycmVudCh3aWR0aCwgaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyB2aWV3Ym94XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3ZpZXdCb3gnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZpZXdCb3ggPSBzdmcuVG9OdW1iZXJBcnJheSh0aGlzLmF0dHJpYnV0ZSgndmlld0JveCcpLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbWluWCA9IHZpZXdCb3hbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1pblkgPSB2aWV3Qm94WzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gdmlld0JveFsyXTtcclxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSB2aWV3Qm94WzNdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBzdmcuQXNwZWN0UmF0aW8oY3R4LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZSgncHJlc2VydmVBc3BlY3RSYXRpbycpLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdmcuVmlld1BvcnQud2lkdGgoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN2Zy5WaWV3UG9ydC5oZWlnaHQoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5YLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5ZLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZSgncmVmWCcpLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZSgncmVmWScpLnZhbHVlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgc3ZnLlZpZXdQb3J0LlJlbW92ZUN1cnJlbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICBzdmcuVmlld1BvcnQuU2V0Q3VycmVudCh2aWV3Qm94WzJdLCB2aWV3Qm94WzNdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5zdmcucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHJlY3QgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnJlY3QgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlBhdGhFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHRoaXMuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgIHZhciB5ID0gdGhpcy5hdHRyaWJ1dGUoJ3knKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gdGhpcy5hdHRyaWJ1dGUoJ3dpZHRoJykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSB0aGlzLmF0dHJpYnV0ZSgnaGVpZ2h0JykudG9QaXhlbHMoJ3knKTtcclxuICAgICAgICAgICAgICAgIHZhciByeCA9IHRoaXMuYXR0cmlidXRlKCdyeCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgcnkgPSB0aGlzLmF0dHJpYnV0ZSgncnknKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdyeCcpLmhhc1ZhbHVlKCkgJiYgIXRoaXMuYXR0cmlidXRlKCdyeScpLmhhc1ZhbHVlKCkpIHJ5ID0gcng7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3J5JykuaGFzVmFsdWUoKSAmJiAhdGhpcy5hdHRyaWJ1dGUoJ3J4JykuaGFzVmFsdWUoKSkgcnggPSByeTtcclxuICAgICAgICAgICAgICAgIHJ4ID0gTWF0aC5taW4ocngsIHdpZHRoIC8gMi4wKTtcclxuICAgICAgICAgICAgICAgIHJ5ID0gTWF0aC5taW4ocnksIGhlaWdodCAvIDIuMCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4Lm1vdmVUbyh4ICsgcngsIHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5saW5lVG8oeCArIHdpZHRoIC0gcngsIHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3aWR0aCwgeSwgeCArIHdpZHRoLCB5ICsgcnkpXHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmxpbmVUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQgLSByeSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0LCB4ICsgd2lkdGggLSByeCwgeSArIGhlaWdodClcclxuICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHggKyByeCwgeSArIGhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJ5KVxyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5saW5lVG8oeCwgeSArIHJ5KTtcclxuICAgICAgICAgICAgICAgICAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5LCB4ICsgcngsIHkpXHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgc3ZnLkJvdW5kaW5nQm94KHgsIHksIHggKyB3aWR0aCwgeSArIGhlaWdodCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQucmVjdC5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBjaXJjbGUgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmNpcmNsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjeCA9IHRoaXMuYXR0cmlidXRlKCdjeCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY3kgPSB0aGlzLmF0dHJpYnV0ZSgnY3knKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHIgPSB0aGlzLmF0dHJpYnV0ZSgncicpLnRvUGl4ZWxzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGN0eCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5hcmMoY3gsIGN5LCByLCAwLCBNYXRoLlBJICogMiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgc3ZnLkJvdW5kaW5nQm94KGN4IC0gciwgY3kgLSByLCBjeCArIHIsIGN5ICsgcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuY2lyY2xlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5QYXRoRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIGVsbGlwc2UgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmVsbGlwc2UgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlBhdGhFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgS0FQUEEgPSA0ICogKChNYXRoLnNxcnQoMikgLSAxKSAvIDMpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHJ4ID0gdGhpcy5hdHRyaWJ1dGUoJ3J4JykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgIHZhciByeSA9IHRoaXMuYXR0cmlidXRlKCdyeScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY3ggPSB0aGlzLmF0dHJpYnV0ZSgnY3gnKS50b1BpeGVscygneCcpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGN5ID0gdGhpcy5hdHRyaWJ1dGUoJ2N5JykudG9QaXhlbHMoJ3knKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4Lm1vdmVUbyhjeCwgY3kgLSByeSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LmJlemllckN1cnZlVG8oY3ggKyAoS0FQUEEgKiByeCksIGN5IC0gcnksICBjeCArIHJ4LCBjeSAtIChLQVBQQSAqIHJ5KSwgY3ggKyByeCwgY3kpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5iZXppZXJDdXJ2ZVRvKGN4ICsgcngsIGN5ICsgKEtBUFBBICogcnkpLCBjeCArIChLQVBQQSAqIHJ4KSwgY3kgKyByeSwgY3gsIGN5ICsgcnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5iZXppZXJDdXJ2ZVRvKGN4IC0gKEtBUFBBICogcngpLCBjeSArIHJ5LCBjeCAtIHJ4LCBjeSArIChLQVBQQSAqIHJ5KSwgY3ggLSByeCwgY3kpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5iZXppZXJDdXJ2ZVRvKGN4IC0gcngsIGN5IC0gKEtBUFBBICogcnkpLCBjeCAtIChLQVBQQSAqIHJ4KSwgY3kgLSByeSwgY3gsIGN5IC0gcnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHN2Zy5Cb3VuZGluZ0JveChjeCAtIHJ4LCBjeSAtIHJ5LCBjeCArIHJ4LCBjeSArIHJ5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5lbGxpcHNlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5QYXRoRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIGxpbmUgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmxpbmUgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlBhdGhFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRQb2ludHMgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IHN2Zy5Qb2ludCh0aGlzLmF0dHJpYnV0ZSgneDEnKS50b1BpeGVscygneCcpLCB0aGlzLmF0dHJpYnV0ZSgneTEnKS50b1BpeGVscygneScpKSxcclxuICAgICAgICAgICAgICAgICAgICBuZXcgc3ZnLlBvaW50KHRoaXMuYXR0cmlidXRlKCd4MicpLnRvUGl4ZWxzKCd4JyksIHRoaXMuYXR0cmlidXRlKCd5MicpLnRvUGl4ZWxzKCd5JykpXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5nZXRQb2ludHMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4Lm1vdmVUbyhwb2ludHNbMF0ueCwgcG9pbnRzWzBdLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5saW5lVG8ocG9pbnRzWzFdLngsIHBvaW50c1sxXS55KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHN2Zy5Cb3VuZGluZ0JveChwb2ludHNbMF0ueCwgcG9pbnRzWzBdLnksIHBvaW50c1sxXS54LCBwb2ludHNbMV0ueSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0TWFya2VycyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMuZ2V0UG9pbnRzKCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgYSA9IHBvaW50c1swXS5hbmdsZVRvKHBvaW50c1sxXSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gW1twb2ludHNbMF0sIGFdLCBbcG9pbnRzWzFdLCBhXV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQubGluZS5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBwb2x5bGluZSBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQucG9seWxpbmUgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlBhdGhFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wb2ludHMgPSBzdmcuQ3JlYXRlUGF0aCh0aGlzLmF0dHJpYnV0ZSgncG9pbnRzJykudmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBiYiA9IG5ldyBzdmcuQm91bmRpbmdCb3godGhpcy5wb2ludHNbMF0ueCwgdGhpcy5wb2ludHNbMF0ueSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLnBvaW50c1swXS54LCB0aGlzLnBvaW50c1swXS55KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MTsgaTx0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGJiLmFkZFBvaW50KHRoaXMucG9pbnRzW2ldLngsIHRoaXMucG9pbnRzW2ldLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkgY3R4LmxpbmVUbyh0aGlzLnBvaW50c1tpXS54LCB0aGlzLnBvaW50c1tpXS55KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBiYjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRNYXJrZXJzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VycyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRoaXMucG9pbnRzLmxlbmd0aCAtIDE7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hcmtlcnMucHVzaChbdGhpcy5wb2ludHNbaV0sIHRoaXMucG9pbnRzW2ldLmFuZ2xlVG8odGhpcy5wb2ludHNbaSsxXSldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG1hcmtlcnMucHVzaChbdGhpcy5wb2ludHNbdGhpcy5wb2ludHMubGVuZ3RoLTFdLCBtYXJrZXJzW21hcmtlcnMubGVuZ3RoLTFdWzFdXSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbWFya2VycztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5wb2x5bGluZS5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBwb2x5Z29uIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5wb2x5Z29uID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5wb2x5bGluZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5iYXNlUGF0aCA9IHRoaXMucGF0aDtcclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYmIgPSB0aGlzLmJhc2VQYXRoKGN0eCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHRoaXMucG9pbnRzWzBdLngsIHRoaXMucG9pbnRzWzBdLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBiYjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5wb2x5Z29uLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5wb2x5bGluZTtcclxuXHJcbiAgICAgICAgLy8gcGF0aCBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQucGF0aCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUGF0aEVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZCA9IHRoaXMuYXR0cmlidXRlKCdkJykudmFsdWU7XHJcbiAgICAgICAgICAgIC8vIFRPRE86IGNvbnZlcnQgdG8gcmVhbCBsZXhlciBiYXNlZCBvbiBodHRwOi8vd3d3LnczLm9yZy9UUi9TVkcxMS9wYXRocy5odG1sI1BhdGhEYXRhQk5GXHJcbiAgICAgICAgICAgIGQgPSBkLnJlcGxhY2UoLywvZ20sJyAnKTsgLy8gZ2V0IHJpZCBvZiBhbGwgY29tbWFzXHJcbiAgICAgICAgICAgIC8vIEFzIHRoZSBlbmQgb2YgYSBtYXRjaCBjYW4gYWxzbyBiZSB0aGUgc3RhcnQgb2YgdGhlIG5leHQgbWF0Y2gsIHdlIG5lZWQgdG8gcnVuIHRoaXMgcmVwbGFjZSB0d2ljZS5cclxuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8MjsgaSsrKVxyXG4gICAgICAgICAgICAgICAgZCA9IGQucmVwbGFjZSgvKFtNbVp6TGxIaFZ2Q2NTc1FxVHRBYV0pKFteXFxzXSkvZ20sJyQxICQyJyk7IC8vIHN1ZmZpeCBjb21tYW5kcyB3aXRoIHNwYWNlc1xyXG4gICAgICAgICAgICBkID0gZC5yZXBsYWNlKC8oW15cXHNdKShbTW1aekxsSGhWdkNjU3NRcVR0QWFdKS9nbSwnJDEgJDInKTsgLy8gcHJlZml4IGNvbW1hbmRzIHdpdGggc3BhY2VzXHJcbiAgICAgICAgICAgIGQgPSBkLnJlcGxhY2UoLyhbMC05XSkoWytcXC1dKS9nbSwnJDEgJDInKTsgLy8gc2VwYXJhdGUgZGlnaXRzIG9uICstIHNpZ25zXHJcbiAgICAgICAgICAgIC8vIEFnYWluLCB3ZSBuZWVkIHRvIHJ1biB0aGlzIHR3aWNlIHRvIGZpbmQgYWxsIG9jY3VyYW5jZXNcclxuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8MjsgaSsrKVxyXG4gICAgICAgICAgICAgICAgZCA9IGQucmVwbGFjZSgvKFxcLlswLTldKikoXFwuKS9nbSwnJDEgJDInKTsgLy8gc2VwYXJhdGUgZGlnaXRzIHdoZW4gdGhleSBzdGFydCB3aXRoIGEgY29tbWFcclxuICAgICAgICAgICAgZCA9IGQucmVwbGFjZSgvKFtBYV0oXFxzK1swLTldKyl7M30pXFxzKyhbMDFdKVxccyooWzAxXSkvZ20sJyQxICQzICQ0ICcpOyAvLyBzaG9ydGhhbmQgZWxsaXB0aWNhbCBhcmMgcGF0aCBzeW50YXhcclxuICAgICAgICAgICAgZCA9IHN2Zy5jb21wcmVzc1NwYWNlcyhkKTsgLy8gY29tcHJlc3MgbXVsdGlwbGUgc3BhY2VzXHJcbiAgICAgICAgICAgIGQgPSBzdmcudHJpbShkKTtcclxuICAgICAgICAgICAgdGhpcy5QYXRoUGFyc2VyID0gbmV3IChmdW5jdGlvbihkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRva2VucyA9IGQuc3BsaXQoJyAnKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pID0gLTE7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21tYW5kID0gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NvbW1hbmQgPSAnJztcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0ID0gbmV3IHN2Zy5Qb2ludCgwLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2wgPSBuZXcgc3ZnLlBvaW50KDAsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudCA9IG5ldyBzdmcuUG9pbnQoMCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb2ludHMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuaXNFbmQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pID49IHRoaXMudG9rZW5zLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5pc0NvbW1hbmRPckVuZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzRW5kKCkpIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmkgKyAxXS5tYXRjaCgvXltBLVphLXpdJC8pICE9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5pc1JlbGF0aXZlQ29tbWFuZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCh0aGlzLmNvbW1hbmQpXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdtJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2gnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICd2JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnYyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3MnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdxJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2EnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICd6JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldFRva2VuID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pKys7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaV07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTY2FsYXIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzLmdldFRva2VuKCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMubmV4dENvbW1hbmQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzQ29tbWFuZCA9IHRoaXMuY29tbWFuZDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbW1hbmQgPSB0aGlzLmdldFRva2VuKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRQb2ludCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gbmV3IHN2Zy5Qb2ludCh0aGlzLmdldFNjYWxhcigpLCB0aGlzLmdldFNjYWxhcigpKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYWtlQWJzb2x1dGUocCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRBc0NvbnRyb2xQb2ludCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gdGhpcy5nZXRQb2ludCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbCA9IHA7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHA7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRBc0N1cnJlbnRQb2ludCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gdGhpcy5nZXRQb2ludCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudCA9IHA7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHA7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRSZWZsZWN0ZWRDb250cm9sUG9pbnQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wcmV2aW91c0NvbW1hbmQudG9Mb3dlckNhc2UoKSAhPSAnYycgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NvbW1hbmQudG9Mb3dlckNhc2UoKSAhPSAncycgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NvbW1hbmQudG9Mb3dlckNhc2UoKSAhPSAncScgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NvbW1hbmQudG9Mb3dlckNhc2UoKSAhPSAndCcgKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlZmxlY3QgcG9pbnRcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcCA9IG5ldyBzdmcuUG9pbnQoMiAqIHRoaXMuY3VycmVudC54IC0gdGhpcy5jb250cm9sLngsIDIgKiB0aGlzLmN1cnJlbnQueSAtIHRoaXMuY29udHJvbC55KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLm1ha2VBYnNvbHV0ZSA9IGZ1bmN0aW9uKHApIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc1JlbGF0aXZlQ29tbWFuZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHAueCArPSB0aGlzLmN1cnJlbnQueDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcC55ICs9IHRoaXMuY3VycmVudC55O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1hcmtlciA9IGZ1bmN0aW9uKHAsIGZyb20sIHByaW9yVG8pIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGFzdCBhbmdsZSBpc24ndCBmaWxsZWQgaW4gYmVjYXVzZSB3ZSBkaWRuJ3QgaGF2ZSB0aGlzIHBvaW50IHlldCAuLi5cclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJpb3JUbyAhPSBudWxsICYmIHRoaXMuYW5nbGVzLmxlbmd0aCA+IDAgJiYgdGhpcy5hbmdsZXNbdGhpcy5hbmdsZXMubGVuZ3RoLTFdID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmdsZXNbdGhpcy5hbmdsZXMubGVuZ3RoLTFdID0gdGhpcy5wb2ludHNbdGhpcy5wb2ludHMubGVuZ3RoLTFdLmFuZ2xlVG8ocHJpb3JUbyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTWFya2VyQW5nbGUocCwgZnJvbSA9PSBudWxsID8gbnVsbCA6IGZyb20uYW5nbGVUbyhwKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRNYXJrZXJBbmdsZSA9IGZ1bmN0aW9uKHAsIGEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvaW50cy5wdXNoKHApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYW5nbGVzLnB1c2goYSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRNYXJrZXJQb2ludHMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMucG9pbnRzOyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldE1hcmtlckFuZ2xlcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLmFuZ2xlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hbmdsZXNbaV0gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaj1pKzE7IGo8dGhpcy5hbmdsZXMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hbmdsZXNbal0gIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFuZ2xlc1tpXSA9IHRoaXMuYW5nbGVzW2pdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYW5nbGVzO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KShkKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBwID0gdGhpcy5QYXRoUGFyc2VyO1xyXG4gICAgICAgICAgICAgICAgcHAucmVzZXQoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgYmIgPSBuZXcgc3ZnLkJvdW5kaW5nQm94KCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICAgICAgICAgIHdoaWxlICghcHAuaXNFbmQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHBwLm5leHRDb21tYW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChwcC5jb21tYW5kKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnTSc6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwID0gcHAuZ2V0QXNDdXJyZW50UG9pbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHAuYWRkTWFya2VyKHApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiYi5hZGRQb2ludChwLngsIHAueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkgY3R4Lm1vdmVUbyhwLngsIHAueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBwLnN0YXJ0ID0gcHAuY3VycmVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKCFwcC5pc0NvbW1hbmRPckVuZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcCA9IHBwLmdldEFzQ3VycmVudFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIocCwgcHAuc3RhcnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmIuYWRkUG9pbnQocC54LCBwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0eCAhPSBudWxsKSBjdHgubGluZVRvKHAueCwgcC55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdMJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdsJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKCFwcC5pc0NvbW1hbmRPckVuZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYyA9IHBwLmN1cnJlbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcCA9IHBwLmdldEFzQ3VycmVudFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIocCwgYyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYi5hZGRQb2ludChwLngsIHAueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIGN0eC5saW5lVG8ocC54LCBwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ0gnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2gnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIXBwLmlzQ29tbWFuZE9yRW5kKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdQID0gbmV3IHN2Zy5Qb2ludCgocHAuaXNSZWxhdGl2ZUNvbW1hbmQoKSA/IHBwLmN1cnJlbnQueCA6IDApICsgcHAuZ2V0U2NhbGFyKCksIHBwLmN1cnJlbnQueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIobmV3UCwgcHAuY3VycmVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5jdXJyZW50ID0gbmV3UDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJiLmFkZFBvaW50KHBwLmN1cnJlbnQueCwgcHAuY3VycmVudC55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkgY3R4LmxpbmVUbyhwcC5jdXJyZW50LngsIHBwLmN1cnJlbnQueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnVic6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndic6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlICghcHAuaXNDb21tYW5kT3JFbmQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1AgPSBuZXcgc3ZnLlBvaW50KHBwLmN1cnJlbnQueCwgKHBwLmlzUmVsYXRpdmVDb21tYW5kKCkgPyBwcC5jdXJyZW50LnkgOiAwKSArIHBwLmdldFNjYWxhcigpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBwLmFkZE1hcmtlcihuZXdQLCBwcC5jdXJyZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBwLmN1cnJlbnQgPSBuZXdQO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmIuYWRkUG9pbnQocHAuY3VycmVudC54LCBwcC5jdXJyZW50LnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0eCAhPSBudWxsKSBjdHgubGluZVRvKHBwLmN1cnJlbnQueCwgcHAuY3VycmVudC55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdDJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdjJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKCFwcC5pc0NvbW1hbmRPckVuZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3VyciA9IHBwLmN1cnJlbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcDEgPSBwcC5nZXRQb2ludCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNudHJsID0gcHAuZ2V0QXNDb250cm9sUG9pbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjcCA9IHBwLmdldEFzQ3VycmVudFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIoY3AsIGNudHJsLCBwMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYi5hZGRCZXppZXJDdXJ2ZShjdXJyLngsIGN1cnIueSwgcDEueCwgcDEueSwgY250cmwueCwgY250cmwueSwgY3AueCwgY3AueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIGN0eC5iZXppZXJDdXJ2ZVRvKHAxLngsIHAxLnksIGNudHJsLngsIGNudHJsLnksIGNwLngsIGNwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ1MnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3MnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIXBwLmlzQ29tbWFuZE9yRW5kKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjdXJyID0gcHAuY3VycmVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwMSA9IHBwLmdldFJlZmxlY3RlZENvbnRyb2xQb2ludCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNudHJsID0gcHAuZ2V0QXNDb250cm9sUG9pbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjcCA9IHBwLmdldEFzQ3VycmVudFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIoY3AsIGNudHJsLCBwMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYi5hZGRCZXppZXJDdXJ2ZShjdXJyLngsIGN1cnIueSwgcDEueCwgcDEueSwgY250cmwueCwgY250cmwueSwgY3AueCwgY3AueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIGN0eC5iZXppZXJDdXJ2ZVRvKHAxLngsIHAxLnksIGNudHJsLngsIGNudHJsLnksIGNwLngsIGNwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ1EnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3EnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIXBwLmlzQ29tbWFuZE9yRW5kKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjdXJyID0gcHAuY3VycmVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjbnRybCA9IHBwLmdldEFzQ29udHJvbFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3AgPSBwcC5nZXRBc0N1cnJlbnRQb2ludCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHAuYWRkTWFya2VyKGNwLCBjbnRybCwgY250cmwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmIuYWRkUXVhZHJhdGljQ3VydmUoY3Vyci54LCBjdXJyLnksIGNudHJsLngsIGNudHJsLnksIGNwLngsIGNwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0eCAhPSBudWxsKSBjdHgucXVhZHJhdGljQ3VydmVUbyhjbnRybC54LCBjbnRybC55LCBjcC54LCBjcC55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdUJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICd0JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKCFwcC5pc0NvbW1hbmRPckVuZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3VyciA9IHBwLmN1cnJlbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY250cmwgPSBwcC5nZXRSZWZsZWN0ZWRDb250cm9sUG9pbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBwLmNvbnRyb2wgPSBjbnRybDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjcCA9IHBwLmdldEFzQ3VycmVudFBvaW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXIoY3AsIGNudHJsLCBjbnRybCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYi5hZGRRdWFkcmF0aWNDdXJ2ZShjdXJyLngsIGN1cnIueSwgY250cmwueCwgY250cmwueSwgY3AueCwgY3AueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3R4ICE9IG51bGwpIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKGNudHJsLngsIGNudHJsLnksIGNwLngsIGNwLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ0EnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2EnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIXBwLmlzQ29tbWFuZE9yRW5kKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjdXJyID0gcHAuY3VycmVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByeCA9IHBwLmdldFNjYWxhcigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJ5ID0gcHAuZ2V0U2NhbGFyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgeEF4aXNSb3RhdGlvbiA9IHBwLmdldFNjYWxhcigpICogKE1hdGguUEkgLyAxODAuMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFyZ2VBcmNGbGFnID0gcHAuZ2V0U2NhbGFyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3dlZXBGbGFnID0gcHAuZ2V0U2NhbGFyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3AgPSBwcC5nZXRBc0N1cnJlbnRQb2ludCgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbnZlcnNpb24gZnJvbSBlbmRwb2ludCB0byBjZW50ZXIgcGFyYW1ldGVyaXphdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaHR0cDovL3d3dy53My5vcmcvVFIvU1ZHMTEvaW1wbG5vdGUuaHRtbCNBcmNJbXBsZW1lbnRhdGlvbk5vdGVzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB4MScsIHkxJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJwID0gbmV3IHN2Zy5Qb2ludChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNvcyh4QXhpc1JvdGF0aW9uKSAqIChjdXJyLnggLSBjcC54KSAvIDIuMCArIE1hdGguc2luKHhBeGlzUm90YXRpb24pICogKGN1cnIueSAtIGNwLnkpIC8gMi4wLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC1NYXRoLnNpbih4QXhpc1JvdGF0aW9uKSAqIChjdXJyLnggLSBjcC54KSAvIDIuMCArIE1hdGguY29zKHhBeGlzUm90YXRpb24pICogKGN1cnIueSAtIGNwLnkpIC8gMi4wXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRqdXN0IHJhZGlpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbCA9IE1hdGgucG93KGN1cnJwLngsMikvTWF0aC5wb3cocngsMikrTWF0aC5wb3coY3VycnAueSwyKS9NYXRoLnBvdyhyeSwyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ4ICo9IE1hdGguc3FydChsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByeSAqPSBNYXRoLnNxcnQobCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjeCcsIGN5J1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSAobGFyZ2VBcmNGbGFnID09IHN3ZWVwRmxhZyA/IC0xIDogMSkgKiBNYXRoLnNxcnQoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKChNYXRoLnBvdyhyeCwyKSpNYXRoLnBvdyhyeSwyKSktKE1hdGgucG93KHJ4LDIpKk1hdGgucG93KGN1cnJwLnksMikpLShNYXRoLnBvdyhyeSwyKSpNYXRoLnBvdyhjdXJycC54LDIpKSkgL1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChNYXRoLnBvdyhyeCwyKSpNYXRoLnBvdyhjdXJycC55LDIpK01hdGgucG93KHJ5LDIpKk1hdGgucG93KGN1cnJwLngsMikpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTmFOKHMpKSBzID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjcHAgPSBuZXcgc3ZnLlBvaW50KHMgKiByeCAqIGN1cnJwLnkgLyByeSwgcyAqIC1yeSAqIGN1cnJwLnggLyByeCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjeCwgY3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZW50cCA9IG5ldyBzdmcuUG9pbnQoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGN1cnIueCArIGNwLngpIC8gMi4wICsgTWF0aC5jb3MoeEF4aXNSb3RhdGlvbikgKiBjcHAueCAtIE1hdGguc2luKHhBeGlzUm90YXRpb24pICogY3BwLnksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGN1cnIueSArIGNwLnkpIC8gMi4wICsgTWF0aC5zaW4oeEF4aXNSb3RhdGlvbikgKiBjcHAueCArIE1hdGguY29zKHhBeGlzUm90YXRpb24pICogY3BwLnlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2ZWN0b3IgbWFnbml0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbSA9IGZ1bmN0aW9uKHYpIHsgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyh2WzBdLDIpICsgTWF0aC5wb3codlsxXSwyKSk7IH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJhdGlvIGJldHdlZW4gdHdvIHZlY3RvcnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gZnVuY3Rpb24odSwgdikgeyByZXR1cm4gKHVbMF0qdlswXSt1WzFdKnZbMV0pIC8gKG0odSkqbSh2KSkgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5nbGUgYmV0d2VlbiB0d28gdmVjdG9yc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSBmdW5jdGlvbih1LCB2KSB7IHJldHVybiAodVswXSp2WzFdIDwgdVsxXSp2WzBdID8gLTEgOiAxKSAqIE1hdGguYWNvcyhyKHUsdikpOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbml0aWFsIGFuZ2xlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYTEgPSBhKFsxLDBdLCBbKGN1cnJwLngtY3BwLngpL3J4LChjdXJycC55LWNwcC55KS9yeV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5nbGUgZGVsdGFcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1ID0gWyhjdXJycC54LWNwcC54KS9yeCwoY3VycnAueS1jcHAueSkvcnldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHYgPSBbKC1jdXJycC54LWNwcC54KS9yeCwoLWN1cnJwLnktY3BwLnkpL3J5XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhZCA9IGEodSwgdik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocih1LHYpIDw9IC0xKSBhZCA9IE1hdGguUEk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocih1LHYpID49IDEpIGFkID0gMDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgbWFya2Vyc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRpciA9IDEgLSBzd2VlcEZsYWcgPyAxLjAgOiAtMS4wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFoID0gYTEgKyBkaXIgKiAoYWQgLyAyLjApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGhhbGZXYXkgPSBuZXcgc3ZnLlBvaW50KFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNlbnRwLnggKyByeCAqIE1hdGguY29zKGFoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZW50cC55ICsgcnkgKiBNYXRoLnNpbihhaClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcC5hZGRNYXJrZXJBbmdsZShoYWxmV2F5LCBhaCAtIGRpciAqIE1hdGguUEkgLyAyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBwLmFkZE1hcmtlckFuZ2xlKGNwLCBhaCAtIGRpciAqIE1hdGguUEkpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJiLmFkZFBvaW50KGNwLngsIGNwLnkpOyAvLyBUT0RPOiB0aGlzIGlzIHRvbyBuYWl2ZSwgbWFrZSBpdCBiZXR0ZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gcnggPiByeSA/IHJ4IDogcnk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN4ID0gcnggPiByeSA/IDEgOiByeCAvIHJ5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzeSA9IHJ4ID4gcnkgPyByeSAvIHJ4IDogMTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZShjZW50cC54LCBjZW50cC55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdHgucm90YXRlKHhBeGlzUm90YXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5zY2FsZShzeCwgc3kpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5hcmMoMCwgMCwgciwgYTEsIGExICsgYWQsIDEgLSBzd2VlcEZsYWcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5zY2FsZSgxL3N4LCAxL3N5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdHgucm90YXRlKC14QXhpc1JvdGF0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKC1jZW50cC54LCAtY2VudHAueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnWic6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAneic6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdHggIT0gbnVsbCkgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcC5jdXJyZW50ID0gcHAuc3RhcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBiYjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRNYXJrZXJzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5QYXRoUGFyc2VyLmdldE1hcmtlclBvaW50cygpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGFuZ2xlcyA9IHRoaXMuUGF0aFBhcnNlci5nZXRNYXJrZXJBbmdsZXMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VycyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHBvaW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hcmtlcnMucHVzaChbcG9pbnRzW2ldLCBhbmdsZXNbaV1dKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBtYXJrZXJzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnBhdGgucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlBhdGhFbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgLy8gcGF0dGVybiBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQucGF0dGVybiA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlUGF0dGVybiA9IGZ1bmN0aW9uKGN0eCwgZWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gdGhpcy5hdHRyaWJ1dGUoJ3dpZHRoJykudG9QaXhlbHMoJ3gnLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSB0aGlzLmF0dHJpYnV0ZSgnaGVpZ2h0JykudG9QaXhlbHMoJ3knLCB0cnVlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgbWUgdXNpbmcgYSB0ZW1wb3Jhcnkgc3ZnIGVsZW1lbnRcclxuICAgICAgICAgICAgICAgIHZhciB0ZW1wU3ZnID0gbmV3IHN2Zy5FbGVtZW50LnN2ZygpO1xyXG4gICAgICAgICAgICAgICAgdGVtcFN2Zy5hdHRyaWJ1dGVzWyd2aWV3Qm94J10gPSBuZXcgc3ZnLlByb3BlcnR5KCd2aWV3Qm94JywgdGhpcy5hdHRyaWJ1dGUoJ3ZpZXdCb3gnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ3dpZHRoJ10gPSBuZXcgc3ZnLlByb3BlcnR5KCd3aWR0aCcsIHdpZHRoICsgJ3B4Jyk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ2hlaWdodCddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgnaGVpZ2h0JywgaGVpZ2h0ICsgJ3B4Jyk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ3RyYW5zZm9ybSddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgndHJhbnNmb3JtJywgdGhpcy5hdHRyaWJ1dGUoJ3BhdHRlcm5UcmFuc2Zvcm0nKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gICAgICAgICAgICAgICAgYy53aWR0aCA9IHdpZHRoO1xyXG4gICAgICAgICAgICAgICAgYy5oZWlnaHQgPSBoZWlnaHQ7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2N0eCA9IGMuZ2V0Q29udGV4dCgnMmQnKTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgneCcpLmhhc1ZhbHVlKCkgJiYgdGhpcy5hdHRyaWJ1dGUoJ3knKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2N0eC50cmFuc2xhdGUodGhpcy5hdHRyaWJ1dGUoJ3gnKS50b1BpeGVscygneCcsIHRydWUpLCB0aGlzLmF0dHJpYnV0ZSgneScpLnRvUGl4ZWxzKCd5JywgdHJ1ZSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIDN4MyBncmlkIHNvIHdoZW4gd2UgdHJhbnNmb3JtIHRoZXJlJ3Mgbm8gd2hpdGUgc3BhY2Ugb24gZWRnZXNcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIHg9LTE7IHg8PTE7IHgrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHk9LTE7IHk8PTE7IHkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjY3R4LnNhdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcFN2Zy5hdHRyaWJ1dGVzWyd4J10gPSBuZXcgc3ZnLlByb3BlcnR5KCd4JywgeCAqIGMud2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ3knXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3knLCB5ICogYy5oZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLnJlbmRlcihjY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2N0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHBhdHRlcm4gPSBjdHguY3JlYXRlUGF0dGVybihjLCAncmVwZWF0Jyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0dGVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5wYXR0ZXJuLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgLy8gbWFya2VyIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5tYXJrZXIgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmJhc2VSZW5kZXIgPSB0aGlzLnJlbmRlcjtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIgPSBmdW5jdGlvbihjdHgsIHBvaW50LCBhbmdsZSkge1xyXG4gICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZShwb2ludC54LCBwb2ludC55KTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgnb3JpZW50JykudmFsdWVPckRlZmF1bHQoJ2F1dG8nKSA9PSAnYXV0bycpIGN0eC5yb3RhdGUoYW5nbGUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdtYXJrZXJVbml0cycpLnZhbHVlT3JEZWZhdWx0KCdzdHJva2VXaWR0aCcpID09ICdzdHJva2VXaWR0aCcpIGN0eC5zY2FsZShjdHgubGluZVdpZHRoLCBjdHgubGluZVdpZHRoKTtcclxuICAgICAgICAgICAgICAgIGN0eC5zYXZlKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIG1lIHVzaW5nIGEgdGVtcG9yYXJ5IHN2ZyBlbGVtZW50XHJcbiAgICAgICAgICAgICAgICB2YXIgdGVtcFN2ZyA9IG5ldyBzdmcuRWxlbWVudC5zdmcoKTtcclxuICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1sndmlld0JveCddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgndmlld0JveCcsIHRoaXMuYXR0cmlidXRlKCd2aWV3Qm94JykudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgdGVtcFN2Zy5hdHRyaWJ1dGVzWydyZWZYJ10gPSBuZXcgc3ZnLlByb3BlcnR5KCdyZWZYJywgdGhpcy5hdHRyaWJ1dGUoJ3JlZlgnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ3JlZlknXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3JlZlknLCB0aGlzLmF0dHJpYnV0ZSgncmVmWScpLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1snd2lkdGgnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3dpZHRoJywgdGhpcy5hdHRyaWJ1dGUoJ21hcmtlcldpZHRoJykudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgdGVtcFN2Zy5hdHRyaWJ1dGVzWydoZWlnaHQnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ2hlaWdodCcsIHRoaXMuYXR0cmlidXRlKCdtYXJrZXJIZWlnaHQnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ2ZpbGwnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ2ZpbGwnLCB0aGlzLmF0dHJpYnV0ZSgnZmlsbCcpLnZhbHVlT3JEZWZhdWx0KCdibGFjaycpKTtcclxuICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1snc3Ryb2tlJ10gPSBuZXcgc3ZnLlByb3BlcnR5KCdzdHJva2UnLCB0aGlzLmF0dHJpYnV0ZSgnc3Ryb2tlJykudmFsdWVPckRlZmF1bHQoJ25vbmUnKSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wU3ZnLmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbjtcclxuICAgICAgICAgICAgICAgIHRlbXBTdmcucmVuZGVyKGN0eCk7XHJcblxyXG4gICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgnbWFya2VyVW5pdHMnKS52YWx1ZU9yRGVmYXVsdCgnc3Ryb2tlV2lkdGgnKSA9PSAnc3Ryb2tlV2lkdGgnKSBjdHguc2NhbGUoMS9jdHgubGluZVdpZHRoLCAxL2N0eC5saW5lV2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdvcmllbnQnKS52YWx1ZU9yRGVmYXVsdCgnYXV0bycpID09ICdhdXRvJykgY3R4LnJvdGF0ZSgtYW5nbGUpO1xyXG4gICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSgtcG9pbnQueCwgLXBvaW50LnkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50Lm1hcmtlci5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIGRlZmluaXRpb25zIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5kZWZzID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIC8vIE5PT1BcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5kZWZzLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgLy8gYmFzZSBmb3IgZ3JhZGllbnRzXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuR3JhZGllbnRCYXNlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5zdG9wcyA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcclxuICAgICAgICAgICAgICAgIGlmIChjaGlsZC50eXBlID09ICdzdG9wJykgdGhpcy5zdG9wcy5wdXNoKGNoaWxkKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRHcmFkaWVudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgLy8gT1ZFUlJJREUgTUUhXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ3JhZGllbnRVbml0cyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmF0dHJpYnV0ZSgnZ3JhZGllbnRVbml0cycpLnZhbHVlT3JEZWZhdWx0KCdvYmplY3RCb3VuZGluZ0JveCcpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNUb0luaGVyaXQgPSBbJ2dyYWRpZW50VW5pdHMnXTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuaW5oZXJpdFN0b3BDb250YWluZXIgPSBmdW5jdGlvbiAoc3RvcHNDb250YWluZXIpIHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLmF0dHJpYnV0ZXNUb0luaGVyaXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlVG9Jbmhlcml0ID0gdGhpcy5hdHRyaWJ1dGVzVG9Jbmhlcml0W2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5hdHRyaWJ1dGUoYXR0cmlidXRlVG9Jbmhlcml0KS5oYXNWYWx1ZSgpICYmIHN0b3BzQ29udGFpbmVyLmF0dHJpYnV0ZShhdHRyaWJ1dGVUb0luaGVyaXQpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGUoYXR0cmlidXRlVG9Jbmhlcml0LCB0cnVlKS52YWx1ZSA9IHN0b3BzQ29udGFpbmVyLmF0dHJpYnV0ZShhdHRyaWJ1dGVUb0luaGVyaXQpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5jcmVhdGVHcmFkaWVudCA9IGZ1bmN0aW9uKGN0eCwgZWxlbWVudCwgcGFyZW50T3BhY2l0eVByb3ApIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdG9wc0NvbnRhaW5lciA9IHRoaXM7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5nZXRIcmVmQXR0cmlidXRlKCkuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0b3BzQ29udGFpbmVyID0gdGhpcy5nZXRIcmVmQXR0cmlidXRlKCkuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5oZXJpdFN0b3BDb250YWluZXIoc3RvcHNDb250YWluZXIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHZhciBhZGRQYXJlbnRPcGFjaXR5ID0gZnVuY3Rpb24gKGNvbG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudE9wYWNpdHlQcm9wLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHAgPSBuZXcgc3ZnLlByb3BlcnR5KCdjb2xvcicsIGNvbG9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuYWRkT3BhY2l0eShwYXJlbnRPcGFjaXR5UHJvcCkudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb2xvcjtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGcgPSB0aGlzLmdldEdyYWRpZW50KGN0eCwgZWxlbWVudCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoZyA9PSBudWxsKSByZXR1cm4gYWRkUGFyZW50T3BhY2l0eShzdG9wc0NvbnRhaW5lci5zdG9wc1tzdG9wc0NvbnRhaW5lci5zdG9wcy5sZW5ndGggLSAxXS5jb2xvcik7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8c3RvcHNDb250YWluZXIuc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBnLmFkZENvbG9yU3RvcChzdG9wc0NvbnRhaW5lci5zdG9wc1tpXS5vZmZzZXQsIGFkZFBhcmVudE9wYWNpdHkoc3RvcHNDb250YWluZXIuc3RvcHNbaV0uY29sb3IpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ2dyYWRpZW50VHJhbnNmb3JtJykuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbmRlciBhcyB0cmFuc2Zvcm1lZCBwYXR0ZXJuIG9uIHRlbXBvcmFyeSBjYW52YXNcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcm9vdFZpZXcgPSBzdmcuVmlld1BvcnQudmlld1BvcnRzWzBdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVjdCA9IG5ldyBzdmcuRWxlbWVudC5yZWN0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVjdC5hdHRyaWJ1dGVzWyd4J10gPSBuZXcgc3ZnLlByb3BlcnR5KCd4JywgLXN2Zy5NQVhfVklSVFVBTF9QSVhFTFMvMy4wKTtcclxuICAgICAgICAgICAgICAgICAgICByZWN0LmF0dHJpYnV0ZXNbJ3knXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3knLCAtc3ZnLk1BWF9WSVJUVUFMX1BJWEVMUy8zLjApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlY3QuYXR0cmlidXRlc1snd2lkdGgnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3dpZHRoJywgc3ZnLk1BWF9WSVJUVUFMX1BJWEVMUyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVjdC5hdHRyaWJ1dGVzWydoZWlnaHQnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ2hlaWdodCcsIHN2Zy5NQVhfVklSVFVBTF9QSVhFTFMpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgZ3JvdXAgPSBuZXcgc3ZnLkVsZW1lbnQuZygpO1xyXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwLmF0dHJpYnV0ZXNbJ3RyYW5zZm9ybSddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgndHJhbnNmb3JtJywgdGhpcy5hdHRyaWJ1dGUoJ2dyYWRpZW50VHJhbnNmb3JtJykudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuID0gWyByZWN0IF07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wU3ZnID0gbmV3IHN2Zy5FbGVtZW50LnN2ZygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1sneCddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgneCcsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1sneSddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgneScsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1snd2lkdGgnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ3dpZHRoJywgcm9vdFZpZXcud2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1snaGVpZ2h0J10gPSBuZXcgc3ZnLlByb3BlcnR5KCdoZWlnaHQnLCByb290Vmlldy5oZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuY2hpbGRyZW4gPSBbIGdyb3VwIF07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgYy53aWR0aCA9IHJvb3RWaWV3LndpZHRoO1xyXG4gICAgICAgICAgICAgICAgICAgIGMuaGVpZ2h0ID0gcm9vdFZpZXcuaGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wQ3R4ID0gYy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBDdHguZmlsbFN0eWxlID0gZztcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLnJlbmRlcih0ZW1wQ3R4KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGVtcEN0eC5jcmVhdGVQYXR0ZXJuKGMsICduby1yZXBlYXQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5HcmFkaWVudEJhc2UucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBsaW5lYXIgZ3JhZGllbnQgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmxpbmVhckdyYWRpZW50ID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5HcmFkaWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc1RvSW5oZXJpdC5wdXNoKCd4MScpO1xyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNUb0luaGVyaXQucHVzaCgneTEnKTtcclxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzVG9Jbmhlcml0LnB1c2goJ3gyJyk7XHJcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc1RvSW5oZXJpdC5wdXNoKCd5MicpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRHcmFkaWVudCA9IGZ1bmN0aW9uKGN0eCwgZWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGJiID0gdGhpcy5ncmFkaWVudFVuaXRzKCkgPT0gJ29iamVjdEJvdW5kaW5nQm94JyA/IGVsZW1lbnQuZ2V0Qm91bmRpbmdCb3goKSA6IG51bGw7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSgneDEnKS5oYXNWYWx1ZSgpXHJcbiAgICAgICAgICAgICAgICAgJiYgIXRoaXMuYXR0cmlidXRlKCd5MScpLmhhc1ZhbHVlKClcclxuICAgICAgICAgICAgICAgICAmJiAhdGhpcy5hdHRyaWJ1dGUoJ3gyJykuaGFzVmFsdWUoKVxyXG4gICAgICAgICAgICAgICAgICYmICF0aGlzLmF0dHJpYnV0ZSgneTInKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGUoJ3gxJywgdHJ1ZSkudmFsdWUgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlKCd5MScsIHRydWUpLnZhbHVlID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZSgneDInLCB0cnVlKS52YWx1ZSA9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGUoJ3kyJywgdHJ1ZSkudmFsdWUgPSAwO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgeDEgPSAodGhpcy5ncmFkaWVudFVuaXRzKCkgPT0gJ29iamVjdEJvdW5kaW5nQm94J1xyXG4gICAgICAgICAgICAgICAgICAgID8gYmIueCgpICsgYmIud2lkdGgoKSAqIHRoaXMuYXR0cmlidXRlKCd4MScpLm51bVZhbHVlKClcclxuICAgICAgICAgICAgICAgICAgICA6IHRoaXMuYXR0cmlidXRlKCd4MScpLnRvUGl4ZWxzKCd4JykpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHkxID0gKHRoaXMuZ3JhZGllbnRVbml0cygpID09ICdvYmplY3RCb3VuZGluZ0JveCdcclxuICAgICAgICAgICAgICAgICAgICA/IGJiLnkoKSArIGJiLmhlaWdodCgpICogdGhpcy5hdHRyaWJ1dGUoJ3kxJykubnVtVmFsdWUoKVxyXG4gICAgICAgICAgICAgICAgICAgIDogdGhpcy5hdHRyaWJ1dGUoJ3kxJykudG9QaXhlbHMoJ3knKSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgeDIgPSAodGhpcy5ncmFkaWVudFVuaXRzKCkgPT0gJ29iamVjdEJvdW5kaW5nQm94J1xyXG4gICAgICAgICAgICAgICAgICAgID8gYmIueCgpICsgYmIud2lkdGgoKSAqIHRoaXMuYXR0cmlidXRlKCd4MicpLm51bVZhbHVlKClcclxuICAgICAgICAgICAgICAgICAgICA6IHRoaXMuYXR0cmlidXRlKCd4MicpLnRvUGl4ZWxzKCd4JykpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHkyID0gKHRoaXMuZ3JhZGllbnRVbml0cygpID09ICdvYmplY3RCb3VuZGluZ0JveCdcclxuICAgICAgICAgICAgICAgICAgICA/IGJiLnkoKSArIGJiLmhlaWdodCgpICogdGhpcy5hdHRyaWJ1dGUoJ3kyJykubnVtVmFsdWUoKVxyXG4gICAgICAgICAgICAgICAgICAgIDogdGhpcy5hdHRyaWJ1dGUoJ3kyJykudG9QaXhlbHMoJ3knKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHgxID09IHgyICYmIHkxID09IHkyKSByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjdHguY3JlYXRlTGluZWFyR3JhZGllbnQoeDEsIHkxLCB4MiwgeTIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmxpbmVhckdyYWRpZW50LnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5HcmFkaWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHJhZGlhbCBncmFkaWVudCBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQucmFkaWFsR3JhZGllbnQgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkdyYWRpZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzVG9Jbmhlcml0LnB1c2goJ2N4Jyk7XHJcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc1RvSW5oZXJpdC5wdXNoKCdjeScpO1xyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNUb0luaGVyaXQucHVzaCgncicpO1xyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNUb0luaGVyaXQucHVzaCgnZngnKTtcclxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzVG9Jbmhlcml0LnB1c2goJ2Z5Jyk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldEdyYWRpZW50ID0gZnVuY3Rpb24oY3R4LCBlbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYmIgPSBlbGVtZW50LmdldEJvdW5kaW5nQm94KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSgnY3gnKS5oYXNWYWx1ZSgpKSB0aGlzLmF0dHJpYnV0ZSgnY3gnLCB0cnVlKS52YWx1ZSA9ICc1MCUnO1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSgnY3knKS5oYXNWYWx1ZSgpKSB0aGlzLmF0dHJpYnV0ZSgnY3knLCB0cnVlKS52YWx1ZSA9ICc1MCUnO1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSgncicpLmhhc1ZhbHVlKCkpIHRoaXMuYXR0cmlidXRlKCdyJywgdHJ1ZSkudmFsdWUgPSAnNTAlJztcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgY3ggPSAodGhpcy5ncmFkaWVudFVuaXRzKCkgPT0gJ29iamVjdEJvdW5kaW5nQm94J1xyXG4gICAgICAgICAgICAgICAgICAgID8gYmIueCgpICsgYmIud2lkdGgoKSAqIHRoaXMuYXR0cmlidXRlKCdjeCcpLm51bVZhbHVlKClcclxuICAgICAgICAgICAgICAgICAgICA6IHRoaXMuYXR0cmlidXRlKCdjeCcpLnRvUGl4ZWxzKCd4JykpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGN5ID0gKHRoaXMuZ3JhZGllbnRVbml0cygpID09ICdvYmplY3RCb3VuZGluZ0JveCdcclxuICAgICAgICAgICAgICAgICAgICA/IGJiLnkoKSArIGJiLmhlaWdodCgpICogdGhpcy5hdHRyaWJ1dGUoJ2N5JykubnVtVmFsdWUoKVxyXG4gICAgICAgICAgICAgICAgICAgIDogdGhpcy5hdHRyaWJ1dGUoJ2N5JykudG9QaXhlbHMoJ3knKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGZ4ID0gY3g7XHJcbiAgICAgICAgICAgICAgICB2YXIgZnkgPSBjeTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgnZngnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnggPSAodGhpcy5ncmFkaWVudFVuaXRzKCkgPT0gJ29iamVjdEJvdW5kaW5nQm94J1xyXG4gICAgICAgICAgICAgICAgICAgID8gYmIueCgpICsgYmIud2lkdGgoKSAqIHRoaXMuYXR0cmlidXRlKCdmeCcpLm51bVZhbHVlKClcclxuICAgICAgICAgICAgICAgICAgICA6IHRoaXMuYXR0cmlidXRlKCdmeCcpLnRvUGl4ZWxzKCd4JykpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdmeScpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBmeSA9ICh0aGlzLmdyYWRpZW50VW5pdHMoKSA9PSAnb2JqZWN0Qm91bmRpbmdCb3gnXHJcbiAgICAgICAgICAgICAgICAgICAgPyBiYi55KCkgKyBiYi5oZWlnaHQoKSAqIHRoaXMuYXR0cmlidXRlKCdmeScpLm51bVZhbHVlKClcclxuICAgICAgICAgICAgICAgICAgICA6IHRoaXMuYXR0cmlidXRlKCdmeScpLnRvUGl4ZWxzKCd5JykpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHZhciByID0gKHRoaXMuZ3JhZGllbnRVbml0cygpID09ICdvYmplY3RCb3VuZGluZ0JveCdcclxuICAgICAgICAgICAgICAgICAgICA/IChiYi53aWR0aCgpICsgYmIuaGVpZ2h0KCkpIC8gMi4wICogdGhpcy5hdHRyaWJ1dGUoJ3InKS5udW1WYWx1ZSgpXHJcbiAgICAgICAgICAgICAgICAgICAgOiB0aGlzLmF0dHJpYnV0ZSgncicpLnRvUGl4ZWxzKCkpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBjdHguY3JlYXRlUmFkaWFsR3JhZGllbnQoZngsIGZ5LCAwLCBjeCwgY3ksIHIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnJhZGlhbEdyYWRpZW50LnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5HcmFkaWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIGdyYWRpZW50IHN0b3AgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnN0b3AgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLm9mZnNldCA9IHRoaXMuYXR0cmlidXRlKCdvZmZzZXQnKS5udW1WYWx1ZSgpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5vZmZzZXQgPCAwKSB0aGlzLm9mZnNldCA9IDA7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm9mZnNldCA+IDEpIHRoaXMub2Zmc2V0ID0gMTtcclxuXHJcbiAgICAgICAgICAgIHZhciBzdG9wQ29sb3IgPSB0aGlzLnN0eWxlKCdzdG9wLWNvbG9yJywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIGlmIChzdG9wQ29sb3IudmFsdWUgPT09ICcnKSBzdG9wQ29sb3IudmFsdWUgPSAnIzAwMCc7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKCdzdG9wLW9wYWNpdHknKS5oYXNWYWx1ZSgpKSBzdG9wQ29sb3IgPSBzdG9wQ29sb3IuYWRkT3BhY2l0eSh0aGlzLnN0eWxlKCdzdG9wLW9wYWNpdHknKSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29sb3IgPSBzdG9wQ29sb3IudmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnN0b3AucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBhbmltYXRpb24gYmFzZSBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuQW5pbWF0ZUJhc2UgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICBzdmcuQW5pbWF0aW9ucy5wdXNoKHRoaXMpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IDAuMDtcclxuICAgICAgICAgICAgdGhpcy5iZWdpbiA9IHRoaXMuYXR0cmlidXRlKCdiZWdpbicpLnRvTWlsbGlzZWNvbmRzKCk7XHJcbiAgICAgICAgICAgIHRoaXMubWF4RHVyYXRpb24gPSB0aGlzLmJlZ2luICsgdGhpcy5hdHRyaWJ1dGUoJ2R1cicpLnRvTWlsbGlzZWNvbmRzKCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldFByb3BlcnR5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlVHlwZSA9IHRoaXMuYXR0cmlidXRlKCdhdHRyaWJ1dGVUeXBlJykudmFsdWU7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlTmFtZSA9IHRoaXMuYXR0cmlidXRlKCdhdHRyaWJ1dGVOYW1lJykudmFsdWU7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZVR5cGUgPT0gJ0NTUycpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQuc3R5bGUoYXR0cmlidXRlTmFtZSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQuYXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHRydWUpO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5pbml0aWFsVmFsdWUgPSBudWxsO1xyXG4gICAgICAgICAgICB0aGlzLmluaXRpYWxVbml0cyA9ICcnO1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2FsY1ZhbHVlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBPVkVSUklERSBNRSFcclxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbihkZWx0YSkge1xyXG4gICAgICAgICAgICAgICAgLy8gc2V0IGluaXRpYWwgdmFsdWVcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmluaXRpYWxWYWx1ZSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsVmFsdWUgPSB0aGlzLmdldFByb3BlcnR5KCkudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsVW5pdHMgPSB0aGlzLmdldFByb3BlcnR5KCkuZ2V0VW5pdHMoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBpZiB3ZSdyZSBwYXN0IHRoZSBlbmQgdGltZVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZHVyYXRpb24gPiB0aGlzLm1heER1cmF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9vcCBmb3IgaW5kZWZpbml0ZWx5IHJlcGVhdGluZyBhbmltYXRpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlKCdyZXBlYXRDb3VudCcpLnZhbHVlID09ICdpbmRlZmluaXRlJ1xyXG4gICAgICAgICAgICAgICAgICAgICB8fCB0aGlzLmF0dHJpYnV0ZSgncmVwZWF0RHVyJykudmFsdWUgPT0gJ2luZGVmaW5pdGUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSAwLjBcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5hdHRyaWJ1dGUoJ2ZpbGwnKS52YWx1ZU9yRGVmYXVsdCgncmVtb3ZlJykgPT0gJ2ZyZWV6ZScgJiYgIXRoaXMuZnJvemVuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnJvemVuID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQuYW5pbWF0aW9uRnJvemVuID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQuYW5pbWF0aW9uRnJvemVuVmFsdWUgPSB0aGlzLmdldFByb3BlcnR5KCkudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuYXR0cmlidXRlKCdmaWxsJykudmFsdWVPckRlZmF1bHQoJ3JlbW92ZScpID09ICdyZW1vdmUnICYmICF0aGlzLnJlbW92ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRQcm9wZXJ0eSgpLnZhbHVlID0gdGhpcy5wYXJlbnQuYW5pbWF0aW9uRnJvemVuID8gdGhpcy5wYXJlbnQuYW5pbWF0aW9uRnJvemVuVmFsdWUgOiB0aGlzLmluaXRpYWxWYWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSB0aGlzLmR1cmF0aW9uICsgZGVsdGE7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gaWYgd2UncmUgcGFzdCB0aGUgYmVnaW4gdGltZVxyXG4gICAgICAgICAgICAgICAgdmFyIHVwZGF0ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJlZ2luIDwgdGhpcy5kdXJhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMuY2FsY1ZhbHVlKCk7IC8vIHR3ZWVuXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgndHlwZScpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHRyYW5zZm9ybSwgZXRjLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IHRoaXMuYXR0cmlidXRlKCd0eXBlJykudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gdHlwZSArICcoJyArIG5ld1ZhbHVlICsgJyknO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRQcm9wZXJ0eSgpLnZhbHVlID0gbmV3VmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHVwZGF0ZWQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZnJvbSA9IHRoaXMuYXR0cmlidXRlKCdmcm9tJyk7XHJcbiAgICAgICAgICAgIHRoaXMudG8gPSB0aGlzLmF0dHJpYnV0ZSgndG8nKTtcclxuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSB0aGlzLmF0dHJpYnV0ZSgndmFsdWVzJyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnZhbHVlcy5oYXNWYWx1ZSgpKSB0aGlzLnZhbHVlcy52YWx1ZSA9IHRoaXMudmFsdWVzLnZhbHVlLnNwbGl0KCc7Jyk7XHJcblxyXG4gICAgICAgICAgICAvLyBmcmFjdGlvbiBvZiBkdXJhdGlvbiB3ZSd2ZSBjb3ZlcmVkXHJcbiAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHZhciByZXQgPSB7IHByb2dyZXNzOiAodGhpcy5kdXJhdGlvbiAtIHRoaXMuYmVnaW4pIC8gKHRoaXMubWF4RHVyYXRpb24gLSB0aGlzLmJlZ2luKSB9O1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudmFsdWVzLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcCA9IHJldC5wcm9ncmVzcyAqICh0aGlzLnZhbHVlcy52YWx1ZS5sZW5ndGggLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGIgPSBNYXRoLmZsb29yKHApLCB1YiA9IE1hdGguY2VpbChwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXQuZnJvbSA9IG5ldyBzdmcuUHJvcGVydHkoJ2Zyb20nLCBwYXJzZUZsb2F0KHRoaXMudmFsdWVzLnZhbHVlW2xiXSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldC50byA9IG5ldyBzdmcuUHJvcGVydHkoJ3RvJywgcGFyc2VGbG9hdCh0aGlzLnZhbHVlcy52YWx1ZVt1Yl0pKTtcclxuICAgICAgICAgICAgICAgICAgICByZXQucHJvZ3Jlc3MgPSAocCAtIGxiKSAvICh1YiAtIGxiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldC5mcm9tID0gdGhpcy5mcm9tO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldC50byA9IHRoaXMudG87XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LkFuaW1hdGVCYXNlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgLy8gYW5pbWF0ZSBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuYW5pbWF0ZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuQW5pbWF0ZUJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2FsY1ZhbHVlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcCA9IHRoaXMucHJvZ3Jlc3MoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyB0d2VlbiB2YWx1ZSBsaW5lYXJseVxyXG4gICAgICAgICAgICAgICAgdmFyIG5ld1ZhbHVlID0gcC5mcm9tLm51bVZhbHVlKCkgKyAocC50by5udW1WYWx1ZSgpIC0gcC5mcm9tLm51bVZhbHVlKCkpICogcC5wcm9ncmVzcztcclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXdWYWx1ZSArIHRoaXMuaW5pdGlhbFVuaXRzO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5hbmltYXRlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5BbmltYXRlQmFzZTtcclxuXHJcbiAgICAgICAgLy8gYW5pbWF0ZSBjb2xvciBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuYW5pbWF0ZUNvbG9yID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5BbmltYXRlQmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5jYWxjVmFsdWUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHZhciBwID0gdGhpcy5wcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGZyb20gPSBuZXcgUkdCQ29sb3IocC5mcm9tLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHZhciB0byA9IG5ldyBSR0JDb2xvcihwLnRvLnZhbHVlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoZnJvbS5vayAmJiB0by5vaykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHR3ZWVuIGNvbG9yIGxpbmVhcmx5XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHIgPSBmcm9tLnIgKyAodG8uciAtIGZyb20ucikgKiBwLnByb2dyZXNzO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBnID0gZnJvbS5nICsgKHRvLmcgLSBmcm9tLmcpICogcC5wcm9ncmVzcztcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYiA9IGZyb20uYiArICh0by5iIC0gZnJvbS5iKSAqIHAucHJvZ3Jlc3M7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdyZ2IoJytwYXJzZUludChyLDEwKSsnLCcrcGFyc2VJbnQoZywxMCkrJywnK3BhcnNlSW50KGIsMTApKycpJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmF0dHJpYnV0ZSgnZnJvbScpLnZhbHVlO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5hbmltYXRlQ29sb3IucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkFuaW1hdGVCYXNlO1xyXG5cclxuICAgICAgICAvLyBhbmltYXRlIHRyYW5zZm9ybSBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuYW5pbWF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuQW5pbWF0ZUJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2FsY1ZhbHVlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcCA9IHRoaXMucHJvZ3Jlc3MoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyB0d2VlbiB2YWx1ZSBsaW5lYXJseVxyXG4gICAgICAgICAgICAgICAgdmFyIGZyb20gPSBzdmcuVG9OdW1iZXJBcnJheShwLmZyb20udmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHRvID0gc3ZnLlRvTnVtYmVyQXJyYXkocC50by52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmV3VmFsdWUgPSAnJztcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxmcm9tLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWUgKz0gZnJvbVtpXSArICh0b1tpXSAtIGZyb21baV0pICogcC5wcm9ncmVzcyArICcgJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXdWYWx1ZTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuYW5pbWF0ZVRyYW5zZm9ybS5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuYW5pbWF0ZTtcclxuXHJcbiAgICAgICAgLy8gZm9udCBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZm9udCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuaG9yaXpBZHZYID0gdGhpcy5hdHRyaWJ1dGUoJ2hvcml6LWFkdi14JykubnVtVmFsdWUoKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuaXNSVEwgPSBmYWxzZTtcclxuICAgICAgICAgICAgdGhpcy5pc0FyYWJpYyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB0aGlzLmZvbnRGYWNlID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5taXNzaW5nR2x5cGggPSBudWxsO1xyXG4gICAgICAgICAgICB0aGlzLmdseXBocyA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcclxuICAgICAgICAgICAgICAgIGlmIChjaGlsZC50eXBlID09ICdmb250LWZhY2UnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb250RmFjZSA9IGNoaWxkO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZC5zdHlsZSgnZm9udC1mYW1pbHknKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Zy5EZWZpbml0aW9uc1tjaGlsZC5zdHlsZSgnZm9udC1mYW1pbHknKS52YWx1ZV0gPSB0aGlzO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNoaWxkLnR5cGUgPT0gJ21pc3NpbmctZ2x5cGgnKSB0aGlzLm1pc3NpbmdHbHlwaCA9IGNoaWxkO1xyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2hpbGQudHlwZSA9PSAnZ2x5cGgnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLmFyYWJpY0Zvcm0gIT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pc1JUTCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaXNBcmFiaWMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZ2x5cGhzW2NoaWxkLnVuaWNvZGVdKSA9PSAndW5kZWZpbmVkJykgdGhpcy5nbHlwaHNbY2hpbGQudW5pY29kZV0gPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbHlwaHNbY2hpbGQudW5pY29kZV1bY2hpbGQuYXJhYmljRm9ybV0gPSBjaGlsZDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2x5cGhzW2NoaWxkLnVuaWNvZGVdID0gY2hpbGQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmZvbnQucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBmb250LWZhY2UgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmZvbnRmYWNlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5hc2NlbnQgPSB0aGlzLmF0dHJpYnV0ZSgnYXNjZW50JykudmFsdWU7XHJcbiAgICAgICAgICAgIHRoaXMuZGVzY2VudCA9IHRoaXMuYXR0cmlidXRlKCdkZXNjZW50JykudmFsdWU7XHJcbiAgICAgICAgICAgIHRoaXMudW5pdHNQZXJFbSA9IHRoaXMuYXR0cmlidXRlKCd1bml0cy1wZXItZW0nKS5udW1WYWx1ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5mb250ZmFjZS5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIG1pc3NpbmctZ2x5cGggZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50Lm1pc3NpbmdnbHlwaCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQucGF0aDtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5ob3JpekFkdlggPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5taXNzaW5nZ2x5cGgucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LnBhdGg7XHJcblxyXG4gICAgICAgIC8vIGdseXBoIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5nbHlwaCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQucGF0aDtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5ob3JpekFkdlggPSB0aGlzLmF0dHJpYnV0ZSgnaG9yaXotYWR2LXgnKS5udW1WYWx1ZSgpO1xyXG4gICAgICAgICAgICB0aGlzLnVuaWNvZGUgPSB0aGlzLmF0dHJpYnV0ZSgndW5pY29kZScpLnZhbHVlO1xyXG4gICAgICAgICAgICB0aGlzLmFyYWJpY0Zvcm0gPSB0aGlzLmF0dHJpYnV0ZSgnYXJhYmljLWZvcm0nKS52YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZ2x5cGgucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LnBhdGg7XHJcblxyXG4gICAgICAgIC8vIHRleHQgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnRleHQgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FwdHVyZVRleHROb2RlcyA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYmFzZVNldENvbnRleHQgPSB0aGlzLnNldENvbnRleHQ7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0Q29udGV4dCA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5iYXNlU2V0Q29udGV4dChjdHgpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciB0ZXh0QmFzZWxpbmUgPSB0aGlzLnN0eWxlKCdkb21pbmFudC1iYXNlbGluZScpLnRvVGV4dEJhc2VsaW5lKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGV4dEJhc2VsaW5lID09IG51bGwpIHRleHRCYXNlbGluZSA9IHRoaXMuc3R5bGUoJ2FsaWdubWVudC1iYXNlbGluZScpLnRvVGV4dEJhc2VsaW5lKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGV4dEJhc2VsaW5lICE9IG51bGwpIGN0eC50ZXh0QmFzZWxpbmUgPSB0ZXh0QmFzZWxpbmU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0Qm91bmRpbmdCb3ggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHRoaXMuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgIHZhciB5ID0gdGhpcy5hdHRyaWJ1dGUoJ3knKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGZvbnRTaXplID0gdGhpcy5wYXJlbnQuc3R5bGUoJ2ZvbnQtc2l6ZScpLm51bVZhbHVlT3JEZWZhdWx0KHN2Zy5Gb250LlBhcnNlKHN2Zy5jdHguZm9udCkuZm9udFNpemUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBzdmcuQm91bmRpbmdCb3goeCwgeSAtIGZvbnRTaXplLCB4ICsgTWF0aC5mbG9vcihmb250U2l6ZSAqIDIuMCAvIDMuMCkgKiB0aGlzLmNoaWxkcmVuWzBdLmdldFRleHQoKS5sZW5ndGgsIHkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlckNoaWxkcmVuID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnggPSB0aGlzLmF0dHJpYnV0ZSgneCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB0aGlzLmF0dHJpYnV0ZSgneScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ2R4JykuaGFzVmFsdWUoKSkgdGhpcy54ICs9IHRoaXMuYXR0cmlidXRlKCdkeCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ2R5JykuaGFzVmFsdWUoKSkgdGhpcy55ICs9IHRoaXMuYXR0cmlidXRlKCdkeScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnggKz0gdGhpcy5nZXRBbmNob3JEZWx0YShjdHgsIHRoaXMsIDApO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNoaWxkKGN0eCwgdGhpcywgaSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0QW5jaG9yRGVsdGEgPSBmdW5jdGlvbiAoY3R4LCBwYXJlbnQsIHN0YXJ0SSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHRleHRBbmNob3IgPSB0aGlzLnN0eWxlKCd0ZXh0LWFuY2hvcicpLnZhbHVlT3JEZWZhdWx0KCdzdGFydCcpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRleHRBbmNob3IgIT0gJ3N0YXJ0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT1zdGFydEk7IGk8cGFyZW50LmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHBhcmVudC5jaGlsZHJlbltpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiBzdGFydEkgJiYgY2hpbGQuYXR0cmlidXRlKCd4JykuaGFzVmFsdWUoKSkgYnJlYWs7IC8vIG5ldyBncm91cFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aCArPSBjaGlsZC5tZWFzdXJlVGV4dFJlY3Vyc2l2ZShjdHgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gLTEgKiAodGV4dEFuY2hvciA9PSAnZW5kJyA/IHdpZHRoIDogd2lkdGggLyAyLjApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ2hpbGQgPSBmdW5jdGlvbihjdHgsIHBhcmVudCwgaSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gcGFyZW50LmNoaWxkcmVuW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkLmF0dHJpYnV0ZSgneCcpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZC54ID0gY2hpbGQuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKSArIHBhcmVudC5nZXRBbmNob3JEZWx0YShjdHgsIHBhcmVudCwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLmF0dHJpYnV0ZSgnZHgnKS5oYXNWYWx1ZSgpKSBjaGlsZC54ICs9IGNoaWxkLmF0dHJpYnV0ZSgnZHgnKS50b1BpeGVscygneCcpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLmF0dHJpYnV0ZSgnZHgnKS5oYXNWYWx1ZSgpKSBwYXJlbnQueCArPSBjaGlsZC5hdHRyaWJ1dGUoJ2R4JykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZC54ID0gcGFyZW50Lng7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQueCA9IGNoaWxkLnggKyBjaGlsZC5tZWFzdXJlVGV4dChjdHgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChjaGlsZC5hdHRyaWJ1dGUoJ3knKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQueSA9IGNoaWxkLmF0dHJpYnV0ZSgneScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLmF0dHJpYnV0ZSgnZHknKS5oYXNWYWx1ZSgpKSBjaGlsZC55ICs9IGNoaWxkLmF0dHJpYnV0ZSgnZHknKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLmF0dHJpYnV0ZSgnZHknKS5oYXNWYWx1ZSgpKSBwYXJlbnQueSArPSBjaGlsZC5hdHRyaWJ1dGUoJ2R5JykudG9QaXhlbHMoJ3knKTtcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZC55ID0gcGFyZW50Lnk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQueSA9IGNoaWxkLnk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2hpbGQucmVuZGVyKGN0eCk7XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPGNoaWxkLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LnJlbmRlckNoaWxkKGN0eCwgY2hpbGQsIGkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnRleHQucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHRleHQgYmFzZVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LlRleHRFbGVtZW50QmFzZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRHbHlwaCA9IGZ1bmN0aW9uKGZvbnQsIHRleHQsIGkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjID0gdGV4dFtpXTtcclxuICAgICAgICAgICAgICAgIHZhciBnbHlwaCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBpZiAoZm9udC5pc0FyYWJpYykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmFiaWNGb3JtID0gJ2lzb2xhdGVkJztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoKGk9PTAgfHwgdGV4dFtpLTFdPT0nICcpICYmIGk8dGV4dC5sZW5ndGgtMiAmJiB0ZXh0W2krMV0hPScgJykgYXJhYmljRm9ybSA9ICd0ZXJtaW5hbCc7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGk+MCAmJiB0ZXh0W2ktMV0hPScgJyAmJiBpPHRleHQubGVuZ3RoLTIgJiYgdGV4dFtpKzFdIT0nICcpIGFyYWJpY0Zvcm0gPSAnbWVkaWFsJztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaT4wICYmIHRleHRbaS0xXSE9JyAnICYmIChpID09IHRleHQubGVuZ3RoLTEgfHwgdGV4dFtpKzFdPT0nICcpKSBhcmFiaWNGb3JtID0gJ2luaXRpYWwnO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZm9udC5nbHlwaHNbY10pICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdseXBoID0gZm9udC5nbHlwaHNbY11bYXJhYmljRm9ybV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnbHlwaCA9PSBudWxsICYmIGZvbnQuZ2x5cGhzW2NdLnR5cGUgPT0gJ2dseXBoJykgZ2x5cGggPSBmb250LmdseXBoc1tjXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBnbHlwaCA9IGZvbnQuZ2x5cGhzW2NdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGdseXBoID09IG51bGwpIGdseXBoID0gZm9udC5taXNzaW5nR2x5cGg7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2x5cGg7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ2hpbGRyZW4gPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjdXN0b21Gb250ID0gdGhpcy5wYXJlbnQuc3R5bGUoJ2ZvbnQtZmFtaWx5JykuZ2V0RGVmaW5pdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGN1c3RvbUZvbnQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBmb250U2l6ZSA9IHRoaXMucGFyZW50LnN0eWxlKCdmb250LXNpemUnKS5udW1WYWx1ZU9yRGVmYXVsdChzdmcuRm9udC5QYXJzZShzdmcuY3R4LmZvbnQpLmZvbnRTaXplKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZm9udFN0eWxlID0gdGhpcy5wYXJlbnQuc3R5bGUoJ2ZvbnQtc3R5bGUnKS52YWx1ZU9yRGVmYXVsdChzdmcuRm9udC5QYXJzZShzdmcuY3R4LmZvbnQpLmZvbnRTdHlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRleHQgPSB0aGlzLmdldFRleHQoKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VzdG9tRm9udC5pc1JUTCkgdGV4dCA9IHRleHQuc3BsaXQoXCJcIikucmV2ZXJzZSgpLmpvaW4oXCJcIik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkeCA9IHN2Zy5Ub051bWJlckFycmF5KHRoaXMucGFyZW50LmF0dHJpYnV0ZSgnZHgnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRleHQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGdseXBoID0gdGhpcy5nZXRHbHlwaChjdXN0b21Gb250LCB0ZXh0LCBpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNjYWxlID0gZm9udFNpemUgLyBjdXN0b21Gb250LmZvbnRGYWNlLnVuaXRzUGVyRW07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodGhpcy54LCB0aGlzLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguc2NhbGUoc2NhbGUsIC1zY2FsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsdyA9IGN0eC5saW5lV2lkdGg7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5saW5lV2lkdGggPSBjdHgubGluZVdpZHRoICogY3VzdG9tRm9udC5mb250RmFjZS51bml0c1BlckVtIC8gZm9udFNpemU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmb250U3R5bGUgPT0gJ2l0YWxpYycpIGN0eC50cmFuc2Zvcm0oMSwgMCwgLjQsIDEsIDAsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnbHlwaC5yZW5kZXIoY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZvbnRTdHlsZSA9PSAnaXRhbGljJykgY3R4LnRyYW5zZm9ybSgxLCAwLCAtLjQsIDEsIDAsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgubGluZVdpZHRoID0gbHc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5zY2FsZSgxL3NjYWxlLCAtMS9zY2FsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUoLXRoaXMueCwgLXRoaXMueSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnggKz0gZm9udFNpemUgKiAoZ2x5cGguaG9yaXpBZHZYIHx8IGN1c3RvbUZvbnQuaG9yaXpBZHZYKSAvIGN1c3RvbUZvbnQuZm9udEZhY2UudW5pdHNQZXJFbTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZihkeFtpXSkgIT0gJ3VuZGVmaW5lZCcgJiYgIWlzTmFOKGR4W2ldKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54ICs9IGR4W2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4LmZpbGxTdHlsZSAhPSAnJykgY3R4LmZpbGxUZXh0KHN2Zy5jb21wcmVzc1NwYWNlcyh0aGlzLmdldFRleHQoKSksIHRoaXMueCwgdGhpcy55KTtcclxuICAgICAgICAgICAgICAgIGlmIChjdHguc3Ryb2tlU3R5bGUgIT0gJycpIGN0eC5zdHJva2VUZXh0KHN2Zy5jb21wcmVzc1NwYWNlcyh0aGlzLmdldFRleHQoKSksIHRoaXMueCwgdGhpcy55KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRUZXh0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBPVkVSUklERSBNRVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLm1lYXN1cmVUZXh0UmVjdXJzaXZlID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgd2lkdGggPSB0aGlzLm1lYXN1cmVUZXh0KGN0eCk7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoICs9IHRoaXMuY2hpbGRyZW5baV0ubWVhc3VyZVRleHRSZWN1cnNpdmUoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB3aWR0aDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5tZWFzdXJlVGV4dCA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGN1c3RvbUZvbnQgPSB0aGlzLnBhcmVudC5zdHlsZSgnZm9udC1mYW1pbHknKS5nZXREZWZpbml0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VzdG9tRm9udCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZvbnRTaXplID0gdGhpcy5wYXJlbnQuc3R5bGUoJ2ZvbnQtc2l6ZScpLm51bVZhbHVlT3JEZWZhdWx0KHN2Zy5Gb250LlBhcnNlKHN2Zy5jdHguZm9udCkuZm9udFNpemUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBtZWFzdXJlID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGV4dCA9IHRoaXMuZ2V0VGV4dCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXN0b21Gb250LmlzUlRMKSB0ZXh0ID0gdGV4dC5zcGxpdChcIlwiKS5yZXZlcnNlKCkuam9pbihcIlwiKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZHggPSBzdmcuVG9OdW1iZXJBcnJheSh0aGlzLnBhcmVudC5hdHRyaWJ1dGUoJ2R4JykudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0ZXh0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnbHlwaCA9IHRoaXMuZ2V0R2x5cGgoY3VzdG9tRm9udCwgdGV4dCwgaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lYXN1cmUgKz0gKGdseXBoLmhvcml6QWR2WCB8fCBjdXN0b21Gb250Lmhvcml6QWR2WCkgKiBmb250U2l6ZSAvIGN1c3RvbUZvbnQuZm9udEZhY2UudW5pdHNQZXJFbTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZihkeFtpXSkgIT0gJ3VuZGVmaW5lZCcgJiYgIWlzTmFOKGR4W2ldKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhc3VyZSArPSBkeFtpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVhc3VyZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgdGV4dFRvTWVhc3VyZSA9IHN2Zy5jb21wcmVzc1NwYWNlcyh0aGlzLmdldFRleHQoKSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWN0eC5tZWFzdXJlVGV4dCkgcmV0dXJuIHRleHRUb01lYXN1cmUubGVuZ3RoICogMTA7XHJcblxyXG4gICAgICAgICAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29udGV4dChjdHgpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gY3R4Lm1lYXN1cmVUZXh0KHRleHRUb01lYXN1cmUpLndpZHRoO1xyXG4gICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB3aWR0aDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5UZXh0RWxlbWVudEJhc2UucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHRzcGFuXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQudHNwYW4gPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FwdHVyZVRleHROb2RlcyA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LlRleHRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy50ZXh0ID0gc3ZnLmNvbXByZXNzU3BhY2VzKG5vZGUudmFsdWUgfHwgbm9kZS50ZXh0IHx8IG5vZGUudGV4dENvbnRlbnQgfHwgJycpO1xyXG4gICAgICAgICAgICB0aGlzLmdldFRleHQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgbm9kZSBoYXMgY2hpbGRyZW4sIHRoZW4gdGhleSBvd24gdGhlIHRleHRcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNoaWxkcmVuLmxlbmd0aCA+IDApIHsgcmV0dXJuICcnOyB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnRzcGFuLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5UZXh0RWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHRyZWZcclxuICAgICAgICBzdmcuRWxlbWVudC50cmVmID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5UZXh0RWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0VGV4dCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSB0aGlzLmdldEhyZWZBdHRyaWJ1dGUoKS5nZXREZWZpbml0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCAhPSBudWxsKSByZXR1cm4gZWxlbWVudC5jaGlsZHJlblswXS5nZXRUZXh0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQudHJlZi5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuVGV4dEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBhIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5hID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5UZXh0RWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuaGFzVGV4dCA9IG5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPiAwO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8bm9kZS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZE5vZGVzW2ldLm5vZGVUeXBlICE9IDMpIHRoaXMuaGFzVGV4dCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyB0aGlzIG1pZ2h0IGNvbnRhaW4gdGV4dFxyXG4gICAgICAgICAgICB0aGlzLnRleHQgPSB0aGlzLmhhc1RleHQgPyBub2RlLmNoaWxkTm9kZXNbMF0udmFsdWUgOiAnJztcclxuICAgICAgICAgICAgdGhpcy5nZXRUZXh0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmJhc2VSZW5kZXJDaGlsZHJlbiA9IHRoaXMucmVuZGVyQ2hpbGRyZW47XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ2hpbGRyZW4gPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhhc1RleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgYXMgdGV4dCBlbGVtZW50XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iYXNlUmVuZGVyQ2hpbGRyZW4oY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZm9udFNpemUgPSBuZXcgc3ZnLlByb3BlcnR5KCdmb250U2l6ZScsIHN2Zy5Gb250LlBhcnNlKHN2Zy5jdHguZm9udCkuZm9udFNpemUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Zy5Nb3VzZS5jaGVja0JvdW5kaW5nQm94KHRoaXMsIG5ldyBzdmcuQm91bmRpbmdCb3godGhpcy54LCB0aGlzLnkgLSBmb250U2l6ZS50b1BpeGVscygneScpLCB0aGlzLnggKyB0aGlzLm1lYXN1cmVUZXh0KGN0eCksIHRoaXMueSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVuZGVyIGFzIHRlbXBvcmFyeSBncm91cFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBnID0gbmV3IHN2Zy5FbGVtZW50LmcoKTtcclxuICAgICAgICAgICAgICAgICAgICBnLmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbjtcclxuICAgICAgICAgICAgICAgICAgICBnLnBhcmVudCA9IHRoaXM7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5yZW5kZXIoY3R4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5vbmNsaWNrID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cub3Blbih0aGlzLmdldEhyZWZBdHRyaWJ1dGUoKS52YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMub25tb3VzZW1vdmUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHN2Zy5jdHguY2FudmFzLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5hLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5UZXh0RWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIGltYWdlIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5pbWFnZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdmFyIGhyZWYgPSB0aGlzLmdldEhyZWZBdHRyaWJ1dGUoKS52YWx1ZTtcclxuICAgICAgICAgICAgaWYgKGhyZWYgPT0gJycpIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgICAgIHZhciBpc1N2ZyA9IGhyZWYubWF0Y2goL1xcLnN2ZyQvKVxyXG5cclxuICAgICAgICAgICAgc3ZnLkltYWdlcy5wdXNoKHRoaXMpO1xyXG4gICAgICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBpZiAoIWlzU3ZnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHN2Zy5vcHRzWyd1c2VDT1JTJ10gPT0gdHJ1ZSkgeyB0aGlzLmltZy5jcm9zc09yaWdpbiA9ICdBbm9ueW1vdXMnOyB9XHJcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHsgc2VsZi5sb2FkZWQgPSB0cnVlOyB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmltZy5vbmVycm9yID0gZnVuY3Rpb24oKSB7IHN2Zy5sb2coJ0VSUk9SOiBpbWFnZSBcIicgKyBocmVmICsgJ1wiIG5vdCBmb3VuZCcpOyBzZWxmLmxvYWRlZCA9IHRydWU7IH1cclxuICAgICAgICAgICAgICAgIHRoaXMuaW1nLnNyYyA9IGhyZWY7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmltZyA9IHN2Zy5hamF4KGhyZWYpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlckNoaWxkcmVuID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHRoaXMuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKTtcclxuICAgICAgICAgICAgICAgIHZhciB5ID0gdGhpcy5hdHRyaWJ1dGUoJ3knKS50b1BpeGVscygneScpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IHRoaXMuYXR0cmlidXRlKCd3aWR0aCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gdGhpcy5hdHRyaWJ1dGUoJ2hlaWdodCcpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICBpZiAod2lkdGggPT0gMCB8fCBoZWlnaHQgPT0gMCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNTdmcpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguZHJhd1N2Zyh0aGlzLmltZywgeCwgeSwgd2lkdGgsIGhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKHgsIHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Zy5Bc3BlY3RSYXRpbyhjdHgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlKCdwcmVzZXJ2ZUFzcGVjdFJhdGlvJykudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmltZy53aWR0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmltZy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5pbWcsIDAsIDApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRCb3VuZGluZ0JveCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHggPSB0aGlzLmF0dHJpYnV0ZSgneCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgeSA9IHRoaXMuYXR0cmlidXRlKCd5JykudG9QaXhlbHMoJ3knKTtcclxuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IHRoaXMuYXR0cmlidXRlKCd3aWR0aCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gdGhpcy5hdHRyaWJ1dGUoJ2hlaWdodCcpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHN2Zy5Cb3VuZGluZ0JveCh4LCB5LCB4ICsgd2lkdGgsIHkgKyBoZWlnaHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmltYWdlLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5SZW5kZXJlZEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBncm91cCBlbGVtZW50XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRCb3VuZGluZ0JveCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGJiID0gbmV3IHN2Zy5Cb3VuZGluZ0JveCgpO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBiYi5hZGRCb3VuZGluZ0JveCh0aGlzLmNoaWxkcmVuW2ldLmdldEJvdW5kaW5nQm94KCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJiO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5nLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5SZW5kZXJlZEVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBzeW1ib2wgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnN5bWJvbCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIC8vIE5PIFJFTkRFUlxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5zeW1ib2wucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHN0eWxlIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5zdHlsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIC8vIHRleHQsIG9yIHNwYWNlcyB0aGVuIENEQVRBXHJcbiAgICAgICAgICAgIHZhciBjc3MgPSAnJ1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8bm9kZS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgY3NzICs9IG5vZGUuY2hpbGROb2Rlc1tpXS5kYXRhO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNzcyA9IGNzcy5yZXBsYWNlKC8oXFwvXFwqKFteKl18W1xcclxcbl18KFxcKisoW14qXFwvXXxbXFxyXFxuXSkpKSpcXCorXFwvKXwoXltcXHNdKlxcL1xcLy4qKS9nbSwgJycpOyAvLyByZW1vdmUgY29tbWVudHNcclxuICAgICAgICAgICAgY3NzID0gc3ZnLmNvbXByZXNzU3BhY2VzKGNzcyk7IC8vIHJlcGxhY2Ugd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICB2YXIgY3NzRGVmcyA9IGNzcy5zcGxpdCgnfScpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8Y3NzRGVmcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN2Zy50cmltKGNzc0RlZnNbaV0pICE9ICcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzc0RlZiA9IGNzc0RlZnNbaV0uc3BsaXQoJ3snKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY3NzQ2xhc3NlcyA9IGNzc0RlZlswXS5zcGxpdCgnLCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjc3NQcm9wcyA9IGNzc0RlZlsxXS5zcGxpdCgnOycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGo9MDsgajxjc3NDbGFzc2VzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjc3NDbGFzcyA9IHN2Zy50cmltKGNzc0NsYXNzZXNbal0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3NzQ2xhc3MgIT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9wcyA9IHN2Zy5TdHlsZXNbY3NzQ2xhc3NdIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaz0wOyBrPGNzc1Byb3BzLmxlbmd0aDsgaysrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHByb3AgPSBjc3NQcm9wc1trXS5pbmRleE9mKCc6Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBjc3NQcm9wc1trXS5zdWJzdHIoMCwgcHJvcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gY3NzUHJvcHNba10uc3Vic3RyKHByb3AgKyAxLCBjc3NQcm9wc1trXS5sZW5ndGggLSBwcm9wKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmFtZSAhPSBudWxsICYmIHZhbHVlICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHNbc3ZnLnRyaW0obmFtZSldID0gbmV3IHN2Zy5Qcm9wZXJ0eShzdmcudHJpbShuYW1lKSwgc3ZnLnRyaW0odmFsdWUpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdmcuU3R5bGVzW2Nzc0NsYXNzXSA9IHByb3BzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ZnLlN0eWxlc1NwZWNpZmljaXR5W2Nzc0NsYXNzXSA9IGdldFNlbGVjdG9yU3BlY2lmaWNpdHkoY3NzQ2xhc3MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNzc0NsYXNzID09ICdAZm9udC1mYWNlJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmb250RmFtaWx5ID0gcHJvcHNbJ2ZvbnQtZmFtaWx5J10udmFsdWUucmVwbGFjZSgvXCIvZywnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNyY3MgPSBwcm9wc1snc3JjJ10udmFsdWUuc3BsaXQoJywnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBzPTA7IHM8c3Jjcy5sZW5ndGg7IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3Jjc1tzXS5pbmRleE9mKCdmb3JtYXQoXCJzdmdcIiknKSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1cmxTdGFydCA9IHNyY3Nbc10uaW5kZXhPZigndXJsJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXJsRW5kID0gc3Jjc1tzXS5pbmRleE9mKCcpJywgdXJsU3RhcnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHVybCA9IHNyY3Nbc10uc3Vic3RyKHVybFN0YXJ0ICsgNSwgdXJsRW5kIC0gdXJsU3RhcnQgLSA2KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkb2MgPSBzdmcucGFyc2VYbWwoc3ZnLmFqYXgodXJsKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZm9udHMgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2ZvbnQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGY9MDsgZjxmb250cy5sZW5ndGg7IGYrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmb250ID0gc3ZnLkNyZWF0ZUVsZW1lbnQoZm9udHNbZl0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN2Zy5EZWZpbml0aW9uc1tmb250RmFtaWx5XSA9IGZvbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuc3R5bGUucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyB1c2UgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50LnVzZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuUmVuZGVyZWRFbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5iYXNlU2V0Q29udGV4dCA9IHRoaXMuc2V0Q29udGV4dDtcclxuICAgICAgICAgICAgdGhpcy5zZXRDb250ZXh0ID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VTZXRDb250ZXh0KGN0eCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3gnKS5oYXNWYWx1ZSgpKSBjdHgudHJhbnNsYXRlKHRoaXMuYXR0cmlidXRlKCd4JykudG9QaXhlbHMoJ3gnKSwgMCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3knKS5oYXNWYWx1ZSgpKSBjdHgudHJhbnNsYXRlKDAsIHRoaXMuYXR0cmlidXRlKCd5JykudG9QaXhlbHMoJ3knKSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gdGhpcy5nZXRIcmVmQXR0cmlidXRlKCkuZ2V0RGVmaW5pdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gZnVuY3Rpb24oY3R4KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCAhPSBudWxsKSBlbGVtZW50LnBhdGgoY3R4KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRCb3VuZGluZ0JveCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQgIT0gbnVsbCkgcmV0dXJuIGVsZW1lbnQuZ2V0Qm91bmRpbmdCb3goKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJDaGlsZHJlbiA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wU3ZnID0gZWxlbWVudDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC50eXBlID09ICdzeW1ib2wnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbmRlciBtZSB1c2luZyBhIHRlbXBvcmFyeSBzdmcgZWxlbWVudCBpbiBzeW1ib2wgY2FzZXMgKGh0dHA6Ly93d3cudzMub3JnL1RSL1NWRy9zdHJ1Y3QuaHRtbCNVc2VFbGVtZW50KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnID0gbmV3IHN2Zy5FbGVtZW50LnN2ZygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLnR5cGUgPSAnc3ZnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcFN2Zy5hdHRyaWJ1dGVzWyd2aWV3Qm94J10gPSBuZXcgc3ZnLlByb3BlcnR5KCd2aWV3Qm94JywgZWxlbWVudC5hdHRyaWJ1dGUoJ3ZpZXdCb3gnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBTdmcuYXR0cmlidXRlc1sncHJlc2VydmVBc3BlY3RSYXRpbyddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgncHJlc2VydmVBc3BlY3RSYXRpbycsIGVsZW1lbnQuYXR0cmlidXRlKCdwcmVzZXJ2ZUFzcGVjdFJhdGlvJykudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLmF0dHJpYnV0ZXNbJ292ZXJmbG93J10gPSBuZXcgc3ZnLlByb3BlcnR5KCdvdmVyZmxvdycsIGVsZW1lbnQuYXR0cmlidXRlKCdvdmVyZmxvdycpLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcFN2Zy5jaGlsZHJlbiA9IGVsZW1lbnQuY2hpbGRyZW47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wU3ZnLnR5cGUgPT0gJ3N2ZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgc3ltYm9sIG9yIHN2ZywgaW5oZXJpdCB3aWR0aC9oZWlnaHQgZnJvbSBtZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGUoJ3dpZHRoJykuaGFzVmFsdWUoKSkgdGVtcFN2Zy5hdHRyaWJ1dGVzWyd3aWR0aCddID0gbmV3IHN2Zy5Qcm9wZXJ0eSgnd2lkdGgnLCB0aGlzLmF0dHJpYnV0ZSgnd2lkdGgnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmF0dHJpYnV0ZSgnaGVpZ2h0JykuaGFzVmFsdWUoKSkgdGVtcFN2Zy5hdHRyaWJ1dGVzWydoZWlnaHQnXSA9IG5ldyBzdmcuUHJvcGVydHkoJ2hlaWdodCcsIHRoaXMuYXR0cmlidXRlKCdoZWlnaHQnKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBvbGRQYXJlbnQgPSB0ZW1wU3ZnLnBhcmVudDtcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLnBhcmVudCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgdGVtcFN2Zy5yZW5kZXIoY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wU3ZnLnBhcmVudCA9IG9sZFBhcmVudDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC51c2UucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LlJlbmRlcmVkRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIG1hc2sgZWxlbWVudFxyXG4gICAgICAgIHN2Zy5FbGVtZW50Lm1hc2sgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFwcGx5ID0gZnVuY3Rpb24oY3R4LCBlbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgYXMgdGVtcCBzdmdcclxuICAgICAgICAgICAgICAgIHZhciB4ID0gdGhpcy5hdHRyaWJ1dGUoJ3gnKS50b1BpeGVscygneCcpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHkgPSB0aGlzLmF0dHJpYnV0ZSgneScpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgd2lkdGggPSB0aGlzLmF0dHJpYnV0ZSgnd2lkdGgnKS50b1BpeGVscygneCcpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGhlaWdodCA9IHRoaXMuYXR0cmlidXRlKCdoZWlnaHQnKS50b1BpeGVscygneScpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh3aWR0aCA9PSAwICYmIGhlaWdodCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJiID0gbmV3IHN2Zy5Cb3VuZGluZ0JveCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJiLmFkZEJvdW5kaW5nQm94KHRoaXMuY2hpbGRyZW5baV0uZ2V0Qm91bmRpbmdCb3goKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciB4ID0gTWF0aC5mbG9vcihiYi54MSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHkgPSBNYXRoLmZsb29yKGJiLnkxKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgd2lkdGggPSBNYXRoLmZsb29yKGJiLndpZHRoKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhclx0aGVpZ2h0ID0gTWF0aC5mbG9vcihiYi5oZWlnaHQoKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gdGVtcG9yYXJpbHkgcmVtb3ZlIG1hc2sgdG8gYXZvaWQgcmVjdXJzaW9uXHJcbiAgICAgICAgICAgICAgICB2YXIgbWFzayA9IGVsZW1lbnQuYXR0cmlidXRlKCdtYXNrJykudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHJpYnV0ZSgnbWFzaycpLnZhbHVlID0gJyc7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjTWFzayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNNYXNrLndpZHRoID0geCArIHdpZHRoO1xyXG4gICAgICAgICAgICAgICAgICAgIGNNYXNrLmhlaWdodCA9IHkgKyBoZWlnaHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hc2tDdHggPSBjTWFzay5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyQ2hpbGRyZW4obWFza0N0eCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgYy53aWR0aCA9IHggKyB3aWR0aDtcclxuICAgICAgICAgICAgICAgICAgICBjLmhlaWdodCA9IHkgKyBoZWlnaHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXBDdHggPSBjLmdldENvbnRleHQoJzJkJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW5kZXIodGVtcEN0eCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGVtcEN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnZGVzdGluYXRpb24taW4nO1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBDdHguZmlsbFN0eWxlID0gbWFza0N0eC5jcmVhdGVQYXR0ZXJuKGNNYXNrLCAnbm8tcmVwZWF0Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGVtcEN0eC5maWxsUmVjdCgwLCAwLCB4ICsgd2lkdGgsIHkgKyBoZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gdGVtcEN0eC5jcmVhdGVQYXR0ZXJuKGMsICduby1yZXBlYXQnKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgeCArIHdpZHRoLCB5ICsgaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyByZWFzc2lnbiBtYXNrXHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHJpYnV0ZSgnbWFzaycpLnZhbHVlID0gbWFzaztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIC8vIE5PIFJFTkRFUlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50Lm1hc2sucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBjbGlwIGVsZW1lbnRcclxuICAgICAgICBzdmcuRWxlbWVudC5jbGlwUGF0aCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHkgPSBmdW5jdGlvbihjdHgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBvbGRCZWdpblBhdGggPSBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQucHJvdG90eXBlLmJlZ2luUGF0aDtcclxuICAgICAgICAgICAgICAgIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRC5wcm90b3R5cGUuYmVnaW5QYXRoID0gZnVuY3Rpb24gKCkgeyB9O1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBvbGRDbG9zZVBhdGggPSBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQucHJvdG90eXBlLmNsb3NlUGF0aDtcclxuICAgICAgICAgICAgICAgIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRC5wcm90b3R5cGUuY2xvc2VQYXRoID0gZnVuY3Rpb24gKCkgeyB9O1xyXG5cclxuICAgICAgICAgICAgICAgIG9sZEJlZ2luUGF0aC5jYWxsKGN0eCk7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZihjaGlsZC5wYXRoKSAhPSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLnN0eWxlKCd0cmFuc2Zvcm0nLCBmYWxzZSwgdHJ1ZSkuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtID0gbmV3IHN2Zy5UcmFuc2Zvcm0oY2hpbGQuc3R5bGUoJ3RyYW5zZm9ybScsIGZhbHNlLCB0cnVlKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm0uYXBwbHkoY3R4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5wYXRoKGN0eCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRC5wcm90b3R5cGUuY2xvc2VQYXRoID0gb2xkQ2xvc2VQYXRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJhbnNmb3JtKSB7IHRyYW5zZm9ybS51bmFwcGx5KGN0eCk7IH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBvbGRDbG9zZVBhdGguY2FsbChjdHgpO1xyXG4gICAgICAgICAgICAgICAgY3R4LmNsaXAoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQucHJvdG90eXBlLmJlZ2luUGF0aCA9IG9sZEJlZ2luUGF0aDtcclxuICAgICAgICAgICAgICAgIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRC5wcm90b3R5cGUuY2xvc2VQYXRoID0gb2xkQ2xvc2VQYXRoO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlciA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgLy8gTk8gUkVOREVSXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuY2xpcFBhdGgucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBmaWx0ZXJzXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZmlsdGVyID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5hcHBseSA9IGZ1bmN0aW9uKGN0eCwgZWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIGFzIHRlbXAgc3ZnXHJcbiAgICAgICAgICAgICAgICB2YXIgYmIgPSBlbGVtZW50LmdldEJvdW5kaW5nQm94KCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IE1hdGguZmxvb3IoYmIueDEpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHkgPSBNYXRoLmZsb29yKGJiLnkxKTtcclxuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IE1hdGguZmxvb3IoYmIud2lkdGgoKSk7XHJcbiAgICAgICAgICAgICAgICB2YXJcdGhlaWdodCA9IE1hdGguZmxvb3IoYmIuaGVpZ2h0KCkpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIHRlbXBvcmFyaWx5IHJlbW92ZSBmaWx0ZXIgdG8gYXZvaWQgcmVjdXJzaW9uXHJcbiAgICAgICAgICAgICAgICB2YXIgZmlsdGVyID0gZWxlbWVudC5zdHlsZSgnZmlsdGVyJykudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlKCdmaWx0ZXInKS52YWx1ZSA9ICcnO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBweCA9IDAsIHB5ID0gMDtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVmZCA9IHRoaXMuY2hpbGRyZW5baV0uZXh0cmFGaWx0ZXJEaXN0YW5jZSB8fCAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHB4ID0gTWF0aC5tYXgocHgsIGVmZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHkgPSBNYXRoLm1heChweSwgZWZkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gICAgICAgICAgICAgICAgYy53aWR0aCA9IHdpZHRoICsgMipweDtcclxuICAgICAgICAgICAgICAgIGMuaGVpZ2h0ID0gaGVpZ2h0ICsgMipweTtcclxuICAgICAgICAgICAgICAgIHZhciB0ZW1wQ3R4ID0gYy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgICAgICAgICAgICAgdGVtcEN0eC50cmFuc2xhdGUoLXggKyBweCwgLXkgKyBweSk7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LnJlbmRlcih0ZW1wQ3R4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBhcHBseSBmaWx0ZXJzXHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5jaGlsZHJlbltpXS5hcHBseSkgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltpXS5hcHBseSh0ZW1wQ3R4LCAwLCAwLCB3aWR0aCArIDIqcHgsIGhlaWdodCArIDIqcHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgb24gbWVcclxuICAgICAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UoYywgMCwgMCwgd2lkdGggKyAyKnB4LCBoZWlnaHQgKyAyKnB5LCB4IC0gcHgsIHkgLSBweSwgd2lkdGggKyAyKnB4LCBoZWlnaHQgKyAyKnB5KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyByZWFzc2lnbiBmaWx0ZXJcclxuICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUoJ2ZpbHRlcicsIHRydWUpLnZhbHVlID0gZmlsdGVyO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlciA9IGZ1bmN0aW9uKGN0eCkge1xyXG4gICAgICAgICAgICAgICAgLy8gTk8gUkVOREVSXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZmlsdGVyLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZmVNb3JwaG9sb2d5ID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgICAgICB0aGlzLmJhc2UgPSBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuICAgICAgICAgICAgdGhpcy5iYXNlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5hcHBseSA9IGZ1bmN0aW9uKGN0eCwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xyXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZmVNb3JwaG9sb2d5LnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuZmVDb21wb3NpdGUgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFwcGx5ID0gZnVuY3Rpb24oY3R4LCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnRcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5mZUNvbXBvc2l0ZS5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmZlQ29sb3JNYXRyaXggPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZSA9IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG4gICAgICAgICAgICB0aGlzLmJhc2Uobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgbWF0cml4ID0gc3ZnLlRvTnVtYmVyQXJyYXkodGhpcy5hdHRyaWJ1dGUoJ3ZhbHVlcycpLnZhbHVlKTtcclxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLmF0dHJpYnV0ZSgndHlwZScpLnZhbHVlT3JEZWZhdWx0KCdtYXRyaXgnKSkgeyAvLyBodHRwOi8vd3d3LnczLm9yZy9UUi9TVkcvZmlsdGVycy5odG1sI2ZlQ29sb3JNYXRyaXhFbGVtZW50XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzYXR1cmF0ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSBtYXRyaXhbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgbWF0cml4ID0gWzAuMjEzKzAuNzg3KnMsMC43MTUtMC43MTUqcywwLjA3Mi0wLjA3MipzLDAsMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC4yMTMtMC4yMTMqcywwLjcxNSswLjI4NSpzLDAuMDcyLTAuMDcyKnMsMCwwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLjIxMy0wLjIxMypzLDAuNzE1LTAuNzE1KnMsMC4wNzIrMC45MjgqcywwLDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwwLDEsMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLDAsMCwxXTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ2h1ZVJvdGF0ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSBtYXRyaXhbMF0gKiBNYXRoLlBJIC8gMTgwLjA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSBmdW5jdGlvbiAobTEsbTIsbTMpIHsgcmV0dXJuIG0xICsgTWF0aC5jb3MoYSkqbTIgKyBNYXRoLnNpbihhKSptMzsgfTtcclxuICAgICAgICAgICAgICAgICAgICBtYXRyaXggPSBbYygwLjIxMywwLjc4NywtMC4yMTMpLGMoMC43MTUsLTAuNzE1LC0wLjcxNSksYygwLjA3MiwtMC4wNzIsMC45MjgpLDAsMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYygwLjIxMywtMC4yMTMsMC4xNDMpLGMoMC43MTUsMC4yODUsMC4xNDApLGMoMC4wNzIsLTAuMDcyLC0wLjI4MyksMCwwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjKDAuMjEzLC0wLjIxMywtMC43ODcpLGMoMC43MTUsLTAuNzE1LDAuNzE1KSxjKDAuMDcyLDAuOTI4LDAuMDcyKSwwLDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwwLDEsMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLDAsMCwxXTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ2x1bWluYW5jZVRvQWxwaGEnOlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdHJpeCA9IFswLDAsMCwwLDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwwLDAsMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLDAsMCwwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLjIxMjUsMC43MTU0LDAuMDcyMSwwLDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwwLDAsMV07XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGltR2V0KGltZywgeCwgeSwgd2lkdGgsIGhlaWdodCwgcmdiYSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGltZ1t5KndpZHRoKjQgKyB4KjQgKyByZ2JhXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gaW1TZXQoaW1nLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCByZ2JhLCB2YWwpIHtcclxuICAgICAgICAgICAgICAgIGltZ1t5KndpZHRoKjQgKyB4KjQgKyByZ2JhXSA9IHZhbDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gbShpLCB2KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWkgPSBtYXRyaXhbaV07XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbWkgKiAobWkgPCAwID8gdiAtIDI1NSA6IHYpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFwcGx5ID0gZnVuY3Rpb24oY3R4LCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBhc3N1bWluZyB4PT0wICYmIHk9PTAgZm9yIG5vd1xyXG4gICAgICAgICAgICAgICAgdmFyIHNyY0RhdGEgPSBjdHguZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IGltR2V0KHNyY0RhdGEuZGF0YSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnID0gaW1HZXQoc3JjRGF0YS5kYXRhLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSBpbUdldChzcmNEYXRhLmRhdGEsIHgsIHksIHdpZHRoLCBoZWlnaHQsIDIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IGltR2V0KHNyY0RhdGEuZGF0YSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgMyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGltU2V0KHNyY0RhdGEuZGF0YSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgMCwgbSgwLHIpK20oMSxnKSttKDIsYikrbSgzLGEpK20oNCwxKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGltU2V0KHNyY0RhdGEuZGF0YSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgMSwgbSg1LHIpK20oNixnKSttKDcsYikrbSg4LGEpK20oOSwxKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGltU2V0KHNyY0RhdGEuZGF0YSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgMiwgbSgxMCxyKSttKDExLGcpK20oMTIsYikrbSgxMyxhKSttKDE0LDEpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW1TZXQoc3JjRGF0YS5kYXRhLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCAzLCBtKDE1LHIpK20oMTYsZykrbSgxNyxiKSttKDE4LGEpK20oMTksMSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICBjdHgucHV0SW1hZ2VEYXRhKHNyY0RhdGEsIDAsIDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50LmZlQ29sb3JNYXRyaXgucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICBzdmcuRWxlbWVudC5mZUdhdXNzaWFuQmx1ciA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5iYXNlID0gc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcbiAgICAgICAgICAgIHRoaXMuYmFzZShub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYmx1clJhZGl1cyA9IE1hdGguZmxvb3IodGhpcy5hdHRyaWJ1dGUoJ3N0ZERldmlhdGlvbicpLm51bVZhbHVlKCkpO1xyXG4gICAgICAgICAgICB0aGlzLmV4dHJhRmlsdGVyRGlzdGFuY2UgPSB0aGlzLmJsdXJSYWRpdXM7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFwcGx5ID0gZnVuY3Rpb24oY3R4LCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHN0YWNrQmx1ci5jYW52YXNSR0JBKSA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Zy5sb2coJ0VSUk9SOiBTdGFja0JsdXIuanMgbXVzdCBiZSBpbmNsdWRlZCBmb3IgYmx1ciB0byB3b3JrJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIFN0YWNrQmx1ciByZXF1aXJlcyBjYW52YXMgYmUgb24gZG9jdW1lbnRcclxuICAgICAgICAgICAgICAgIGN0eC5jYW52YXMuaWQgPSBzdmcuVW5pcXVlSWQoKTtcclxuICAgICAgICAgICAgICAgIGN0eC5jYW52YXMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY3R4LmNhbnZhcyk7XHJcbiAgICAgICAgICAgICAgICBzdGFja0JsdXIuY2FudmFzUkdCQShjdHguY2FudmFzLmlkLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCB0aGlzLmJsdXJSYWRpdXMpO1xyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjdHguY2FudmFzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5mZUdhdXNzaWFuQmx1ci5wcm90b3R5cGUgPSBuZXcgc3ZnLkVsZW1lbnQuRWxlbWVudEJhc2U7XHJcblxyXG4gICAgICAgIC8vIHRpdGxlIGVsZW1lbnQsIGRvIG5vdGhpbmdcclxuICAgICAgICBzdmcuRWxlbWVudC50aXRsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3ZnLkVsZW1lbnQudGl0bGUucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBkZXNjIGVsZW1lbnQsIGRvIG5vdGhpbmdcclxuICAgICAgICBzdmcuRWxlbWVudC5kZXNjID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdmcuRWxlbWVudC5kZXNjLnByb3RvdHlwZSA9IG5ldyBzdmcuRWxlbWVudC5FbGVtZW50QmFzZTtcclxuXHJcbiAgICAgICAgc3ZnLkVsZW1lbnQuTUlTU0lORyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgc3ZnLmxvZygnRVJST1I6IEVsZW1lbnQgXFwnJyArIG5vZGUubm9kZU5hbWUgKyAnXFwnIG5vdCB5ZXQgaW1wbGVtZW50ZWQuJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN2Zy5FbGVtZW50Lk1JU1NJTkcucHJvdG90eXBlID0gbmV3IHN2Zy5FbGVtZW50LkVsZW1lbnRCYXNlO1xyXG5cclxuICAgICAgICAvLyBlbGVtZW50IGZhY3RvcnlcclxuICAgICAgICBzdmcuQ3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdmFyIGNsYXNzTmFtZSA9IG5vZGUubm9kZU5hbWUucmVwbGFjZSgvXlteOl0rOi8sJycpOyAvLyByZW1vdmUgbmFtZXNwYWNlXHJcbiAgICAgICAgICAgIGNsYXNzTmFtZSA9IGNsYXNzTmFtZS5yZXBsYWNlKC9cXC0vZywnJyk7IC8vIHJlbW92ZSBkYXNoZXNcclxuICAgICAgICAgICAgdmFyIGUgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mKHN2Zy5FbGVtZW50W2NsYXNzTmFtZV0pICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICBlID0gbmV3IHN2Zy5FbGVtZW50W2NsYXNzTmFtZV0obm9kZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBlID0gbmV3IHN2Zy5FbGVtZW50Lk1JU1NJTkcobm9kZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGUudHlwZSA9IG5vZGUubm9kZU5hbWU7XHJcbiAgICAgICAgICAgIHJldHVybiBlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbG9hZCBmcm9tIHVybFxyXG4gICAgICAgIHN2Zy5sb2FkID0gZnVuY3Rpb24oY3R4LCB1cmwpIHtcclxuICAgICAgICAgICAgc3ZnLmxvYWRYbWwoY3R4LCBzdmcuYWpheCh1cmwpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGxvYWQgZnJvbSB4bWxcclxuICAgICAgICBzdmcubG9hZFhtbCA9IGZ1bmN0aW9uKGN0eCwgeG1sKSB7XHJcbiAgICAgICAgICAgIHN2Zy5sb2FkWG1sRG9jKGN0eCwgc3ZnLnBhcnNlWG1sKHhtbCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3ZnLmxvYWRYbWxEb2MgPSBmdW5jdGlvbihjdHgsIGRvbSkge1xyXG4gICAgICAgICAgICBzdmcuaW5pdChjdHgpO1xyXG5cclxuICAgICAgICAgICAgdmFyIG1hcFhZID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGUgPSBjdHguY2FudmFzO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBwLnggLT0gZS5vZmZzZXRMZWZ0O1xyXG4gICAgICAgICAgICAgICAgICAgIHAueSAtPSBlLm9mZnNldFRvcDtcclxuICAgICAgICAgICAgICAgICAgICBlID0gZS5vZmZzZXRQYXJlbnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAod2luZG93LnNjcm9sbFgpIHAueCArPSB3aW5kb3cuc2Nyb2xsWDtcclxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cuc2Nyb2xsWSkgcC55ICs9IHdpbmRvdy5zY3JvbGxZO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGJpbmQgbW91c2VcclxuICAgICAgICAgICAgaWYgKHN2Zy5vcHRzWydpZ25vcmVNb3VzZSddICE9IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGN0eC5jYW52YXMub25jbGljayA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcCA9IG1hcFhZKG5ldyBzdmcuUG9pbnQoZSAhPSBudWxsID8gZS5jbGllbnRYIDogZXZlbnQuY2xpZW50WCwgZSAhPSBudWxsID8gZS5jbGllbnRZIDogZXZlbnQuY2xpZW50WSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Zy5Nb3VzZS5vbmNsaWNrKHAueCwgcC55KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBjdHguY2FudmFzLm9ubW91c2Vtb3ZlID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gbWFwWFkobmV3IHN2Zy5Qb2ludChlICE9IG51bGwgPyBlLmNsaWVudFggOiBldmVudC5jbGllbnRYLCBlICE9IG51bGwgPyBlLmNsaWVudFkgOiBldmVudC5jbGllbnRZKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3ZnLk1vdXNlLm9ubW91c2Vtb3ZlKHAueCwgcC55KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBlID0gc3ZnLkNyZWF0ZUVsZW1lbnQoZG9tLmRvY3VtZW50RWxlbWVudCk7XHJcbiAgICAgICAgICAgIGUucm9vdCA9IHRydWU7XHJcbiAgICAgICAgICAgIGUuYWRkU3R5bGVzRnJvbVN0eWxlRGVmaW5pdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgLy8gcmVuZGVyIGxvb3BcclxuICAgICAgICAgICAgdmFyIGlzRmlyc3RSZW5kZXIgPSB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgZHJhdyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgc3ZnLlZpZXdQb3J0LkNsZWFyKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3R4LmNhbnZhcy5wYXJlbnROb2RlKSBzdmcuVmlld1BvcnQuU2V0Q3VycmVudChjdHguY2FudmFzLnBhcmVudE5vZGUuY2xpZW50V2lkdGgsIGN0eC5jYW52YXMucGFyZW50Tm9kZS5jbGllbnRIZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snaWdub3JlRGltZW5zaW9ucyddICE9IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBzZXQgY2FudmFzIHNpemVcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5zdHlsZSgnd2lkdGgnKS5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5jYW52YXMud2lkdGggPSBlLnN0eWxlKCd3aWR0aCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5jYW52YXMuc3R5bGUud2lkdGggPSBjdHguY2FudmFzLndpZHRoICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUuc3R5bGUoJ2hlaWdodCcpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3R4LmNhbnZhcy5oZWlnaHQgPSBlLnN0eWxlKCdoZWlnaHQnKS50b1BpeGVscygneScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguY2FudmFzLnN0eWxlLmhlaWdodCA9IGN0eC5jYW52YXMuaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgY1dpZHRoID0gY3R4LmNhbnZhcy5jbGllbnRXaWR0aCB8fCBjdHguY2FudmFzLndpZHRoO1xyXG4gICAgICAgICAgICAgICAgdmFyIGNIZWlnaHQgPSBjdHguY2FudmFzLmNsaWVudEhlaWdodCB8fCBjdHguY2FudmFzLmhlaWdodDtcclxuICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snaWdub3JlRGltZW5zaW9ucyddID09IHRydWUgJiYgZS5zdHlsZSgnd2lkdGgnKS5oYXNWYWx1ZSgpICYmIGUuc3R5bGUoJ2hlaWdodCcpLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjV2lkdGggPSBlLnN0eWxlKCd3aWR0aCcpLnRvUGl4ZWxzKCd4Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgY0hlaWdodCA9IGUuc3R5bGUoJ2hlaWdodCcpLnRvUGl4ZWxzKCd5Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBzdmcuVmlld1BvcnQuU2V0Q3VycmVudChjV2lkdGgsIGNIZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snb2Zmc2V0WCddICE9IG51bGwpIGUuYXR0cmlidXRlKCd4JywgdHJ1ZSkudmFsdWUgPSBzdmcub3B0c1snb2Zmc2V0WCddO1xyXG4gICAgICAgICAgICAgICAgaWYgKHN2Zy5vcHRzWydvZmZzZXRZJ10gIT0gbnVsbCkgZS5hdHRyaWJ1dGUoJ3knLCB0cnVlKS52YWx1ZSA9IHN2Zy5vcHRzWydvZmZzZXRZJ107XHJcbiAgICAgICAgICAgICAgICBpZiAoc3ZnLm9wdHNbJ3NjYWxlV2lkdGgnXSAhPSBudWxsIHx8IHN2Zy5vcHRzWydzY2FsZUhlaWdodCddICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgeFJhdGlvID0gbnVsbCwgeVJhdGlvID0gbnVsbCwgdmlld0JveCA9IHN2Zy5Ub051bWJlckFycmF5KGUuYXR0cmlidXRlKCd2aWV3Qm94JykudmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3ZnLm9wdHNbJ3NjYWxlV2lkdGgnXSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmF0dHJpYnV0ZSgnd2lkdGgnKS5oYXNWYWx1ZSgpKSB4UmF0aW8gPSBlLmF0dHJpYnV0ZSgnd2lkdGgnKS50b1BpeGVscygneCcpIC8gc3ZnLm9wdHNbJ3NjYWxlV2lkdGgnXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoIWlzTmFOKHZpZXdCb3hbMl0pKSB4UmF0aW8gPSB2aWV3Qm94WzJdIC8gc3ZnLm9wdHNbJ3NjYWxlV2lkdGgnXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snc2NhbGVIZWlnaHQnXSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmF0dHJpYnV0ZSgnaGVpZ2h0JykuaGFzVmFsdWUoKSkgeVJhdGlvID0gZS5hdHRyaWJ1dGUoJ2hlaWdodCcpLnRvUGl4ZWxzKCd5JykgLyBzdmcub3B0c1snc2NhbGVIZWlnaHQnXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoIWlzTmFOKHZpZXdCb3hbM10pKSB5UmF0aW8gPSB2aWV3Qm94WzNdIC8gc3ZnLm9wdHNbJ3NjYWxlSGVpZ2h0J107XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoeFJhdGlvID09IG51bGwpIHsgeFJhdGlvID0geVJhdGlvOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHlSYXRpbyA9PSBudWxsKSB7IHlSYXRpbyA9IHhSYXRpbzsgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBlLmF0dHJpYnV0ZSgnd2lkdGgnLCB0cnVlKS52YWx1ZSA9IHN2Zy5vcHRzWydzY2FsZVdpZHRoJ107XHJcbiAgICAgICAgICAgICAgICAgICAgZS5hdHRyaWJ1dGUoJ2hlaWdodCcsIHRydWUpLnZhbHVlID0gc3ZnLm9wdHNbJ3NjYWxlSGVpZ2h0J107XHJcbiAgICAgICAgICAgICAgICAgICAgZS5zdHlsZSgndHJhbnNmb3JtJywgdHJ1ZSwgdHJ1ZSkudmFsdWUgKz0gJyBzY2FsZSgnKygxLjAveFJhdGlvKSsnLCcrKDEuMC95UmF0aW8pKycpJztcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBjbGVhciBhbmQgcmVuZGVyXHJcbiAgICAgICAgICAgICAgICBpZiAoc3ZnLm9wdHNbJ2lnbm9yZUNsZWFyJ10gIT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY1dpZHRoLCBjSGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGUucmVuZGVyKGN0eCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNGaXJzdFJlbmRlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlzRmlyc3RSZW5kZXIgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHN2Zy5vcHRzWydyZW5kZXJDYWxsYmFjayddKSA9PSAnZnVuY3Rpb24nKSBzdmcub3B0c1sncmVuZGVyQ2FsbGJhY2snXShkb20pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgd2FpdGluZ0ZvckltYWdlcyA9IHRydWU7XHJcbiAgICAgICAgICAgIGlmIChzdmcuSW1hZ2VzTG9hZGVkKCkpIHtcclxuICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JJbWFnZXMgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRyYXcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBzdmcuaW50ZXJ2YWxJRCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5lZWRVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAod2FpdGluZ0ZvckltYWdlcyAmJiBzdmcuSW1hZ2VzTG9hZGVkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9ySW1hZ2VzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgbmVlZFVwZGF0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gbmVlZCB1cGRhdGUgZnJvbSBtb3VzZSBldmVudHM/XHJcbiAgICAgICAgICAgICAgICBpZiAoc3ZnLm9wdHNbJ2lnbm9yZU1vdXNlJ10gIT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5lZWRVcGRhdGUgPSBuZWVkVXBkYXRlIHwgc3ZnLk1vdXNlLmhhc0V2ZW50cygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIG5lZWQgdXBkYXRlIGZyb20gYW5pbWF0aW9ucz9cclxuICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snaWdub3JlQW5pbWF0aW9uJ10gIT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxzdmcuQW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuZWVkVXBkYXRlID0gbmVlZFVwZGF0ZSB8IHN2Zy5BbmltYXRpb25zW2ldLnVwZGF0ZSgxMDAwIC8gc3ZnLkZSQU1FUkFURSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIG5lZWQgdXBkYXRlIGZyb20gcmVkcmF3P1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZihzdmcub3B0c1snZm9yY2VSZWRyYXcnXSkgPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdmcub3B0c1snZm9yY2VSZWRyYXcnXSgpID09IHRydWUpIG5lZWRVcGRhdGUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIHJlbmRlciBpZiBuZWVkZWRcclxuICAgICAgICAgICAgICAgIGlmIChuZWVkVXBkYXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Zy5Nb3VzZS5ydW5FdmVudHMoKTsgLy8gcnVuIGFuZCBjbGVhciBvdXIgZXZlbnRzXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIDEwMDAgLyBzdmcuRlJBTUVSQVRFKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN2Zy5zdG9wID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmIChzdmcuaW50ZXJ2YWxJRCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChzdmcuaW50ZXJ2YWxJRCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN2Zy5Nb3VzZSA9IG5ldyAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzID0gW107XHJcbiAgICAgICAgICAgIHRoaXMuaGFzRXZlbnRzID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmV2ZW50cy5sZW5ndGggIT0gMDsgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5vbmNsaWNrID0gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudHMucHVzaCh7IHR5cGU6ICdvbmNsaWNrJywgeDogeCwgeTogeSxcclxuICAgICAgICAgICAgICAgICAgICBydW46IGZ1bmN0aW9uKGUpIHsgaWYgKGUub25jbGljaykgZS5vbmNsaWNrKCk7IH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLm9ubW91c2Vtb3ZlID0gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudHMucHVzaCh7IHR5cGU6ICdvbm1vdXNlbW92ZScsIHg6IHgsIHk6IHksXHJcbiAgICAgICAgICAgICAgICAgICAgcnVuOiBmdW5jdGlvbihlKSB7IGlmIChlLm9ubW91c2Vtb3ZlKSBlLm9ubW91c2Vtb3ZlKCk7IH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmV2ZW50RWxlbWVudHMgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2hlY2tQYXRoID0gZnVuY3Rpb24oZWxlbWVudCwgY3R4KSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5ldmVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZSA9IHRoaXMuZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdHguaXNQb2ludEluUGF0aCAmJiBjdHguaXNQb2ludEluUGF0aChlLngsIGUueSkpIHRoaXMuZXZlbnRFbGVtZW50c1tpXSA9IGVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2hlY2tCb3VuZGluZ0JveCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGJiKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5ldmVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZSA9IHRoaXMuZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChiYi5pc1BvaW50SW5Cb3goZS54LCBlLnkpKSB0aGlzLmV2ZW50RWxlbWVudHNbaV0gPSBlbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJ1bkV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgc3ZnLmN0eC5jYW52YXMuc3R5bGUuY3Vyc29yID0gJyc7XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRoaXMuZXZlbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGUgPSB0aGlzLmV2ZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IHRoaXMuZXZlbnRFbGVtZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoZWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnJ1bihlbGVtZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudCA9IGVsZW1lbnQucGFyZW50O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBkb25lIHJ1bm5pbmcsIGNsZWFyXHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50cyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudEVsZW1lbnRzID0gW107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHN2ZztcclxuICAgIH07XHJcblxyXG4gICAgaWYgKHR5cGVvZihDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELnByb3RvdHlwZS5kcmF3U3ZnID0gZnVuY3Rpb24ocywgZHgsIGR5LCBkdywgZGgpIHtcclxuICAgICAgICAgICAgY2FudmcodGhpcy5jYW52YXMsIHMsIHtcclxuICAgICAgICAgICAgICAgIGlnbm9yZU1vdXNlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaWdub3JlQW5pbWF0aW9uOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaWdub3JlRGltZW5zaW9uczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlnbm9yZUNsZWFyOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgb2Zmc2V0WDogZHgsXHJcbiAgICAgICAgICAgICAgICBvZmZzZXRZOiBkeSxcclxuICAgICAgICAgICAgICAgIHNjYWxlV2lkdGg6IGR3LFxyXG4gICAgICAgICAgICAgICAgc2NhbGVIZWlnaHQ6IGRoXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gY2Fudmc7XHJcblxyXG59KSk7XHJcbiIsIi8qKlxyXG4gKiBBIGNsYXNzIHRvIHBhcnNlIGNvbG9yIHZhbHVlc1xyXG4gKiBAYXV0aG9yIFN0b3lhbiBTdGVmYW5vdiA8c3N0b29AZ21haWwuY29tPlxyXG4gKiBAbGluayAgIGh0dHA6Ly93d3cucGhwaWVkLmNvbS9yZ2ItY29sb3ItcGFyc2VyLWluLWphdmFzY3JpcHQvXHJcbiAqIEBsaWNlbnNlIFVzZSBpdCBpZiB5b3UgbGlrZSBpdFxyXG4gKi9cclxuXHJcbihmdW5jdGlvbiAoIGdsb2JhbCApIHtcclxuXHJcbiAgZnVuY3Rpb24gUkdCQ29sb3IoY29sb3Jfc3RyaW5nKVxyXG4gIHtcclxuICAgIHRoaXMub2sgPSBmYWxzZTtcclxuXHJcbiAgICAvLyBzdHJpcCBhbnkgbGVhZGluZyAjXHJcbiAgICBpZiAoY29sb3Jfc3RyaW5nLmNoYXJBdCgwKSA9PSAnIycpIHsgLy8gcmVtb3ZlICMgaWYgYW55XHJcbiAgICAgIGNvbG9yX3N0cmluZyA9IGNvbG9yX3N0cmluZy5zdWJzdHIoMSw2KTtcclxuICAgIH1cclxuXHJcbiAgICBjb2xvcl9zdHJpbmcgPSBjb2xvcl9zdHJpbmcucmVwbGFjZSgvIC9nLCcnKTtcclxuICAgIGNvbG9yX3N0cmluZyA9IGNvbG9yX3N0cmluZy50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIC8vIGJlZm9yZSBnZXR0aW5nIGludG8gcmVnZXhwcywgdHJ5IHNpbXBsZSBtYXRjaGVzXHJcbiAgICAvLyBhbmQgb3ZlcndyaXRlIHRoZSBpbnB1dFxyXG4gICAgdmFyIHNpbXBsZV9jb2xvcnMgPSB7XHJcbiAgICAgIGFsaWNlYmx1ZTogJ2YwZjhmZicsXHJcbiAgICAgIGFudGlxdWV3aGl0ZTogJ2ZhZWJkNycsXHJcbiAgICAgIGFxdWE6ICcwMGZmZmYnLFxyXG4gICAgICBhcXVhbWFyaW5lOiAnN2ZmZmQ0JyxcclxuICAgICAgYXp1cmU6ICdmMGZmZmYnLFxyXG4gICAgICBiZWlnZTogJ2Y1ZjVkYycsXHJcbiAgICAgIGJpc3F1ZTogJ2ZmZTRjNCcsXHJcbiAgICAgIGJsYWNrOiAnMDAwMDAwJyxcclxuICAgICAgYmxhbmNoZWRhbG1vbmQ6ICdmZmViY2QnLFxyXG4gICAgICBibHVlOiAnMDAwMGZmJyxcclxuICAgICAgYmx1ZXZpb2xldDogJzhhMmJlMicsXHJcbiAgICAgIGJyb3duOiAnYTUyYTJhJyxcclxuICAgICAgYnVybHl3b29kOiAnZGViODg3JyxcclxuICAgICAgY2FkZXRibHVlOiAnNWY5ZWEwJyxcclxuICAgICAgY2hhcnRyZXVzZTogJzdmZmYwMCcsXHJcbiAgICAgIGNob2NvbGF0ZTogJ2QyNjkxZScsXHJcbiAgICAgIGNvcmFsOiAnZmY3ZjUwJyxcclxuICAgICAgY29ybmZsb3dlcmJsdWU6ICc2NDk1ZWQnLFxyXG4gICAgICBjb3Juc2lsazogJ2ZmZjhkYycsXHJcbiAgICAgIGNyaW1zb246ICdkYzE0M2MnLFxyXG4gICAgICBjeWFuOiAnMDBmZmZmJyxcclxuICAgICAgZGFya2JsdWU6ICcwMDAwOGInLFxyXG4gICAgICBkYXJrY3lhbjogJzAwOGI4YicsXHJcbiAgICAgIGRhcmtnb2xkZW5yb2Q6ICdiODg2MGInLFxyXG4gICAgICBkYXJrZ3JheTogJ2E5YTlhOScsXHJcbiAgICAgIGRhcmtncmVlbjogJzAwNjQwMCcsXHJcbiAgICAgIGRhcmtraGFraTogJ2JkYjc2YicsXHJcbiAgICAgIGRhcmttYWdlbnRhOiAnOGIwMDhiJyxcclxuICAgICAgZGFya29saXZlZ3JlZW46ICc1NTZiMmYnLFxyXG4gICAgICBkYXJrb3JhbmdlOiAnZmY4YzAwJyxcclxuICAgICAgZGFya29yY2hpZDogJzk5MzJjYycsXHJcbiAgICAgIGRhcmtyZWQ6ICc4YjAwMDAnLFxyXG4gICAgICBkYXJrc2FsbW9uOiAnZTk5NjdhJyxcclxuICAgICAgZGFya3NlYWdyZWVuOiAnOGZiYzhmJyxcclxuICAgICAgZGFya3NsYXRlYmx1ZTogJzQ4M2Q4YicsXHJcbiAgICAgIGRhcmtzbGF0ZWdyYXk6ICcyZjRmNGYnLFxyXG4gICAgICBkYXJrdHVycXVvaXNlOiAnMDBjZWQxJyxcclxuICAgICAgZGFya3Zpb2xldDogJzk0MDBkMycsXHJcbiAgICAgIGRlZXBwaW5rOiAnZmYxNDkzJyxcclxuICAgICAgZGVlcHNreWJsdWU6ICcwMGJmZmYnLFxyXG4gICAgICBkaW1ncmF5OiAnNjk2OTY5JyxcclxuICAgICAgZG9kZ2VyYmx1ZTogJzFlOTBmZicsXHJcbiAgICAgIGZlbGRzcGFyOiAnZDE5Mjc1JyxcclxuICAgICAgZmlyZWJyaWNrOiAnYjIyMjIyJyxcclxuICAgICAgZmxvcmFsd2hpdGU6ICdmZmZhZjAnLFxyXG4gICAgICBmb3Jlc3RncmVlbjogJzIyOGIyMicsXHJcbiAgICAgIGZ1Y2hzaWE6ICdmZjAwZmYnLFxyXG4gICAgICBnYWluc2Jvcm86ICdkY2RjZGMnLFxyXG4gICAgICBnaG9zdHdoaXRlOiAnZjhmOGZmJyxcclxuICAgICAgZ29sZDogJ2ZmZDcwMCcsXHJcbiAgICAgIGdvbGRlbnJvZDogJ2RhYTUyMCcsXHJcbiAgICAgIGdyYXk6ICc4MDgwODAnLFxyXG4gICAgICBncmVlbjogJzAwODAwMCcsXHJcbiAgICAgIGdyZWVueWVsbG93OiAnYWRmZjJmJyxcclxuICAgICAgaG9uZXlkZXc6ICdmMGZmZjAnLFxyXG4gICAgICBob3RwaW5rOiAnZmY2OWI0JyxcclxuICAgICAgaW5kaWFucmVkIDogJ2NkNWM1YycsXHJcbiAgICAgIGluZGlnbyA6ICc0YjAwODInLFxyXG4gICAgICBpdm9yeTogJ2ZmZmZmMCcsXHJcbiAgICAgIGtoYWtpOiAnZjBlNjhjJyxcclxuICAgICAgbGF2ZW5kZXI6ICdlNmU2ZmEnLFxyXG4gICAgICBsYXZlbmRlcmJsdXNoOiAnZmZmMGY1JyxcclxuICAgICAgbGF3bmdyZWVuOiAnN2NmYzAwJyxcclxuICAgICAgbGVtb25jaGlmZm9uOiAnZmZmYWNkJyxcclxuICAgICAgbGlnaHRibHVlOiAnYWRkOGU2JyxcclxuICAgICAgbGlnaHRjb3JhbDogJ2YwODA4MCcsXHJcbiAgICAgIGxpZ2h0Y3lhbjogJ2UwZmZmZicsXHJcbiAgICAgIGxpZ2h0Z29sZGVucm9keWVsbG93OiAnZmFmYWQyJyxcclxuICAgICAgbGlnaHRncmV5OiAnZDNkM2QzJyxcclxuICAgICAgbGlnaHRncmVlbjogJzkwZWU5MCcsXHJcbiAgICAgIGxpZ2h0cGluazogJ2ZmYjZjMScsXHJcbiAgICAgIGxpZ2h0c2FsbW9uOiAnZmZhMDdhJyxcclxuICAgICAgbGlnaHRzZWFncmVlbjogJzIwYjJhYScsXHJcbiAgICAgIGxpZ2h0c2t5Ymx1ZTogJzg3Y2VmYScsXHJcbiAgICAgIGxpZ2h0c2xhdGVibHVlOiAnODQ3MGZmJyxcclxuICAgICAgbGlnaHRzbGF0ZWdyYXk6ICc3Nzg4OTknLFxyXG4gICAgICBsaWdodHN0ZWVsYmx1ZTogJ2IwYzRkZScsXHJcbiAgICAgIGxpZ2h0eWVsbG93OiAnZmZmZmUwJyxcclxuICAgICAgbGltZTogJzAwZmYwMCcsXHJcbiAgICAgIGxpbWVncmVlbjogJzMyY2QzMicsXHJcbiAgICAgIGxpbmVuOiAnZmFmMGU2JyxcclxuICAgICAgbWFnZW50YTogJ2ZmMDBmZicsXHJcbiAgICAgIG1hcm9vbjogJzgwMDAwMCcsXHJcbiAgICAgIG1lZGl1bWFxdWFtYXJpbmU6ICc2NmNkYWEnLFxyXG4gICAgICBtZWRpdW1ibHVlOiAnMDAwMGNkJyxcclxuICAgICAgbWVkaXVtb3JjaGlkOiAnYmE1NWQzJyxcclxuICAgICAgbWVkaXVtcHVycGxlOiAnOTM3MGQ4JyxcclxuICAgICAgbWVkaXVtc2VhZ3JlZW46ICczY2IzNzEnLFxyXG4gICAgICBtZWRpdW1zbGF0ZWJsdWU6ICc3YjY4ZWUnLFxyXG4gICAgICBtZWRpdW1zcHJpbmdncmVlbjogJzAwZmE5YScsXHJcbiAgICAgIG1lZGl1bXR1cnF1b2lzZTogJzQ4ZDFjYycsXHJcbiAgICAgIG1lZGl1bXZpb2xldHJlZDogJ2M3MTU4NScsXHJcbiAgICAgIG1pZG5pZ2h0Ymx1ZTogJzE5MTk3MCcsXHJcbiAgICAgIG1pbnRjcmVhbTogJ2Y1ZmZmYScsXHJcbiAgICAgIG1pc3R5cm9zZTogJ2ZmZTRlMScsXHJcbiAgICAgIG1vY2Nhc2luOiAnZmZlNGI1JyxcclxuICAgICAgbmF2YWpvd2hpdGU6ICdmZmRlYWQnLFxyXG4gICAgICBuYXZ5OiAnMDAwMDgwJyxcclxuICAgICAgb2xkbGFjZTogJ2ZkZjVlNicsXHJcbiAgICAgIG9saXZlOiAnODA4MDAwJyxcclxuICAgICAgb2xpdmVkcmFiOiAnNmI4ZTIzJyxcclxuICAgICAgb3JhbmdlOiAnZmZhNTAwJyxcclxuICAgICAgb3JhbmdlcmVkOiAnZmY0NTAwJyxcclxuICAgICAgb3JjaGlkOiAnZGE3MGQ2JyxcclxuICAgICAgcGFsZWdvbGRlbnJvZDogJ2VlZThhYScsXHJcbiAgICAgIHBhbGVncmVlbjogJzk4ZmI5OCcsXHJcbiAgICAgIHBhbGV0dXJxdW9pc2U6ICdhZmVlZWUnLFxyXG4gICAgICBwYWxldmlvbGV0cmVkOiAnZDg3MDkzJyxcclxuICAgICAgcGFwYXlhd2hpcDogJ2ZmZWZkNScsXHJcbiAgICAgIHBlYWNocHVmZjogJ2ZmZGFiOScsXHJcbiAgICAgIHBlcnU6ICdjZDg1M2YnLFxyXG4gICAgICBwaW5rOiAnZmZjMGNiJyxcclxuICAgICAgcGx1bTogJ2RkYTBkZCcsXHJcbiAgICAgIHBvd2RlcmJsdWU6ICdiMGUwZTYnLFxyXG4gICAgICBwdXJwbGU6ICc4MDAwODAnLFxyXG4gICAgICByZWQ6ICdmZjAwMDAnLFxyXG4gICAgICByb3N5YnJvd246ICdiYzhmOGYnLFxyXG4gICAgICByb3lhbGJsdWU6ICc0MTY5ZTEnLFxyXG4gICAgICBzYWRkbGVicm93bjogJzhiNDUxMycsXHJcbiAgICAgIHNhbG1vbjogJ2ZhODA3MicsXHJcbiAgICAgIHNhbmR5YnJvd246ICdmNGE0NjAnLFxyXG4gICAgICBzZWFncmVlbjogJzJlOGI1NycsXHJcbiAgICAgIHNlYXNoZWxsOiAnZmZmNWVlJyxcclxuICAgICAgc2llbm5hOiAnYTA1MjJkJyxcclxuICAgICAgc2lsdmVyOiAnYzBjMGMwJyxcclxuICAgICAgc2t5Ymx1ZTogJzg3Y2VlYicsXHJcbiAgICAgIHNsYXRlYmx1ZTogJzZhNWFjZCcsXHJcbiAgICAgIHNsYXRlZ3JheTogJzcwODA5MCcsXHJcbiAgICAgIHNub3c6ICdmZmZhZmEnLFxyXG4gICAgICBzcHJpbmdncmVlbjogJzAwZmY3ZicsXHJcbiAgICAgIHN0ZWVsYmx1ZTogJzQ2ODJiNCcsXHJcbiAgICAgIHRhbjogJ2QyYjQ4YycsXHJcbiAgICAgIHRlYWw6ICcwMDgwODAnLFxyXG4gICAgICB0aGlzdGxlOiAnZDhiZmQ4JyxcclxuICAgICAgdG9tYXRvOiAnZmY2MzQ3JyxcclxuICAgICAgdHVycXVvaXNlOiAnNDBlMGQwJyxcclxuICAgICAgdmlvbGV0OiAnZWU4MmVlJyxcclxuICAgICAgdmlvbGV0cmVkOiAnZDAyMDkwJyxcclxuICAgICAgd2hlYXQ6ICdmNWRlYjMnLFxyXG4gICAgICB3aGl0ZTogJ2ZmZmZmZicsXHJcbiAgICAgIHdoaXRlc21va2U6ICdmNWY1ZjUnLFxyXG4gICAgICB5ZWxsb3c6ICdmZmZmMDAnLFxyXG4gICAgICB5ZWxsb3dncmVlbjogJzlhY2QzMidcclxuICAgIH07XHJcbiAgICBmb3IgKHZhciBrZXkgaW4gc2ltcGxlX2NvbG9ycykge1xyXG4gICAgICBpZiAoY29sb3Jfc3RyaW5nID09IGtleSkge1xyXG4gICAgICAgIGNvbG9yX3N0cmluZyA9IHNpbXBsZV9jb2xvcnNba2V5XTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gZW1kIG9mIHNpbXBsZSB0eXBlLWluIGNvbG9yc1xyXG5cclxuICAgIC8vIGFycmF5IG9mIGNvbG9yIGRlZmluaXRpb24gb2JqZWN0c1xyXG4gICAgdmFyIGNvbG9yX2RlZnMgPSBbXHJcbiAgICAgIHtcclxuICAgICAgICByZTogL15yZ2JcXCgoXFxkezEsM30pLFxccyooXFxkezEsM30pLFxccyooXFxkezEsM30pXFwpJC8sXHJcbiAgICAgICAgZXhhbXBsZTogWydyZ2IoMTIzLCAyMzQsIDQ1KScsICdyZ2IoMjU1LDIzNCwyNDUpJ10sXHJcbiAgICAgICAgcHJvY2VzczogZnVuY3Rpb24gKGJpdHMpe1xyXG4gICAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgcGFyc2VJbnQoYml0c1sxXSksXHJcbiAgICAgICAgICAgIHBhcnNlSW50KGJpdHNbMl0pLFxyXG4gICAgICAgICAgICBwYXJzZUludChiaXRzWzNdKVxyXG4gICAgICAgICAgXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICByZTogL14oXFx3ezJ9KShcXHd7Mn0pKFxcd3syfSkkLyxcclxuICAgICAgICBleGFtcGxlOiBbJyMwMGZmMDAnLCAnMzM2Njk5J10sXHJcbiAgICAgICAgcHJvY2VzczogZnVuY3Rpb24gKGJpdHMpe1xyXG4gICAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgcGFyc2VJbnQoYml0c1sxXSwgMTYpLFxyXG4gICAgICAgICAgICBwYXJzZUludChiaXRzWzJdLCAxNiksXHJcbiAgICAgICAgICAgIHBhcnNlSW50KGJpdHNbM10sIDE2KVxyXG4gICAgICAgICAgXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICByZTogL14oXFx3ezF9KShcXHd7MX0pKFxcd3sxfSkkLyxcclxuICAgICAgICBleGFtcGxlOiBbJyNmYjAnLCAnZjBmJ10sXHJcbiAgICAgICAgcHJvY2VzczogZnVuY3Rpb24gKGJpdHMpe1xyXG4gICAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgcGFyc2VJbnQoYml0c1sxXSArIGJpdHNbMV0sIDE2KSxcclxuICAgICAgICAgICAgcGFyc2VJbnQoYml0c1syXSArIGJpdHNbMl0sIDE2KSxcclxuICAgICAgICAgICAgcGFyc2VJbnQoYml0c1szXSArIGJpdHNbM10sIDE2KVxyXG4gICAgICAgICAgXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIF07XHJcblxyXG4gICAgLy8gc2VhcmNoIHRocm91Z2ggdGhlIGRlZmluaXRpb25zIHRvIGZpbmQgYSBtYXRjaFxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2xvcl9kZWZzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHZhciByZSA9IGNvbG9yX2RlZnNbaV0ucmU7XHJcbiAgICAgIHZhciBwcm9jZXNzb3IgPSBjb2xvcl9kZWZzW2ldLnByb2Nlc3M7XHJcbiAgICAgIHZhciBiaXRzID0gcmUuZXhlYyhjb2xvcl9zdHJpbmcpO1xyXG4gICAgICBpZiAoYml0cykge1xyXG4gICAgICAgIGNoYW5uZWxzID0gcHJvY2Vzc29yKGJpdHMpO1xyXG4gICAgICAgIHRoaXMuciA9IGNoYW5uZWxzWzBdO1xyXG4gICAgICAgIHRoaXMuZyA9IGNoYW5uZWxzWzFdO1xyXG4gICAgICAgIHRoaXMuYiA9IGNoYW5uZWxzWzJdO1xyXG4gICAgICAgIHRoaXMub2sgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8vIHZhbGlkYXRlL2NsZWFudXAgdmFsdWVzXHJcbiAgICB0aGlzLnIgPSAodGhpcy5yIDwgMCB8fCBpc05hTih0aGlzLnIpKSA/IDAgOiAoKHRoaXMuciA+IDI1NSkgPyAyNTUgOiB0aGlzLnIpO1xyXG4gICAgdGhpcy5nID0gKHRoaXMuZyA8IDAgfHwgaXNOYU4odGhpcy5nKSkgPyAwIDogKCh0aGlzLmcgPiAyNTUpID8gMjU1IDogdGhpcy5nKTtcclxuICAgIHRoaXMuYiA9ICh0aGlzLmIgPCAwIHx8IGlzTmFOKHRoaXMuYikpID8gMCA6ICgodGhpcy5iID4gMjU1KSA/IDI1NSA6IHRoaXMuYik7XHJcblxyXG4gICAgLy8gc29tZSBnZXR0ZXJzXHJcbiAgICB0aGlzLnRvUkdCID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICByZXR1cm4gJ3JnYignICsgdGhpcy5yICsgJywgJyArIHRoaXMuZyArICcsICcgKyB0aGlzLmIgKyAnKSc7XHJcbiAgICB9XHJcbiAgICB0aGlzLnRvSGV4ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgciA9IHRoaXMuci50b1N0cmluZygxNik7XHJcbiAgICAgIHZhciBnID0gdGhpcy5nLnRvU3RyaW5nKDE2KTtcclxuICAgICAgdmFyIGIgPSB0aGlzLmIudG9TdHJpbmcoMTYpO1xyXG4gICAgICBpZiAoci5sZW5ndGggPT0gMSkgciA9ICcwJyArIHI7XHJcbiAgICAgIGlmIChnLmxlbmd0aCA9PSAxKSBnID0gJzAnICsgZztcclxuICAgICAgaWYgKGIubGVuZ3RoID09IDEpIGIgPSAnMCcgKyBiO1xyXG4gICAgICByZXR1cm4gJyMnICsgciArIGcgKyBiO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGhlbHBcclxuICAgIHRoaXMuZ2V0SGVscFhNTCA9IGZ1bmN0aW9uICgpIHtcclxuXHJcbiAgICAgIHZhciBleGFtcGxlcyA9IG5ldyBBcnJheSgpO1xyXG4gICAgICAvLyBhZGQgcmVnZXhwc1xyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbG9yX2RlZnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgZXhhbXBsZSA9IGNvbG9yX2RlZnNbaV0uZXhhbXBsZTtcclxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGV4YW1wbGUubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgIGV4YW1wbGVzW2V4YW1wbGVzLmxlbmd0aF0gPSBleGFtcGxlW2pdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvLyBhZGQgdHlwZS1pbiBjb2xvcnNcclxuICAgICAgZm9yICh2YXIgc2MgaW4gc2ltcGxlX2NvbG9ycykge1xyXG4gICAgICAgIGV4YW1wbGVzW2V4YW1wbGVzLmxlbmd0aF0gPSBzYztcclxuICAgICAgfVxyXG5cclxuICAgICAgdmFyIHhtbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XHJcbiAgICAgIHhtbC5zZXRBdHRyaWJ1dGUoJ2lkJywgJ3JnYmNvbG9yLWV4YW1wbGVzJyk7XHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXhhbXBsZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdmFyIGxpc3RfaXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcbiAgICAgICAgICB2YXIgbGlzdF9jb2xvciA9IG5ldyBSR0JDb2xvcihleGFtcGxlc1tpXSk7XHJcbiAgICAgICAgICB2YXIgZXhhbXBsZV9kaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgIGV4YW1wbGVfZGl2LnN0eWxlLmNzc1RleHQgPVxyXG4gICAgICAgICAgICAgICdtYXJnaW46IDNweDsgJ1xyXG4gICAgICAgICAgICAgICsgJ2JvcmRlcjogMXB4IHNvbGlkIGJsYWNrOyAnXHJcbiAgICAgICAgICAgICAgKyAnYmFja2dyb3VuZDonICsgbGlzdF9jb2xvci50b0hleCgpICsgJzsgJ1xyXG4gICAgICAgICAgICAgICsgJ2NvbG9yOicgKyBsaXN0X2NvbG9yLnRvSGV4KClcclxuICAgICAgICAgIDtcclxuICAgICAgICAgIGV4YW1wbGVfZGl2LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCd0ZXN0JykpO1xyXG4gICAgICAgICAgdmFyIGxpc3RfaXRlbV92YWx1ZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFxyXG4gICAgICAgICAgICAnICcgKyBleGFtcGxlc1tpXSArICcgLT4gJyArIGxpc3RfY29sb3IudG9SR0IoKSArICcgLT4gJyArIGxpc3RfY29sb3IudG9IZXgoKVxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIGxpc3RfaXRlbS5hcHBlbmRDaGlsZChleGFtcGxlX2Rpdik7XHJcbiAgICAgICAgICBsaXN0X2l0ZW0uYXBwZW5kQ2hpbGQobGlzdF9pdGVtX3ZhbHVlKTtcclxuICAgICAgICAgIHhtbC5hcHBlbmRDaGlsZChsaXN0X2l0ZW0pO1xyXG5cclxuICAgICAgICB9IGNhdGNoKGUpe31cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4geG1sO1xyXG5cclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICAgIC8vIGV4cG9ydCBhcyBBTUQuLi5cclxuICAgIGlmICggdHlwZW9mIGRlZmluZSAhPT0gJ3VuZGVmaW5lZCcgJiYgZGVmaW5lLmFtZCApIHtcclxuICAgICAgICBkZWZpbmUoIGZ1bmN0aW9uICgpIHsgcmV0dXJuIFJHQkNvbG9yOyB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyAuLi5vciBhcyBicm93c2VyaWZ5XHJcbiAgICBlbHNlIGlmICggdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMgKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBSR0JDb2xvcjtcclxuICAgIH1cclxuXHJcbiAgICBnbG9iYWwuUkdCQ29sb3IgPSBSR0JDb2xvcjtcclxuXHJcbn0oIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdGhpcyApKTtcclxuIiwiLypcclxuXHJcblN0YWNrQmx1ciAtIGEgZmFzdCBhbG1vc3QgR2F1c3NpYW4gQmx1ciBGb3IgQ2FudmFzXHJcblxyXG5WZXJzaW9uOiBcdDAuNVxyXG5BdXRob3I6XHRcdE1hcmlvIEtsaW5nZW1hbm5cclxuQ29udGFjdDogXHRtYXJpb0BxdWFzaW1vbmRvLmNvbVxyXG5XZWJzaXRlOlx0aHR0cDovL3d3dy5xdWFzaW1vbmRvLmNvbS9TdGFja0JsdXJGb3JDYW52YXNcclxuVHdpdHRlcjpcdEBxdWFzaW1vbmRvXHJcblxyXG5JbiBjYXNlIHlvdSBmaW5kIHRoaXMgY2xhc3MgdXNlZnVsIC0gZXNwZWNpYWxseSBpbiBjb21tZXJjaWFsIHByb2plY3RzIC1cclxuSSBhbSBub3QgdG90YWxseSB1bmhhcHB5IGZvciBhIHNtYWxsIGRvbmF0aW9uIHRvIG15IFBheVBhbCBhY2NvdW50XHJcbm1hcmlvQHF1YXNpbW9uZG8uZGVcclxuXHJcbk9yIHN1cHBvcnQgbWUgb24gZmxhdHRyOlxyXG5odHRwczovL2ZsYXR0ci5jb20vdGhpbmcvNzI3OTEvU3RhY2tCbHVyLWEtZmFzdC1hbG1vc3QtR2F1c3NpYW4tQmx1ci1FZmZlY3QtZm9yLUNhbnZhc0phdmFzY3JpcHRcclxuXHJcbkNvcHlyaWdodCAoYykgMjAxMCBNYXJpbyBLbGluZ2VtYW5uXHJcblxyXG5QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvblxyXG5vYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvblxyXG5maWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcclxucmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsXHJcbmNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbmNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxyXG5Tb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZ1xyXG5jb25kaXRpb25zOlxyXG5cclxuVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcclxuaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxyXG5FWFBSRVNTIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVNcclxuT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkRcclxuTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcclxuSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksXHJcbldIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lOR1xyXG5GUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXHJcbk9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cclxuKi9cclxuXHJcbihmdW5jdGlvbiAoIGdsb2JhbCApIHtcclxuXHJcbiAgdmFyIG11bF90YWJsZSA9IFtcclxuICAgICAgNTEyLDUxMiw0NTYsNTEyLDMyOCw0NTYsMzM1LDUxMiw0MDUsMzI4LDI3MSw0NTYsMzg4LDMzNSwyOTIsNTEyLFxyXG4gICAgICA0NTQsNDA1LDM2NCwzMjgsMjk4LDI3MSw0OTYsNDU2LDQyMCwzODgsMzYwLDMzNSwzMTIsMjkyLDI3Myw1MTIsXHJcbiAgICAgIDQ4Miw0NTQsNDI4LDQwNSwzODMsMzY0LDM0NSwzMjgsMzEyLDI5OCwyODQsMjcxLDI1OSw0OTYsNDc1LDQ1NixcclxuICAgICAgNDM3LDQyMCw0MDQsMzg4LDM3NCwzNjAsMzQ3LDMzNSwzMjMsMzEyLDMwMiwyOTIsMjgyLDI3MywyNjUsNTEyLFxyXG4gICAgICA0OTcsNDgyLDQ2OCw0NTQsNDQxLDQyOCw0MTcsNDA1LDM5NCwzODMsMzczLDM2NCwzNTQsMzQ1LDMzNywzMjgsXHJcbiAgICAgIDMyMCwzMTIsMzA1LDI5OCwyOTEsMjg0LDI3OCwyNzEsMjY1LDI1OSw1MDcsNDk2LDQ4NSw0NzUsNDY1LDQ1NixcclxuICAgICAgNDQ2LDQzNyw0MjgsNDIwLDQxMiw0MDQsMzk2LDM4OCwzODEsMzc0LDM2NywzNjAsMzU0LDM0NywzNDEsMzM1LFxyXG4gICAgICAzMjksMzIzLDMxOCwzMTIsMzA3LDMwMiwyOTcsMjkyLDI4NywyODIsMjc4LDI3MywyNjksMjY1LDI2MSw1MTIsXHJcbiAgICAgIDUwNSw0OTcsNDg5LDQ4Miw0NzUsNDY4LDQ2MSw0NTQsNDQ3LDQ0MSw0MzUsNDI4LDQyMiw0MTcsNDExLDQwNSxcclxuICAgICAgMzk5LDM5NCwzODksMzgzLDM3OCwzNzMsMzY4LDM2NCwzNTksMzU0LDM1MCwzNDUsMzQxLDMzNywzMzIsMzI4LFxyXG4gICAgICAzMjQsMzIwLDMxNiwzMTIsMzA5LDMwNSwzMDEsMjk4LDI5NCwyOTEsMjg3LDI4NCwyODEsMjc4LDI3NCwyNzEsXHJcbiAgICAgIDI2OCwyNjUsMjYyLDI1OSwyNTcsNTA3LDUwMSw0OTYsNDkxLDQ4NSw0ODAsNDc1LDQ3MCw0NjUsNDYwLDQ1NixcclxuICAgICAgNDUxLDQ0Niw0NDIsNDM3LDQzMyw0MjgsNDI0LDQyMCw0MTYsNDEyLDQwOCw0MDQsNDAwLDM5NiwzOTIsMzg4LFxyXG4gICAgICAzODUsMzgxLDM3NywzNzQsMzcwLDM2NywzNjMsMzYwLDM1NywzNTQsMzUwLDM0NywzNDQsMzQxLDMzOCwzMzUsXHJcbiAgICAgIDMzMiwzMjksMzI2LDMyMywzMjAsMzE4LDMxNSwzMTIsMzEwLDMwNywzMDQsMzAyLDI5OSwyOTcsMjk0LDI5MixcclxuICAgICAgMjg5LDI4NywyODUsMjgyLDI4MCwyNzgsMjc1LDI3MywyNzEsMjY5LDI2NywyNjUsMjYzLDI2MSwyNTldO1xyXG5cclxuXHJcbiAgdmFyIHNoZ190YWJsZSA9IFtcclxuICAgICAgIDksIDExLCAxMiwgMTMsIDEzLCAxNCwgMTQsIDE1LCAxNSwgMTUsIDE1LCAxNiwgMTYsIDE2LCAxNiwgMTcsXHJcbiAgICAgIDE3LCAxNywgMTcsIDE3LCAxNywgMTcsIDE4LCAxOCwgMTgsIDE4LCAxOCwgMTgsIDE4LCAxOCwgMTgsIDE5LFxyXG4gICAgICAxOSwgMTksIDE5LCAxOSwgMTksIDE5LCAxOSwgMTksIDE5LCAxOSwgMTksIDE5LCAxOSwgMjAsIDIwLCAyMCxcclxuICAgICAgMjAsIDIwLCAyMCwgMjAsIDIwLCAyMCwgMjAsIDIwLCAyMCwgMjAsIDIwLCAyMCwgMjAsIDIwLCAyMCwgMjEsXHJcbiAgICAgIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLFxyXG4gICAgICAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjEsIDIxLCAyMSwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMixcclxuICAgICAgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsXHJcbiAgICAgIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIyLCAyMiwgMjIsIDIzLFxyXG4gICAgICAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMyxcclxuICAgICAgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsXHJcbiAgICAgIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLCAyMywgMjMsIDIzLFxyXG4gICAgICAyMywgMjMsIDIzLCAyMywgMjMsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCxcclxuICAgICAgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsXHJcbiAgICAgIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LFxyXG4gICAgICAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCxcclxuICAgICAgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCwgMjQsIDI0LCAyNCBdO1xyXG5cclxuICBmdW5jdGlvbiBwcmVtdWx0aXBseUFscGhhKGltYWdlRGF0YSlcclxuICB7XHJcbiAgICB2YXIgcGl4ZWxzID0gaW1hZ2VEYXRhLmRhdGE7XHJcbiAgICB2YXIgc2l6ZSA9IGltYWdlRGF0YS53aWR0aCAqIGltYWdlRGF0YS5oZWlnaHQgKiA0O1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxzaXplOyBpKz00KVxyXG4gICAge1xyXG4gICAgICB2YXIgYSA9IHBpeGVsc1tpKzNdIC8gMjU1O1xyXG4gICAgICBwaXhlbHNbaSAgXSAqPSBhO1xyXG4gICAgICBwaXhlbHNbaSsxXSAqPSBhO1xyXG4gICAgICBwaXhlbHNbaSsyXSAqPSBhO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gdW5wcmVtdWx0aXBseUFscGhhKGltYWdlRGF0YSlcclxuICB7XHJcbiAgICB2YXIgcGl4ZWxzID0gaW1hZ2VEYXRhLmRhdGE7XHJcbiAgICB2YXIgc2l6ZSA9IGltYWdlRGF0YS53aWR0aCAqIGltYWdlRGF0YS5oZWlnaHQgKiA0O1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxzaXplOyBpKz00KVxyXG4gICAge1xyXG4gICAgICB2YXIgYSA9IHBpeGVsc1tpKzNdO1xyXG4gICAgICBpZiAoYSAhPSAwKVxyXG4gICAgICB7XHJcbiAgICAgICAgYSA9IDI1NSAvIGE7XHJcbiAgICAgICAgcGl4ZWxzW2kgIF0gKj0gYTtcclxuICAgICAgICBwaXhlbHNbaSsxXSAqPSBhO1xyXG4gICAgICAgIHBpeGVsc1tpKzJdICo9IGE7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHN0YWNrQmx1ckltYWdlKCBpbWFnZUlELCBjYW52YXNJRCwgcmFkaXVzLCBibHVyQWxwaGFDaGFubmVsIClcclxuICB7XHJcblxyXG4gICAgdmFyIGltZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBpbWFnZUlEICk7XHJcbiAgICB2YXIgdyA9IGltZy5uYXR1cmFsV2lkdGg7XHJcbiAgICB2YXIgaCA9IGltZy5uYXR1cmFsSGVpZ2h0O1xyXG5cclxuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY2FudmFzSUQgKTtcclxuXHJcbiAgICBjYW52YXMuc3R5bGUud2lkdGggID0gdyArIFwicHhcIjtcclxuICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoICsgXCJweFwiO1xyXG4gICAgY2FudmFzLndpZHRoID0gdztcclxuICAgIGNhbnZhcy5oZWlnaHQgPSBoO1xyXG5cclxuICAgIHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgIGNvbnRleHQuY2xlYXJSZWN0KCAwLCAwLCB3LCBoICk7XHJcbiAgICBjb250ZXh0LmRyYXdJbWFnZSggaW1nLCAwLCAwICk7XHJcblxyXG4gICAgaWYgKCBpc05hTihyYWRpdXMpIHx8IHJhZGl1cyA8IDEgKSByZXR1cm47XHJcblxyXG4gICAgaWYgKCBibHVyQWxwaGFDaGFubmVsIClcclxuICAgICAgc3RhY2tCbHVyQ2FudmFzUkdCQSggY2FudmFzSUQsIDAsIDAsIHcsIGgsIHJhZGl1cyApO1xyXG4gICAgZWxzZVxyXG4gICAgICBzdGFja0JsdXJDYW52YXNSR0IoIGNhbnZhc0lELCAwLCAwLCB3LCBoLCByYWRpdXMgKTtcclxuICB9XHJcblxyXG5cclxuICBmdW5jdGlvbiBzdGFja0JsdXJDYW52YXNSR0JBKCBpZCwgdG9wX3gsIHRvcF95LCB3aWR0aCwgaGVpZ2h0LCByYWRpdXMgKVxyXG4gIHtcclxuICAgIGlmICggaXNOYU4ocmFkaXVzKSB8fCByYWRpdXMgPCAxICkgcmV0dXJuO1xyXG4gICAgcmFkaXVzIHw9IDA7XHJcblxyXG4gICAgdmFyIGNhbnZhcyAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggaWQgKTtcclxuICAgIHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgIHZhciBpbWFnZURhdGE7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgaW1hZ2VEYXRhID0gY29udGV4dC5nZXRJbWFnZURhdGEoIHRvcF94LCB0b3BfeSwgd2lkdGgsIGhlaWdodCApO1xyXG4gICAgICB9IGNhdGNoKGUpIHtcclxuXHJcbiAgICAgIC8vIE5PVEU6IHRoaXMgcGFydCBpcyBzdXBwb3NlZGx5IG9ubHkgbmVlZGVkIGlmIHlvdSB3YW50IHRvIHdvcmsgd2l0aCBsb2NhbCBmaWxlc1xyXG4gICAgICAvLyBzbyBpdCBtaWdodCBiZSBva2F5IHRvIHJlbW92ZSB0aGUgd2hvbGUgdHJ5L2NhdGNoIGJsb2NrIGFuZCBqdXN0IHVzZVxyXG4gICAgICAvLyBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSggdG9wX3gsIHRvcF95LCB3aWR0aCwgaGVpZ2h0ICk7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgbmV0c2NhcGUuc2VjdXJpdHkuUHJpdmlsZWdlTWFuYWdlci5lbmFibGVQcml2aWxlZ2UoXCJVbml2ZXJzYWxCcm93c2VyUmVhZFwiKTtcclxuICAgICAgICBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSggdG9wX3gsIHRvcF95LCB3aWR0aCwgaGVpZ2h0ICk7XHJcbiAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGFsZXJ0KFwiQ2Fubm90IGFjY2VzcyBsb2NhbCBpbWFnZVwiKTtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ1bmFibGUgdG8gYWNjZXNzIGxvY2FsIGltYWdlIGRhdGE6IFwiICsgZSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICBhbGVydChcIkNhbm5vdCBhY2Nlc3MgaW1hZ2VcIik7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInVuYWJsZSB0byBhY2Nlc3MgaW1hZ2UgZGF0YTogXCIgKyBlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmVtdWx0aXBseUFscGhhKGltYWdlRGF0YSk7XHJcblxyXG4gICAgdmFyIHBpeGVscyA9IGltYWdlRGF0YS5kYXRhO1xyXG5cclxuICAgIHZhciB4LCB5LCBpLCBwLCB5cCwgeWksIHl3LCByX3N1bSwgZ19zdW0sIGJfc3VtLCBhX3N1bSxcclxuICAgIHJfb3V0X3N1bSwgZ19vdXRfc3VtLCBiX291dF9zdW0sIGFfb3V0X3N1bSxcclxuICAgIHJfaW5fc3VtLCBnX2luX3N1bSwgYl9pbl9zdW0sIGFfaW5fc3VtLFxyXG4gICAgcHIsIHBnLCBwYiwgcGEsIHJicztcclxuXHJcbiAgICB2YXIgZGl2ID0gcmFkaXVzICsgcmFkaXVzICsgMTtcclxuICAgIHZhciB3NCA9IHdpZHRoIDw8IDI7XHJcbiAgICB2YXIgd2lkdGhNaW51czEgID0gd2lkdGggLSAxO1xyXG4gICAgdmFyIGhlaWdodE1pbnVzMSA9IGhlaWdodCAtIDE7XHJcbiAgICB2YXIgcmFkaXVzUGx1czEgID0gcmFkaXVzICsgMTtcclxuICAgIHZhciBzdW1GYWN0b3IgPSByYWRpdXNQbHVzMSAqICggcmFkaXVzUGx1czEgKyAxICkgLyAyO1xyXG5cclxuICAgIHZhciBzdGFja1N0YXJ0ID0gbmV3IEJsdXJTdGFjaygpO1xyXG4gICAgdmFyIHN0YWNrID0gc3RhY2tTdGFydDtcclxuICAgIGZvciAoIGkgPSAxOyBpIDwgZGl2OyBpKysgKVxyXG4gICAge1xyXG4gICAgICBzdGFjayA9IHN0YWNrLm5leHQgPSBuZXcgQmx1clN0YWNrKCk7XHJcbiAgICAgIGlmICggaSA9PSByYWRpdXNQbHVzMSApIHZhciBzdGFja0VuZCA9IHN0YWNrO1xyXG4gICAgfVxyXG4gICAgc3RhY2submV4dCA9IHN0YWNrU3RhcnQ7XHJcbiAgICB2YXIgc3RhY2tJbiA9IG51bGw7XHJcbiAgICB2YXIgc3RhY2tPdXQgPSBudWxsO1xyXG5cclxuICAgIHl3ID0geWkgPSAwO1xyXG5cclxuICAgIHZhciBtdWxfc3VtID0gbXVsX3RhYmxlW3JhZGl1c107XHJcbiAgICB2YXIgc2hnX3N1bSA9IHNoZ190YWJsZVtyYWRpdXNdO1xyXG5cclxuICAgIGZvciAoIHkgPSAwOyB5IDwgaGVpZ2h0OyB5KysgKVxyXG4gICAge1xyXG4gICAgICByX2luX3N1bSA9IGdfaW5fc3VtID0gYl9pbl9zdW0gPSBhX2luX3N1bSA9IHJfc3VtID0gZ19zdW0gPSBiX3N1bSA9IGFfc3VtID0gMDtcclxuXHJcbiAgICAgIHJfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwciA9IHBpeGVsc1t5aV0gKTtcclxuICAgICAgZ19vdXRfc3VtID0gcmFkaXVzUGx1czEgKiAoIHBnID0gcGl4ZWxzW3lpKzFdICk7XHJcbiAgICAgIGJfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwYiA9IHBpeGVsc1t5aSsyXSApO1xyXG4gICAgICBhX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcGEgPSBwaXhlbHNbeWkrM10gKTtcclxuXHJcbiAgICAgIHJfc3VtICs9IHN1bUZhY3RvciAqIHByO1xyXG4gICAgICBnX3N1bSArPSBzdW1GYWN0b3IgKiBwZztcclxuICAgICAgYl9zdW0gKz0gc3VtRmFjdG9yICogcGI7XHJcbiAgICAgIGFfc3VtICs9IHN1bUZhY3RvciAqIHBhO1xyXG5cclxuICAgICAgc3RhY2sgPSBzdGFja1N0YXJ0O1xyXG5cclxuICAgICAgZm9yKCBpID0gMDsgaSA8IHJhZGl1c1BsdXMxOyBpKysgKVxyXG4gICAgICB7XHJcbiAgICAgICAgc3RhY2suciA9IHByO1xyXG4gICAgICAgIHN0YWNrLmcgPSBwZztcclxuICAgICAgICBzdGFjay5iID0gcGI7XHJcbiAgICAgICAgc3RhY2suYSA9IHBhO1xyXG4gICAgICAgIHN0YWNrID0gc3RhY2submV4dDtcclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yKCBpID0gMTsgaSA8IHJhZGl1c1BsdXMxOyBpKysgKVxyXG4gICAgICB7XHJcbiAgICAgICAgcCA9IHlpICsgKCggd2lkdGhNaW51czEgPCBpID8gd2lkdGhNaW51czEgOiBpICkgPDwgMiApO1xyXG4gICAgICAgIHJfc3VtICs9ICggc3RhY2suciA9ICggcHIgPSBwaXhlbHNbcF0pKSAqICggcmJzID0gcmFkaXVzUGx1czEgLSBpICk7XHJcbiAgICAgICAgZ19zdW0gKz0gKCBzdGFjay5nID0gKCBwZyA9IHBpeGVsc1twKzFdKSkgKiByYnM7XHJcbiAgICAgICAgYl9zdW0gKz0gKCBzdGFjay5iID0gKCBwYiA9IHBpeGVsc1twKzJdKSkgKiByYnM7XHJcbiAgICAgICAgYV9zdW0gKz0gKCBzdGFjay5hID0gKCBwYSA9IHBpeGVsc1twKzNdKSkgKiByYnM7XHJcblxyXG4gICAgICAgIHJfaW5fc3VtICs9IHByO1xyXG4gICAgICAgIGdfaW5fc3VtICs9IHBnO1xyXG4gICAgICAgIGJfaW5fc3VtICs9IHBiO1xyXG4gICAgICAgIGFfaW5fc3VtICs9IHBhO1xyXG5cclxuICAgICAgICBzdGFjayA9IHN0YWNrLm5leHQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHN0YWNrSW4gPSBzdGFja1N0YXJ0O1xyXG4gICAgICBzdGFja091dCA9IHN0YWNrRW5kO1xyXG4gICAgICBmb3IgKCB4ID0gMDsgeCA8IHdpZHRoOyB4KysgKVxyXG4gICAgICB7XHJcbiAgICAgICAgcGl4ZWxzW3lpXSAgID0gKHJfc3VtICogbXVsX3N1bSkgPj4gc2hnX3N1bTtcclxuICAgICAgICBwaXhlbHNbeWkrMV0gPSAoZ19zdW0gKiBtdWxfc3VtKSA+PiBzaGdfc3VtO1xyXG4gICAgICAgIHBpeGVsc1t5aSsyXSA9IChiX3N1bSAqIG11bF9zdW0pID4+IHNoZ19zdW07XHJcbiAgICAgICAgcGl4ZWxzW3lpKzNdID0gKGFfc3VtICogbXVsX3N1bSkgPj4gc2hnX3N1bTtcclxuXHJcbiAgICAgICAgcl9zdW0gLT0gcl9vdXRfc3VtO1xyXG4gICAgICAgIGdfc3VtIC09IGdfb3V0X3N1bTtcclxuICAgICAgICBiX3N1bSAtPSBiX291dF9zdW07XHJcbiAgICAgICAgYV9zdW0gLT0gYV9vdXRfc3VtO1xyXG5cclxuICAgICAgICByX291dF9zdW0gLT0gc3RhY2tJbi5yO1xyXG4gICAgICAgIGdfb3V0X3N1bSAtPSBzdGFja0luLmc7XHJcbiAgICAgICAgYl9vdXRfc3VtIC09IHN0YWNrSW4uYjtcclxuICAgICAgICBhX291dF9zdW0gLT0gc3RhY2tJbi5hO1xyXG5cclxuICAgICAgICBwID0gICggeXcgKyAoICggcCA9IHggKyByYWRpdXMgKyAxICkgPCB3aWR0aE1pbnVzMSA/IHAgOiB3aWR0aE1pbnVzMSApICkgPDwgMjtcclxuXHJcbiAgICAgICAgcl9pbl9zdW0gKz0gKCBzdGFja0luLnIgPSBwaXhlbHNbcF0pO1xyXG4gICAgICAgIGdfaW5fc3VtICs9ICggc3RhY2tJbi5nID0gcGl4ZWxzW3ArMV0pO1xyXG4gICAgICAgIGJfaW5fc3VtICs9ICggc3RhY2tJbi5iID0gcGl4ZWxzW3ArMl0pO1xyXG4gICAgICAgIGFfaW5fc3VtICs9ICggc3RhY2tJbi5hID0gcGl4ZWxzW3ArM10pO1xyXG5cclxuICAgICAgICByX3N1bSArPSByX2luX3N1bTtcclxuICAgICAgICBnX3N1bSArPSBnX2luX3N1bTtcclxuICAgICAgICBiX3N1bSArPSBiX2luX3N1bTtcclxuICAgICAgICBhX3N1bSArPSBhX2luX3N1bTtcclxuXHJcbiAgICAgICAgc3RhY2tJbiA9IHN0YWNrSW4ubmV4dDtcclxuXHJcbiAgICAgICAgcl9vdXRfc3VtICs9ICggcHIgPSBzdGFja091dC5yICk7XHJcbiAgICAgICAgZ19vdXRfc3VtICs9ICggcGcgPSBzdGFja091dC5nICk7XHJcbiAgICAgICAgYl9vdXRfc3VtICs9ICggcGIgPSBzdGFja091dC5iICk7XHJcbiAgICAgICAgYV9vdXRfc3VtICs9ICggcGEgPSBzdGFja091dC5hICk7XHJcblxyXG4gICAgICAgIHJfaW5fc3VtIC09IHByO1xyXG4gICAgICAgIGdfaW5fc3VtIC09IHBnO1xyXG4gICAgICAgIGJfaW5fc3VtIC09IHBiO1xyXG4gICAgICAgIGFfaW5fc3VtIC09IHBhO1xyXG5cclxuICAgICAgICBzdGFja091dCA9IHN0YWNrT3V0Lm5leHQ7XHJcblxyXG4gICAgICAgIHlpICs9IDQ7XHJcbiAgICAgIH1cclxuICAgICAgeXcgKz0gd2lkdGg7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGZvciAoIHggPSAwOyB4IDwgd2lkdGg7IHgrKyApXHJcbiAgICB7XHJcbiAgICAgIGdfaW5fc3VtID0gYl9pbl9zdW0gPSBhX2luX3N1bSA9IHJfaW5fc3VtID0gZ19zdW0gPSBiX3N1bSA9IGFfc3VtID0gcl9zdW0gPSAwO1xyXG5cclxuICAgICAgeWkgPSB4IDw8IDI7XHJcbiAgICAgIHJfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwciA9IHBpeGVsc1t5aV0pO1xyXG4gICAgICBnX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcGcgPSBwaXhlbHNbeWkrMV0pO1xyXG4gICAgICBiX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcGIgPSBwaXhlbHNbeWkrMl0pO1xyXG4gICAgICBhX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcGEgPSBwaXhlbHNbeWkrM10pO1xyXG5cclxuICAgICAgcl9zdW0gKz0gc3VtRmFjdG9yICogcHI7XHJcbiAgICAgIGdfc3VtICs9IHN1bUZhY3RvciAqIHBnO1xyXG4gICAgICBiX3N1bSArPSBzdW1GYWN0b3IgKiBwYjtcclxuICAgICAgYV9zdW0gKz0gc3VtRmFjdG9yICogcGE7XHJcblxyXG4gICAgICBzdGFjayA9IHN0YWNrU3RhcnQ7XHJcblxyXG4gICAgICBmb3IoIGkgPSAwOyBpIDwgcmFkaXVzUGx1czE7IGkrKyApXHJcbiAgICAgIHtcclxuICAgICAgICBzdGFjay5yID0gcHI7XHJcbiAgICAgICAgc3RhY2suZyA9IHBnO1xyXG4gICAgICAgIHN0YWNrLmIgPSBwYjtcclxuICAgICAgICBzdGFjay5hID0gcGE7XHJcbiAgICAgICAgc3RhY2sgPSBzdGFjay5uZXh0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICB5cCA9IHdpZHRoO1xyXG5cclxuICAgICAgZm9yKCBpID0gMTsgaSA8PSByYWRpdXM7IGkrKyApXHJcbiAgICAgIHtcclxuICAgICAgICB5aSA9ICggeXAgKyB4ICkgPDwgMjtcclxuXHJcbiAgICAgICAgcl9zdW0gKz0gKCBzdGFjay5yID0gKCBwciA9IHBpeGVsc1t5aV0pKSAqICggcmJzID0gcmFkaXVzUGx1czEgLSBpICk7XHJcbiAgICAgICAgZ19zdW0gKz0gKCBzdGFjay5nID0gKCBwZyA9IHBpeGVsc1t5aSsxXSkpICogcmJzO1xyXG4gICAgICAgIGJfc3VtICs9ICggc3RhY2suYiA9ICggcGIgPSBwaXhlbHNbeWkrMl0pKSAqIHJicztcclxuICAgICAgICBhX3N1bSArPSAoIHN0YWNrLmEgPSAoIHBhID0gcGl4ZWxzW3lpKzNdKSkgKiByYnM7XHJcblxyXG4gICAgICAgIHJfaW5fc3VtICs9IHByO1xyXG4gICAgICAgIGdfaW5fc3VtICs9IHBnO1xyXG4gICAgICAgIGJfaW5fc3VtICs9IHBiO1xyXG4gICAgICAgIGFfaW5fc3VtICs9IHBhO1xyXG5cclxuICAgICAgICBzdGFjayA9IHN0YWNrLm5leHQ7XHJcblxyXG4gICAgICAgIGlmKCBpIDwgaGVpZ2h0TWludXMxIClcclxuICAgICAgICB7XHJcbiAgICAgICAgICB5cCArPSB3aWR0aDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHlpID0geDtcclxuICAgICAgc3RhY2tJbiA9IHN0YWNrU3RhcnQ7XHJcbiAgICAgIHN0YWNrT3V0ID0gc3RhY2tFbmQ7XHJcbiAgICAgIGZvciAoIHkgPSAwOyB5IDwgaGVpZ2h0OyB5KysgKVxyXG4gICAgICB7XHJcbiAgICAgICAgcCA9IHlpIDw8IDI7XHJcbiAgICAgICAgcGl4ZWxzW3BdICAgPSAocl9zdW0gKiBtdWxfc3VtKSA+PiBzaGdfc3VtO1xyXG4gICAgICAgIHBpeGVsc1twKzFdID0gKGdfc3VtICogbXVsX3N1bSkgPj4gc2hnX3N1bTtcclxuICAgICAgICBwaXhlbHNbcCsyXSA9IChiX3N1bSAqIG11bF9zdW0pID4+IHNoZ19zdW07XHJcbiAgICAgICAgcGl4ZWxzW3ArM10gPSAoYV9zdW0gKiBtdWxfc3VtKSA+PiBzaGdfc3VtO1xyXG5cclxuICAgICAgICByX3N1bSAtPSByX291dF9zdW07XHJcbiAgICAgICAgZ19zdW0gLT0gZ19vdXRfc3VtO1xyXG4gICAgICAgIGJfc3VtIC09IGJfb3V0X3N1bTtcclxuICAgICAgICBhX3N1bSAtPSBhX291dF9zdW07XHJcblxyXG4gICAgICAgIHJfb3V0X3N1bSAtPSBzdGFja0luLnI7XHJcbiAgICAgICAgZ19vdXRfc3VtIC09IHN0YWNrSW4uZztcclxuICAgICAgICBiX291dF9zdW0gLT0gc3RhY2tJbi5iO1xyXG4gICAgICAgIGFfb3V0X3N1bSAtPSBzdGFja0luLmE7XHJcblxyXG4gICAgICAgIHAgPSAoIHggKyAoKCAoIHAgPSB5ICsgcmFkaXVzUGx1czEpIDwgaGVpZ2h0TWludXMxID8gcCA6IGhlaWdodE1pbnVzMSApICogd2lkdGggKSkgPDwgMjtcclxuXHJcbiAgICAgICAgcl9zdW0gKz0gKCByX2luX3N1bSArPSAoIHN0YWNrSW4uciA9IHBpeGVsc1twXSkpO1xyXG4gICAgICAgIGdfc3VtICs9ICggZ19pbl9zdW0gKz0gKCBzdGFja0luLmcgPSBwaXhlbHNbcCsxXSkpO1xyXG4gICAgICAgIGJfc3VtICs9ICggYl9pbl9zdW0gKz0gKCBzdGFja0luLmIgPSBwaXhlbHNbcCsyXSkpO1xyXG4gICAgICAgIGFfc3VtICs9ICggYV9pbl9zdW0gKz0gKCBzdGFja0luLmEgPSBwaXhlbHNbcCszXSkpO1xyXG5cclxuICAgICAgICBzdGFja0luID0gc3RhY2tJbi5uZXh0O1xyXG5cclxuICAgICAgICByX291dF9zdW0gKz0gKCBwciA9IHN0YWNrT3V0LnIgKTtcclxuICAgICAgICBnX291dF9zdW0gKz0gKCBwZyA9IHN0YWNrT3V0LmcgKTtcclxuICAgICAgICBiX291dF9zdW0gKz0gKCBwYiA9IHN0YWNrT3V0LmIgKTtcclxuICAgICAgICBhX291dF9zdW0gKz0gKCBwYSA9IHN0YWNrT3V0LmEgKTtcclxuXHJcbiAgICAgICAgcl9pbl9zdW0gLT0gcHI7XHJcbiAgICAgICAgZ19pbl9zdW0gLT0gcGc7XHJcbiAgICAgICAgYl9pbl9zdW0gLT0gcGI7XHJcbiAgICAgICAgYV9pbl9zdW0gLT0gcGE7XHJcblxyXG4gICAgICAgIHN0YWNrT3V0ID0gc3RhY2tPdXQubmV4dDtcclxuXHJcbiAgICAgICAgeWkgKz0gd2lkdGg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB1bnByZW11bHRpcGx5QWxwaGEoaW1hZ2VEYXRhKTtcclxuXHJcbiAgICBjb250ZXh0LnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCB0b3BfeCwgdG9wX3kgKTtcclxuICB9XHJcblxyXG5cclxuICBmdW5jdGlvbiBzdGFja0JsdXJDYW52YXNSR0IoIGlkLCB0b3BfeCwgdG9wX3ksIHdpZHRoLCBoZWlnaHQsIHJhZGl1cyApXHJcbiAge1xyXG4gICAgaWYgKCBpc05hTihyYWRpdXMpIHx8IHJhZGl1cyA8IDEgKSByZXR1cm47XHJcbiAgICByYWRpdXMgfD0gMDtcclxuXHJcbiAgICB2YXIgY2FudmFzICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBpZCApO1xyXG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgdmFyIGltYWdlRGF0YTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSggdG9wX3gsIHRvcF95LCB3aWR0aCwgaGVpZ2h0ICk7XHJcbiAgICAgIH0gY2F0Y2goZSkge1xyXG5cclxuICAgICAgLy8gTk9URTogdGhpcyBwYXJ0IGlzIHN1cHBvc2VkbHkgb25seSBuZWVkZWQgaWYgeW91IHdhbnQgdG8gd29yayB3aXRoIGxvY2FsIGZpbGVzXHJcbiAgICAgIC8vIHNvIGl0IG1pZ2h0IGJlIG9rYXkgdG8gcmVtb3ZlIHRoZSB3aG9sZSB0cnkvY2F0Y2ggYmxvY2sgYW5kIGp1c3QgdXNlXHJcbiAgICAgIC8vIGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKCB0b3BfeCwgdG9wX3ksIHdpZHRoLCBoZWlnaHQgKTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBuZXRzY2FwZS5zZWN1cml0eS5Qcml2aWxlZ2VNYW5hZ2VyLmVuYWJsZVByaXZpbGVnZShcIlVuaXZlcnNhbEJyb3dzZXJSZWFkXCIpO1xyXG4gICAgICAgIGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKCB0b3BfeCwgdG9wX3ksIHdpZHRoLCBoZWlnaHQgKTtcclxuICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgYWxlcnQoXCJDYW5ub3QgYWNjZXNzIGxvY2FsIGltYWdlXCIpO1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuYWJsZSB0byBhY2Nlc3MgbG9jYWwgaW1hZ2UgZGF0YTogXCIgKyBlKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBjYXRjaChlKSB7XHJcbiAgICAgIGFsZXJ0KFwiQ2Fubm90IGFjY2VzcyBpbWFnZVwiKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwidW5hYmxlIHRvIGFjY2VzcyBpbWFnZSBkYXRhOiBcIiArIGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwaXhlbHMgPSBpbWFnZURhdGEuZGF0YTtcclxuXHJcbiAgICB2YXIgeCwgeSwgaSwgcCwgeXAsIHlpLCB5dywgcl9zdW0sIGdfc3VtLCBiX3N1bSxcclxuICAgIHJfb3V0X3N1bSwgZ19vdXRfc3VtLCBiX291dF9zdW0sXHJcbiAgICByX2luX3N1bSwgZ19pbl9zdW0sIGJfaW5fc3VtLFxyXG4gICAgcHIsIHBnLCBwYiwgcmJzO1xyXG5cclxuICAgIHZhciBkaXYgPSByYWRpdXMgKyByYWRpdXMgKyAxO1xyXG4gICAgdmFyIHc0ID0gd2lkdGggPDwgMjtcclxuICAgIHZhciB3aWR0aE1pbnVzMSAgPSB3aWR0aCAtIDE7XHJcbiAgICB2YXIgaGVpZ2h0TWludXMxID0gaGVpZ2h0IC0gMTtcclxuICAgIHZhciByYWRpdXNQbHVzMSAgPSByYWRpdXMgKyAxO1xyXG4gICAgdmFyIHN1bUZhY3RvciA9IHJhZGl1c1BsdXMxICogKCByYWRpdXNQbHVzMSArIDEgKSAvIDI7XHJcblxyXG4gICAgdmFyIHN0YWNrU3RhcnQgPSBuZXcgQmx1clN0YWNrKCk7XHJcbiAgICB2YXIgc3RhY2sgPSBzdGFja1N0YXJ0O1xyXG4gICAgZm9yICggaSA9IDE7IGkgPCBkaXY7IGkrKyApXHJcbiAgICB7XHJcbiAgICAgIHN0YWNrID0gc3RhY2submV4dCA9IG5ldyBCbHVyU3RhY2soKTtcclxuICAgICAgaWYgKCBpID09IHJhZGl1c1BsdXMxICkgdmFyIHN0YWNrRW5kID0gc3RhY2s7XHJcbiAgICB9XHJcbiAgICBzdGFjay5uZXh0ID0gc3RhY2tTdGFydDtcclxuICAgIHZhciBzdGFja0luID0gbnVsbDtcclxuICAgIHZhciBzdGFja091dCA9IG51bGw7XHJcblxyXG4gICAgeXcgPSB5aSA9IDA7XHJcblxyXG4gICAgdmFyIG11bF9zdW0gPSBtdWxfdGFibGVbcmFkaXVzXTtcclxuICAgIHZhciBzaGdfc3VtID0gc2hnX3RhYmxlW3JhZGl1c107XHJcblxyXG4gICAgZm9yICggeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKyApXHJcbiAgICB7XHJcbiAgICAgIHJfaW5fc3VtID0gZ19pbl9zdW0gPSBiX2luX3N1bSA9IHJfc3VtID0gZ19zdW0gPSBiX3N1bSA9IDA7XHJcblxyXG4gICAgICByX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcHIgPSBwaXhlbHNbeWldICk7XHJcbiAgICAgIGdfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwZyA9IHBpeGVsc1t5aSsxXSApO1xyXG4gICAgICBiX291dF9zdW0gPSByYWRpdXNQbHVzMSAqICggcGIgPSBwaXhlbHNbeWkrMl0gKTtcclxuXHJcbiAgICAgIHJfc3VtICs9IHN1bUZhY3RvciAqIHByO1xyXG4gICAgICBnX3N1bSArPSBzdW1GYWN0b3IgKiBwZztcclxuICAgICAgYl9zdW0gKz0gc3VtRmFjdG9yICogcGI7XHJcblxyXG4gICAgICBzdGFjayA9IHN0YWNrU3RhcnQ7XHJcblxyXG4gICAgICBmb3IoIGkgPSAwOyBpIDwgcmFkaXVzUGx1czE7IGkrKyApXHJcbiAgICAgIHtcclxuICAgICAgICBzdGFjay5yID0gcHI7XHJcbiAgICAgICAgc3RhY2suZyA9IHBnO1xyXG4gICAgICAgIHN0YWNrLmIgPSBwYjtcclxuICAgICAgICBzdGFjayA9IHN0YWNrLm5leHQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciggaSA9IDE7IGkgPCByYWRpdXNQbHVzMTsgaSsrIClcclxuICAgICAge1xyXG4gICAgICAgIHAgPSB5aSArICgoIHdpZHRoTWludXMxIDwgaSA/IHdpZHRoTWludXMxIDogaSApIDw8IDIgKTtcclxuICAgICAgICByX3N1bSArPSAoIHN0YWNrLnIgPSAoIHByID0gcGl4ZWxzW3BdKSkgKiAoIHJicyA9IHJhZGl1c1BsdXMxIC0gaSApO1xyXG4gICAgICAgIGdfc3VtICs9ICggc3RhY2suZyA9ICggcGcgPSBwaXhlbHNbcCsxXSkpICogcmJzO1xyXG4gICAgICAgIGJfc3VtICs9ICggc3RhY2suYiA9ICggcGIgPSBwaXhlbHNbcCsyXSkpICogcmJzO1xyXG5cclxuICAgICAgICByX2luX3N1bSArPSBwcjtcclxuICAgICAgICBnX2luX3N1bSArPSBwZztcclxuICAgICAgICBiX2luX3N1bSArPSBwYjtcclxuXHJcbiAgICAgICAgc3RhY2sgPSBzdGFjay5uZXh0O1xyXG4gICAgICB9XHJcblxyXG5cclxuICAgICAgc3RhY2tJbiA9IHN0YWNrU3RhcnQ7XHJcbiAgICAgIHN0YWNrT3V0ID0gc3RhY2tFbmQ7XHJcbiAgICAgIGZvciAoIHggPSAwOyB4IDwgd2lkdGg7IHgrKyApXHJcbiAgICAgIHtcclxuICAgICAgICBwaXhlbHNbeWldICAgPSAocl9zdW0gKiBtdWxfc3VtKSA+PiBzaGdfc3VtO1xyXG4gICAgICAgIHBpeGVsc1t5aSsxXSA9IChnX3N1bSAqIG11bF9zdW0pID4+IHNoZ19zdW07XHJcbiAgICAgICAgcGl4ZWxzW3lpKzJdID0gKGJfc3VtICogbXVsX3N1bSkgPj4gc2hnX3N1bTtcclxuXHJcbiAgICAgICAgcl9zdW0gLT0gcl9vdXRfc3VtO1xyXG4gICAgICAgIGdfc3VtIC09IGdfb3V0X3N1bTtcclxuICAgICAgICBiX3N1bSAtPSBiX291dF9zdW07XHJcblxyXG4gICAgICAgIHJfb3V0X3N1bSAtPSBzdGFja0luLnI7XHJcbiAgICAgICAgZ19vdXRfc3VtIC09IHN0YWNrSW4uZztcclxuICAgICAgICBiX291dF9zdW0gLT0gc3RhY2tJbi5iO1xyXG5cclxuICAgICAgICBwID0gICggeXcgKyAoICggcCA9IHggKyByYWRpdXMgKyAxICkgPCB3aWR0aE1pbnVzMSA/IHAgOiB3aWR0aE1pbnVzMSApICkgPDwgMjtcclxuXHJcbiAgICAgICAgcl9pbl9zdW0gKz0gKCBzdGFja0luLnIgPSBwaXhlbHNbcF0pO1xyXG4gICAgICAgIGdfaW5fc3VtICs9ICggc3RhY2tJbi5nID0gcGl4ZWxzW3ArMV0pO1xyXG4gICAgICAgIGJfaW5fc3VtICs9ICggc3RhY2tJbi5iID0gcGl4ZWxzW3ArMl0pO1xyXG5cclxuICAgICAgICByX3N1bSArPSByX2luX3N1bTtcclxuICAgICAgICBnX3N1bSArPSBnX2luX3N1bTtcclxuICAgICAgICBiX3N1bSArPSBiX2luX3N1bTtcclxuXHJcbiAgICAgICAgc3RhY2tJbiA9IHN0YWNrSW4ubmV4dDtcclxuXHJcbiAgICAgICAgcl9vdXRfc3VtICs9ICggcHIgPSBzdGFja091dC5yICk7XHJcbiAgICAgICAgZ19vdXRfc3VtICs9ICggcGcgPSBzdGFja091dC5nICk7XHJcbiAgICAgICAgYl9vdXRfc3VtICs9ICggcGIgPSBzdGFja091dC5iICk7XHJcblxyXG4gICAgICAgIHJfaW5fc3VtIC09IHByO1xyXG4gICAgICAgIGdfaW5fc3VtIC09IHBnO1xyXG4gICAgICAgIGJfaW5fc3VtIC09IHBiO1xyXG5cclxuICAgICAgICBzdGFja091dCA9IHN0YWNrT3V0Lm5leHQ7XHJcblxyXG4gICAgICAgIHlpICs9IDQ7XHJcbiAgICAgIH1cclxuICAgICAgeXcgKz0gd2lkdGg7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGZvciAoIHggPSAwOyB4IDwgd2lkdGg7IHgrKyApXHJcbiAgICB7XHJcbiAgICAgIGdfaW5fc3VtID0gYl9pbl9zdW0gPSByX2luX3N1bSA9IGdfc3VtID0gYl9zdW0gPSByX3N1bSA9IDA7XHJcblxyXG4gICAgICB5aSA9IHggPDwgMjtcclxuICAgICAgcl9vdXRfc3VtID0gcmFkaXVzUGx1czEgKiAoIHByID0gcGl4ZWxzW3lpXSk7XHJcbiAgICAgIGdfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwZyA9IHBpeGVsc1t5aSsxXSk7XHJcbiAgICAgIGJfb3V0X3N1bSA9IHJhZGl1c1BsdXMxICogKCBwYiA9IHBpeGVsc1t5aSsyXSk7XHJcblxyXG4gICAgICByX3N1bSArPSBzdW1GYWN0b3IgKiBwcjtcclxuICAgICAgZ19zdW0gKz0gc3VtRmFjdG9yICogcGc7XHJcbiAgICAgIGJfc3VtICs9IHN1bUZhY3RvciAqIHBiO1xyXG5cclxuICAgICAgc3RhY2sgPSBzdGFja1N0YXJ0O1xyXG5cclxuICAgICAgZm9yKCBpID0gMDsgaSA8IHJhZGl1c1BsdXMxOyBpKysgKVxyXG4gICAgICB7XHJcbiAgICAgICAgc3RhY2suciA9IHByO1xyXG4gICAgICAgIHN0YWNrLmcgPSBwZztcclxuICAgICAgICBzdGFjay5iID0gcGI7XHJcbiAgICAgICAgc3RhY2sgPSBzdGFjay5uZXh0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICB5cCA9IHdpZHRoO1xyXG5cclxuICAgICAgZm9yKCBpID0gMTsgaSA8PSByYWRpdXM7IGkrKyApXHJcbiAgICAgIHtcclxuICAgICAgICB5aSA9ICggeXAgKyB4ICkgPDwgMjtcclxuXHJcbiAgICAgICAgcl9zdW0gKz0gKCBzdGFjay5yID0gKCBwciA9IHBpeGVsc1t5aV0pKSAqICggcmJzID0gcmFkaXVzUGx1czEgLSBpICk7XHJcbiAgICAgICAgZ19zdW0gKz0gKCBzdGFjay5nID0gKCBwZyA9IHBpeGVsc1t5aSsxXSkpICogcmJzO1xyXG4gICAgICAgIGJfc3VtICs9ICggc3RhY2suYiA9ICggcGIgPSBwaXhlbHNbeWkrMl0pKSAqIHJicztcclxuXHJcbiAgICAgICAgcl9pbl9zdW0gKz0gcHI7XHJcbiAgICAgICAgZ19pbl9zdW0gKz0gcGc7XHJcbiAgICAgICAgYl9pbl9zdW0gKz0gcGI7XHJcblxyXG4gICAgICAgIHN0YWNrID0gc3RhY2submV4dDtcclxuXHJcbiAgICAgICAgaWYoIGkgPCBoZWlnaHRNaW51czEgKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgIHlwICs9IHdpZHRoO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgeWkgPSB4O1xyXG4gICAgICBzdGFja0luID0gc3RhY2tTdGFydDtcclxuICAgICAgc3RhY2tPdXQgPSBzdGFja0VuZDtcclxuICAgICAgZm9yICggeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKyApXHJcbiAgICAgIHtcclxuICAgICAgICBwID0geWkgPDwgMjtcclxuICAgICAgICBwaXhlbHNbcF0gICA9IChyX3N1bSAqIG11bF9zdW0pID4+IHNoZ19zdW07XHJcbiAgICAgICAgcGl4ZWxzW3ArMV0gPSAoZ19zdW0gKiBtdWxfc3VtKSA+PiBzaGdfc3VtO1xyXG4gICAgICAgIHBpeGVsc1twKzJdID0gKGJfc3VtICogbXVsX3N1bSkgPj4gc2hnX3N1bTtcclxuXHJcbiAgICAgICAgcl9zdW0gLT0gcl9vdXRfc3VtO1xyXG4gICAgICAgIGdfc3VtIC09IGdfb3V0X3N1bTtcclxuICAgICAgICBiX3N1bSAtPSBiX291dF9zdW07XHJcblxyXG4gICAgICAgIHJfb3V0X3N1bSAtPSBzdGFja0luLnI7XHJcbiAgICAgICAgZ19vdXRfc3VtIC09IHN0YWNrSW4uZztcclxuICAgICAgICBiX291dF9zdW0gLT0gc3RhY2tJbi5iO1xyXG5cclxuICAgICAgICBwID0gKCB4ICsgKCggKCBwID0geSArIHJhZGl1c1BsdXMxKSA8IGhlaWdodE1pbnVzMSA/IHAgOiBoZWlnaHRNaW51czEgKSAqIHdpZHRoICkpIDw8IDI7XHJcblxyXG4gICAgICAgIHJfc3VtICs9ICggcl9pbl9zdW0gKz0gKCBzdGFja0luLnIgPSBwaXhlbHNbcF0pKTtcclxuICAgICAgICBnX3N1bSArPSAoIGdfaW5fc3VtICs9ICggc3RhY2tJbi5nID0gcGl4ZWxzW3ArMV0pKTtcclxuICAgICAgICBiX3N1bSArPSAoIGJfaW5fc3VtICs9ICggc3RhY2tJbi5iID0gcGl4ZWxzW3ArMl0pKTtcclxuXHJcbiAgICAgICAgc3RhY2tJbiA9IHN0YWNrSW4ubmV4dDtcclxuXHJcbiAgICAgICAgcl9vdXRfc3VtICs9ICggcHIgPSBzdGFja091dC5yICk7XHJcbiAgICAgICAgZ19vdXRfc3VtICs9ICggcGcgPSBzdGFja091dC5nICk7XHJcbiAgICAgICAgYl9vdXRfc3VtICs9ICggcGIgPSBzdGFja091dC5iICk7XHJcblxyXG4gICAgICAgIHJfaW5fc3VtIC09IHByO1xyXG4gICAgICAgIGdfaW5fc3VtIC09IHBnO1xyXG4gICAgICAgIGJfaW5fc3VtIC09IHBiO1xyXG5cclxuICAgICAgICBzdGFja091dCA9IHN0YWNrT3V0Lm5leHQ7XHJcblxyXG4gICAgICAgIHlpICs9IHdpZHRoO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29udGV4dC5wdXRJbWFnZURhdGEoIGltYWdlRGF0YSwgdG9wX3gsIHRvcF95ICk7XHJcblxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gQmx1clN0YWNrKClcclxuICB7XHJcbiAgICB0aGlzLnIgPSAwO1xyXG4gICAgdGhpcy5nID0gMDtcclxuICAgIHRoaXMuYiA9IDA7XHJcbiAgICB0aGlzLmEgPSAwO1xyXG4gICAgdGhpcy5uZXh0ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIHZhciBzdGFja0JsdXIgPSB7XHJcbiAgICBpbWFnZTogc3RhY2tCbHVySW1hZ2UsXHJcbiAgICBjYW52YXNSR0JBOiBzdGFja0JsdXJDYW52YXNSR0JBLFxyXG4gICAgY2FudmFzUkdCOiBzdGFja0JsdXJDYW52YXNSR0JcclxuICB9O1xyXG5cclxuICAvLyBleHBvcnQgYXMgQU1ELi4uXHJcbiAgaWYgKCB0eXBlb2YgZGVmaW5lICE9PSAndW5kZWZpbmVkJyAmJiBkZWZpbmUuYW1kICkge1xyXG4gICAgICBkZWZpbmUoIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHN0YWNrQmx1cjsgfSk7XHJcbiAgfVxyXG5cclxuICAvLyAuLi5vciBhcyBicm93c2VyaWZ5XHJcbiAgZWxzZSBpZiAoIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzICkge1xyXG4gICAgICBtb2R1bGUuZXhwb3J0cyA9IHN0YWNrQmx1cjtcclxuICB9XHJcblxyXG4gIGdsb2JhbC5zdGFja0JsdXIgPSBzdGFja0JsdXI7XHJcblxyXG59KCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXMgKSk7XHJcbiIsIi8vdmFyIENhbnZhc0V4cG9ydCA9IHJlcXVpcmUoJ0NhbnZhc0V4cG9ydCcpO1xyXG4vL3ZhciBNYXJrdXBDbGVhbmVyID0gcmVxdWlyZSgnTWFya3VwQ2xlYW5lcicpO1xyXG52YXIgU1ZHdG9DYW52YXMgPSByZXF1aXJlKCcuL1NWR3RvQ2FudmFzJyk7XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBSZXdyaXRlcigpIHtcclxuICAndXNlIHN0cmljdCc7XHJcbiAgY29uc29sZS5sb2coYXJndW1lbnRzKTtcclxufVxyXG4iLCJ2YXIgY2FudmcgPSByZXF1aXJlKCcuLi9saWJzL2NhbnZnJyk7XHJcblxyXG5cclxuZnVuY3Rpb24gU1ZHdG9DYW52YXMoKSB7XHJcblxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTVkd0b0NhbnZhcztcclxuIl19
