const RedirectResponseContract = require('@ostro/contracts/http/redirectResponse')
const { Macroable } = require('@ostro/support/macro')
const kUrl = Symbol('url')
const kErrors = Symbol('errors')
const kInputs = Symbol('inputs')
const kFlash = Symbol('flash')

class RedirectResponse extends Macroable.extend(RedirectResponseContract) {

    [kUrl];

    [kInputs];

    [kErrors];

    [kFlash];
    
    constructor(response) {
        super()
        Object.defineProperty(this, 'response', { value: response })
    }
    to(url) {
        this[kUrl] = url
        if (this.response) {
            if (this.response.req.session)
                this.response.with(this.getFlash()).withErrors(this.getErrors()).withInput(this.wantedInput());
            this.response.redirect(url);
        }
    }
    route() {
        this[kUrl] = app('router').route(...arguments)
        this.to(this[kUrl])
    }
    withErrors(errors) {
        this[kErrors] = errors
        return this
    }
    withInput(inputs) {
        this[kInputs] = true
        return this
    }
    with(flash) {
        this[kFlash] = flash
        return this
    }
    getUrl() {
        return this[kUrl]
    }
    getErrors() {
        return this[kErrors]
    }
    wantedInput() {
        return this[kInputs] == true
    }
    getFlash() {
        return this[kFlash]
    }
    back() {
        this[kUrl] = 'back'
        if (this.response) {
            this.to(this[kUrl])
        }
    }
    static __call(target, method, args) {
        return (new target)[method](...args)
    }

}

module.exports = RedirectResponse