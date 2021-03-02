"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-restricted-globals */
const index_1 = require("../index");
async function main() {
    console.log('Converting DOM to SVG');
    const svgDocument = index_1.documentToSVG(document);
    console.log('Inlining resources');
    const svgRootElement = svgDocument.documentElement;
    // Append to DOM so SVG elements are attached to a window/have defaultView, so window.getComputedStyle() works
    document.body.prepend(svgRootElement);
    try {
        await index_1.inlineResources(svgRootElement);
    }
    finally {
        svgRootElement.remove();
    }
    console.log('Serializing SVG');
    const svgString = new XMLSerializer().serializeToString(svgRootElement);
    console.log('Calling callback');
    resolveSVG(svgString);
}
main().catch(error => {
    console.error(error);
    const { message, name, stack } = error;
    rejectSVG({ message, name, stack });
});
//# sourceMappingURL=injected-script.js.map