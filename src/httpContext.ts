import { Macroable } from '@ostro/support/macro';
const kNext = Symbol('next')
import url from 'url';
import URL from './url';
import RedirectResponse from './redirectResponse';

/**
 * Class HttpContext.
 */
class HttpContext extends Macroable {
    /**
     * Create a new instance.
     * @param {*} request
     * @param {*} response
     * @param {*} next
     */
    constructor(request: any, response: any, next: Function) {
        super()
        Object.defineProperty(this, 'request', {
            value: request,
            enumerable: true,
            configurable: false,
            writable: false
        })
        Object.defineProperty(this, 'response', {
            value: response,
            enumerable: true,
            configurable: false,
            writable: false
        })
        if (typeof request._parsedUrl != 'object') {
            request._parsedUrl = url.parse(request.url, false)
        }

    }

    /**
     * setCurrentNext method.
     * @param {*} next
     * @returns {any}
     */
    public setCurrentNext(next: Function) {
        this.$next = next
    }

    /**
     * Get redirect.
     * @returns {any}
     */
    public get redirect() {
        return new RedirectResponse(this.response)
    }

    /**
     * Get url.
     * @returns {any}
     */
    public get url() {
        return new URL(this.request._parsedUrl)
    }

    /**
     * next method.
     * @returns {any}
     */
    public next() {
        this.$next(...arguments)
    }

}
export default HttpContext;