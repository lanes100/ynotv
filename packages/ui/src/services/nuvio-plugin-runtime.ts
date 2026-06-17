import CryptoJS from 'crypto-js';
import { type PluginScraper } from '../stores/nuvioPluginStore';

export interface PluginRuntimeResult {
  title: string;
  name: string | null;
  url: string;
  quality?: string | null;
  size?: string | null;
  language?: string | null;
  provider?: string | null;
  type?: string | null;
  seeders?: number | null;
  peers?: number | null;
  infoHash?: string | null;
  headers?: Record<string, string> | null;
}

function querySelectorAllWithContains(root: ParentNode, selector: string): Element[] {
  if (!selector) return [];
  const containsIndex = selector.indexOf(':contains(');
  if (containsIndex !== -1) {
    const baseSelector = selector.substring(0, containsIndex).trim() || '*';
    const containsRest = selector.substring(containsIndex);
    const textMatch = containsRest.match(/:contains\(["']?([^"')]*)["']?\)/);
    const text = textMatch ? textMatch[1] : '';
    
    const baseElements = Array.from(root.querySelectorAll(baseSelector));
    const filtered = baseElements.filter(el => el.textContent?.includes(text));
    
    const remainingSelector = containsRest.replace(/:contains\(["']?[^"')]*["']?\)/, '').trim();
    if (remainingSelector) {
      const results: Element[] = [];
      filtered.forEach(el => {
        results.push(...Array.from(el.querySelectorAll(remainingSelector)));
      });
      return results;
    }
    return filtered;
  }
  
  return Array.from(root.querySelectorAll(selector));
}

export async function executePlugin(
  code: string,
  tmdbId: string,
  mediaType: string,
  season: number | null,
  episode: number | null,
  scraperId: string,
  scraperSettings: Record<string, any> = {}
): Promise<PluginRuntimeResult[]> {
  const documentCache = new Map<string, Document>();
  const elementCache = new Map<string, Element>();
  let idCounter = 0;
  let resultJson = '[]';

  const __cheerio_load = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const docId = `doc_${idCounter++}_${Math.floor(Math.random() * 1000000)}`;
    documentCache.set(docId, doc);
    return docId;
  };

  const __cheerio_select = (docId: string, selector: string) => {
    const doc = documentCache.get(docId);
    if (!doc) return '[]';
    try {
      const elements = querySelectorAllWithContains(doc, selector);
      const ids = elements.map((el, index) => {
        const id = `${docId}:${index}:${Math.floor(Math.random() * 1000000)}`;
        elementCache.set(id, el);
        return id;
      });
      return JSON.stringify(ids);
    } catch (e) {
      return '[]';
    }
  };

  const __cheerio_find = (docId: string, elementId: string, selector: string) => {
    const element = elementCache.get(elementId);
    if (!element) return '[]';
    try {
      const elements = querySelectorAllWithContains(element, selector);
      const ids = elements.map((el, index) => {
        const id = `${docId}:find:${index}:${Math.floor(Math.random() * 1000000)}`;
        elementCache.set(id, el);
        return id;
      });
      return JSON.stringify(ids);
    } catch (e) {
      return '[]';
    }
  };

  const __cheerio_text = (docId: string, elementIds: string) => {
    return elementIds.split(',')
      .filter(id => id.length > 0)
      .map(id => elementCache.get(id)?.textContent || '')
      .join(' ');
  };

  const __cheerio_html = (docId: string, elementId: string) => {
    if (!elementId) {
      return documentCache.get(docId)?.documentElement?.innerHTML || '';
    }
    return elementCache.get(elementId)?.outerHTML || '';
  };

  const __cheerio_inner_html = (docId: string, elementId: string) => {
    return elementCache.get(elementId)?.innerHTML || '';
  };

  const __cheerio_attr = (docId: string, elementId: string, attrName: string) => {
    const el = elementCache.get(elementId);
    if (!el) return '__UNDEFINED__';
    const val = el.getAttribute(attrName);
    return (val === null || val === undefined) ? '__UNDEFINED__' : val;
  };

  const __cheerio_next = (docId: string, elementId: string) => {
    const el = elementCache.get(elementId);
    const next = el?.nextElementSibling;
    if (!next) return '__NONE__';
    const id = `${docId}:next:${Math.floor(Math.random() * 1000000)}`;
    elementCache.set(id, next);
    return id;
  };

  const __cheerio_prev = (docId: string, elementId: string) => {
    const el = elementCache.get(elementId);
    const prev = el?.previousElementSibling;
    if (!prev) return '__NONE__';
    const id = `${docId}:prev:${Math.floor(Math.random() * 1000000)}`;
    elementCache.set(id, prev);
    return id;
  };

  const __native_fetch = async (url: string, method: string, headersJson: string, body: string, followRedirects: boolean) => {
    const headers = JSON.parse(headersJson);
    const proxy = (window as any).fetchProxy;
    const fetchOptions: any = {
      method,
      headers,
    };
    if (body) {
      fetchOptions.body = body;
    }
    if (!followRedirects) {
      fetchOptions.redirect = 'manual';
    }

    try {
      let responseText = '';
      let responseStatus = 0;
      let responseStatusText = '';
      let responseOk = false;
      let responseUrl = url;
      let responseHeaders: Record<string, string> = {};

      if (proxy?.fetch) {
        const res = await proxy.fetch(url, fetchOptions);
        if (res.error) throw new Error(res.error);
        const data = res.data;
        responseText = data.text;
        responseStatus = data.status;
        responseStatusText = data.statusText;
        responseOk = data.ok;
        responseUrl = url;
      } else {
        const res = await fetch(url, fetchOptions);
        responseText = await res.text();
        responseStatus = res.status;
        responseStatusText = res.statusText;
        responseOk = res.ok;
        responseUrl = res.url;
        res.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });
      }

      return JSON.stringify({
        ok: responseOk,
        status: responseStatus,
        statusText: responseStatusText,
        url: responseUrl,
        body: responseText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      return JSON.stringify({
        ok: false,
        status: 0,
        statusText: err.message || 'Fetch failed',
        url,
        body: '',
        headers: {},
      });
    }
  };

  const __crypto_digest_hex = (algorithm: string, data: string) => {
    const algo = algorithm.toUpperCase();
    if (algo === 'MD5') return CryptoJS.MD5(data).toString();
    if (algo === 'SHA1') return CryptoJS.SHA1(data).toString();
    if (algo === 'SHA256') return CryptoJS.SHA256(data).toString();
    if (algo === 'SHA512') return CryptoJS.SHA512(data).toString();
    return '';
  };

  const __crypto_hmac_hex = (algorithm: string, key: string, data: string) => {
    const algo = algorithm.toUpperCase();
    if (algo === 'MD5') return CryptoJS.HmacMD5(data, key).toString();
    if (algo === 'SHA1') return CryptoJS.HmacSHA1(data, key).toString();
    if (algo === 'SHA256') return CryptoJS.HmacSHA256(data, key).toString();
    if (algo === 'SHA512') return CryptoJS.HmacSHA512(data, key).toString();
    return '';
  };

  const __crypto_base64_encode = (data: string) => {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
  };

  const __crypto_base64_decode = (data: string) => {
    return CryptoJS.enc.Base64.parse(data).toString(CryptoJS.enc.Utf8);
  };

  const __crypto_utf8_to_hex = (data: string) => {
    return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(data));
  };

  const __crypto_hex_to_utf8 = (data: string) => {
    return CryptoJS.enc.Hex.parse(data).toString(CryptoJS.enc.Utf8);
  };

  const __parse_url = (urlString: string) => {
    try {
      const parsed = new URL(urlString);
      return JSON.stringify({
        protocol: parsed.protocol,
        host: parsed.host,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname || '/',
        search: parsed.search || '',
        hash: parsed.hash || '',
      });
    } catch (e) {
      return JSON.stringify({
        protocol: '',
        host: '',
        hostname: '',
        port: '',
        pathname: '/',
        search: '',
        hash: '',
      });
    }
  };

  const __capture_result = (res: string) => {
    resultJson = res;
  };

  const buildPolyfills = `
    const SCRAPER_ID = ${JSON.stringify(scraperId)};
    const SCRAPER_SETTINGS = ${JSON.stringify(scraperSettings)};
    const global = this;
    const window = this;
    const self = this;

    const fetch = async function(url, options) {
        options = options || {};
        const method = (options.method || 'GET').toUpperCase();
        const headers = options.headers || {};
        const body = options.body || '';
        const followRedirects = options.redirect !== 'manual';
        const result = await __native_fetch(url, method, JSON.stringify(headers), body, followRedirects);
        const parsed = JSON.parse(result);
        return {
            ok: parsed.ok,
            status: parsed.status,
            statusText: parsed.statusText,
            url: parsed.url,
            headers: {
                get: function(name) {
                    return parsed.headers[name.toLowerCase()] || null;
                }
            },
            text: function() { return Promise.resolve(parsed.body); },
            json: function() {
                try {
                    if (parsed.body === null || parsed.body === undefined || parsed.body === '') {
                        return Promise.resolve(null);
                    }
                    return Promise.resolve(JSON.parse(parsed.body));
                } catch (e) {
                    return Promise.resolve(null);
                }
            }
        };
    };

    if (typeof AbortSignal === 'undefined') {
        var AbortSignal = function() { this.aborted = false; this.reason = undefined; this._listeners = []; };
        AbortSignal.prototype.addEventListener = function(type, listener) {
            if (type !== 'abort' || typeof listener !== 'function') return;
            this._listeners.push(listener);
        };
        AbortSignal.prototype.removeEventListener = function(type, listener) {
            if (type !== 'abort') return;
            this._listeners = this._listeners.filter(function(l) { return l !== listener; });
        };
        AbortSignal.prototype.dispatchEvent = function(event) {
            if (!event || event.type !== 'abort') return true;
            for (var i = 0; i < this._listeners.length; i++) {
                try { this._listeners[i].call(this, event); } catch (e) {}
            }
            return true;
        };
        this.AbortSignal = AbortSignal;
    }

    if (typeof AbortController === 'undefined') {
        var AbortController = function() { this.signal = new AbortSignal(); };
        AbortController.prototype.abort = function(reason) {
            if (this.signal.aborted) return;
            this.signal.aborted = true;
            this.signal.reason = reason;
            this.signal.dispatchEvent({ type: 'abort' });
        };
        this.AbortController = AbortController;
    }

    if (typeof atob === 'undefined') {
        this.atob = function(input) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            var str = String(input).replace(/=+$/, '');
            if (str.length % 4 === 1) throw new Error('InvalidCharacterError');
            var output = '';
            var bc = 0, bs, buffer, idx = 0;
            while ((buffer = str.charAt(idx++))) {
                buffer = chars.indexOf(buffer);
                if (buffer === -1) continue;
                bs = bc % 4 ? bs * 64 + buffer : buffer;
                if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
            }
            return output;
        };
    }

    if (typeof btoa === 'undefined') {
        this.btoa = function(input) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            var str = String(input);
            var output = '';
            for (var block, charCode, idx = 0, map = chars;
                 str.charAt(idx | 0) || (map = '=', idx % 1);
                 output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))) {
                charCode = str.charCodeAt(idx += 3 / 4);
                if (charCode > 0xFF) throw new Error('InvalidCharacterError');
                block = (block << 8) | charCode;
            }
            return output;
        };
    }

    const URL = function(urlString, base) {
        var fullUrl = urlString;
        if (base && !/^https?:\\/\\//i.test(urlString)) {
            var b = typeof base === 'string' ? base : base.href;
            if (urlString.charAt(0) === '/') {
                var m = b.match(/^(https?:\\/\\/[^\\/]+)/);
                fullUrl = m ? m[1] + urlString : urlString;
            } else {
                fullUrl = b.replace(/\\/[^\\/]*$/, '/') + urlString;
            }
        }
        var parsed = __parse_url(fullUrl);
        var data = JSON.parse(parsed);
        this.href = fullUrl;
        this.protocol = data.protocol;
        this.host = data.host;
        this.hostname = data.hostname;
        this.port = data.port;
        this.pathname = data.pathname;
        this.search = data.search;
        this.hash = data.hash;
        this.origin = data.protocol + '//' + data.host;
        this.searchParams = new URLSearchParams(data.search || '');
    };
    URL.prototype.toString = function() { return this.href; };

    const URLSearchParams = function(init) {
        this._params = {};
        var self = this;
        if (init && typeof init === 'object' && !Array.isArray(init)) {
            Object.keys(init).forEach(function(key) { self._params[key] = String(init[key]); });
        } else if (typeof init === 'string') {
            init.replace(/^\\?/, '').split('&').forEach(function(pair) {
                var parts = pair.split('=');
                if (parts[0]) self._params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
            });
        }
    };
    URLSearchParams.prototype.toString = function() {
        var self = this;
        return Object.keys(this._params).map(function(key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(self._params[key]);
        }).join('&');
    };
    URLSearchParams.prototype.get = function(key) { return this._params.hasOwnProperty(key) ? this._params[key] : null; };
    URLSearchParams.prototype.set = function(key, value) { this._params[key] = String(value); };
    URLSearchParams.prototype.append = function(key, value) { this._params[key] = String(value); };
    URLSearchParams.prototype.has = function(key) { return this._params.hasOwnProperty(key); };
    URLSearchParams.prototype.delete = function(key) { delete this._params[key]; };
    URLSearchParams.prototype.keys = function() { return Object.keys(this._params); };
    URLSearchParams.prototype.values = function() {
        var self = this;
        return Object.keys(this._params).map(function(k) { return self._params[k]; });
    };
    URLSearchParams.prototype.entries = function() {
        var self = this;
        return Object.keys(this._params).map(function(k) { return [k, self._params[k]]; });
    };
    URLSearchParams.prototype.forEach = function(callback) {
        var self = this;
        Object.keys(this._params).forEach(function(key) { callback(self._params[key], key, self); });
    };
    URLSearchParams.prototype.getAll = function(key) {
        return this._params.hasOwnProperty(key) ? [this._params[key]] : [];
    };
    URLSearchParams.prototype.sort = function() {
        var sorted = {};
        var self = this;
        Object.keys(this._params).sort().forEach(function(k) { sorted[k] = self._params[k]; });
        this._params = sorted;
    };

    function __hexToWords(hex) {
        var words = [];
        for (var i = 0; i < hex.length; i += 8) {
            var chunk = hex.substring(i, i + 8);
            while (chunk.length < 8) chunk += '0';
            words.push(parseInt(chunk, 16) | 0);
        }
        return words;
    }

    function __wordsToHex(words, sigBytes) {
        var hex = '';
        for (var i = 0; i < sigBytes; i++) {
            var word = words[i >>> 2] || 0;
            var byte = (word >>> (24 - (i % 4) * 8)) & 0xff;
            var part = byte.toString(16);
            if (part.length < 2) part = '0' + part;
            hex += part;
        }
        return hex;
    }

    function __wordArrayToHex(value) {
        if (!value) return '';
        if (typeof value.__hex === 'string') return value.__hex.toLowerCase();
        if (Array.isArray(value.words) && typeof value.sigBytes === 'number') {
            return __wordsToHex(value.words, value.sigBytes);
        }
        return __crypto_utf8_to_hex(String(value));
    }

    function __buildWordArray(hex, utf8Override) {
        var normalizedHex = (hex || '').toLowerCase();
        if (normalizedHex.length % 2 !== 0) normalizedHex = '0' + normalizedHex;
        var wordArray = {
            __hex: normalizedHex,
            __utf8: utf8Override !== undefined ? utf8Override : __crypto_hex_to_utf8(normalizedHex),
            sigBytes: normalizedHex.length / 2,
            words: __hexToWords(normalizedHex),
            toString: function(encoder) {
                if (!encoder || encoder === CryptoJS.enc.Hex) return this.__hex;
                if (encoder === CryptoJS.enc.Utf8) return this.__utf8;
                if (encoder === CryptoJS.enc.Base64) return __crypto_base64_encode(this.__utf8);
                return this.__hex;
            },
            clamp: function() {
                return this;
            },
            concat: function(other) {
                var otherHex = __wordArrayToHex(other);
                this.__hex += otherHex;
                this.__utf8 = __crypto_hex_to_utf8(this.__hex);
                this.sigBytes = this.__hex.length / 2;
                this.words = __hexToWords(this.__hex);
                return this;
            }
        };
        return wordArray;
    }

    function __wordArrayFromHex(hex) {
        return __buildWordArray(hex, undefined);
    }

    function __wordArrayFromUtf8(text) {
        var utf8 = text == null ? '' : String(text);
        return __buildWordArray(__crypto_utf8_to_hex(utf8), utf8);
    }

    function __wordArrayFromBase64(base64) {
        return __wordArrayFromUtf8(__crypto_base64_decode(base64 || ''));
    }

    function __normalizeWordArrayInput(value) {
        if (value && typeof value === 'object' && typeof value.__utf8 === 'string') {
            return value.__utf8;
        }
        if (value && typeof value === 'object' && typeof value.__hex === 'string') {
            return __crypto_hex_to_utf8(value.__hex);
        }
        if (value && typeof value === 'object' && Array.isArray(value.words) && typeof value.sigBytes === 'number') {
            return __crypto_hex_to_utf8(__wordsToHex(value.words, value.sigBytes));
        }
        if (value == null) return '';
        return String(value);
    }

    function __cryptoHashWordArray(algorithm, message) {
        var utf8 = __normalizeWordArrayInput(message);
        var hex = __crypto_digest_hex(algorithm, utf8);
        return __wordArrayFromHex(hex);
    }

    function __cryptoHmacWordArray(algorithm, message, key) {
        var utf8Message = __normalizeWordArrayInput(message);
        var utf8Key = __normalizeWordArrayInput(key);
        var hex = __crypto_hmac_hex(algorithm, utf8Key, utf8Message);
        return __wordArrayFromHex(hex);
    }

    const CryptoJS = {
        enc: {
            Hex: {
                stringify: function(wordArray) {
                    return __wordArrayToHex(wordArray);
                },
                parse: function(hexStr) {
                    return __wordArrayFromHex(hexStr || '');
                }
            },
            Utf8: {
                stringify: function(wordArray) {
                    if (wordArray && typeof wordArray.__utf8 === 'string') return wordArray.__utf8;
                    if (wordArray && typeof wordArray.__hex === 'string') return __crypto_hex_to_utf8(wordArray.__hex);
                    return __normalizeWordArrayInput(wordArray);
                },
                parse: function(text) {
                    return __wordArrayFromUtf8(text);
                }
            },
            Base64: {
                stringify: function(wordArray) {
                    if (wordArray && typeof wordArray.__utf8 === 'string') {
                        return __crypto_base64_encode(wordArray.__utf8);
                    }
                    return __crypto_base64_encode(__normalizeWordArrayInput(wordArray));
                },
                parse: function(base64) {
                    return __wordArrayFromBase64(base64);
                }
            }
        },
        MD5: function(message) { return __cryptoHashWordArray('MD5', message); },
        SHA1: function(message) { return __cryptoHashWordArray('SHA1', message); },
        SHA256: function(message) { return __cryptoHashWordArray('SHA256', message); },
        SHA512: function(message) { return __cryptoHashWordArray('SHA512', message); },
        HmacMD5: function(message, key) { return __cryptoHmacWordArray('MD5', message, key); },
        HmacSHA1: function(message, key) { return __cryptoHmacWordArray('SHA1', message, key); },
        HmacSHA256: function(message, key) { return __cryptoHmacWordArray('SHA256', message, key); },
        HmacSHA512: function(message, key) { return __cryptoHmacWordArray('SHA512', message, key); }
    };

    const cheerio = {
        load: function(html) {
            const docId = __cheerio_load(html);
            const $ = function(selector, context) {
                if (selector && selector._elementIds) return selector;
                if (context && context._elementIds && context._elementIds.length > 0) {
                    var allIds = [];
                    for (var i = 0; i < context._elementIds.length; i++) {
                        var childIdsJson = __cheerio_find(docId, context._elementIds[i], selector);
                        var childIds = JSON.parse(childIdsJson);
                        allIds = allIds.concat(childIds);
                    }
                    return createCheerioWrapperFromIds(docId, allIds);
                }
                return createCheerioWrapper(docId, selector);
            };
            $.html = function(el) {
                if (el && el._elementIds && el._elementIds.length > 0) {
                    return __cheerio_html(docId, el._elementIds[0]);
                }
                return __cheerio_html(docId, '');
            };
            return $;
        }
    };

    function createCheerioWrapper(docId, selector) {
        var elementIds;
        if (typeof selector === 'string') {
            var idsJson = __cheerio_select(docId, selector);
            elementIds = JSON.parse(idsJson);
        } else {
            elementIds = [];
        }
        return createCheerioWrapperFromIds(docId, elementIds);
    }

    function createCheerioWrapperFromIds(docId, ids) {
        var wrapper = {
            _docId: docId,
            _elementIds: ids,
            length: ids.length,
            each: function(callback) {
                for (var i = 0; i < ids.length; i++) {
                    var elWrapper = createCheerioWrapperFromIds(docId, [ids[i]]);
                    callback.call(elWrapper, i, elWrapper);
                }
                return wrapper;
            },
            find: function(sel) {
                var allIds = [];
                for (var i = 0; i < ids.length; i++) {
                    var childIdsJson = __cheerio_find(docId, ids[i], sel);
                    var childIds = JSON.parse(childIdsJson);
                    allIds = allIds.concat(childIds);
                }
                return createCheerioWrapperFromIds(docId, allIds);
            },
            text: function() {
                if (ids.length === 0) return '';
                return __cheerio_text(docId, ids.join(','));
            },
            html: function() {
                if (ids.length === 0) return '';
                return __cheerio_inner_html(docId, ids[0]);
            },
            attr: function(name) {
                if (ids.length === 0) return undefined;
                var val = __cheerio_attr(docId, ids[0], name);
                return val === '__UNDEFINED__' ? undefined : val;
            },
            first: function() { return createCheerioWrapperFromIds(docId, ids.length > 0 ? [ids[0]] : []); },
            last: function() { return createCheerioWrapperFromIds(docId, ids.length > 0 ? [ids[ids.length - 1]] : []); },
            next: function() {
                var nextIds = [];
                for (var i = 0; i < ids.length; i++) {
                    var nextId = __cheerio_next(docId, ids[i]);
                    if (nextId && nextId !== '__NONE__') nextIds.push(nextId);
                }
                return createCheerioWrapperFromIds(docId, nextIds);
            },
            prev: function() {
                var prevIds = [];
                for (var i = 0; i < ids.length; i++) {
                    var prevId = __cheerio_prev(docId, ids[i]);
                    if (prevId && prevId !== '__NONE__') prevIds.push(prevId);
                }
                return createCheerioWrapperFromIds(docId, prevIds);
            },
            eq: function(index) {
                if (index >= 0 && index < ids.length) return createCheerioWrapperFromIds(docId, [ids[index]]);
                return createCheerioWrapperFromIds(docId, []);
            },
            get: function(index) {
                if (typeof index === 'number') {
                    if (index >= 0 && index < ids.length) return createCheerioWrapperFromIds(docId, [ids[index]]);
                    return undefined;
                }
                return ids.map(function(id) { return createCheerioWrapperFromIds(docId, [id]); });
            },
            map: function(callback) {
                var results = [];
                for (var i = 0; i < ids.length; i++) {
                    var elWrapper = createCheerioWrapperFromIds(docId, [ids[i]]);
                    var result = callback.call(elWrapper, i, elWrapper);
                    if (result !== undefined && result !== null) results.push(result);
                }
                return {
                    length: results.length,
                    get: function(index) { return typeof index === 'number' ? results[index] : results; },
                    toArray: function() { return results; }
                };
            },
            filter: function(selectorOrCallback) {
                if (typeof selectorOrCallback === 'function') {
                    var filteredIds = [];
                    for (var i = 0; i < ids.length; i++) {
                        var elWrapper = createCheerioWrapperFromIds(docId, [ids[i]]);
                        var result = selectorOrCallback.call(elWrapper, i, elWrapper);
                        if (result) filteredIds.push(ids[i]);
                    }
                    return createCheerioWrapperFromIds(docId, filteredIds);
                }
                return wrapper;
            },
            children: function(sel) { return this.find(sel || '*'); },
            parent: function() { return createCheerioWrapperFromIds(docId, []); },
            toArray: function() { return ids.map(function(id) { return createCheerioWrapperFromIds(docId, [id]); }); }
        };
        return wrapper;
    }

    const require = function(moduleName) {
        if (moduleName === 'cheerio' || moduleName === 'cheerio-without-node-native' || moduleName === 'react-native-cheerio') {
            return cheerio;
        }
        if (moduleName === 'crypto-js') {
            return CryptoJS;
        }
        throw new Error("Module '" + moduleName + "' is not available");
    };

    var module = { exports: {} };
    var exports = module.exports;
  `;

  const fullScript = `
    ${buildPolyfills}
    
    (function() {
      ${code}
    })();

    return (async function() {
      try {
        const getStreams = module.exports.getStreams || globalThis.getStreams || this.getStreams;
        if (!getStreams) {
          console.error("getStreams function not found on module.exports or globalThis");
          __capture_result(JSON.stringify([]));
          return;
        }
        const seasonVal = ${season !== null ? season : 'undefined'};
        const episodeVal = ${episode !== null ? episode : 'undefined'};
        const result = await getStreams(${JSON.stringify(tmdbId)}, ${JSON.stringify(mediaType)}, seasonVal, episodeVal);
        __capture_result(JSON.stringify(result || []));
      } catch (e) {
        console.error("getStreams error:", e && e.message ? e.message : e, e && e.stack ? e.stack : "");
        __capture_result(JSON.stringify([]));
      }
    })();
  `;

  const contextFunc = new Function(
    '__cheerio_load',
    '__cheerio_select',
    '__cheerio_find',
    '__cheerio_text',
    '__cheerio_html',
    '__cheerio_inner_html',
    '__cheerio_attr',
    '__cheerio_next',
    '__cheerio_prev',
    '__native_fetch',
    '__crypto_digest_hex',
    '__crypto_hmac_hex',
    '__crypto_base64_encode',
    '__crypto_base64_decode',
    '__crypto_utf8_to_hex',
    '__crypto_hex_to_utf8',
    '__parse_url',
    '__capture_result',
    fullScript
  );

  try {
    const sandbox = {};
    await contextFunc.call(
      sandbox,
      __cheerio_load,
      __cheerio_select,
      __cheerio_find,
      __cheerio_text,
      __cheerio_html,
      __cheerio_inner_html,
      __cheerio_attr,
      __cheerio_next,
      __cheerio_prev,
      __native_fetch,
      __crypto_digest_hex,
      __crypto_hmac_hex,
      __crypto_base64_encode,
      __crypto_base64_decode,
      __crypto_utf8_to_hex,
      __crypto_hex_to_utf8,
      __parse_url,
      __capture_result
    );
  } catch (e) {
    console.error(`[NuvioPluginRuntime] Sandbox execution error in scraper ${scraperId}:`, e);
  }

  try {
    const rawResults = JSON.parse(resultJson);
    if (!Array.isArray(rawResults)) return [];
    
    return rawResults.map((item: any) => {
      const url = typeof item.url === 'string' ? item.url : (item.url?.url || '');
      return {
        title: item.title || item.name || 'Unknown Stream',
        name: item.name || null,
        url,
        quality: item.quality || null,
        size: item.size || null,
        language: item.language || null,
        provider: item.provider || null,
        type: item.type || null,
        seeders: typeof item.seeders === 'number' ? item.seeders : null,
        peers: typeof item.peers === 'number' ? item.peers : null,
        infoHash: item.infoHash || null,
        headers: item.headers || null,
      };
    }).filter((r: any) => r.url);
  } catch (e) {
    console.error(`[NuvioPluginRuntime] Failed to parse results for scraper ${scraperId}:`, e);
    return [];
  }
}
