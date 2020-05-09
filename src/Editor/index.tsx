import * as React from 'react';
import EditorJS from 'react-editor-js';

import tools from './tools';

const Editor = (props: any) => {
  const { instanceRef } = props;
  return (
    <EditorJS 
      instanceRef={instance => {instanceRef.current = instance}} 
      tools={tools} 
      // data={{
      //   time: 1556098174501,
      //   blocks: [
      //     {
      //       type: "header",
      //       data: {
      //         text: "Editor.js",
      //         level: 1
      //       }
      //     },
      //     {
      //       type: "header",
      //       data: {
      //         text: "(2) Editor.js",
      //         level: 2
      //       }
      //     },
      //     {
      //       type: "header",
      //       data: {
      //         text: "(3) Editor.js",
      //         level: 3
      //       }
      //     },
      //     {
      //       type: "paragraph",
      //       data: {
      //         text:
      //           "Hey. Meet the new Editor. On this page you can see it in action — try to edit this text."
      //       }
      //     },
      //   ],
      //   version: "2.12.4"
      // }}
      autofocus
    />
  )
};

export default Editor;