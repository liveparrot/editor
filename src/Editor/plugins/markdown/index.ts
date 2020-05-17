import { API, SanitizerConfig } from '@editorjs/editorjs';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token';
import VanillaCaret from 'vanilla-caret-js';
import HTMLJanitor from 'html-janitor';

import marked, { MarkedOptions, Tokenizer } from 'marked';
import DOMPurify from 'dompurify';

import Diff from 'diff';

import "./ext-string";

// const customRenderer = new marked.Renderer();
// customRenderer.prototype.paragraph = function(text) {
//   return text + '\n';
// };

// marked.setOptions({
//   renderer: new Rend
// })

/**
 * 8 - backspace
 * 37 - left arrow
 * 39 - right arrow
 * 46 - delete
 */
const ignoredKeyCodes = [
  8,9,13,16,17,18,19,20,27,33,34,35,36,37,38,39,40,45,46,91,92,93,112,113,114,115,116,117,118,119,120,121,122,123,144,145
]


const md = new MarkdownIt()
  .enable(['strikethrough']);

interface MarkdownConstructor {
  data: any;
  config: object;
  api: API;
}

enum MarkdownElementTypes {
  Header,
  Paragraph,
  UnorderedList,
  OrderedList,
  Code,
  Quote
}

const headerSanitizer = function(el: HTMLElement) {
  // el.classList.add('ce-header');
  return {
    // 'class': true
    id: false
  };
};

const inlineCodeSanitizer = function(el: HTMLElement) {
  el.classList.add('inline-code');
  return {
    'class': true
  };
};

const SANITIZER_CONFIG: any = {
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
    div: true,
    code: inlineCodeSanitizer,
    blockquote: true,
  },
  keepNestedBlockElements: true,
};

const janitor = new HTMLJanitor(SANITIZER_CONFIG)

const KEY_HASH = 'digit3';
const KEY_SPACE = 'space';

const MARKDOWN_VERIFIER: any = {
  '*': [/\*\*/g, /\*/g],
  '_': [/__/g, /_/g],
  '~': [/~/g],
  '`': [/`/g],
};

const REGEX_MARKDOWN_HEADER = /^#{1,6}[\s|\\u00A0|&nbsp;]{1}/;
const REGEX_MARKDOWN_LIST = /^(-{1}|1\.)[\s|\\u00A0].+/;
const REGEX_MARKDOWN_QUOTE = /^>[\s|\\u00A0]/;

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
    return '<blockquote><div>' + quote + '</div></blockquote>\n';
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

//marked.setOptions(options);
marked.use({
  tokenizer,
  renderer
});

class Markdown {

  static _enableLineBreaks: boolean;

  data: any;
  api: API;
  _element: HTMLElement;
  _elementType: MarkdownElementTypes;
  _CSS: { block: any; wrapper: any; };
  _caret: any;

  _editableSelection: any;
  _rawCaretPosition: number;
  _rawValue: string;

  _onPressShiftKey: boolean;

  _timeoutFunction: any;

  static get toolbox() {
    return {
      title: 'Markdown',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.2 -0.3 9 11.4" width="12" height="14"><path d="M0 2.77V.92A1 1 0 01.2.28C.35.1.56 0 .83 0h7.66c.28.01.48.1.63.28.14.17.21.38.21.64v1.85c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26a1 1 0 01-.21-.66V1.69H5.6v7.58h.5c.25 0 .45.08.6.23.17.16.25.35.25.6s-.08.45-.24.6a.87.87 0 01-.62.22H3.21a.87.87 0 01-.61-.22.78.78 0 01-.24-.6c0-.25.08-.44.24-.6a.85.85 0 01.61-.23h.5V1.7H1.73v1.08c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26A1 1 0 010 2.77z"/></svg>',
    };
  }

  static get enableLineBreaks() {
    if (this._enableLineBreaks === undefined) {
      this._enableLineBreaks = false;
    }
    return this._enableLineBreaks;
  }

  static setEnableLineBreaks(isEnabled: any) {
    this._enableLineBreaks = isEnabled;
  }

  constructor(res: MarkdownConstructor) {
    const { data, api } = res;
    this.data = data;
    this.api = api;

    this._CSS = {
      block: this.api.styles.block,
      wrapper: 'ce-paragraph'
    };
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onTheRightKeyDown = this.onTheRightKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlockKeyUp = this.onBlockKeyUp.bind(this);
    this.onMarkdownElementKeyUp = this.onMarkdownElementKeyUp.bind(this);

    this.onListItemKeyDown = this.onListItemKeyDown.bind(this);
    this.onListItemKeyUp = this.onListItemKeyUp.bind(this);

    this.onPreCodeKeyDown = this.onPreCodeKeyDown.bind(this);
    
    this._elementType = MarkdownElementTypes.Paragraph;
    this._timeoutFunction = null;

    this._editableSelection= [-1, -1, 0];
    this._rawCaretPosition = 0;
    this._rawValue = '';
    this._onPressShiftKey = false;

    this._element = this.drawView();
  }

  render() {
    return this._element;
  }

  save() {

  }

  isMarkdownHeader(code: string) {
    return code === KEY_HASH || code === KEY_SPACE;
  }

  checkAndParseBlockMarkdown(keyCode: string): boolean {
    console.log('on down key code:' + keyCode + ';');
    const sanitizedKeyCode = keyCode.toLowerCase();

    const inputValue = this._element.innerHTML;
    console.log('Input value:[' + inputValue + ']');

    if (this.isMarkdownHeader(sanitizedKeyCode)) {
      const shouldConvertToHeader = REGEX_MARKDOWN_HEADER.test(inputValue);
      if (shouldConvertToHeader) {
        this.parseBlockMarkdown();
        return true;
      }
    }

    const shouldConvertToList = REGEX_MARKDOWN_LIST.test(inputValue);
    if (shouldConvertToList) {
      this.parseBlockMarkdown();
      return true;
    }

    // inputValue.replace
    const shouldConvertToQuote = REGEX_MARKDOWN_QUOTE.test(this._element.textContent!);
    console.log('quote?' + shouldConvertToQuote);
    if (shouldConvertToQuote) {
      this.parseBlockMarkdown('> &#8203;');
      return true;
    }

    return false;
  }

  checkAndClearMarkdown(keyCode: string): boolean {
    const targetElement = this._activeElement;
    if (!targetElement) {
      return false;
    }

    // TODO: Support delete button also.
    if (keyCode === 'backspace') {
      const textContent = targetElement.textContent!;

      // Reset element.
      if (textContent.length === 0) {
        this.resetElement();
        return true;
      }
    }

    return false;
  }

  sanitizeInputKey(inputKey: string) {
    let sanitizedKey = inputKey.toLowerCase();
    if (inputKey === '8' && this._onPressShiftKey) {
      sanitizedKey = '*';
    }
    else if (inputKey === '-' && this._onPressShiftKey) {
      sanitizedKey = '_';
    }
    else if (inputKey === '`' && this._onPressShiftKey) {
      sanitizedKey = '~';
    }

    return sanitizedKey;
  }

  checkAndParseInlineMarkdown(inputKey: string) {
    console.log('# check and parse inline markdown');
    let toMarkdown = false;

    const targetElement = this._activeElement;
    if (!targetElement) {
      console.log('Target element not found. Skip checking and parsing of inline markdown.');
      return;
    }

    const inputHTML = targetElement.innerHTML;
    console.log('Input html:' + inputHTML);
    
    if (MARKDOWN_VERIFIER[inputKey]) {
      const matcher = MARKDOWN_VERIFIER[inputKey];
      matcher.every((matchingRegex: RegExp) => {
        const matches = inputHTML.match(matchingRegex);
        console.log(matches);

        // Must exist and comes in pair!
        if (matches !== null && matches.length === 2) {
          toMarkdown = true;
          return false;
        }

        return true;
      });
    }

    console.log('To Markdown?' + toMarkdown);
    if (toMarkdown) {
      this.parseInlineMarkdown();
    }
  }

  get _activeElement(): HTMLElement | null {
    if (this._elementType === MarkdownElementTypes.OrderedList || 
        this._elementType === MarkdownElementTypes.UnorderedList) {
      return this._currentListItem;
    }

    return this._element;
  }

  get _currentListItem(): HTMLElement | null {
    console.log('Yo');
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      let currentNode: HTMLElement = selection.anchorNode as HTMLElement;

      if (currentNode.nodeType !== Node.ELEMENT_NODE) {
        currentNode = currentNode.parentNode! as HTMLElement;
      }

      // Smartly get the nearest node with the list item class CSS!
      const node = currentNode.closest(`.cdx-list__item`) as HTMLElement;
      console.log(node);
      return node;
    }

    return null;
  }

  _getCurrentListItemIndex(listElement: HTMLElement, selectedListItemNode: HTMLElement): number {
    let position = -1;
    listElement.childNodes.forEach((childNode, index) => {
      const child = childNode as HTMLElement;
      if (child === selectedListItemNode) {
        position = index;
      }
    });

    return position;
  }

  get _accurateCaretPos(): any {
    const caretPos = this._caret.getPos();

    if (this._elementType === MarkdownElementTypes.OrderedList || 
      this._elementType === MarkdownElementTypes.UnorderedList) {

      const activeElement = this._currentListItem;
      if (!activeElement) {
        return {
          value: caretPos,
          relative: caretPos
        };
      }

      const activeElementIndex = this._getCurrentListItemIndex(this._element, activeElement);

      if (activeElementIndex < 1) {
        return {
          value: caretPos,
          relative: caretPos
        };
      }

      let previousCumulativeTextLengths = 0;
      for (let i = 0 ; i < activeElementIndex ; i++) {
        const child = this._element.childNodes.item(i) as HTMLElement;
        previousCumulativeTextLengths += child.textContent ? child.textContent.length : 0;
      }

      const relativeCaretPos = caretPos - previousCumulativeTextLengths;
      return {
        value: caretPos,
        relative: relativeCaretPos
      };
    } 

    //return this._caret.getPos();
    return {
      value: caretPos,
      relative: caretPos
    }
  }

  onListItemKeyDown(e: KeyboardEvent) {
    const { 
      key: inputKey, 
      target: listElement 
    } = e;
    const sanitizedKey = this.sanitizeInputKey(inputKey);

    if 
    (
      (sanitizedKey === 'enter' || sanitizedKey === 'backspace') && 
      listElement instanceof HTMLElement
    ) {
      const selectedListItemNode = this._currentListItem;
      if (selectedListItemNode) {
        const lengthOfItems = listElement.children.length;
        const index = this._getCurrentListItemIndex(listElement, selectedListItemNode);

        const isLastItem = index === (lengthOfItems - 1);

        const inputValue: string = selectedListItemNode.textContent!.trim();
        
        // If empty text, then just remove this child and enter a new block.
        if (inputValue.length === 0 && isLastItem) {
          listElement.removeChild(selectedListItemNode);

          // If the list already has more than 1 items, proceed to 
          // go to the next line.
          // If not, just remove the entire list object and revert
          // to the original div content.
          if (lengthOfItems > 1) {
            this.insertAndFocusNewBlock();

            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }
    }

    this.toggleNeutralCallbacks(e);    
  }

  onListItemKeyUp(e: KeyboardEvent) {
    const { key: inputKey } = e;
    const sanitizedKey = this.sanitizeInputKey(inputKey);

    // if (this.checkAndClearMarkdown(sanitizedKey)) {
    //   return;
    // }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  onPreCodeKeyDown(e: KeyboardEvent) {
    const { key: inputKey } = e;

    if (inputKey.toLowerCase() === 'enter' && e.metaKey) {
      this.insertAndFocusNewBlock();

      e.preventDefault();
      e.stopPropagation();
    }
  }

  insertAndFocusNewBlock() {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
    const newBlockIndex = currentBlockIndex + 1;

    // Call API to insert a new block.
    this.api.blocks.insert(undefined, undefined, undefined, newBlockIndex, true);

    this.focusOnBlock({ index: newBlockIndex });
  }

  focusOnBlock({index, setCaretToInitialPositon}: {index: number, setCaretToInitialPositon?: boolean}) {
    // However, since the editable content is not directly at the new block,
    // the editable content has to be obtained and set focus.
    // Obtain the editable content by querying its property: contentEdtaible: true
    const newBlock = this.api.blocks.getBlockByIndex(index);
    
    // const editableContentElement: any = newBlock.firstElementChild!.firstElementChild!
    const editableContentElement: HTMLElement | null = newBlock.querySelector('[contentEditable="true"]');

    if (editableContentElement) {
      editableContentElement.focus();

      if (setCaretToInitialPositon) {
        const range = document.createRange();
        range.setStart(editableContentElement, 0);
        range.setEnd(editableContentElement, 0);

        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }

  removeNextBlock() {
    this.api.blocks.delete(this.api.blocks.getCurrentBlockIndex() + 1);
  }

  parseBlockMarkdown(value?: string) {
    const inputValue = value || this._element.innerHTML;
    console.log('test sanitize:' + unescape(inputValue));
    const sanitizedInputValue = inputValue
        .replace(/&nbsp;/g, ' ')
        . replace(/^&gt;/, '>');
    console.log('Sanitized Input Value:' + sanitizedInputValue +';');

    const blockMarkdown = marked(sanitizedInputValue);
    console.log('bd', blockMarkdown);
    // const newElement = this.api.sanitizer.clean(blockMarkdown, SANITIZER_CONFIG);
    const newElement = janitor.clean(blockMarkdown);

    if (newElement.trim().length === 0) {
      return;
    }

    // Virtually create a new DOM with the newly parsed and sanitized markdown.
    const documentWithNewElement = new DOMParser().parseFromString(newElement, 'text/html');
    const documentBody = documentWithNewElement.getElementsByTagName('body');

    if (documentBody.length > 0) {
      // Obtain the first element child and create a new DOM element.
      const newElementFromDocument = documentBody[0].firstElementChild;
      const elementTag = newElementFromDocument!.tagName;

      this.setElementTypeByTag(elementTag);

      const newElement = document.createElement(elementTag);
      newElement.classList.add(...this.getElementClassesByTag(elementTag));
      // element.dataset.placeholder = 'Type something here';
      newElement.contentEditable = 'true';
      newElement.addEventListener('focus', () => {
        if (this._elementType === MarkdownElementTypes.OrderedList || 
          this._elementType === MarkdownElementTypes.UnorderedList ||
          this._elementType === MarkdownElementTypes.Code || 
          this._elementType === MarkdownElementTypes.Quote) {
          Markdown.setEnableLineBreaks(true);
        }
        else {
          Markdown.setEnableLineBreaks(false);
        }
      });

      if (elementTag === 'UL' || elementTag === 'OL') {
        newElement.addEventListener('keydown', this.onListItemKeyDown);
        newElement.addEventListener('keyup', this.onListItemKeyUp);

        console.log(newElementFromDocument);
        const listItemInnerHTML = newElementFromDocument!.firstElementChild?.innerHTML;
        
        const listItemElement = document.createElement('li');
        listItemElement.classList.add('cdx-list__item');
        
        listItemElement.innerHTML = listItemInnerHTML!;
        newElement.appendChild(listItemElement);
      }
      else if (elementTag === 'PRE' || elementTag === 'BLOCKQUOTE') {
        // TODO: Reassigning like this may cause performance issue.
        // May look into alternative of appending the child nodes directly.
        // Not sure if there would be any reference issue.
        newElement.innerHTML = newElementFromDocument!.innerHTML;

        newElement.addEventListener('keydown', this.onPreCodeKeyDown);
      } else {
        // TODO: Reassigning like this may cause performance issue.
        // May look into alternative of appending the child nodes directly.
        // Not sure if there would be any reference issue.
        newElement.innerHTML = newElementFromDocument!.innerHTML;

        newElement.addEventListener('keydown', this.onTheRightKeyDown);
        newElement.addEventListener('keyup', this.onBlockKeyUp);
      }

      this._element.parentNode!.replaceChild(newElement, this._element);
      this._element = newElement;
      this._caret = new VanillaCaret(this._element);

      this._element.focus();
      this._caret.setPos(this._element.textContent!.length);
    }

    // const matches = newElement.match(/^<[a-zA-Z1-6]+(>|.*?[^?]>)/);
    // if (matches) {
    //   const firstOpeningTag = matches[0];
    //   const elementTag = firstOpeningTag.replace('<', '').replace('>', '');

    //   const newElement = document.createElement(elementTag);

    //   const classByTag = this.getElementClassesByTag(elementTag);
    //   if (classByTag.length > 0){
    //     newElement.classList.add(classByTag);
    //   }

    //   // element.dataset.placeholder = 'Type something here';
    //   newElement.contentEditable = 'true';
    //   newElement.addEventListener('keydown', this.onTheRightKeyDown);
    //   newElement.addEventListener('keyup', this.onBlockKeyUp);

    //   // this.setElementTypeByTag(elementTag);
    //   this._element.parentNode!.replaceChild(newElement, this._element);
    //   this._element = newElement;
    //   this._caret = new VanillaCaret(newElement);

    //   this._element.focus();
    // }
  }

  parseInlineMarkdown() {
    const targetElement = this._activeElement;
    if (!targetElement) {
      return;
    }

    const sanitizedInputValue = targetElement.innerHTML.replace(/&nbsp;/g, ' ');
    console.log('sanitized:' + sanitizedInputValue);
    const inlineMarkdown = marked(sanitizedInputValue);
    console.log(inlineMarkdown);
    const newElement = this.api.sanitizer.clean(inlineMarkdown, SANITIZER_CONFIG);
    console.log('sanitized:' + newElement);

    targetElement.innerHTML = newElement;
    this.moveCursorToEnd(targetElement);
  }

  onKeyDown(e: KeyboardEvent) {
    const caretPosition = this._caret.getPos();
    if (e.code.toLowerCase() === 'backspace' && caretPosition === 0) {
      e.preventDefault();
      this.resetElement();
      return false;
    }
  }

  toggleShiftKey(e: KeyboardEvent) {
    if (e.shiftKey && this._onPressShiftKey === false) {
      this._onPressShiftKey = true;
    }
    else if (e.shiftKey === false && this._onPressShiftKey) {
      this._onPressShiftKey = false;
    }
  }

  moveCursorToEnd(el: HTMLElement) {
    el.focus();

    if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);

        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
    } 
    // else if (typeof document.body.createTextRange != "undefined") {
    //     var textRange = document.body.createTextRange();
    //     textRange.moveToElementText(el);
    //     textRange.collapse(false);
    //     textRange.select();
    // }
}

  toggleNeutralCallbacks(e: KeyboardEvent) {
    console.log('here woohoo');
    const { code } = e;
    
    const targetElement = this._activeElement;
    if (!targetElement) {
      return;
    }
    
    this._rawValue = targetElement.innerHTML;
    
    if (code.toLowerCase() === 'space') {
      const { value: caretPos, relative } = this._accurateCaretPos;
      const textContent = targetElement.textContent!;

      if (relative >= (textContent.length - 1)) {
        const inputHTML = targetElement.innerHTML.replace('\n', '');

        const regex = /<\/[a-z][\s\S]*>$/;
        if (regex.test(inputHTML)) {
          const matchingRegex = inputHTML.match(regex)!;
          const sanitizedInputHTML = inputHTML.replace(`&nbsp;${matchingRegex[0]}`, matchingRegex[0]);

          const escapeMarkdownHTML = `${sanitizedInputHTML}&nbsp;`;
          targetElement.innerHTML = escapeMarkdownHTML;

          // Stop spacebar from kicking in!
          e.preventDefault();
          e.stopPropagation();

          console.log('> caretpos:' + caretPos);
          // if (caretPos === relative) {
          //   this._caret.setPos(caretPos);
          // } else {
            // this._caret.setPos(caretPos + 1);
            this.moveCursorToEnd(targetElement);
          // }
          return;
        }
      }
    }

    this.toggleShiftKey(e);
  }

  onTheRightKeyDown(e: KeyboardEvent) {
    const sanitizedKeyCode = e.code.toLowerCase();
    if (sanitizedKeyCode === 'enter' && e.target instanceof HTMLElement) {

      // TODO: Support syntax highlighting with language set:
      // ```js
      // ```py
      if (e.target.textContent?.trim() === '```') {

        // If only there's a cleaner way to prevent creation
        // of a new block line.
        // Markdown.setEnableLineBreaks(true);
        // e.preventDefault();
        // e.stopPropagation();

        this.parseBlockMarkdown('```\n&#8203;\n```');

        const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
        this.api.blocks.delete(currentBlockIndex);

        // Add a slight timeout to shift focus to the <pre> block.
        setTimeout(() => {
          this.focusOnBlock({ 
            index: currentBlockIndex - 1, 
            setCaretToInitialPositon: true
          });
        }, 50);

        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    this.toggleNeutralCallbacks(e);
  }

  onKeyUp(e: KeyboardEvent) {
    const { code } = e;
    
    // This is working header validation.
    if (this.checkAndParseBlockMarkdown(code)) {
      return;
    }
    
    const { key: inputKey } = e;
    const sanitizedKey = this.sanitizeInputKey(inputKey);

    if (this.checkAndClearMarkdown(sanitizedKey)) {
      return;
    }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  onBlockKeyUp(e: KeyboardEvent) {
    const { key: inputKey } = e;
    const sanitizedKey = this.sanitizeInputKey(inputKey);

    if (this.checkAndClearMarkdown(sanitizedKey)) {
      return;
    }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  onMarkdownElementKeyUp(e: KeyboardEvent) {
    this.doVerifyInlineMarkdown();
  }

  /**
   * Call to verify any inline markdown renderings.
   * This functions helps to prevent the true verification 
   * logic from being called too many times.
   * 
   * There is a bug when user types very fast and enters a 'space'.
   * The markdown library will remove the newly added 'space' and
   * the logic function will just assume that something was changed.
   * If this happens, weird renderings will occur!
   */
  doVerifyInlineMarkdown() {
    clearTimeout(this._timeoutFunction);
    this._timeoutFunction = setTimeout(() => {
      this._verifyInlineMarkdown();
    }, 150);
  }

  /**
   * WARNING: This function is private and should not be called
   * directly unless advised. If needed to do inline renderings,
   * call `doVerifyInlineMarkdown()` function instead.
   * 
   * *******
   * 
   * Verify and render new inline markdowns.
   */
  _verifyInlineMarkdown() {
    const content = this._element.innerHTML;

    const cleanedContent = content.replace(/&nbsp;/g, ' ');
    const parsed = md.parse(cleanedContent, {});
    
    console.log(parsed);
    if (parsed.length > 0) {
      const inlineContent = parsed[1];
      const { children, type } = inlineContent;

      if (type !== 'inline') {
        return;
      }

      const childrenElements =children!
        .map(child => this.createChildElement(child))
        .join('');

      if (childrenElements !== cleanedContent) {
        console.log('Contents are not the same (new):' + childrenElements + ';');
        console.log('old:' + cleanedContent +';');

        const currentCaretPos = this._caret.getPos();
        console.log('caretpos: ' + currentCaretPos);

        this._element.innerHTML = childrenElements;

        // Set caret to where it was last loaded.
        // TODO: This currently only supports hardcoded of converting 1
        // markdown element per time.
        // TODO: If markdown element is end of sentence, no way to get out of it.
        // This needs to be fixed as the users needs to "escape" the
        // formatted markdown, which are inline html blocks.
        this._caret.setPos(currentCaretPos - 2);
      }
    }

    // console.log(parsed);
    
    // const rendered = md.render(content);
    // console.log(rendered);
    // this._element.innerHTML = rendered;
  }

  getInputSelection(): any {
    return {
      start: this._editableSelection[0],
      end: this._editableSelection[1],
      isSelectingAll: this._editableSelection[2]
    };
  };

  setInputSelection(start: number, end: number) {
    if (start !== end) {
      const { isSelectingAll } = this.getInputSelection();
      this._editableSelection = [start, end, isSelectingAll];
    }
  }

  setInputSelectionAll() {
    const { start , end } = this.getInputSelection();
    this._editableSelection = [start, end, 1];
  }

  hasSelection(): boolean {
    const { start, end } = this.getInputSelection();
    return start !== -1 && end !== -1;
  }

  hasSelectedAll(): boolean {
    const { isSelectingAll } = this.getInputSelection();
    return isSelectingAll;
  }

  isSelectionChange(start: number, end: number): boolean {
    // Only make comparison if start and end numbers are not the same.
    if (start === end) {
      return false;
    }

    return start !== this._editableSelection[0] && end !== this._editableSelection[1];
  }

  clearInputSelection() {
    this._editableSelection = [-1, -1];
  }

  drawView(): HTMLElement {
    const div: HTMLElement = document.createElement('DIV');

    div.classList.add(this._CSS.wrapper, this._CSS.block);
    div.contentEditable = 'true';
    div.dataset.placeholder = "Write something here.";

    div.addEventListener('keydown', this.onTheRightKeyDown);
    div.addEventListener('keyup', this.onKeyUp);
    div.addEventListener('focus', () => {
      if (this._elementType === MarkdownElementTypes.OrderedList || this._elementType === MarkdownElementTypes.UnorderedList) {
        Markdown.setEnableLineBreaks(true);
      }
      else {
        Markdown.setEnableLineBreaks(false);
      }
    });

    this._caret = new VanillaCaret(div);

    return div;
  }

  parseToMarkdown(data: string | null | undefined) {
    if (!data) {
      return;
    }

    // Clean data from on screen's input.
    const cleanData = data.trim();

    // Parse to markdown chunks for better raw processing.
    const parsedData = md.parse(cleanData, {});
    console.log(parsedData);

    if (parsedData.length > 0) {
      let elementTag = parsedData[0].tag;

      if (elementTag.trim().toLowerCase() === 'p') {
        elementTag = 'div';
      }

      // Don't do anything if it just replicating the same tag name.
      // TODO: Need to check if this'll affect converting of inline formattings.
      if (this._element.tagName.toLowerCase() === elementTag) {
        console.log('HAAAALTTT');
        return;
      }

      const content = parsedData[1];
      const newElement = this.createNewElement(elementTag, content);
      
      if (newElement) {
        this.setElementTypeByTag(elementTag);
        this._element.parentNode!.replaceChild(newElement, this._element);

        this._element = newElement;
        this._element.focus();
        this._caret = new VanillaCaret(this._element);
      }
    }
  }

  createNewElement(tag: string, content: Token): HTMLElement | null {
    const { children } = content;
    if (children) {
      const element = document.createElement(tag);
      element.classList.add(...this.getElementClassesByTag(tag));
      // element.dataset.placeholder = 'Type something here';
      element.contentEditable = 'true';
      element.addEventListener('keydown', this.onKeyDown);
      element.addEventListener('keyup', this.onKeyUp);

      const childElement = children
        .map((child) => {
          const el = this.createChildElement(child);
          return el;
        })
        .join('');

      element.innerHTML = childElement;      
      return element;
    }

    return null;
  }

  createChildElement(child: Token): string {
    const { type, tag: childTag, content: childContent} = child;
    
    if (childTag === '' || childTag === null || childTag === undefined) {
      return childContent;
    }

    if (type === 'em_open' || type === 's_open') {
      let childOpenTag = `<${childTag}>`;
      const childClass = this.getElementClassesByTag(childTag);
      if (childClass.length > 0) {
        childOpenTag = `<${childTag} class="${childClass}">`;
      }

      return childOpenTag;
    }
    else if (type === 'em_close' || type === 'em_close') {
      return `</${childTag}>`;
    }

    let childOpenTag = `<${childTag}>`;
    const childClass = this.getElementClassesByTag(childTag);
    if (childClass.length > 0) {
      childOpenTag = `<${childTag} class="${childClass}">`;
    }

    return `${childOpenTag}${childContent}</${childTag}>`;
  }

  getElementClassesByTag(tag: string): string[] {
    const classes = [];
    
    switch (tag) {
      case 'H':
        classes.push('ce-header');
        break;

      case 'CODE':
        classes.push('inline-code');
        break;

      case 'UL':
        classes.push('cdx-list', 'cdx-list--unordered');
        break;

      case 'OL':
        classes.push('cdx-list', 'cdx-list--ordered');
        break;

      case 'PRE':
        classes.push('code-block');
        break;

      case 'BLOCKQUOTE':
        classes.push('quote');
        break;
    }

    return classes;
  }

  setElementTypeByTag(tag: string) {
    switch (tag) {
      case 'H':
        this._elementType = MarkdownElementTypes.Header;
        break;

      case 'UL': 
        this._elementType = MarkdownElementTypes.UnorderedList;
        break;

      case 'OL': 
        this._elementType = MarkdownElementTypes.OrderedList;
        break;

      case 'PRE':
        this._elementType = MarkdownElementTypes.Code;
        break;

      case 'BLOCKQUOTE':
        this._elementType = MarkdownElementTypes.Quote;
        break;

      default:
        this._elementType = MarkdownElementTypes.Paragraph;
        break;
    }
  }

  resetElement() {
    const newElement = this.drawView();
    
    // const originalData = this._element.innerHTML;
    // if (originalData) {
    //   newElement.innerHTML = originalData;
    // }

    this._elementType = MarkdownElementTypes.Paragraph;

    this._element.parentNode!.replaceChild(newElement, this._element);
    this._element = newElement;

    // Give time for the element to refresh then refocus on it again.
    setTimeout(() => {
      this._element.focus();
    }, 50);
  }

}

export default Markdown;