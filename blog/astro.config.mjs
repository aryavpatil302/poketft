import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://poketft.gg', // replace with your actual domain
  // Trailing slash is load-bearing: trailingSlash defaults to 'ignore', which
  // passes `base` through verbatim into import.meta.env.BASE_URL (no slash is
  // appended). Without it, `${BASE_URL}favicon.svg` would concatenate to
  // `/blogfavicon.svg` instead of `/blog/favicon.svg`. Do not "tidy" this to '/blog'.
  base: '/blog/',
})
