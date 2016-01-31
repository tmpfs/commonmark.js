"use strict";

var Renderer = require('./renderer');

var esc = require('../common').escapeXml;

// Helper function to produce an HTML tag.
var tag = function(name, attrs, selfclosing) {
    var result = '<' + name;
    if (attrs && attrs.length > 0) {
        var i = 0;
        var attrib;
        while ((attrib = attrs[i]) !== undefined) {
            result += ' ' + attrib[0] + '="' + attrib[1] + '"';
            i++;
        }
    }
    if (selfclosing) {
        result += ' /';
    }

    result += '>';
    return result;
};

var reHtmlTag = /\<[^>]*\>/;
var reUnsafeProtocol = /^javascript:|vbscript:|file:|data:/i;
var reSafeDataProtocol = /^data:image\/(?:png|gif|jpeg|webp)/i;

var potentiallyUnsafe = function(url) {
    return reUnsafeProtocol.test(url) &&
        !reSafeDataProtocol.test(url);
};


function HtmlRenderer(options) {
  options = options || {};
  // by default, soft breaks are rendered as newlines in HTML
  options.softbreak = options.softbreak || '\n';
  // set to "<br />" to make them hard breaks
  // set to " " if you want to ignore line wrapping in source

  this.disableTags = 0;
  this.lastOut = "\n";
  this.options = options;
}

/* Node methods */

function text(node) {
  this.out(esc(node.literal, false));
}

function softbreak() {
  this.out(this.options.softbreak);
}

function linebreak() {
  this.out(tag('br', [], true));
  this.cr();
}

function link(node, entering) {
  var attrs = this.attrs(node);
  if (entering) {
      if (!(this.options.safe && potentiallyUnsafe(node.destination))) {
          attrs.push(['href', esc(node.destination, true)]);
      }
      if (node.title) {
          attrs.push(['title', esc(node.title, true)]);
      }
      this.out(tag('a', attrs));
  } else {
      this.out(tag('/a'));
  }
}

function image(node, entering) {
  if (entering) {
      if (this.disableTags === 0) {
          if (this.options.safe &&
               potentiallyUnsafe(node.destination)) {
              this.out('<img src="" alt="');
          } else {
              this.out('<img src="' + esc(node.destination, true) +
                  '" alt="');
          }
      }
      this.disableTags += 1;
  } else {
      this.disableTags -= 1;
      if (this.disableTags === 0) {
          if (node.title) {
              this.out('" title="' + esc(node.title, true));
          }
          this.out('" />');
      }
  }
}

function emph(node, entering) {
  this.out(tag(entering ? 'em' : '/em'));
}

function strong(node, entering) {
  this.out(tag(entering ? 'strong' : '/strong'));
}

function paragraph(node, entering) {
  var grandparent = node.parent.parent
    , attrs = this.attrs(node);
  if (grandparent !== null &&
      grandparent.type === 'list') {
      if (grandparent.listTight) {
          return;
      }
  }
  if (entering) {
      this.cr();
      this.out(tag('p', attrs));
  } else {
      this.out(tag('/p'));
      this.cr();
  }
}

function heading(node, entering) {
  var tagname = 'h' + node.level
    , attrs = this.attrs(node);
  if (entering) {
      this.cr();
      this.out(tag(tagname, attrs));
  } else {
      this.out(tag('/' + tagname));
      this.cr();
  }
}

function code(node) {
  this.out(tag('code') + esc(node.literal, false) + tag('/code'));
}

function code_block(node) {
  var info_words = node.info ? node.info.split(/\s+/) : []
    , attrs = this.attrs(node);
  if (info_words.length > 0 && info_words[0].length > 0) {
      attrs.push(['class', 'language-' + esc(info_words[0], true)]);
  }
  this.cr();
  this.out(tag('pre') + tag('code', attrs));
  this.out(esc(node.literal, false));
  this.out(tag('/code') + tag('/pre'));
  this.cr();
}

function thematic_break(node) {
  var attrs = this.attrs(node);
  this.cr();
  this.out(tag('hr', attrs, true));
  this.cr();
}

function block_quote(node, entering) {
  var attrs = this.attrs(node);
  if (entering) {
      this.cr();
      this.out(tag('blockquote', attrs));
      this.cr();
  } else {
      this.cr();
      this.out(tag('/blockquote'));
      this.cr();
  }
}

function list(node, entering) {
  var tagname = node.listType === 'bullet' ? 'ul' : 'ol'
    , attrs = this.attrs(node);

  if (entering) {
      var start = node.listStart;
      if (start !== null && start !== 1) {
          attrs.push(['start', start.toString()]);
      }
      this.cr();
      this.out(tag(tagname, attrs));
      this.cr();
  } else {
      this.cr();
      this.out(tag('/' + tagname));
      this.cr();
  }
}

function item(node, entering) {
  var attrs = this.attrs(node);
  if (entering) {
      this.out(tag('li', attrs));
  } else {
      this.out(tag('/li'));
      this.cr();
  }
}

function html_inline(node) {
  if (this.options.safe) {
      this.out('<!-- raw HTML omitted -->');
  } else {
      this.out(node.literal);
  }
}

function html_block(node) {
  this.cr();
  if (this.options.safe) {
      this.out('<!-- raw HTML omitted -->');
  } else {
      this.out(node.literal);
  }
  this.cr();
}

function custom_inline(node, entering) {
  if (entering && node.onEnter) {
      this.out(node.onEnter);
  } else if (!entering && node.onExit) {
      this.out(node.onExit);
  }
}

function custom_block(node, entering) {
  this.cr();
  if (entering && node.onEnter) {
      this.out(node.onEnter);
  } else if (!entering && node.onExit) {
      this.out(node.onExit);
  }
  this.cr();
}

/* Helper methods */

function out(s) {
  if (this.disableTags > 0) {
    this.lit(s.replace(reHtmlTag, ''));
  } else {
    this.lit(s);
  }
  this.lastOut = s;
}

function cr() {
  if (this.lastOut !== '\n') {
    this.lit('\n');
    this.lastOut = '\n';
  }
}

function attrs (node) {
  var att = [];
  if (this.options.sourcepos) {
      var pos = node.sourcepos;
      if (pos) {
          att.push(['data-sourcepos', String(pos[0][0]) + ':' +
                      String(pos[0][1]) + '-' + String(pos[1][0]) + ':' +
                      String(pos[1][1])]);
      }
  }
  return att;
}

// quick browser-compatible inheritance
HtmlRenderer.prototype = new Renderer();

HtmlRenderer.prototype.text = text;
HtmlRenderer.prototype.html_inline = html_inline;
HtmlRenderer.prototype.html_block = html_block;
HtmlRenderer.prototype.softbreak = softbreak;
HtmlRenderer.prototype.linebreak = linebreak;
HtmlRenderer.prototype.link = link;
HtmlRenderer.prototype.image = image;
HtmlRenderer.prototype.emph = emph;
HtmlRenderer.prototype.strong = strong;
HtmlRenderer.prototype.paragraph = paragraph;
HtmlRenderer.prototype.heading = heading;
HtmlRenderer.prototype.code = code;
HtmlRenderer.prototype.code_block = code_block;
HtmlRenderer.prototype.thematic_break = thematic_break;
HtmlRenderer.prototype.block_quote = block_quote;
HtmlRenderer.prototype.list = list;
HtmlRenderer.prototype.item = item;
HtmlRenderer.prototype.custom_inline = custom_inline;
HtmlRenderer.prototype.custom_block = custom_block;

HtmlRenderer.prototype.cr = cr;
HtmlRenderer.prototype.out = out;
HtmlRenderer.prototype.attrs = attrs;

module.exports = HtmlRenderer;

