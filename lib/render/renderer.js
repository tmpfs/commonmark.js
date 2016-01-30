"use strict";

var Types = [
  'document',
  'text',
  'softbreak',
  'hardbreak',
  'emph',
  'strong',
  'htmlinline',
  'custominline',
  'link',
  'image',
  'code',
  'paragraph',
  'blockquote',
  'item',
  'list',
  'heading',
  'codeblock',
  'htmlblock',
  'customblock',
  'thematicbreak'
];

function Renderer() {}

/**
 *  Walks the AST and calls member methods for each Node type.
 *
 *  @param ast {Node} The root of the abstract syntax tree.
 */
function render(ast) {
  var walker = ast.walker()
    , event
    , type;

  this.buffer = '';

  while((event = walker.next())) {
    type = event.node.type.toLowerCase();
    if(~Types.indexOf(type)) {
      this[type](event, event.node, event.entering);
    }else{
      throw new Error('Unknown node type ' + event.node.type);
    }
  }
  return this.buffer;
}

/**
 *  Concatenate a literal string to the buffer.
 *
 *  @param str {String} The string to concatenate.
 */
function lit(str) {
  this.buffer += str;
}

/**
 *  Concatenate a string to the buffer possibly escaping the content.
 *
 *  Concrete renderer implementations should override this method.
 *
 *  @param str {String} The string to concatenate.
 */
function out(str) {
  this.lit(str);
}

Renderer.prototype.render = render;
Renderer.prototype.out = out;
Renderer.prototype.lit = lit;

Types.forEach(function(type) {
  Renderer.prototype[type] = function(/* event, node, entering */) {}
})

module.exports = Renderer;
