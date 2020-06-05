import { MarkdownBlockTypes, RegexBlock, RegexVerifiers } from '../types';

const block: RegexBlock = {
  header: /^#{1,6}[\s|\\u00A0|&nbsp;]{1}/,
  list: /^(-{1}|1\.|\*{1})[\s|\\u00A0](.*)/,
  quote: /^>[\s|\\u00A0]/,
  breakline: /^-{3}[\s|\\u00A0]?/
};

const verifier: RegexVerifiers = {
  '*': [/\*\*/g, /\*/g],
  '_': [/__/g, /_/g],
  '~': [/~/g],
  '`': [/`/g],
}

const endTag = /<\/[a-z][\s\S]*>$/;

const zeroWidthCharacter = /\u200B/g;

const startWithTabs = /^(\s+)(.*)/;
const endsWithTabs= /(.*)(\s{4}$)/;

const blockWithCustomLineBreaks: MarkdownBlockTypes[] = [
  MarkdownBlockTypes.OrderedList,
  MarkdownBlockTypes.UnorderedList,
  MarkdownBlockTypes.Code,
  MarkdownBlockTypes.Quote
];

const orderedListDelimeter = /^(1\.)[\s|\\u00A0](\S*)/;

export default {
  block,
  verifier,
  endTag,
  zeroWidthCharacter,
  blockWithCustomLineBreaks,
  orderedListDelimeter,
  startWithTabs,
  endsWithTabs
}