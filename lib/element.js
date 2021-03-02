"use strict";

var __importDefault = void 0 && (void 0).__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.handleElement = void 0;

const dom_1 = require("./dom");

const accessibility_1 = require("./accessibility");

const traversal_1 = require("./traversal");

const stacking_1 = require("./stacking");

const css_1 = require("./css");

const text_1 = require("./text");

const util_1 = require("./util");

const postcss_value_parser_1 = __importDefault(require("postcss-value-parser"));

const gradients_1 = require("./gradients");

const svg_1 = require("./svg");

function handleElement(element, context) {
  const cleanupFunctions = [];

  try {
    const window = element.ownerDocument.defaultView;

    if (!window) {
      throw new Error("Element's ownerDocument has no defaultView");
    }

    const bounds = element.getBoundingClientRect(); // Includes borders

    const rectanglesIntersect = util_1.doRectanglesIntersect(bounds, context.options.captureArea);
    const styles = window.getComputedStyle(element);
    const parentStyles = element.parentElement && window.getComputedStyle(element.parentElement);
    const svgContainer = dom_1.isHTMLAnchorElement(element) && context.options.keepLinks ? createSvgAnchor(element, context) : context.svgDocument.createElementNS(dom_1.svgNamespace, 'g'); // Add IDs, classes, debug info

    svgContainer.dataset.tag = element.tagName.toLowerCase();
    const id = element.id || context.getUniqueId(element.classList[0] || element.tagName.toLowerCase());
    svgContainer.id = id;
    const className = element.getAttribute('class');

    if (className) {
      svgContainer.setAttribute('class', className);
    } // Title


    if (dom_1.isHTMLElement(element) && element.title) {
      const svgTitle = context.svgDocument.createElementNS(dom_1.svgNamespace, 'title');
      svgTitle.textContent = element.title;
      svgContainer.prepend(svgTitle);
    } // Which parent should the container itself be appended to?


    const stackingLayerName = stacking_1.determineStackingLayer(styles, parentStyles);
    const stackingLayer = stackingLayerName ? context.stackingLayers[stackingLayerName] : context.parentStackingLayer;

    if (stackingLayer) {
      context.currentSvgParent.setAttribute('aria-owns', [context.currentSvgParent.getAttribute('aria-owns'), svgContainer.id].filter(Boolean).join(' '));
    } // If the parent is within the same stacking layer, append to the parent.
    // Otherwise append to the right stacking layer.


    const elementToAppendTo = context.parentStackingLayer === stackingLayer ? context.currentSvgParent : stackingLayer;
    svgContainer.dataset.zIndex = styles.zIndex; // Used for sorting

    elementToAppendTo.append(svgContainer); // If the element establishes a stacking context, create subgroups for each stacking layer.

    let childContext;
    let backgroundContainer;
    let ownStackingLayers;

    if (stacking_1.establishesStackingContext(styles, parentStyles)) {
      ownStackingLayers = stacking_1.createStackingLayers(svgContainer);
      backgroundContainer = ownStackingLayers.rootBackgroundAndBorders;
      childContext = { ...context,
        currentSvgParent: svgContainer,
        stackingLayers: ownStackingLayers,
        parentStackingLayer: stackingLayer
      };
    } else {
      backgroundContainer = svgContainer;
      childContext = { ...context,
        currentSvgParent: svgContainer,
        parentStackingLayer: stackingLayer
      };
    } // Opacity


    if (styles.opacity !== '1') {
      svgContainer.setAttribute('opacity', styles.opacity);
    } // Accessibility


    for (const [name, value] of accessibility_1.getAccessibilityAttributes(element, context)) {
      svgContainer.setAttribute(name, value);
    }

    const handlePseudoElement = (pseudoSelector, position) => {
      if (!dom_1.isHTMLElement(element)) {
        return;
      }

      const pseudoElementStyles = window.getComputedStyle(element, pseudoSelector);
      const content = postcss_value_parser_1.default(pseudoElementStyles.content).nodes.find(util_1.isTaggedUnionMember('type', 'string'));

      if (!content) {
        return;
      } // Pseudo elements are inline by default (like a span)


      const span = element.ownerDocument.createElement('span');
      span.dataset.pseudoElement = pseudoSelector;
      css_1.copyCssStyles(pseudoElementStyles, span.style);
      span.textContent = css_1.unescapeStringValue(content.value);
      element.dataset.pseudoElementOwner = id;
      cleanupFunctions.push(() => element.removeAttribute('data-pseudo-element-owner'));
      const style = element.ownerDocument.createElement('style'); // Hide the *actual* pseudo element temporarily while we have a real DOM equivalent in the DOM

      style.textContent = `[data-pseudo-element-owner="${id}"]${pseudoSelector} { display: none !important; }`;
      element.before(style);
      cleanupFunctions.push(() => style.remove());
      element[position](span);
      cleanupFunctions.push(() => span.remove());
    };

    handlePseudoElement('::before', 'prepend');
    handlePseudoElement('::after', 'append'); // TODO handle ::marker etc

    if (rectanglesIntersect) {
      addBackgroundAndBorders(styles, bounds, backgroundContainer, window, context);
    } // If element is overflow: hidden, create a masking rectangle to hide any overflowing content of any descendants.
    // Use <mask> instead of <clipPath> as Figma supports <mask>, but not <clipPath>.


    if (styles.overflow !== 'visible') {
      const mask = context.svgDocument.createElementNS(dom_1.svgNamespace, 'mask');
      mask.id = context.getUniqueId('mask-for-' + id);
      const visibleRectangle = createBox(bounds, context);
      visibleRectangle.setAttribute('fill', '#ffffff');
      mask.append(visibleRectangle);
      svgContainer.append(mask);
      svgContainer.setAttribute('mask', `url(#${mask.id})`);
      childContext = { ...childContext,
        ancestorMasks: [{
          mask,
          forElement: element
        }, ...childContext.ancestorMasks]
      };
    }

    if (dom_1.isHTMLElement(element) && (styles.position === 'absolute' || styles.position === 'fixed') && context.ancestorMasks.length > 0 && element.offsetParent) {
      // Absolute and fixed elements are out of the flow and will bleed out of an `overflow: hidden` ancestor
      // as long as their offsetParent is higher up than the mask element.
      for (const {
        mask,
        forElement
      } of context.ancestorMasks) {
        if (element.offsetParent.contains(forElement) || element.offsetParent === forElement) {
          // Add a cutout to the ancestor mask
          const visibleRectangle = createBox(bounds, context);
          visibleRectangle.setAttribute('fill', '#ffffff');
          mask.append(visibleRectangle);
        } else {
          break;
        }
      }
    }

    if (rectanglesIntersect && dom_1.isHTMLImageElement(element) && ( // Make sure the element has a src/srcset attribute (the relative URL). `element.src` is absolute and always defined.
    element.getAttribute('src') || element.getAttribute('srcset'))) {
      var _css_1$parseCSSLength, _css_1$parseCSSLength2, _css_1$parseCSSLength3, _css_1$parseCSSLength4;

      const svgImage = context.svgDocument.createElementNS(dom_1.svgNamespace, 'image');
      svgImage.id = `${id}-image`; // read by inlineResources()

      svgImage.setAttribute('href', element.currentSrc || element.src);
      const paddingLeft = (_css_1$parseCSSLength = css_1.parseCSSLength(styles.paddingLeft, bounds.width)) !== null && _css_1$parseCSSLength !== void 0 ? _css_1$parseCSSLength : 0;
      const paddingRight = (_css_1$parseCSSLength2 = css_1.parseCSSLength(styles.paddingRight, bounds.width)) !== null && _css_1$parseCSSLength2 !== void 0 ? _css_1$parseCSSLength2 : 0;
      const paddingTop = (_css_1$parseCSSLength3 = css_1.parseCSSLength(styles.paddingTop, bounds.height)) !== null && _css_1$parseCSSLength3 !== void 0 ? _css_1$parseCSSLength3 : 0;
      const paddingBottom = (_css_1$parseCSSLength4 = css_1.parseCSSLength(styles.paddingBottom, bounds.height)) !== null && _css_1$parseCSSLength4 !== void 0 ? _css_1$parseCSSLength4 : 0;
      svgImage.setAttribute('x', (bounds.x + paddingLeft).toString());
      svgImage.setAttribute('y', (bounds.y + paddingTop).toString());
      svgImage.setAttribute('width', (bounds.width - paddingLeft - paddingRight).toString());
      svgImage.setAttribute('height', (bounds.height - paddingTop - paddingBottom).toString());

      if (element.alt) {
        svgImage.setAttribute('aria-label', element.alt);
      }

      svgContainer.append(svgImage);
    } else if (rectanglesIntersect && dom_1.isHTMLInputElement(element) && bounds.width > 0 && bounds.height > 0) {
      // Handle button labels or input field content
      if (element.value) {
        var _css_1$parseCSSLength5, _css_1$parseCSSLength6, _css_1$parseCSSLength7;

        const svgTextElement = context.svgDocument.createElementNS(dom_1.svgNamespace, 'text');
        text_1.copyTextStyles(styles, svgTextElement);
        svgTextElement.setAttribute('dominant-baseline', 'central');
        svgTextElement.setAttribute('xml:space', 'preserve');
        svgTextElement.setAttribute('x', (bounds.x + ((_css_1$parseCSSLength5 = css_1.parseCSSLength(styles.paddingLeft, bounds.width)) !== null && _css_1$parseCSSLength5 !== void 0 ? _css_1$parseCSSLength5 : 0)).toString());
        const top = bounds.top + ((_css_1$parseCSSLength6 = css_1.parseCSSLength(styles.paddingTop, bounds.height)) !== null && _css_1$parseCSSLength6 !== void 0 ? _css_1$parseCSSLength6 : 0);
        const bottom = bounds.bottom + ((_css_1$parseCSSLength7 = css_1.parseCSSLength(styles.paddingBottom, bounds.height)) !== null && _css_1$parseCSSLength7 !== void 0 ? _css_1$parseCSSLength7 : 0);
        const middle = (top + bottom) / 2;
        svgTextElement.setAttribute('y', middle.toString());
        svgTextElement.textContent = element.value;
        childContext.stackingLayers.inFlowInlineLevelNonPositionedDescendants.append(svgTextElement);
      }
    } else if (rectanglesIntersect && dom_1.isSVGSVGElement(element) && css_1.isVisible(styles)) {
      svg_1.handleSvgNode(element, { ...childContext,
        idPrefix: `${id}-`
      });
    } else {
      // Walk children even if rectangles don't intersect,
      // because children can overflow the parent's bounds as long as overflow: visible (default).
      for (const child of element.childNodes) {
        traversal_1.walkNode(child, childContext);
      }

      if (ownStackingLayers) {
        stacking_1.sortStackingLayerChildren(ownStackingLayers);
        stacking_1.cleanupStackingLayerChildren(ownStackingLayers);
      }
    }
  } finally {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  }
}

exports.handleElement = handleElement;

function addBackgroundAndBorders(styles, bounds, backgroundAndBordersContainer, window, context) {
  if (css_1.isVisible(styles)) {
    if (bounds.width > 0 && bounds.height > 0 && (!css_1.isTransparent(styles.backgroundColor) || css_1.hasUniformBorder(styles) || styles.backgroundImage !== 'none')) {
      const box = createBackgroundAndBorderBox(bounds, styles, context);
      backgroundAndBordersContainer.append(box);

      if (styles.backgroundImage !== 'none') {
        const backgrounds = postcss_value_parser_1.default(styles.backgroundImage).nodes.filter(util_1.isTaggedUnionMember('type', 'function')).reverse();
        const xBackgroundPositions = styles.backgroundPositionX.split(/\s*,\s*/g);
        const yBackgroundPositions = styles.backgroundPositionY.split(/\s*,\s*/g);
        const backgroundRepeats = styles.backgroundRepeat.split(/\s*,\s*/g);

        for (const [index, backgroundNode] of backgrounds.entries()) {
          var _css_1$parseCSSLength8, _css_1$parseCSSLength9;

          const backgroundPositionX = (_css_1$parseCSSLength8 = css_1.parseCSSLength(xBackgroundPositions[index], bounds.width)) !== null && _css_1$parseCSSLength8 !== void 0 ? _css_1$parseCSSLength8 : 0;
          const backgroundPositionY = (_css_1$parseCSSLength9 = css_1.parseCSSLength(yBackgroundPositions[index], bounds.height)) !== null && _css_1$parseCSSLength9 !== void 0 ? _css_1$parseCSSLength9 : 0;
          const backgroundRepeat = backgroundRepeats[index];

          if (backgroundNode.value === 'url' && backgroundNode.nodes[0]) {
            var _css_1$parseCSSLength10, _css_1$parseCSSLength11;

            const urlArgument = backgroundNode.nodes[0];
            const image = context.svgDocument.createElementNS(dom_1.svgNamespace, 'image');
            image.id = context.getUniqueId('background-image'); // read by inlineResources()

            const [cssWidth = 'auto', cssHeight = 'auto'] = styles.backgroundSize.split(' ');
            const backgroundWidth = (_css_1$parseCSSLength10 = css_1.parseCSSLength(cssWidth, bounds.width)) !== null && _css_1$parseCSSLength10 !== void 0 ? _css_1$parseCSSLength10 : bounds.width;
            const backgroundHeight = (_css_1$parseCSSLength11 = css_1.parseCSSLength(cssHeight, bounds.height)) !== null && _css_1$parseCSSLength11 !== void 0 ? _css_1$parseCSSLength11 : bounds.height;
            image.setAttribute('width', backgroundWidth.toString());
            image.setAttribute('height', backgroundHeight.toString());

            if (cssWidth !== 'auto' && cssHeight !== 'auto') {
              image.setAttribute('preserveAspectRatio', 'none');
            } else if (styles.backgroundSize === 'contain') {
              image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            } else if (styles.backgroundSize === 'cover') {
              image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
            } // Technically not correct, because relative URLs should be resolved relative to the stylesheet,
            // not the page. But we have no means to know what stylesheet the style came from
            // (unless we iterate through all rules in all style sheets and find the matching one).


            const url = new URL(css_1.unescapeStringValue(urlArgument.value), window.location.href);
            image.setAttribute('href', url.href);

            if (backgroundRepeat === 'no-repeat' || backgroundPositionX === 0 && backgroundPositionY === 0 && backgroundWidth === bounds.width && backgroundHeight === bounds.height) {
              image.setAttribute('x', bounds.x.toString());
              image.setAttribute('y', bounds.y.toString());
              backgroundAndBordersContainer.append(image);
            } else {
              image.setAttribute('x', '0');
              image.setAttribute('y', '0');
              const pattern = context.svgDocument.createElementNS(dom_1.svgNamespace, 'pattern');
              pattern.setAttribute('patternUnits', 'userSpaceOnUse');
              pattern.setAttribute('patternContentUnits', 'userSpaceOnUse');
              pattern.setAttribute('x', (bounds.x + backgroundPositionX).toString());
              pattern.setAttribute('y', (bounds.y + backgroundPositionY).toString());
              pattern.setAttribute('width', (backgroundRepeat === 'repeat' || backgroundRepeat === 'repeat-x' ? backgroundWidth : // If background shouldn't repeat on this axis, make the tile as big as the element so the repetition is cut off.
              backgroundWidth + bounds.x + backgroundPositionX).toString());
              pattern.setAttribute('height', (backgroundRepeat === 'repeat' || backgroundRepeat === 'repeat-y' ? backgroundHeight : // If background shouldn't repeat on this axis, make the tile as big as the element so the repetition is cut off.
              backgroundHeight + bounds.y + backgroundPositionY).toString());
              pattern.id = context.getUniqueId('pattern');
              pattern.append(image);
              box.before(pattern);
              box.setAttribute('fill', `url(#${pattern.id})`);
            }
          } else if (/^(-webkit-)?linear-gradient$/.test(backgroundNode.value)) {
            const linearGradientCss = postcss_value_parser_1.default.stringify(backgroundNode);
            const svgLinearGradient = gradients_1.convertLinearGradient(linearGradientCss, context);

            if (backgroundPositionX !== 0 || backgroundPositionY !== 0) {
              svgLinearGradient.setAttribute('gradientTransform', `translate(${backgroundPositionX}, ${backgroundPositionY})`);
            }

            svgLinearGradient.id = context.getUniqueId('linear-gradient');
            box.before(svgLinearGradient);
            box.setAttribute('fill', `url(#${svgLinearGradient.id})`);
          }
        }
      }
    }

    if (!css_1.hasUniformBorder(styles)) {
      // Draw lines for each border
      for (const borderLine of createBorders(styles, bounds, context)) {
        backgroundAndBordersContainer.append(borderLine);
      }
    }
  }
}

function createBox(bounds, context) {
  const box = context.svgDocument.createElementNS(dom_1.svgNamespace, 'rect'); // TODO consider rotation

  box.setAttribute('width', bounds.width.toString());
  box.setAttribute('height', bounds.height.toString());
  box.setAttribute('x', bounds.x.toString());
  box.setAttribute('y', bounds.y.toString());
  return box;
}

function createBackgroundAndBorderBox(bounds, styles, context) {
  const background = createBox(bounds, context); // TODO handle background image and other properties

  if (styles.backgroundColor) {
    background.setAttribute('fill', styles.backgroundColor);
  }

  if (css_1.hasUniformBorder(styles)) {
    // Uniform border, use stroke
    // Cannot use borderColor/borderWidth directly as in Firefox those are empty strings.
    // Need to get the border property from some specific side (they are all the same in this condition).
    // https://stackoverflow.com/questions/41696063/getcomputedstyle-returns-empty-strings-on-ff-when-instead-crome-returns-a-comp
    background.setAttribute('stroke', styles.borderTopColor);
    background.setAttribute('stroke-width', styles.borderTopWidth);

    if (styles.borderTopStyle === 'dashed') {
      // > Displays a series of short square-ended dashes or line segments.
      // > The exact size and length of the segments are not defined by the specification and are implementation-specific.
      background.setAttribute('stroke-dasharray', '1');
    }
  } // Set border radius
  // Approximation, always assumes uniform border-radius by using the top-left horizontal radius and the top-left vertical radius for all corners.
  // TODO support irregular border radii on all corners by drawing border as a <path>.


  const overlappingCurvesFactor = css_1.calculateOverlappingCurvesFactor(styles, bounds);
  const radiusX = css_1.getBorderRadiiForSide('top', styles, bounds)[0] * overlappingCurvesFactor;
  const radiusY = css_1.getBorderRadiiForSide('left', styles, bounds)[0] * overlappingCurvesFactor;

  if (radiusX !== 0) {
    background.setAttribute('rx', radiusX.toString());
  }

  if (radiusY !== 0) {
    background.setAttribute('ry', radiusY.toString());
  }

  return background;
}

function* createBorders(styles, bounds, context) {
  for (const side of ['top', 'bottom', 'right', 'left']) {
    if (hasBorder(styles, side)) {
      yield createBorder(styles, bounds, side, context);
    }
  }
}

function hasBorder(styles, side) {
  return !!styles.getPropertyValue(`border-${side}-color`) && !css_1.isTransparent(styles.getPropertyValue(`border-${side}-color`)) && styles.getPropertyValue(`border-${side}-width`) !== '0px';
}

function createBorder(styles, bounds, side, context) {
  // TODO handle border-radius for non-uniform borders
  const border = context.svgDocument.createElementNS(dom_1.svgNamespace, 'line');
  border.setAttribute('stroke-linecap', 'square');
  const color = styles.getPropertyValue(`border-${side}-color`);
  border.setAttribute('stroke', color);
  border.setAttribute('stroke-width', styles.getPropertyValue(`border-${side}-width`)); // Handle inset/outset borders

  const borderStyle = styles.getPropertyValue(`border-${side}-style`);

  if (borderStyle === 'inset' && (side === 'top' || side === 'left') || borderStyle === 'outset' && (side === 'right' || side === 'bottom')) {
    const match = color.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);

    if (!match) {
      throw new Error(`Unexpected color: ${color}`);
    }

    const components = match.slice(1, 4).map(value => parseInt(value, 10) * 0.3);

    if (match[4]) {
      components.push(parseFloat(match[4]));
    } // Low-light border
    // https://stackoverflow.com/questions/4147940/how-do-browsers-determine-which-exact-colors-to-use-for-border-inset-or-outset


    border.setAttribute('stroke', `rgba(${components.join(', ')})`);
  }

  if (side === 'top') {
    border.setAttribute('x1', bounds.left.toString());
    border.setAttribute('x2', bounds.right.toString());
    border.setAttribute('y1', bounds.top.toString());
    border.setAttribute('y2', bounds.top.toString());
  } else if (side === 'left') {
    border.setAttribute('x1', bounds.left.toString());
    border.setAttribute('x2', bounds.left.toString());
    border.setAttribute('y1', bounds.top.toString());
    border.setAttribute('y2', bounds.bottom.toString());
  } else if (side === 'right') {
    border.setAttribute('x1', bounds.right.toString());
    border.setAttribute('x2', bounds.right.toString());
    border.setAttribute('y1', bounds.top.toString());
    border.setAttribute('y2', bounds.bottom.toString());
  } else if (side === 'bottom') {
    border.setAttribute('x1', bounds.left.toString());
    border.setAttribute('x2', bounds.right.toString());
    border.setAttribute('y1', bounds.bottom.toString());
    border.setAttribute('y2', bounds.bottom.toString());
  }

  return border;
}

function createSvgAnchor(element, context) {
  const svgAnchor = context.svgDocument.createElementNS(dom_1.svgNamespace, 'a');

  if (element.href && !element.href.startsWith('javascript:')) {
    svgAnchor.setAttribute('href', element.href);
  }

  if (element.rel) {
    svgAnchor.setAttribute('rel', element.rel);
  }

  if (element.target) {
    svgAnchor.setAttribute('target', element.target);
  }

  if (element.download) {
    svgAnchor.setAttribute('download', element.download);
  }

  return svgAnchor;
}