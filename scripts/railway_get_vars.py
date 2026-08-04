#!/usr/bin/env python3
"""Get Railway env vars including AUTH_PASSWORD."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Get service variables
print("=== Service Variables ===")
data = gql(f'''{{
  service(id: "{SERVICE_ID}") {{
    serviceVariables {{
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
    vars_list = data["service"]["serviceVariables"]["edges"]
    for edge in vars_list:
        v = edge["node"]
        val = v["value"]
        if len(val) > 80:
            val = val[:40] + "..." + val[-20:]
        print(f"  {v['name']} = {val}")
else:
    print("Failed to get variables")
