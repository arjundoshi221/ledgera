"""Main entry point"""

if __name__ == "__main__":
    import os
    from src.api.main import app
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
    )
