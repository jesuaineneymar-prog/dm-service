// ============================================================
//  Aura DEBUG ZERNIO — Raw data inspection
// ============================================================

import { NextResponse } from 'next/server';
import { zernioListAccounts, zernioListConversations, zernioGetConversationMessages, zernioSendDM } from '@/lib/zernio';

export var maxDuration = 30;

export async function GET() {
  // 1. Get accounts with full raw data
  var accsRes = await zernioListAccounts();
  var accs = accsRes.data;
  var accountsArray = accs?.accounts || (Array.isArray(accs) ? accs : []);
  var igAccountId = '';
  for (var i = 0; i < accountsArray.length; i++) {
    if (accountsArray[i].platform === 'instagram') {
      igAccountId = accountsArray[i]._id || accountsArray[i].id || '';
    }
  }

  // 2. Get first IG conversation with full data
  var convRes = await zernioListConversations({ platform: 'instagram', limit: 2 });
  var convData = convRes.data;
  var convs = convData?.data || convData?.conversations || (Array.isArray(convData) ? convData : []);
  
  var firstConvId = convs.length > 0 ? (convs[0].id || convs[0]._id || '') : '';
  var accountIdFromConv = convs.length > 0 ? (convs[0].accountId || '') : '';
  
  // 3. Try to get messages from first conversation
  var msgResult = null;
  if (firstConvId) {
    msgResult = await zernioGetConversationMessages(firstConvId, { limit: 3 });
  }
  
  // 4. Try to send a test DM
  var dmResult = null;
  if (firstConvId && accountIdFromConv) {
    dmResult = await zernioSendDM(firstConvId, accountIdFromConv, '[Teste Aura] Olá! Esta é uma mensagem de teste da Aura. Pode ignorar.');
  }

  return NextResponse.json({
    igAccountId,
    accounts: accountsArray.map(function(a: any) { return { id: a._id || a.id, platform: a.platform, username: a.username }; }),
    firstConvId,
    accountIdFromConv,
    conversationKeys: convs.length > 0 ? Object.keys(convs[0]) : [],
    conversationRaw: convs.length > 0 ? JSON.stringify(convs[0]).slice(0, 1000) : null,
    msgResult,
    dmResult,
  });
}
