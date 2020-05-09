/* eslint-disable no-extend-native */

export {};

declare global {
  interface String {
    /**
     * Insert a character or a string snippet into an index.
     */
    insert(index: number, newString: string): string;

    remove(start: number, range: number): string;
  }
}

String.prototype.insert = function(index: number, newString: string): string {
  if (index > 0) {
    return this.substring(0, index) + newString + this.substring(index, this.length);
  }

  return newString + this;
};

String.prototype.remove = function(start: number, range: number): string {
  // TODO: Check if start and range exceeds length of string.
  return this.substring(0, start) + this.substring(start + range, this.length);
}