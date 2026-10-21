import RedirectResponseContract from '@ostro/contracts/http/redirectResponse';
import { Macroable } from '@ostro/support/macro';
const kUrl = Symbol('url')
const kErrors = Symbol('errors')
const kInputs = Symbol('inputs')
const kFlash = Symbol('flash')
const kResponse = Symbol('response')

/**
 * Class RedirectResponse.
 */
class RedirectResponse extends RedirectResponseContract {

    /**
     * Create a new instance.
     * @param {*} response
     */
    constructor(response: any) {
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

    /**
     * to method.
     * @param {*} url
     * @returns {any}
     */
    public to(url: string) {
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

    /**
     * away method.
     * @param {*} url
     * @returns {any}
     */
    public away(url: string) {
        this[kResponse].redirect(url);
    }

    /**
     * route method.
     * @returns {any}
     */
    public route(...args: any[]) {
        this[kUrl] = (global as any).app('router').route(...args)
        return this.to(this[kUrl])
    }

    /**
     * withErrors method.
     * @param {*} errors
     * @returns {any}
     */
    public withErrors(...errors: any[]) {
        this[kErrors] = errors
        return this
    }

    /**
     * withInput method.
     * @param {*} inputs
     * @returns {any}
     */
    public withInput(...inputs: any[]) {
        this[kInputs] = inputs.length ? inputs : [true]
        return this
    }

    /**
     * with method.
     * @param {*} flash
     * @returns {any}
     */
    public with(...flash: any[]) {
        this[kFlash] = flash
        return this
    }

    /**
     * getUrl method.
     * @returns {any}
     */
    public getUrl() {
        return this[kUrl]
    }

    /**
     * getErrors method.
     * @returns {any}
     */
    public getErrors() {
        return this[kErrors]
    }

    /**
     * getInputs method.
     * @returns {any}
     */
    public getInputs() {
        return this[kInputs]
    }

    /**
     * wantedInput method.
     * @returns {any}
     */
    public wantedInput() {
        return this[kInputs].length
    }

    /**
     * getFlash method.
     * @returns {any}
     */
    public getFlash() {
        return this[kFlash]
    }

    /**
     * back method.
     * @returns {any}
     */
    public back() {
        this[kUrl] = 'back'
        if (this[kResponse]) {
            return this.to(this[kUrl])
        }
    }

    /**
     * __get method.
     * @static
     * @param {*} target
     * @param {*} method
     * @returns {any}
     */
    static __get(target: any, method: string) {
        return (this as any).make(new target, method)
    }

}

export default Macroable(RedirectResponse);
