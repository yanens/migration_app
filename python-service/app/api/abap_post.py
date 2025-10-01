from fastapi import APIRouter, HTTPException
from typing import Dict
import requests, json
from requests.auth import HTTPBasicAuth

router = APIRouter()

SAP_BASE_URL = "http://vhcalhdbdb.dummy.nodomain:50000/sap/opu/odata/sap/ZY_MIGRATION_SRV"
SAP_USER = "TCSC0100"
SAP_PASS = "Yy469919"

session = requests.Session()

def send_to_sap(payload: Dict) -> Dict:
    """
    核心函数: 发送 JSON 到 SAP OData
    可被其他模块直接调用
    """
    entity_set = "DBDATASet"
    url = f"{SAP_BASE_URL}/{entity_set}('1')/$value"

    # token_resp = session.get(
    #     url,
    #     headers={"X-CSRF-Token": "Fetch"},
    #     auth=HTTPBasicAuth(SAP_USER, SAP_PASS),
    #     verify=False
    # )
    # if token_resp.status_code != 200:
    #     raise HTTPException(
    #         status_code=token_resp.status_code,
    #         detail=f"获取 CSRF Token 失败: {token_resp.text}"
    #     )

    # csrf_token = token_resp.headers.get("x-csrf-token")
    # cookies = token_resp.cookies
    
    headers = {
        "Content-Type": "application/octet-stream",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        # "X-CSRF-Token": csrf_token
        }

    def json_stream():
        yield json.dumps(payload)

    post_resp = session.put(
        url,
        data=json_stream(),
        headers=headers,
        # cookies=cookies,
        auth=HTTPBasicAuth(SAP_USER, SAP_PASS),
        stream=True,
        verify=False
    )

    if post_resp.status_code in [200, 201, 204]:
        return {"status": "success", "data": post_resp.json()}
    else:
        raise HTTPException(
            status_code=post_resp.status_code,
            detail=f"SAP 返回错误: {post_resp.text}"
        )


@router.post("/post_to_sap")
async def post_json_to_sap(payload: Dict):
    """
    FastAPI 路由封装，调用核心函数 send_to_sap
    """
    return send_to_sap(payload)