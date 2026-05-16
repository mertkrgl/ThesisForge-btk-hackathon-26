"use client";

import { useState, useEffect, useRef } from "react";
import { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { MarketPulse } from "@/components/app/MarketPulse";
import { AgentActivityFeed } from "@/components/app/AgentActivityFeed";
import { ThesisSkeleton } from "@/components/app/ThesisSkeleton";
import { GripHorizontal } from "lucide-react";

export function DraggableDashboard() {
  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width);
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Define the default layout for the desktop view
  const defaultLayout = [
    { i: "pulse", x: 0, y: 0, w: 7, h: 10 },
    { i: "feed", x: 7, y: 0, w: 5, h: 10 },
    { i: "skeleton", x: 0, y: 10, w: 12, h: 6 },
  ];

  return (
    <div ref={containerRef} className="mt-4 -mx-4">
      <style dangerouslySetInnerHTML={{__html: `
        .react-grid-item.react-grid-placeholder {
          background: #089981 !important;
          opacity: 0.15;
          transition-duration: 100ms;
          border-radius: 1rem;
        }
        .react-resizable-handle {
          bottom: 5px;
          right: 5px;
          filter: invert(1);
          opacity: 0.3;
        }
        .react-resizable-handle:hover {
          opacity: 0.8;
        }
      `}} />
      {width > 0 && (
        <Responsive
          width={width}
          className="layout"
          layouts={{ lg: defaultLayout, md: defaultLayout, sm: defaultLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          // @ts-expect-error: draggableHandle exists in the library but is missing from @types/react-grid-layout
          draggableHandle=".drag-handle"
          isResizable={true}
          margin={[16, 16]}
        >
          <div key="pulse" className="relative group">
            <div className="drag-handle absolute top-4 right-4 z-10 cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-900">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <div className="h-full w-full [&>div]:h-full">
               <MarketPulse />
            </div>
          </div>
          
          <div key="feed" className="relative group">
            <div className="drag-handle absolute top-4 right-4 z-10 cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-900">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <div className="h-full w-full [&>div]:h-full overflow-hidden">
               <AgentActivityFeed />
            </div>
          </div>
          
          <div key="skeleton" className="relative group">
            <div className="drag-handle absolute top-4 right-4 z-10 cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-900">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <div className="h-full w-full [&>div]:h-full">
               <ThesisSkeleton />
            </div>
          </div>
        </Responsive>
      )}
    </div>
  );
}
