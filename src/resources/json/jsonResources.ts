import InvalidArrayException from './invalidArrayException';
import InvalidObjectException from './invalidObjectException';
import CollectionInterface from '@ostro/contracts/collection/collect';

/**
 * Class JsonResources.
 */
class JsonResources {
    /**
     * Transform data to object.
     *
     * @param obj - Input object.
     * @returns Transformed object.
     */
    static toObject<T = unknown>(obj: T): T {
        return obj;
    }

    /**
     * Transform collection of data.
     *
     * @param datas - Array or collection of data items.
     * @returns Array of transformed objects.
     */
    static collection(datas: any): any[] {
        if (datas instanceof CollectionInterface) {
            datas = datas.all();
        }
        if (!Array.isArray(datas)) {
            throw new InvalidArrayException(`Data should be array`);
        }

        return datas.map(data => (this.toObject(data)));
    }

    /**
     * Transform single resource object.
     *
     * @param obj - Resource object.
     * @returns Transformed resource object.
     */
    static resource<T = unknown>(obj: T): T {
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
            throw new InvalidObjectException(`Data should be obj`);
        }
        return this.toObject(obj);
    }
}

export default JsonResources;