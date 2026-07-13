export default defineAppConfig({
  site: {
    name: "use-memory",
    title: "use-memory",
    description:
      "Your personal AI agent. Chat on the web or iMessage, connect GitHub, and pick up where you left off.",
    tagline: "Memory that follows the conversation",
    author: "Montekkundan",
    repo: "https://github.com/Montekkundan/use-memory",
    ogImage: null as string | null,
  },
  ui: {
    colors: {
      primary: "neutral",
      neutral: "neutral",
    },
    button: {
      slots: {
        base: "active:translate-y-px transition-transform duration-200",
      },
      defaultVariants: {
        size: "sm",
      },
    },
  },
});
