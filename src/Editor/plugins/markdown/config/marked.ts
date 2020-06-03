import { Tokenizer } from 'marked';
import classes from '../classes';

/**
 * Plugged configurations from markedjs library.
 * These are being used whenever overriding renderers or tokenizers.
 */
const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
const escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
const escapeReplacements: {[key: string]: string} = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const getEscapeReplacement = (ch: string) => escapeReplacements[ch];
function theEscape(html: string, encode: boolean) {
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, getEscapeReplacement);
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
    }
  }

  return html;
}

const renderer: any = {
  code(code: string, infostring: string | undefined, escaped: boolean) {
    const matcher = (infostring || '').match(/\S*/);
    if (matcher) {
      const lang = matcher[0];

      if (this.options.highlight) {
        const out = this.options.highlight(code, lang);
        if (out != null && out !== code) {
          escaped = true;
          code = out;
        }
      }

      if (lang) {
        return '<pre><code class="'
          + this.options.langPrefix
          + theEscape(lang, true)
          + '">'
          + (escaped ? code : theEscape(code, false))
          + '</code></pre>\n';
      }
    }

    // Don't think I need to escape as converting to the
    // <pre> tag markdown..
    return '<pre><div class="code-edit">'
        + (escaped ? code : theEscape(code, false))
        + '</div></pre>\n';
  },

  blockquote(quote: string) {
    const divClasses = classes['DIV'];
    const formattedDivClasses = divClasses.join(', ');
    return `<blockquote><div class="${formattedDivClasses}">` + quote + '</div></blockquote>\n';
  },
  
  hr() {
    return this.options.xhtml ? '<div class="horizontal-break"><hr/></div>\n' : '<div class="horizontal-break"><hr></div>\n';
  }
}

const tokenizer: Tokenizer = {
  strong(src: string) {
    const rules = /^__([^\s_])__(?!_)|^\*\*([^\s*])\*\*(?!\*)|^__([\s\S]*?)__(?!_)|^\*\*([\s\S]*?)\*\*(?!\*)/;
    const cap = rules.exec(src);
    if (cap) {
      return {
        type: 'strong',
        raw: cap[0],
        text: cap[4] || cap[3] || cap[2] || cap[1]
      };
    }
  },
  em(src: string) {
    const rules = /^_([^\s_])_(?!_)|^_([\s\S]*?)_(?!_|[^\s,punctuation])/;
    const cap = rules.exec(src);

    if (cap) {
      return {
        type: 'em',
        raw: cap[0],
        text: cap[2] || cap[1]
      };
    }
  },
  codespan(src: string) {
    const cap = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(src);
    if (cap) {
      let text = cap[2].replace(/\n/g, ' ');
      const hasNonSpaceChars = /[^ ]/.test(text);
      const hasSpaceCharsOnBothEnds = text.startsWith(' ') && text.endsWith(' ');
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      //text = escape(text, true);
      return {
        type: 'codespan',
        raw: cap[0],
        text: cap[2]
      };
    }
  },
  del(src: string) {
    const rules = /^(~+)([^~]|[^~][\s\S]*?[^~])\1(?!~)/;
    const cap = rules.exec(src);
    if (cap) {
      return {
        type: 'del',
        raw: cap[0],
        text: cap[2]
      }
    }
  }
};

export default {
  renderer,
  tokenizer
}