// ============================================================
//  Aura AI — OpenRouter centralizado
//  Unifica toda a geracao de respostas IA num so lugar
//  Usado por: autonomous, cron/monitor, cmd/content, chat
// ============================================================

import { OR_KEY, OR_URL, OR_MODEL, OR_FALLBACK_MODEL } from '@/lib/config';

interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
}

const DEFAULT_SYSTEM = 'Es o assistente virtual da Mwango Brain, uma agencia criativa angolana. FALAS PORTUGUES DE ANGOLA. Responde de forma simpatica e profissional. Mantens respostas curtas (2-3 frases). Nunca digas que es IA. O teu nome e Aura.';

const JARVIS_HEADERS = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://jarvis-khaki-chi.vercel.app',
  'X-Title': 'Aura',
};

/**
 * Gera resposta IA via OpenRouter (Gemini com fallback Llama)
 */
export async function generateAIResponse(
  userMessage: string,
  options: AIOptions = {}
): Promise<string> {
  const { systemPrompt, maxTokens = 200, temperature = 0.7, context } = options;

  const sys = systemPrompt || DEFAULT_SYSTEM;
  let fullSystem = sys;

  if (context) {
    const parts: string[] = [];
    if (context.username) parts.push('Prospect: @' + context.username);
    if (context.platform) parts.push('Plataforma: ' + context.platform);
    if (context.notes) parts.push('Notas: ' + context.notes);
    if (context.category) parts.push('Categoria: ' + context.category);
    if (context.bio) parts.push('Bio: ' + (context.bio || '').slice(0, 200));
    if (parts.length > 0) fullSystem += '\n\nContexto: ' + parts.join('. ');
  }

  const messages: any[] = [
    { role: 'system', content: fullSystem },
    { role: 'user', content: userMessage },
  ];

  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
      body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: maxTokens, temperature }),
    });

    if (!res.ok) {
      const res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
        body: JSON.stringify({ model: OR_FALLBACK_MODEL, messages, max_tokens: maxTokens, temperature }),
      });
      const data2 = await res2.json();
      return cleanAIResponse(data2);
    }

    const data = await res.json();
    return cleanAIResponse(data);
  } catch (e: any) {
    console.error('Aura AI Error:', e?.message || e);
    return 'Obrigado pela mensagem! A Mwango Brain vai ver isso com atencao. Entraremos em contacto em breve.';
  }
}

/**
 * Gera resposta IA para DM — atalho com contexto de prospect
 */
export async function generateDMReply(
  senderName: string,
  platform: string,
  messageText: string,
  prospectContext?: any
): Promise<string> {
  const userMsg = 'Mensagem recebida de @' + senderName + ' no ' + platform + ': "' + messageText + '"\n\nResponde de forma natural e simpatica.';
  return generateAIResponse(userMsg, { context: { ...prospectContext, username: senderName, platform } });
}

/**
 * Gera conteudo (posts, captions, hashtags) — atalho com max_tokens maior
 */
export async function generateContent(prompt: string, maxTokens = 500): Promise<string> {
  return generateAIResponse(prompt, {
    systemPrompt: 'Es um copywriter especialista em redes sociais para a agencia Mwango Brain (Angola). FALAS PORTUGUES DE ANGOLA. Cria conteudo engajante e profissional.',
    maxTokens,
    temperature: 0.8,
  });
}

/**
 * Chat genérico (para o chat tab) — usado via API route, nunca no client
 */
export async function chatCompletion(messages: any[], maxTokens = 400): Promise<string> {
  const sysMsg = 'Es o Aura da Mwango Brain. FALAS PORTUGUES DE ANGOLA, frases curtas (2-3 linhas). Nunca digas que es IA.';
  const fullMessages = [{ role: 'system', content: sysMsg }, ...messages];

  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
      body: JSON.stringify({ model: OR_MODEL, messages: fullMessages, max_tokens: maxTokens, temperature: 0.7 }),
    });

    if (!res.ok) {
      const res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
        body: JSON.stringify({ model: OR_FALLBACK_MODEL, messages: fullMessages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      const data2 = await res2.json();
      return cleanAIResponse(data2);
    }

    const data = await res.json();
    return cleanAIResponse(data);
  } catch (e: any) {
    console.error('Aura AI Error:', e?.message || e);
    return 'Erro de conexao. Tenta novamente.';
  }
}

/** Limpa formatacao de resposta IA */
function cleanAIResponse(data: any): string {
  var content = data.choices?.[0]?.message?.content || '';
  // Strip only the first **Title:** prefix if present, keep other formatting
  content = content.replace(/^\*{1,2}[^*]+\*{1,2}[\s\n]*/, '').trim();
  return content;
}
