import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const ToolSchema = z.object({
  name: z.enum(['get_vendor_status', 'list_active_incidents', 'get_incident_history']),
  arguments: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid tool request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDbClient();
  const { name, arguments: args } = parsed.data;

  try {
    switch (name) {
      case 'get_vendor_status': {
        const vendorId = z.string().parse(args.vendorId);
        const { rows } = await db.query(
          'SELECT * FROM status_checks WHERE vendor_id = $1 ORDER BY timestamp DESC LIMIT 1',
          [vendorId]
        );
        return NextResponse.json({ result: rows[0] || null });
      }

      case 'list_active_incidents': {
        const { rows } = await db.query(
          "SELECT * FROM incidents WHERE status != 'resolved' ORDER BY started_at DESC"
        );
        return NextResponse.json({ result: rows });
      }

      case 'get_incident_history': {
        const vendorId = z.string().parse(args.vendorId);
        const { rows } = await db.query(
          'SELECT * FROM incidents WHERE vendor_id = $1 ORDER BY started_at DESC LIMIT 20',
          [vendorId]
        );
        return NextResponse.json({ result: rows });
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MCP] error:', message);
    return NextResponse.json({ error: 'MCP tool execution failed' }, { status: 500 });
  }
}
