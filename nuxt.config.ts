const privateNoStore = { "cache-control": "private, no-store" } as const;
const noStore = { "cache-control": "no-store" } as const;
const remoteDatabaseUrl = process.env.POSTGRES_URL
  || process.env.POSTGRESQL_URL
  || process.env.DATABASE_URL;
const hasRemoteDatabase = Boolean(remoteDatabaseUrl);

export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@comark/nuxt", "eve/nuxt", "@nuxthub/core", "@vercel/analytics"],
  eve: {
    // Eve 0.20 still generates the retired experimentalServices shape.
    // vercel.json owns the current multi-service configuration instead.
    configureVercelJson: false,
  },
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  compatibilityDate: "latest",
  experimental: {
    payloadExtraction: true,
    viewTransition: true,
  },
  routeRules: {
    "/": { prerender: true },
    "/login": { prerender: true },
    "/home": { ssr: true, headers: privateNoStore },
    "/admin/**": { ssr: true, headers: privateNoStore },
    "/chat/**": { ssr: true, headers: privateNoStore },
    "/settings/**": { ssr: true, headers: privateNoStore },
    "/api/auth/**": { headers: noStore },
    "/api/waitlist": { headers: noStore },
    "/api/admin/**": { headers: privateNoStore },
    "/api/internal/**": { headers: noStore },
    "/api/profile": { headers: privateNoStore },
    "/api/profile/**": { headers: privateNoStore },
    "/api/threads": { headers: privateNoStore },
    "/api/threads/**": { headers: privateNoStore },
    "/api/memory": { headers: privateNoStore },
    "/api/memory/**": { headers: privateNoStore },
    "/api/mem0/**": { headers: privateNoStore },
    "/api/connectors": { headers: privateNoStore },
    "/api/integrations/**": { headers: privateNoStore },
    "/_eve_internal/**": { headers: noStore },
  },
  nitro: {
    compressPublicAssets: true,
    prerender: {
      routes: ["/", "/login"],
      crawlLinks: false,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "use-memory",
      titleTemplate: "%s",
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      meta: [
        {
          name: "description",
          content:
            "Your personal AI agent. Chat on the web or iMessage, connect GitHub, and pick up where you left off.",
        },
        { name: "theme-color", content: "#1b1718" },
        { name: "color-scheme", content: "light dark" },
        { name: "robots", content: "index, follow" },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico" },
      ],
    },
  },

  fonts: {
    families: [
      { name: 'Geist', weights: ['100 900'], global: true },
      { name: 'Geist Mono', weights: ['100 900'], global: true },
    ],
  },

  hub: {
    db: {
      dialect: "postgresql",
      driver: hasRemoteDatabase ? "neon-http" : "pglite",
      ...(hasRemoteDatabase
        ? {
            connection: { url: remoteDatabaseUrl },
            applyMigrationsDuringBuild: false,
          }
        : {}),
    },
  },
  runtimeConfig: {
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "",
    },
  },
});
