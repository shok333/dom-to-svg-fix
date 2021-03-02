"use strict";

let _ = t => t,
    _t;

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

var __importDefault = void 0 && (void 0).__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};

Object.defineProperty(exports, "__esModule", {
  value: true
});

const puppeteer_1 = __importDefault(require("puppeteer"));

const path = __importStar(require("path"));

const promises_1 = require("fs/promises");

const url_1 = require("url");

const core_1 = require("@pollyjs/core");

const PuppeteerAdapter_1 = require("./PuppeteerAdapter");

const util_1 = require("./util");

const persister_fs_1 = __importDefault(require("@pollyjs/persister-fs"));

const chai_1 = require("chai");

const pngjs_1 = require("pngjs");

const pixelmatch_1 = __importDefault(require("pixelmatch"));

const parcel_bundler_1 = __importDefault(require("parcel-bundler"));

const util = __importStar(require("util"));

const delay_1 = __importDefault(require("delay"));

const xml_formatter_1 = __importDefault(require("xml-formatter"));

const tagged_template_noop_1 = __importDefault(require("tagged-template-noop")); // Reduce log verbosity


util.inspect.defaultOptions.depth = 0;
util.inspect.defaultOptions.maxStringLength = 80;
core_1.Polly.register(PuppeteerAdapter_1.PuppeteerAdapter);
const defaultViewport = {
  width: 1200,
  height: 800
};
const mode = process.env.POLLY_MODE || 'replay';
console.log('Using Polly mode', mode);
const root = path.resolve(__dirname, '..', '..');
describe('documentToSVG()', () => {
  let browser;
  let server;
  before('Launch devserver', async () => {
    const bundler = new parcel_bundler_1.default(path.resolve(root, 'src/test/injected-script.ts'), {
      hmr: false,
      sourceMaps: true,
      minify: false
    });
    server = await bundler.serve(8080);
  });
  before('Launch browser', async () => {
    browser = await puppeteer_1.default.launch({
      headless: true,
      defaultViewport,
      devtools: true,
      args: ['--window-size=1920,1080', '--lang=en-US', '--disable-web-security', '--font-render-hinting=none', '--enable-font-antialiasing'],
      timeout: 0
    });
  });
  after('Close browser', () => {
    var _browser;

    return (_browser = browser) === null || _browser === void 0 ? void 0 : _browser.close();
  });
  after('Close devserver', done => {
    var _server;

    return (_server = server) === null || _server === void 0 ? void 0 : _server.close(done);
  });
  const snapshotDirectory = path.resolve(root, 'src/test/snapshots');
  const sites = [new URL('https://sourcegraph.com/search'), new URL('https://sourcegraph.com/extensions'), new URL('https://www.google.com?hl=en'), new URL('https://news.ycombinator.com'), new URL('https://github.com/felixfbecker/dom-to-svg/blob/fee7e1e7b63c888bc1c5205126b05c63073ebdd3/.vscode/settings.json')];

  for (const url of sites) {
    const encodedName = encodeURIComponent(url.href);
    const svgFilePath = path.resolve(snapshotDirectory, encodedName + '.svg');
    describe(url.href, () => {
      let polly;
      let page;
      before('Open tab and setup Polly', async () => {
        page = await browser.newPage();
        await page.setRequestInterception(true);
        await page.setBypassCSP(true); // Prevent Google cookie consent prompt

        if (url.hostname.endsWith('google.com')) {
          await page.setCookie({
            name: 'CONSENT',
            value: 'YES+DE.de+V14+BX',
            domain: '.google.com'
          });
        }

        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US',
          DNT: '1'
        });
        page.on('console', message => {
          console.log('🖥  ' + (message.type() !== 'log' ? message.type().toUpperCase() : ''), message.text());
        });
        const requestResourceTypes = ['xhr', 'fetch', 'document', 'script', 'stylesheet', 'image', 'font', 'other'];
        polly = new core_1.Polly(url.href, {
          mode,
          recordIfMissing: false,
          recordFailedRequests: true,
          flushRequestsOnStop: false,
          logging: false,
          adapters: [PuppeteerAdapter_1.PuppeteerAdapter],
          adapterOptions: {
            puppeteer: {
              page,
              requestResourceTypes
            }
          },
          // Very lenient, but pages often have very complex URL parameters and this usually works fine.
          matchRequestsBy: {
            method: true,
            body: false,
            url: {
              username: false,
              password: false,
              hostname: true,
              pathname: true,
              query: url.hostname !== 'www.google.com',
              hash: false
            },
            order: false,
            headers: false
          },
          persister: persister_fs_1.default,
          persisterOptions: {
            fs: {
              recordingsDir: path.resolve(root, 'src/test/recordings')
            }
          }
        });
        polly.server.get('http://localhost:8080/*').passthrough();
        polly.server.get('data:*').passthrough();
        polly.server.any('https://sentry.io/*rest').intercept((request, response) => {
          response.sendStatus(204);
        });
        polly.server.any('https://www.googletagmanager.com/*').intercept((request, response) => {
          response.sendStatus(204);
        });
        polly.server.any('https://api.github.com/_private/*rest').intercept((request, response) => {
          response.sendStatus(204);
        });
        polly.server.any('https://collector.githubapp.com/*rest').intercept((request, response) => {
          response.sendStatus(204);
        });
        polly.server.any('https://www.google.com/gen_204').intercept((request, response) => {
          response.sendStatus(204);
        });
      });
      before('Go to page', async () => {
        await page.goto(url.href, {
          waitUntil: url.host === 'github.com' ? 'domcontentloaded' : 'networkidle2',
          timeout: 60000
        });
        await page.waitForTimeout(2000);
        await page.mouse.click(0, 0); // Override system font to Arial to make screenshots deterministic cross-platform

        await page.addStyleTag({
          content: tagged_template_noop_1.default(_t || (_t = _`
						@font-face {
							font-family: system-ui;
							font-style: normal;
							font-weight: 300;
							src: local('Arial');
						}
						@font-face {
							font-family: -apple-system;
							font-style: normal;
							font-weight: 300;
							src: local('Arial');
						}
						@font-face {
							font-family: BlinkMacSystemFont;
							font-style: normal;
							font-weight: 300;
							src: local('Arial');
						}
					`))
        }); // await new Promise<never>(() => {})
      });
      after('Stop Polly', () => {
        var _polly;

        return (_polly = polly) === null || _polly === void 0 ? void 0 : _polly.stop();
      });
      after('Close page', () => {
        var _page;

        return (_page = page) === null || _page === void 0 ? void 0 : _page.close();
      });
      let svgPage;
      before('Produce SVG', async () => {
        const svgDeferred = util_1.createDeferred();
        await page.exposeFunction('resolveSVG', svgDeferred.resolve);
        await page.exposeFunction('rejectSVG', svgDeferred.reject);
        const injectedScriptUrl = 'http://localhost:8080/injected-script.js';
        await page.addScriptTag({
          url: injectedScriptUrl
        });
        const generatedSVGMarkup = await Promise.race([svgDeferred.promise.catch(({
          message,
          ...error
        }) => Promise.reject(Object.assign(new Error(message), error))), delay_1.default(120000).then(() => Promise.reject(new Error('Timeout generating SVG')))]);
        console.log('Formatting SVG');
        const generatedSVGMarkupFormatted = xml_formatter_1.default(generatedSVGMarkup);
        await promises_1.writeFile(svgFilePath, generatedSVGMarkupFormatted);
        svgPage = await browser.newPage();
        await svgPage.goto(url_1.pathToFileURL(svgFilePath).href); // await new Promise<never>(() => {})
      });
      after('Close SVG page', () => {
        var _svgPage;

        return (_svgPage = svgPage) === null || _svgPage === void 0 ? void 0 : _svgPage.close();
      });
      it('produces SVG that is visually the same', async () => {
        console.log('Bringing page to front');
        await page.bringToFront();
        console.log('Snapshotting the original page');
        const expectedScreenshot = await page.screenshot({
          encoding: 'binary',
          type: 'png',
          fullPage: false
        });
        await promises_1.writeFile(path.resolve(snapshotDirectory, `${encodedName}.expected.png`), expectedScreenshot);
        console.log('Snapshotting the SVG');
        const actualScreenshot = await svgPage.screenshot({
          encoding: 'binary',
          type: 'png',
          fullPage: false
        });
        await promises_1.writeFile(path.resolve(snapshotDirectory, `${encodedName}.actual.png`), actualScreenshot);
        console.log('Snapshotted, comparing PNGs');
        const expectedPNG = pngjs_1.PNG.sync.read(expectedScreenshot);
        const actualPNG = pngjs_1.PNG.sync.read(actualScreenshot);
        const {
          width,
          height
        } = expectedPNG;
        const diffPNG = new pngjs_1.PNG({
          width,
          height
        });
        const differentPixels = pixelmatch_1.default(expectedPNG.data, actualPNG.data, diffPNG.data, width, height, {
          threshold: 0.3
        });
        const differenceRatio = differentPixels / (width * height);
        const diffPngBuffer = pngjs_1.PNG.sync.write(diffPNG);
        await promises_1.writeFile(path.resolve(snapshotDirectory, `${encodedName}.diff.png`), diffPngBuffer);

        if (process.env.TERM_PROGRAM === 'iTerm.app') {
          const nameBase64 = Buffer.from(encodedName + '.diff.png').toString('base64');
          const diffBase64 = diffPngBuffer.toString('base64');
          console.log(`\u001B]1337;File=name=${nameBase64};inline=1;width=1080px:${diffBase64}\u0007`);
        }

        const differencePercentage = differenceRatio * 100;
        console.log('Difference', differencePercentage.toFixed(2) + '%');
        chai_1.assert.isBelow(differencePercentage, 0.5); // %
      });
      it('produces SVG with the expected accessibility tree', async function () {
        const snapshotPath = path.resolve(snapshotDirectory, encodedName + '.a11y.json');
        const expectedAccessibilityTree = await util_1.readFileOrUndefined(snapshotPath);
        const actualAccessibilityTree = await svgPage.accessibility.snapshot();
        await promises_1.writeFile(snapshotPath, JSON.stringify(actualAccessibilityTree, null, 2));

        if (!expectedAccessibilityTree) {
          this.skip();
        }

        chai_1.assert.deepStrictEqual(actualAccessibilityTree, JSON.parse(expectedAccessibilityTree), 'Expected accessibility tree to be the same as snapshot');
      });
    });
  }
});