const RedirectResponseContract = require('@ostro/contracts/http/redirectResponse')
const { Macroable } = require('@ostro/support/macro')
const kUrl = Symbol('url')
const kErrors = Symbol('errors')
const kInputs = Symbol('inputs')
const kFlash = Symbol('flash')
const kResponse = Symbol('response')

class RedirectResponse extends RedirectResponseContract {

    constructor(response) {
        super()
        Object.defineProperties(this, {
            [kUrl]: {
                value: undefined,
                writable: true
            },
            [kResponse]: {
                value: response
            },
            [kInputs]: {
                value: [],
                writable: true,
            },
            [kErrors]: {
                value: [],
                writable: true
            },
            [kFlash]: {
                value: [],
                writable: true
            }
        })
    }

    to(url) {
        this[kUrl] = url
        if (this[kResponse]) {
            process.nextTick(() => {
                if (this[kResponse].request.session)
                    this[kResponse].with(...this.getFlash()).withErrors(...this.getErrors()).withInput(...this.getInputs());
                this[kResponse].redirect(this[kUrl]);
            })
        }
        return this
    }

    away(url) {
        this[kResponse].redirect(url);
    }

    route() {
        this[kUrl] = app('router').route(...arguments)
        return this.to(this[kUrl])
    }

    withErrors() {
        this[kErrors] = arguments
        return this
    }

    withInput() {
        this[kInputs] = arguments.length ? arguments : [true]
        return this
    }

    with() {
        this[kFlash] = arguments
        return this
    }

    getUrl() {
        return this[kUrl]
    }

    getErrors() {
        return this[kErrors]
    }

    getInputs() {
        return this[kInputs]
    }

    wantedInput() {
        return this[kInputs].length
    }

    getFlash() {
        return this[kFlash]
    }

    back() {
        this[kUrl] = 'back'
        if (this[kResponse]) {
            return this.to(this[kUrl])
        }
    }

    static __get(target, method) {
        return this.make(new target, method)
    }

}

module.exports = Macroable(RedirectResponse)
