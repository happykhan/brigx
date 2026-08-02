import path from 'node:path';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import {
  FuseV1Options,
  FuseVersion,
} from '@electron/fuses';

const iconBase = path.resolve('desktop/assets/icon');
const hasMacSigning = Boolean(
  process.env.APPLE_ID
  && process.env.APPLE_APP_SPECIFIC_PASSWORD
  && process.env.APPLE_TEAM_ID,
);
const hasWindowsSigning = Boolean(
  process.env.WINDOWS_CERTIFICATE_FILE
  && process.env.WINDOWS_CERTIFICATE_PASSWORD,
);

const config: ForgeConfig = {
  outDir: '.desktop-artifacts',
  packagerConfig: {
    name: 'BRIGX',
    executableName: 'BRIGX',
    appBundleId: 'org.genomicx.brigx',
    appCategoryType: 'public.app-category.education',
    icon: iconBase,
    extraResource: [
      path.resolve('node_modules/electron/dist/LICENSE'),
      path.resolve('node_modules/electron/dist/LICENSES.chromium.html'),
    ],
    asar: true,
    prune: false,
    ignore: [
      /^\/(?!desktop-dist(?:\/|$)|out(?:\/|$)|package\.json$|LICENSE$|README\.md$|DESKTOP\.md$|THIRD_PARTY_NOTICES\.md$).+/,
      /^\/desktop-dist\/.*\.map$/,
      /^\/out\/_headers$/,
    ],
    ...(hasMacSigning
      ? {
          osxSign: {},
          osxNotarize: {
            appleId: process.env.APPLE_ID!,
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
            teamId: process.env.APPLE_TEAM_ID!,
          },
        }
      : {}),
    ...(hasWindowsSigning
      ? {
          windowsSign: {
            certificateFile: process.env.WINDOWS_CERTIFICATE_FILE!,
            certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD!,
            description: 'BRIGX circular genome comparison',
            website: 'https://brigx.genomicx.org',
          },
        }
      : {}),
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'BRIGX',
        authors: 'Nabil-Fareed Alikhan',
        description: 'Free, offline circular comparative genome visualisation',
        setupIcon: `${iconBase}.ico`,
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'BRIGX',
        icon: `${iconBase}.icns`,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          name: 'brigx',
          productName: 'BRIGX',
          genericName: 'Genome comparison visualiser',
          description: 'Free, offline circular comparative genome visualisation',
          maintainer: 'Nabil-Fareed Alikhan',
          homepage: 'https://brigx.genomicx.org',
          section: 'science',
          priority: 'optional',
          icon: `${iconBase}.png`,
          categories: ['Science'],
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          name: 'brigx',
          productName: 'BRIGX',
          genericName: 'Genome comparison visualiser',
          description: 'Free, offline circular comparative genome visualisation',
          productDescription: 'BRIGX creates interactive circular whole-genome comparison plots using local BLAST WebAssembly.',
          license: 'GPL-3.0',
          group: 'Applications/Engineering',
          homepage: 'https://brigx.genomicx.org',
          icon: `${iconBase}.png`,
          categories: ['Science'],
        },
      },
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};

export default config;
