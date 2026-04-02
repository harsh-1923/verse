import { useQuery, useMutation } from "convex/react";
import { useSelector } from "@xstate/react";
import { Navigate, Link, Outlet, useOutlet, useParams } from "react-router-dom";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { anyApi } from "convex/server";
import { Plus, Settings } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../components/ui/tooltip";
import { appActor } from "../store";
import { cn } from "../utils/cn";

interface Doc {
  _id: string;
  title: string;
  updatedAt: number;
}

const DirectoryList = ({ activeDocId }: { activeDocId?: string }) => {
  const docs = useQuery(anyApi.documents.listDocuments) as Doc[] | undefined;
  const createDocument = useMutation(anyApi.documents.createDocument);

  return (
    <div className="h-full flex flex-col gap-4 rounded-[12px] border border-[#EEF2F6] bg-white px-2 py-3">
      {/* Top bar */}
      <div className="flex items-center justify-between p-1.5">
        <div className="size-4 rounded-full bg-[#f98047]" />
        <TooltipProvider delay={300} closeDelay={0}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                onClick={() => void createDocument({ title: "Untitled" })}
                className="flex items-center justify-center p-1 rounded-lg hover:bg-[#eef2f6] transition-colors"
              >
                <Plus className="size-4 text-[#6b7785]" />
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>New document</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger className="flex items-center justify-center p-1 rounded-lg hover:bg-[#eef2f6] transition-colors">
                <Settings className="size-4 text-[#6b7785]" />
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>Settings</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-auto">
        {docs === undefined && (
          <p className="p-1.5 text-sm text-[#6b7785]">Loading...</p>
        )}

        {docs?.length === 0 && (
          <p className="p-1.5 text-sm text-[#6b7785]">No documents yet.</p>
        )}

        {docs && docs.length > 0 && (
          <div className="flex flex-col">
            {docs.map((doc) => {
              const isActive = doc._id === activeDocId;
              return (
                <Link
                  key={doc._id}
                  to={`/dir/${doc._id}`}
                  state={{ title: doc.title }}
                  className={cn("p-1.5 rounded-lg", isActive && "bg-[#eef2f6]")}
                >
                  <p
                    className={cn(
                      "text-sm font-[450] leading-[1.2] truncate",
                      isActive ? "text-[#1f262a]" : "text-[#6b7785]",
                    )}
                  >
                    {doc.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const DirectoryScreen = () => {
  const { id } = useParams();
  const openDocs = useSelector(appActor, (snap) => snap.context.openDocs);
  const currentDocId = useSelector(appActor, (snap) => snap.context.currentDocId);
  const showDir = useSelector(appActor, (snap) => snap.context.showDir);
  const outlet = useOutlet();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "verse-dir-layout",
    storage: localStorage,
  });

  if (!outlet && openDocs.length > 0 && currentDocId) {
    return <Navigate to={`/dir/${currentDocId}`} replace />;
  }

  if (!outlet) {
    return (
      <div className="h-full">
        <DirectoryList activeDocId={id} />
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={defaultLayout ?? { dir: 25, doc: 75 }}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="dir" minSize="15%" className={showDir ? undefined : "invisible"}>
        <DirectoryList activeDocId={id} />
      </Panel>
      <Separator className={cn("w-[4px] hover:bg-[#ebeef0] transition-colors cursor-col-resize", !showDir && "invisible")} />
      <Panel id="doc">
        <Outlet />
      </Panel>
    </Group>
  );
};
