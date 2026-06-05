"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomNumericOtp = randomNumericOtp;
exports.constantTimeEqual = constantTimeEqual;
function randomNumericOtp(length = 6) {
    const max = 10 ** length;
    const n = Math.floor(Math.random() * max);
    return n.toString().padStart(length, "0");
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let res = 0;
    for (let i = 0; i < a.length; i++)
        res |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return res === 0;
}
