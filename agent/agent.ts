import { defineAgent } from "eve";
import { USE_MEMORY_MODEL } from "../shared/model.js";

export default defineAgent({
  model: USE_MEMORY_MODEL,
  modelOptions: {
    providerOptions: {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 2048,
        },
      },
    },
  },
});
