import { SanitizerConfig } from '../types';

function headerSanitizer(el: HTMLElement) {
  return {
    id: false
  };
};

function inlineCodeSanitizer(el: HTMLElement) {
  el.classList.add('inline-code');
  return {
    class: true
  };
};

/**
 * Declares the configuration used with HTML-Janitor library
 * for sanitizing the html elements.
 */
const sanitizerConfig: SanitizerConfig = {
  tags: {
    p: false,
    h1: headerSanitizer,
    h2: headerSanitizer,
    h3: headerSanitizer,
    h4: headerSanitizer,
    h5: headerSanitizer,
    h6: headerSanitizer,
    ul: function(el: HTMLElement) {
      return {
        class: true
      }
    },
    ol: function(el: HTMLElement) {
      return {
        class: true
      }
    },
    li: true,
    em: true,
    strong: true,
    del: true,
    br: true,
    pre: true,
    div: function() {
      return {
        class: true
      };
    },
    code: inlineCodeSanitizer,
    blockquote: true,
    hr: true,
    a: true,
    b: true,
    i: true
  },
  keepNestedBlockElements: true
}

export default {
  sanitizerConfig
};