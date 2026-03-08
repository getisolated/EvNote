import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * CodeMirror HighlightStyle matching VS Code "Default Dark Modern" token colors.
 *
 * Color reference (from the screenshot / VS Code theme):
 *  - #569cd6  keywords: const, let, var, function, class, new, typeof...
 *  - #c586c0  control flow: if, else, return, for, while, import, export, from...
 *  - #9cdcfe  variables, parameters, properties
 *  - #dcdcaa  function/method names (calls & definitions)
 *  - #4ec9b0  types, classes, interfaces, enums
 *  - #ce9178  strings
 *  - #d7ba7d  escape characters in strings
 *  - #b5cea8  numbers
 *  - #6a9955  comments
 *  - #d4d4d4  plain text, operators, punctuation
 *  - #808080  dimmed punctuation (brackets in some contexts)
 *  - #4fc1ff  constants, enum members
 *  - #dcdcaa  decorators / annotations
 */
const vscodeDarkModernStyle = HighlightStyle.define([
  // ── Comments ─────────────────────────────────────────────────
  { tag: t.comment,          color: '#6a9955', fontStyle: 'italic' },
  { tag: t.lineComment,      color: '#6a9955', fontStyle: 'italic' },
  { tag: t.blockComment,     color: '#6a9955', fontStyle: 'italic' },
  { tag: t.docComment,       color: '#6a9955', fontStyle: 'italic' },

  // ── Keywords ─────────────────────────────────────────────────
  { tag: t.keyword,          color: '#569cd6' },
  { tag: t.controlKeyword,   color: '#c586c0' },  // if, else, return, for, while
  { tag: t.operatorKeyword,  color: '#569cd6' },   // typeof, instanceof, in, of
  { tag: t.definitionKeyword,color: '#569cd6' },   // const, let, var, function, class
  { tag: t.moduleKeyword,    color: '#c586c0' },   // import, export, from

  // ── Variables & properties ───────────────────────────────────
  { tag: t.variableName,     color: '#9cdcfe' },
  { tag: t.propertyName,     color: '#9cdcfe' },
  { tag: t.definition(t.variableName), color: '#9cdcfe' },

  // ── Functions ────────────────────────────────────────────────
  { tag: t.function(t.variableName),    color: '#dcdcaa' },
  { tag: t.function(t.propertyName),    color: '#dcdcaa' },
  { tag: t.definition(t.function(t.variableName)), color: '#dcdcaa' },

  // ── Types, classes ───────────────────────────────────────────
  { tag: t.typeName,         color: '#4ec9b0' },
  { tag: t.className,        color: '#4ec9b0' },
  { tag: t.namespace,        color: '#4ec9b0' },
  { tag: t.macroName,        color: '#dcdcaa' },

  // ── Strings ──────────────────────────────────────────────────
  { tag: t.string,           color: '#ce9178' },
  { tag: t.special(t.string),color: '#d7ba7d' },  // template literals, regex
  { tag: t.escape,           color: '#d7ba7d' },

  // ── Numbers & booleans ───────────────────────────────────────
  { tag: t.number,           color: '#b5cea8' },
  { tag: t.integer,          color: '#b5cea8' },
  { tag: t.float,            color: '#b5cea8' },
  { tag: t.bool,             color: '#569cd6' },
  { tag: t.null,             color: '#569cd6' },

  // ── Constants ────────────────────────────────────────────────
  { tag: t.constant(t.variableName), color: '#4fc1ff' },

  // ── Operators & punctuation ──────────────────────────────────
  { tag: t.operator,         color: '#d4d4d4' },
  { tag: t.punctuation,      color: '#d4d4d4' },
  { tag: t.paren,            color: '#d4d4d4' },
  { tag: t.squareBracket,    color: '#d4d4d4' },
  { tag: t.brace,            color: '#d4d4d4' },
  { tag: t.derefOperator,    color: '#d4d4d4' },
  { tag: t.separator,        color: '#d4d4d4' },

  // ── Tags (HTML/JSX) ─────────────────────────────────────────
  { tag: t.tagName,          color: '#569cd6' },
  { tag: t.attributeName,    color: '#9cdcfe' },
  { tag: t.attributeValue,   color: '#ce9178' },
  { tag: t.angleBracket,     color: '#808080' },

  // ── Regex ────────────────────────────────────────────────────
  { tag: t.regexp,           color: '#d16969' },

  // ── Labels, annotations ──────────────────────────────────────
  { tag: t.labelName,        color: '#9cdcfe' },
  { tag: t.annotation,       color: '#dcdcaa' },

  // ── Markdown-specific tokens ─────────────────────────────────
  { tag: t.heading,          color: '#569cd6', fontWeight: 'bold' },
  { tag: t.emphasis,         color: '#569cd6', fontStyle: 'italic' },
  { tag: t.strong,           color: '#569cd6', fontWeight: 'bold' },
  { tag: t.strikethrough,    color: '#6a6a6a', textDecoration: 'line-through' },
  { tag: t.link,             color: '#3794ff', textDecoration: 'underline' },
  { tag: t.url,              color: '#3794ff' },
  { tag: t.quote,            color: '#6a9955', fontStyle: 'italic' },

  // ── Misc / fallback ──────────────────────────────────────────
  { tag: t.meta,             color: '#569cd6' },
  { tag: t.atom,             color: '#569cd6' },
  { tag: t.self,             color: '#569cd6' },
  { tag: t.invalid,          color: '#f44747' },
]);

export const vscodeDarkModern = syntaxHighlighting(vscodeDarkModernStyle);
