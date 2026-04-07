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

  const userIdsParam = req.nextUrl.searchParams.get('userIds');
  if (!userIdsParam) {
    return NextResponse.json({ error: 'userIds query parameter is required (comma-separated)' }, { status: 400 });
  }

  const userIds = userIdsParam.split(',').map(id => id.trim()).filter(Boolean);
  if (userIds.length === 0) {
    return NextResponse.json({ error: 'At least one userId is required' }, { status: 400 });
  }

  try {
    const allTasks: any[] = [];
    const seenTaskIds = new Set<string>();
    let page = 0;
    let hasMore = true;

    while (hasMore && page < MAX_PAGES) {
      const url = new URL(`https://api.clickup.com/api/v2/team/${teamId}/task`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('subtasks', 'true');
      url.searchParams.set('include_closed', 'true');
      url.searchParams.set('order_by', 'created');

      // Add all user IDs as assignees[] — ClickUp returns tasks assigned to ANY of them
      for (const uid of userIds) {
        url.searchParams.append('assignees[]', uid);
      }

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

      // Deduplicate tasks (a task assigned to 2 team members appears once)
      for (const task of tasks) {
        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id);
          allTasks.push(task);
        }
      }

      hasMore = tasks.length === PAGE_SIZE;
      page++;
    }

    return NextResponse.json({
      tasks: allTasks,
      meta: { total: allTasks.length, pages: page, hasMore: page >= MAX_PAGES },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch team tasks: ${err.message}` }, { status: 500 });
  }
}
