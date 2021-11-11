const { Macroable } = require('@ostro/support/macro')
const kNext = Symbol('next')
const url = require('url');
const URL = require('./url')
const RedirectResponse = require('./redirectResponse')

class HttpContext extends Macroable {
    constructor(request, response, next) {
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

    setCurrentNext(next) {
        this.$next = next
    }

    get redirect() {
        return new RedirectResponse(this.response)
    }

    get url() {
        return new URL(this.request._parsedUrl)
    }

    next() {
        this.$next(...arguments)
    }

}
module.exports = HttpContext