import { NextRequest, NextResponse } from 'next/server';

const MAX_PAGES = 50;
const PAGE_SIZE = 100;

/**
 * Fetch all tasks for a SINGLE user (paginated).
 */
async function fetchUserTasks(teamId: string, apiKey: string, userId: string): Promise<any[]> {
  const allTasks: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < MAX_PAGES) {
    const url = new URL(`https://api.clickup.com/api/v2/team/${teamId}/task`);
    url.searchParams.set('page', String(page));
    url.searchParams.append('assignees[]', userId);
    url.searchParams.set('subtasks', 'true');
    url.searchParams.set('include_closed', 'true');
    url.searchParams.set('order_by', 'due_date');

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp API error (user ${userId}, page ${page}): ${res.status} - ${text}`);
    }

    const data = await res.json();
    const tasks = data.tasks || [];
    allTasks.push(...tasks);

    // Use last_page if available, otherwise fallback to length check
    if (data.last_page !== undefined) {
      hasMore = !data.last_page;
    } else {
      hasMore = tasks.length === PAGE_SIZE;
    }

    page++;
  }

  return allTasks;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLICKUP_API_KEY;
  const teamId = process.env.CLICKUP_TEAM_ID;

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

    // Fetch per-user individually, then merge + deduplicate
    const perUserResults = await Promise.all(
      userIds.map(uid => fetchUserTasks(teamId, apiKey, uid))
    );

    // Deduplicate by task ID
    const seenTaskIds = new Set<string>();
    const allTasks: any[] = [];

    for (const userTasks of perUserResults) {
      for (const task of userTasks) {
        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id);
          allTasks.push(task);
        }
      }
    }

    return NextResponse.json({
      tasks: allTasks,
      meta: { total: allTasks.length, users: userIds.length },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch team tasks: ${err.message}` }, { status: 500 });
  }
}
