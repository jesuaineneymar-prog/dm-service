// ============================================================
//  JARVIS CRON — Follow-ups Automáticos (a cada 30 minutos)
//  - Cria follow-ups para prospects sem contacto há 3+ dias
//  - Envia follow-ups pendentes cujo horário já chegou
//  - Agenda próximo follow-up (7 dias depois)
//  - Tudo via Zernio DM (Instagram + Facebook)
//  Protegido por CRON_SECRET via Vercel Cron
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  zernioListAccounts,
  zernioListConversations,
  zernioSendDM,
} from '@/lib/zernio';

export var maxDuration = 120;
var CRON_SECRET = process.env.CRON_SECRET || 'jarvis_cron_secret_mwango_2024';

// Criar follow-ups automáticos para prospects sem contacto há 3+ dias
async function autoCreateFollowUps(): Promise<number> {
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  var prospects = await db.prospect.findMany({
    where: {
      status: { in: ['contacted', 'responded', 'new'] },
      OR: [
        { lastContactedAt: { lt: threeDaysAgo } },
        { lastContactedAt: null },
      ],
    },
    include: { followUps: true },
  });

  var created = 0;
  for (var i = 0; i < prospects.length; i++) {
    var p = prospects[i];

    // Verificar se ja tem follow-up pendente
    var hasPending = p.followUps.some(function(fu: any) { return fu.status === 'pending'; });
    if (hasPending) continue;

    // Criar follow-up para 1 dia a partir de agora (já se passaram 3+ dias)
    var followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 1);

    var message = 'Seguimento automatico: Ola ' + (p.displayName || '@' + p.username) + ', estou a passar para saber se ainda tens interesse nos nossos servicos criativos. A Mwango Brain tem novidades que podem interessar-te!';

    await db.followUp.create({
      data: {
        prospectId: p.id,
        scheduledAt: followUpDate,
        message: message,
      },
    });

    await db.automationLog.create({
      data: {
        type: 'cron_followup_create',
        action: 'auto_followup_3days',
        platform: p.platform,
        targetId: p.id,
        targetName: p.username,
        status: 'success',
        result: 'Follow-up criado para ' + followUpDate.toISOString(),
      },
    });

    created++;
  }

  return created;
}

// Enviar follow-ups pendentes cujo horário já chegou
async function sendPendingFollowUps(): Promise<any> {
  var results: any = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    // Buscar contas Zernio
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) {
      results.errors.push('Zernio accounts: ' + (accountsRes.error || 'falhou'));
      return results;
    }

    var accountsData = accountsRes.data;
    var accounts: any[] = Array.isArray(accountsData) ? accountsData : (accountsData?.accounts || []);

    // Buscar follow-ups pendentes cujo horário já chegou
    var dueFollowUps = await db.followUp.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
      include: { prospect: true },
      orderBy: { scheduledAt: 'asc' },
      take: 15,
    });

    for (var i = 0; i < dueFollowUps.length; i++) {
      var fu = dueFollowUps[i];
      var prospect = fu.prospect;
      results.processed++;

      var followUpMessage = fu.message || 'Ola ' + (prospect.displayName || '@' + prospect.username) + ', passei para saber se ainda tens interesse nos nossos servicos. A Mwango Brain tem novidades!';
      var platform = prospect.platform || 'instagram';

      // Encontrar a conversa deste prospect no Zernio
      var convRes = await zernioListConversations({ platform: platform, limit: 50 });
      if (!convRes.success) {
        await db.followUp.update({
          where: { id: fu.id },
          data: { status: 'failed' },
        });
        await db.automationLog.create({
          data: { type: 'cron_followup_send', action: 'send_followup', platform, targetId: prospect.id, targetName: prospect.username, status: 'failed', result: 'Conversations failed' },
        });
        continue;
      }

      var convData = convRes.data;
      var conversations: any[] = Array.isArray(convData) ? convData : (convData?.data || convData?.conversations || []);

      var matchingConv = conversations.find(function(c: any) {
        var pName = c.participant?.name || c.participant?.username || '';
        return pName.toLowerCase() === prospect.username.toLowerCase();
      });

      if (!matchingConv) {
        await db.followUp.update({
          where: { id: fu.id },
          data: { status: 'failed' },
        });
        await db.automationLog.create({
          data: { type: 'cron_followup_send', action: 'send_followup', platform, targetId: prospect.id, targetName: prospect.username, status: 'failed', result: 'Conversa nao encontrada' },
        });
        continue;
      }

      var accountId = matchingConv.accountId || accounts.find(function(a: any) { return a.platform === platform; })?.id || '';
      if (!accountId) {
        await db.followUp.update({
          where: { id: fu.id },
          data: { status: 'failed' },
        });
        continue;
      }

      // Enviar follow-up via Zernio
      var sendRes = await zernioSendDM(matchingConv.id, accountId, followUpMessage);

      if (sendRes.success) {
        results.sent++;

        // Marcar follow-up como enviado
        await db.followUp.update({
          where: { id: fu.id },
          data: { status: 'sent', sentAt: new Date() },
        });

        // Guardar mensagem no CRM
        await db.message.create({
          data: {
            prospectId: prospect.id,
            direction: 'outbound',
            content: followUpMessage,
            platform: platform,
          },
        });

        // Actualizar prospect
        await db.prospect.update({
          where: { id: prospect.id },
          data: { lastContactedAt: new Date(), status: 'contacted' },
        });

        // Registar no log
        await db.automationLog.create({
          data: {
            type: 'cron_followup_send',
            action: 'auto_followup_sent',
            platform: platform,
            targetId: prospect.id,
            targetName: prospect.username,
            status: 'success',
            result: 'Follow-up enviado com sucesso',
            completedAt: new Date(),
          },
        });

        // Agendar proximo follow-up (7 dias depois)
        var nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);

        await db.followUp.create({
          data: {
            prospectId: prospect.id,
            scheduledAt: nextDate,
            message: 'Lembrete: Ola ' + (prospect.displayName || '@' + prospect.username) + ', a Mwango Brain continua interessada em trabalhar contigo! Tens algum projecto em mente?',
          },
        });

        await db.automationLog.create({
          data: {
            type: 'cron_followup_create',
            action: 'next_followup_scheduled',
            platform: platform,
            targetId: prospect.id,
            targetName: prospect.username,
            status: 'success',
            result: 'Proximo follow-up agendado para ' + nextDate.toISOString(),
          },
        });
      } else {
        await db.followUp.update({
          where: { id: fu.id },
          data: { status: 'failed' },
        });
        await db.automationLog.create({
          data: {
            type: 'cron_followup_send',
            action: 'send_followup',
            platform: platform,
            targetId: prospect.id,
            targetName: prospect.username,
            status: 'failed',
            result: sendRes.error || 'Falha ao enviar',
          },
        });
      }
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return results;
}

// Vercel Cron chama esta rota automaticamente a cada 30 minutos
export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized — CRON_SECRET invalido' }, { status: 401 });
  }

  try {
    var startTime = Date.now();

    // Fase 1: Criar follow-ups para prospects sem contacto há 3+ dias
    var created = await autoCreateFollowUps();

    // Fase 2: Enviar follow-ups pendentes
    var sendResults = await sendPendingFollowUps();

    var duration = Date.now() - startTime;

    // Registar execucao do cron
    await db.automationLog.create({
      data: {
        type: 'cron_followup',
        action: 'followup_cycle',
        platform: 'all',
        status: sendResults.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({
          created: created,
          processed: sendResults.processed,
          sent: sendResults.sent,
          duration: duration + 'ms',
        }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'followups',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: {
        autoCreated: created,
        sent: sendResults,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST para acionar manualmente
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  var created = await autoCreateFollowUps();
  var sendResults = await sendPendingFollowUps();

  return NextResponse.json({
    success: true,
    cron: 'followups',
    data: { autoCreated: created, sent: sendResults },
  });
}
