import VanillaCaret from 'vanilla-caret-js';

import BaseMarkdown from "./base/markdown";
import { SanitizedInputKeyEvent, MarkdownBlockTypes } from './types';
import { KEY_CODE_ENTER, KEY_CODE_BACKSPACE } from "./keys";

class Markdown extends BaseMarkdown {
  
  static get toolbox() {
    return {
      title: 'Paragraph',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.2 -0.3 9 11.4" width="12" height="14"><path d="M0 2.77V.92A1 1 0 01.2.28C.35.1.56 0 .83 0h7.66c.28.01.48.1.63.28.14.17.21.38.21.64v1.85c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26a1 1 0 01-.21-.66V1.69H5.6v7.58h.5c.25 0 .45.08.6.23.17.16.25.35.25.6s-.08.45-.24.6a.87.87 0 01-.62.22H3.21a.87.87 0 01-.61-.22.78.78 0 01-.24-.6c0-.25.08-.44.24-.6a.85.85 0 01.61-.23h.5V1.7H1.73v1.08c0 .26-.08.48-.23.66-.15.17-.37.26-.66.26-.28 0-.5-.09-.64-.26A1 1 0 010 2.77z"/></svg>',
    };
  }

  onKeyDown(blockType: MarkdownBlockTypes, keyEvent: SanitizedInputKeyEvent) {
    switch (blockType) {
      case MarkdownBlockTypes.Paragraph:
        this.onParagraphKeyDown(keyEvent);
        break;

      case MarkdownBlockTypes.Header:
        this.onHeaderKeyDown(keyEvent);
        break;

      case MarkdownBlockTypes.UnorderedList:
      case MarkdownBlockTypes.OrderedList:
        this.onListKeyDown(keyEvent);
        break;

      case MarkdownBlockTypes.Code:
        this.onCodeKeyDown(keyEvent);
        break;

      case MarkdownBlockTypes.Quote:
        this.onQuoteKeyDown(keyEvent);
        break;
    };
  };

  onKeyUp(blockType: MarkdownBlockTypes, keyEvent: SanitizedInputKeyEvent) {
    switch (blockType) {
      case MarkdownBlockTypes.Paragraph:
        this.onParagraphKeyUp(keyEvent);
        break;

      case MarkdownBlockTypes.Header:
        this.onHeaderKeyUp(keyEvent);
        break;

      case MarkdownBlockTypes.UnorderedList:
      case MarkdownBlockTypes.OrderedList:
        this.onListKeyUp(keyEvent);
        break;

      case MarkdownBlockTypes.Code:
        this.onCodeKeyUp(keyEvent);
        break;

      case MarkdownBlockTypes.Quote:
        this.onQuoteKeyUp(keyEvent);
        break;
    };
  };

  drawDefaultView(): HTMLElement {
    return this.drawParagraph();
  }

  onParagraphKeyDown(keyEvent: SanitizedInputKeyEvent) {
    const { event, target, code } = keyEvent;

    const isParsedCodeBlock = this.checkAndParseCodeBlockMarkdown(code, target);
    if (isParsedCodeBlock) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.toggleNeutralCallbacks(event);
  }

  onParagraphKeyUp(keyEvent: SanitizedInputKeyEvent) {
    const { event, key } = keyEvent;

    // This is working header validation.
    if (this.checkAndParseBlockMarkdown(event)) {
      return;
    }

    if (this.checkAndClearMarkdown(key)) {
      return;
    }

    this.checkAndParseInlineMarkdown(key);
  }

  onHeaderKeyDown(keyEvent: SanitizedInputKeyEvent) {
    const { event } = keyEvent;
    this.toggleNeutralCallbacks(event);
  }

  onHeaderKeyUp(keyEvent: SanitizedInputKeyEvent) {
    const { key } = keyEvent;

    if (this.checkAndClearMarkdown(key)) {
      return;
    }

    this.checkAndParseInlineMarkdown(key);
  }

  onListKeyDown(keyEvent: SanitizedInputKeyEvent) {
    const { event, key, target: listElement } = keyEvent;

    if (key === KEY_CODE_ENTER || key === KEY_CODE_BACKSPACE) {
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

            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      }
    }

    this.toggleNeutralCallbacks(event);
  }

  onListKeyUp(keyEvent: SanitizedInputKeyEvent) {
    const { key, target } = keyEvent;
    
    if (this.checkAndParseInlineMarkdown(key)) {
      return;
    }

    this.checkAndClearZeroWidthCharacter(target);
  }

  onCodeKeyDown(keyEvent: SanitizedInputKeyEvent) {
    const { key, event } = keyEvent;

    if (key === KEY_CODE_ENTER && event.metaKey) {
      this.insertAndFocusNewBlock();

      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  onCodeKeyUp(keyEvent: SanitizedInputKeyEvent) {
    const { key, target } = keyEvent;

    if (this.checkAndParseInlineMarkdown(key)) {
      return;
    }

    this.checkAndClearZeroWidthCharacter(target);
  }

  onQuoteKeyDown(keyEvent: SanitizedInputKeyEvent) {
    const { key, event } = keyEvent;

    if (key === KEY_CODE_ENTER && event.metaKey) {
      this.insertAndFocusNewBlock();

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.toggleNeutralCallbacks(event);
  }

  onQuoteKeyUp(keyEvent: SanitizedInputKeyEvent) {
    const { key, target } = keyEvent;

    if (this.checkAndParseInlineMarkdown(key)) {
      return;
    }

    this.checkAndClearZeroWidthCharacter(target);
  }

  drawParagraph(): HTMLElement {
    console.log('Yo!');
    console.log(this.marked('# '));

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

  drawHeader(): HTMLElement {
    const headerElement =  this.parseBlockMarkdown('# ', {
      isInitiatingElement: true
    });

    if (!headerElement) {
      return this.drawParagraph();
    }

    this._onBlockFocus();
    return headerElement;
  }

}

export default Markdown;