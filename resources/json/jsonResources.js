const InvalidArrayException = require('./invalidArrayException')
const InvalidObjectException = require('./invalidObjectException')
const CollectionInterface = require('@ostro/contracts/collection/collect')

class JsonResources {
    static toObject(obj) {
        return obj
    }

    static collection(datas) {
        if (datas instanceof CollectionInterface)
            datas = datas.all()
        if (!Array.isArray(datas))
            throw new InvalidArrayException(`Data should be array`)

        return datas.map(data => (this.toObject(data)))
    }
    
    static resource(obj) {
        if (typeof obj != 'object' && Array.isArray(obj))
            throw new InvalidObjectException(`Data should be obj`)
        return this.toObject(obj)
    }
}

module.exports = JsonResources;