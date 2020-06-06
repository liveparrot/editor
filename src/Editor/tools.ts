import { Markdown, Header, List, Code, Quote, Breakline } from './plugins/markdown';

// import Paragraph from '@editorjs/paragraph';
// import Header from '@editorjs/header';
// import List from '@editorjs/list';
// import InlineCode from '@editorjs/inline-code';
// import Code from '@editorjs/code';
import ImageTool from '@editorjs/image';

// import TestPlugin from './custom';

const plugins: any = {
  // paragraph: {
  //   class: Paragraph,
  //   inlineToolbar: true
  // },
  paragraph: {
    class: Markdown,
    inlineToolbar: true
  },
  header: Header,
  list: List,
  code: Code,
  quote: Quote,
  breakline: Breakline,
  image: { 
    class: ImageTool,
    config: {
      endpoints: {
        byFile: 'http://localhost:3000/uploadFile', // Your backend file uploader endpoint
        byUrl: 'http://localhost:3000/fetchUrl', // Your endpoint that provides uploading by Url
      }
    }
  }
  // markdown: Markdown,
  // header: Header,
  // list: List,
  // inlineCode: InlineCode,
  // code: Code,
  // testPlugin: TestPlugin
};  

export default plugins;