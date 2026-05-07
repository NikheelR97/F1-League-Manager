import { z } from "zod";

import {
  MAX_AUDIT_ACTION_LENGTH,
  MAX_AUDIT_METADATA_BYTES,
} from "@/lib/constants";

const auditEntrySchema = z.object({
  action: z.string().trim().min(1).max(MAX_AUDIT_ACTION_LENGTH),
  actorId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),
  entityType: z.string().trim().min(1).max(MAX_AUDIT_ACTION_LENGTH),
  metadata: z.record(z.string(), z.unknown()),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;

export interface AuditLogWriter {
  insertAuditLog: (entry: AuditEntry) => Promise<{ ok: boolean; error?: string }>;
}

export async function writeAuditLog(
  writer: AuditLogWriter,
  entry: AuditEntry,
): Promise<void> {
  try {
    const parsedEntry = auditEntrySchema.parse(entry);
    const metadataBytes = Buffer.byteLength(JSON.stringify(parsedEntry.metadata));
    if (metadataBytes > MAX_AUDIT_METADATA_BYTES) {
      throw new Error("Audit metadata is too large");
    }

    const result = await writer.insertAuditLog(parsedEntry);
    if (!result.ok) {
      throw new Error("Audit log write failed");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Audit log write failed");
  }
}
