from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ui5_get, abap_post
import uvicorn

app = FastAPI()

# 解决 CORS 问题
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 生产环境建议改成 UI5 实际域名
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(ui5_get.router, prefix="/api/ui5_get", tags=["UI5"])
app.include_router(abap_post.router, prefix="/api/abap_post", tags=["ABAP"])

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
