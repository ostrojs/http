const FileContract = require('@ostro/contracts/container/file')
const { v4: uuidv4 } = require('uuid');
const path = require('path');
class File extends FileContract {
    constructor(data) {
        super()
        Object.defineProperties(this, {
            filename: {
                value: data.filename,
                writable: false,
                configurable: false,
                enumerable: true
            },
            mimetype: {
                value: data.mimetype,
                writable: false,
                configurable: false,
                enumerable: true
            },
            encoding: {
                value: data.encoding,
                writable: false,
                configurable: false,
                enumerable: true
            },
            buffer: {
                value: Buffer.concat(data.buffer),
                writable: false,
                configurable: false,
                enumerable: false
            }
        });
    }

    getName() {
        return this.filename
    }

    getHashname() {
        return uuidv4().replace(/-/g, '') + '.' + this.getExtension();
    }

    getSize() {
        return Number((this.buffer.length / 1024).toFixed(2))
    }

    getMimetype() {
        return this.mimetype
    }

    getBufferData() {
        return this.buffer
    }

    getExtension() {
        return path.extname(this.filename).slice(1)
    }

    getType() {
        return 'buffer'
    }

    extension() {
        return this.getExtension()
    }

    isValid() {
        return true
    }

}
module.exports = File
