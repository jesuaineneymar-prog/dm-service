import * as https from 'https';

// Sync META_PAGE_TOKEN and META_PAGE_ID to Railway
const RAILWAY_TOKEN = '2969030e-ace0-459b-aa27-fcb9f2f4a170';
const RAILWAY_PROJECT_ID = '17256a66-27b2-41db-bef2-0d7f05c5e26b';
const RAILWAY_ENV_ID = process.argv[2] || '';

const PAGE_TOKEN = 'EAAfqggcDF78BSNTvNLbs1yj60UYEME9FEp8OFnxapWTcRtiW6sf2d4eWf0wXmBxDZCP1VDjLZANsK0HWu5pnFUKxaKJbgrUED4IK3JOXdtaChpwUhOeCxYBelZAphlAbeU0xj8cDwjIke8xT925hKgLhhitHJ4sIFJ4sF7mALDiUtc5ugwNJM2ZCyuUuAoMcGrFm537j49h8WSEVzwMmllybdVlbUFNVUjGNCEl4TROUCS0QqNnvWVUZD';
const PAGE_ID = '1271692609354364';

const envVars = [
  { name: 'META_PAGE_TOKEN', value: PAGE_TOKEN },
  { name: 'META_PAGE_ID', value: PAGE_ID },
  { name: 'MESSENGER_VERIFY_TOKEN', value: 'aura_mwango_verify_2024' },
];

function graphqlRequest(mutation: string, variables: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: mutation, variables });
    const options = {
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RAILWAY_TOKEN,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== SYNC META PAGE TOKEN TO RAILWAY ===\n');

  // First, find the environment ID
  if (!RAILWAY_ENV_ID) {
    console.log('A descobrir Environment ID do Railway...');
    const projectQuery = `
      query($projectId: String!) {
        project(id: $projectId) {
          environments {
            id
            name
            serviceCount
          }
        }
      }
    `;
    const projectRes = await graphqlRequest(projectQuery, { projectId: RAILWAY_PROJECT_ID });
    const envs = projectRes?.data?.project?.environments || [];
    console.log('Ambientes encontrados:', JSON.stringify(envs.map((e: any) => ({ id: e.id, name: e.name, services: e.serviceCount })), null, 2));
    
    if (envs.length > 0) {
      // Use the first environment (usually Production)
      var envId = envs[0].id;
      console.log('Usando ambiente:', envs[0].name, '(' + envId + ')');
    } else {
      console.log('ERRO: Nenhum ambiente encontrado');
      return;
    }
  } else {
    var envId = RAILWAY_ENV_ID;
  }

  // Sync each env var
  for (const envVar of envVars) {
    console.log(`\nA sincronizar ${envVar.name}...`);
    const mutation = `
      mutation($projectId: String!, $environmentId: String!, $name: String!, $value: String!) {
        variableUpsert(input: {projectId: $projectId, environmentId: $environmentId, name: $name, value: $value}) {
          variable {
            id
            name
          }
        }
      }
    `;
    const result = await graphqlRequest(mutation, {
      projectId: RAILWAY_PROJECT_ID,
      environmentId: envId,
      name: envVar.name,
      value: envVar.value,
    });
    
    if (result.errors) {
      console.log('  ERRO:', result.errors[0].message);
    } else {
      console.log('  OK:', envVar.name, '= ' + envVar.value.substring(0, 20) + '...');
    }
  }

  console.log('\n=== CONCLUIDO ===');
  console.log('Env vars sincronizadas com Railway. Pode levar 1-2 min para surtir efeito.');
}

main().catch(console.error);
