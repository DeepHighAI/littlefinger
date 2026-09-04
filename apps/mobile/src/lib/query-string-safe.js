// Expo Router가 사용하는 parse/stringify 표면만 유지하고 외부 입력의 작업량을 제한한다.
const MAX_QUERY_LENGTH = 8192;
const MAX_QUERY_PAIRS = 100;

function decode(value) {
  const normalized = value.replace(/\+/gu, ' ');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function parse(input) {
  const result = Object.create(null);
  if (typeof input !== 'string' || input.length > MAX_QUERY_LENGTH) return result;

  const query = input.trim().replace(/^[?#&]/u, '');
  if (query.length === 0) return result;

  for (const part of query.split('&', MAX_QUERY_PAIRS)) {
    if (part.length === 0) continue;

    const separator = part.indexOf('=');
    const key = decode(separator === -1 ? part : part.slice(0, separator));
    const value = separator === -1 ? null : decode(part.slice(separator + 1));
    const previous = result[key];

    if (previous === undefined) result[key] = value;
    else if (Array.isArray(previous)) previous.push(value);
    else result[key] = [previous, value];
  }

  return result;
}

function stringifyValue(key, value) {
  if (value === undefined) return [];
  if (value === null) return [encode(key)];
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringifyValue(key, item));
  }
  return [`${encode(key)}=${encode(String(value))}`];
}

function stringify(input, options = {}) {
  if (input === null || typeof input !== 'object') return '';

  const keys = Object.keys(input);
  if (options.sort !== false) keys.sort(typeof options.sort === 'function' ? options.sort : undefined);

  return keys.flatMap((key) => stringifyValue(key, input[key])).join('&');
}

module.exports = { parse, stringify };
