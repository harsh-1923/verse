export const shortcuts = {
  toggleDir: { keys: "meta+shift+u", label: "Toggle Sidebar" },
  toggleChat: { keys: "meta+shift+l", label: "Toggle Chat" },
  toggleZen: { keys: "meta+shift+z", label: "Toggle Zen Mode" },
} as const

export type ShortcutId = keyof typeof shortcuts
