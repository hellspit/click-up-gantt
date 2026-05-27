import { NextRequest, NextResponse } from 'next/server';

const MAX_PAGES = 20;
const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLICKUP_API_KEY;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const spaceId = process.env.CLICKUP_SPACE_ID;

  if (!apiKey || !teamId) {
    return NextResponse.json(
      { error: 'CLICKUP_API_KEY and CLICKUP_TEAM_ID must be set in .env.local' },
      { status: 500 }
    );
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
  }

  try {
    const allTasks: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < MAX_PAGES) {
      const url = new URL(`https://api.clickup.com/api/v2/team/${teamId}/task`);
      url.searchParams.set('page', String(page));
      url.searchParams.append('assignees[]', userId);
      url.searchParams.set('subtasks', 'true');
      url.searchParams.set('include_closed', 'true');
      url.searchParams.set('order_by', 'created');
      if (spaceId) {
        url.searchParams.append('space_ids[]', spaceId);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: apiKey },
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `ClickUp API error on page ${page}: ${res.status} - ${text}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const tasks = data.tasks || [];
      allTasks.push(...tasks);

      hasMore = tasks.length === PAGE_SIZE;
      page++;
    }

    // Fetch missing parent tasks
    const existingTaskIds = new Set(allTasks.map(t => t.id));
    const missingParentIds = Array.from(
      new Set(
        allTasks
          .map(t => t.parent)
          .filter((p): p is string => typeof p === 'string' && p !== '' && !existingTaskIds.has(p))
      )
    );

    if (missingParentIds.length > 0) {
      const results = await Promise.allSettled(
        missingParentIds.map(async (pid) => {
          const res = await fetch(`https://api.clickup.com/api/v2/task/${pid}`, {
            headers: { Authorization: apiKey },
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch parent task ${pid}: ${res.status}`);
          }
          return res.json();
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allTasks.push(result.value);
        } else if (result.status === 'rejected') {
          console.error(`[API Tasks] Error fetching parent task:`, result.reason);
        }
      }
    }

    // Deduplicate allTasks by ID
    const seen = new Set<string>();
    const uniqueTasks = allTasks.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return NextResponse.json({
      tasks: uniqueTasks,
      meta: { total: uniqueTasks.length, pages: page, hasMore: page >= MAX_PAGES },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch tasks: ${err.message}` }, { status: 500 });
  }
}
