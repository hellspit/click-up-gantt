import { NextRequest, NextResponse } from 'next/server';

// Fetches full details for a single task, including custom_fields
export async function GET(req: NextRequest) {
  const apiKey = process.env.CLICKUP_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'CLICKUP_API_KEY not set' }, { status: 500 });
  }

  const taskId = req.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId query parameter required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}?include_subtasks=true`,
      { headers: { Authorization: apiKey } }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ClickUp API error: ${res.status} - ${text}` },
        { status: res.status }
      );
    }

    const task = await res.json();

    // Extract custom fields, resolving drop_down values to labels
    const customFields = (task.custom_fields || []).map((cf: any) => {
      let resolvedValue = cf.value;

      // For drop_down: value is an orderindex integer, resolve to label
      if (cf.type === 'drop_down' && cf.value !== null && cf.type_config?.options) {
        const option = cf.type_config.options.find((o: any) => o.orderindex === cf.value);
        if (option) resolvedValue = option.name || option.label || cf.value;
      }

      // For labels: value is array of label UUIDs, resolve to names
      if (cf.type === 'labels' && Array.isArray(cf.value) && cf.type_config?.options) {
        resolvedValue = cf.value.map((labelId: string) => {
          const opt = cf.type_config.options.find((o: any) => o.id === labelId);
          return opt?.label || opt?.name || labelId;
        });
      }

      return {
        id: cf.id,
        name: cf.name,
        type: cf.type,
        value: resolvedValue,
      };
    });

    return NextResponse.json({ customFields });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
