"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traverseDOM = exports.hasLabels = exports.isHTMLInputElement = exports.isHTMLImageElement = exports.isHTMLLabelElement = exports.isHTMLAnchorElement = exports.isHTMLElement = exports.isSVGStyleElement = exports.isSVGImageElement = exports.isSVGTextContentElement = exports.isSVGAnchorElement = exports.isSVGGroupElement = exports.isSVGGraphicsElement = exports.isSVGSVGElement = exports.isSVGElement = exports.isCommentNode = exports.isTextNode = exports.isElement = exports.xhtmlNamespace = exports.xlinkNamespace = exports.svgNamespace = void 0;
// Namespaces
exports.svgNamespace = 'http://www.w3.org/2000/svg';
exports.xlinkNamespace = 'http://www.w3.org/1999/xlink';
exports.xhtmlNamespace = 'http://www.w3.org/1999/xhtml';
// DOM
const isElement = (node) => node.nodeType === Node.ELEMENT_NODE;
exports.isElement = isElement;
const isTextNode = (node) => node.nodeType === Node.TEXT_NODE;
exports.isTextNode = isTextNode;
const isCommentNode = (node) => node.nodeType === Node.COMMENT_NODE;
exports.isCommentNode = isCommentNode;
// SVG
const isSVGElement = (element) => element.namespaceURI === exports.svgNamespace;
exports.isSVGElement = isSVGElement;
const isSVGSVGElement = (element) => exports.isSVGElement(element) && element.tagName === 'svg';
exports.isSVGSVGElement = isSVGSVGElement;
const isSVGGraphicsElement = (element) => exports.isSVGElement(element) && 'getCTM' in element && 'getScreenCTM' in element;
exports.isSVGGraphicsElement = isSVGGraphicsElement;
const isSVGGroupElement = (element) => exports.isSVGElement(element) && element.tagName === 'g';
exports.isSVGGroupElement = isSVGGroupElement;
const isSVGAnchorElement = (element) => exports.isSVGElement(element) && element.tagName === 'a';
exports.isSVGAnchorElement = isSVGAnchorElement;
const isSVGTextContentElement = (element) => exports.isSVGElement(element) && 'textLength' in element;
exports.isSVGTextContentElement = isSVGTextContentElement;
const isSVGImageElement = (element) => element.tagName === 'image' && exports.isSVGElement(element);
exports.isSVGImageElement = isSVGImageElement;
const isSVGStyleElement = (element) => element.tagName === 'style' && exports.isSVGElement(element);
exports.isSVGStyleElement = isSVGStyleElement;
// HTML
const isHTMLElement = (element) => element.namespaceURI === exports.xhtmlNamespace;
exports.isHTMLElement = isHTMLElement;
const isHTMLAnchorElement = (element) => element.tagName === 'A' && exports.isHTMLElement(element);
exports.isHTMLAnchorElement = isHTMLAnchorElement;
const isHTMLLabelElement = (element) => element.tagName === 'LABEL' && exports.isHTMLElement(element);
exports.isHTMLLabelElement = isHTMLLabelElement;
const isHTMLImageElement = (element) => element.tagName === 'IMG' && exports.isHTMLElement(element);
exports.isHTMLImageElement = isHTMLImageElement;
const isHTMLInputElement = (element) => element.tagName === 'INPUT' && exports.isHTMLElement(element);
exports.isHTMLInputElement = isHTMLInputElement;
const hasLabels = (element) => 'labels' in element;
exports.hasLabels = hasLabels;
function* traverseDOM(node, shouldEnter = () => true) {
    yield node;
    if (shouldEnter(node)) {
        for (const childNode of node.childNodes) {
            yield* traverseDOM(childNode);
        }
    }
}
exports.traverseDOM = traverseDOM;
//# sourceMappingURL=dom.js.map