class URL {
    constructor(url) {
        this.$url = url
        this.$segments = url.pathname.split('/')
    }
    segment(index) {
        return this.$segments[index]
    }
}
module.exports = URL