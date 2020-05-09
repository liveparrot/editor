import Markdown from './markdown';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import InlineCode from '@editorjs/inline-code';
import Code from '@editorjs/code';

import TestPlugin from './custom';

const plugins: any = {
  paragraph: Markdown,
  // markdown: Markdown,
  // header: Header,
  // list: List,
  // inlineCode: InlineCode,
  // code: Code,
  // testPlugin: TestPlugin
};  

export default plugins;