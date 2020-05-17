import { API } from "@editorjs/editorjs";

export enum MarkdownBlockTypes {
  Header,
  Paragraph,
  UnorderedList,
  OrderedList,
  Code,
  Quote
};

export interface MarkdownConstructor {
  data: any;
  config: object;
  api: API;
};

export interface SanitizerConfig {
  tags: {
    [key: string]: boolean|{[attr: string]: boolean|string}|((el: HTMLElement) => any);
  }
  keepNestedBlockElements?: boolean;
}

export interface RegexBlock {
  header: RegExp;
  list: RegExp;
  quote: RegExp;
}

export interface RegexVerifiers {
  [key: string]: readonly RegExp[];
}

interface BaseCSSClasses {
  [key: string]: readonly string[];
}

export interface CSSClasses extends BaseCSSClasses {
  DIV: readonly string[];
  H: readonly string[];
  CODE: readonly string[];
  UL: readonly string[];
  OL: readonly string[];
  PRE: readonly string[];
  BLOCKQUOTE: readonly string[];
}

export interface CaretAccuratePosition {
  absolute: number;
  relative: number;
}

export interface InputMarkdownParser {
  keyCode?: string;
  event?: KeyboardEvent;
}