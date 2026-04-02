import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.CLICKUP_API_KEY;
  const teamId = process.env.CLICKUP_TEAM_ID;

  if (!apiKey || !teamId) {
    return NextResponse.json(
      { error: 'CLICKUP_API_KEY and CLICKUP_TEAM_ID must be set in .env.local' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}`, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `ClickUp API error: ${res.status} - ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const members = (data.team?.members || []).map((m: any) => ({
      id: m.user.id,
      username: m.user.username || m.user.email,
      email: m.user.email,
      initials: m.user.initials || (m.user.username ? m.user.username.slice(0, 2).toUpperCase() : '??'),
      profilePicture: m.user.profilePicture || null,
    }));

    return NextResponse.json({ members });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch team: ${err.message}` }, { status: 500 });
  }
}
