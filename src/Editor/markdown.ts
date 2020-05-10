import { API, SanitizerConfig } from '@editorjs/editorjs';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token';
import VanillaCaret from 'vanilla-caret-js';

import marked, { MarkedOptions,  } from 'marked';
import DOMPurify from 'dompurify';

import Diff from 'diff';

import "../ext-string";

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

const escapes: [RegExp, string][] = [
  // [/\\/g, '\\\\'],
  // [/\*/g, '\\*'],
  // [/^-/g, '\\-'],
  // [/^\+ /g, '\\+ '],
  // [/^(=+)/g, '\\$1'],
  // [/^(#{1,6}) /g, '\\$1 '],
  // [/`/g, '\\`'],
  // [/^~~~/g, '\\~~~'],
  // [/\[/g, '\\['],
  // [/\]/g, '\\]'],
  // [/^>/g, '\\>'],
  // [/_/g, '\\_'],
  // [/^(\d+)\. /g, '$1\\. ']
  [/&nbsp;/g, ' ']
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
  OrderedList
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
  code: inlineCodeSanitizer
};

const KEY_HASH = 'digit3';
const KEY_SPACE = 'space';

const MARKDOWN_VERIFIER: any = {
  '*': [/\*\*/g, /\*/g],
  '_': [/__/g, /_/g],
  '~': [/\~/g],
  '`': [/`/g],
};

const REGEX_MARKDOWN_HEADER = /^#{1,6}[\s|\\u00A0|&nbsp;]{1}/;
const REGEX_MARKDOWN_LIST = /^(-{1}|1\.)[\s|\\u00A0].+/;

// const tokenizer: Tokenizer = {
//   em(src: string) {
//     const rules = /^_([^\s_])_(?!_)|^_([^\s_<][\s\S]*?[^\s_])_(?!_|[^\s,punctuation])|^_([^\s_<][\s\S]*?[^\s])_(?!_|[^\s,punctuation])/;
//     const cap = rules.exec(src);

//     if (cap) {
//       return {
//         type: 'em',
//         raw: cap[0],
//         text: cap[3] || cap[2] || cap[1] || cap[0]
//       };
//     }
//   }
// };

//marked.setOptions(options);
// marked.use({
//   tokenizer
// });

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

  _tempHolder: any;
  _onPressSpaceToEscapeMarkdown: boolean;
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
    
    this._elementType = MarkdownElementTypes.Paragraph;
    this._timeoutFunction = null;

    this._editableSelection= [-1, -1, 0];
    this._rawCaretPosition = 0;
    this._rawValue = '';
    this._tempHolder = [];
    this._onPressSpaceToEscapeMarkdown = false;
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

    return false;
  }

  checkAndClearMarkdown(keyCode: string): boolean {
    // TODO: Support delete button also.
    if (keyCode === 'backspace') {
      const textContent = this._element.textContent!;

      console.log('TExt content:' + textContent + ';');

      // Reset element.
      if (textContent.length === 0) {
        this.resetElement();
        return true;
      }
    }

    return false;
  }

  checkAndParseSpaceToEscapeMarkdown(keyCode: string): boolean {
    const sanitizedKeyCode = keyCode.toLowerCase();
    if (sanitizedKeyCode.toLowerCase() === 'space' && this._onPressSpaceToEscapeMarkdown) {
      this._onPressSpaceToEscapeMarkdown = false;

      const textContent = this._element.textContent!;
      setTimeout(() => {
        this._caret.setPos(textContent.length);
      }, 50);
      return true;
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
    let toMarkdown = false;

    const inputHTML = this._element.innerHTML;
    if (MARKDOWN_VERIFIER[inputKey]) {
      const matcher = MARKDOWN_VERIFIER[inputKey];
      matcher.every((matchingRegex: RegExp) => {
        const matches = inputHTML.match(matchingRegex);

        // Must exist and comes in pair!
        if (matches !== null && matches.length === 2) {
          toMarkdown = true;
          return false;
        }

        return true;
      });
    }

    if (toMarkdown) {
      this.parseInlineMarkdown();
    }
  }

  get _currentListItem(): HTMLElement | null {
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      let currentNode: HTMLElement = selection.anchorNode as HTMLElement;

      if (currentNode.nodeType !== Node.ELEMENT_NODE) {
        currentNode = currentNode.parentNode! as HTMLElement;
      }

      // Smartly get the nearest node with the list item class CSS!
      return currentNode.closest(`.cdx-list__item`);
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

  onListItemKeyDown(e: KeyboardEvent) {
    const { key, target: listElement } = e;
    const sanitizedKey = key.toLowerCase();

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
          }
        }
      }
    }
  }

  insertAndFocusNewBlock() {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
    const newBlockIndex = currentBlockIndex + 1;

    // Call API to insert a new block.
    this.api.blocks.insert(undefined, undefined, undefined, newBlockIndex, true);

    this.focusNextNewBlock(newBlockIndex);
  }

  focusNextNewBlock(newBlockIndex: number) {
    // However, since the editable content is not directly at the new block,
    // the editable content has to be obtained and set focus.
    // The current structure sets that the editable content is 
    // nested two times into the new block.
    // If there is a change in strucutre, this has to change too!
    const newBlock = this.api.blocks.getBlockByIndex(newBlockIndex);
    const editableContentElement: any = newBlock.firstElementChild!.firstElementChild!
    editableContentElement.focus();
  }

  removeNextBlock() {
    this.api.blocks.delete(this.api.blocks.getCurrentBlockIndex() + 1);
  }

  parseBlockMarkdown() {
    const inputValue = this._element.innerHTML;
    const sanitizedInputValue = inputValue.replace(/&nbsp;/g, ' ');
    console.log('Sanitized Input Value:' + sanitizedInputValue +';');

    const blockMarkdown = marked(sanitizedInputValue);
    const newElement = this.api.sanitizer.clean(blockMarkdown, SANITIZER_CONFIG);

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
        if (this._elementType === MarkdownElementTypes.OrderedList || this._elementType === MarkdownElementTypes.UnorderedList) {
          Markdown.setEnableLineBreaks(true);
        }
        else {
          Markdown.setEnableLineBreaks(false);
        }
      });

      if (elementTag === 'UL' || elementTag === 'OL') {
        newElement.addEventListener('keydown', this.onListItemKeyDown);

        console.log(newElementFromDocument);
        const listItemInnerHTML = newElementFromDocument!.firstElementChild?.innerHTML;
        
        const listItemElement = document.createElement('li');
        listItemElement.classList.add('cdx-list__item');
        
        listItemElement.innerHTML = listItemInnerHTML!;
        newElement.appendChild(listItemElement);
      }
      else {
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
    const inlineMarkdown = marked(this._element.innerHTML);
    // console.log(inlineMarkdown);
    const newElement = this.api.sanitizer.clean(inlineMarkdown, SANITIZER_CONFIG);
    // console.log('sanitized:' + newElement);

    this._element.innerHTML = newElement;
    this._caret.setPos(this._element.textContent!.length)
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

  onTheRightKeyDown(e: KeyboardEvent) {
    const { code } = e;
    
    this._rawValue = this._element.innerHTML;
    
    if (code.toLowerCase() === 'space') {
      const caretPos = this._caret.getPos();
      const textContent = this._element.textContent!;

      if (caretPos >= (textContent.length - 1)) {
        const inputHTML = this._element.innerHTML.replace('\n', '');

        const regex = /<\/[a-z][\s\S]*>$/;
        if (regex.test(inputHTML)) {
          const matchingRegex = inputHTML.match(regex)!;
          const sanitizedInputHTML = inputHTML.replace(`&nbsp;${matchingRegex[0]}`, matchingRegex[0]);

          const escapeMarkdownHTML = `${sanitizedInputHTML}&nbsp;`;
          this._element.innerHTML = escapeMarkdownHTML;
          this._caret.setPos(caretPos + 1);

          this._onPressSpaceToEscapeMarkdown = true;

          return;
        }
      }
    }

    this.toggleShiftKey(e);
  }

  onKeyUp(e: KeyboardEvent) {
    const { code } = e;
    
    // This is working header validation.
    if (this.checkAndParseBlockMarkdown(code)) {
      return;
    }

    if (this.checkAndParseSpaceToEscapeMarkdown(code)) {
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
    const { code } = e;
    
    if (this.checkAndParseSpaceToEscapeMarkdown(code)) {
      return;
    }
    
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