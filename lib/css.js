"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.copyCssStyles = exports.unescapeStringValue = exports.parseCSSLength = exports.isVisible = exports.calculateOverlappingCurvesFactor = exports.getBorderRadiiForSide = exports.isHorizontal = exports.hasUniformBorder = exports.isTransparent = exports.isInFlow = exports.isPositioned = exports.isInline = exports.isCSSFontFaceRule = void 0;

const isCSSFontFaceRule = rule => rule.type === CSSRule.FONT_FACE_RULE;

exports.isCSSFontFaceRule = isCSSFontFaceRule;

const isInline = styles => styles.displayOutside === 'inline' || styles.display.startsWith('inline-');

exports.isInline = isInline;

const isPositioned = styles => styles.position !== 'static';

exports.isPositioned = isPositioned;

const isInFlow = styles => styles.float !== 'none' && styles.position !== 'absolute' && styles.position !== 'fixed';

exports.isInFlow = isInFlow;

const isTransparent = color => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';

exports.isTransparent = isTransparent;

const hasUniformBorder = styles => parseFloat(styles.borderTopWidth) !== 0 && styles.borderTopStyle !== 'none' && styles.borderTopStyle !== 'inset' && styles.borderTopStyle !== 'outset' && !exports.isTransparent(styles.borderTopColor) && // Cannot use border property directly as in Firefox those are empty strings.
// Need to get the specific border properties from the specific sides.
// https://stackoverflow.com/questions/41696063/getcomputedstyle-returns-empty-strings-on-ff-when-instead-crome-returns-a-comp
styles.borderTopWidth === styles.borderLeftWidth && styles.borderTopWidth === styles.borderRightWidth && styles.borderTopWidth === styles.borderBottomWidth && styles.borderTopColor === styles.borderLeftColor && styles.borderTopColor === styles.borderRightColor && styles.borderTopColor === styles.borderBottomColor && styles.borderTopStyle === styles.borderLeftStyle && styles.borderTopStyle === styles.borderRightStyle && styles.borderTopStyle === styles.borderBottomStyle;

exports.hasUniformBorder = hasUniformBorder;
/** The 4 sides of a box. */

const SIDES = ['top', 'bottom', 'right', 'left'];
/** Whether the given side is a horizontal side. */

const isHorizontal = side => side === 'bottom' || side === 'top';

exports.isHorizontal = isHorizontal;
/**
 * The two corners for each side, in order of lower coordinate to higher coordinate.
 */

const CORNERS = {
  top: ['left', 'right'],
  bottom: ['left', 'right'],
  left: ['top', 'bottom'],
  right: ['top', 'bottom']
};
/**
 * Returns the (elliptic) border radii for a given side.
 * For example, for the top side it will return the horizontal top-left and the horizontal top-right border radii.
 */

function getBorderRadiiForSide(side, styles, bounds) {
  var _parseCSSLength3, _parseCSSLength4;

  const [horizontalStyle1, verticalStyle1] = styles.getPropertyValue(exports.isHorizontal(side) ? `border-${side}-${CORNERS[side][0]}-radius` : `border-${CORNERS[side][0]}-${side}-radius`).split(' ');
  const [horizontalStyle2, verticalStyle2] = styles.getPropertyValue(exports.isHorizontal(side) ? `border-${side}-${CORNERS[side][1]}-radius` : `border-${CORNERS[side][1]}-${side}-radius`).split(' ');

  if (exports.isHorizontal(side)) {
    var _parseCSSLength, _parseCSSLength2;

    return [(_parseCSSLength = parseCSSLength(horizontalStyle1 || '0px', bounds.width)) !== null && _parseCSSLength !== void 0 ? _parseCSSLength : 0, (_parseCSSLength2 = parseCSSLength(horizontalStyle2 || '0px', bounds.width)) !== null && _parseCSSLength2 !== void 0 ? _parseCSSLength2 : 0];
  }

  return [(_parseCSSLength3 = parseCSSLength(verticalStyle1 || horizontalStyle1 || '0px', bounds.height)) !== null && _parseCSSLength3 !== void 0 ? _parseCSSLength3 : 0, (_parseCSSLength4 = parseCSSLength(verticalStyle2 || horizontalStyle2 || '0px', bounds.height)) !== null && _parseCSSLength4 !== void 0 ? _parseCSSLength4 : 0];
}

exports.getBorderRadiiForSide = getBorderRadiiForSide;
/**
 * Returns the factor by which all border radii have to be scaled to fit correctly.
 *
 * @see https://drafts.csswg.org/css-backgrounds-3/#corner-overlap
 */

const calculateOverlappingCurvesFactor = (styles, bounds) => Math.min(...SIDES.map(side => {
  const length = exports.isHorizontal(side) ? bounds.width : bounds.height;
  const radiiSum = getBorderRadiiForSide(side, styles, bounds).reduce((sum, radius) => sum + radius, 0);
  return length / radiiSum;
}), 1);

exports.calculateOverlappingCurvesFactor = calculateOverlappingCurvesFactor;

const isVisible = styles => styles.displayOutside !== 'none' && styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';

exports.isVisible = isVisible;

function parseCSSLength(length, containerLength) {
  if (length.endsWith('px')) {
    return parseFloat(length);
  }

  if (length.endsWith('%')) {
    return parseFloat(length) / 100 * containerLength;
  }

  return undefined;
}

exports.parseCSSLength = parseCSSLength;

const unescapeStringValue = value => value // Replace hex escape sequences
.replace(/\\([\da-f]{1,2})/gi, (substring, codePoint) => String.fromCodePoint(parseInt(codePoint, 16))) // Replace all other escapes (quotes, backslash, etc)
.replace(/\\(.)/g, '$1');

exports.unescapeStringValue = unescapeStringValue;

function copyCssStyles(from, to) {
  for (const property of from) {
    to.setProperty(property, from.getPropertyValue(property), from.getPropertyPriority(property));
  }
}

exports.copyCssStyles = copyCssStyles;