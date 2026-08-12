import importlib.util
import sys
from pathlib import Path

from fastapi import FastAPI


def _load_package(name: str, dirname: str):
    """resumake-agent/ has a hyphen in its name (not a valid `import`
    target), so it's loaded by file path instead. submodule_search_locations
    points the package's __path__ at that directory so its internal
    `from . import ...` submodule imports still resolve normally.
    Registering it in sys.modules first (before exec) lets Pydantic resolve
    the package's own forward-referenced type annotations."""
    package_dir = Path(__file__).parent / dirname
    spec = importlib.util.spec_from_file_location(
        name, package_dir / "__init__.py", submodule_search_locations=[str(package_dir)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


resumake_agent = _load_package("resumake_agent", "resumake-agent")

app = FastAPI()
app.include_router(resumake_agent.router)


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
