// Use NEXT_PUBLIC env var or package.json import
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
