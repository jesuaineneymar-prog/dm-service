// Fix para Turbopack ter substituído process.env.DATABASE_URL por undefined no runtime
// Este módulo executa ANTES de qualquer import do Prisma

var _tursoUrl: string | undefined = process.env['TURSO_URL'];
var _tursoToken: string | undefined = process.env['TURSO_AUTH_TOKEN'];

// Se DATABASE_URL não existe ou é 'undefined', usar TURSO_URL
if (!process.env['DATABASE_URL'] || process.env['DATABASE_URL'] === 'undefined') {
  if (_tursoUrl) {
    (process.env as any)['DATABASE_URL'] = _tursoUrl;
    console.log('[Aura DB] DATABASE_URL fix applied from TURSO_URL');
  }
}
