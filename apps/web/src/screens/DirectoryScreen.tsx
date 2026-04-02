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
import { Plus, Settings, Bot } from "lucide-react";
import { AgentDialog } from "../components/CreateAgentDialog";
import type { AgentData } from "../components/CreateAgentDialog";
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

type AgentDef = AgentData;

const DirectoryList = ({ activeDocId }: { activeDocId?: string }) => {
  const docs = useQuery(anyApi.documents.listDocuments) as Doc[] | undefined;
  const agents = useQuery(anyApi.agents.listAgents) as AgentDef[] | undefined;
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
        <div className="px-1.5 pb-1.5">
          <p className="text-xs font-semibold text-[#8fa0b1] uppercase tracking-wider">
            Documents
          </p>
        </div>

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

        {/* Agents section */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <p className="text-xs font-semibold text-[#8fa0b1] uppercase tracking-wider">
              Agents
            </p>
            <AgentDialog>
              <button className="flex items-center justify-center p-0.5 rounded hover:bg-[#eef2f6] transition-colors">
                <Plus className="size-3.5 text-[#8fa0b1]" />
              </button>
            </AgentDialog>
          </div>

          {agents === undefined && (
            <p className="p-1.5 text-sm text-[#6b7785]">Loading...</p>
          )}

          {agents?.length === 0 && (
            <p className="p-1.5 text-sm text-[#6b7785]">No agents yet.</p>
          )}

          {agents && agents.length > 0 && (
            <div className="flex flex-col">
              {agents.map((agent) => (
                <AgentDialog key={agent._id} agent={agent}>
                  <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#eef2f6] transition-colors group w-full text-left">
                    <Bot className="size-4 text-[#f98047] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-[450] leading-[1.2] truncate text-[#6b7785]">
                        {agent.name}
                      </p>
                      <p className="text-xs text-[#8fa0b1] truncate">
                        @{agent.tag}
                        {agent.builtIn && (
                          <span className="ml-1.5 text-[10px] font-medium text-[#f98047]">
                            built-in
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </AgentDialog>
              ))}
            </div>
          )}
        </div>
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
