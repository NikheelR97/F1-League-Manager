"use client";

import { useRef, useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface LeagueAssetUploadProps {
  kind: "logo" | "hero_image" | "car_image";
  label: string;
  leagueId: string;
  // When set, uploads to the team assets route instead of the league one —
  // same upload widget, different endpoint. See teams/[teamId]/assets route.
  teamId?: string;
}

export function LeagueAssetUpload({ kind, label, leagueId, teamId }: LeagueAssetUploadProps) {
  const csrfToken = useCsrfToken();
  const uploadUrl = teamId
    ? `/api/admin/leagues/${leagueId}/teams/${teamId}/assets`
    : `/api/admin/leagues/${leagueId}/assets`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setErrorMsg("");

    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);

    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? "Upload failed");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase text-f1-muted">{label}</p>
      <label className="flex cursor-pointer items-center gap-3 border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white transition-colors hover:border-f1-red">
        <input
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={status === "uploading" || !csrfToken}
          type="file"
          onChange={handleChange}
        />
        {status === "uploading" ? "Uploading…" : "Choose file"}
        <span className="text-xs text-f1-muted">JPEG / PNG / WebP · max 5 MB</span>
      </label>
      {status === "success" && (
        <p className="text-xs text-team-sauber">Uploaded successfully</p>
      )}
      {status === "error" && (
        <p className="text-xs text-f1-red">{errorMsg}</p>
      )}
    </div>
  );
}
