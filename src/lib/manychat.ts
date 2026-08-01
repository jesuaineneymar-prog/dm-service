// ============================================================
//  MANYCHAT API — DM Engine para Instagram, Facebook, TikTok
//  Docs: https://api.manychat.com
//  Base URL: https://api.manychat.com
//  API v1 (paths: /fb/sending/*, /fb/page/*, /ig/*, /tt/*)
// ============================================================

import { MANYCHAT_KEY } from './config';

var MC_BASE = 'https://api.manychat.com';

function mcHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + MANYCHAT_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// === INFORMACAO DA PAGINA (Facebook) ===

export async function mcGetPageInfo() {
  try {
    var res = await fetch(MC_BASE + '/fb/page/getInfo', { headers: mcHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === ENVIAR MENSAGEM — Facebook ===
// POST /fb/sending/sendContent
// Body: { subscriber_id: string, blocks: Array<{type: string, ...}> }
export async function mcSendFacebookDM(options: {
  subscriberId: string;
  message: string;
  buttons?: Array<{ type: string; text: string; url?: string; payload?: string }>;
}) {
  try {
    var blocks: any[] = [];
    var textBlock: any = {
      type: 'text',
      text: options.message,
    };
    if (options.buttons && options.buttons.length > 0) {
      textBlock.buttons = options.buttons;
    }
    blocks.push(textBlock);

    var res = await fetch(MC_BASE + '/fb/sending/sendContent', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        subscriber_id: options.subscriberId,
        blocks: blocks,
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === ENVIAR MENSAGEM — Instagram ===
// POST /ig/sending/sendContent
export async function mcSendInstagramDM(options: {
  subscriberId: string;
  message: string;
  buttons?: Array<{ type: string; text: string; url?: string; payload?: string }>;
}) {
  try {
    var blocks: any[] = [];
    var textBlock: any = {
      type: 'text',
      text: options.message,
    };
    if (options.buttons && options.buttons.length > 0) {
      textBlock.buttons = options.buttons;
    }
    blocks.push(textBlock);

    var res = await fetch(MC_BASE + '/ig/sending/sendContent', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        subscriber_id: options.subscriberId,
        blocks: blocks,
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === ENVIAR MENSAGEM — TikTok ===
// POST /tt/sending/sendContent
export async function mcSendTikTokDM(options: {
  subscriberId: string;
  message: string;
}) {
  try {
    var res = await fetch(MC_BASE + '/tt/sending/sendContent', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        subscriber_id: options.subscriberId,
        blocks: [{ type: 'text', text: options.message }],
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === ENVIAR FLOW — Facebook ===
// POST /fb/sending/sendFlow
export async function mcSendFacebookFlow(options: {
  subscriberId: string;
  flowId: string;
}) {
  try {
    var res = await fetch(MC_BASE + '/fb/sending/sendFlow', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        subscriber_id: options.subscriberId,
        flow_id: options.flowId,
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === ENVIAR POR USER REF ===
// POST /fb/sending/sendContentByUserRef
// Usado quando tens o user_ref do Facebook (ex: checkbox plugin)
export async function mcSendByUserRef(options: {
  userRef: string;
  message: string;
}) {
  try {
    var res = await fetch(MC_BASE + '/fb/sending/sendContentByUserRef', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        user_ref: options.userRef,
        blocks: [{ type: 'text', text: options.message }],
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === SUBSCRIBERS ===

// Buscar subscribers
export async function mcGetSubscribers(options?: {
  limit?: number;
  page?: number;
  status?: string;
}) {
  try {
    var url = MC_BASE + '/fb/subscriber/find';
    var params: string[] = [];
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (options?.page) params.push('page=' + String(options.page));
    if (options?.status) params.push('status=' + options.status);
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Buscar info de um subscriber especifico
export async function mcGetSubscriber(subscriberId: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/subscriber/getInfo', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ subscriber_id: subscriberId }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TAGS ===

// Criar uma tag
export async function mcCreateTag(name: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/page/createTag', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ name: name }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Adicionar tag a subscriber
export async function mcAddTag(subscriberId: string, tagId: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/subscriber/addTag', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ subscriber_id: subscriberId, tag_id: tagId }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Remover tag de subscriber
export async function mcRemoveTag(subscriberId: string, tagId: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/subscriber/removeTag', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ subscriber_id: subscriberId, tag_id: tagId }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === CUSTOM FIELDS ===

// Atualizar custom field de um subscriber
export async function mcSetCustomField(subscriberId: string, fieldId: string, value: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/subscriber/setCustomField', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        subscriber_id: subscriberId,
        field_id: fieldId,
        value: value,
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === CONEXAO / STATUS ===

// Verificar se Facebook esta conectado (via pageInfo)
export async function mcCheckFacebookConnection() {
  return await mcGetPageInfo();
}

// Verificar se Instagram esta conectado
export async function mcCheckInstagramConnection() {
  try {
    // ManyChat IG uses same page/connection system
    // Try the IG-specific endpoint
    var res = await fetch(MC_BASE + '/ig/sending/sendContent', {
      method: 'OPTIONS',
      headers: mcHeaders(),
    });
    // If we get anything other than 404, IG is connected
    if (res.status === 404) {
      return { success: false, error: 'Instagram nao conectado ao ManyChat' };
    }
    return { success: true, data: { status: 'ig_endpoint_accessible' } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get account info (alias for getPageInfo)
export async function mcGetAccountInfo() {
  return await mcGetPageInfo();
}

// === ALIAS para compatibilidade com routes ===

// Trigger flow (alias)
export async function mcTriggerFlow(options: { subscriberId: string; flowId: string }) {
  return await mcSendFacebookFlow(options);
}

// Find subscriber by custom ID
export async function mcFindSubscriberByCustomId(customId: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/subscriber/getInfo', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ custom_id: customId }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// List flows - ManyChat doesn't have a public API for this
export async function mcListFlows() {
  try {
    var res = await fetch(MC_BASE + '/fb/page/getInfo', { headers: mcHeaders() });
    if (!res.ok) {
      return { success: false, error: 'HTTP ' + res.status };
    }
    var data = await res.json();
    return { success: true, data: { note: 'ManyChat API does not expose a flows list endpoint. Manage flows in ManyChat dashboard.', page: data } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
