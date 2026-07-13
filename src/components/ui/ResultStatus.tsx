import { Ban, CircleDashed, OctagonX, Wrench } from "lucide-react";

interface ResultStatusProps {
  status: string;
}

export function ResultStatus({ status }: ResultStatusProps) {
  switch (status.toLowerCase()) {
    case "dnf":
      return (
        <div className="inline-flex items-center gap-1 text-xs font-bold uppercase text-f1-muted">
          <Wrench size={14} />
          DNF
        </div>
      );
    case "dns":
      return (
        <div className="inline-flex items-center gap-1 text-xs font-bold uppercase text-f1-silver">
          <CircleDashed size={14} />
          DNS
        </div>
      );
    case "dsq":
      return (
        <div className="inline-flex items-center gap-1 text-xs font-bold uppercase text-f1-red">
          <OctagonX size={14} />
          DSQ
        </div>
      );
    case "ban":
      return (
        <div className="inline-flex items-center gap-1 text-xs font-bold uppercase text-f1-red">
          <Ban size={14} />
          BAN
        </div>
      );
    default:
      return null;
  }
}
