import { API } from "@editorjs/editorjs";
import marked from 'marked';
import HTMLJanitor from 'html-janitor';
import VanillaCaret from 'vanilla-caret-js';

// Local imports.
import { MarkdownConstructor, MarkdownBlockTypes, CaretAccuratePosition } from "./types";
import { sanitizerConfig } from './config/sanitizer';
import { renderer, tokenizer } from './config/marked';
import { 
  KEY_ZERO_WIDTH_SPACE,
  KEY_CODE_HASH, 
  KEY_CODE_SPACE, 
  KEY_CODE_BACKSPACE,
  sanitizeKeyCodeEvent,
  sanitizeInputKeyEvent,
  KEY_CODE_ENTER
} from './keys';
import classes from './classes';
import rules from './config/rules';


/**
 * A base class that implements the general Markdown verifications.
 */
class BaseMarkdown {

  /**
   * Class variables
   */
  data: any;
  api: API;
  element: HTMLElement;

  // Data property
  _blockType!: MarkdownBlockTypes;
  _onPressShiftKey!: boolean;

  // Other helper functions
  _caret: any;
  __janitor!: any;

  static __enableLineBreaks: boolean;

  static get toolbox() {
    return {
      title: 'Markdown',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.2 -0.3 9 11.4" width="12" height="14"><path d="M0 2.77V.92A1 1 0 01.2.28C.35.1.56 0 .83 0h7.66c.28.01.48.1.63.28.14.17.21.38.21.64v1.85c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26a1 1 0 01-.21-.66V1.69H5.6v7.58h.5c.25 0 .45.08.6.23.17.16.25.35.25.6s-.08.45-.24.6a.87.87 0 01-.62.22H3.21a.87.87 0 01-.61-.22.78.78 0 01-.24-.6c0-.25.08-.44.24-.6a.85.85 0 01.61-.23h.5V1.7H1.73v1.08c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26A1 1 0 010 2.77z"/></svg>',
    };
  }

  static get enableLineBreaks() {
    if (this.__enableLineBreaks === undefined) {
      this.__enableLineBreaks = false;
    }
    return this.__enableLineBreaks;
  }

  static setEnableLineBreaks(isEnabled: any) {
    this.__enableLineBreaks = isEnabled;
  }

  /**
   * 
   * @param res 
   */
  constructor(res: MarkdownConstructor) {
    const { data, api } = res;
    this.data = data;
    this.api = api;

    this.__setDefaultParameters();
    this.__setDefaultConfigurations();

    this._onBlockFocus = this._onBlockFocus.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlockKeyUp = this._onBlockKeyUp.bind(this);
    this._onPreCodeKeyDown = this._onPreCodeKeyDown.bind(this);
    this._onListItemKeyDown = this._onListItemKeyDown.bind(this);
    this._onListItemKeyUp = this._onListItemKeyUp.bind(this);

    this.element = this.drawDefaultView();
  }

  render() {
    return this.element;
  }
  
  save(content: any) {
    console.log('## save:', content);
  }

  /**
   * Performs some validation rules of whether should parse to a block markdown.
   * @param e {KeyboardEvent}
   */
  checkAndParseBlockMarkdown(e: KeyboardEvent): boolean {
    const { code, target: targetElement } = e;
    const sanitizedKeyCode = sanitizeKeyCodeEvent(code);

    if (!(targetElement instanceof HTMLElement)) {
      return false;
    }

    const inputHTML: string = targetElement.innerHTML;

    if (this._isMarkdownBlockHeader(sanitizedKeyCode)) {
      const shouldConvertToHeader = rules.block.header.test(inputHTML);
      if (shouldConvertToHeader) {
        this.parseBlockMarkdown();
        return true;
      }
    }

    const shouldConvertToList = rules.block.list.test(inputHTML);
    if (shouldConvertToList) {
      this.parseBlockMarkdown();
      return true;
    }

    const shouldConvertToQuote = rules.block.quote.test(targetElement.textContent!);
    if (shouldConvertToQuote) {
      this.parseBlockMarkdown('> &#8203;');
      return true;
    }

    return false;
  }

  checkAndParseInlineMarkdown(keyCode: string): boolean {
    let toMarkdown = false;

    const targetElement = this.getActiveElement();
    if (!targetElement) {
      console.warn('Target element not found. Skip checking and parsing of inline markdown');
      return false;
    }

    const inputHTML = targetElement.innerHTML;
    console.log('Input html: ' + inputHTML);

    if (rules.verifier[keyCode]) {
      const matcher = rules.verifier[keyCode];
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
      return true;
    }

    return false;
  }

  checkAndClearMarkdown(keyCode: string): boolean {
    const targetElement = this.getActiveElement();
    if (!targetElement) {
      return false;
    }

    // TODO: To support `delete` button as well?
    if (keyCode === KEY_CODE_BACKSPACE) {
      const textContent = targetElement.textContent!;

      // Reset element if no texts.
      if (textContent.length === 0) {
        this.resetBlockElement();
        return true;
      }
    }

    return false;
  }

  /**
   * Removes any zero width special character if found.
   * Use this function in a keyup event.
   * 
   * It manipulated the value of the element by resetting the innerHTML
   * 
   * @param element {HTMLElement} Element to perform checks and manipulation
   * @returns If successfully parsed
   */
  checkAndClearZeroWidthCharacter(element: HTMLElement): boolean {
    const value = element.textContent;
    if (!value) {
      return false;
    }
    
    // If character is found, results of matcher will return an array of matched conditions.
    const zeroWidthCharMatcher = value.match(rules.zeroWidthCharacter);
    if (zeroWidthCharMatcher !== null && value.trim().length > 1) {
      element.innerHTML = element.innerHTML.replace(rules.zeroWidthCharacter, '');

      // Reset position of caret.
      this.moveCursorToEnd(element);
      return true;
    }

    return false;
  }

  parseBlockMarkdown(value?: string) {
    const inputHTML = value || this.element.innerHTML;
    const sanitizedInputHTML = inputHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/^&gt;/, '>');

    console.log('Sanitized Input HTML:' + sanitizedInputHTML +';');

    const blockMarkdown = marked(sanitizedInputHTML);
    const sanitizedNewElement = this.__janitor.clean(blockMarkdown);

    console.log('sanitized new element:' + sanitizedNewElement);

    if (sanitizedNewElement.trim().length === 0) {
      console.warn('No new element created after sanitizing. Skipping parsing of block markdown');
      return;
    }

    // Virtually create a new DOM with the newly parsed and sanitized markdown.
    const documentWithNewElement = new DOMParser().parseFromString(sanitizedNewElement, 'text/html');

    // The virtual DOM will create `<document>..<body>..</body></document`.
    // Safe to assume that the body can be immediately accessed from the document.
    // However the body may be empty!
    const documentBody = documentWithNewElement.getElementsByTagName('body');

    if (documentBody.length === 0) {
      console.warn('The virtual DOM has an empty body. Skipping parsing of block markdown');
      return;
    }

    // Obtain the first element child and create a new DOM element.
    const newVirtualElementFromDocument = documentBody[0].firstElementChild;
    const elementTag = newVirtualElementFromDocument!.tagName;

    this._setBlockElementTypeByTag(elementTag);

    const newElement = document.createElement(elementTag);
    newElement.classList.add(...this._getElementClassesByTag(elementTag));
    // newElement.dataset.placeholder = 'Type something here';
    newElement.contentEditable = 'true';
    newElement.addEventListener('focus', this._onBlockFocus);

    if (elementTag === 'UL' || elementTag ==='OL') {
      newElement.addEventListener('keydown', this._onListItemKeyDown);
      newElement.addEventListener('keyup', this._onListItemKeyUp);

      // The first inner item of the list.
      // It would be created when markdown is parsed.
      const listItem = newVirtualElementFromDocument!.firstElementChild!;
      
      const listItemElement = document.createElement(listItem.tagName);
      listItemElement.classList.add(...this._getElementClassesByTag(listItem.tagName));

      listItemElement.innerHTML = listItem.innerHTML;
      newElement.appendChild(listItemElement);
    }
    else if (elementTag === 'PRE' || elementTag === 'BLOCKQUOTE') {
      newElement.innerHTML = newVirtualElementFromDocument!.innerHTML;
      newElement.addEventListener('keydown', this._onPreCodeKeyDown);
      newElement.addEventListener('keyup', (e) => {
        if (e.target instanceof HTMLElement) {
          this.checkAndClearZeroWidthCharacter(e.target);
        }
      })
    }
    else {
      // TODO: Reassigning like this may cause performance issue.
      // May look into alternative of appending the child nodes directly.
      // Not sure if there would be any reference issue.
      newElement.innerHTML = newVirtualElementFromDocument!.innerHTML;

      newElement.addEventListener('keydown', this._onKeyDown);
      newElement.addEventListener('keyup', this._onBlockKeyUp);
    }

    this.element.parentNode!.replaceChild(newElement, this.element);
    this.element = newElement;
    this._caret = new VanillaCaret(this.element);

    this.element.focus();
    this._caret.setPos(this.element.textContent!.length);
  }

  parseInlineMarkdown() {
    const targetElement = this.getActiveElement();
    if (!targetElement) {
      console.warn('Target element not found. Skip checking and parsing of inline markdown');
      return;
    }

    const sanitizedInputHTML = targetElement.innerHTML.replace(/&nbsp;/g, ' ');
    const inlineMarkdown = marked(sanitizedInputHTML);

    const newElement = this.__janitor.clean(inlineMarkdown);

    targetElement.innerHTML = newElement;
    this.moveCursorToEnd(targetElement);
  }

  getActiveElement(): HTMLElement | null {
    if (this._blockType === MarkdownBlockTypes.OrderedList || 
      this._blockType === MarkdownBlockTypes.UnorderedList) {
      return this.getCurrentListItem();
    }

    return this.element;
  }

  getCurrentListItem(): HTMLElement | null {
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      let currentNode: HTMLElement = selection.anchorNode as HTMLElement;

      if (currentNode.nodeType !== Node.ELEMENT_NODE) {
        currentNode = currentNode.parentNode! as HTMLElement;
      }

      // Smartly get the nearest node with the list item class CSS!
      const node = currentNode.closest(`.cdx-list__item`) as HTMLElement;
      return node;
    }

    return null;
  }

  getCurrentListItemIndex(listElement: HTMLElement, selectedListItemNode: HTMLElement): number {
    let position = -1;
    listElement.childNodes.forEach((childNode, index) => {
      const child = childNode as HTMLElement;
      if (child === selectedListItemNode) {
        position = index;
      }
    });

    return position;
  }

  getAccurateCaretPos(): CaretAccuratePosition {
    const caretPos = this._caret.getPos();

    const defaultCaretPos = {
      absolute: caretPos,
      relative: caretPos
    };

    if (this._blockType === MarkdownBlockTypes.OrderedList || 
      this._blockType === MarkdownBlockTypes.UnorderedList) {

      const activeElement = this.getCurrentListItem();
      if (!activeElement) {
        return defaultCaretPos;
      }

      const activeElementIndex = this.getCurrentListItemIndex(this.element, activeElement);

      if (activeElementIndex < 1) {
        return defaultCaretPos;
      }

      let previousCumulativeTextLengths = 0;
      for (let i = 0 ; i < activeElementIndex ; i++) {
        const child = this.element.childNodes.item(i) as HTMLElement;
        previousCumulativeTextLengths += child.textContent ? child.textContent.length : 0;
      }

      const relativeCaretPos = caretPos - previousCumulativeTextLengths;
      return {
        absolute: caretPos,
        relative: relativeCaretPos
      };
    }

    return defaultCaretPos;
  }

  toggleNeutralCallbacks(e: KeyboardEvent) {
    const { code } = e;
    const sanitizedKeyCode = sanitizeKeyCodeEvent(code);

    const targetElement = this.getActiveElement();
    if (!targetElement) {
      return;
    }

    if (sanitizedKeyCode === KEY_CODE_SPACE) {
      const { relative } = this.getAccurateCaretPos();
      const inputTextContent = targetElement.textContent!;

      if (relative >= (inputTextContent.length - 1)) {
        const inputHTML = targetElement.innerHTML.replace('\n', '');

        if (rules.endTag.test(inputHTML)) {
          const matchingRegex = inputHTML.match(rules.endTag)!;
          const sanitizedInputHTML = inputHTML.replace(`&nbsp;${matchingRegex[0]}`, matchingRegex[0]);

          const escapeMarkdownHTML = `${sanitizedInputHTML}&nbsp;`;
          targetElement.innerHTML = escapeMarkdownHTML;

          // Stop spacebar from kicking in!
          e.preventDefault();
          e.stopPropagation();

          this.moveCursorToEnd(targetElement);
          return;
        }
      }      
    }
    
    this.toggleShiftKey(e);
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

  /**
   * Draws the default view of the block container
   */
  drawDefaultView(): HTMLElement {
    const tag = 'DIV';
    const div = document.createElement(tag);

    const divClasses = this._getElementClassesByTag(tag);

    div.classList.add(...divClasses, this.api.styles.block);
    div.contentEditable = 'true';
    //div.dataset.placeholder = 'Write something here';

    div.addEventListener('focus', this._onBlockFocus);
    div.addEventListener('keydown', this._onKeyDown);
    div.addEventListener('keyup', this._onKeyUp);

    this._caret = new VanillaCaret(div);

    return div;
  }

  resetBlockElement() {
    const defaultBlockElement = this.drawDefaultView();

    // TODO: Consider if want to reassign previous data.
    // const originalData = this._element.innerHTML;
    // if (originalData) {
    //   newElement.innerHTML = originalData;
    // }

    this._blockType = MarkdownBlockTypes.Paragraph;

    this.element.parentNode!.replaceChild(defaultBlockElement, this.element);
    this.element = defaultBlockElement;

    // Give time for the element to refresh then refocus on it again.
    setTimeout(() => {
      this.element.focus();
    }, 50);
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

  _onBlockFocus() {
    const enableLineBreaks = rules.blockWithCustomLineBreaks.includes(this._blockType);
    BaseMarkdown.setEnableLineBreaks(enableLineBreaks);
  }

  _onKeyDown(e: KeyboardEvent) {
    const { code, target } = e;
    const sanitizedKeyCode = sanitizeKeyCodeEvent(code);

    if (sanitizedKeyCode === KEY_CODE_ENTER && target instanceof HTMLElement) {
      // TODO: Support syntax highlighting with language set:
      // ```js
      // ```py
      if (target.textContent!.trim() === '```') {
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

  _onKeyUp(e: KeyboardEvent) {
    // This is working header validation.
    if (this.checkAndParseBlockMarkdown(e)) {
      return;
    }

    const { key: inputKey } = e;
    const sanitizedKey = sanitizeInputKeyEvent(inputKey, this._onPressShiftKey);

    if (this.checkAndClearMarkdown(sanitizedKey)) {
      return;
    }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  _onBlockKeyUp(e: KeyboardEvent) {
    const { key: inputKey } = e;
    const sanitizedKey = sanitizeInputKeyEvent(inputKey, this._onPressShiftKey);

    if (this.checkAndClearMarkdown(sanitizedKey)) {
      return;
    }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  _onPreCodeKeyDown(e: KeyboardEvent) {
    const { absolute, relative } = this.getAccurateCaretPos();
      console.log('abs:' + absolute + '; rel:' + relative);
    const { key: inputKey } = e;
    const sanitizedKey = sanitizeInputKeyEvent(inputKey, this._onPressShiftKey);

    if (sanitizedKey === KEY_CODE_ENTER && e.metaKey) {
      this.insertAndFocusNewBlock();

      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  _onListItemKeyDown(e: KeyboardEvent) {
    const { 
      key: inputKey, 
      target: listElement 
    } = e;
    const sanitizedKey = sanitizeInputKeyEvent(inputKey, this._onPressShiftKey);

    if (
      (sanitizedKey === KEY_CODE_ENTER || sanitizedKey === KEY_CODE_BACKSPACE) &&
      listElement instanceof HTMLElement
    ) {
      const selectedListItemNode = this.getCurrentListItem();
      if (selectedListItemNode) {
        const lengthOfItems = listElement.children.length;
        const index = this.getCurrentListItemIndex(listElement, selectedListItemNode);

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

  _onListItemKeyUp(e: KeyboardEvent) {
    const { key: inputKey } = e;
    const sanitizedKey = sanitizeInputKeyEvent(inputKey, this._onPressShiftKey);

    // if (this.checkAndClearMarkdown(sanitizedKey)) {
    //   return;
    // }

    this.checkAndParseInlineMarkdown(sanitizedKey);
  }

  /**
   * 
   * @param keyCode {string}
   */
  _isMarkdownBlockHeader(keyCode: string): boolean {
    return keyCode === KEY_CODE_HASH || keyCode === KEY_CODE_SPACE;
  }

  _getElementClassesByTag(tag: string): readonly string[] {
    const classCollection: string[] = [];

    const cssClassesFromTag = classes[tag];
    if (cssClassesFromTag) {
      classCollection.push(...cssClassesFromTag);
    }

    return classCollection;
  } 

  _setBlockElementTypeByTag(tag: string) {
    switch (tag) {
      case 'H':
        this._blockType = MarkdownBlockTypes.Header;
        break;

      case 'UL': 
        this._blockType = MarkdownBlockTypes.UnorderedList;
        break;

      case 'OL': 
        this._blockType = MarkdownBlockTypes.OrderedList;
        break;

      case 'PRE':
        this._blockType = MarkdownBlockTypes.Code;
        break;

      case 'BLOCKQUOTE':
        this._blockType = MarkdownBlockTypes.Quote;
        break;

      default:
        this._blockType = MarkdownBlockTypes.Paragraph;
        break;
    }
  }

  /**
   * Initialize default configurations.
   */
  __setDefaultConfigurations() {
    marked.use({ tokenizer, renderer });

    this.__janitor = new HTMLJanitor(sanitizerConfig)
  }

  /**
   * Initialize the default parameters set to the class properties.
   */
  __setDefaultParameters() {
    this._blockType = MarkdownBlockTypes.Paragraph;
    this._onPressShiftKey = false;
  }

}

export default BaseMarkdown;