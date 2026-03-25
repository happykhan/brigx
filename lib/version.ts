// Auto-read version from package.json
 
const pkg = require('../package.json');

export const APP_VERSION: string = pkg.version;
