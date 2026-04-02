import { useRef, useEffect } from "react";
import { useParams, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAuthToken } from "@convex-dev/auth/react";
import { useQuery, useMutation } from "convex/react";
import type { useEditor } from "@tiptap/react";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { anyApi } from "convex/server";
import { VerseEditor } from "@/components/verse-editor/index";
import { ChatPanel } from "@/components/ChatPanel";
import { TabBar } from "@/components/TabBar";
import { appActor } from "@/store";

export const DocumentScreen = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";
  const location = useLocation();
  const routeTitle = (location.state as { title?: string } | null)?.title;
  const token = useAuthToken();
  const doc = useQuery(
    anyApi.documents.getDocument,
    id ? { docId: id } : "skip",
  ) as { _id: string; title: string } | null | undefined;
  const title = doc?.title ?? routeTitle;
  const updateDocument = useMutation(anyApi.documents.updateDocument);
  const navigate = useNavigate();
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "verse-doc-layout",
    storage: localStorage,
  });

  // Sync router -> machine: register this doc as an open tab
  useEffect(() => {
    if (id && title) {
      appActor.send({ type: "doc.open", id, title });
    }
  }, [id, title]);

  // Clean up stale tabs (doc deleted but tab persisted from localStorage)
  useEffect(() => {
    if (id && doc === null) {
      appActor.send({ type: "doc.close", id });
      navigate("/dir", { replace: true });
    }
  }, [id, doc, navigate]);

  if (!id) return null;

  if (isViewMode) {
    return <div className="min-h-screen">Document: {id} (view only)</div>;
  }

  const handleTitleBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
    const title = e.currentTarget.textContent?.trim() || "Untitled";
    if (title !== doc?.title) {
      void updateDocument({ docId: id, title });
    }
  };

  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={defaultLayout ?? { editor: 65, chat: 35 }}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="editor" minSize="30%">
        <div className="h-full flex flex-col rounded-[12px] border border-[#EEF2F6] bg-white overflow-hidden">
          <TabBar />
          {/* Top bar */}
          <div className="flex items-center justify-end px-6 py-2 border-b border-[#EEF2F6]">
            <button
              onClick={() => console.log(editorRef.current?.getMarkdown())}
              className="rounded border border-[#e2e2e2] px-3 py-1 text-sm text-[#6b6b6b] hover:bg-[#f7f7f7]"
            >
              Export MD
            </button>
          </div>

          {/* Scrollable: title + editor */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div className="min-h-full flex flex-col pt-4">
              <h1
                contentEditable
                suppressContentEditableWarning
                onBlur={handleTitleBlur}
                className="text-2xl font-semibold text-[#111] outline-none mb-4 empty:before:content-['Untitled'] empty:before:text-[#7a7a7a]"
              >
                {title}
              </h1>
              <VerseEditor key={id} documentId={id} token={token ?? undefined} editorRef={editorRef} />
            </div>
          </div>
        </div>
      </Panel>
      <Separator className="w-[4px] hover:bg-[#ebeef0] transition-colors cursor-col-resize" />
      <Panel id="chat" minSize="20%">
        <ChatPanel />
      </Panel>
    </Group>
  );
};
