// ============================================================
//  Aura CRM API — gestao de prospeccao e contactos
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

// ── helpers ────────────────────────────────────────────────

// ── actions ────────────────────────────────────────────────

async function listProspects(filter: any) {
  var where: any = {};
  if (filter.platform) where.platform = filter.platform;
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;

  var prospects = await db.prospect.findMany({
    where,
    include: { messages: true, followUps: true },
    orderBy: { updatedAt: 'desc' },
  });

  var enriched = prospects.map(function (p) {
    var messageCount = p.messages.length;
    var lastContact = messageCount > 0
      ? p.messages.sort(function (a: any, b: any) { return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(); })[0]
      : null;
    return {
      ...p,
      messageCount,
      lastContact: lastContact
        ? { direction: lastContact.direction, content: lastContact.content.slice(0, 80), sentAt: lastContact.sentAt }
        : null,
      messages: undefined, // omit full messages from list
      followUps: p.followUps.map(function (fu: any) {
        return { id: fu.id, scheduledAt: fu.scheduledAt, status: fu.status, message: fu.message };
      }),
    };
  });

  return enriched;
}

async function addProspect(data: any) {
  var prospect = await db.prospect.create({
    data: {
      platform: data.platform,
      username: data.username,
      displayName: data.displayName || null,
      followers: data.followers || 0,
      bio: data.bio || null,
      profileUrl: data.profileUrl || null,
      avatarUrl: data.avatarUrl || null,
    },
  });
  return prospect;
}

async function updateProspect(id: string, data: any) {
  var updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.score !== undefined) updateData.score = data.score;

  var prospect = await db.prospect.update({
    where: { id },
    data: updateData,
  });
  return prospect;
}

async function deleteProspect(id: string) {
  await db.prospect.delete({ where: { id } });
  return { success: true };
}

async function importProspects(platform: string, source: string, query: string) {
  // TODO: replace with Zernio or ScrapingBee
  return { imported: 0, prospects: [] };
}

async function addMessage(prospectId: string, direction: string, content: string, platform: string) {
  var message = await db.message.create({
    data: { prospectId, direction, content, platform: platform || null },
  });

  // Update prospect timestamps
  var updateData: any = {};
  if (direction === 'outbound') {
    updateData.lastContactedAt = new Date();
  } else {
    updateData.lastRepliedAt = new Date();
    updateData.lastContactedAt = new Date();
  }
  await db.prospect.update({ where: { id: prospectId }, data: updateData });

  return message;
}

async function getMessages(prospectId: string) {
  var messages = await db.message.findMany({
    where: { prospectId },
    orderBy: { sentAt: 'asc' },
  });
  return messages;
}

async function scheduleFollowUp(prospectId: string, scheduledAt: string, message: string) {
  var followUp = await db.followUp.create({
    data: {
      prospectId,
      scheduledAt: new Date(scheduledAt),
      message: message || null,
    },
  });
  return followUp;
}

async function getStats() {
  var allProspects = await db.prospect.findMany({
    include: { messages: true, followUps: true },
  });

  var byStatus: Record<string, number> = {};
  var byPlatform: Record<string, number> = {};
  var byCategory: Record<string, number> = {};
  var totalMessagesIn = 0;
  var totalMessagesOut = 0;
  var pendingFollowUps = 0;

  for (var i = 0; i < allProspects.length; i++) {
    var p = allProspects[i];
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
    byCategory[p.category || 'prospect'] = (byCategory[p.category || 'prospect'] || 0) + 1;

    for (var j = 0; j < p.messages.length; j++) {
      if (p.messages[j].direction === 'inbound') totalMessagesIn++;
      else totalMessagesOut++;
    }
    for (var k = 0; k < p.followUps.length; k++) {
      if (p.followUps[k].status === 'pending') pendingFollowUps++;
    }
  }

  return {
    totalProspects: allProspects.length,
    byStatus,
    byPlatform,
    byCategory,
    totalMessages: totalMessagesIn + totalMessagesOut,
    messagesSent: totalMessagesOut,
    messagesReceived: totalMessagesIn,
    pendingFollowUps,
  };
}

// ── main handler ───────────────────────────────────────────

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'list_prospects') {
      var prospects = await listProspects(body.filter || {});
      return NextResponse.json({ success: true, data: prospects });
    }

    if (action === 'add_prospect') {
      if (!body.username || !body.platform) {
        return NextResponse.json({ success: false, error: 'Username e plataforma sao obrigatorios' });
      }
      var prospect = await addProspect(body);
      return NextResponse.json({ success: true, data: prospect });
    }

    if (action === 'update_prospect') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var updated = await updateProspect(body.id, body);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'delete_prospect') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var deleted = await deleteProspect(body.id);
      return NextResponse.json(deleted);
    }

    if (action === 'import_prospects') {
      if (!body.platform || !body.source) {
        return NextResponse.json({ success: false, error: 'Plataforma e fonte ("followers" ou "search") sao obrigatorios' });
      }
      var result = await importProspects(body.platform, body.source, body.query || '');
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'add_message') {
      if (!body.prospectId || !body.content || !body.direction) {
        return NextResponse.json({ success: false, error: 'prospectId, direction e content sao obrigatorios' });
      }
      var msg = await addMessage(body.prospectId, body.direction, body.content, body.platform || '');
      return NextResponse.json({ success: true, data: msg });
    }

    if (action === 'get_messages') {
      if (!body.prospectId) return NextResponse.json({ success: false, error: 'prospectId necessario' });
      var msgs = await getMessages(body.prospectId);
      return NextResponse.json({ success: true, data: msgs });
    }

    if (action === 'schedule_followup') {
      if (!body.prospectId || !body.scheduledAt) {
        return NextResponse.json({ success: false, error: 'prospectId e scheduledAt sao obrigatorios' });
      }
      var fu = await scheduleFollowUp(body.prospectId, body.scheduledAt, body.message || '');
      return NextResponse.json({ success: true, data: fu });
    }

    if (action === 'migrate_local') {
      var localProspects = body.prospects || [];
      var migrated = 0;
      var skipped = 0;
      for (var mi = 0; mi < localProspects.length; mi++) {
        var lp = localProspects[mi];
        if (!lp.username || !lp.platform) { skipped++; continue; }
        var existing = await db.prospect.findFirst({ where: { platform: lp.platform, username: lp.username } });
        if (!existing) {
          await db.prospect.create({
            data: {
              platform: lp.platform,
              username: lp.username,
              displayName: lp.name || lp.displayName || null,
              followers: lp.followers || 0,
              bio: lp.bio || null,
              category: lp.category || 'prospect',
              notes: lp.notes || null,
            },
          });
          migrated++;
        } else { skipped++; }
      }
      return NextResponse.json({ success: true, data: { migrated, skipped, total: localProspects.length } });
    }

    if (action === 'get_stats') {
      var stats = await getStats();
      return NextResponse.json({ success: true, data: stats });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
