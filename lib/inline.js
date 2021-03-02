"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inlineResources = void 0;
const css_1 = require("./css");
const dom_1 = require("./dom");
const util_1 = require("./util");
const postcss_value_parser_1 = __importDefault(require("postcss-value-parser"));
const svg_1 = require("./svg");
/**
 * Inlines all external resources of the given element, such as fonts and images.
 *
 * Fonts and binary images are inlined as Base64 data: URIs.
 *
 * Images that reference another SVG are inlined by inlining the embedded SVG into the output SVG.
 * Note: The passed element needs to be attached to a document with a window (`defaultView`) for this so that `getComputedStyle()` can be used.
 */
async function inlineResources(element) {
    await Promise.all([
        ...[...element.children].map(inlineResources),
        (async () => {
            if (dom_1.isSVGImageElement(element)) {
                const blob = await util_1.withTimeout(10000, `Timeout fetching ${element.href.baseVal}`, () => fetchResource(element.href.baseVal));
                if (blob.type === 'image/svg+xml') {
                    // If the image is an SVG, inline it into the output SVG.
                    // Some tools (e.g. Figma) do not support nested SVG.
                    util_1.assert(element.ownerDocument, 'Expected <image> element to have ownerDocument');
                    // Replace <image> with inline <svg>
                    const embeddedSvgDocument = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
                    const svgRoot = embeddedSvgDocument.documentElement;
                    svgRoot.setAttribute('x', element.getAttribute('x'));
                    svgRoot.setAttribute('y', element.getAttribute('y'));
                    svgRoot.setAttribute('width', element.getAttribute('width'));
                    svgRoot.setAttribute('height', element.getAttribute('height'));
                    svgRoot.remove();
                    element.replaceWith(svgRoot);
                    try {
                        // Let handleSvgNode inline the <svg> into a simple <g>
                        const svgDocument = element.ownerDocument;
                        const mount = svgDocument.createElementNS(dom_1.svgNamespace, 'g');
                        util_1.assert(element.id, '<image> element must have ID');
                        svg_1.handleSvgNode(svgRoot, {
                            currentSvgParent: mount,
                            svgDocument,
                            idPrefix: `${element.id}-`,
                            options: {
                                // SVGs embedded through <img> are never interactive.
                                keepLinks: false,
                                captureArea: svgRoot.viewBox.baseVal,
                            },
                        });
                        // Replace the <svg> element with the <g>
                        mount.dataset.tag = 'img';
                        mount.setAttribute('role', 'img');
                        svgRoot.replaceWith(mount);
                    }
                    finally {
                        svgRoot.remove();
                    }
                }
                else {
                    // Inline binary images as base64 data: URL
                    const dataUrl = await blobToDataURL(blob);
                    element.dataset.src = element.href.baseVal;
                    element.setAttribute('href', dataUrl.href);
                }
            }
            else if (dom_1.isSVGStyleElement(element) && element.sheet) {
                try {
                    const rules = element.sheet.cssRules;
                    for (const rule of rules) {
                        if (css_1.isCSSFontFaceRule(rule)) {
                            const parsedSourceValue = postcss_value_parser_1.default(rule.style.src);
                            const promises = [];
                            parsedSourceValue.walk(node => {
                                if (node.type === 'function' && node.value === 'url' && node.nodes[0]) {
                                    const urlArgumentNode = node.nodes[0];
                                    if (urlArgumentNode.type === 'string' || urlArgumentNode.type === 'word') {
                                        const url = new URL(css_1.unescapeStringValue(urlArgumentNode.value));
                                        promises.push((async () => {
                                            try {
                                                const blob = await util_1.withTimeout(10000, `Timeout fetching ${url.href}`, () => fetchResource(url.href));
                                                if (!blob.type.startsWith('font/') &&
                                                    blob.type !== 'application/font-woff') {
                                                    throw new Error(`Invalid response type inlining font at ${url.href}: Expected font/* response, got ${blob.type}`);
                                                }
                                                const dataUrl = await blobToDataURL(blob);
                                                urlArgumentNode.value = dataUrl.href;
                                            }
                                            catch (error) {
                                                console.error(`Error inlining ${url.href}`, error);
                                            }
                                        })());
                                    }
                                }
                            });
                            await Promise.all(promises);
                            rule.style.src = postcss_value_parser_1.default.stringify(parsedSourceValue.nodes);
                        }
                    }
                }
                catch (error) {
                    console.error('Error inlining stylesheet', element.sheet, error);
                }
            }
        })().catch(error => {
            console.error('Error inlining resource for element', element, error);
        }),
    ]);
}
exports.inlineResources = inlineResources;
async function fetchResource(url) {
    util_1.assert(url, 'No URL passed');
    const headers = new Headers();
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const blob = await response.blob();
    return blob;
}
async function blobToDataURL(blob) {
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
        reader.addEventListener('error', () => reject(new Error('Error loading resource with FileLoader')));
        reader.addEventListener('load', () => resolve());
        reader.readAsDataURL(blob);
    });
    return new URL(reader.result);
}
//# sourceMappingURL=inline.js.map