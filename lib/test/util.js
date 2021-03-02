"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileOrUndefined = exports.forwardBrowserLogs = exports.createDeferred = void 0;
const promises_1 = require("fs/promises");
const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolve_, reject_) => {
        resolve = resolve_;
        reject = reject_;
    });
    return { promise, resolve, reject };
};
exports.createDeferred = createDeferred;
function forwardBrowserLogs(page) {
    page.on('console', message => {
        console.log('Browser console:', message.type().toUpperCase(), message.text());
    });
    page.on('error', error => {
        console.error(error);
    });
    page.on('pageerror', error => {
        console.error(error);
    });
}
exports.forwardBrowserLogs = forwardBrowserLogs;
async function readFileOrUndefined(filePath) {
    try {
        return await promises_1.readFile(filePath, 'utf-8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}
exports.readFileOrUndefined = readFileOrUndefined;
//# sourceMappingURL=util.js.map