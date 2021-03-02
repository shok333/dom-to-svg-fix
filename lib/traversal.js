"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkNode = void 0;
const dom_1 = require("./dom");
const element_1 = require("./element");
const text_1 = require("./text");
function walkNode(node, context) {
    if (dom_1.isElement(node)) {
        element_1.handleElement(node, context);
    }
    else if (dom_1.isTextNode(node)) {
        text_1.handleTextNode(node, context);
    }
}
exports.walkNode = walkNode;
//# sourceMappingURL=traversal.js.map