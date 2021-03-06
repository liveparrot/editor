import Markdown from "./markdown";
import { MarkdownBlockTypes } from "./types";

class Header extends Markdown {

  static get toolbox() {
    return {
      title: 'Header',
      icon: '<svg width="10" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 14"><path d="M7.6 8.15H2.25v4.525a1.125 1.125 0 0 1-2.25 0V1.125a1.125 1.125 0 1 1 2.25 0V5.9H7.6V1.125a1.125 1.125 0 0 1 2.25 0v11.55a1.125 1.125 0 0 1-2.25 0V8.15z"/></svg>'
    }
  }

  setDefaultMarkdownBlockType(): MarkdownBlockTypes {
    return MarkdownBlockTypes.Header;
  }

}

export default Header;