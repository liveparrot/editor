import { API } from "@editorjs/editorjs";

import { MarkdownConstructor, EditorBlockFocus } from "../types";
/**
 * Base class to support block helper methods.
 * Also help to document various helper methods for DOM manipulations.
 */
class BaseBlockHelper {

  /**
   * Class variables
   */
  api: API;

  constructor({ api }: MarkdownConstructor) {
    this.api = api;
  }

  moveCursorToStart(el: HTMLElement) {
    el.focus();

    if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);

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

  insertAndFocusNewBlock() {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
    const newBlockIndex = currentBlockIndex + 1;

    // Call API to insert a new block.
    this.api.blocks.insert(undefined, undefined, undefined, newBlockIndex, true);

    this.focusOnBlock({ index: newBlockIndex });
  }

  focusOnBlock({ index, setCaretToInitialPosition }: EditorBlockFocus) {
    // However, since the editable content is not directly at the new block,
    // the editable content has to be obtained and set focus.
    // Obtain the editable content by querying its property: contentEdtaible: true
    const newBlock = this.api.blocks.getBlockByIndex(index);

    // const editableContentElement: any = newBlock.firstElementChild!.firstElementChild!
    const editableContentElement: HTMLElement | null = newBlock.holder.querySelector('[contentEditable="true"]');

    if (editableContentElement) {
      editableContentElement.focus();

      if (setCaretToInitialPosition === true) {
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

}

export default BaseBlockHelper;