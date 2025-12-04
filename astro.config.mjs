// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import alpinejs from '@astrojs/alpinejs';


import netlify from "@astrojs/netlify";


// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [alpinejs()],

  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "ne"], // English, Spanish, Nepali
    routing: {
        prefixDefaultLocale: false // /module-1 (English), /es/module-1 (Spanish)
    }
  },

  adapter: netlify(),
});