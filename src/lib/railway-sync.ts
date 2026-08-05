// ============================================================
//  Aura RAILWAY SYNC — env vars via Railway GraphQL API
//  Usa RAILWAY_API_TOKEN para gerir variaveis de ambiente
// ============================================================

var RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

// Get Railway credentials
function getRailwayCreds() {
  return {
    token: process.env.RAILWAY_API_TOKEN || '2969030e-ace0-459b-aa27-fcb9f2f4a170',
    projectId: process.env.RAILWAY_PROJECT_ID || '17256a66-27b2-41db-bef2-0d7f05c5e26b',
    envId: process.env.RAILWAY_ENV_ID || '',
  };
}

// Get environment ID if not set
async function getEnvironmentId(): Promise<string> {
  var creds = getRailwayCreds();
  if (creds.envId) return creds.envId;

  try {
    var query = `query($projectId: String!) { project(id: $projectId) { environments { id name } } }`;
    var res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { projectId: creds.projectId } }),
    });
    var data = await res.json();
    var envs = data.data?.project?.environments || [];
    if (envs.length > 0) return envs[0].id;
  } catch(e: any) {
    console.error('[Railway] getEnvironmentId:', e.message);
  }
  return '';
}

// Get all env vars
export async function railwayGetEnvVars(): Promise<{ success: boolean; vars?: Record<string, string>; error?: string }> {
  var creds = getRailwayCreds();
  var envId = await getEnvironmentId();
  if (!envId) return { success: false, error: 'Nao consegui obter environment ID' };

  try {
    var query = `query($projectId: String!, $environmentId: String!) {
      project(id: $projectId) { environment(id: $environmentId) { variables { edges { node { id name value } } } } }
    }`;
    var res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { projectId: creds.projectId, environmentId: envId } }),
    });
    var data = await res.json();
    if (data.errors) return { success: false, error: data.errors[0].message };

    var edges = data.data?.project?.environment?.variables?.edges || [];
    var vars: Record<string, string> = {};
    for (var i = 0; i < edges.length; i++) {
      var node = edges[i].node;
      if (node.name && node.value !== undefined) vars[node.name] = node.value;
    }
    return { success: true, vars };
  } catch(e: any) {
    return { success: false, error: e.message };
  }
}

// Set a single env var
export async function railwaySetEnvVar(name: string, value: string): Promise<{ success: boolean; error?: string }> {
  var creds = getRailwayCreds();
  var envId = await getEnvironmentId();
  if (!envId) return { success: false, error: 'Nao consegui obter environment ID' };

  try {
    var mutation = `mutation($projectId: String!, $environmentId: String!, $name: String!, $value: String!) {
      variableUpsert(input: { projectId: $projectId, environmentId: $environmentId, name: $name, value: $value })
    }`;
    var res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { projectId: creds.projectId, environmentId: envId, name, value } }),
    });
    var data = await res.json();
    if (data.errors) return { success: false, error: data.errors[0].message };
    return { success: true };
  } catch(e: any) {
    return { success: false, error: e.message };
  }
}

// Sync multiple env vars at once
export async function railwaySyncEnvVars(updates: Record<string, string>): Promise<{ success: boolean; synced: string[]; errors: string[] }> {
  var synced: string[] = [];
  var errors: string[] = [];
  var entries = Object.entries(updates);

  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0], val = entries[i][1];
    var result = await railwaySetEnvVar(key, val);
    if (result.success) synced.push(key);
    else errors.push(key + ': ' + (result.error || ''));
  }

  return { success: synced.length > 0, synced, errors };
}

// Get deployment status
export async function railwayGetDeployments(): Promise<{ success: boolean; deployments?: any[]; error?: string }> {
  var creds = getRailwayCreds();
  try {
    var query = `query($projectId: String!) {
      project(id: $projectId) { deployments { edges { node { id status createdAt updatedAt } } } }
    }`;
    var res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { projectId: creds.projectId } }),
    });
    var data = await res.json();
    if (data.errors) return { success: false, error: data.errors[0].message };
    var edges = data.data?.project?.deployments?.edges || [];
    var deployments = edges.map(function(e: any) { return e.node; });
    return { success: true, deployments };
  } catch(e: any) {
    return { success: false, error: e.message };
  }
}

// Trigger redeploy
export async function railwayRedeploy(): Promise<{ success: boolean; error?: string }> {
  var creds = getRailwayCreds();
  try {
    var query = `query($projectId: String!) {
      project(id: $projectId) { services { edges { node { id } } } }
    }`;
    var res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { projectId: creds.projectId } }),
    });
    var data = await res.json();
    var services = data.data?.project?.services?.edges || [];
    if (services.length === 0) return { success: false, error: 'Nenhum servico encontrado' };
    var serviceId = services[0].node.id;

    var mut = `mutation($serviceId: String!) {
      serviceRestart(input: { serviceId: $serviceId })
    }`;
    var res2 = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mut, variables: { serviceId } }),
    });
    var data2 = await res2.json();
    if (data2.errors) return { success: false, error: data2.errors[0].message };
    return { success: true };
  } catch(e: any) {
    return { success: false, error: e.message };
  }
}
