// ============================================================
//  Aura v4 — Script Runner (opaque to bundlers)
//  Executa scripts CJS em /scripts/ sem que Turbopack tente resolve-los
// ============================================================

interface ScriptResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Caminho opaco: o bundler NAO consegue analisar Buffer.from() em build time
function scriptsDir(): string {
  // 'scripts' encoded em base64 → c2NyaXB0cw==
  var dirName = Buffer.from('c2NyaXB0cw==', 'base64').toString('utf-8');
  var path = require('path');
  return process.cwd() + path.sep + dirName + path.sep;
}

/**
 * Executar um script CJS via child_process.execFile
 * O caminho e completamente opaco ao Turbopack/webpack
 */
export function runScript(filename: string, args: string[], options?: { timeout?: number; maxBuffer?: number }): Promise<ScriptResult> {
  var { execFile } = require('child_process');
  var scriptPath = scriptsDir() + filename;

  return new Promise(function(resolve) {
    execFile('node', [scriptPath, ...args], {
      timeout: options?.timeout || 60000,
      maxBuffer: options?.maxBuffer || 2 * 1024 * 1024,
    }, function(error: any, stdout: string, stderr: string) {
      if (error && !stdout) {
        var errMsg = error.message || error.code || error.name || 'Unknown exec error';
        if (error.code) errMsg = '[' + error.code + '] ' + errMsg;
        if (stderr) errMsg += ' | stderr: ' + stderr.substring(0, 1000);
        if (error.signal) errMsg += ' | signal: ' + error.signal;
        resolve({ success: false, error: errMsg });
        return;
      }
      // Se tem erro mas tambem tem stdout, tenta parsear o stdout primeiro
      try {
        var lines = stdout.trim().split('\n');
        var lastLine = lines[lines.length - 1];
        if (!lastLine) {
          resolve({ success: false, error: stderr || 'Empty output from script' });
          return;
        }
        resolve({ success: true, data: JSON.parse(lastLine) });
      } catch (e) {
        var parseErr = 'Parse error: ' + (stdout || '').substring(0, 500);
        if (stderr) parseErr += ' | stderr: ' + stderr.substring(0, 1000);
        if (error) parseErr += ' | exec: ' + (error.message || error.code || '');
        resolve({ success: false, error: parseErr });
      }
    });
  });
}

/**
 * Obter caminho completo para um ficheiro na pasta scripts
 */
export function getScriptsFilePath(filename: string): string {
  return scriptsDir() + filename;
}
