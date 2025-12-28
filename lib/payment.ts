import crypto from 'crypto';

export function sign(params: Record<string, string | number>, key: string): string {
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== undefined).sort();
    const stringToSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + key;
    return crypto.createHash('md5').update(stringToSign).digest('hex');
}

export function verify(params: Record<string, string>, key: string): boolean {
    const { sign: signature, ...rest } = params;
    if (!signature) return false;

    const calced = sign(rest, key);
    return calced === signature;
}
