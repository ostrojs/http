import RedirectResponse from './redirectResponse';
import { Macroable, ProxyHandler } from '@ostro/support/macro';
/**
 * Class Redirect.
 */
class Redirect {
    /**
     * __get method.
     * @static
     * @param {*} target
     * @param {*} method
     * @returns {any}
     */
    static __get(target: Record<string, any>, method: string) {
        return ProxyHandler.make(new RedirectResponse(undefined), method);
    }
}
export default Macroable(Redirect);