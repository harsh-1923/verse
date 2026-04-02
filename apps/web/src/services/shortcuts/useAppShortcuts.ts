import { useHotkeys } from "react-hotkeys-hook"
import { shortcuts } from "./keys"
import { appActor } from "../../store"

const globalOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true,
  preventDefault: true,
}

export const useAppShortcuts = () => {
  useHotkeys(shortcuts.toggleDir.keys, () => {
    appActor.send({ type: "dir.toggle" })
  }, globalOptions)

  useHotkeys(shortcuts.toggleChat.keys, () => {
    appActor.send({ type: "chat.toggle" })
  }, globalOptions)

  useHotkeys(shortcuts.toggleZen.keys, () => {
    appActor.send({ type: "zen.toggle" })
  }, globalOptions)
}
