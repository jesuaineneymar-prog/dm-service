import { NextResponse } from 'next/server';
import { TURSO_URL as CFG_URL, TURSO_AUTH_TOKEN as CFG_TOKEN } from '@/lib/config';

export async function GET() {
  // Test every way to read the env var
  var dotNotation = process.env.TURSO_URL;
  var bracketNotation = process.env['TURSO_URL'];
  var fromConfig = CFG_URL;
  
  // Try to read ALL env vars that contain TURSO
  var allKeys = Object.keys(process.env).filter(function(k) { return k.includes('TURSO') || k.includes('turso'); });
  
  return NextResponse.json({
    dotNotation: dotNotation ? dotNotation.slice(0, 30) + '...' : 'UNDEFINED',
    bracketNotation: bracketNotation ? bracketNotation.slice(0, 30) + '...' : 'UNDEFINED',
    fromConfig: fromConfig ? fromConfig.slice(0, 30) + '...' : 'UNDEFINED',
    tursoEnvKeys: allKeys,
    envType: typeof process.env,
    nodeEnv: process.env['NODE_ENV'],
  });
}
