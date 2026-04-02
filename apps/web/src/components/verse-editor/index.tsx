import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Markdown } from "@tiptap/markdown";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { EditorBubbleMenu } from "./menus/bubble-menu";
import "./styles/editor.css";

interface VerseEditorProps {
  documentId: string;
  token?: string;
  editorRef?: MutableRefObject<ReturnType<typeof useEditor> | null>;
}

const SERVER_WS = import.meta.env.VITE_SERVER_WS ?? "ws://localhost:3000";

export const VerseEditor = ({ documentId, token, editorRef }: VerseEditorProps) => {
  const ydocRef = useRef(new Y.Doc());
  const fragmentRef = useRef(ydocRef.current.getXmlFragment("default"));
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [connected, setConnected] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ fragment: fragmentRef.current }),
      Markdown,
    ],
    editorProps: {
      attributes: {
        class: "text-[#1a1c1d] text-[16px]",
      },
    },
  });

  useEffect(() => {
    if (!token || providerRef.current) return;
    const provider = new HocuspocusProvider({
      url: SERVER_WS,
      name: documentId,
      document: ydocRef.current,
      token,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });
    providerRef.current = provider;
    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [documentId, token]);

  void connected;

  useEffect(() => {
    if (editorRef) editorRef.current = editor ?? null;
  }, [editor, editorRef]);

  return (
    <div className="flex-1 flex flex-col">
      {editor && <EditorBubbleMenu editor={editor} />}
      <EditorContent editor={editor} className="editor-content flex-1" />
    </div>
  );
};
