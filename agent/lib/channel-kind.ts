const IMESSAGE_CHANNEL_KINDS = new Set([
  "chat-sdk",
  "channel:chat-sdk",
  "photon",
  "channel:photon",
  "imessage",
  "channel:imessage",
]);

export function isIMessageChannelKind(kind: string | undefined) {
  return Boolean(kind && IMESSAGE_CHANNEL_KINDS.has(kind.toLowerCase()));
}
