const _URL = require('../src/url');
const URL = _URL.default || _URL;
const _File = require('../src/file');
const File = _File.default || _File;
const _HttpException = require('../src/exception/httpException');
const HttpException = _HttpException.default || _HttpException;
const _ThrottleRequestsException = require('../src/exception/throttleRequestsException');
const ThrottleRequestsException = _ThrottleRequestsException.default || _ThrottleRequestsException;
const _TokenMismatchException = require('../src/exception/tokenMismatchException');
const TokenMismatchException = _TokenMismatchException.default || _TokenMismatchException;
const _JsonResources = require('../src/resources/json/jsonResources');
const JsonResources = _JsonResources.default || _JsonResources;
const _ResourceCollection = require('../src/resources/json/resourceCollection');
const ResourceCollection = _ResourceCollection.default || _ResourceCollection;
const _InvalidArrayException = require('../src/resources/json/invalidArrayException');
const InvalidArrayException = _InvalidArrayException.default || _InvalidArrayException;
const _InvalidObjectException = require('../src/resources/json/invalidObjectException');
const InvalidObjectException = _InvalidObjectException.default || _InvalidObjectException;
const _CollectionInterface = require('@ostro/contracts/collection/collect');
const CollectionInterface = _CollectionInterface.default || _CollectionInterface;

describe('URL & File & Exceptions & JSON Resources', () => {
    describe('URL', () => {
        test('parses pathname segments and allows segment retrieval', () => {
            const parsed = { pathname: '/api/v1/users/42' };
            const urlObj = new URL(parsed);
            expect(urlObj.$url).toBe(parsed);
            expect(urlObj.segment(0)).toBe('');
            expect(urlObj.segment(1)).toBe('api');
            expect(urlObj.segment(2)).toBe('v1');
            expect(urlObj.segment(3)).toBe('users');
            expect(urlObj.segment(4)).toBe('42');
            expect(urlObj.segment(5)).toBeUndefined();
        });
    });

    describe('File', () => {
        test('constructs file metadata and methods correctly', () => {
            const fileData = {
                filename: 'photo.profile.png',
                mimetype: 'image/png',
                encoding: '7bit',
                buffer: [Buffer.from('hello'), Buffer.from(' world')]
            };
            const file = new File(fileData);

            expect(file.getName()).toBe('photo.profile.png');
            expect(file.getMimetype()).toBe('image/png');
            expect(file.getExtension()).toBe('png');
            expect(file.extension()).toBe('png');
            expect(file.getType()).toBe('buffer');
            expect(file.isValid()).toBe(true);

            const bufferData = file.getBufferData();
            expect(bufferData.toString()).toBe('hello world');
            expect(file.getSize()).toBe(Number((bufferData.length / 1024).toFixed(2)));

            const hashname = file.getHashname();
            expect(hashname).toMatch(/^[a-f0-9]{32}\.png$/);
        });
    });

    describe('Exceptions', () => {
        test('HttpException defaults and accessors', () => {
            const ex1 = new HttpException(404);
            expect(ex1.getStatusCode()).toBe(404);
            expect(ex1.message).toBe('');
            expect(ex1.getHeaders()).toEqual({});

            const headers = { 'X-Custom': 'val' };
            const ex2 = new HttpException(500, 'Server Error', headers);
            expect(ex2.getStatusCode()).toBe(500);
            expect(ex2.message).toBe('Server Error');
            expect(ex2.getHeaders()).toEqual(headers);

            ex2.setHeaders({ 'X-Another': '123' });
            expect(ex2.getHeaders()).toEqual({ 'X-Another': '123' });
        });

        test('ThrottleRequestsException sets 429 and Retry-After', () => {
            const ex = new ThrottleRequestsException(60, 'Too Many Requests', { 'X-Rate': 'limit' });
            expect(ex.getStatusCode()).toBe(429);
            expect(ex.message).toBe('Too Many Requests');
            expect(ex.getHeaders()['Retry-After']).toBe(60);
            expect(ex.getHeaders()['X-Rate']).toBe('limit');

            const exNoRetry = new ThrottleRequestsException(null, 'Wait');
            expect(exNoRetry.getHeaders()['Retry-After']).toBeUndefined();

            const exDefaultArgs = new ThrottleRequestsException();
            expect(exDefaultArgs.getStatusCode()).toBe(429);
            expect(exDefaultArgs.message).toBe('');
            expect(exDefaultArgs.getHeaders()).toEqual({});
        });

        test('TokenMismatchException sets 403 and default properties', () => {
            const ex = new TokenMismatchException('CSRF Token Mismatch');
            expect(ex.statusCode).toBe(403);
            expect(ex.message).toBe('CSRF Token Mismatch');
            expect(ex.name).toBe('TokenMismatchException');
        });

        test('InvalidArrayException and InvalidObjectException', () => {
            const arrExDefault = new InvalidArrayException();
            expect(arrExDefault.status).toBe(500);
            expect(arrExDefault.message).toBe('Invalid Array');

            const arrExCustom = new InvalidArrayException('Array required');
            expect(arrExCustom.message).toBe('Array required');

            const objExDefault = new InvalidObjectException();
            expect(objExDefault.status).toBe(500);
            expect(objExDefault.message).toBe('Invalid Object');

            const objExCustom = new InvalidObjectException('Object required');
            expect(objExCustom.message).toBe('Object required');
        });
    });

    describe('JsonResources & ResourceCollection', () => {
        class DummyCollection extends CollectionInterface {
            constructor(items) {
                super();
                this.items = items;
            }
            all() {
                return this.items;
            }
        }

        test('toObject returns self', () => {
            const obj = { id: 1, name: 'John' };
            expect(JsonResources.toObject(obj)).toBe(obj);
        });

        test('collection processes arrays and CollectionInterface', () => {
            const arrayData = [{ id: 1 }, { id: 2 }];
            expect(JsonResources.collection(arrayData)).toEqual([{ id: 1 }, { id: 2 }]);

            const coll = new DummyCollection([{ id: 3 }]);
            expect(JsonResources.collection(coll)).toEqual([{ id: 3 }]);

            expect(() => {
                JsonResources.collection('not an array');
            }).toThrow(InvalidArrayException);
        });

        test('resource processes objects and rejects invalid', () => {
            const obj = { id: 1 };
            expect(JsonResources.resource(obj)).toBe(obj);

            expect(() => {
                JsonResources.resource([1, 2]);
            }).toThrow(InvalidObjectException);

            expect(() => {
                JsonResources.resource('string');
            }).toThrow(InvalidObjectException);

            expect(() => {
                JsonResources.resource(null);
            }).toThrow(InvalidObjectException);
        });

        test('ResourceCollection extends JsonResources', () => {
            const resColl = ResourceCollection.collection([{ name: 'item' }]);
            expect(resColl).toEqual([{ name: 'item' }]);
        });
    });
});
