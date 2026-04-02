import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "@xstate/react";
import { X } from "lucide-react";
import { appActor } from "@/store";
import { selectOpenDocs, selectCurrentDocId } from "@/store/selectors";
import { cn } from "@/utils/cn";
import type { DocTab } from "@/store/app-machine";

const Tab = ({
  tab,
  isActive,
  onClose,
  onClick,
}: {
  tab: DocTab;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 cursor-pointer px-3 py-1.5 text-sm border-b-2 transition-colors",
        isActive
          ? "bg-white text-[#1f262a] border-[#f98047]"
          : "text-[#6b7785] border-transparent hover:bg-[#f9fafb]",
      )}
    >
      <span className="truncate max-w-[140px]">{tab.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          "rounded p-0.5 hover:bg-[#eef2f6] transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <X className="size-3 text-[#6b7785]" />
      </button>
    </div>
  );
};

export const TabBar = () => {
  const openDocs = useSelector(appActor, selectOpenDocs);
  const currentDocId = useSelector(appActor, selectCurrentDocId);
  const navigate = useNavigate();

  if (openDocs.length === 0) return null;

  const handleClose = (tabId: string) => {
    const wasActive = appActor.getSnapshot().context.currentDocId === tabId;
    appActor.send({ type: "doc.close", id: tabId });
    if (wasActive) {
      const nextId = appActor.getSnapshot().context.currentDocId;
      navigate(nextId ? `/dir/${nextId}` : "/dir");
    }
  };

  return (
    <div className="flex items-center border-b border-[#EEF2F6] bg-[#f9fafb] rounded-t-[12px]">
      <div className="flex overflow-x-auto scrollbar-hide">
        {openDocs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === currentDocId}
            onClick={() => {
              appActor.send({ type: "doc.switch", id: tab.id });
              navigate(`/dir/${tab.id}`, { state: { title: tab.title } });
            }}
            onClose={() => handleClose(tab.id)}
          />
        ))}
      </div>
    </div>
  );
};
