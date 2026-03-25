// Auto-read version from package.json
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');

export const APP_VERSION: string = pkg.version;
