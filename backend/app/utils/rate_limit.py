"""IPベースの簡易レート制限。

候補者側の診断・推薦・レポート生成エンドポイントはゲスト利用前提でログイン必須にできない
（ログインを必須化すると無料でのお試し診断ができなくなる）。一方でこれらはGeminiを呼ぶため、
無制限公開だとコスト濫用・DoSの入口になる。ログインを要求せずに濫用を抑えるため、
IPごとのスライディングウィンドウでリクエスト数を制限する。

in-memory実装のため、Cloud Runが複数インスタンスにスケールすると制限はインスタンスごとに
独立する（合算されない）。トラフィックが増えて厳密な制限が必要になったらRedis等の共有ストアに
置き換える。
"""
from __future__ import annotations
import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request

_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _route_key(request: Request) -> str:
    """request.url.pathはsession_id等を含む解決済みパスのため、エンドポイントを
    一意に識別できるルートテンプレート（例: /api/diagnosis/sessions/{session_id}/messages）を使う。"""
    route = request.scope.get("route")
    return getattr(route, "path", request.url.path)


def rate_limiter(max_requests: int, window_seconds: int):
    """直近window_seconds秒間にmax_requests回までしか通さないFastAPI依存関数を返す。"""

    async def _check(request: Request) -> None:
        key = f"{_route_key(request)}:{_client_key(request)}"
        now = time.monotonic()
        hits = _hits[key]
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="リクエストが多すぎます。しばらく待ってから再試行してください。",
            )
        hits.append(now)

    return _check
