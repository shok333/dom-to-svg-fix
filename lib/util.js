"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.assert = exports.isTaggedUnionMember = exports.withTimeout = exports.diagonale = exports.doRectanglesIntersect = exports.isDefined = exports.createIdGenerator = void 0;

const createIdGenerator = () => {
  const nextCounts = new Map();
  return prefix => {
    var _nextCounts$get;

    const count = (_nextCounts$get = nextCounts.get(prefix)) !== null && _nextCounts$get !== void 0 ? _nextCounts$get : 1;
    nextCounts.set(prefix, count + 1);
    return `${prefix}${count}`;
  };
};

exports.createIdGenerator = createIdGenerator;

const isDefined = value => value !== null && value !== undefined;

exports.isDefined = isDefined;
/**
 * Check if two rectangles (e.g. an element and the capture area) intersect.
 */

const doRectanglesIntersect = (a, b) => !(a.bottom < b.top || // A is above B
a.top > b.bottom || // A is below B
a.right < b.left || // A is left of B
// A is right of B
a.left > b.right);

exports.doRectanglesIntersect = doRectanglesIntersect;
/**
 * Calculates the length of the diagonale of a given rectangle.
 */

function diagonale(box) {
  return Math.sqrt(box.width ** 2 + box.height ** 2);
}

exports.diagonale = diagonale;

function withTimeout(timeout, message, func) {
  return Promise.race([func(), new Promise((resolve, reject) => setTimeout(() => reject(new Error(message)), timeout))]);
}

exports.withTimeout = withTimeout;
/**
 * Type guard to check if an object is a specific member of a tagged union type.
 *
 * @param key The key to check
 * @param value The value the key has to be.
 */

const isTaggedUnionMember = (key, value) => object => object[key] === value;

exports.isTaggedUnionMember = isTaggedUnionMember;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

exports.assert = assert;