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

    return NextResponse.json({
      tasks: allTasks,
      meta: { total: allTasks.length, pages: page, hasMore: page >= MAX_PAGES },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch tasks: ${err.message}` }, { status: 500 });
  }
}
