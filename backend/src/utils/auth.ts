export function randomNumericOtp(length = 6): string {
    const max = 10 ** length;
    const n = Math.floor(Math.random() * max);
    return n.toString().padStart(length, "0");
}

export function constantTimeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let res = 0;
    for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return res === 0;
}

