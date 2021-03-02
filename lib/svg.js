"use strict";

var __importDefault = void 0 && (void 0).__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.handleSvgElement = exports.handleSvgNode = void 0;

const dom_1 = require("./dom");

const util_1 = require("./util");

const css_1 = require("./css");

const text_1 = require("./text");

const postcss_value_parser_1 = __importDefault(require("postcss-value-parser"));
/**
 * Recursively clone an `<svg>` element, inlining it into the output SVG document with the necessary transforms.
 */


function handleSvgNode(node, context) {
  if (dom_1.isElement(node)) {
    if (!dom_1.isSVGElement(node)) {
      return;
    }

    handleSvgElement(node, context);
  } else if (dom_1.isTextNode(node)) {
    const clonedTextNode = node.cloneNode(true);
    context.currentSvgParent.append(clonedTextNode);
  }
}

exports.handleSvgNode = handleSvgNode;
const ignoredElements = new Set(['script', 'style', 'foreignElement']);
const URL_ID_REFERENCE_REGEX = /\burl\(["']?#/;

function handleSvgElement(element, context) {
  if (ignoredElements.has(element.tagName)) {
    return;
  }

  let elementToAppend;

  if (dom_1.isSVGSVGElement(element)) {
    var _element$getAttribute, _element$getAttribute2, _element$getAttribute3;

    const contentContainer = context.svgDocument.createElementNS(dom_1.svgNamespace, 'g');
    elementToAppend = contentContainer;
    contentContainer.classList.add('svg-content', ...element.classList);
    contentContainer.dataset.viewBox = (_element$getAttribute = element.getAttribute('viewBox')) !== null && _element$getAttribute !== void 0 ? _element$getAttribute : '';
    contentContainer.dataset.width = (_element$getAttribute2 = element.getAttribute('width')) !== null && _element$getAttribute2 !== void 0 ? _element$getAttribute2 : '';
    contentContainer.dataset.height = (_element$getAttribute3 = element.getAttribute('height')) !== null && _element$getAttribute3 !== void 0 ? _element$getAttribute3 : ''; // Since the SVG is getting inlined into the output SVG, we need to transform its contents according to its
    // viewBox, width, height and preserveAspectRatio. We can use getScreenCTM() for this on one of its
    // SVGGraphicsElement children (in Chrome calling it on the <svg> works too, but not in Firefox:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=873106).

    for (const child of element.children) {
      if (!dom_1.isSVGGraphicsElement(child)) {
        continue;
      } // When this function is called on the original DOM, we want getScreenCTM() to map it to the DOM
      // coordinate system. When this function is called from inlineResources() the <svg> is already embedded
      // into the output <svg>. In that case the output SVG already has a viewBox, and the coordinate system
      // of the SVG is not equal to the coordinate system of the screen, therefor we need to use getCTM() to
      // map it into the output SVG's coordinate system.


      let viewBoxTransformMatrix = child.ownerDocument !== context.svgDocument ? child.getScreenCTM() : child.getCTM(); // Make sure to handle a child that already has a transform. That transform should only apply to the
      // child, not to the entire SVG contents, so we need to calculate it out.

      if (child.transform.baseVal.numberOfItems > 0) {
        child.transform.baseVal.consolidate();
        const existingTransform = child.transform.baseVal.getItem(0).matrix;
        viewBoxTransformMatrix = viewBoxTransformMatrix.multiply(existingTransform.inverse());
      }

      contentContainer.transform.baseVal.appendItem(contentContainer.transform.baseVal.createSVGTransformFromMatrix(viewBoxTransformMatrix));
      break;
    } // Make all IDs unique


    for (const descendant of element.querySelectorAll('[id]')) {
      descendant.id = context.idPrefix + descendant.id;
    }
  } else {
    // Clone element
    if (dom_1.isSVGAnchorElement(element) && !context.options.keepLinks) {
      elementToAppend = context.svgDocument.createElementNS(dom_1.svgNamespace, 'g');
    } else {
      elementToAppend = element.cloneNode(false);
    } // Remove event handlers


    for (const attribute of elementToAppend.attributes) {
      if (attribute.localName.startsWith('on')) {
        elementToAppend.attributes.removeNamedItemNS(attribute.namespaceURI, attribute.localName);
      } else if (attribute.localName === 'href' && attribute.value.startsWith('javascript:')) {
        elementToAppend.attributes.removeNamedItemNS(attribute.namespaceURI, attribute.localName);
      }
    }

    const window = element.ownerDocument.defaultView;
    util_1.assert(window, "Element's ownerDocument has no defaultView");
    const svgViewportElement = element.ownerSVGElement;
    util_1.assert(svgViewportElement, 'Expected element to have ownerSVGElement');
    const styles = window.getComputedStyle(element);

    if (dom_1.isSVGGraphicsElement(element)) {
      copyGraphicalPresentationAttributes(styles, elementToAppend, svgViewportElement.viewBox.animVal);

      if (dom_1.isSVGTextContentElement(element)) {
        text_1.copyTextStyles(styles, elementToAppend);
      }
    } // Namespace ID references url(#...)


    for (const attribute of elementToAppend.attributes) {
      if (attribute.localName === 'href') {
        if (attribute.value.startsWith('#')) {
          attribute.value = attribute.value.replace('#', `#${context.idPrefix}`);
        }
      } else if (URL_ID_REFERENCE_REGEX.test(attribute.value)) {
        attribute.value = rewriteUrlIdReferences(attribute.value, context);
      }
    }

    for (const property of elementToAppend.style) {
      const value = elementToAppend.style.getPropertyValue(property);

      if (URL_ID_REFERENCE_REGEX.test(value)) {
        elementToAppend.style.setProperty(property, rewriteUrlIdReferences(value, context), elementToAppend.style.getPropertyPriority(property));
      }
    }
  }

  context.currentSvgParent.append(elementToAppend);

  for (const child of element.childNodes) {
    handleSvgNode(child, { ...context,
      currentSvgParent: elementToAppend
    });
  }
}

exports.handleSvgElement = handleSvgElement;
const graphicalPresentationAttributes = ['alignment-baseline', 'baseline-shift', // 'clip',
'clip-path', 'clip-rule', 'color', 'color-interpolation', 'color-interpolation-filters', // 'color-profile',
'color-rendering', // 'cursor',
'direction', // 'display',
// 'enable-background',
'fill', 'fill-opacity', 'fill-rule', 'filter', 'flood-color', 'flood-opacity', 'image-rendering', 'lighting-color', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', // 'overflow',
'pointer-events', 'shape-rendering', // 'solid-color',
// 'solid-opacity',
'stop-color', 'stop-opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'transform', 'vector-effect', 'visibility'];
const defaults = {
  'alignment-baseline': 'auto',
  'baseline-shift': '0px',
  'clip-path': 'none',
  'clip-rule': 'nonzero',
  'color-interpolation-filters': 'linearrgb',
  'color-interpolation': 'srgb',
  'color-rendering': 'auto',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  'flood-color': 'rgb(0, 0, 0)',
  'flood-opacity': '1',
  'image-rendering': 'auto',
  'lighting-color': 'rgb(255, 255, 255)',
  'marker-end': 'none',
  'marker-mid': 'none',
  'marker-start': 'none',
  'pointer-events': 'auto',
  'shape-rendering': 'auto',
  'stop-color': 'rgb(0, 0, 0)',
  'stop-opacity': '1',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0px',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-opacity': '1',
  'stroke-width': '1px',
  'vector-effect': 'none',
  color: '',
  direction: 'ltr',
  fill: '',
  filter: 'none',
  mask: 'none',
  opacity: '1',
  stroke: '',
  transform: 'none',
  visibility: 'visible'
};
/**
 * Prefixes all ID references of the form `url(#id)` in the given string.
 */

function rewriteUrlIdReferences(value, {
  idPrefix
}) {
  const parsedValue = postcss_value_parser_1.default(value);
  parsedValue.walk(node => {
    if (node.type !== 'function' || node.value !== 'url') {
      return;
    }

    const urlArgument = node.nodes[0];

    if (!urlArgument) {
      return;
    }

    urlArgument.value = urlArgument.value.replace('#', `#${idPrefix}`);
  });
  return postcss_value_parser_1.default.stringify(parsedValue.nodes);
}

function copyGraphicalPresentationAttributes(styles, target, viewBox) {
  for (const attribute of graphicalPresentationAttributes) {
    let value = styles.getPropertyValue(attribute);

    if (value && value !== defaults[attribute]) {
      if (value.endsWith('%')) {
        var _css_1$parseCSSLength;

        // E.g. https://svgwg.org/svg2-draft/painting.html#StrokeWidth
        // Percentages:	refer to the normalized diagonal of the current SVG viewport (see Units)
        value = (_css_1$parseCSSLength = css_1.parseCSSLength(value, util_1.diagonale(viewBox))) !== null && _css_1$parseCSSLength !== void 0 ? _css_1$parseCSSLength : 0;
      }

      target.setAttribute(attribute, value.toString());
    }
  }
}