"use strict";

var __createBinding = void 0 && (void 0).__createBinding || (Object.create ? function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  Object.defineProperty(o, k2, {
    enumerable: true,
    get: function () {
      return m[k];
    }
  });
} : function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
});

var __setModuleDefault = void 0 && (void 0).__setModuleDefault || (Object.create ? function (o, v) {
  Object.defineProperty(o, "default", {
    enumerable: true,
    value: v
  });
} : function (o, v) {
  o["default"] = v;
});

var __importStar = void 0 && (void 0).__importStar || function (mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);

  __setModuleDefault(result, mod);

  return result;
};

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertLinearGradient = void 0;
/* eslint-disable id-length */

const dom_1 = require("./dom");

const gradientParser = __importStar(require("gradient-parser"));

const positionsForOrientation = orientation => {
  const positions = {
    x1: '0%',
    x2: '0%',
    y1: '0%',
    y2: '0%'
  };

  if ((orientation === null || orientation === void 0 ? void 0 : orientation.type) === 'angular') {
    const anglePI = orientation.value * (Math.PI / 180);
    positions.x1 = `${Math.round(50 + Math.sin(anglePI + Math.PI) * 50)}%`;
    positions.y1 = `${Math.round(50 + Math.cos(anglePI) * 50)}%`;
    positions.x2 = `${Math.round(50 + Math.sin(anglePI) * 50)}%`;
    positions.y2 = `${Math.round(50 + Math.cos(anglePI + Math.PI) * 50)}%`;
  } else if ((orientation === null || orientation === void 0 ? void 0 : orientation.type) === 'directional') {
    switch (orientation.value) {
      case 'left':
        positions.x1 = '100%';
        break;

      case 'top':
        positions.y1 = '100%';
        break;

      case 'right':
        positions.x2 = '100%';
        break;

      case 'bottom':
        positions.y2 = '100%';
        break;
    }
  }

  return positions;
};

function convertLinearGradient(css, {
  svgDocument
}) {
  const {
    orientation,
    colorStops
  } = gradientParser.parse(css)[0];
  const {
    x1,
    x2,
    y1,
    y2
  } = positionsForOrientation(orientation);

  const getColorStops = (colorStop, index) => {
    const offset = `${index / (colorStops.length - 1) * 100}%`;
    let stopColor = 'rgb(0,0,0)';
    let stopOpacity = 1;

    switch (colorStop.type) {
      case 'rgb':
        {
          const [red, green, blue] = colorStop.value;
          stopColor = `rgb(${red},${green},${blue})`;
          break;
        }

      case 'rgba':
        {
          const [red, green, blue, alpha] = colorStop.value;
          stopColor = `rgb(${red},${green},${blue})`;
          stopOpacity = alpha;
          break;
        }

      case 'hex':
        {
          stopColor = `#${colorStop.value}`;
          break;
        }

      case 'literal':
        {
          stopColor = colorStop.value;
          break;
        }
    }

    const stop = svgDocument.createElementNS(dom_1.svgNamespace, 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', stopColor);
    stop.setAttribute('stop-opacity', stopOpacity.toString());
    return stop;
  };

  const linearGradient = svgDocument.createElementNS(dom_1.svgNamespace, 'linearGradient');
  linearGradient.setAttribute('x1', x1);
  linearGradient.setAttribute('y1', y1);
  linearGradient.setAttribute('x2', x2);
  linearGradient.setAttribute('y2', y2);
  linearGradient.append(...colorStops.map(getColorStops));
  return linearGradient;
}

exports.convertLinearGradient = convertLinearGradient;