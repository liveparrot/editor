import Markdown from './plugins/markdown';
import MarkdownBase from './plugins/markdown/base';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import InlineCode from '@editorjs/inline-code';
import Code from '@editorjs/code';

import TestPlugin from './custom';

const plugins: any = {
  paragraph: MarkdownBase,
  // markdown: Markdown,
  // header: Header,
  // list: List,
  // inlineCode: InlineCode,
  // code: Code,
  // testPlugin: TestPlugin
};  

export default plugins;