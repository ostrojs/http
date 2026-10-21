/**
 * Class URL helper for accessing URL pathname segments.
 */
class URL {
    public $url: any;
    public $segments: string[];

    /**
     * Create a new instance.
     *
     * @param url - Parsed URL object containing pathname.
     */
    constructor(url: any) {
        this.$url = url;
        this.$segments = (url.pathname || '').split('/');
    }

    /**
     * Get a pathname segment by index.
     *
     * @param index - Segment index.
     * @returns Pathname segment string or undefined.
     */
    public segment(index: number): string | undefined {
        return this.$segments[index];
    }
}

export default URL;