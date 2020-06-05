import marked from 'marked';
import HTMLJanitor from 'html-janitor';
import VanillaCaret from 'vanilla-caret-js';

// Local imports.
import BaseBlockHelper from './block';
import { MarkdownConstructor, MarkdownBlockTypes, CaretAccuratePosition, MarkdownParserConfig, SanitizedInputKeyEvent } from "../types";
import { sanitizer, markedConfig, parser, rules } from '../config';
import { 
  KEY_ZERO_WIDTH_SPACE,
  KEY_CODE_HASH, 
  KEY_CODE_SPACE, 
  KEY_CODE_BACKSPACE,
  sanitizeKeyCodeEvent,
  sanitizeInputKeyEvent,
  KEY_CODE_ENTER,
  KEY_TAB_SPACE,
  KEY_CODE_TAB
} from '../keys';
import classes from '../classes';


/**
 * A base class that implements the general Markdown verifications.
 */
class BaseMarkdown extends BaseBlockHelper {

  /**
   * Class variables
   */
  data: any;
  element: HTMLElement;

  // Data property
  _blockType!: MarkdownBlockTypes;
  _onPressShiftKey!: boolean;

  // Other helper functions
  marked: any;
  _caret: any;
  __janitor!: any;

  static __enableLineBreaks: boolean;

  static get toolbox() {
    return {
      title: 'Markdown',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.2 -0.3 9 11.4" width="12" height="14"><path d="M0 2.77V.92A1 1 0 01.2.28C.35.1.56 0 .83 0h7.66c.28.01.48.1.63.28.14.17.21.38.21.64v1.85c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26a1 1 0 01-.21-.66V1.69H5.6v7.58h.5c.25 0 .45.08.6.23.17.16.25.35.25.6s-.08.45-.24.6a.87.87 0 01-.62.22H3.21a.87.87 0 01-.61-.22.78.78 0 01-.24-.6c0-.25.08-.44.24-.6a.85.85 0 01.61-.23h.5V1.7H1.73v1.08c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26A1 1 0 010 2.77z"/></svg>',
    };
  }

  /**
   * Automatic sanitize config.
   * This is called whenever `save` function is being called
   */
  static get sanitize() {
    return {
      blockType: false, // disallow HTML
      text: true,
    }
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
    super(res);

    const { data } = res;
    this.data = data;

    this.__setDefaultParameters();
    this.__setDefaultConfigurations();

    this.marked = marked;

    this._onBlockFocus = this._onBlockFocus.bind(this);
    this._onInputKeyDown = this._onInputKeyDown.bind(this);
    this._onInputKeyUp = this._onInputKeyUp.bind(this);

    this.element = this._initView();
  }

  render() {
    return this.element;
  }
  
  save(content: HTMLElement) {
    const c = (content.parentNode! as HTMLElement).innerHTML
    return {
      blockType: this._blockType,
      text: c
    }
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
    const sanitizedInputHTML = inputHTML.replace(/&nbsp;/g, ' ');

    if (this._isMarkdownBlockHeader(sanitizedKeyCode)) {
      const shouldConvertToHeader = rules.block.header.test(sanitizedInputHTML);
      if (shouldConvertToHeader) {
        this.parseBlockMarkdown();
        return true;
      }
    }

    const shouldConvertToList = rules.block.list.test(sanitizedInputHTML);
    if (shouldConvertToList) {

      if (this.shouldAddToPreviousList(sanitizedInputHTML)) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }

      let valueToParse = undefined;
      const matcher = sanitizedInputHTML.match(rules.block.list);
      // Get the second matched group which would determine if there are any characters
      // after the delimeter of list.
      if (matcher && matcher[2].length === 0) {
        valueToParse = `${matcher.input}${KEY_ZERO_WIDTH_SPACE}`;
      }
      
      this.parseBlockMarkdown(valueToParse);
      return true;
    }

    const shouldConvertToQuote = rules.block.quote.test(targetElement.textContent!);
    if (shouldConvertToQuote) {
      this.parseBlockMarkdown(`> ${KEY_ZERO_WIDTH_SPACE}`);
      return true;
    }

    const shouldConvertToBreakline = rules.block.breakline.test(sanitizedInputHTML);
    if (shouldConvertToBreakline) {
      this.parseBlockMarkdown();
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

  parseMarkdownAndSanitize(inputHTML: string): string {
    const blockMarkdown = marked(inputHTML);
    const sanitizedNewElement = this.__janitor.clean(blockMarkdown);

    return sanitizedNewElement;
  }

  parseBlockMarkdown(value?: string, config?: MarkdownParserConfig): HTMLElement | null {
    const inputHTML = value || this.element.innerHTML;
    const sanitizedInputHTML = inputHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/^&gt;/, '>');

    console.log('Sanitized Input HTML:' + sanitizedInputHTML +';');

    const sanitizedNewElement = this.parseMarkdownAndSanitize(sanitizedInputHTML);

    if (sanitizedNewElement.trim().length === 0) {
      console.warn('No new element created after sanitizing. Skipping parsing of block markdown');
      return null;
    }

    // Virtually create a new DOM with the newly parsed and sanitized markdown.
    const documentWithNewElement = new DOMParser().parseFromString(sanitizedNewElement, 'text/html');

    // The virtual DOM will create `<document>..<body>..</body></document`.
    // Safe to assume that the body can be immediately accessed from the document.
    // However the body may be empty!
    const documentBody = documentWithNewElement.getElementsByTagName('body');

    if (documentBody.length === 0 || documentBody[0].children.length === 0) {
      console.warn('The virtual DOM has an empty body. Skipping parsing of block markdown');
      return null;
    }

    // Obtain the first element child and create a new DOM element.
    const newVirtualElementFromDocument = documentBody[0].firstElementChild;

    // Attempt to obtain any nested child element's tag.
    let nestedChildTagName = null;
    if (newVirtualElementFromDocument!.firstElementChild) {
      const firstChild = newVirtualElementFromDocument!.firstElementChild!;
      nestedChildTagName = firstChild.tagName === 'HR' ? firstChild.tagName : null;
    }

    const elementTag = newVirtualElementFromDocument!.tagName;
    
    // This target element can be derived from either the first element parsed, or the nested child.
    // This is important as the horizontal rule needs special parsing.
    const targetElement = nestedChildTagName || elementTag;

    this._setBlockElementTypeByTag(targetElement);

    const newElement = document.createElement(elementTag);
    newElement.classList.add(...this._getElementClassesByTag(targetElement));
    // newElement.dataset.placeholder = 'Type something here';

    // A special condition if the nested's child is a horizontal line.
    // Then set the contenteditable to false.
    newElement.contentEditable = targetElement === 'HR' ? 'false' : 'true';
    newElement.addEventListener('focus', this._onBlockFocus);
    newElement.addEventListener('keydown', this._onInputKeyDown);
    newElement.addEventListener('keyup', this._onInputKeyUp);

    if (elementTag === 'UL' || elementTag ==='OL') {
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
    }
    else {
      // TODO: Reassigning like this may cause performance issue.
      // May look into alternative of appending the child nodes directly.
      // Not sure if there would be any reference issue.
      newElement.innerHTML = newVirtualElementFromDocument!.innerHTML;
    }

    const parserConfig = config || parser.blockConfig;
    console.log('pc', parserConfig);
    if (parserConfig.isInitiatingElement !== true) {
      if (this.element.parentNode) {
        this.element.parentNode!.replaceChild(newElement, this.element);
      }
      else {
        console.warn('Element parent is not found. Is element rendered on screen? Or has it a parent wrapper?')
      }

      this.element = newElement;
      this._caret = new VanillaCaret(this.element);

      if (parserConfig.autoFocus === true) {
        this.element.focus();
        this._caret.setPos(newElement.textContent!.length);    
      }

      // Also include the new <hr> element and insert a new block in the editor.
      if (nestedChildTagName === 'HR') {
        this.insertAndFocusNewBlock();
      }      
    }

    return newElement;
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

  checkAndParseCodeBlockMarkdown(code: string, target: HTMLElement, event: KeyboardEvent) {
    if (code === KEY_CODE_ENTER && target instanceof HTMLElement) {
      // TODO: Support syntax highlighting with language set:
      // ```js
      // ```py
      if (target.textContent!.trim() === '```') {
        // If only there's a cleaner way to prevent creation
        // of a new block line.
        event.preventDefault();
        event.stopPropagation();

        this.parseBlockMarkdown('```\n' + KEY_ZERO_WIDTH_SPACE +'\n```');

        // const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
        // this.api.blocks.delete(currentBlockIndex);

        // Add a slight timeout to shift focus to the <pre> block.
        // setTimeout(() => {
        //   this.focusOnBlock({ 
        //     index: currentBlockIndex - 1, 
        //     setCaretToInitialPosition: true
        //   });
        // }, 50);

        return true;
      }
    }

    return false;
  }

  checkAndDeleteTabs(key: string): boolean {
    if (key === KEY_CODE_BACKSPACE) {
      const codeBlock = this.getActiveElement();

      if (codeBlock) {
        const { absolute, relative: caretPos } = this.getAccurateCaretPos();
        const splitText = codeBlock.innerText.substring(0, caretPos);
        const tabEndingMatcher = splitText.match(rules.endsWithTabs);

        if (tabEndingMatcher) {
          const ends = codeBlock.innerText.substring(caretPos, codeBlock.innerText.length);
          const newTrimmedContent = `${tabEndingMatcher[1]}${ends}`;
          codeBlock.innerText = newTrimmedContent;

          this._caret.setPos(absolute - KEY_TAB_SPACE.length);
          return true;
        }
      }
    }

    return false;
  }

  checkAndInsertTab(key: string): boolean {
    if (key === KEY_CODE_TAB) {
      const codeBlock = this.getActiveElement();
      if (codeBlock) {
        const { absolute, relative: caretPos } = this.getAccurateCaretPos();

        const content = codeBlock.textContent!;
        const tabbedContent = content.insert(caretPos, `${KEY_TAB_SPACE}`);
        codeBlock.innerHTML = tabbedContent;

        this._caret.setPos(absolute + KEY_TAB_SPACE.length);
        return true;
      }
    }

    return false;
  }

  checkAndInsertNewCodeRow(key: string): boolean {
    if (key === KEY_CODE_ENTER) {
      const codeBlock = this.getActiveElement();

      if (codeBlock && codeBlock.parentElement) {
        const { absolute, relative: caretPos } = this.getAccurateCaretPos();
        const codeBlockWrapper = codeBlock.parentElement;
        const content = codeBlock.textContent!;

        const index = this.getCurrentListItemIndex(codeBlockWrapper, codeBlock);        
        let indexToInsert = index + 1;

        if (caretPos === 0) {
          indexToInsert -= 1;
        }

        const splittedText = content.substring(caretPos, content.length)!;
        
        if (splittedText.length > 0 && caretPos > 0) {
          const originalSplittedText = content.substring(0, caretPos);
          codeBlock.innerText = originalSplittedText!;
        }

        const newCodeBlock = document.createElement('DIV');
        newCodeBlock.classList.add('code-edit');

        // Get pre content text.
        // This helps with tabbed content.
        let preContentText = '';
        const startWithTabsMatcher = content.match(rules.startWithTabs);
        if (startWithTabsMatcher) {
          const preContentTabs = startWithTabsMatcher[1];
          preContentText = preContentTabs;
        }

        let newContent = `${preContentText}`;
        if (caretPos === 0 || splittedText.length === 0) {
          newContent = `${newContent}${KEY_ZERO_WIDTH_SPACE}`
        }
        else {
          newContent = `${newContent}${splittedText}`
        }

        newCodeBlock.innerHTML = newContent;

        if (indexToInsert >= codeBlockWrapper.childElementCount) {
          codeBlockWrapper.appendChild(newCodeBlock);
        }
        else {
          codeBlockWrapper.insertBefore(newCodeBlock, codeBlockWrapper.children[indexToInsert]);
        }

        if (caretPos === 0) {
          this.moveCursorToStart(codeBlock);
        } else if (splittedText.length === 0) {
          this.moveCursorToEnd(newCodeBlock);
        } else if (preContentText.length > 0) {
          this._caret.setPos(absolute + preContentText.length)
        } else {
          this.moveCursorToStart(newCodeBlock);
        }

        return true;
      }
    }

    return false;
  }

  getActiveElement(): HTMLElement | null {
    if (this._blockType === MarkdownBlockTypes.OrderedList || 
      this._blockType === MarkdownBlockTypes.UnorderedList) {
      return this.getCurrentListItem();
    }
    else if (this._blockType === MarkdownBlockTypes.Code) {
      return (this.getCurrentListItem('code-edit'));
    }
    else if (this._blockType === MarkdownBlockTypes.Quote) {
      return this.getCurrentListItem('ce-paragraph');
    }

    return this.element;
  }

  getCurrentListItem(childClass: string = `cdx-list__item`): HTMLElement | null {
    return this._getCurrentListItemByClass(childClass);
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
      this._blockType === MarkdownBlockTypes.UnorderedList ||
      this._blockType === MarkdownBlockTypes.Code) {
      const childClass = MarkdownBlockTypes.Code ? 'code-edit' : 'cdx-list__item';

      const activeElement = this.getCurrentListItem(childClass);
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
    else if (sanitizedKeyCode === KEY_CODE_ENTER && this._blockType === MarkdownBlockTypes.Quote) {
      const element = this.getActiveElement();

      // Apply a `cheating` zero width key at the end of the active element (row),
      // then move the cursor to the end.
      // Upon `keyup` event, the "enter" or new line will be added after the div without
      // copying the current inline formatting.
      element!.innerHTML = `${element!.innerHTML}${KEY_ZERO_WIDTH_SPACE}`;
      this.moveCursorToEnd(element!);
      return;
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
    div.addEventListener('keydown', this._onInputKeyDown);
    div.addEventListener('keyup', this._onInputKeyUp);

    this._blockType = MarkdownBlockTypes.Paragraph;
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

    this.element.parentNode!.replaceChild(defaultBlockElement, this.element);
    this.element = defaultBlockElement;

    // Give time for the element to refresh then refocus on it again.
    setTimeout(() => {
      this.element.focus();
    }, 50);
  }

  shouldAddToPreviousList(sanitizedInputHTML: string) {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

    if (currentBlockIndex > 0) {
      const previousBlock = this.api.blocks.getBlockByIndex(currentBlockIndex - 1);
      const editableContentElement: HTMLElement | null = previousBlock.holder.querySelector('[contentEditable="true"]');

      if (editableContentElement && (editableContentElement.tagName === 'UL' || editableContentElement.tagName === 'OL')) {

        const isCreatingNewOrderedList = rules.orderedListDelimeter.test(sanitizedInputHTML);
        if ((isCreatingNewOrderedList && editableContentElement.tagName === 'OL') ||
            (!isCreatingNewOrderedList && editableContentElement.tagName === 'UL')
        ) {
          const matcher = sanitizedInputHTML.match(rules.block.list)!;
          const ihtml = matcher[2];

          const listItemElement = document.createElement('LI');
          listItemElement.classList.add(...this._getElementClassesByTag(listItemElement.tagName));
          listItemElement.innerHTML = ihtml;

          editableContentElement.appendChild(listItemElement);
 
          this.api.blocks.delete(currentBlockIndex);

          // A slight delay highlight the cursor to the end of the list (just added )
          // as the previously edited block is deleted.
          // This is required so that the cursor highlights the correct list item.
          // If not, it'll break the UX flow.
          setTimeout(() => {
            this.moveCursorToEnd(listItemElement);
          }, 50);

          return true;
        }
      }
    }

    return false;
  }

  onKeyDown(blockType: MarkdownBlockTypes, keyEvent: SanitizedInputKeyEvent) {

  }

  onKeyUp(blockType: MarkdownBlockTypes, keyEvent: SanitizedInputKeyEvent) {

  }

  _initView(): HTMLElement {
    let element: HTMLElement;

    if (this.data && Object.keys(this.data).length > 0) {
      element = this._loadFromData(this.data);
    }
    else {
      element = this.drawDefaultView();
    }

    return element;
  }

  /**
   * Draws the default view of the block container
   */
  _loadFromData(data: any): HTMLElement {
    this._blockType = data.blockType;

    // Virtually create a new DOM with the newly parsed and sanitized markdown.
    const documentWithNewElement = new DOMParser().parseFromString(data.text, 'text/html');

    // The virtual DOM will create `<document>..<body>..</body></document`.
    // Safe to assume that the body can be immediately accessed from the document.
    // However the body may be empty!
    const documentBody = documentWithNewElement.getElementsByTagName('body');

    if (documentBody.length === 0 || documentBody[0].children.length === 0) {
      console.warn('The virtual DOM has an empty body. Skipping parsing of block markdown');
      return this.drawDefaultView();
    }

    // Obtain the first element child and create a new DOM element.
    const newVirtualElementFromDocument = documentBody[0].firstElementChild as HTMLElement;
    if (!newVirtualElementFromDocument) {
      return this.drawDefaultView();
    }
    
    newVirtualElementFromDocument.addEventListener('focus', this._onBlockFocus);
    newVirtualElementFromDocument.addEventListener('keydown', this._onInputKeyDown);
    newVirtualElementFromDocument.addEventListener('keyup', this._onInputKeyUp);
    this._caret = new VanillaCaret(newVirtualElementFromDocument);
    
    return newVirtualElementFromDocument as HTMLElement;
  }

  /**
   * When block is focused, the rule of line breaks will need to change accordingly.
   * Not all block type should support line breaks event.
   * 
   * Line breaks event = Pressing enter and going to the next block of the Editor.
   * 
   * This event should be prevented for some block types such as lists, codes and quotes.
   */
  _onBlockFocus() {
    const enableLineBreaks = rules.blockWithCustomLineBreaks.includes(this._blockType);
    BaseMarkdown.setEnableLineBreaks(enableLineBreaks);
  }

  _onInputKeyDown(e: KeyboardEvent) {
    const { target, code, key } = e;

    if (target instanceof HTMLElement) {
      this.onKeyDown(this._blockType, {
        event: e,
        target,
        code: sanitizeKeyCodeEvent(code),
        key: sanitizeInputKeyEvent(key, this._onPressShiftKey)
      })
    }
  }

  _onInputKeyUp(e: KeyboardEvent) {
    const { target, code, key } = e;

    if (target instanceof HTMLElement) {
      this.onKeyUp(this._blockType, {
        event: e,
        target,
        code: sanitizeKeyCodeEvent(code),
        key: sanitizeInputKeyEvent(key, this._onPressShiftKey)
      })
    }
  }
  
  /**
   * 
   * @param keyCode {string}
   */
  _isMarkdownBlockHeader(keyCode: string): boolean {
    return keyCode === KEY_CODE_HASH || keyCode === KEY_CODE_SPACE;
  }

  _getCurrentListItemByClass(childClass: string): HTMLElement | null {
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      let currentNode: HTMLElement = selection.anchorNode as HTMLElement;

      if (currentNode.nodeType !== Node.ELEMENT_NODE) {
        currentNode = currentNode.parentNode! as HTMLElement;
      }
      const node = currentNode.closest(`.${childClass}`) as HTMLElement;

      // Smartly get the nearest node with the list item class CSS!
      return node;
    }

    return null;
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
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
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

      case 'HR':
        this._blockType = MarkdownBlockTypes.Breakline;
        break;

      default:
        this._blockType = MarkdownBlockTypes.Paragraph;
        break;
    }
  }

  /**
   * Initialize default configurations.
   */
  private __setDefaultConfigurations() {
    marked.use({ tokenizer: markedConfig.tokenizer, renderer: markedConfig.renderer });

    this.__janitor = new HTMLJanitor(sanitizer.sanitizerConfig)
  }

  /**
   * Initialize the default parameters set to the class properties.
   */
  private __setDefaultParameters() {
    this._blockType = MarkdownBlockTypes.Paragraph;
    this._onPressShiftKey = false;
  }
  
  /**
   * Helps to dispatch a custom event that the window/document
   * can subscribe to.
   * 
   * This event will be called whenever a `keydown` is started.
   * 
   * @param e {KeyboardEvent}
   */
  __onDispatchMasterEvent(e: KeyboardEvent) {
    if (e.target as HTMLElement) {
      e.target?.dispatchEvent(
        new Event('myevent', { bubbles: true })
      );
    }
  }

}

export default BaseMarkdown;