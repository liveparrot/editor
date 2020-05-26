import { MarkdownBlockTypes, RegexBlock, RegexVerifiers } from '../types';

const block: RegexBlock = {
  header: /^#{1,6}[\s|\\u00A0|&nbsp;]{1}/,
  list: /^(-{1}|1\.)[\s|\\u00A0].+/,
  quote: /^>[\s|\\u00A0]/
};

const verifier: RegexVerifiers = {
  '*': [/\*\*/g, /\*/g],
  '_': [/__/g, /_/g],
  '~': [/~/g],
  '`': [/`/g],
}

const endTag = /<\/[a-z][\s\S]*>$/;

const zeroWidthCharacter = /\u200B/g;

const blockWithCustomLineBreaks: MarkdownBlockTypes[] = [
  MarkdownBlockTypes.OrderedList,
  MarkdownBlockTypes.UnorderedList,
  MarkdownBlockTypes.Code,
  MarkdownBlockTypes.Quote
];

export default {
  block,
  verifier,
  endTag,
  zeroWidthCharacter,
  blockWithCustomLineBreaks
}