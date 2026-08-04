#!/usr/bin/env python3
"""Get Railway env vars - try environment variables."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Try environmentVariables
print("=== Environment Variables ===")
data = gql(f'''{{
  environment(id: "{ENV_ID}") {{
    id
    name
    environmentVariables {{
      edges {{
        node {{
          id
          name
          value
        }}
      }}
    }}
  }}
}}''')
if data:
    env_vars = data["environment"]["environmentVariables"]["edges"]
    for edge in env_vars:
        v = edge["node"]
        val = v["value"]
        if len(val) > 80:
            val = val[:40] + "..." + val[-20:]
        print(f"  {v['name']} = {val}")
    print(f"\nTotal: {len(env_vars)} vars")
else:
    # Try variables on service
    print("\n=== Try serviceVariables (v2) ===")
    data = gql(f'''{{
      service(id: "{SERVICE_ID}") {{
        id
        name
        variables {{
          edges {{
            node {{
              id
              name
              value
            }}
          }}
        }}
      }}
    }}''')
    if data:
        svc_vars = data["service"]["variables"]["edges"]
        for edge in svc_vars:
            v = edge["node"]
            val = v["value"]
            if len(val) > 80:
                val = val[:40] + "..." + val[-20:]
            print(f"  {v['name']} = {val}")
        print(f"\nTotal: {len(svc_vars)} vars")
    else:
        print("Could not get variables")