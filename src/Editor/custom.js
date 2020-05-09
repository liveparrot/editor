const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

class TestPlugin {

  static get toolbox() {
    return {
      title: 'Image',
      icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
    };
  }

  constructor({ data, config, api }) {
    this.data = data;
    this.api = api;
    this.wrapper = undefined;
  }

  render() {
    this.wrapper = document.createElement('div');
    const input = document.createElement('input');
    this.input = input;

    input.addEventListener('input', (ev) => {
      console.log('asdfasd', ev.target.value);
      const value = ev.target.value;

      console.log('## result', md.render(value));
      const newElement = md.render(value);
      
      const d = document.createElement('div');
      
      d.innerHTML = newElement;
      d.firstChild.contentEditable = 'true';
      
      this.wrapper.replaceChild(d, this.input);
    });

    this.wrapper.classList.add('simple-image');
    this.wrapper.appendChild(input);

    input.placeholder = 'Paste an image URL...';
    input.value = this.data && this.data.url ? this.data.url : '';
    console.log('## data', this.data);
    console.log('## helo!');

    return this.wrapper;
  }

  save(blockContent) {
    console.log('## save', blockContent);
    return {
      url: blockContent.value
    }
  }

}

module.exports = TestPlugin;