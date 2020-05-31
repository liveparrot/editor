import React, { useState, useEffect } from 'react';
import EditorJS from 'react-editor-js';

import tools from './tools';

const Editor = (props: any) => {
  const [data, setData] = useState(undefined);
  const { instanceRef } = props;

  const loadDataFromLocalStorage = () => {
    const dataString = localStorage.getItem('editorData');
    try {
      if (dataString) {
        const jsonData = JSON.parse(dataString);
        setData(jsonData);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    loadDataFromLocalStorage();
  }, []);

  return (
    <EditorJS 
      instanceRef={instance => {instanceRef.current = instance}} 
      tools={tools} 
      data={data}
      enableReInitialize
      autofocus
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
    />
  )
};

export default Editor;