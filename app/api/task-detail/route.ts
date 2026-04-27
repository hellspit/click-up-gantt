import { NextRequest, NextResponse } from 'next/server';

// Fetches full details for a single task, including custom_fields
export async function GET(req: NextRequest) {
  const apiKey = process.env.CLICKUP_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'CLICKUP_API_KEY not set' },{ status: 500 });
  }

  const taskId = req.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId query parameter required' }, { status: 400 });
  }

  try {
    const [taskRes, commentsRes] = await Promise.all([
      fetch(
        `https://api.clickup.com/api/v2/task/${taskId}?include_subtasks=true`,
        { headers: { Authorization: apiKey } }
      ),
      fetch(
        `https://api.clickup.com/api/v2/task/${taskId}/comment`,
        { headers: { Authorization: apiKey } }
      )
    ]);

    if (!taskRes.ok) {
      const text = await taskRes.text();
      return NextResponse.json(
        { error: `ClickUp API error (task): ${taskRes.status} - ${text}` },
        { status: taskRes.status }
      );
    }

    const task = await taskRes.json();
    
    let comments = [];
    if (commentsRes.ok) {
      const commentsData = await commentsRes.json();
      comments = commentsData.comments || [];
    }

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

    return NextResponse.json({ 
      customFields,
      description: task.description,
      text_content: task.text_content,
      comments: comments.map((c: any) => ({
        id: c.id,
        comment_text: c.comment_text || '',
        date: c.date,
        user: {
          username: c.user?.username,
          initials: c.user?.initials,
          profilePicture: c.user?.profilePicture
        }
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
